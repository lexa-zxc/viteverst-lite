import fs from 'fs';
import { join, extname, basename } from 'path';
import { PATHS } from '../config/paths.js';
import { findAllImages, formatFileSize } from '../utils/fs-utils.js';
import { CONSOLE_COLORS, IMAGE_OPTIMIZATION } from '../config/constants.js';

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
 * Запись файла с ретраями — на Windows антивирус/индексатор могут
 * держать свежескопированный файл пару мгновений (EPERM / UNKNOWN)
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
 * Оптимизация одного изображения через sharp
 * @param {import('sharp').Sharp} sharp - Экземпляр sharp
 * @param {string} imagePath - Путь к изображению в dist
 * @returns {Object} Результат оптимизации
 */
async function optimizeImage(sharp, imagePath) {
  const imageExt = extname(imagePath).toLowerCase();
  const encode = getEncoder(imageExt);

  // Формат не поддерживается (svg, ico, ...) — пропускаем
  if (!encode) {
    return { path: imagePath, skipped: true };
  }

  try {
    const originalSize = fs.statSync(imagePath).size;

    // Для GIF обрабатываем все кадры, иначе анимация схлопнется в первый кадр
    const readOptions = imageExt === '.gif' ? { animated: true } : {};

    // Читаем вход в буфер сами: libvips мапит файлы (mmap) и держит хендл
    // открытым до финализации инстанса — на Windows это блокирует перезапись.
    // С буфером sharp исходный файл вообще не открывает.
    const inputBuffer = fs.readFileSync(imagePath);
    const optimizedBuffer = await encode(sharp(inputBuffer, readOptions)).toBuffer();
    await writeFileWithRetry(imagePath, optimizedBuffer);

    const newSize = fs.statSync(imagePath).size;

    return {
      path: imagePath,
      name: basename(imagePath),
      originalSize,
      newSize,
      compressionPercent: Math.round((1 - newSize / originalSize) * 100),
      success: true
    };
  } catch (error) {
    console.error(`Ошибка при оптимизации ${basename(imagePath)}:`, error.message);
    return { path: imagePath, error: error.message };
  }
}

/**
 * Плагин для оптимизации изображений
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
            const result = await optimizeImage(sharp, imagePath);
            updateProgress();
            return result;
          })
        );

        console.log('\n'); // Новая строка после прогресс-бара

        // Фильтруем результаты
        const optimizedImages = results.filter(r => r && r.success && !r.skipped);
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
