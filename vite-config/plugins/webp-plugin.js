import fs from 'fs';
import { join, basename } from 'path';
import { PATHS } from '../config/paths.js';
import { findAllImages } from '../utils/fs-utils.js';
import { CONSOLE_COLORS, IMAGE_OPTIMIZATION } from '../config/constants.js';
import {
  CACHE_DIR,
  loadCache,
  saveCache,
  resolveContentHash,
  restoreFromStore,
  writeFileWithRetry,
  getFullSettingsVersion,
  runExclusive
} from '../utils/img-cache.js';
import { addIsWebpRules } from '../utils/css-webp-transform.js';
import { transformBuildHtml } from '../utils/html-transform.js';

/**
 * Генерация webp-дублей для jpg/png в dist/img.
 *
 * Для каждого оригинала создаётся сосед file.webp (если webp вышел легче —
 * на плоских PNG webp может быть тяжелее, такой дубль не нужен).
 * Дубли кешируются как сжатые оригиналы: ключ contentHash, результат
 * в store/<hash>.webp, warm-билд восстанавливает копированием.
 *
 * ВАЖНО: вызывается из webpPipelinePlugin, не как отдельный closeBundle-хук —
 * rollup не ожидает завершения async closeBundle, и следующие хуки
 * начнутся до записи дублей.
 * @returns {Promise<void>}
 */
async function generateWebpTwins() {
  const imgDistDir = join(PATHS.dist, 'img');
  if (!fs.existsSync(imgDistDir)) return;

  console.log(`${CONSOLE_COLORS.green}Генерация webp-дублей (sharp)...${CONSOLE_COLORS.reset}`);

  // Только jpg/png — gif осознанно не трогаем, svg вектор
  const allImages = findAllImages(imgDistDir).filter((p) =>
    /\.(jpe?g|png)$/i.test(p)
  );

  if (allImages.length === 0) {
    console.log(`${CONSOLE_COLORS.yellow}JPG/PNG для webp-дублей не найдены${CONSOLE_COLORS.reset}`);
    return;
  }

  // Ленивая загрузка sharp
  const sharp = (await import('sharp')).default;

  // Один кеш со сжатием оригиналов — ВАЖНО: тот же settings-хеш, что и в
  // image-optimization-plugin, иначе loadCache каждого вайпает кеш другого
  const settingsVersion = getFullSettingsVersion(IMAGE_OPTIMIZATION, sharp.versions.sharp);
  const cache = loadCache(settingsVersion);
  const usedHashes = new Set();
  const usedPaths = new Set();

  let generated = 0;
  let restored = 0;
  let skipped = 0;
  let processedCount = 0;
  const startTime = Date.now();

  function updateProgress() {
    processedCount++;
    const percent = Math.round((processedCount / allImages.length) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r${CONSOLE_COLORS.cyan}WebP-дубли: ${percent}% (${processedCount}/${allImages.length}) - ${elapsed}с${CONSOLE_COLORS.reset}`);
  }

  await Promise.all(
    allImages.map(async (imagePath) => {
      try {
        const twinPath = imagePath.replace(/\.(jpe?g|png)$/i, '.webp');
        const contentHash = await resolveContentHash(imagePath, cache, usedHashes, usedPaths);
        const storeFile = join(CACHE_DIR, 'store', contentHash + '.webp');

        //=== Хит: восстанавливаем дубль из стора ===//
        if (cache.webps[contentHash] && (await restoreFromStore(storeFile, twinPath))) {
          restored++;
          updateProgress();
          return;
        }

        //=== Промах: кодируем webp ===//
        // Буфером — см. комментарий в image-optimization-plugin про mmap
        const inputBuffer = fs.readFileSync(imagePath);
        const webpBuffer = await sharp(inputBuffer)
          .webp(IMAGE_OPTIMIZATION.webp)
          .toBuffer();

        // Webp тяжелее оригинала (бывает на плоских PNG) — дубль не нужен
        if (webpBuffer.length >= fs.statSync(imagePath).size) {
          skipped++;
          updateProgress();
          return;
        }

        fs.mkdirSync(join(CACHE_DIR, 'store'), { recursive: true });
        fs.writeFileSync(storeFile, webpBuffer);
        cache.webps[contentHash] = true;
        await writeFileWithRetry(twinPath, webpBuffer);
        generated++;
        updateProgress();
      } catch (error) {
        console.error(`Ошибка webp-дубля ${basename(imagePath)}:`, error.message);
        updateProgress();
      }
    })
  );

  console.log('\n'); // Новая строка после прогресс-бара

  // Чистим webps-записи, не встретившиеся в этом прогоне
  for (const hash of Object.keys(cache.webps)) {
    if (!usedHashes.has(hash)) delete cache.webps[hash];
  }
  for (const path of Object.keys(cache.statMap)) {
    if (!usedPaths.has(path)) delete cache.statMap[path];
  }
  saveCache(cache);

  console.log(
    `${CONSOLE_COLORS.green}WebP-дубли готовы${CONSOLE_COLORS.reset}: ${CONSOLE_COLORS.cyan}сгенерировано${CONSOLE_COLORS.reset} ${generated}, ${CONSOLE_COLORS.cyan}из кеша${CONSOLE_COLORS.reset} ${restored}, ${CONSOLE_COLORS.cyan}без выигрыша${CONSOLE_COLORS.reset} ${skipped}, ${CONSOLE_COLORS.cyan}время${CONSOLE_COLORS.reset} ${((Date.now() - startTime) / 1000).toFixed(2)}с`
  );
}

/**
 * Is-webp правила в dist/css/*.css — подробности в utils/css-webp-transform.js
 */
function transformDistCssWebp() {
  const cssDir = join(PATHS.dist, 'css');
  if (!fs.existsSync(cssDir)) return;

  let totalAdded = 0;

  fs.readdirSync(cssDir)
    .filter((file) => file.endsWith('.css'))
    .forEach((cssFile) => {
      const cssPath = join(cssDir, cssFile);
      const css = fs.readFileSync(cssPath, 'utf-8');

      const { css: transformed, added } = addIsWebpRules(css, (cssUrl) =>
        resolveWebpTwin(cssUrl)
      );

      if (added > 0) {
        fs.writeFileSync(cssPath, transformed);
        totalAdded += added;
      }
    });

  console.log(`${CONSOLE_COLORS.green}CSS: добавлено is-webp правил: ${totalAdded}${CONSOLE_COLORS.reset}`);
}

/**
 * Проверяет наличие webp-дубля для урла из CSS и возвращает webp-урл.
 * Урлы в CSS относительные от dist/css/ (../img/...).
 * @param {string} cssUrl - Урл из url(...)
 * @returns {string|null} Webp-урл в том же виде или null
 */
function resolveWebpTwin(cssUrl) {
  if (!/\.(jpe?g|png)$/i.test(cssUrl)) return null;

  // Пропускаем внешние и data:URL
  if (/^(https?:|data:|\/\/)/i.test(cssUrl)) return null;

  // ../img/x.jpg → dist/img/x.jpg
  const relativeUrl = cssUrl.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  const twinPath = join(PATHS.dist, relativeUrl).replace(/\.(jpe?g|png)$/i, '.webp');

  if (!fs.existsSync(twinPath)) return null;

  return cssUrl.replace(/\.(jpe?g|png)$/i, '.webp');
}

/**
 * Единый webp-пайплайн одного closeBundle: дубли → CSS → HTML.
 *
 * Почему одной стадией: rollup НЕ ожидает завершения async closeBundle-хуков —
 * при отдельных плагинах постобработка стартовала до записи дублей.
 * Здесь всё последовательно внутри одного хука.
 *
 * @returns {Object} Vite плагин
 */
export function webpPipelinePlugin() {
  return {
    name: 'webp-pipeline',
    apply: 'build',
    // runExclusive: см. комментарий в image-optimization-plugin —
    // closeBundle-хуки без сериализации затирают кеш друг друга
    closeBundle: () =>
      runExclusive('webp-pipeline', async () => {
        try {
          // 1. Дубли в dist/img
          await generateWebpTwins();

        // 2. Is-webp правила в CSS (дубли уже записаны)
        transformDistCssWebp();

        // 3. HTML: <img> → <picture> + webp-детект в <head>
        const htmlFiles = fs
          .readdirSync(PATHS.dist)
          .filter((file) => file.endsWith('.html'));

        const twinExists = (src) => {
          if (!/\.(jpe?g|png)$/i.test(src)) return false;
          const twinPath = join(
            PATHS.dist,
            src.replace(/\.(jpe?g|png)$/i, '.webp')
          );
          return fs.existsSync(twinPath);
        };

        htmlFiles.forEach((htmlFile) => {
          const htmlPath = join(PATHS.dist, htmlFile);
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          const result = transformBuildHtml(htmlContent, { webp: twinExists });
          fs.writeFileSync(htmlPath, result);
        });

        console.log(`${CONSOLE_COLORS.green}HTML обработан (атрибуты и пути)${CONSOLE_COLORS.reset}`);
      } catch (error) {
        console.error('Ошибка webp-пайплайна:', error);
      }
      })
  };
}
