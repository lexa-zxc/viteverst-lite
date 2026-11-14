import sassGlobImports from 'vite-plugin-sass-glob-import';
import { fileIncludePlugin } from './file-include-plugin.js';
import { htmlAliasPlugin } from './html-alias-plugin.js';
import { copyResourcesPlugin } from './copy-resources-plugin.js';
import { webpPipelinePlugin } from './webp-plugin.js';
import {
  normalizeCssPathsPlugin,
  processHtmlPlugin,
  renameJsPlugin
} from './html-processing-plugins.js';
import {
  scssEntryPlugin,
  htmlReloadPlugin,
  scssAliasPlugin,
  scssFileWatcherPlugin
} from './scss-plugins.js';
import { imageOptimizationPlugin } from './image-optimization-plugin.js';
import { HTML_ALIASES } from '../config/paths.js';

/**
 * Возвращает базовый набор плагинов для разработки
 * @returns {Array} Массив плагинов
 */
export async function getBasePlugins() {
  return [
    sassGlobImports(),
    fileIncludePlugin(),
    htmlAliasPlugin(HTML_ALIASES),
    scssEntryPlugin(),
    scssAliasPlugin(),
    htmlReloadPlugin(),
    scssFileWatcherPlugin()
  ];
}

/**
 * Возвращает плагины для копирования ресурсов
 * @returns {Array} Массив плагинов
 */
export function getResourcePlugins() {
  return [
    copyResourcesPlugin('images'),
    copyResourcesPlugin('vendor'),
    copyResourcesPlugin('fonts'),
    copyResourcesPlugin('files')
  ];
}

/**
 * Возвращает плагины для постобработки файлов
 * @param {Object} opts - { webp?: boolean }
 * @returns {Array} Массив плагинов
 */
export function getPostProcessPlugins({ webp = false } = {}) {
  // В webp-режиме webpPipelinePlugin заменяет processHtmlPlugin и несёт
  // в себе все webp-стадии (дубли → CSS → HTML) в ОДНОМ closeBundle:
  // rollup не ожидает async closeBundle-хуки, отдельные плагины гонялись
  // бы параллельно
  if (webp) {
    return [
      normalizeCssPathsPlugin(),
      renameJsPlugin(),
      webpPipelinePlugin()
    ];
  }

  return [
    normalizeCssPathsPlugin(),
    renameJsPlugin(),
    processHtmlPlugin() // должен идти последним — HTML зависит от финальных имён файлов
  ];
}

/**
 * Возвращает все плагины для продакшн сборки
 * @param {boolean} withImageOptimization - Флаг оптимизации изображений
 * @param {boolean} webp - Генерация webp-дублей (--webp)
 * @returns {Array} Массив плагинов
 */
export async function getAllPlugins(withImageOptimization = false, webp = false) {
  const basePlugins = await getBasePlugins();
  const allPlugins = [
    ...basePlugins,
    ...getResourcePlugins(),
    ...getPostProcessPlugins({ webp }),
  ];

  if (withImageOptimization) {
    // В webp-режиме сжатие не трогает .webp-дубли (их ведёт webpPipelinePlugin)
    allPlugins.push(await imageOptimizationPlugin({ skipWebp: webp }));
  }

  return allPlugins;
}
