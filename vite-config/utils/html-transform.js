/**
 * AST-базированные преобразования HTML на основе node-html-parser.
 * Заменяет хрупкие regex-манипуляции в плагинах.
 *
 * Почему node-html-parser, а не regex:
 *   - Не путается во вложенных кавычках и многострочных атрибутах
 *   - Не лезет внутрь <pre><code> и <script>/<style> (их контент treated as text)
 *   - Переопределяемое поведение для edge-кейсов
 *   - Читается как код, а не как шаманство с регулярками
 */

import { parse } from 'node-html-parser';

// Атрибуты, в которых могут встречаться пути к ресурсам
const URL_ATTRS = ['src', 'href', 'poster', 'data-src', 'data-background'];

// Опции парсинга: сохраняем комментарии, не ломаем контент script/style
const PARSE_OPTIONS = {
  comment: true,
  blockTextElements: {
    script: true,
    noscript: true,
    style: true,
    pre: true,
  },
};

/**
 * Парсит HTML в AST-дерево.
 * @param {string} html
 * @returns {import('node-html-parser').HTMLElement}
 */
export function parseHtml(html) {
  return parse(html, PARSE_OPTIONS);
}

/**
 * Заменяет алиасы (@scss, @img, ...) в указанных атрибутах + в inline-стилях.
 *
 * @param {string} html - исходный HTML
 * @param {Object<string,string>} aliases - { '@img': 'img', ... } (относительные пути)
 * @returns {string}
 */
export function transformAliases(html, aliases) {
  const root = parseHtml(html);

  // 1. Обычные URL-атрибуты: src, href, poster, data-src, data-background
  URL_ATTRS.forEach((attr) => {
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      const value = el.getAttribute(attr);
      if (!value) return;

      const resolved = resolveAliasUrl(value, aliases);
      if (resolved !== value) el.setAttribute(attr, resolved);

      // Абсолютные пути вида /img/... → img/... (без начального слэша)
      const stripped = stripLeadingSlash(el.getAttribute(attr));
      if (stripped !== el.getAttribute(attr)) el.setAttribute(attr, stripped);
    });
  });

  // 2. srcset — множественные значения через запятую: "img1.jpg 1x, img2.jpg 2x"
  root.querySelectorAll('[srcset]').forEach((el) => {
    const value = el.getAttribute('srcset');
    if (!value) return;

    const newValue = value
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        const [url, descriptor] = trimmed.split(/\s+/, 2);
        const resolved = stripLeadingSlash(resolveAliasUrl(url, aliases));
        return descriptor ? `${resolved} ${descriptor}` : resolved;
      })
      .join(', ');

    if (newValue !== value) el.setAttribute('srcset', newValue);
  });

  // 3. Inline-стили: style="background-image: url(...); ..."
  root.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style');
    if (!style || !style.includes('url(')) return;

    const newStyle = style.replace(
      /url\((['"]?)([^'")]+)\1\)/g,
      (_, quote, url) => {
        const resolved = stripLeadingSlash(resolveAliasUrl(url, aliases));
        return `url(${quote}${resolved}${quote})`;
      }
    );

    if (newStyle !== style) el.setAttribute('style', newStyle);
  });

  return root.toString();
}

/**
 * Пост-обработка HTML для продакшн-билда:
 *   - удаляет crossorigin, type="module"
 *   - подменяет script/link на фиксированные пути (js/app.js, css/app.css)
 *   - убирает префикс ./ из src/href
 *
 * @param {string} html
 * @returns {string}
 */
export function transformBuildHtml(html) {
  const root = parseHtml(html);

  // <script> обработка
  root.querySelectorAll('script[src]').forEach((el) => {
    el.removeAttribute('crossorigin');
    el.removeAttribute('type'); // убираем type="module" в т.ч.

    const src = el.getAttribute('src') || '';

    // Любой скрипт из /js/ или js/ — приводим к фиксированному js/app.js + defer
    if (/(^|\/)js\/[^/]+\.js/.test(src)) {
      el.setAttribute('src', 'js/app.js');
      el.setAttribute('defer', '');
    } else {
      el.setAttribute('src', stripDotSlash(src));
    }
  });

  // <link> обработка — CSS-файлы приводим к css/app.css
  root.querySelectorAll('link[href]').forEach((el) => {
    el.removeAttribute('crossorigin');

    const href = el.getAttribute('href') || '';
    const rel = (el.getAttribute('rel') || '').toLowerCase();

    if (/(^|\/)(css|scss)\/[^/]+\.(css|scss)/.test(href)) {
      el.setAttribute('rel', 'stylesheet');
      el.setAttribute('href', 'css/app.css');
    } else {
      el.setAttribute('href', stripDotSlash(href));
    }
  });

  // Все остальные элементы с src/href — убираем префикс ./
  URL_ATTRS.forEach((attr) => {
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      const value = el.getAttribute(attr);
      if (!value) return;
      const stripped = stripDotSlash(value);
      if (stripped !== value) el.setAttribute(attr, stripped);
    });
  });

  return root.toString();
}

//
// ─── Вспомогательные функции ──────────────────────────────
//

/**
 * Если URL начинается с @alias/... — подменяем алиас на реальный путь.
 * Если алиас не совпал — возвращаем как есть.
 */
function resolveAliasUrl(url, aliases) {
  const match = url.match(/^(@[a-zA-Z0-9_-]+)\/(.+)/);
  if (!match) return url;

  const [, alias, rest] = match;
  const base = aliases[alias];
  return base ? `${base}/${rest}` : url;
}

/** Убирает ведущий `/` (абсолютный корень → относительный путь) */
function stripLeadingSlash(url) {
  return url.startsWith('/') ? url.slice(1) : url;
}

/** Убирает префикс `./` */
function stripDotSlash(url) {
  return url.startsWith('./') ? url.slice(2) : url;
}
