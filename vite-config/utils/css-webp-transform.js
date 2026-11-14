/**
 * Генерация is-webp правил для CSS через postcss.
 *
 * Для каждой декларации background/background-image с url(...) на jpg/png,
 * у которой есть webp-дубль, создаётся дубль правила с .is-webp-префиксом
 * каждого селектора и webp-урлом:
 *
 *   .hero { background-image: url("../img/bg.jpg"); }
 *   ↓
 *   .hero { background-image: url("../img/bg.jpg"); }
 *   .is-webp .hero { background-image: url("../img/bg.webp"); }
 *
 * Правило вставляется сразу после оригинала в том же контейнере —
 * postcss сохраняет вложенность, т.е. внутри @media останется в @media.
 * Каскад корректен: .is-webp .hero специфичнее .hero и идёт позже.
 *
 * Браузер без поддержки webp не матчит .is-webp-правила и качает только
 * jpg — двойной загрузки нет.
 */

import postcss from 'postcss';

/**
 * @param {string} css - Исходный CSS
 * @param {Function} twinExists - (cssUrl) => webpCssUrl | null — есть ли дубль и его урл
 * @returns {{ css: string, added: number }}
 */
export function addIsWebpRules(css, twinExists) {
  const root = postcss.parse(css);
  let added = 0;

  root.walkRules((rule) => {
    const declarations = [];

    rule.walkDecls((decl) => {
      if (!/^background(-image)?$/i.test(decl.prop)) return;
      if (!/url\(/i.test(decl.value)) return;

      let changed = false;
      const newValue = decl.value.replace(
        /url\((['"]?)([^'")]+)\1\)/gi,
        (match, quote, url) => {
          const twin = twinExists(url.trim());
          if (!twin) return match;
          changed = true;
          return `url(${quote}${twin}${quote})`;
        }
      );

      if (changed) declarations.push({ prop: decl.prop, value: newValue });
    });

    if (declarations.length === 0) return;

    // .a, .b → .is-webp .a, .is-webp .b
    const selector = rule.selectors.map((s) => `.is-webp ${s}`).join(', ');

    declarations.forEach(({ prop, value }) => {
      const newRule = postcss.rule({ selector });
      // Свойство сохраняем исходным: дубликат shorthand `background:` должен
      // остаться `background:` — `background-image: url(...) center/cover` невалиден
      newRule.append(postcss.decl({ prop, value }));
      rule.parent.insertAfter(rule, newRule);
      added++;
    });
  });

  return { css: root.toString(), added };
}
