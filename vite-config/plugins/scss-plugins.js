import fs from 'fs';
import { join } from 'path';
import { PATHS, SCSS_ALIASES } from '../config/paths.js';
import { CONSOLE_COLORS } from '../config/constants.js';
import { resolveScssAliases, normalizeCssAssetUrls } from '../utils/css-transform.js';

/**
 * Плагин для создания точки входа для SCSS.
 * Подсовывает main.scss как отдельный chunk в build-mode.
 * @returns {import('vite').Plugin}
 */
export function scssEntryPlugin() {
  return {
    name: 'scss-entry-plugin',
    apply: 'build',
    buildStart() {
      try {
        const scssEntryPath = join(PATHS.scss, 'main.scss');
        if (fs.existsSync(scssEntryPath)) {
          this.emitFile({
            type: 'chunk',
            id: scssEntryPath,
            name: 'styles',
          });
          console.log(`${CONSOLE_COLORS.green}SCSS обработан как отдельная точка входа${CONSOLE_COLORS.reset}`);
        }
      } catch (error) {
        console.error('Ошибка при создании точки входа для SCSS:', error);
      }
    },
  };
}

/**
 * Полная перезагрузка страницы при изменении HTML-файлов.
 * Vite по умолчанию не умеет HMR для шаблонов, собранных через @@include.
 * @returns {import('vite').Plugin}
 */
export function htmlReloadPlugin() {
  return {
    name: 'html-reload',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.html')) {
        server.ws.send({ type: 'full-reload', path: '*' });
        return [];
      }
    },
  };
}

/**
 * Разворачивает SCSS-алиасы (@img, @vendor, ...) в коде стилей.
 * Работает на двух стадиях:
 *   - transform()       — на каждом .scss/.sass/.css модуле (pre-compile)
 *   - generateBundle()  — на финальном CSS (пост-компиляция)
 *
 * Вся логика преобразований вынесена в utils/css-transform.js
 * @returns {import('vite').Plugin}
 */
export function scssAliasPlugin() {
  return {
    name: 'scss-alias-plugin',

    transform(code, id) {
      if (!id.match(/\.(scss|sass|css)$/)) return;
      return { code: resolveScssAliases(code, SCSS_ALIASES), map: null };
    },

    generateBundle(_, bundle) {
      for (const key of Object.keys(bundle)) {
        if (!key.endsWith('.css')) continue;
        const asset = bundle[key];
        asset.source = normalizeCssAssetUrls(asset.source, SCSS_ALIASES);
      }
    },
  };
}

/**
 * Плагин для активации новых SCSS-файлов на dev-сервере.
 *
 * Зачем: main.scss содержит glob-импорт `@import 'pages/*'`, который
 * резолвится vite-plugin-sass-glob-import ОДИН РАЗ на transform-стадии.
 * Когда пользователь создаёт новый .scss в pages/ — glob его не видит,
 * пока main.scss не будет пересобран.
 *
 * Решение:
 *   1. Когда watcher замечает новый .scss/.sass — инвалидируем модуль
 *      main.scss в moduleGraph (забываем закешированный transform).
 *   2. Эмулируем 'change' на main.scss через server.watcher.emit —
 *      Vite обработает его штатной логикой без записи на диск.
 *   3. Отправляем full-reload браузеру.
 *
 * @returns {import('vite').Plugin}
 */
export function scssFileWatcherPlugin() {
  return {
    name: 'scss-file-watcher-plugin',
    apply: 'serve',
    configureServer(server) {
      const mainScssPath = join(PATHS.scss, 'main.scss');

      server.watcher.on('add', (addedPath) => {
        if (!addedPath.endsWith('.scss') && !addedPath.endsWith('.sass')) return;

        // 1. Инвалидируем все модули, связанные с main.scss
        const modules = server.moduleGraph.getModulesByFile(mainScssPath);
        if (modules && modules.size > 0) {
          for (const mod of modules) {
            server.moduleGraph.invalidateModule(mod);
          }
        }

        // 2. Эмулируем change — Vite пересобирает через штатный pipeline
        server.watcher.emit('change', mainScssPath);

        // 3. Перезагрузка страницы
        server.ws.send({ type: 'full-reload', path: '*' });

        console.log(
          `${CONSOLE_COLORS.green}Обнаружен новый SCSS-файл: ${addedPath}${CONSOLE_COLORS.reset}`
        );
      });
    },
  };
}
