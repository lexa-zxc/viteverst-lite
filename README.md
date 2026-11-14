# ⚡ ViteVerst Lite

![Vite](https://img.shields.io/badge/Vite-8-purple?style=flat-square&logo=vite)
![SCSS](https://img.shields.io/badge/SCSS-Support-pink?style=flat-square&logo=sass)
![Image Optimization](https://img.shields.io/badge/Image_Optimization-Yes-green?style=flat-square)
![HTML Includes](https://img.shields.io/badge/HTML_Includes-Yes-blue?style=flat-square)
![Adaptive REM](https://img.shields.io/badge/Adaptive_REM-Yes-orange?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

Облегчённая версия сборки [**ViteVerst**](https://github.com/lexa-zxc/viteverst) — тот же движок, меньше мусора, чище структура.

Сделано на базе полной сборки: вырезано всё лишнее, код разнесён по логическим файлам, все стили переведены на CSS-переменные. Подходит для быстрого старта новых проектов.

---

## Что отличается от полной версии

- SCSS разбит на профильные файлы (`_base`, `_typography`, `_buttons`, `_forms`, `_animations`, `_vendor-overrides` и т.д.)
- Все переменные — CSS Custom Properties (`:root`), SCSS-переменных в проекте нет
- Оптимизация изображений на **sharp** с файловым кешем и webp-дублями (`--webp`)
- Работает на **Vite 8** (Rolldown-бандлер)
- `app.js` очищен до стартового шаблона с заготовками под fancybox, swiper, smooth-scroll
- Демо-страница `demo.html` показывает все базовые компоненты (кнопки, формы, чекбоксы, WOW-анимации)
- Cборка работает **так же быстро**, всё из коробки: `@@include`, слоты, алиасы, мультистраничность

Полный гайд по сборке и конвенциям (SCSS, @@include, DynamicAdapt, правила проекта): **[GUIDE.md](GUIDE.md)**

---

## Быстрый старт

```bash
git clone <этот-репо>
cd <project>
npm install
npm run dev
```

Или через BAT:

```bash
dev        # разработка
build      # сборка без минификации
build-min  # сборка с минификацией и оптимизацией изображений
preview    # предпросмотр
fonts      # ttf → woff2
```

---

## Структура

```
app/
├── index.html, demo.html    страницы
├── html/                    partials (@@include)
├── scss/                    стили (разнесены по ролям)
├── js/app.js                стартовый JS
├── img/, fonts/, files/     ресурсы
└── vendor/                  сторонние либы
```

---

## Ссылки

- Фичи движка без изменений — смотри [полную документацию](https://github.com/lexa-zxc/viteverst)
- Полная сборка: **[github.com/lexa-zxc/viteverst](https://github.com/lexa-zxc/viteverst)**
- Демо полной сборки: [web-2112.ru/vite](https://web-2112.ru/vite/)

## 🏷️ Теги

`vite` `vite-config` `vite-for-html` `html-include` `file-include` `vite-file-include` `html-slots` `верстка` `сборка для верстки` `frontend` `html-components` `scss` `sass` `web-dev` `sharp` `webp` `image-optimization` `multi-page` `web-optimization` `adaptive-rem` `responsive` `rem-based` `ttf-to-woff2` `font-converter`

## License

MIT
