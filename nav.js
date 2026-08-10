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
