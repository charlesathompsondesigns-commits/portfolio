/* Project cards, shared by the homepage and the Work page.
   Each part only acts on the cards that are on the page:
   the Projects colour bands, the Sun-Drop vine, the 808 reel and the Where We Rest loop. */
    /* Projects background: a soft brand olive above the 808 card, light olive behind it,
       Braid lavender behind Braid, Chronicle blue behind Chronicle. Stops are
       measured from the real layout so they line up at every screen size. */
    (function () {
      var work = document.getElementById('work');
      if (!work || !window.ResizeObserver) return;
      var all = [
        { el: work.querySelector('.case-card--nascar'),    c: '220,223,184' },
        { el: work.querySelector('.case-card--sundrop'),   c: '238,220,226' },
        { el: work.querySelector('.case-card--braid'),     c: '223,213,237' },
        { el: work.querySelector('.case-card--wwr'),       c: '222,232,219' },
        { el: work.querySelector('.case-card--chronicle'), c: '220,232,244' }
      ].filter(function (x) { return x.el; });
      if (!all.length) return;
      var cards = all;
      /* a whisper of the brand olive #808808, only a little deeper than the light olive behind the card */
      var OLIVE = [207, 211, 162];
      function rgb(s) { return s.split(',').map(Number); }
      function top(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
      /* eased blend between two colour stops, so no transition reads as a hard line */
      function ease(t) { return t * t * (3 - 2 * t); }
      function css(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (+a.toFixed(3)) + ')'; }
      function paint() {
        /* cards tucked under "Explore the rest of my work" only get a band once it's open */
        cards = all.filter(function (x) { return !x.el.closest('.more-work:not(.is-open)'); });
        var base = top(work), h = work.offsetHeight;
        var lead = Math.round(Math.min(420, window.innerHeight * 0.5));
        var pts = [
          { p: 0, c: OLIVE, a: 0 },
          { p: lead, c: OLIVE, a: 1 }
        ];
        cards.forEach(function (x) {
          var a = top(x.el) - base + lead, b = a + x.el.offsetHeight, c = rgb(x.c);
          pts.push({ p: a, c: c, a: 1 }, { p: b, c: c, a: 1 });
        });
        pts.push({ p: h + lead, c: pts[pts.length - 1].c, a: 0 });
        var stops = [];
        for (var i = 0; i < pts.length - 1; i++) {
          var A = pts[i], B = pts[i + 1], same = A.a === B.a && A.c.join() === B.c.join();
          var n = same ? 1 : 10;
          for (var k = (i ? 1 : 0); k <= n; k++) {
            var t = k / n, e = ease(t);
            var c = [0, 1, 2].map(function (j) { return A.c[j] + (B.c[j] - A.c[j]) * e; });
            stops.push(css(c, A.a + (B.a - A.a) * e) + ' ' + Math.round(A.p + (B.p - A.p) * t) + 'px');
          }
        }
        work.style.setProperty('--work-lead', lead + 'px');
        /* the same bands in page coordinates, for the glass nav to sample */
        work.__bands = pts.map(function (q) { return { y: base - lead + q.p, c: q.c, a: q.a }; });
        work.style.setProperty('--work-bands', 'linear-gradient(to bottom,' + stops.join(',') + ')');
      }
      var queued = false;
      function queue() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; paint(); }); }
      new ResizeObserver(queue).observe(work);
      window.addEventListener('resize', queue);
      paint();
    })();
    /* Sun-Drop card: a gold vine grows through her sketch in step with the lamp video.
       It is built here as one plant: a single stem that weaves behind the video and ends
       in a curl, with tendrils that branch off along the stem's own direction and wind
       into spirals, and leaves on short stalks that sprout from points on the line.
       Strokes swell and taper like a pen line (the "S" in her wordmark). Over each loop
       the stem draws with a pointed tip, branches and leaves follow the moment the line
       reaches them, and everything fades just before the video starts again.
       With reduced motion, or before the video plays, the whole vine shows at rest. */
    (function () {
      var stage = document.querySelector('.sd-stage');
      if (!stage) return;
      var v = stage.querySelector('video');
      var svg = stage.querySelector('.sd-vine');
      var NS = 'http://www.w3.org/2000/svg';
      var GOLD = 'url(#sdGold)';
      var HIDE = [585, 1015];        // in this 1600 x 1000 space the video covers about x 560 to 1040

      function el(tag, attrs, parent) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
      }
      function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
      function smooth(x) { return x * x * (3 - 2 * x); }
      function backOut(x) { var c = 1.4; x = x - 1; return 1 + (c + 1) * x * x * x + c * x * x; }

      /* a smooth curve through points (Catmull-Rom as cubic Beziers) */
      function spline(p) {
        var d = 'M' + p[0][0] + ' ' + p[0][1];
        for (var i = 0; i < p.length - 1; i++) {
          var a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
          d += ' C' + (b[0] + (c[0] - a[0]) / 6) + ' ' + (b[1] + (c[1] - a[1]) / 6) + ' ' +
               (c[0] - (e[0] - b[0]) / 6) + ' ' + (c[1] - (e[1] - b[1]) / 6) + ' ' + c[0] + ' ' + c[1];
        }
        return d;
      }
      /* points every `step` units along a curve, each with its heading */
      function sample(d, step) {
        var p = el('path', { d: d }, svg), len = p.getTotalLength(), out = [];
        for (var s = 0; s <= len; s += step) { var q = p.getPointAtLength(s); out.push([q.x, q.y, 0]); }
        svg.removeChild(p);
        return headings(out);
      }
      function headings(pts) {
        for (var i = 0; i < pts.length; i++) {
          var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          pts[i][2] = Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
        return pts;
      }
      /* a line that keeps turning to one side, tighter and tighter: a tendril or volute */
      function curl(x, y, h, len, r0, r1, side, step) {
        var out = [], n = Math.max(2, Math.round(len / step));
        for (var i = 0; i <= n; i++) {
          out.push([x, y, h]);
          var r = r0 * Math.pow(r1 / r0, i / n);
          h += side * step / r;
          x += step * Math.cos(h);
          y += step * Math.sin(h);
        }
        return out;
      }
      /* the filled outline of a line with a varying width; a growing line gets a pointed tip */
      function ribbon(pts, k, width, growing) {
        var n = pts.length, L = [], R = [];
        if (k < 2) return '';
        for (var i = 0; i < k; i++) {
          var p = pts[i], w = width(i / (n - 1), p[2]) / 2;
          if (growing) { var back = k - 1 - i; if (back < 12) w *= Math.sqrt(back / 12); }
          var nx = -Math.sin(p[2]) * w, ny = Math.cos(p[2]) * w;
          L.push((p[0] + nx).toFixed(1) + ' ' + (p[1] + ny).toFixed(1));
          R.push((p[0] - nx).toFixed(1) + ' ' + (p[1] - ny).toFixed(1));
        }
        return 'M' + L.join('L') + 'L' + R.reverse().join('L') + 'Z';
      }

      /* ---- the plant ---- */
      /* A broad-nib pen held at about 35 degrees: strokes swell on one diagonal and thin on
         the other, which gives the line its calligraphic thick and thin, like her "S". */
      var NIB = 35 * Math.PI / 180;
      function pen(h, thin, thick) { return thin + (thick - thin) * Math.abs(Math.sin(h - NIB)); }
      var STEM = [[300, 1090], [372, 980], [404, 880], [356, 760], [352, 650], [418, 540], [486, 440],
                  [526, 336], [594, 228], [742, 150], [912, 138], [1062, 196], [1134, 300], [1116, 418],
                  [1146, 532], [1226, 618], [1290, 716]];
      var stem = sample(spline(STEM), 4);
      var tail = stem[stem.length - 1];
      stem = stem.concat(curl(tail[0], tail[1], tail[2], 560, 175, 30, 1, 4).slice(1));   // ends in an open volute
      var N = stem.length;
      function stemWidth(t, h) { var env = t < 0.66 ? 1 : Math.max(0.12, 1 - Math.pow((t - 0.66) / 0.34, 0.9)); return pen(h, 3.2, 12) * env + 0.8; }
      function branchWidth(t, h) { return pen(h, 1.6, 7.5) * Math.pow(1 - t, 0.65) + 0.7; }
      function stalkWidth(t) { return 3.2 - 1.3 * t; }

      /* where the stem passes behind the video, it draws quickly */
      var h0 = -1, h1 = -1;
      stem.forEach(function (p, i) { if (p[0] > HIDE[0] && p[0] < HIDE[1] && p[1] < 360) { if (h0 < 0) h0 = i; h1 = i; } });
      var F0 = h0 / (N - 1), F1 = h1 / (N - 1);
      /* stem progress for video progress T (0 to 1), and the reverse */
      var K = [[0.03, 0], [0.40, F0], [0.47, F1], [0.80, 1]];
      function stemAt(T) {
        if (T <= K[0][0]) return 0;
        for (var i = 1; i < K.length; i++) if (T <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * (T - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
        return 1;
      }
      function timeAt(f) {
        for (var i = 1; i < K.length; i++) if (f <= K[i][1]) return K[i - 1][0] + (K[i][0] - K[i - 1][0]) * (f - K[i - 1][1]) / ((K[i][1] - K[i - 1][1]) || 1);
        return K[K.length - 1][0];
      }

      var lines = el('g', {}, svg), leafLayer = el('g', {}, svg);
      var stemPath = el('path', { fill: GOLD }, lines);

      /* tendrils: { at: place on the stem, side: which way they wind, ang: angle off the stem } */
      var BR = [
        { at: 0.150, side: -1, ang: 36, len: 540, r0: 195, r1: 30 },   // the big volute, lower left
        { at: 0.255, side: 1, ang: 40, len: 170, r0: 80, r1: 16 },     // small curl toward the video
        { at: 0.360, side: -1, ang: 30, len: 300, r0: 140, r1: 22 },   // reaching up and out, top left
        { at: 0.705, side: -1, ang: 34, len: 480, r0: 180, r1: 28 },   // the big volute, right
        { at: 0.860, side: 1, ang: 38, len: 160, r0: 75, r1: 15 }      // a small curl inside the end
      ].map(function (b) {
        var i = Math.round(b.at * (N - 1)), p = stem[i];
        b.pts = curl(p[0], p[1], p[2] + b.side * b.ang * Math.PI / 180, b.len, b.r0, b.r1, b.side, 4);
        b.start = timeAt(b.at);
        b.dur = 0.07 + b.len / 3600;
        b.path = el('path', { fill: GOLD }, lines);
        return b;
      });

      /* leaves: on the stem (on: -1) or on a tendril (on: index), with a stalk that sprouts from the line */
      var LV = [
        { on: -1, at: 0.070, side: 1, size: 76 }, { on: -1, at: 0.100, side: -1, size: 58 },
        { on: 0, at: 0.16, side: 1, size: 66 }, { on: 0, at: 0.36, side: -1, size: 52 }, { on: 0, at: 0.56, side: 1, size: 38 },
        { on: -1, at: 0.200, side: 1, size: 64 }, { on: -1, at: 0.225, side: -1, size: 46 },
        { on: 2, at: 0.22, side: 1, size: 52 }, { on: 2, at: 0.46, side: -1, size: 38 },
        { on: -1, at: 0.330, side: 1, size: 44 },
        { on: -1, at: 0.655, side: 1, size: 62 }, { on: -1, at: 0.680, side: -1, size: 50 },
        { on: 3, at: 0.16, side: 1, size: 64 }, { on: 3, at: 0.38, side: -1, size: 50 }, { on: 3, at: 0.58, side: 1, size: 36 },
        { on: -1, at: 0.790, side: 1, size: 58 }, { on: -1, at: 0.815, side: -1, size: 46 },
        { on: -1, at: 0.900, side: -1, size: 36 }
      ].map(function (f) {
        var host = f.on < 0 ? stem : BR[f.on].pts;
        var p = host[Math.round(f.at * (host.length - 1))];
        f.stalk = curl(p[0], p[1], p[2] + f.side * 0.95, 30, 70, 50, -f.side, 2.5);
        f.start = f.on < 0 ? timeAt(f.at) : BR[f.on].start + f.at * BR[f.on].dur;
        f.stalkPath = el('path', { fill: GOLD }, lines);
        var end = f.stalk[f.stalk.length - 1], Lf = f.size, W = Lf * 0.46;
        f.g = el('g', {}, leafLayer);
        /* mirrored on the other side of the stem, so every leaf leans the way the vine grows */
        f.base = 'translate(' + end[0].toFixed(1) + ' ' + end[1].toFixed(1) + ') rotate(' + (end[2] * 180 / Math.PI).toFixed(1) + ')' + (f.side < 0 ? ' scale(1 -1)' : '');
        /* an almond leaf with a slight bend, drawn along its own heading, and a fine vein */
        el('path', { fill: GOLD, d: 'M0 0 C' + (Lf * 0.12) + ' ' + (-W * 1.1) + ' ' + (Lf * 0.66) + ' ' + (-W * 1.18) + ' ' + Lf + ' ' + (-W * 0.34) +
                                  ' C' + (Lf * 0.78) + ' ' + (W * 0.32) + ' ' + (Lf * 0.36) + ' ' + (W * 0.74) + ' 0 0Z' }, f.g);
        el('path', { fill: 'none', stroke: 'rgba(85, 36, 53, 0.42)', 'stroke-width': 1.5, 'stroke-linecap': 'round',
                     d: 'M' + (Lf * 0.08) + ' 0 Q' + (Lf * 0.5) + ' ' + (-W * 0.34) + ' ' + (Lf * 0.9) + ' ' + (-W * 0.32) }, f.g);
        return f;
      });

      var lastT = -1;
      function render(T, alpha) {
        if (Math.abs(T - lastT) < 0.0015 && alpha === undefined) return;
        lastT = T;
        var f = stemAt(T), k = Math.round(f * (N - 1)) + 1;
        stemPath.setAttribute('d', ribbon(stem, k, stemWidth, k < N));
        BR.forEach(function (b) {
          var g = smooth(clamp((T - b.start) / b.dur)), kb = Math.round(g * (b.pts.length - 1)) + 1;
          b.path.setAttribute('d', g > 0 ? ribbon(b.pts, kb, branchWidth, kb < b.pts.length) : '');
        });
        LV.forEach(function (lf) {
          var gs = clamp((T - lf.start) / 0.02), ks = Math.round(gs * (lf.stalk.length - 1)) + 1;
          lf.stalkPath.setAttribute('d', gs > 0 ? ribbon(lf.stalk, ks, stalkWidth, ks < lf.stalk.length) : '');
          var gl = clamp((T - lf.start - 0.015) / 0.06), sc = gl > 0 ? Math.max(0.001, backOut(gl)) : 0.001;
          lf.g.setAttribute('transform', lf.base + ' scale(' + sc.toFixed(3) + ')');
          lf.g.style.opacity = gl > 0 ? Math.min(1, gl * 2.5) : 0;
        });
        var fade = alpha !== undefined ? alpha : Math.max(0, Math.min(1, T / 0.03, T > 0.94 ? (1 - T) / 0.06 : 1));
        svg.style.opacity = fade;
      }

      render(0.92, 1);                 /* at rest: the whole vine over the poster */
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || !('IntersectionObserver' in window)) return;

      var raf = 0;
      function tick() {
        if (v.duration) render(v.currentTime / v.duration);
        raf = requestAnimationFrame(tick);
      }
      v.addEventListener('playing', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
      v.addEventListener('pause', function () { cancelAnimationFrame(raf); });
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else v.pause();
        });
      }, { threshold: 0.35 }).observe(stage);
    })();
    /* Project 808 card: the app reel (phones, the building, the 808 mark) loops while
       the card is on screen and pauses when it scrolls away. If autoplay is blocked
       (Low Power Mode) or motion is reduced, the 808 mark shows as a still. */
    (function () {
      var v = document.querySelector('.case-card__video');
      if (!v) return;
      var still = v.getAttribute('poster');
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm || !('IntersectionObserver' in window)) { v.removeAttribute('loop'); return; }
      v.removeAttribute('poster');            /* the paper shows until the first frame lands */
      v.parentNode.classList.add('is-paper');
      function play() {
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () { v.setAttribute('poster', still); });
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) play(); else v.pause();
        });
      }, { threshold: 0.35 });
      io.observe(v);
    })();
    /* Where We Rest card: the sculpture loop plays only while the card is on screen */
    (function () {
      var v = document.querySelector('.wwr-stage__video');
      if (!v || !('IntersectionObserver' in window)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else v.pause();
        });
      }, { threshold: 0.35 }).observe(v.parentNode);
    })();
