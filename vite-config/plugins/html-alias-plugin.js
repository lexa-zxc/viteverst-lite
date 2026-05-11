import { transformAliases } from '../utils/html-transform.js';

/**
 * Плагин для обработки алиасов в HTML.
 * Работает на AST через node-html-parser — не ломается на edge-кейсах с кавычками,
 * многострочными атрибутами, вложенными url(), и т.п.
 *
 * @param {Object<string,string>} aliases - карта { '@img': 'img', '@scss': 'scss', ... }
 * @returns {import('vite').Plugin}
 */
export function htmlAliasPlugin(aliases) {
  return {
    name: 'vite:html-alias',
    transformIndexHtml(html) {
      return transformAliases(html, aliases);
    },
  };
}
