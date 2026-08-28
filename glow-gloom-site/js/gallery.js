/* ==========================================================================
   gallery.js

   1. SCATTER LAYOUT — a real "nuage" (cloud), not a grid.
      Every photo gets an absolute left/top computed by a seeded "gravity
      drop": pick a horizontal spot with some randomness, then drop it
      straight down until it clears every photo already placed by at
      least one `gap`. Result: even breathing room everywhere (same gap
      throughout), positions that never line up into rows or columns
      (because the drop start-x is jittered and item widths vary), and —
      unlike pure noise — zero overlap, guaranteed by construction rather
      than hoped for. Deterministic per photo (seeded by index) so the
      "randomness" is stable across reloads; it only reflows on resize.

   2. REVEAL — items fade/scale in with a small stagger as the cloud
      finishes measuring, instead of just snapping into place.

   3. TILT — while the pointer is over a photo, the frame tilts toward it
      (classic "magnetic card" feel). Skipped on touch and under
      prefers-reduced-motion.

   4. CURSOR GLOW — a soft blob of theme-accent light drifts toward the
      pointer while it's inside the cloud. Fine-pointer + motion-safe only.

   5. LIGHTBOX — click a photo to zoom, arrows/keys to move, Esc/backdrop
      to close. Unchanged in spirit from before.

   TO ADD OR REMOVE PHOTOS: add/remove a <figure class="cloud-item"> block
   in neon.html / horror.html. Everything below reads the DOM and re-lays
   itself out automatically — no coordinates to hand-edit.
   ========================================================================== */
(function(){
  var cloud = document.querySelector('.cloud');
  var items = Array.prototype.slice.call(document.querySelectorAll('.cloud-item'));
  if(!cloud || !items.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // deterministic pseudo-random, seeded by index+salt so the "mess" is
  // stable across reloads instead of jumping around every visit
  function seeded(i, salt){
    var x = Math.sin(i * 999 + salt * 37.1) * 10000;
    return x - Math.floor(x);
  }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  // ---- 1. SCATTER LAYOUT ---------------------------------------------------
  // A real "nuage" gathered around a centre point, not a wall stretched
  // edge-to-edge: dense Pinterest-style masonry columns (no empty voids,
  // no overlap by construction) but shaped by a bell curve across the
  // columns — narrower + starting lower + filling up slower toward the
  // left/right edges — so the whole cluster tapers off into breathing
  // room on all four sides instead of forming a hard rectangle.
  //
  // On top of that: on desktop/tablet the whole thing is fitted to the
  // visible height (see `layout()` below) so the board reads as one
  // complete image the moment you arrive, no scrolling needed — the way
  // a corkboard is one thing you take in at a glance, not a page you
  // scroll through.
  function columnCountFor(width){
    if(width < 480) return 2;
    if(width < 760) return 3;
    if(width < 1080) return 4;
    if(width < 1420) return 5;
    if(width < 1760) return 6;
    return 7;
  }

  // Pure calculation, no DOM writes: lays the cluster out at a given
  // width/x-offset/column-count and reports how tall it came out. `cols`
  // is passed in rather than re-derived from `width` here on purpose —
  // see layout() below for why that distinction matters for the
  // fit-to-viewport step.
  function computeCluster(width, xBase, cols){
    var gap = clamp(width * 0.014, 8, 20);
    var center = (cols - 1) / 2;

    // bell curve across columns: 1 at the centre column, tapering toward
    // the edges. Drives three things at once — narrower columns, a lower
    // starting point, and a lower "priority" for extra photos — which
    // together round off the top, bottom, left and right of the cluster.
    var bell = [];
    for(var c = 0; c < cols; c++){
      var d = cols > 1 ? Math.abs(c - center) / center : 0; // 0 centre .. 1 edge
      bell.push(1 - 0.58 * Math.pow(d, 1.3));
    }
    var bellSum = bell.reduce(function(a, b){ return a + b; }, 0);
    var colW = bell.map(function(b){ return (width - gap * (cols - 1)) * (b / bellSum); });
    var colX = [];
    var acc = xBase;
    for(c = 0; c < cols; c++){ colX.push(acc); acc += colW[c] + gap; }

    var capacity = bell.map(function(b){ return 0.35 + 0.65 * b; });
    var colBottom = bell.map(function(b){ return (1 - b) * gap * 14; });
    var records = [];

    items.forEach(function(item, i){
      var img = item.querySelector('img');
      var ratio = (img && img.naturalWidth) ? img.naturalHeight / img.naturalWidth : 0.75;

      // shortest *relative to its capacity* column wins most of the time,
      // occasionally the 2nd shortest — keeps the cluster organic without
      // becoming a perfect, predictable comb pattern. Because edge
      // columns have lower capacity they "read" as fuller sooner and get
      // picked less often, so they naturally end up thinner overall too.
      var order = colBottom.map(function(b, ci){ return { ci: ci, key: b / capacity[ci] }; })
                            .sort(function(a, b){ return a.key - b.key; });
      var pick = seeded(i, 4) < 0.72 || order.length < 2 ? 0 : 1;
      var col = order[pick].ci;

      var cw = colW[col];
      // width factor is capped at 1.0 on purpose: it must never exceed
      // its own column's width, or the "stay clear of the next column"
      // clamp below can invert (lower bound > upper bound) and let a
      // photo's right edge spill into the neighbouring column
      var w = Math.round(cw * (0.84 + seeded(i, 1) * 0.16));
      var h = Math.round(w * ratio) + 2; // +2 for the frame border
      var slack = Math.max(0, cw - w);
      var jitter = (seeded(i, 3) - 0.5) * (slack + gap * 0.7);
      var x = colX[col] + slack / 2 + jitter;
      x = clamp(x, colX[col] - gap * 0.35, colX[col] + cw - w + gap * 0.35);

      var y = colBottom[col];
      colBottom[col] = y + h + gap;
      records.push({ item: item, x: x, y: y, w: w });
    });

    return { records: records, height: Math.max.apply(null, colBottom) };
  }

  function applyCluster(result){
    result.records.forEach(function(r, i){
      r.item.style.left = Math.round(r.x) + 'px';
      r.item.style.top = Math.round(r.y) + 'px';
      r.item.style.setProperty('--iw', Math.round(r.w) + 'px');

      // only randomize the decorative bits once — re-layout (or a
      // fit-to-height rescale) shouldn't re-roll rotation/drift or the
      // cloud feels jittery every time the window resizes
      if(!r.item.dataset.decorated){
        var rot = (seeded(i, 2) - 0.5) * 5;
        var dur = 6 + seeded(i, 6) * 5;
        var delay = -seeded(i, 7) * 8;
        r.item.style.setProperty('--r', rot.toFixed(2) + 'deg');
        r.item.style.setProperty('--drift-dur', dur.toFixed(2) + 's');
        r.item.style.setProperty('--drift-delay', delay.toFixed(2) + 's');
        r.item.style.setProperty('--z', String(10 + Math.round(seeded(i, 8) * 20)));
        r.item.dataset.decorated = '1';
      }
    });
  }

  // how much vertical room is actually free below the header, above the
  // bottom of the window — this is the budget the cluster has to fit in
  function availableHeight(){
    var rect = cloud.getBoundingClientRect();
    var cs = getComputedStyle(cloud);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var bottomSafety = 18; // small breathing room so nothing touches the very edge
    return Math.max(260, window.innerHeight - rect.top - padTop - padBottom - bottomSafety);
  }

  function layout(){
    var full = cloud.clientWidth;
    if(!full) return;
    // the cluster only ever uses a portion of the available width — this
    // is what leaves margin around it instead of touching the container's
    // edges like a wall
    var inset = full < 640 ? 0.02 : full < 1100 ? 0.05 : 0.06;
    var baseWidth = full * (1 - inset * 2);
    // column count is fixed here, from the natural (unscaled) width, and
    // reused as-is through the fit-to-viewport step below. It must NOT be
    // re-derived from a shrunken width: fewer columns means more rows,
    // so if scaling down were allowed to also drop a column, shrinking
    // could perversely make the cluster *taller* — exactly backwards
    // from what fitting it to the screen needs.
    var cols = columnCountFor(baseWidth);

    var pass = computeCluster(baseWidth, (full - baseWidth) / 2, cols);

    // fit-to-viewport: below ~640px this is skipped on purpose — on a
    // phone a moodboard is expected to scroll, and squeezing it down to
    // "no scroll" there would make every photo too small to actually see.
    // With the column count now held fixed, height scales down smoothly
    // with width, so a small stepped search reliably finds a scale that
    // fits (or settles at the floor scale if the window is extremely
    // short).
    if(full >= 640){
      var avail = availableHeight();
      if(pass.height > avail){
        var scale = 1;
        var minScale = 0.34;
        var best = pass;
        while(scale > minScale && best.height > avail){
          scale = Math.max(minScale, scale - 0.03);
          var w = baseWidth * scale;
          best = computeCluster(w, (full - w) / 2, cols);
        }
        pass = best;
      }
    }

    applyCluster(pass);
    cloud.style.height = Math.max(200, pass.height) + 'px';
  }

  // ---- 2. REVEAL ----------------------------------------------------------
  function revealStagger(){
    items.forEach(function(item, i){
      setTimeout(function(){ item.classList.add('in'); }, reduceMotion ? 0 : 35 * i);
    });
  }

  // wait for every photo to have real intrinsic dimensions before the
  // first layout pass, otherwise height comes out as 0 and the drop
  // algorithm can't judge collisions correctly
  function whenImagesReady(cb){
    var imgs = items.map(function(it){ return it.querySelector('img'); }).filter(Boolean);
    var pending = imgs.length;
    if(!pending) return cb();
    function done(){ pending--; if(pending <= 0) cb(); }
    imgs.forEach(function(img){
      if(img.complete && img.naturalWidth){ done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  whenImagesReady(function(){
    layout();
    requestAnimationFrame(revealStagger);
  });

  var resizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 180);
  });

  // ---- 3. TILT ------------------------------------------------------------
  if(finePointer && !reduceMotion){
    items.forEach(function(item){
      var frame = item.querySelector('.frame');
      if(!frame) return;
      item.addEventListener('mousemove', function(e){
        var baseRot = item.style.getPropertyValue('--r') || '0deg';
        var rect = item.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 .. 0.5
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        var tiltY = px * 14;   // rotateY follows horizontal position
        var tiltX = -py * 14;  // rotateX follows vertical position
        frame.style.transform =
          'perspective(700px) rotate(calc(' + baseRot + ' * -1)) scale(1.06) ' +
          'rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)';
      });
      item.addEventListener('mouseleave', function(){
        frame.style.transform = '';
      });
    });
  }

  // ---- 4. CURSOR GLOW ------------------------------------------------------
  if(finePointer && !reduceMotion){
    var glow = document.createElement('div');
    glow.className = 'cloud-glow';
    document.body.appendChild(glow);
    var gx = 0, gy = 0, tx = 0, ty = 0, raf = null;

    function tick(){
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      raf = requestAnimationFrame(tick);
    }
    cloud.addEventListener('mouseenter', function(e){
      tx = e.clientX; ty = e.clientY; gx = tx; gy = ty;
      glow.classList.add('on');
      if(!raf) raf = requestAnimationFrame(tick);
    });
    cloud.addEventListener('mousemove', function(e){ tx = e.clientX; ty = e.clientY; });
    cloud.addEventListener('mouseleave', function(){
      glow.classList.remove('on');
      if(raf){ cancelAnimationFrame(raf); raf = null; }
    });
  }

  // ---- 5. LIGHTBOX ---------------------------------------------------------
  var lb = document.querySelector('.lightbox');
  if(!lb) return;
  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('.lightbox-cap');
  var current = 0;

  function openAt(i){
    current = (i + items.length) % items.length;
    var fig = items[current];
    var img = fig.querySelector('img');
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    if(lbCap){
      lbCap.innerHTML = '<span class="idx">' + String(current+1).padStart(2,'0') + ' / ' + String(items.length).padStart(2,'0') + '</span>';
    }
    lb.classList.add('open');
    lb.setAttribute('aria-hidden','false');
  }
  function close(){
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden','true');
  }

  items.forEach(function(fig, i){
    fig.addEventListener('click', function(){ openAt(i); });
    fig.setAttribute('tabindex','0');
    fig.setAttribute('role','button');
    fig.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openAt(i); }
    });
  });

  var closeBtn = lb.querySelector('.lightbox-close');
  var prevBtn = lb.querySelector('.lightbox-nav.prev');
  var nextBtn = lb.querySelector('.lightbox-nav.next');
  if(closeBtn) closeBtn.addEventListener('click', close);
  if(prevBtn) prevBtn.addEventListener('click', function(){ openAt(current-1); });
  if(nextBtn) nextBtn.addEventListener('click', function(){ openAt(current+1); });

  lb.addEventListener('click', function(e){
    if(e.target === lb){ close(); }
  });
  document.addEventListener('keydown', function(e){
    if(!lb.classList.contains('open')) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowRight') openAt(current+1);
    if(e.key === 'ArrowLeft') openAt(current-1);
  });
})();
