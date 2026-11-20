(function () {
  /* Browser fullscreen on a Mac. With "Always Show Toolbar in Full Screen"
     turned off, Chrome and Safari slide their tabs and address bar down OVER
     the top of the page when the pointer reaches the top of the screen, or
     when you click back into a tab. The page isn't resized, so a nav pinned
     to the top ends up hidden underneath. No browser API reports that bar,
     so this infers when it's showing and drops the nav just below it
     (.nav--below-bar, offset by --browser-bar, in styles.css). --bar-push
     moves each page's top content down by the same amount, so the space
     between the nav and the hero stays as designed. */
  function keepBelowBrowserBar(nav) {
    var mac = /Mac/i.test(navigator.platform || navigator.userAgent);
    if (!mac || !window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var root = document.documentElement;
    var KEY = 'char:browser-bar';
    var DEFAULT_BAR = 88; // Chrome's tabs + address bar on macOS, in screen px
    var MENU_BAR = 24;    // the macOS menu bar drops in above it on Macs without a notch
    var shown = false;
    var barPx = 0;

    // Page zoom, so screen px and CSS px can be compared.
    function zoom() { return window.outerWidth / Math.max(1, window.innerWidth); }
    // Browser UI permanently above the page, in screen px. In a normal window
    // that's the tabs and address bar; in fullscreen with the toolbar hidden, 0.
    function uiAbove() { return window.outerHeight - window.innerHeight * zoom(); }
    function fillsScreen() {
      return Math.abs(uiAbove()) < 3 &&
        window.outerWidth >= screen.width - 2 &&
        window.outerHeight >= screen.height - 48; // notched Macs keep fullscreen below the notch
    }
    function stored() {
      try { return parseFloat(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; }
    }
    // In a normal window, the UI above the page is exactly what slides down in
    // fullscreen, so remember this browser's real height for later.
    function measure() {
      var h = Math.round(uiAbove());
      if (h > 40 && h < 160 && h !== stored()) {
        try { localStorage.setItem(KEY, String(h)); } catch (e) {}
      }
    }
    function barHeight() {
      var h = stored() || DEFAULT_BAR;
      if (screen.height - window.outerHeight < 3) h += MENU_BAR;
      return Math.round(h / zoom());
    }

    function show() {
      if (shown || !fillsScreen()) return;
      shown = true;
      barPx = barHeight();
      root.style.setProperty('--browser-bar', barPx + 'px');
      root.style.setProperty('--bar-push', barPx + 'px');
      nav.classList.add('nav--below-bar');
    }
    function hide() {
      if (!shown) return;
      shown = false;
      root.style.setProperty('--bar-push', '0px');
      nav.classList.remove('nav--below-bar');
    }

    // Pointer hits the top edge of the screen (or leaves the page through it):
    // the bar is coming down. Pointer back in the page below it: the bar has
    // gone, so the nav slides back up with it.
    document.addEventListener('mousemove', function (e) {
      if (e.clientY <= 1) show();
      else if (shown && e.clientY > barPx) hide();
    }, { passive: true });
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY < 12) show();
    });

    // Clicking back into this tab, or into the address bar, happens up in the
    // bar, so the bar is showing whenever the pointer isn't over the page.
    function pointerOnPage() { return root.matches(':hover'); }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (pointerOnPage()) hide(); else show();
    });
    window.addEventListener('focus', function () { if (pointerOnPage()) hide(); });
    window.addEventListener('blur', function () { if (!pointerOnPage()) show(); });

    var queued = false;
    window.addEventListener('resize', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        if (!fillsScreen()) { hide(); measure(); }
      });
    });
    if (!fillsScreen()) measure();
  }

  function init() {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    keepBelowBrowserBar(nav);
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
      // Even-weight bars with fully rounded ends (pill shapes)
      '<path d="M4.2 2.15h19.6a0.85 0.85 0 0 1 0 1.7H4.2a0.85 0.85 0 0 1 0-1.7Z"/>' +
      '<path d="M4.2 9.15h19.6a0.85 0.85 0 0 1 0 1.7H4.2a0.85 0.85 0 0 1 0-1.7Z"/>' +
      '<path d="M4.2 16.15h19.6a0.85 0.85 0 0 1 0 1.7H4.2a0.85 0.85 0 0 1 0-1.7Z"/>' +
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

  // Featured Media marquee — clone the card set once so the loop hands off
  // seamlessly at exactly one set over. Clones are decorative.
  //
  // The scroll runs in JS rather than as a CSS keyframe animation: a drag
  // offset and an animated transform cannot share the same property, so
  // dragging would fight the animation. Owning the transform lets auto-scroll
  // and drag be the same number.
  function initMarquee() {
    var marquee = document.querySelector('.media-marquee');
    var track = document.querySelector('.media-track');
    if (!marquee || !track || track.querySelector('.media-card--dupe')) return;

    var cards = Array.prototype.slice.call(track.children);
    if (!cards.length) return;

    cards.forEach(function (card) {
      var dupe = card.cloneNode(true);
      dupe.classList.add('media-card--dupe');
      dupe.setAttribute('aria-hidden', 'true');
      dupe.setAttribute('tabindex', '-1');
      track.appendChild(dupe);
    });

    // Reduced motion keeps the static, natively scrollable row.
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;

    var SECONDS_PER_SET = 40;   // matches the previous CSS timing
    var DRAG_THRESHOLD = 6;     // px before a press counts as a drag, not a click
    // A flick coasts v/FRICTION px in total, so these two together cap the
    // throw at ~500px — roughly a card and a half, rather than flinging
    // several full sets past the reader.
    var FRICTION = 0.005;       // momentum decay per ms
    var MAX_FLICK = 2.5;        // px per ms

    var offset = 0;
    var half = 0;
    var speed = 0;
    var paused = false;
    var dragging = false;
    var momentum = 0;
    var startX = 0;
    var startOffset = 0;
    var moved = 0;
    var lastX = 0;
    var lastT = 0;
    var lastFrame = 0;
    var rafId = null;

    marquee.classList.add('is-interactive');

    function measure() {
      half = track.scrollWidth / 2;
      speed = half > 0 ? half / (SECONDS_PER_SET * 1000) : 0; // px per ms
      if (half > 0) offset = wrap(offset);
    }

    // Keeps offset inside [0, half) so the two card sets stay interchangeable
    // — JS % is signed, so a plain modulo breaks when dragging backwards.
    function wrap(value) {
      if (!half) return 0;
      return ((value % half) + half) % half;
    }

    function draw() {
      track.style.transform = 'translate3d(' + (-offset) + 'px,0,0)';
    }

    function frame(now) {
      var dt = Math.min(now - (lastFrame || now), 64); // clamp tab-switch jumps
      lastFrame = now;

      if (!dragging && half) {
        if (momentum) {
          offset -= momentum * dt;
          momentum *= Math.exp(-FRICTION * dt);
          if (Math.abs(momentum) < speed) momentum = 0;
        } else if (!paused) {
          offset += speed * dt;
        }
        offset = wrap(offset);
        draw();
      }

      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (rafId === null) {
        lastFrame = 0;
        rafId = window.requestAnimationFrame(frame);
      }
    }

    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    // ---- pointer drag ----

    track.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return; // left / touch / pen only
      dragging = true;
      momentum = 0;
      moved = 0;
      startX = lastX = e.clientX;
      startOffset = offset;
      lastT = e.timeStamp;
      marquee.classList.add('is-dragging');
      if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
    });

    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));

      var dt = e.timeStamp - lastT;
      if (dt > 0) momentum = (e.clientX - lastX) / dt; // px per ms
      lastX = e.clientX;
      lastT = e.timeStamp;

      offset = wrap(startOffset - dx);
      draw();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      marquee.classList.remove('is-dragging');
      if (e && e.pointerId != null && track.releasePointerCapture) {
        try { track.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      // A stale flick shouldn't fling the track on release.
      if (e && e.timeStamp - lastT > 120) momentum = 0;
      if (momentum > MAX_FLICK) momentum = MAX_FLICK;
      else if (momentum < -MAX_FLICK) momentum = -MAX_FLICK;
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // Swallow the click that follows a drag, so dragging past a card never
    // navigates to it. A genuine tap (under the threshold) still works.
    track.addEventListener('click', function (e) {
      if (moved > DRAG_THRESHOLD) {
        e.preventDefault();
        e.stopPropagation();
        moved = 0;
      }
    }, true);

    // Native image/link dragging would hijack the gesture.
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // ---- pause conditions ----

    marquee.addEventListener('pointerenter', function () { paused = true; });
    marquee.addEventListener('pointerleave', function () { paused = false; });
    marquee.addEventListener('focusin', function () { paused = true; });
    marquee.addEventListener('focusout', function () { paused = false; });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    // ---- sizing ----

    measure();
    draw();

    if (window.ResizeObserver) {
      new window.ResizeObserver(measure).observe(track);
    } else {
      window.addEventListener('resize', measure);
    }

    // Lazy images change the track width as they land.
    Array.prototype.forEach.call(track.querySelectorAll('img'), function (img) {
      if (!img.complete) img.addEventListener('load', measure, { once: true });
    });

    var onReduceChange = function (e) {
      if (e.matches) { stop(); track.style.transform = ''; }
      else start();
    };
    if (reduce.addEventListener) reduce.addEventListener('change', onReduceChange);
    else if (reduce.addListener) reduce.addListener(onReduceChange);

    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); initMarquee(); });
  } else {
    init();
    initMarquee();
  }
})();
