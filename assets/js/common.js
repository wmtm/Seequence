/* SEEQUENCE — shared behaviour (cursor, reveals, the flock). No dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var BS = (window.BS = window.BS || {});

  BS.reduced = function () {
    return reducedQuery.matches;
  };

  BS.pad = function (n) {
    return String(n).padStart(2, "0");
  };

  /* stories.json, fetched once and shared */
  var storiesPromise = null;
  BS.loadStories = function () {
    if (!storiesPromise) {
      storiesPromise = fetch("stories.json", { cache: "no-cache" })
        .then(function (r) {
          if (!r.ok) throw new Error("stories.json " + r.status);
          return r.json();
        })
        .then(function (data) {
          return data.stories || [];
        });
    }
    return storiesPromise;
  };

  /* Split a title into plain + accent word: "Desert Arc" -> ["Desert", "Arc"] */
  BS.titleParts = function (title, accent) {
    var words = String(title).trim().split(/\s+/);
    if (accent && words.indexOf(accent) > -1) {
      return [words.filter(function (w) { return w !== accent; }).join(" "), accent];
    }
    if (words.length < 2) return ["", words[0]];
    return [words.slice(0, -1).join(" "), words[words.length - 1]];
  };

  /* ---------- Scroll reveals ---------- */
  BS.observeReveals = function (scope) {
    var els = (scope || document).querySelectorAll("[data-reveal]:not(.is-in)");
    if (!("IntersectionObserver" in window) || BS.reduced()) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach(function (el) { io.observe(el); });
  };

  /* ---------- Custom cursor ---------- */
  function initCursor() {
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine || BS.reduced()) return;

    var dot = document.createElement("div");
    var ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);

    var x = -100, y = -100, rx = x, ry = y, started = false, raf = 0;

    function tick() {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      dot.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      if (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1) raf = requestAnimationFrame(tick);
      else raf = 0;
    }

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!started) {
        started = true;
        rx = x;
        ry = y;
        root.classList.add("has-cursor");
      }
      root.classList.remove("cursor-out");
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    document.addEventListener("pointerleave", function () { root.classList.add("cursor-out"); });
    window.addEventListener("blur", function () { root.classList.add("cursor-out"); });

    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest ? e.target.closest("[data-cursor]") : null;
      if (!t) {
        delete root.dataset.cursor;
        ring.textContent = "";
        return;
      }
      root.dataset.cursor = t.dataset.cursor;
      ring.textContent = t.dataset.cursorText || "";
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer = 0;
  BS.toast = function (msg, ms) {
    var el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(function () { el.classList.add("is-in"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-in"); }, ms || 4200);
  };

  /* ---------- The flock (easter egg) ---------- */
  var flocking = false;
  BS.flock = function (message) {
    if (message) BS.toast(message, 6300);
    if (flocking || BS.reduced()) return;
    flocking = true;
    var wrap = document.createElement("div");
    wrap.className = "flock";
    wrap.setAttribute("aria-hidden", "true");
    var sheep = 42, longest = 0;
    for (var i = 0; i < sheep; i++) {
      var img = document.createElement("img");
      img.src = "assets/img/logo.png";
      img.alt = "";
      var size = 24 + Math.random() * 60;
      var dur = 2.1 + Math.random() * 2.1;
      var delay = Math.random() * 2.1;
      longest = Math.max(longest, dur + delay);
      img.style.setProperty("--s", size + "px");
      img.style.setProperty("--y", Math.random() * 92 + "vh");
      img.style.setProperty("--d", dur + "s");
      img.style.setProperty("--delay", delay + "s");
      wrap.appendChild(img);
    }
    document.body.appendChild(wrap);
    setTimeout(function () {
      wrap.remove();
      flocking = false;
    }, longest * 1000 + 420);
  };

  /* Type the answer to life, the universe and everything, anywhere. */
  var typed = "";
  var typedAt = 0;
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var now = Date.now();
    if (now - typedAt > 1200) typed = "";
    typedAt = now;
    typed = (typed + e.key).slice(-2);
    if (typed === String(6 * 7)) {
      typed = "";
      document.dispatchEvent(new CustomEvent("bs:answer"));
    }
  });

  /* A quiet hello for the curious. */
  try {
    console.log(
      "%cSEEQUENCE%c\nYou opened the console. Of course you did.\nThe question matters more than the answer. Try typing the answer anyway.",
      "font:700 21px/1.4 sans-serif;letter-spacing:-.02em;color:#f6f3ee;background:#0b0b0c;padding:4px 10px",
      "color:#9a968f"
    );
  } catch (e) {}

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initCursor);
  else initCursor();
})();
