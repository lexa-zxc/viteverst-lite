/**
 * Dynamic Adapt v.2 — улучшенная версия
 *
 * Перемещает DOM-элементы между родителями на заданных брейкпоинтах.
 * Origin: Andrikanych Yevhen (FLS Guru)
 *
 * Синтаксис data-da:
 *
 *   data-da="selector, breakpoint, place"   полная форма (destination = document.querySelector(selector))
 *   data-da="parent, breakpoint, place"     destination = parentNode (явно)
 *   data-da="breakpoint, place"             destination = parentNode (коротко)
 *
 * Параметры:
 *   selector    CSS-селектор или ключевое слово "parent"
 *   breakpoint  число px (по умолчанию 767)
 *   place       'first' | 'last' | индекс среди destination.children (по умолчанию 'last')
 *
 * Примеры:
 *
 *   Вынести кнопку в шапку:
 *     <button data-da=".header__cta, 767, last">Купить</button>
 *
 *   Поднять кнопку в своей карточке (работает НЕЗАВИСИМО для каждой карточки в списке):
 *     <button data-da="767, first">Купить</button>
 *
 *   На мобилке перенести кнопку на позицию 1 (после фото) в своей карточке:
 *     <button data-da="767, 1">Заказать</button>
 *
 * Важно:
 *   CSS-селектор (не "parent") резолвится через document.querySelector — возвращает
 *   ПЕРВОЕ совпадение в документе. Для повторяющихся карточек используйте "parent"
 *   или короткую форму.
 *
 * Подключение:
 *   <script src="@vendor/fls/dynamic-adapt.js"></script>
 */

class DynamicAdapt {
  constructor(type = 'max') {
    this.type = type;
    this.daClassname = '_dynamic_adapt_';
  }

  init() {
    this.objects = [];
    this.nodes = [...document.querySelectorAll('[data-da]')];

    this.nodes.forEach((node) => {
      const params = node.dataset.da.split(',').map((s) => s.trim());

      // Полная форма: selector, breakpoint, place
      // Короткая форма: breakpoint, place (selector по умолчанию "parent")
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
          `[DynamicAdapt] destination "${selector}" not found, skip element`,
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

    // По одному matchMedia на уникальный breakpoint
    const seen = new Set();
    this.objects.forEach(({ breakpoint }) => {
      if (seen.has(breakpoint)) return;
      seen.add(breakpoint);

      const matchMedia = window.matchMedia(
        `(${this.type}-width: ${breakpoint}px)`
      );
      const groupItems = this.objects.filter((o) => o.breakpoint === breakpoint);

      matchMedia.addEventListener('change', () =>
        this.mediaHandler(matchMedia, groupItems)
      );
      this.mediaHandler(matchMedia, groupItems);
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

    const index = Number(place);
    if (!Number.isFinite(index) || index >= destination.children.length) {
      destination.append(element);
      return;
    }
    destination.children[index].before(element);
  }

  moveBack(parent, element, index) {
    element.classList.remove(this.daClassname);
    if (parent.children[index] !== undefined) {
      parent.children[index].before(element);
    } else {
      parent.append(element);
    }
  }

  indexInParent(parent, element) {
    return [...parent.children].indexOf(element);
  }

  // Сортировка по breakpoint: 'min' → asc, 'max' → desc
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

new DynamicAdapt('max').init();
