/* Reader: one vertical strip that loops forever.

   How the infinite loop works
   ---------------------------
   The story is rendered as identical "sets" (01..09 each). Only a small pool of
   sets exists in the DOM (enough to cover ~3 screens). Set k always sits at
   y = k * H (H = height of one set) thanks to a spacer above the pool:

       [spacer: firstK * H px][set][set][set]

   When the reader scrolls down, the set that has left the screen far above is
   moved to the bottom and the spacer grows by exactly H in the same frame, so
   nothing on screen moves and the DOM never grows. Scrolling back up does the
   reverse. Because every set is identical, the page can also be "rebased"
   (scrolled up by a whole number of sets) invisibly - we do that only once the
   reader has been idle for a moment, so it never fights touch momentum. */
(function () {
  "use strict";

  var BS = window.BS;
  var $ = function (s) { return document.querySelector(s); };

  var strip = $("[data-strip]");
  var spacer = $("[data-spacer]");
  var header = $("[data-header]");
  var progressBar = $("[data-progress]");
  var countEl = $("[data-count]");
  var totalEl = $("[data-total]");
  var loopEl = $("[data-loop]");
  var titleEl = $("[data-title]");
  var railTitle = $("[data-rail-title]");
  var message = $("[data-message]");

  var id = new URLSearchParams(location.search).get("id") || "desert-arc";

  var IDLE_MS = 420;          // how long the page must be still before a rebase
  var REBASE_AFTER = 6;       // sets scrolled past before we bother rebasing
  var LOOP_EGG = 6 * 7;       // loops until the flock shows up
  var HIDE_AFTER = 42;        // px of downward scroll before the header tucks away

  var story, count, panels, H = 0, stripTop = 0, lastWidth = 0;
  var sets = [], firstK = 0, loopBase = 0;
  var offsets = [];           // top of each panel within a set (px)
  var format = null;          // "webp" or the story's own extension, learnt from the first load
  var preloaded = {};
  var io = null;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* ---------- Boot ---------- */
  BS.loadStories()
    .then(function (stories) {
      story = stories.find(function (s) { return s.id === id; });
      if (!story) return showMessage("Lost sheep.", "That story doesn't exist (yet).");
      if (story.status !== "live") return showMessage("Not yet.", "This one is still being drawn. Come back soon.");
      return start();
    })
    .catch(function (err) {
      console.error(err);
      showMessage("Hmm.", "The library didn't load. Try again in a moment.");
    });

  function showMessage(title, text) {
    strip.hidden = true;
    message.hidden = false;
    message.innerHTML =
      "<h2></h2><p></p><a class=\"pill pill--solid\" href=\"./\" data-cursor=\"link\">Back to the library <span class=\"arrow arrow--right\" aria-hidden=\"true\">→</span></a>";
    message.querySelector("h2").textContent = title;
    message.querySelector("p").textContent = text;
    document.title = title + " — SEEQUENCE";
  }

  function src(i, ext) {
    return "stories/" + story.id + "/" + BS.pad(i + 1) + "." + (ext || story.ext || "jpg");
  }

  function measure(n) {
    // Fallback when stories.json has no panel sizes: read them from the images.
    var jobs = [];
    for (var i = 0; i < n; i++) {
      jobs.push(new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () { resolve([im.naturalWidth, im.naturalHeight]); };
        im.onerror = function () { resolve([1080, 1350]); };
        im.src = src(i);
      }));
    }
    return Promise.all(jobs);
  }

  function start() {
    count = story.count || (story.panels && story.panels.length) || 0;
    if (!count) return showMessage("Empty.", "This story has no panels yet.");

    titleEl.textContent = story.title;
    railTitle.textContent = story.title;
    totalEl.textContent = BS.pad(count);
    document.title = story.title + " — SEEQUENCE";

    return (story.panels && story.panels.length === count ? Promise.resolve(story.panels) : measure(count)).then(function (sizes) {
      panels = sizes;
      var width = story.width || Math.max.apply(null, sizes.map(function (s) { return s[0]; }));
      strip.style.setProperty("--w", width + "px");
      build();
    });
  }

  /* ---------- Sets ---------- */
  function makeSet() {
    var set = document.createElement("div");
    set.className = "strip__set";
    for (var i = 0; i < count; i++) {
      var pic = document.createElement("picture");
      pic.className = "strip__panel";
      if (story.webp !== false) {
        var source = document.createElement("source");
        source.type = "image/webp";
        source.dataset.srcset = src(i, "webp");
        pic.appendChild(source);
      }
      var img = document.createElement("img");
      img.dataset.src = src(i);
      img.dataset.index = i;
      img.alt = story.title + ", panel " + (i + 1);
      img.width = panels[i][0];
      img.height = panels[i][1];
      img.style.aspectRatio = panels[i][0] + " / " + panels[i][1];
      img.decoding = "async";
      img.draggable = false;
      pic.appendChild(img);
      set.appendChild(pic);
    }
    if (io) set.querySelectorAll("img").forEach(function (im) { io.observe(im); });
    return set;
  }

  function load(img) {
    if (!img.dataset.src) return;
    var source = img.previousElementSibling;
    if (source && source.dataset.srcset) {
      source.srcset = source.dataset.srcset;
      delete source.dataset.srcset;
    }
    img.addEventListener("load", onPanelLoad, { once: true });
    img.src = img.dataset.src;
    delete img.dataset.src;
  }

  function onPanelLoad(e) {
    var img = e.target;
    img.classList.add("is-loaded");
    if (!format && img.currentSrc) {
      var m = img.currentSrc.match(/\.(\w+)(\?.*)?$/);
      format = m ? m[1] : story.ext || "jpg";
    }
  }

  function preloadAhead(from) {
    if (!format) return;
    for (var d = 1; d <= 3; d++) {
      var i = (from + d) % count;
      if (preloaded[i]) continue;
      preloaded[i] = true;
      var im = new Image();
      im.decoding = "async";
      im.src = src(i, format);
    }
  }

  function markAccessibility() {
    // Screen readers get one copy of the story; the recycled copies are decorative.
    sets.forEach(function (s, i) {
      if (i === 0) s.removeAttribute("aria-hidden");
      else s.setAttribute("aria-hidden", "true");
    });
  }

  function measureSet() {
    var first = sets[0];
    var r = first.getBoundingClientRect();
    H = r.height;
    offsets = Array.prototype.map.call(first.children, function (pic) {
      return pic.getBoundingClientRect().top - r.top;
    });
    stripTop = strip.getBoundingClientRect().top + window.scrollY;
    lastWidth = strip.clientWidth;
  }

  function poolSize() {
    return Math.max(2, Math.ceil((window.innerHeight * 3) / H) + 1);
  }

  function build() {
    io = "IntersectionObserver" in window
      ? new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) load(e.target); });
        }, { rootMargin: "200% 0px 200% 0px" })
      : null;

    var first = makeSet();
    strip.appendChild(first);
    sets.push(first);

    // the first two panels are the LCP: fetch them right away
    first.querySelectorAll("img").forEach(function (img, i) {
      if (i < 2) {
        img.fetchPriority = "high";
        load(img);
      }
      if (!io) load(img);
    });

    measureSet();
    while (sets.length < poolSize()) addSetBottom();
    markAccessibility();

    restorePosition();
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("touchstart", function () { touching = true; }, { passive: true });
    window.addEventListener("touchend", function () { touching = false; scheduleIdle(); }, { passive: true });
    window.addEventListener("touchcancel", function () { touching = false; scheduleIdle(); }, { passive: true });
    window.addEventListener("pagehide", savePosition);
    document.addEventListener("keydown", onKey);
    strip.dataset.cursor = "hide";
  }

  function addSetBottom() {
    var s = makeSet();
    strip.appendChild(s);
    sets.push(s);
    if (!io) s.querySelectorAll("img").forEach(load);
  }

  function setSpacer() {
    spacer.style.height = firstK * H + "px";
  }

  function shiftDown() {
    // the top set has scrolled far out of view: recycle it at the bottom
    var node = sets.shift();
    strip.appendChild(node);
    sets.push(node);
    firstK++;
    setSpacer();
  }

  function shiftUp() {
    var node = sets.pop();
    strip.insertBefore(node, sets[0]);
    sets.unshift(node);
    firstK--;
    setSpacer();
  }

  /* ---------- Scroll ---------- */
  var ticking = false, touching = false, idleTimer = 0;
  var lastY = 0, downBy = 0, upBy = 0, ignoreNext = false;
  var maxLoop = 0, lastPanel = -1;

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
    scheduleIdle();
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(rebase, IDLE_MS);
  }

  function update() {
    ticking = false;
    if (!H) return;
    var vh = window.innerHeight;
    var y = window.scrollY - stripTop;

    var kStart = Math.max(0, Math.floor((y - vh) / H));
    var moved = false;
    while (firstK < kStart) { shiftDown(); moved = true; }
    while (firstK > kStart) { shiftUp(); moved = true; }
    var need = Math.floor((y + vh * 2) / H) - firstK + 1;
    while (sets.length < need) { addSetBottom(); moved = true; }
    if (moved) markAccessibility();

    // where are we inside the current loop (measured at the middle of the screen)
    var mid = Math.max(0, y + vh / 2);
    var loop = Math.floor(mid / H);
    var within = mid - loop * H;
    progressBar.style.transform = "scaleX(" + (within / H).toFixed(4) + ")";

    var panel = 0;
    for (var i = offsets.length - 1; i >= 0; i--) {
      if (within >= offsets[i]) { panel = i; break; }
    }
    if (panel !== lastPanel) {
      lastPanel = panel;
      countEl.textContent = BS.pad(panel + 1);
      preloadAhead(panel);
    }

    var absoluteLoop = loop + loopBase;
    loopEl.textContent = BS.pad(absoluteLoop + 1);
    if (absoluteLoop > maxLoop) {
      countLoops(absoluteLoop - maxLoop);
      maxLoop = absoluteLoop;
    }

    // header: tuck away going down, come back going up
    var sy = window.scrollY;
    if (ignoreNext) {
      ignoreNext = false;
    } else {
      var dy = sy - lastY;
      if (dy > 0) {
        downBy += dy;
        upBy = 0;
        if (downBy > HIDE_AFTER && sy > HIDE_AFTER * 2) header.classList.add("is-hidden");
      } else if (dy < 0) {
        upBy -= dy;
        downBy = 0;
        if (upBy > 8) header.classList.remove("is-hidden");
      }
    }
    if (sy < HIDE_AFTER) header.classList.remove("is-hidden");
    lastY = sy;
  }

  function rebase() {
    if (touching || firstK < REBASE_AFTER) return;
    var m = firstK;
    var y = window.scrollY;   // read before the page gets shorter, or the browser clamps it
    firstK = 0;
    setSpacer();
    loopBase += m;
    ignoreNext = true;
    window.scrollTo({ top: y - m * H, behavior: "auto" });
    lastY = window.scrollY;
    update();
  }

  function onResize() {
    var width = strip.clientWidth;
    if (width === lastWidth) {
      // just the mobile URL bar moving: make sure there is enough strip below
      onScroll();
      return;
    }
    var y = window.scrollY - stripTop;
    var loop = Math.floor(y / H);
    var frac = (y - loop * H) / H;
    measureSet();
    setSpacer();
    ignoreNext = true;
    window.scrollTo({ top: stripTop + (loop + frac) * H, behavior: "auto" });
    update();
  }

  /* ---------- Loops & the flock ---------- */
  function countLoops(n) {
    var key = "bs:loops:" + story.id;
    var total = 0;
    try {
      total = (parseInt(localStorage.getItem(key), 10) || 0) + n;
      localStorage.setItem(key, total);
    } catch (e) {
      total = maxLoop + n;
    }
    if (total > 0 && total % LOOP_EGG === 0) {
      BS.flock("Loop after loop after loop. Welcome to the flock.");
    }
  }

  document.addEventListener("bs:answer", function () {
    BS.flock("Don't panic. Keep scrolling.");
  });

  /* ---------- Keyboard: j / k (or ← →) jump panel by panel ---------- */
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var dir = 0;
    if (e.key === "j" || e.key === "ArrowRight") dir = 1;
    else if (e.key === "k" || e.key === "ArrowLeft") dir = -1;
    if (!dir) return;
    e.preventDefault();
    var y = window.scrollY - stripTop + 1;
    var loop = Math.floor(y / H);
    var within = y - loop * H;
    var idx = 0;
    for (var i = offsets.length - 1; i >= 0; i--) {
      if (within >= offsets[i] - 1) { idx = i; break; }
    }
    var target = idx + dir;
    var loopT = loop;
    if (target >= count) { target = 0; loopT++; }
    if (target < 0) { target = count - 1; loopT--; }
    if (loopT < 0) { loopT = 0; target = 0; }
    window.scrollTo({
      top: stripTop + loopT * H + offsets[target],
      behavior: BS.reduced() ? "auto" : "smooth"
    });
  }

  /* ---------- Remember the spot on reload / back-forward ---------- */
  function savePosition() {
    if (!H) return;
    try {
      var y = window.scrollY - stripTop;
      sessionStorage.setItem("bs:pos:" + story.id, String(((y % H) + H) % H / H));
    } catch (e) {}
  }

  function restorePosition() {
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    var type = nav ? nav.type : "";
    if (type !== "reload" && type !== "back_forward") return;
    try {
      var f = parseFloat(sessionStorage.getItem("bs:pos:" + story.id));
      if (f > 0 && f < 1) {
        ignoreNext = true;
        window.scrollTo({ top: stripTop + f * H, behavior: "auto" });
      }
    } catch (e) {}
  }

  /* Back button: return to the library the way we came (keeps its scroll spot). */
  var back = $("[data-back]");
  back.addEventListener("click", function (e) {
    try {
      var ref = document.referrer ? new URL(document.referrer) : null;
      var home = new URL("./", location.href).pathname;
      var fromHome = ref && ref.origin === location.origin && ref.pathname.replace(/index\.html$/, "") === home;
      if (fromHome && history.length > 1) {
        e.preventDefault();
        history.back();
      }
    } catch (err) {}
  });
})();
