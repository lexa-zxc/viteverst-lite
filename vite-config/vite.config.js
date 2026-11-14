import { createBuildConfig } from './config/build-config.js';
import {
  getAllPlugins,
  getBasePlugins
} from './plugins/index.js';
import { CONSOLE_COLORS, BUILD_SETTINGS } from './config/constants.js';

/**
 * Определение режима сборки и параметров конфигурации
 * @param {Object} env - Переменные окружения
 * @returns {Object} - Конфигурация Vite
 */
export default async function ({ mode }) {
  console.log(
    `${CONSOLE_COLORS.cyan}Режим сборки: ${CONSOLE_COLORS.green}${mode}${CONSOLE_COLORS.reset}`
  );

  const isDev = mode === 'development';
  const isProd = mode === 'production' || mode === 'production-min';
  const isMinify = mode === 'production-min';
  // Оптимизация изображений:
  //   - production-min — всегда
  //   - production — по флагу BUILD_SETTINGS.optimizeImages из constants.js
  //   - переменная окружения OPTIMIZE=true/false имеет приоритет над обоими
  const withOptimization = process.env.OPTIMIZE === 'true'
    || (process.env.OPTIMIZE !== 'false' && (isMinify || BUILD_SETTINGS.optimizeImages));

  // В режиме разработки используем только базовые плагины
  const plugins = isDev 
    ? await getBasePlugins() 
    : await getAllPlugins(withOptimization);

  // Создаем конфигурацию сборки с плагинами
  const config = createBuildConfig(isMinify, plugins);

  if (withOptimization) {
    console.log(
      `${CONSOLE_COLORS.yellow}Включена оптимизация изображений${CONSOLE_COLORS.reset}`
    );
  }

  if (isMinify) {
    console.log(
      `${CONSOLE_COLORS.yellow}Включена минификация кода${CONSOLE_COLORS.reset}`
    );
  }

  return config;
} 