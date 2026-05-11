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
 * API (доступно через window.dynamicAdapt):
 *
 *   .init()     — первичная инициализация (вызывается автоматически)
 *   .update()   — пересканировать DOM (после AJAX / динамического добавления элементов)
 *   .destroy()  — вернуть все элементы на место, убрать слушатели, очистить состояние
 *   .reset()    — вернуть все элементы на место, но оставить слушатели (для ручного перезапуска)
 *
 * Подключение:
 *   <script src="@vendor/fls/dynamic-adapt.js"></script>
 *
 * Использование из JS:
 *   window.dynamicAdapt.update();   // после подгрузки новых карточек
 *   window.dynamicAdapt.destroy();  // полная деактивация
 */

class DynamicAdapt {
  constructor(type = 'max') {
    this.type = type;
    this.daClassname = '_dynamic_adapt_';
    this.objects = [];
    this.mediaListeners = []; // для корректного destroy
    this.initialized = false;
  }

  /**
   * Первичная инициализация — сканирует DOM, создаёт matchMedia-слушатели.
   * Безопасно вызывать повторно (сначала сделает destroy).
   */
  init() {
    if (this.initialized) this.destroy();

    this.objects = [];
    this.mediaListeners = [];
    this.nodes = [...document.querySelectorAll('[data-da]')];

    this.nodes.forEach((node) => {
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
        index: this.indexInParent(node.parentNode, node),
      });
    });

    this.arraySort(this.objects);
    this.bindMedia();
    this.initialized = true;
  }

  /**
   * Пересканировать DOM — подхватит новые [data-da] элементы.
   * Старые элементы вернутся на место перед пересканированием.
   */
  update() {
    this.init();
  }

  /**
   * Вернуть все элементы на место, убрать слушатели, очистить состояние.
   */
  destroy() {
    // Вернуть все перемещённые элементы
    this.resetPositions();

    // Убрать слушатели matchMedia
    this.mediaListeners.forEach(({ matchMedia, handler }) => {
      matchMedia.removeEventListener('change', handler);
    });

    this.objects = [];
    this.mediaListeners = [];
    this.initialized = false;
  }

  /**
   * Вернуть все элементы на место, но оставить слушатели активными.
   * При следующем ресайзе элементы снова переедут если медиа-запрос совпадёт.
   */
  reset() {
    this.resetPositions();
  }

  // ─── Приватные методы ───────────────────────────────────────────────

  bindMedia() {
    const seen = new Set();

    this.objects.forEach(({ breakpoint }) => {
      if (seen.has(breakpoint)) return;
      seen.add(breakpoint);

      const mq = window.matchMedia(
        `(${this.type}-width: ${breakpoint}px)`
      );
      const groupItems = this.objects.filter((o) => o.breakpoint === breakpoint);

      const handler = () => this.mediaHandler(mq, groupItems);

      mq.addEventListener('change', handler);
      this.mediaListeners.push({ matchMedia: mq, handler });

      // Применить текущее состояние сразу
      this.mediaHandler(mq, groupItems);
    });
  }

  mediaHandler(matchMedia, objects) {
    if (matchMedia.matches) {
      objects.forEach((o) => this.moveTo(o.place, o.element, o.destination));
    } else {
      objects.forEach(({ parent, element, index }) => {
        if (element.classList.contains(this.daClassname)) {
          this.moveBack(parent, element, index);
        }
      });
    }
  }

  moveTo(place, element, destination) {
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
  }

  moveBack(parent, element, index) {
    element.classList.remove(this.daClassname);
    if (parent.children[index] !== undefined) {
      parent.children[index].before(element);
    } else {
      parent.append(element);
    }
  }

  resetPositions() {
    [...this.objects].reverse().forEach(({ parent, element, index }) => {
      if (element.classList.contains(this.daClassname)) {
        this.moveBack(parent, element, index);
      }
    });
  }

  indexInParent(parent, element) {
    return [...parent.children].indexOf(element);
  }

  arraySort(arr) {
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
  }
}

// Автоинициализация + экспорт в window
window.dynamicAdapt = new DynamicAdapt('max');
window.dynamicAdapt.init();
