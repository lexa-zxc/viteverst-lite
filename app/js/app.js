document.addEventListener('DOMContentLoaded', () => {
  //======== Константы проекта =========//
  const device_width = window.innerWidth;
  const gsap_ease = 'power4.out';
  const isMobile = device_width <= 767;

  //======== Анимация wrapper при загрузке страницы =========//
  gsap.to('.wrapper', {
    opacity: 1,
    duration: 1.2,
    ease: gsap_ease,
    delay: 0,
  });

  //======== Убираем анимацию wrapper при ресайзе =========//
  $(window).resize(function () {
    if (device_width > 1100) {
      $('.wrapper').css('opacity', '1');
    }
  });

  //======== Прокрутка к якорю =========//
  new SmoothScroll('a[href*="#"]', {
    speed: 1000,
    updateURL: false,
    speedAsDuration: true,
    offset: isMobile ? 54 : 0,
  });

  //======== Анимашки WOW =========//
  if (device_width > 1024) {
    new WOW().init();
  }

  // // fancy backfocus
  // $.fancybox.defaults.backFocus = false;

  //==============================//
  //======== КАСТОМНЫЙ FANCY =========//
  //==============================//
  // $('.custom-fancy').fancybox({
  //   buttons: ['close'],
  //   baseClass: 'fancybox-custom',
  //   protect: true,
  //   hash: false,
  //   animationDuration: 0,
  //   thumbs: {
  //     autoStart: true,
  //   },
  // });

  //======== Кастомный фанси видео =========//
  // $('.custom-fancy-video').fancybox({
  //   buttons: ['close'],
  //   baseClass: 'fancybox-custom-video',
  //   protect: true,
  //   hash: false,
  //   animationDuration: 0,
  // });

  //======== Кастомный фанси видео iframe vk video =========//
  // $('.custom-fancy-video-iframe').fancybox({
  //   buttons: ['close'],
  //   baseClass: 'fancybox-custom-video',
  //   protect: true,
  //   hash: false,
  //   animationDuration: 0,
  //   type: 'iframe',
  // });

  //=============== end ===============//

  //==============================//
  //======== СЛАЙДЕР =========//
  //==============================//

  // const reviewsSlider = new Swiper('.reviews__slider', {
  //   speed: 550,
  //   autoHeight: false,
  //   draggable: true,
  //   resistanceRatio: 0.5,
  //   watchSlidesProgress: true,
  //   navigation: {
  //     nextEl: '.catalog-category__nav-next',
  //     prevEl: '.catalog-category__nav-prev',
  //   },
  //   breakpoints: {
  //     0: {
  //       slidesPerView: 1.12,
  //       spaceBetween: 9,
  //     },
  //     767: {
  //       slidesPerView: 4,
  //       spaceBetween: 19,
  //     },
  //   },
  // });

  //=============== end ===============//
});
