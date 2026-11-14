import { resolve } from 'path';
import { PATHS, PROJECT_ALIASES } from './paths.js';
import autoprefixer from 'autoprefixer';
import postcssSortMediaQueries from 'postcss-sort-media-queries';
import { SCSS_ALIASES } from './paths.js';
import { findHtmlEntries } from '../utils/fs-utils.js';

/**
 * Создает базовую конфигурацию Vite для сборки
 * @param {boolean} minify - Минификация кода
 * @param {Array} plugins - Массив плагинов
 * @returns {Object} Конфигурация Vite
 */
export function createBuildConfig(minify = false, plugins = []) {
  return {
    root: PATHS.app,
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      manifest: false,
      // Vite 8: дефолтный минификатор — Oxc (esbuild выпилен из ядра,
      // 'esbuild' здесь больше не работает без отдельной зависимости)
      minify: minify,
      rollupOptions: {
        input: buildInputConfig(),
        output: buildOutputConfig(),
      },
    },
    publicDir: '../public',
    plugins,
    resolve: {
      alias: buildAliasConfig(),
    },
    css: buildCssConfig(minify),
  };
}

/**
 * Настройка точек входа
 * @returns {Object} Конфигурация для точек входа
 */
function buildInputConfig() {
  // Получаем HTML файлы как точки входа
  const htmlEntries = findHtmlEntries();
  
  return {
    ...htmlEntries,
    app: resolve(PATHS.js, 'app.js'),
    styles: resolve(PATHS.scss, 'main.scss'),
  };
}

/**
 * Настройка выходных файлов
 * @returns {Object} Конфигурация для выходных файлов
 */
function buildOutputConfig() {
  return {
    entryFileNames: 'js/app.js',
    chunkFileNames: 'js/[name].js',
    assetFileNames: (assetInfo) => {
      // at(-1): расширение — ПОСЛЕДНИЙ сегмент имени; at(1) на
      // multi-dot именах (photo.min.jpg) брал «min» и уводил файл в assets/
      const extType = assetInfo.name.split('.').at(-1);
      if (/css/i.test(extType)) {
        return 'css/app.css';
      }
      if (/png|jpe?g|gif|svg|webp|ico/i.test(extType)) {
        return 'img/[name][extname]';
      }
      if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
        return 'fonts/[name][extname]';
      }
      return 'assets/[name][extname]';
    },
  };
}

/**
 * Настройка алиасов для импортов
 * @returns {Object} Конфигурация алиасов
 */
function buildAliasConfig() {
  return {
    '@utils': PROJECT_ALIASES['@utils'],
    '@js': PROJECT_ALIASES['@js'],
    '@scss': PROJECT_ALIASES['@scss'],
    '@img': PROJECT_ALIASES['@img'],
    '@vendor': PROJECT_ALIASES['@vendor'],
    '@files': PROJECT_ALIASES['@files'],
    '@fonts': PROJECT_ALIASES['@fonts']
  };
}

/**
 * Настройка для обработки CSS и SCSS
 * @param {boolean} minify - Минификация кода
 * @returns {Object} Конфигурация CSS
 */
function buildCssConfig(minify = false) {
  return {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        logger: {
          warn: () => {},
        },
        api: 'modern-compiler',
        sourceMap: false,
        style: minify ? 'compressed' : 'expanded', // Стиль сжатия зависит от параметра минификации
        // Добавляем глобальные переменные со всеми алиасами для использования в SCSS
        additionalData: Object.entries(SCSS_ALIASES).map(([alias, path]) => {
          const varName = alias.replace('@', '$') + '-path';
          return `${varName}: "${path}";`;
        }).join('\n') + '\n'
      },
    },
    // Настройки PostCSS
    postcss: {
      plugins: [
        // Автоматическое добавление вендорных префиксов
        autoprefixer({
          // Современный browserslist: "not dead" отсекает IE/старый Edge,
          // remove по умолчанию (true) вычищает устаревшие префиксы из css
          overrideBrowserslist: ['> 0.5%', 'last 2 versions', 'not dead'],
          grid: false, // Отключаем префиксы для Grid Layout
          flexbox: false, // Отключаем префиксы для Flexbox
          cascade: true // Красивое форматирование префиксов
        }),
        
        // Группировка и сортировка медиа-запросов
        postcssSortMediaQueries({
          // Сортировка от мобильных к десктопным (mobile-first)
          sort: 'mobile-first'
        })
      ]
    }
  };
} 