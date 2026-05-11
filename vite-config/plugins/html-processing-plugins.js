import fs from 'fs';
import { resolve, join } from 'path';
import { PATHS } from '../config/paths.js';
import { transformBuildHtml } from '../utils/html-transform.js';
import { CONSOLE_COLORS } from '../config/constants.js';

/**
 * Плагин для исправления путей к шрифтам в CSS.
 * Работает с готовым CSS-файлом (не HTML), поэтому regex здесь уместен.
 * @returns {import('vite').Plugin}
 */
export function fixFontPathsPlugin() {
  return {
    name: 'fix-font-paths',
    apply: 'build',
    closeBundle: async () => {
      try {
        const cssDir = join(PATHS.dist, 'css');
        if (!fs.existsSync(cssDir)) return;

        fs.readdirSync(cssDir)
          .filter((file) => file.endsWith('.css'))
          .forEach((cssFile) => {
            const cssPath = join(cssDir, cssFile);
            let cssContent = fs.readFileSync(cssPath, 'utf-8');

            cssContent = cssContent.replace(
              /url\(['"]?\/fonts\/([^'")]+)['"]?\)/g,
              'url("../fonts/$1")'
            );

            fs.writeFileSync(cssPath, cssContent);
          });

        console.log(`${CONSOLE_COLORS.green}Пути к шрифтам исправлены${CONSOLE_COLORS.reset}`);
      } catch (error) {
        console.error('Ошибка при исправлении путей к шрифтам:', error);
      }
    },
  };
}

/**
 * Плагин для обработки HTML файлов (удаление лишних атрибутов, подмена путей).
 * Работает на AST — не использует regex для парсинга HTML.
 * @returns {import('vite').Plugin}
 */
export function processHtmlPlugin() {
  return {
    name: 'process-html',
    apply: 'build',
    closeBundle: async () => {
      try {
        const htmlFiles = fs
          .readdirSync(PATHS.dist)
          .filter((file) => file.endsWith('.html'));

        htmlFiles.forEach((htmlFile) => {
          const htmlPath = resolve(PATHS.dist, htmlFile);
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          const result = transformBuildHtml(htmlContent);
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
 * Плагин для финальной нормализации путей в HTML (удаление `./`).
 * Работает на AST.
 * @returns {import('vite').Plugin}
 */
export function fixAssetsPathsPlugin() {
  return {
    name: 'fix-assets-paths',
    apply: 'build',
    closeBundle: async () => {
      try {
        fs.readdirSync(PATHS.dist)
          .filter((file) => file.endsWith('.html'))
          .forEach((htmlFile) => {
            const htmlPath = resolve(PATHS.dist, htmlFile);
            const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

            // transformBuildHtml уже убирает ./, но на случай если кто-то
            // встроит сюда свой плагин между ним и этим — прогоняем ещё раз
            const result = transformBuildHtml(htmlContent);
            fs.writeFileSync(htmlPath, result);
          });

        console.log(`${CONSOLE_COLORS.green}Пути к ресурсам исправлены (удалены префиксы ./)${CONSOLE_COLORS.reset}`);
      } catch (error) {
        console.error('Ошибка при исправлении путей к ресурсам:', error);
      }
    },
  };
}

/**
 * Плагин для переименования хешированных JS-чанков в app.js.
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
