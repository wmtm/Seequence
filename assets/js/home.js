/* Homepage: renders the deck from stories.json and drives the stacking effect. */
(function () {
  "use strict";

  var BS = window.BS;
  var deck = document.querySelector("[data-deck]");
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  function webpOf(path) {
    return path.replace(/\.(jpe?g|png)$/i, ".webp");
  }

  function picture(src, alt, attrs, webp) {
    var pic = document.createElement("picture");
    if (webp !== false && !/\.webp$/i.test(src)) {
      var source = document.createElement("source");
      source.type = "image/webp";
      source.srcset = webpOf(src);
      pic.appendChild(source);
    }
    var img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.decoding = "async";
    Object.keys(attrs || {}).forEach(function (k) { img.setAttribute(k, attrs[k]); });
    pic.appendChild(img);
    return pic;
  }

  function titleNode(tag, title, accent) {
    var h = document.createElement(tag);
    h.className = "card__title";
    var parts = BS.titleParts(title, accent);
    if (parts[0]) h.append(parts[0], document.createElement("br"));
    var em = document.createElement("em");
    em.className = "accent";
    em.textContent = parts[1];
    h.appendChild(em);
    return h;
  }

  function redaction() {
    var r = document.createElement("div");
    r.className = "redact";
    r.setAttribute("aria-hidden", "true");
    [42, 84, 21, 63, 42].forEach(function (w, i) {
      var bar = document.createElement("i");
      bar.style.setProperty("--w", w + (i * 7) % 30 + "px");
      r.appendChild(bar);
    });
    return r;
  }

  function liveCard(story, n) {
    var a = document.createElement("a");
    a.className = "card card--live";
    a.href = "story.html?id=" + encodeURIComponent(story.id);
    a.dataset.cursor = "label";
    a.dataset.cursorText = "Read";
    a.setAttribute("aria-label", "Read " + story.title);

    var cover = story.cover || "stories/" + story.id + "/cover.jpg";
    var ambient = document.createElement("img");
    ambient.className = "card__ambient";
    ambient.src = cover.replace(/cover\.(jpe?g|png)$/i, "cover-ambient.jpg");
    ambient.alt = "";
    ambient.setAttribute("aria-hidden", "true");
    ambient.onerror = function () { ambient.remove(); };

    var media = document.createElement("div");
    media.className = "card__media";
    media.appendChild(picture(cover, "", { width: 840, height: 1050, fetchpriority: n === 1 ? "high" : "auto" }, story.webp));
    var shade = document.createElement("div");
    shade.className = "card__shade";

    var body = document.createElement("div");
    body.className = "card__body";
    var idx = document.createElement("span");
    idx.className = "card__index";
    idx.textContent = BS.pad(n);
    var t = titleNode("h3", story.title, story.accent);
    if (n === 1) t.style.viewTransitionName = "story-title";
    body.append(idx, t);

    a.append(ambient, media, shade, body);
    return a;
  }

  function soonCard(story, n) {
    var card = document.createElement("div");
    card.className = "card card--soon";
    card.dataset.cursor = "soon";
    card.dataset.cursorText = "Soon";

    var teaser = story.teaser || "";
    var ambient = document.createElement("img");
    ambient.className = "card__ambient";
    ambient.src = teaser;
    ambient.alt = "";
    ambient.setAttribute("aria-hidden", "true");
    ambient.loading = "lazy";

    var media = document.createElement("div");
    media.className = "card__media";
    media.setAttribute("aria-hidden", "true");
    var pic = picture(teaser, "", { width: 420, height: 525, loading: "lazy" }, story.webp);
    media.appendChild(pic);
    ["a", "b"].forEach(function (k) {
      var g = document.createElement("div");
      g.className = "glitch glitch--" + k;
      g.style.backgroundImage = "url('" + teaser + "')";
      media.appendChild(g);
    });
    var shade = document.createElement("div");
    shade.className = "card__shade";

    var body = document.createElement("div");
    body.className = "card__body";
    var idx = document.createElement("span");
    idx.className = "card__index";
    idx.textContent = BS.pad(n);
    var status = document.createElement("span");
    status.className = "status";
    status.textContent = "Coming soon";
    idx.appendChild(status);

    var bottom = document.createElement("div");
    var h = titleNode("h3", "Coming soon", "soon");
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = "Story " + BS.pad(n) + ": ";
    h.prepend(sr);
    bottom.append(redaction(), h);
    body.append(idx, bottom);

    card.append(ambient, media, shade, body);

    // touch devices have no hover: a tap gives the same peek
    card.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      card.classList.add("is-glitching");
      setTimeout(function () { card.classList.remove("is-glitching"); }, 840);
    });
    return card;
  }

  function render(stories) {
    deck.textContent = "";
    stories.slice(0, 5).forEach(function (story, i) {
      var li = document.createElement("li");
      li.className = "deck__item";
      li.style.setProperty("--i", i);
      li.style.setProperty("--tilt", i % 2 ? 4.2 : -4.2);
      li.appendChild(story.status === "live" ? liveCard(story, i + 1) : soonCard(story, i + 1));
      deck.appendChild(li);
    });
    initStack();
  }

  /* As each card gets covered by the next one, it shrinks, tilts and dims. */
  function initStack() {
    if (BS.reduced()) return;
    var items = Array.prototype.slice.call(deck.children);
    var cards = items.map(function (li) { return li.firstElementChild; });
    var ticking = false;

    function update() {
      ticking = false;
      for (var i = 0; i < items.length - 1; i++) {
        var a = items[i].getBoundingClientRect();
        var b = items[i + 1].getBoundingClientRect();
        var h = cards[i].offsetHeight || 1;
        var p = Math.min(1, Math.max(0, (a.top + h - b.top) / h));
        cards[i].style.setProperty("--p", p.toFixed(3));
      }
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  BS.loadStories()
    .then(render)
    .catch(function (err) {
      console.error(err);
      deck.innerHTML = '<li class="library__note">Couldn\'t load the library. <a href="story.html?id=desert-arc">Read Desert Arc →</a></li>';
    })
    .then(function () { BS.observeReveals(); });

  document.addEventListener("bs:answer", function () {
    document.querySelectorAll(".card--soon").forEach(function (c, i) {
      setTimeout(function () {
        c.classList.add("is-glitching");
        setTimeout(function () { c.classList.remove("is-glitching"); }, 1260);
      }, i * 210);
    });
    BS.flock("Don't panic. You found the answer.");
  });
})();
