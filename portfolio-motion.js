/* Portfolio motion layer: restrained, fast and accessible. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  root.classList.add('motion-ready');

  if (reduce || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

  document.querySelectorAll('.case-index__head, .case-shelf__item, .case-head, .case-body, .case-board, .luma-board, .step, .service, .faq-item, .about-copy, .contact h2, .contact .lead, .contact-actions').forEach(function (el, i) {
    el.classList.add('reveal');
    el.style.setProperty('--reveal-delay', (Math.min(i % 4, 3) * 75) + 'ms');
    observer.observe(el);
  });

  document.querySelectorAll('.case-shelf__item').forEach(function (card) {
    card.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch') return;
      var rect = card.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width;
      var y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--pointer-x', (x * 100) + '%');
      card.style.setProperty('--pointer-y', (y * 100) + '%');
    });
    card.addEventListener('pointerleave', function () {
      card.style.removeProperty('--pointer-x');
      card.style.removeProperty('--pointer-y');
    });
  });

  // Close the mobile navigation after selecting an anchor; native details remains usable.
  document.querySelectorAll('.mobile-menu__panel a').forEach(function (link) {
    link.addEventListener('click', function () {
      var menu = link.closest('.mobile-menu');
      if (menu) menu.open = false;
    });
  });
})();