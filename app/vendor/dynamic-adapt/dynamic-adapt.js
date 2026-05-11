/**
 * Dynamic Adapt v.2
 *
 * Перемещает DOM-элементы между родителями на заданных брейкпоинтах.
 * Origin: Andrikanych Yevhen (FLS Guru). Refactored for ViteVerst Lite.
 *
 * Синтаксис data-da:
 *
 *   data-da="selector, breakpoint, place"   полная форма
 *   data-da="parent, breakpoint, place"     destination = parentNode (явно)
 *   data-da="breakpoint, place"             destination = parentNode (коротко)
 *
 * Параметры:
 *   selector    CSS-селектор или "parent"
 *   breakpoint  число px (по умолчанию 767)
 *   place       'first' | 'last' | индекс (по умолчанию 'last')
 *
 * API (window.DynamicAdaptManager):
 *
 *   .init(container)     — инициализация (сканирует container, по умолчанию document)
 *   .update(container)   — пересканировать DOM (после AJAX / динамического добавления)
 *   .destroy()           — вернуть все элементы, убрать слушатели, очистить состояние
 *   .reset()             — вернуть все элементы, но оставить слушатели активными
 *
 * Подключение:
 *   <script src="@vendor/fls/dynamic-adapt.js"></script>
 *
 * Использование из JS:
 *   DynamicAdaptManager.update();           // после подгрузки карточек
 *   DynamicAdaptManager.destroy();          // полная деактивация
 *   DynamicAdaptManager.init(modalElement); // инициализация внутри конкретного контейнера
 * 
 *   DynamicAdaptManager.update('.container');          // строка-селектор
     DynamicAdaptManager.update(document.querySelector('.modal')); // DOM-элемент
     DynamicAdaptManager.update();                      // весь document
 */

const DynamicAdaptManager = {
  type: 'max',
  daClassname: '_dynamic_adapt_',
  objects: [],
  mediaListeners: [],
  initialized: false,

  // Инициализация — сканирует container на [data-da], создаёт matchMedia-слушатели
  init: function (container = document) {
    // Если уже инициализирован — сначала чистим
    if (this.initialized) this.destroy();

    // Принимаем и строку-селектор, и DOM-элемент
    if (typeof container === 'string') {
      container = document.querySelector(container) || document;
    }

    this.objects = [];
    this.mediaListeners = [];

    const nodes = [...container.querySelectorAll('[data-da]')];

    // Перед сканированием — убедимся что все элементы на оригинальных местах
    nodes.forEach((node) => {
      if (node.classList.contains(this.daClassname)) {
        node.classList.remove(this.daClassname);
      }
    });

    nodes.forEach((node) => {
      const params = node.dataset.da.split(',').map((s) => s.trim());

      let selector, breakpoint, place;
      if (params.length >= 3) {
        [selector, breakpoint, place] = params;
      } else {
        selector = 'parent';
        [breakpoint, place] = params;
      }

      const destination =
        selector === 'parent'
          ? node.parentNode
          : document.querySelector(selector);

      if (!destination) {
        console.warn(
          `[DynamicAdapt] destination "${selector}" not found, skip:`,
          node
        );
        return;
      }

      this.objects.push({
        element: node,
        parent: node.parentNode,
        destination,
        breakpoint: breakpoint || '767',
        place: place || 'last',
        index: this._indexInParent(node.parentNode, node),
      });
    });

    this._sort(this.objects);
    this._bindMedia();
    this.initialized = true;
  },

  // Пересканировать DOM — подхватит новые [data-da] элементы
  update: function (container = document) {
    this.init(container);
  },

  // Вернуть все элементы, убрать слушатели, очистить состояние
  destroy: function () {
    if (!this.initialized) return;

    this._resetPositions();

    this.mediaListeners.forEach(({ matchMedia, handler }) => {
      matchMedia.removeEventListener('change', handler);
    });

    this.objects = [];
    this.mediaListeners = [];
    this.initialized = false;
  },

  // Вернуть все элементы на место, но оставить слушатели (при ресайзе снова переедут)
  reset: function () {
    this._resetPositions();
  },

  // ─── Приватные методы ───────────────────────────────────────────────

  _bindMedia: function () {
    const seen = new Set();

    this.objects.forEach(({ breakpoint }) => {
      if (seen.has(breakpoint)) return;
      seen.add(breakpoint);

      const mq = window.matchMedia(`(${this.type}-width: ${breakpoint}px)`);
      const groupItems = this.objects.filter((o) => o.breakpoint === breakpoint);

      const handler = () => this._mediaHandler(mq, groupItems);

      mq.addEventListener('change', handler);
      this.mediaListeners.push({ matchMedia: mq, handler });

      // Применить текущее состояние сразу
      this._mediaHandler(mq, groupItems);
    });
  },

  _mediaHandler: function (matchMedia, objects) {
    if (matchMedia.matches) {
      objects.forEach((o) => this._moveTo(o.place, o.element, o.destination));
    } else {
      objects.forEach(({ parent, element, index }) => {
        if (element.classList.contains(this.daClassname)) {
          this._moveBack(parent, element, index);
        }
      });
    }
  },

  _moveTo: function (place, element, destination) {
    element.classList.add(this.daClassname);

    if (place === 'first') {
      destination.prepend(element);
      return;
    }
    if (place === 'last') {
      destination.append(element);
      return;
    }

    const idx = Number(place);
    if (!Number.isFinite(idx) || idx >= destination.children.length) {
      destination.append(element);
      return;
    }
    destination.children[idx].before(element);
  },

  _moveBack: function (parent, element, index) {
    element.classList.remove(this.daClassname);

    // Временно убираем элемент, чтобы индексы детей стали как в оригинале
    element.remove();

    if (parent.children[index] !== undefined) {
      parent.children[index].before(element);
    } else {
      parent.append(element);
    }
  },

  _resetPositions: function () {
    [...this.objects].reverse().forEach(({ parent, element, index }) => {
      if (element.classList.contains(this.daClassname)) {
        this._moveBack(parent, element, index);
      }
    });
  },

  _indexInParent: function (parent, element) {
    return [...parent.children].indexOf(element);
  },

  _sort: function (arr) {
    const asc = this.type === 'min';
    arr.sort((a, b) => {
      if (a.breakpoint === b.breakpoint) {
        if (a.place === b.place) return 0;
        if (a.place === 'first' || b.place === 'last') return asc ? -1 : 1;
        if (a.place === 'last' || b.place === 'first') return asc ? 1 : -1;
        return 0;
      }
      return asc
        ? Number(a.breakpoint) - Number(b.breakpoint)
        : Number(b.breakpoint) - Number(a.breakpoint);
    });
  },
};

// Автоинициализация
DynamicAdaptManager.init();

// Экспорт в глобальную область
window.DynamicAdaptManager = DynamicAdaptManager;
