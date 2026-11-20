/* Portfolio motion layer: restrained, fast and accessible. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('motion-ready');

  // Native navigation remains usable, including with reduced motion enabled.
  document.querySelectorAll('.mobile-menu__panel a').forEach(function (link) {
    link.addEventListener('click', function () {
      var menu = link.closest('.mobile-menu');
      if (menu) menu.open = false;
    });
  });

  var caseLinks = Array.prototype.slice.call(document.querySelectorAll('[data-case-link]'));
  var caseSections = caseLinks.map(function (link) {
    return document.getElementById(link.getAttribute('data-case-link'));
  }).filter(Boolean);

  function setActiveCase(id) {
    caseLinks.forEach(function (link) {
      var active = link.getAttribute('data-case-link') === id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  if (caseSections.length) {
    var initial = window.location.hash.slice(1);
    setActiveCase(caseSections.some(function (section) { return section.id === initial; }) ? initial : caseSections[0].id);
  }

  if (!reduce && 'IntersectionObserver' in window && caseSections.length) {
    var activeObserver = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) {
          return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
        });
      if (visible[0]) setActiveCase(visible[0].target.id);
    }, { rootMargin: '-22% 0px -58% 0px', threshold: 0 });
    caseSections.forEach(function (section) { activeObserver.observe(section); });
  }

  if (reduce || !('IntersectionObserver' in window)) return;

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

  document.querySelectorAll('.case-index__head, .case-shelf__item, .case-head, .case-body, .case-board, .luma-board, .step, .service, .faq-item, .about-copy, .contact h2, .contact .lead, .contact-actions').forEach(function (el, i) {
    el.classList.add('reveal');
    el.style.setProperty('--reveal-delay', (Math.min(i % 4, 3) * 75) + 'ms');
    revealObserver.observe(el);
  });

  caseLinks.forEach(function (card) {
    card.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch') return;
      var rect = card.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      var y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      card.style.setProperty('--pointer-x', (x * 100) + '%');
      card.style.setProperty('--pointer-y', (y * 100) + '%');
    });
    card.addEventListener('pointerleave', function () {
      card.style.removeProperty('--pointer-x');
      card.style.removeProperty('--pointer-y');
    });
  });
})();
