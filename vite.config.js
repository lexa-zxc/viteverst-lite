import { createBuildConfig } from './vite-config/config/build-config.js';
import {
  getAllPlugins,
  getBasePlugins
} from './vite-config/plugins/index.js';
import { CONSOLE_COLORS, BUILD_SETTINGS } from './vite-config/config/constants.js';

/**
 * Опредение режима сборки и параметров конфигурации
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
  // Включаем оптимизацию изображений автоматически для режима production-min
  // или если установлена переменная окружения OPTIMIZE
  const withOptimization = process.env.OPTIMIZE === 'true'
    || (process.env.OPTIMIZE !== 'false' && (isMinify || BUILD_SETTINGS.optimizeImages));

  // WebP-дубли: ключ --webp. Три пути попадания (см. vite-config/scripts/vite-cli.js):
  //   npm run build --webp      → npm съедает флаг → npm_config_webp=true
  //   npm run build -- --webp   → флаг в argv vite (приходит через cli-обёртку)
  //   VITEVERST_WEBP=true       → выставляет cli-обёртка
  const isWebp = process.argv.includes('--webp')
    || process.env.npm_config_webp === 'true'
    || process.env.VITEVERST_WEBP === 'true';

  if (isWebp && isProd) {
    console.log(
      `${CONSOLE_COLORS.green}WebP-дубли включены (--webp)${CONSOLE_COLORS.reset}`
    );
  }

  // В режиме разработки используем только базовые плагины
  const plugins = isDev
    ? await getBasePlugins()
    : await getAllPlugins(withOptimization, isWebp);

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
