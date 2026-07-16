(function () {
  function init() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var links = nav.querySelector('.nav__links');
    if (!links) return;

    links.id = links.id || 'primary-menu';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav__toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', links.id);
    btn.setAttribute('aria-label', 'Toggle menu');
    btn.innerHTML = '<svg class="nav__toggle-icon" viewBox="0 0 28 20" aria-hidden="true" focusable="false">' +
      '<path d="M3.2 3 C 8 2.15, 20 2.15, 24.8 3 C 20 3.85, 8 3.85, 3.2 3 Z"/>' +
      '<path d="M3.2 10 C 8 9.15, 20 9.15, 24.8 10 C 20 10.85, 8 10.85, 3.2 10 Z"/>' +
      '<path d="M3.2 17 C 8 16.15, 20 16.15, 24.8 17 C 20 17.85, 8 17.85, 3.2 17 Z"/>' +
      '</svg>';

    nav.appendChild(btn);

    function close() {
      nav.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    function open() {
      nav.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    btn.addEventListener('click', function () {
      if (nav.classList.contains('is-open')) close();
      else open();
    });

    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) close();
    });

    // If viewport grows past mobile breakpoint while menu is open, reset.
    var mq = window.matchMedia('(min-width: 721px)');
    var onChange = function (e) { if (e.matches) close(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
