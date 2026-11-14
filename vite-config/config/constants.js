import { cpus } from 'node:os';

// Максимальное количество параллельных процессов
export const MAX_PARALLEL_PROCESSES = Math.max(1, cpus().length - 1);

// Размер чанка файлов для многопоточной обработки
export const DEFAULT_CHUNK_SIZE = 100;

// Цвета для вывода в консоль
export const CONSOLE_COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Настройки режима build
export const BUILD_SETTINGS = {
  // Сжимать изображения при обычной сборке `npm run build`
  // (build-min сжимает всегда, независимо от этого флага)
  optimizeImages: true,
};

// Конфигурация оптимизации изображений (параметры sharp)
// jpeg/webp q85 — оптимум вес/качество: на фото от q90 глазами не отличить,
// вес −25–35% (замеры: hero-bg-2 100.8 KB против 141.5). На тонком тексте
// q90 держит края глифов чуть лучше — если проект про баннеры с текстом,
// можно поднять до 90. PNG палитра — НЕ опускать ниже 90: на плавных
// градиентах в 256 цветах появляется бандинг (q80 — PSNR 38.8, q90 — 40.1).
export const IMAGE_OPTIMIZATION = {
  jpeg: {
    quality: 85,
    mozjpeg: true // тот же кодек mozjpeg, что был в imagemin
  },
  png: {
    quality: 90,
    palette: true, // квантизация до 256 цветов (аналог pngquant)
    compressionLevel: 9
  },
  webp: {
    quality: 85,
    // libwebp -sharp_yuv: честная цветовая половина разрешения.
    // Без него 4:2:0 давит хрому — тонкий текст плывёт, на плоских
    // заливках мозаика
    smartSubsample: true
  },
  gif: {
    effort: 7 // 0–10, аналог optimizationLevel в gifsicle
  }
};

// Список поддерживаемых форматов изображений
export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico']; 