import fs from 'fs';
import { resolve, join } from 'path';
import { PATHS, SCSS_ALIASES } from '../config/paths.js';
import { transformBuildHtml } from '../utils/html-transform.js';
import { normalizeCssAssetUrls } from '../utils/css-transform.js';
import { addIsWebpRules } from '../utils/css-webp-transform.js';
import { CONSOLE_COLORS } from '../config/constants.js';

/**
 * Пост-обработка финального CSS: нормализация путей к ассетам.
 *
 * На этой стадии Vite мог оставить в CSS абсолютные пути (`url(/fonts/...)`),
 * которые не работают в статическом dist. Прогоняем их через нашу утилиту
 * normalizeCssAssetUrls — она превращает их в относительные `url("../fonts/...")`.
 *
 * Это страховка: основная логика работает на стадии generateBundle в scssAliasPlugin,
 * но здесь мы перечитываем CSS с диска на случай если какой-то плагин его изменил
 * после generateBundle (например, postcss-оптимизаторы).
 *
 * @returns {import('vite').Plugin}
 */
export function normalizeCssPathsPlugin() {
  return {
    name: 'normalize-css-paths',
    apply: 'build',
    closeBundle: async () => {
      try {
        const cssDir = join(PATHS.dist, 'css');
        if (!fs.existsSync(cssDir)) return;

        fs.readdirSync(cssDir)
          .filter((file) => file.endsWith('.css'))
          .forEach((cssFile) => {
            const cssPath = join(cssDir, cssFile);
            const content = fs.readFileSync(cssPath, 'utf-8');
            const normalized = normalizeCssAssetUrls(content, SCSS_ALIASES);
            if (normalized !== content) {
              fs.writeFileSync(cssPath, normalized);
            }
          });

        console.log(`${CONSOLE_COLORS.green}CSS-пути нормализованы${CONSOLE_COLORS.reset}`);
      } catch (error) {
        console.error('Ошибка при нормализации CSS-путей:', error);
      }
    },
  };
}

/**
 * Пост-обработка CSS в dist/css/: генерация is-webp правил.
 *
 * Для каждой background-декларации с url(...jpg|png), у которой в dist/img
 * есть webp-дубль, создаётся .is-webp-копия правила с webp-урлом.
 * Подробности — в utils/css-webp-transform.js.
 * @returns {import('vite').Plugin}
 */
export function cssWebpTransformPlugin() {
  return {
    name: 'css-webp-transform',
    apply: 'build',
    closeBundle: async () => {
      try {
        const cssDir = join(PATHS.dist, 'css');
        if (!fs.existsSync(cssDir)) return;

        let totalAdded = 0;

        fs.readdirSync(cssDir)
          .filter((file) => file.endsWith('.css'))
          .forEach((cssFile) => {
            const cssPath = join(cssDir, cssFile);
            const css = fs.readFileSync(cssPath, 'utf-8');

            const { css: transformed, added } = addIsWebpRules(css, (cssUrl) => {
              return resolveWebpTwin(cssUrl);
            });

            if (added > 0) {
              fs.writeFileSync(cssPath, transformed);
              totalAdded += added;
            }
          });

        console.log(`${CONSOLE_COLORS.green}CSS: добавлено is-webp правил: ${totalAdded}${CONSOLE_COLORS.reset}`);
      } catch (error) {
        console.error('Ошибка при генерации is-webp правил:', error);
      }
    },
  };
}

/**
 * Проверяет наличие webp-дубля для урла из CSS и возвращает webp-урл.
 * Урлы в CSS относительные от dist/css/ (../img/...), либо img/... —
 * оба варианта резолвятся к dist.
 * @param {string} cssUrl - Урл из url(...)
 * @returns {string|null} Webp-урл в том же виде или null
 */
function resolveWebpTwin(cssUrl) {
  if (!/\.(jpe?g|png)$/i.test(cssUrl)) return null;

  // Пропускаем внешние и data:URL
  if (/^(https?:|data:|\/\/)/i.test(cssUrl)) return null;

  // ../img/x.jpg → dist/img/x.jpg; img/x.jpg → dist/img/x.jpg
  const relativeUrl = cssUrl.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  const originalPath = join(PATHS.dist, relativeUrl);
  const twinPath = originalPath.replace(/\.(jpe?g|png)$/i, '.webp');

  if (!fs.existsSync(twinPath)) return null;

  return cssUrl.replace(/\.(jpe?g|png)$/i, '.webp');
}

/**
 * Пост-обработка HTML в dist/:
 *   - удаляет crossorigin, type="module"
 *   - подменяет script/link на фиксированные пути (js/app.js, css/app.css)
 *   - убирает префикс ./ из src/href
 *   - убирает ведущий / (абсолютные пути → относительные)
 *   - с opts.webp: <img> → <picture> + webp-детект в <head>
 *
 * Работает на AST через node-html-parser — вся логика в utils/html-transform.js
 * @param {Object} opts - { webp?: boolean }
 * @returns {import('vite').Plugin}
 */
export function processHtmlPlugin({ webp = false } = {}) {
  return {
    name: 'process-html',
    apply: 'build',
    closeBundle: async () => {
      try {
        const htmlFiles = fs
          .readdirSync(PATHS.dist)
          .filter((file) => file.endsWith('.html'));

        // Проверка webp-дубля для <img src="img/x.jpg">
        const twinExists = webp
          ? (src) => {
              if (!/\.(jpe?g|png)$/i.test(src)) return false;
              const twinPath = resolve(
                PATHS.dist,
                src.replace(/\.(jpe?g|png)$/i, '.webp')
              );
              return fs.existsSync(twinPath);
            }
          : null;

        htmlFiles.forEach((htmlFile) => {
          const htmlPath = resolve(PATHS.dist, htmlFile);
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          const result = transformBuildHtml(htmlContent, { webp: twinExists });
          fs.writeFileSync(htmlPath, result);
        });

        console.log(`${CONSOLE_COLORS.green}HTML обработан (атрибуты и пути)${CONSOLE_COLORS.reset}`);
      } catch (error) {
        console.error('Ошибка при обработке HTML файлов:', error);
      }
    },
  };
}

/**
 * Переименовывает хешированные JS-чанки (app4.js, app5.js, ...) в app.js.
 * Нужен потому что Vite добавляет хеш-суффикс к чанкам чтобы избежать коллизий
 * с HTML-файлами с теми же именами.
 *
 * @returns {import('vite').Plugin}
 */
export function renameJsPlugin() {
  return {
    name: 'rename-js-plugin',
    apply: 'build',
    closeBundle: async () => {
      try {
        const jsDir = join(PATHS.dist, 'js');
        if (!fs.existsSync(jsDir)) {
          fs.mkdirSync(jsDir, { recursive: true });
          return;
        }

        fs.readdirSync(jsDir)
          .filter(
            (file) => file.startsWith('app') && file.endsWith('.js') && file !== 'app.js'
          )
          .forEach((file) => {
            const filePath = join(jsDir, file);
            const newFilePath = join(jsDir, 'app.js');

            if (fs.existsSync(newFilePath)) {
              fs.unlinkSync(newFilePath);
            }

            fs.renameSync(filePath, newFilePath);
          });
      } catch (error) {
        console.error('Ошибка при переименовании JS файла:', error);
      }
    },
  };
}
