# ⚡ ViteVerst Lite

![Vite](https://img.shields.io/badge/Vite-6.3-purple?style=flat-square&logo=vite)
![SCSS](https://img.shields.io/badge/SCSS-Support-pink?style=flat-square&logo=sass)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

Облегчённая версия сборки [**ViteVerst**](https://github.com/lexa-zxc/viteverst) — тот же движок, меньше мусора, чище структура.

Сделано на базе полной сборки: вырезано всё лишнее, код разнесён по логическим файлам, все стили переведены на CSS-переменные. Подходит для быстрого старта новых проектов.

---

## Что отличается от полной версии

- SCSS разбит на профильные файлы (`_base`, `_typography`, `_buttons`, `_forms`, `_animations`, `_vendor-overrides` и т.д.)
- Все переменные — CSS Custom Properties (`:root`), SCSS-переменных в проекте нет
- Оптимизация изображений на **sharp** с файловым кешем (холодный билд сжимает и запоминает, тёплый берёт из кеша за доли секунды)
- `app.js` очищен до стартового шаблона с заготовками под fancybox, swiper, smooth-scroll
- Демо-страница `demo.html` показывает все базовые компоненты (кнопки, формы, чекбоксы, WOW-анимации)
- Cборка работает **так же быстро**, всё из коробки: `@@include`, слоты, алиасы, мультистраничность

Фичи движка без изменений — смотри [полную документацию](https://github.com/lexa-zxc/viteverst).

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

## Оптимизация изображений

Сжатие на sharp: mozjpeg q80 для jpg, палитра q90 для png — уровни подобраны
по замерам веса/качества, визуально прозрачные. Параметры — `IMAGE_OPTIMIZATION`
в `vite-config/config/constants.js`.

- `npm run build` — сжимает картинки (тумблер `optimizeImages` в `BUILD_SETTINGS`)
- `npm run build-min` — сжимает всегда
- Первый билд складывает сжатые файлы в кеш `.cache/` (в git не попадает),
  дальше тёплые билды подменяют картинки из него за доли секунды.
  Смена настроек или обновление sharp — кеш протухает сам: один холодный
  прогон и снова быстро
- `OPTIMIZE=true/false` перед командой — принудительно вкл/выкл поверх всего

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

- Полный гайд по сборке и конвенциям (SCSS, @@include, DynamicAdapt, правила проекта): **[GUIDE.md](GUIDE.md)**
- Полная сборка: **[github.com/lexa-zxc/viteverst](https://github.com/lexa-zxc/viteverst)**
- Демо полной сборки: [web-2112.ru/vite](https://web-2112.ru/vite/)

## License

MIT
