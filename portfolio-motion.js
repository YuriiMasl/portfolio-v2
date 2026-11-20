/* Portfolio motion layer: one system, restrained and accessible.
   - CSS handles the hero entrance.
   - GSAP + ScrollTrigger handle section reveals and a light hero drift.
   - Native anchors, the compare slider and the menu work without GSAP. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Menu: native <details>, closed on Escape/outside click ---------- */

  function closeMenus() {
    document.querySelectorAll('.mobile-menu[open]').forEach(function (menu) {
      menu.open = false;
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.key === 'Esc') closeMenus();
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.mobile-menu')) closeMenus();
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 1100) closeMenus();
  });

  /* ---------- Active project card ---------- */

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
    var hasInitial = caseSections.some(function (section) { return section.id === initial; });
    if (hasInitial) setActiveCase(initial);

    caseLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        setActiveCase(link.getAttribute('data-case-link'));
      });
    });

    window.addEventListener('hashchange', function () {
      var id = window.location.hash.slice(1);
      if (caseSections.some(function (section) { return section.id === id; })) setActiveCase(id);
    });

    if (!reduce && 'IntersectionObserver' in window) {
      var visibleCases = {};
      var activeObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          visibleCases[entry.target.id] = entry.isIntersecting;
        });
        var visible = caseSections.filter(function (section) {
          return visibleCases[section.id];
        }).sort(function (a, b) {
          return Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top);
        });
        setActiveCase(visible[0] ? visible[0].id : null);
      }, { rootMargin: '-24% 0px -60% 0px', threshold: 0 });
      caseSections.forEach(function (section) { activeObserver.observe(section); });
    }
  }

  /* ---------- Card light follows the pointer ---------- */

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

  /* ---------- Scroll choreography ---------- */

  if (reduce || !window.gsap || !window.ScrollTrigger) return;

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);
  window.ScrollTrigger.config({ ignoreMobileResize: true });

  var revealGroups = [
    '.case-index__head',
    '.case-shelf__item',
    '.case-head',
    '.compare, .case-board, .luma-board',
    '.case-body',
    '.case-next',
    '.process-head',
    '.step',
    '.services h2, .service, .service-note',
    '.faq h2, .faq-item',
    '.about-grid',
    '.contact h2, .contact .lead, .contact-actions, .contact .note'
  ];

  revealGroups.forEach(function (selector) {
    window.ScrollTrigger.batch(selector, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.from(batch, {
          y: 26,
          opacity: 0,
          duration: .72,
          stagger: .055,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        });
      }
    });
  });

  gsap.matchMedia().add('(min-width: 881px)', function () {
    gsap.to('.hero-copy', {
      yPercent: -7,
      opacity: .4,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  });
}());
