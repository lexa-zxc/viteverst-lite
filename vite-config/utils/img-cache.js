/**
 * Файловый кеш оптимизации изображений.
 * Используется двумя плагинами: image-optimization-plugin (сжатие jpg/png/gif)
 * и webp-plugin (генерация webp-дублей). Общая инфраструктура: карта контента,
 * stat fast path, стор результатов.
 *
 * Структура:
 *   .cache/optimize-images/
 *   ├── cache.json
 *   │   ├── settings  — хеш настроек sharp + версии (инвалидация всего кеша)
 *   │   ├── entries   — { hash: ext }  сжатые оригиналы (image-optimization)
 *   │   ├── webps     — { hash: true } webp-дубли (webp-plugin)
 *   │   └── statMap   — { путь: { size, mtimeMs, contentHash } } stat fast path
 *   └── store/        — сжатые результаты, имена = hash + расширение
 *
 * Папка .cache уже в .gitignore — в git не попадёт.
 */

import fs from 'fs';
import { createHash } from 'crypto';
import { join, relative, resolve, sep } from 'path';
import { PATHS } from '../config/paths.js';

export const CACHE_DIR = join(process.cwd(), '.cache', 'optimize-images');

/**
 * SHA-1 хеш содержимого файла (стримом — не грузим файл в память целиком)
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} Хеш
 */
export function fileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/**
 * stat без исключений — файла может не быть (удалили посреди билда)
 * @param {string} filePath - Путь к файлу
 * @returns {fs.Stats|null} Статистика или null
 */
export function statSyncSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Версия настроек: хеш конфига sharp + версии самой sharp.
 * ЕДИНАЯ для всех image-плагинов — иначе loadCache одного плагина
 * вайпает кеш другого при каждом билде.
 * Меняется при любой правке IMAGE_OPTIMIZATION или обновлении sharp —
 * кеш с прошлыми настройками считается недействительным.
 * @param {Object} sharpConfig - IMAGE_OPTIMIZATION
 * @param {string} sharpVersion - Версия sharp
 * @returns {string} Короткий хеш
 */
export function getFullSettingsVersion(sharpConfig, sharpVersion) {
  return createHash('sha1')
    .update(JSON.stringify(sharpConfig) + sharpVersion)
    .digest('hex')
    .slice(0, 12);
}

/**
 * Загрузка кеша. Если настроек нет / кеш битый / версия изменилась —
 * стор стирается и начинаем с нуля.
 * @param {string} settingsVersion - Текущая версия настроек
 * @returns {Object} Кеш { settings, entries, webps, statMap }
 */
export function loadCache(settingsVersion) {
  try {
    const cachePath = join(CACHE_DIR, 'cache.json');
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cache && cache.settings === settingsVersion) {
        // webps/statMap появились позже entries — старый формат мигрирует на месте
        return { ...cache, webps: cache.webps || {}, statMap: cache.statMap || {} };
      }
    }
  } catch {
    // Битый cache.json — начнём с чистого кеша
  }

  // Настройки/версия изменились или кеша не было — стор неактуален
  fs.rmSync(join(CACHE_DIR, 'store'), { recursive: true, force: true });
  return { settings: settingsVersion, entries: {}, webps: {}, statMap: {} };
}

/**
 * Сохранение кеша на диск
 * @param {Object} cache - Кеш
 */
export function saveCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(join(CACHE_DIR, 'cache.json'), JSON.stringify(cache, null, 2));
}

/**
 * Запись файла с ретраями — на Windows антивирус/индексатор могут
 * держать свежезаписанный файл пару мгновений (EPERM / UNKNOWN)
 * @param {string} filePath - Путь к файлу
 * @param {Buffer} data - Данные для записи
 */
export async function writeFileWithRetry(filePath, data) {
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
 * ContentHash для файла в dist: stat fast path по исходнику в app/
 * (путь+размер+mtime стабильны между билдами) или честный SHA-1.
 *
 * Мутирует cache.statMap, наполняет usedHashes/usedPaths для чистки.
 *
 * @param {string} distPath - Путь к файлу в dist
 * @param {Object} cache - Кеш
 * @param {Set<string>} usedHashes - Хеши этого прогона
 * @param {Set<string>} usedPaths - Пути этого прогона
 * @returns {Promise<string>} contentHash
 */
export async function resolveContentHash(distPath, cache, usedHashes, usedPaths) {
  // Отпечаток берём у ИСХОДНИКА в app/: dist-копия пересоздаётся каждый
  // билд со свежим mtime — stat по ней бесполезен
  const relPath = relative(PATHS.dist, distPath).split(sep).join('/').toLowerCase();
  usedPaths.add(relPath);

  const sourceStat = statSyncSafe(resolve(PATHS.app, relPath));
  const statEntry = cache.statMap[relPath];

  if (
    sourceStat &&
    statEntry &&
    statEntry.size === sourceStat.size &&
    statEntry.mtimeMs === sourceStat.mtimeMs
  ) {
    // Fast path: отпечаток совпал — верим карте, хеш не считаем
    usedHashes.add(statEntry.contentHash);
    return statEntry.contentHash;
  }

  const contentHash = await fileHash(distPath);
  if (sourceStat) {
    cache.statMap[relPath] = {
      size: sourceStat.size,
      mtimeMs: sourceStat.mtimeMs,
      contentHash
    };
  } else {
    // Исходник пропал посреди билда — stat-запись больше не имеет смысла
    delete cache.statMap[relPath];
  }
  usedHashes.add(contentHash);
  return contentHash;
}

/**
 * Хеш-хит: восстановление готового файла из стора кеша
 * @param {string} storeFile - Путь к файлу в сторе
 * @param {string} destPath - Куда положить в dist
 * @returns {Promise<boolean>} true если восстановлено
 */
export async function restoreFromStore(storeFile, destPath) {
  if (!fs.existsSync(storeFile)) return false;
  await writeFileWithRetry(destPath, fs.readFileSync(storeFile));
  return true;
}
