/**
 * FLS — минимальные утилиты из "Чертогов Фрилансера"
 *
 * В lite-версии оставлено только то, что реально используется в стилях:
 *   - .touch       (html) — мобильный браузер, нужен для body.lock и [data-fullscreen]
 *   - .loaded      (html) — после полной загрузки страницы
 *   - --vh         (html) — честная высота viewport на iOS (для [data-fullscreen])
 *
 * Вырезано:
 *   - isWebp()      — современные браузеры все умеют webp
 *   - MousePRLX     — параллакс по мыши (в стартере не нужен)
 *   - ScrollWatcher — дублирует WOW.js
 *   - DynamicAdapt  — вынесен в ./dynamic-adapt.js, подключать по необходимости
 */

// Определение мобильного браузера
const isMobile = {
  Android: () => navigator.userAgent.match(/Android/i),
  BlackBerry: () => navigator.userAgent.match(/BlackBerry/i),
  iOS: () => navigator.userAgent.match(/iPhone|iPad|iPod/i),
  Opera: () => navigator.userAgent.match(/Opera Mini/i),
  Windows: () => navigator.userAgent.match(/IEMobile/i),
  any: () =>
    isMobile.Android() ||
    isMobile.BlackBerry() ||
    isMobile.iOS() ||
    isMobile.Opera() ||
    isMobile.Windows(),
};

// .touch на <html> для мобильных — используется в SCSS (body.lock, [data-fullscreen])
if (isMobile.any()) {
  document.documentElement.classList.add('touch');
}

// .loaded на <html> после window.load — удобно для стартовых анимаций
window.addEventListener('load', () => {
  setTimeout(() => document.documentElement.classList.add('loaded'), 0);
});

// --vh fix для iOS: компенсирует плавающую адресную строку в 100vh
// Используется в [data-fullscreen] через calc(var(--vh, 1vh) * 100)
if (document.querySelector('[data-fullscreen]') && isMobile.any()) {
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
}
