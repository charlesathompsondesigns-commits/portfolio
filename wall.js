/* Brand wall — the scroll-driven photo marquee at the top of a case study.
   Styles and markup are documented at .cs-wall in styles.css.

   Each row drifts slowly on its own and travels with the page scroll, in
   alternating directions, looping forever. The wall is pinned for a stretch
   (CSS sticky), so scrolling moves through the photos rather than past them.

   Opt in with data-wall-drag to let visitors drag or swipe a row sideways
   (and use a trackpad's horizontal scroll); walls without it behave as before.

   Opt in with data-wall-anchor on a tile to choose what a row shows the moment
   the wall reaches the top of the screen and pins. One anchored tile in a row
   is centred at that fraction of the screen width (data-wall-anchor="0.45");
   two anchored tiles in the same row sit either side of the centre, flanking
   the centre tile. Until then the idle drift waits, so they land exactly. */
(function () {
  'use strict';

  var walls = document.querySelectorAll('[data-wall]');
  if (!walls.length) return;

  var DRIFT = 16;     // idle drift, px per second
  var SCROLL = 0.6;   // px of row travel per px of page scroll
  var EASE = 0.12;    // how quickly rows catch up to the scroll (per 60fps frame)

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  Array.prototype.forEach.call(walls, function (wall) {
    var rows = Array.prototype.map.call(wall.querySelectorAll('.cs-wall__track'), function (track, i) {
      return {
        track: track,
        main: track.parentNode.classList.contains('cs-wall__row--main'),
        home: Array.prototype.slice.call(track.children),   // tiles as authored
        tiles: [],         // tiles this row currently shows
        speed: parseFloat(track.parentNode.getAttribute('data-speed')) || 1,
        user: 0,           // extra offset from the visitor dragging the row
        base: 0,           // offset that puts anchored tiles in place on load
        phase: 0.29 * i,   // stagger the rows so tiles never line up in columns
        span: 0,           // width of one full set of tiles, incl. trailing gap
        sets: 0            // cloned sets appended so far
      };
    });

    var drift = 0, eased = null, lastTime = 0, running = false, compact = null;
    var anchored = false, reached = false;
    var stage = wall.querySelector('.cs-wall__stage');

    /* Scroll value at the moment the stage pins to the top of the screen. */
    function pinPoint() {
      return window.innerHeight - ((stage && parseFloat(getComputedStyle(stage).top)) || 0);
    }

    /* On phones the centre tile covers the whole middle row (CSS sets
       --wall-compact), so that row's photos are dealt into the outer rows
       instead of being hidden behind it. */
    function arrange() {
      var now = getComputedStyle(wall).getPropertyValue('--wall-compact').trim() === '1';
      if (now === compact) return false;
      compact = now;

      rows.forEach(function (row) {
        while (row.track.firstChild) row.track.removeChild(row.track.firstChild);
        row.tiles = row.home.slice();
        row.sets = 0;
      });

      if (compact) {
        var outer = rows.filter(function (row) { return !row.main; });
        var spare = [];
        rows.forEach(function (row) {
          if (row.main && outer.length) { spare = spare.concat(row.home); row.tiles = []; }
        });
        outer.forEach(function (row, r) {
          var mine = spare.filter(function (_, i) { return i % outer.length === r; });
          var mixed = [];
          row.home.forEach(function (tile, i) {
            mixed.push(tile);
            if (i % 2 === 1 && mine.length) mixed.push(mine.shift());
          });
          row.tiles = mixed.concat(mine);
        });
      }

      rows.forEach(function (row) {
        row.tiles.forEach(function (tile) { row.track.appendChild(tile); });
      });
      return true;
    }

    /* One set must be followed by enough clones to cover the viewport, so the
       loop point is never visible. Re-measured on resize; clones only grow. */
    function measure() {
      var changed = arrange();
      rows.forEach(function (row) {
        var first = row.tiles[0], last = row.tiles[row.tiles.length - 1];
        row.span = 0;
        if (!first) return;
        var gap = parseFloat(getComputedStyle(row.track).columnGap) || 0;
        row.span = last.offsetLeft + last.offsetWidth - first.offsetLeft + gap;
        if (!(row.span > 0)) return;
        var needed = Math.ceil(window.innerWidth / row.span);
        while (row.sets < needed) {
          row.tiles.forEach(function (tile) {
            var clone = tile.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.alt = '';
            row.track.appendChild(clone);
          });
          row.sets++;
        }
      });
      return changed;
    }

    /* Row offset before any anchoring: idle drift, page scroll and dragging. */
    function offset(row, scroll) {
      return row.phase * row.span + (reduceMotion.matches ? 0 : row.speed * (drift + scroll * SCROLL)) + row.user;
    }

    /* Line rows up so their anchored tiles sit where the page asks once the wall pins. */
    function anchor() {
      if (eased === null) eased = window.innerHeight - wall.getBoundingClientRect().top;
      var vw = window.innerWidth, pin = pinPoint();
      anchored = false;
      rows.forEach(function (row) {
        row.base = 0;
        if (!(row.span > 0)) return;
        var marked = row.tiles.filter(function (t) { return t.hasAttribute('data-wall-anchor'); });
        if (!marked.length) return;
        anchored = true;
        var saved = row.track.style.transform;
        row.track.style.transform = 'none';
        var a = marked[0].getBoundingClientRect(), b = marked[marked.length - 1].getBoundingClientRect();
        row.track.style.transform = saved;
        var here, want;
        if (marked.length > 1) {
          here = (a.right + b.left) / 2;   // the space between them goes to the centre
          want = vw / 2;
        } else {
          here = (a.left + a.right) / 2;
          want = vw * (parseFloat(marked[0].getAttribute('data-wall-anchor')) || 0.5);
        }
        row.base = (here - want) - offset(row, pin);
      });
    }

    function render() {
      var rect = wall.getBoundingClientRect();
      var viewport = window.innerHeight;

      // Distance scrolled since the wall first entered the viewport.
      var target = viewport - rect.top;
      if (eased === null) eased = target;

      var still = reduceMotion.matches;
      rows.forEach(function (row) {
        if (!(row.span > 0)) return;
        var x = row.phase * row.span + (still ? 0 : row.speed * (drift + eased * SCROLL)) + row.user + row.base;
        x = ((x % row.span) + row.span) % row.span;
        row.track.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
      });

      // 0 → 1 across the pinned stretch; drives the centre tile's push-in.
      var travel = rect.height - viewport;
      var pinned = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      wall.style.setProperty('--wall-p', still ? '0' : pinned.toFixed(4));
    }

    function frame(time) {
      if (!running) return;
      var dt = lastTime ? Math.min(time - lastTime, 80) : 16.67;
      lastTime = time;

      var target = window.innerHeight - wall.getBoundingClientRect().top;
      if (eased === null) eased = target;
      eased += (target - eased) * (1 - Math.pow(1 - EASE, dt / 16.67));
      if (anchored && !reached && eased >= pinPoint() - 1) reached = true;
      if (!anchored || reached) drift += DRIFT * dt / 1000;

      render();
      requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = 0;
      requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    /* Drag, swipe or trackpad-scroll a row sideways. Vertical moves are left to
       the page so the wall still scrolls normally. A drag never counts as a click. */
    function enableDrag() {
      var active = null;

      function rowFor(el) {
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].track.parentNode.contains(el)) return rows[i];
        }
        return null;
      }
      function swallowClick() {
        function swallow(ev) { ev.stopPropagation(); ev.preventDefault(); }
        wall.addEventListener('click', swallow, true);
        setTimeout(function () { wall.removeEventListener('click', swallow, true); }, 60);
      }

      wall.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        var row = rowFor(e.target);
        if (row) active = { row: row, id: e.pointerId, x0: e.clientX, y0: e.clientY, last: e.clientX, dragging: false };
      });
      wall.addEventListener('pointermove', function (e) {
        if (!active || e.pointerId !== active.id) return;
        var dx = e.clientX - active.x0, dy = e.clientY - active.y0;
        if (!active.dragging) {
          if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
            active.dragging = true;
            wall.classList.add('is-dragging');
            try { wall.setPointerCapture(e.pointerId); } catch (err) {}
          } else if (Math.abs(dy) > 6) {
            active = null;
            return;
          } else {
            return;
          }
        }
        active.row.user -= e.clientX - active.last;
        active.last = e.clientX;
        render();
      });
      function end(e) {
        if (!active || e.pointerId !== active.id) return;
        if (active.dragging) {
          wall.classList.remove('is-dragging');
          swallowClick();
        }
        active = null;
      }
      wall.addEventListener('pointerup', end);
      wall.addEventListener('pointercancel', end);

      wall.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        var row = rowFor(e.target);
        if (!row) return;
        e.preventDefault();
        row.user += e.deltaX;
        render();
      }, { passive: false });
    }

    measure();
    anchor();
    render();
    if (wall.hasAttribute('data-wall-drag')) enableDrag();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[entries.length - 1].isIntersecting ? start() : stop();
      }, { rootMargin: '10% 0px' }).observe(wall);
    } else {
      start();
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (measure()) anchor(); render(); }, 120);
    });
    window.addEventListener('load', function () { measure(); render(); });
  });
})();
