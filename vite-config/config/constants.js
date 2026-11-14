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
// Качество 90 везде — приоритет визуалу (решение после ручного теста).
// Цена против q80: +35–50% веса, Lighthouse "Efficiently encode images"
// может помечать крупные фото. Ниже png-качества не опускаться: на плавных
// градиентах в 256 цветах появляется бандинг (q80 — PSNR 38.8, q90 — 40.1).
export const IMAGE_OPTIMIZATION = {
  jpeg: {
    quality: 90,
    mozjpeg: true // тот же кодек mozjpeg, что был в imagemin
  },
  png: {
    quality: 90, // 80 даёт бандинг на плавных градиентах (замер: PSNR 38.8 → 40.1)
    palette: true, // квантизация до 256 цветов (аналог pngquant)
    compressionLevel: 9
  },
  webp: {
    quality: 90,
    // libwebp -sharp_yuv: честная цветовая половина разрешения.
    // Без него 4:2:0 давит хрому — тонкий текст плывёт, на плоских
    // заливках мозаика (замерено на баннере: вес +3.6%, PSNR +0.5 dB,
    // края букв заметно чётче)
    smartSubsample: true
  },
  gif: {
    effort: 7 // 0–10, аналог optimizationLevel в gifsicle
  }
};

// Список поддерживаемых форматов изображений
export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico']; 