import fs from 'fs';
import { createHash } from 'crypto';
import { join, extname, basename, relative, resolve, sep } from 'path';
import { PATHS } from '../config/paths.js';
import { findAllImages, formatFileSize } from '../utils/fs-utils.js';
import { CONSOLE_COLORS, IMAGE_OPTIMIZATION } from '../config/constants.js';

/**
 * Директория кеша оптимизации изображений.
 * Папка .cache уже в .gitignore — в git не попадёт.
 * Структура:
 *   .cache/optimize-images/
 *   ├── cache.json
 *   │   ├── settings  — хеш настроек sharp + версии (инвалидация всего кеша)
 *   │   ├── entries   — карта: hash(содержимое) → расширение
 *   │   └── statMap   — карта: путь → { size, mtimeMs, contentHash }
 *   │                    stat fast path: пропускает хеширование, пока
 *   │                    отпечаток исходника совпадает с записанным
 *   └── store/        — сжатые результаты, имена = hash + расширение
 */
const CACHE_DIR = join(process.cwd(), '.cache', 'optimize-images');

/**
 * Возвращает функцию-кодировщик sharp для файла по его расширению
 * @param {string} ext - Расширение файла в нижнем регистре (с точкой)
 * @returns {Function|null} Кодировщик или null для неподдерживаемого формата
 */
function getEncoder(ext) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return (sharp) => sharp.jpeg(IMAGE_OPTIMIZATION.jpeg);
    case '.png':
      return (sharp) => sharp.png(IMAGE_OPTIMIZATION.png);
    case '.webp':
      return (sharp) => sharp.webp(IMAGE_OPTIMIZATION.webp);
    case '.gif':
      return (sharp) => sharp.gif(IMAGE_OPTIMIZATION.gif);
    default:
      return null;
  }
}

/**
 * SHA-1 хеш содержимого файла (стримом — не грузим файл в память целиком)
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} Хеш
 */
function fileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/**
 * stat без исключений — файла может не быть (удалили посреди билда)
 * @param {string} filePath - Путь к файлу
 * @returns {fs.Stats|null} Статистика или null
 */
function statSyncSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Версия настроек: хеш конфига sharp + версии самой sharp.
 * Меняется при любой правке IMAGE_OPTIMIZATION или обновлении sharp —
 * кеш с прошлыми настройками считается недействительным.
 * @param {string} sharpVersion - Версия sharp
 * @returns {string} Короткий хеш
 */
function getSettingsVersion(sharpVersion) {
  return createHash('sha1')
    .update(JSON.stringify(IMAGE_OPTIMIZATION) + sharpVersion)
    .digest('hex')
    .slice(0, 12);
}

/**
 * Загрузка кеша. Если настроек нет / кеш битый / настройки изменились —
 * стор стирается и начинаем с нуля.
 * @param {string} settingsVersion - Текущая версия настроек
 * @returns {Object} Кеш вида { settings, entries, statMap }
 */
function loadCache(settingsVersion) {
  try {
    const cachePath = join(CACHE_DIR, 'cache.json');
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cache && cache.settings === settingsVersion) {
        // statMap появился позже entries — старый формат мигрирует на месте
        return { ...cache, statMap: cache.statMap || {} };
      }
    }
  } catch {
    // Битый cache.json — начнём с чистого кеша
  }

  // Настройки/версия изменились или кеша не было — стор неактуален
  fs.rmSync(join(CACHE_DIR, 'store'), { recursive: true, force: true });
  return { settings: settingsVersion, entries: {}, statMap: {} };
}

/**
 * Сохранение кеша на диск
 * @param {Object} cache - Кеш вида { settings, entries }
 */
function saveCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(join(CACHE_DIR, 'cache.json'), JSON.stringify(cache, null, 2));
}

/**
 * Запись файла с ретраями — на Windows антивирус/индексатор могут
 * держать свежезаписанный файл пару мгновений (EPERM / UNKNOWN)
 * @param {string} filePath - Путь к файлу
 * @param {Buffer} data - Данные для записи
 */
async function writeFileWithRetry(filePath, data) {
  const ATTEMPTS = 5;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      fs.writeFileSync(filePath, data);
      return;
    } catch (error) {
      if (i === ATTEMPTS - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)));
    }
  }
}

/**
 * Обработка одного изображения:
 *   - stat fast path: отпечаток исходника совпал → хеш из statMap, без вычислений
 *   - иначе честный SHA-1 (файл новый/заменён/исходник пропал)
 *   - хеш-хит    → восстановление готового файла из стора (мс вместо секунд)
 *   - хеш-промах → сжатие sharp + сохранение результата в стор
 *
 * Важно: «скипать» нельзя — dist каждый раз собирается из сырых оригиналов,
 * поэтому хит подменяет свежескопированный оригинал сжатой версией из стора.
 *
 * @param {import('sharp').Sharp} sharp - Экземпляр sharp
 * @param {string} imagePath - Путь к изображению в dist
 * @param {Object} cache - Загруженный кеш (мутируется: добавляются новые записи)
 * @param {Set<string>} usedHashes - Хеши, использованные в этом прогоне (для чистки кеша)
 * @param {Set<string>} usedPaths - Пути, встретившиеся в этом прогоне (для чистки statMap)
 * @returns {Object} Результат обработки
 */
async function processImage(sharp, imagePath, cache, usedHashes, usedPaths) {
  const imageExt = extname(imagePath).toLowerCase();
  const encode = getEncoder(imageExt);

  // Формат не поддерживается (svg, ico, ...) — пропускаем
  if (!encode) {
    return { path: imagePath, skipped: true };
  }

  try {
    const name = basename(imagePath);

    //=== Определяем contentHash: stat fast path или честный хеш ===//
    // Отпечаток берём у ИСХОДНИКА в app/: он постоянен между билдами.
    // dist-копия пересоздаётся каждый билд со свежим mtime — stat по ней бесполезен.
    const relPath = relative(PATHS.dist, imagePath).split(sep).join('/').toLowerCase();
    usedPaths.add(relPath);

    const sourceStat = statSyncSafe(resolve(PATHS.app, relPath));
    const statEntry = cache.statMap[relPath];

    let contentHash;
    if (
      sourceStat &&
      statEntry &&
      statEntry.size === sourceStat.size &&
      statEntry.mtimeMs === sourceStat.mtimeMs
    ) {
      // Fast path: отпечаток совпал — верим карте, хеш не считаем
      contentHash = statEntry.contentHash;
    } else {
      contentHash = await fileHash(imagePath);
      if (sourceStat) {
        cache.statMap[relPath] = {
          size: sourceStat.size,
          mtimeMs: sourceStat.mtimeMs,
          contentHash
        };
      } else {
        // Исходник пропал посреди билда — stat-запись больше не имеет смысла
        delete cache.statMap[relPath];
      }
    }

    usedHashes.add(contentHash);

    //=== Хит: восстанавливаем сжатую версию из стора ===//
    const cachedExt = cache.entries[contentHash];
    if (cachedExt) {
      const storeFile = join(CACHE_DIR, 'store', contentHash + cachedExt);
      if (fs.existsSync(storeFile)) {
        const originalSize = fs.statSync(imagePath).size; // до перезаписи!
        const cachedBuffer = fs.readFileSync(storeFile);
        await writeFileWithRetry(imagePath, cachedBuffer);
        return {
          path: imagePath,
          name,
          originalSize,
          newSize: cachedBuffer.length,
          compressionPercent: Math.round((1 - cachedBuffer.length / originalSize) * 100),
          fromCache: true,
          success: true
        };
      }
    }

    //=== Промах: сжимаем заново и кладём в стор ===//
    const originalSize = fs.statSync(imagePath).size;

    // Для GIF обрабатываем все кадры, иначе анимация схлопнется в первый кадр
    const readOptions = imageExt === '.gif' ? { animated: true } : {};

    // Читаем вход в буфер сами: libvips мапит файлы (mmap) и держит хендл
    // открытым до финализации инстанса — на Windows это блокирует перезапись.
    // С буфером sharp исходный файл вообще не открывает.
    const inputBuffer = fs.readFileSync(imagePath);
    const optimizedBuffer = await encode(sharp(inputBuffer, readOptions)).toBuffer();
    await writeFileWithRetry(imagePath, optimizedBuffer);

    // Сохраняем результат в стор кеша
    fs.mkdirSync(join(CACHE_DIR, 'store'), { recursive: true });
    fs.writeFileSync(join(CACHE_DIR, 'store', contentHash + imageExt), optimizedBuffer);
    cache.entries[contentHash] = imageExt;

    return {
      path: imagePath,
      name,
      originalSize,
      newSize: optimizedBuffer.length,
      compressionPercent: Math.round((1 - optimizedBuffer.length / originalSize) * 100),
      success: true
    };
  } catch (error) {
    console.error(`Ошибка при оптимизации ${basename(imagePath)}:`, error.message);
    return { path: imagePath, error: error.message };
  }
}

/**
 * Плагин для оптимизации изображений с файловым кешем
 * @returns {Object} Vite плагин
 */
export async function imageOptimizationPlugin() {
  return {
    name: 'optimize-images-plugin',
    apply: 'build',
    enforce: 'post',
    closeBundle: async () => {
      try {
        const imgDistDir = join(PATHS.dist, 'img');
        if (!fs.existsSync(imgDistDir)) return;

        console.log(`${CONSOLE_COLORS.green}Начинаем оптимизацию изображений (sharp)...${CONSOLE_COLORS.reset}`);

        // Находим все изображения (кроме SVG)
        const allImages = findAllImages(imgDistDir);

        if (allImages.length === 0) {
          console.log(`${CONSOLE_COLORS.yellow}Изображения для оптимизации не найдены${CONSOLE_COLORS.reset}`);
          return;
        }

        // Загружаем sharp лениво — только когда оптимизация реально нужна
        const sharp = (await import('sharp')).default;

        // Кеш: валиден пока не менялись настройки и версия sharp
        const settingsVersion = getSettingsVersion(sharp.versions.sharp);
        const cache = loadCache(settingsVersion);
        const usedHashes = new Set();
        const usedPaths = new Set();

        console.log(`${CONSOLE_COLORS.cyan}Найдено изображений для оптимизации: ${allImages.length}${CONSOLE_COLORS.reset}`);

        // Счетчики для отображения прогресса
        let processedCount = 0;
        const startTime = Date.now();

        function updateProgress() {
          processedCount++;
          const percent = Math.round((processedCount / allImages.length) * 100);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\r${CONSOLE_COLORS.cyan}Оптимизация изображений: ${percent}% (${processedCount}/${allImages.length}) - ${elapsed}с${CONSOLE_COLORS.reset}`);
        }

        // sharp сам распараллеливает работу через пул потоков libvips,
        // поэтому запускаем все файлы сразу — лишние задачи встают в очередь
        const results = await Promise.all(
          allImages.map(async (imagePath) => {
            const result = await processImage(sharp, imagePath, cache, usedHashes, usedPaths);
            updateProgress();
            return result;
          })
        );

        console.log('\n'); // Новая строка после прогресс-бара

        // Чистим кеш от записей, которые не встретились в этом прогоне
        for (const hash of Object.keys(cache.entries)) {
          if (!usedHashes.has(hash)) delete cache.entries[hash];
        }
        for (const path of Object.keys(cache.statMap)) {
          if (!usedPaths.has(path)) delete cache.statMap[path];
        }
        saveCache(cache);

        // Фильтруем результаты
        const optimizedImages = results.filter(r => r && r.success && !r.skipped);
        const fromCacheCount = optimizedImages.filter(r => r.fromCache).length;
        const skippedImages = results.filter(r => r && r.skipped);
        const failedImages = results.filter(r => !r || r.error);

        // Рассчитываем общую статистику
        let totalOriginalSize = 0;
        let totalOptimizedSize = 0;

        optimizedImages.forEach(img => {
          totalOriginalSize += img.originalSize;
          totalOptimizedSize += img.newSize;
        });

        // Выводим общую статистику оптимизации
        if (optimizedImages.length > 0) {
          console.log(`\n${CONSOLE_COLORS.green}----- Статистика оптимизации -----${CONSOLE_COLORS.reset}`);

          // Общая статистика
          const totalSaved = totalOriginalSize - totalOptimizedSize;
          const totalPercent = Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100);

          console.log(
            `\n${CONSOLE_COLORS.cyan}Общая экономия:${CONSOLE_COLORS.reset} ${formatFileSize(totalSaved)} (${CONSOLE_COLORS.green}-${totalPercent}%${CONSOLE_COLORS.reset})`
          );
          console.log(`${CONSOLE_COLORS.cyan}Успешно оптимизировано:${CONSOLE_COLORS.reset} ${optimizedImages.length}`);

          if (fromCacheCount > 0) {
            console.log(`${CONSOLE_COLORS.cyan}Взято из кеша:${CONSOLE_COLORS.reset} ${fromCacheCount}`);
          }

          if (skippedImages.length > 0) {
            console.log(`${CONSOLE_COLORS.cyan}Пропущено (не требуется оптимизация):${CONSOLE_COLORS.reset} ${skippedImages.length}`);
          }

          if (failedImages.length > 0) {
            console.log(`${CONSOLE_COLORS.yellow}Не удалось оптимизировать:${CONSOLE_COLORS.reset} ${failedImages.length}`);
          }

          console.log(`${CONSOLE_COLORS.cyan}Время выполнения:${CONSOLE_COLORS.reset} ${((Date.now() - startTime) / 1000).toFixed(2)}с`);
          console.log(`${CONSOLE_COLORS.green}---------------------------------${CONSOLE_COLORS.reset}`);
        } else {
          console.log(`${CONSOLE_COLORS.yellow}Изображения не нуждаются в оптимизации${CONSOLE_COLORS.reset}`);
        }
      } catch (error) {
        console.error('Ошибка при оптимизации изображений:', error);
      }
    }
  };
}
