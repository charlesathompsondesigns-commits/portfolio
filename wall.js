/* Brand wall — the scroll-driven photo marquee at the top of a case study.
   Styles and markup are documented at .cs-wall in styles.css.

   Each row drifts slowly on its own and travels with the page scroll, in
   alternating directions, looping forever. The wall is pinned for a stretch
   (CSS sticky), so scrolling moves through the photos rather than past them. */
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
        phase: 0.29 * i,   // stagger the rows so tiles never line up in columns
        span: 0,           // width of one full set of tiles, incl. trailing gap
        sets: 0            // cloned sets appended so far
      };
    });

    var drift = 0, eased = null, lastTime = 0, running = false, compact = null;

    /* On phones the centre tile covers the whole middle row (CSS sets
       --wall-compact), so that row's photos are dealt into the outer rows
       instead of being hidden behind it. */
    function arrange() {
      var now = getComputedStyle(wall).getPropertyValue('--wall-compact').trim() === '1';
      if (now === compact) return;
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
    }

    /* One set must be followed by enough clones to cover the viewport, so the
       loop point is never visible. Re-measured on resize; clones only grow. */
    function measure() {
      arrange();
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
        var x = row.phase * row.span + (still ? 0 : row.speed * (drift + eased * SCROLL));
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

      drift += DRIFT * dt / 1000;
      var target = window.innerHeight - wall.getBoundingClientRect().top;
      if (eased === null) eased = target;
      eased += (target - eased) * (1 - Math.pow(1 - EASE, dt / 16.67));

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

    measure();
    render();

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
      resizeTimer = setTimeout(function () { measure(); render(); }, 120);
    });
    window.addEventListener('load', function () { measure(); render(); });
  });
})();
