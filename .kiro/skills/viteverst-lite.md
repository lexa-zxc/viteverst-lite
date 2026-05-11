---
name: ViteVerst Lite
description: Работа со стартер-сборкой ViteVerst Lite — SCSS архитектура, CSS-переменные, DynamicAdapt, WOW-анимации и соглашения проекта.
---

# ViteVerst Lite — рабочий навык

Облегчённая сборка на Vite для верстки многостраничных сайтов. Основана на [ViteVerst](https://github.com/lexa-zxc/viteverst), но с чистой архитектурой, без лишнего кода и на CSS-переменных.

## Структура проекта

```
app/
├── index.html, demo.html, demo-da.html   страницы
├── html/                                 partials (@@include)
│   ├── header.html, footer.html
│   ├── modals.html, svg.html
├── scss/                                 стили (13 файлов)
│   ├── main.scss                         оглавление импортов
│   ├── _mixins.scss
│   ├── _variables.scss                   только :root {--vars}
│   ├── _fonts.scss                       @font-face × 8
│   ├── _reset.scss
│   ├── _base.scss                        html, body, wrapper, container, scroll-area, rem-адаптивка
│   ├── _typography.scss                  h1/h2/h3, a, .link, ::selection
│   ├── _buttons.scss                     .btn, .btn--stroke
│   ├── _forms.scss                       input, .input, .textarea, .checkbox
│   ├── _animations.scss                  @keyframes через @for 5..100 step 5
│   ├── _vendor-overrides.scss            переопределения fancybox, swiper
│   ├── _header.scss, _footer.scss        заглушки под блоки
│   └── pages/*.scss                      стили отдельных страниц
├── js/app.js                             стартовый JS
├── img/, fonts/, files/                  ресурсы
└── vendor/                               сторонние либы (fls, gsap, jquery, wow, dynamic-adapt и др.)
```

## Команды

```bash
npm run dev        # разработка
npm run build      # сборка без минификации
npm run build-min  # сборка с минификацией + оптимизация изображений
npm run preview    # предпросмотр
npm run fonts:convert  # TTF → WOFF2
```

BAT-файлы в корне: `dev.bat`, `build.bat`, `build-min.bat`, `preview.bat`, `fonts.bat` — аналоги npm-скриптов для Windows.

---

## Архитектура SCSS

### Порядок импорта в `main.scss`

```
Foundation  → mixins, variables, fonts, reset
Base        → base (глобалы)
Components  → typography, buttons, forms, animations, vendor-overrides
Sections    → header, footer
Pages       → pages/*
```

### Куда класть новые стили

| Что | Куда |
|---|---|
| html, body, wrapper, container, скроллбар | `_base.scss` |
| Заголовки, ссылки, параграфы, ::selection | `_typography.scss` |
| `.btn`, кнопки | `_buttons.scss` |
| input, textarea, checkbox, форма | `_forms.scss` |
| `@keyframes` + классы-обёртки | `_animations.scss` |
| Переопределения fancybox/swiper/etc | `_vendor-overrides.scss` |
| Стили хедера / футера | `_header.scss` / `_footer.scss` |
| Стили конкретной страницы | `scss/pages/<имя>.scss` |

## Переменные проекта

Все переменные — **CSS Custom Properties** в `:root`. SCSS-переменных в проекте нет.

```scss
// _variables.scss
:root {
  --color-text: #1f2229;
  --color-bg: #ffffff;
  --color-border: #d6d6d7;
  --color-accent: #714bf1;
  --color-accent-hover: color-mix(in srgb, var(--color-accent) 92%, white);

  --font-family-base: Gilroy, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  --font-size-base: 1.8rem;
  --line-height-base: 1.2;

  --z-header: 1000;
  --z-modal: 9999;

  --indexSize: calc(1vh + 1vw);
}
```

### Правила

- **НЕ добавлять SCSS-переменные (`$var`)** — только `:root {--var}`
- **НЕ использовать `lighten()`, `darken()`, `mix()`, `rgba($var)`** — не работают с CSS vars. Для hover используй `color-mix(in srgb, var(--color-accent) 92%, white)` — это нативная CSS-функция (Chrome 111+, Safari 16.2+, FF 113+)
- Новые значения (радиусы, отступы, брейкпоинты) добавлять как CSS vars в `:root`
- Для тёмной темы — переопределять в `body.dark` или `[data-theme="dark"]`

## Миксины

Файл `_mixins.scss`:

- `@include tran` — transition cubic-bezier 0.45s
- `@include ul` — list-style: none + reset margin/padding
- `@include font($name, $file, $weight, $style)` — подключение woff2
- `@include fontTTF($name, $file, $weight, $style)` — ttf
- `@function strip-unit($number)` — убрать единицы измерения

## Адаптивка REM

В `_base.scss` установлен `html { font-size: 10px }` (1rem = 10px) + media-queries:

```scss
@media (min-width: 1930px) { html { font-size: 12px; } }
@media (max-width: 1700px) { html { font-size: 9px; } }
@media (max-width: 1430px) { html { font-size: 8.6px; } }
@media (max-width: 1320px) { html { font-size: 8.4px; } }
@media (max-width: 767px)  { html { font-size: 10px; } }
```

**Правило:** верстать в rem. `padding: 2rem` = `20px` на десктопе, автоматически масштабируется на ноутах.

Для мобильной адаптации использовать `var(--indexSize)`:
```scss
@media (max-width: 767px) {
  font-size: calc(var(--indexSize) * 12);  // эквивалент ~12vmin
}
```

---

## @@include — шаблонизация HTML

### Простой include

```html
@@include('html/header.html')
```

### Include с параметрами

```html
<!-- страница -->
@@include('html/header.html', {"title":"Главная"})

<!-- header.html -->
<title>@@title</title>
```

### Слоты

```html
<!-- страница -->
@@include('html/card.html')
  @@content
    <h2>Заголовок</h2>
    <p>Описание</p>
  -@@content
  @@footer
    <span>Подпись</span>
  -@@footer
```

```html
<!-- html/card.html -->
<div class="card">
  <div class="card__body">@@content</div>
  <div class="card__footer">@@footer</div>
</div>
```

## Алиасы путей

В HTML и SCSS работают префиксы:

```html
<link rel="stylesheet" href="@scss/main.scss">
<script src="@js/app.js"></script>
<img src="@img/logo.png">
<script src="@vendor/gsap/gsap.min.js"></script>
<a href="@files/doc.pdf">Скачать</a>
```

```scss
@import "@scss/variables";
.el { background-image: url("@img/bg.jpg"); }
```

Доступные алиасы: `@scss`, `@js`, `@utils`, `@img`, `@vendor`, `@files`, `@fonts`.

---

## Готовые компоненты

### Кнопки

```html
<button class="btn">Основная</button>
<button class="btn btn--stroke">С обводкой</button>
<a class="btn" href="#">Кнопка-ссылка</a>
```

### Формы

```html
<input class="input" type="text" placeholder="Имя">
<textarea class="textarea" placeholder="Сообщение"></textarea>
```

### Чекбокс (BEM)

```html
<label class="checkbox">
  <input type="checkbox" class="checkbox__input">
  <span class="checkbox__box"></span>
  <span class="checkbox__label">Согласен</span>
</label>
```

Галочка отрисована чисто CSS через `::after` — без внешних SVG.

### Ссылка с анимированным подчёркиванием

```html
<a href="#" class="link">Текст</a>
```

### Контейнер

```html
<div class="container">
  ...
</div>
```

Макс-ширина 1520px + боковые отступы 4rem (desktop) / 15px (mobile).

---

## Анимации (fadeInDown / fadeInUp + WOW.js)

Классы генерируются через `@for 5 through 100 step 5` — доступны значения:
**5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100**

```html
<!-- С WOW — срабатывает при появлении в viewport -->
<div class="wow fadeInDown10" data-wow-delay="0.2s">...</div>
<div class="wow fadeInUp50" data-wow-delay="0.4s">...</div>
```

Значение `10` = `translate3d(0, -10%, 0) → 0` при fadeInDown.

**WOW инициализируется только на десктопе** (`device_width > 1024`). На мобилке классы `wow fadeInDown10` не сработают — элементы видны сразу.

### Добавление своих промежуточных значений

```scss
// _animations.scss
@keyframes fadeInDown17 {
  from { opacity: 0; transform: translate3d(0, -17%, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
.fadeInDown17 { animation-name: fadeInDown17; }
```

---

## DynamicAdapt — перемещение DOM по брейкпоинтам

Подключается на страницах где нужен:
```html
<script src="@vendor/dynamic-adapt/dynamic-adapt.js"></script>
```

### Синтаксис `data-da`

```
data-da="selector, breakpoint, place"   полная форма
data-da="parent, breakpoint, place"     destination = parentNode
data-da="breakpoint, place"             destination = parentNode (коротко)
```

- `selector` — CSS-селектор или `parent`
- `breakpoint` — px (по умолчанию 767, type `max`)
- `place` — `first` | `last` | число-индекс (по умолчанию `last`)

### Типичные примеры

```html
<!-- Кнопка в шапку на мобилке (уникальный блок) -->
<button data-da=".header__cta, 767, last">Купить</button>

<!-- Кнопка на позицию 1 В СВОЕЙ карточке (работает в списках товаров) -->
<button data-da="767, 1">Заказать</button>

<!-- Сайдбар под список товаров на планшетах -->
<aside data-da=".products, 991, last">Фильтры</aside>
```

### API (window.DynamicAdaptManager)

```js
DynamicAdaptManager.init(container)     // ручная инициализация (авто при загрузке)
DynamicAdaptManager.update(container)   // пересканировать DOM (после AJAX)
DynamicAdaptManager.destroy()           // вернуть всё, убрать слушатели
DynamicAdaptManager.reset()             // вернуть всё, слушатели остаются активны

// Принимает строку-селектор или DOM-элемент
DynamicAdaptManager.update('.catalog');
DynamicAdaptManager.update(document.querySelector('.modal'));
```

### ВАЖНО

- CSS-селектор (не `parent`) резолвится через `document.querySelector` — возвращает **первое** совпадение. Для повторяющихся карточек используй `parent` или короткую форму.
- Для списков лучше `flex/grid order` в CSS — быстрее и проще.
- DynamicAdapt — для **уникальных блоков** (хедер, сайдбар, одна конкретная карточка).

---

## FLS (минимальные утилиты)

Файл `@vendor/fls/fls.js`. Автоматически при загрузке:

- `html.touch` — если мобильный UA (используется в SCSS для `body.lock`, `[data-fullscreen]`)
- `html.loaded` — после `window.load`
- `--vh` CSS-переменная — честная высота viewport на iOS (только если на странице есть `[data-fullscreen]`)

### Использование `--vh`

```html
<section data-fullscreen>Фуллскрин</section>
```

```scss
[data-fullscreen] {
  min-height: 100vh;
  .touch & {
    min-height: calc(var(--vh, 1vh) * 100);  // без прыжков адресной строки iOS
  }
}
```

---

## JS-стек

Подключается в `footer.html` (всегда):
- `@vendor/fls/fls.js`
- `@vendor/jquery/3.6.0jquery.min.js`
- `@vendor/gsap/gsap.min.js`
- `@vendor/wow/wow.min.js`
- `@vendor/smooth-scroll-polyfills/smooth-scroll.polyfills.min.js`
- `@js/app.js`

В `app.js` уже есть:
- Анимация появления `.wrapper` через GSAP
- `new SmoothScroll('a[href*="#"]')`
- WOW.init() только для desktop

### GSAP

Используется **GSAP 3** — синтаксис easing **строкой**: `ease: 'power2.out'`. НЕ `Power2.out` — это v2.x.

---

## Режимы сборки

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер с HMR |
| `npm run build` | production без минификации, с фиксированными именами файлов |
| `npm run build-min` | production + минификация HTML/CSS/JS + оптимизация JPEG/PNG/GIF |
| `npm run preview` | предпросмотр dist |

### Что происходит в production:
- Удаление `crossorigin`, `type="module"` из тегов
- Добавление `defer` для JS
- `<link rel="stylesheet" href="scss/main.scss">` → `href="css/app.css"`
- Фиксированные имена: `js/app.js`, `css/app.css` без хешей
- Копирование `img/`, `files/`, `fonts/`, `vendor/` в dist без изменений

---

## Соглашения при работе с проектом

### ДА
- Писать классы в **BEM** (`.checkbox__input`, `.checkbox__box`)
- Использовать `var(--color-*)` для цветов
- Верстать в **rem** для десктопа, **px** для фикс-размеров на мобилке (≤767)
- Для адаптивки на мобилке использовать `calc(var(--indexSize) * N)`
- Hover-цвета через `color-mix(in srgb, var(--color-accent) 92%, white)`
- При импорте новой сторонней либы — в `app/vendor/<name>/`, подключать через `@vendor/<name>/file.js`

### НЕТ
- SCSS-переменные (`$color`) — только CSS vars
- `lighten/darken/rgba($var)` — не работают с CSS vars
- `@import` со старого Dart Sass внутри новых файлов — пока проект сидит на `@import`, но не плодить новый долг
- Добавлять новые `<link>` / `<script>` вне `header.html` / `footer.html` (кроме уникальных для страницы, как `dynamic-adapt.js` в `demo-da.html`)
- Писать кастомные стили в `demo.html` / `demo-da.html` — используй готовые классы, inline-style только для позиционирования демо-блоков

---

## Цифры сборки

- **dev**: старт за ~500ms
- **build**: ~500ms, CSS **~43 kB / gzip 4.8 kB**, JS **~0.6 kB**
- 8 шрифтов Gilroy (woff2) = ~217 kB суммарно
- **0 SCSS-переменных**, все на CSS-vars

---

## Ссылки

- Полная сборка: [github.com/lexa-zxc/viteverst](https://github.com/lexa-zxc/viteverst)
- Демо полной сборки: [web-2112.ru/vite](https://web-2112.ru/vite/)
