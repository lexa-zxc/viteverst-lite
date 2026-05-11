/**
 * Преобразования CSS/SCSS кода.
 * Централизует логику разворачивания алиасов и нормализации путей.
 * Единственный источник правды для манипуляций с путями в стилях.
 *
 * Regex-подход здесь уместен, потому что CSS-синтаксис url()/@import проще HTML:
 * нет вложенности, нет произвольных атрибутов, нет комментариев-исключений.
 */

/**
 * Разворачивает алиасы (@scss, @img, ...) в SCSS/CSS коде.
 * Применяется на стадии transform() для каждого .scss/.sass/.css модуля.
 *
 * Поддерживает:
 *   - @import / @use / @forward "алиас/путь"
 *   - url(алиас/путь), url("алиас/путь"), url('алиас/путь')
 *   - Прямые упоминания "@алиас/путь" в любых кавычках
 *
 * @param {string} code
 * @param {Object<string,string>} aliases - { '@img': '../img', ... }
 * @returns {string}
 */
export function resolveScssAliases(code, aliases) {
  let result = code;

  for (const [alias, targetPath] of Object.entries(aliases)) {
    const folder = alias.slice(1); // "@img" → "img"

    // @import "folder/path" — только с начала строки (чтобы не ломать "alias/path")
    const importRegex = new RegExp(
      `(@import|@use|@forward)\\s+["']${folder}/([^"']+)["']`,
      'g'
    );
    result = result.replace(importRegex, `$1 "${targetPath}/$2"`);

    // url("folder/path") / url('folder/path')
    const urlQuotedRegex = new RegExp(
      `url\\(["']${folder}/([^"')]+)["']\\)`,
      'g'
    );
    result = result.replace(urlQuotedRegex, `url("${targetPath}/$1")`);

    // url(folder/path) без кавычек
    const urlUnquotedRegex = new RegExp(
      `url\\(${folder}/([^)]+)\\)`,
      'g'
    );
    result = result.replace(urlUnquotedRegex, `url(${targetPath}/$1)`);

    // "@алиас/путь" в произвольном контексте (additionalData, строки, etc.)
    const fullAliasRegex = new RegExp(
      `(['"])${escapeForRegex(alias)}/([^'"]+)(['"])`,
      'g'
    );
    result = result.replace(fullAliasRegex, `$1${targetPath}/$2$3`);
  }

  return result;
}

/**
 * Нормализует пути в финальном CSS (стадия generateBundle / bundle).
 *
 * Vite в процессе сборки иногда генерирует абсолютные пути `url(/fonts/...)` —
 * они не работают в статическом dist. Приводим их к относительным `url(../fonts/...)`
 * относительно `dist/css/app.css`.
 *
 * Также обрабатывает пути без начального слэша (на случай если туда
 * попали edge-cases типа `url(fonts/gilroy.woff2)`).
 *
 * @param {string|Buffer} code
 * @param {Object<string,string>} aliases - { '@fonts': '../fonts', ... }
 * @returns {string}
 */
export function normalizeCssAssetUrls(code, aliases) {
  let result = String(code);

  // Папки, которые могут встретиться как абсолютные пути в собранном CSS
  const assetFolders = ['fonts', 'img', 'scss', 'css', 'vendor', 'files'];

  // 1. url(/folder/path) → url("../folder/path")
  for (const folder of assetFolders) {
    const absRegex = new RegExp(
      `url\\(['"]?/${folder}/([^'")]+)['"]?\\)`,
      'g'
    );
    result = result.replace(absRegex, `url("../${folder}/$1")`);
  }

  // 2. url(folder/path) без слэша → относительный путь из aliases
  for (const [alias, targetPath] of Object.entries(aliases)) {
    const folder = alias.slice(1);
    const unquotedRegex = new RegExp(
      `url\\(['"]?${folder}/([^'")]+)['"]?\\)`,
      'g'
    );
    result = result.replace(unquotedRegex, `url("${targetPath}/$1")`);
  }

  return result;
}

/**
 * Экранирует символы, специальные для регулярных выражений.
 * Нужно для алиасов, содержащих `@`, `-`, и т.п.
 */
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
