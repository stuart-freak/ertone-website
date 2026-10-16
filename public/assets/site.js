/* Ertone website script. No framework, no build step beyond the upload helper. */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");
  var body = document.body;
  var PREVIEW = body.hasAttribute("data-preview");
  var ROOT = body.getAttribute("data-root") || "/";
  // The head script adds .motion when the visitor has not asked for reduced motion.
  var MOTION = doc.classList.contains("motion") && "IntersectionObserver" in window;
  if (!MOTION) doc.classList.remove("motion");

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function pushEvent(name, data) {
    window.dataLayer = window.dataLayer || [];
    var o = { event: name };
    for (var k in data || {}) o[k] = data[k];
    window.dataLayer.push(o);
  }

  /* ---------- nav ---------- */
  var nav = $(".nav");
  var openItem = null;
  function closeMenus() {
    if (openItem) {
      openItem.classList.remove("is-open");
      var b = $(".nav__link", openItem);
      if (b) b.setAttribute("aria-expanded", "false");
      openItem = null;
    }
  }
  $all(".nav__item[data-menu]").forEach(function (item) {
    var btn = $(".nav__link", item);
    var hoverTimer;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var isOpen = item.classList.contains("is-open");
      closeMenus();
      if (!isOpen) { item.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); openItem = item; }
    });
    item.addEventListener("mouseenter", function () {
      if (!window.matchMedia("(hover: hover)").matches) return;
      clearTimeout(hoverTimer);
      if (openItem !== item) { closeMenus(); item.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); openItem = item; }
    });
    item.addEventListener("mouseleave", function () {
      if (!window.matchMedia("(hover: hover)").matches) return;
      hoverTimer = setTimeout(function () { if (openItem === item) closeMenus(); }, 180);
    });
  });
  document.addEventListener("click", function (e) { if (openItem && !openItem.contains(e.target)) closeMenus(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeMenus(); if (nav && nav.classList.contains("is-menu")) toggleMenu(false); }
  });
  var burger = $(".burger");
  function toggleMenu(force) {
    var on = typeof force === "boolean" ? force : !nav.classList.contains("is-menu");
    nav.classList.toggle("is-menu", on);
    burger.setAttribute("aria-expanded", on ? "true" : "false");
    body.style.overflow = on ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { toggleMenu(); });

  /* ---------- accordions: smooth open and close, one open at a time ---------- */
  var EASE = "cubic-bezier(.2,.7,.2,1)";
  function slide(d, open) {
    var sum = $("summary", d);
    var start = d.offsetHeight;
    if (d._anim) { d._anim.cancel(); d._anim = null; }
    var end;
    if (open) {
      d.classList.remove("is-closing");
      d.open = true;
      end = d.offsetHeight;
    } else {
      d.classList.add("is-closing");
      end = sum.offsetHeight + (d.offsetHeight - d.clientHeight);
    }
    d.style.overflow = "hidden";
    var a = d.animate([{ height: start + "px" }, { height: end + "px" }], { duration: open ? 460 : 340, easing: open ? EASE : "cubic-bezier(.7,0,.2,1)" });
    d._anim = a;
    a.onfinish = function () {
      d._anim = null;
      d.style.overflow = "";
      if (!open) { d.open = false; d.classList.remove("is-closing"); }
    };
    if (open) {
      var bodyEl = sum.nextElementSibling;
      if (bodyEl) bodyEl.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 60, easing: EASE, fill: "backwards" });
    }
  }
  $all("details.acc__item, details.faq__item").forEach(function (d) {
    var sum = $("summary", d);
    if (!sum) return;
    sum.addEventListener("click", function (e) {
      if (!MOTION) return;
      e.preventDefault();
      slide(d, !d.open || d.classList.contains("is-closing"));
    });
  });
  $all("[data-exclusive]").forEach(function (group) {
    var items = $all("details", group);
    items.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open || d.classList.contains("is-closing")) return;
        items.forEach(function (o) {
          if (o === d || !o.open || o.classList.contains("is-closing")) return;
          if (MOTION) slide(o, false); else o.open = false;
        });
      });
    });
  });

  /* ---------- home capabilities: the photo follows the open capability ---------- */
  var capImgs = $all(".cap__img img");
  if (capImgs.length > 1) {
    var capShown = 0;
    $all(".cap .acc__item").forEach(function (d, i) {
      d.addEventListener("toggle", function () {
        if (!d.open || d.classList.contains("is-closing") || i === capShown || !capImgs[i]) return;
        var prev = capImgs[capShown];
        prev.classList.remove("is-on"); prev.classList.add("was-on");
        capImgs[i].classList.add("is-on");
        capShown = i;
        setTimeout(function () { prev.classList.remove("was-on"); }, 950);
      });
    });
  }

  /* ---------- carousels ---------- */
  $all(".carousel").forEach(function (c) {
    var track = $(".carousel__track", c);
    var next = $(".carousel__btn--next", c);
    var prev = $(".carousel__btn--prev", c);
    if (!track || !next) return;
    function step() { var first = track.children[0]; if (!first) return 300; var gap = parseFloat(getComputedStyle(track).columnGap) || 24; return first.getBoundingClientRect().width + gap; }
    function update() {
      var max = track.scrollWidth - track.clientWidth - 4;
      next.disabled = track.scrollLeft >= max;
      if (prev) prev.disabled = track.scrollLeft <= 4;
      var img = $(".card__img", c);
      if (img) { var t = img.offsetTop + img.offsetHeight / 2 - 26; next.style.top = t + "px"; if (prev) prev.style.top = t + "px"; }
    }
    next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
    if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", update);
    update();
    setTimeout(update, 400);
  });

  /* ---------- news filters and load more ---------- */
  var grid = $("[data-articles]");
  if (grid) {
    var cards = $all(".article-card", grid);
    var pageSize = 9, shown = pageSize, current = "All";
    var more = $("[data-load-more]");
    function render() {
      var matching = cards.filter(function (a) { return current === "All" || a.getAttribute("data-cat") === current; });
      cards.forEach(function (a) { a.hidden = true; });
      matching.slice(0, shown).forEach(function (a) { a.hidden = false; });
      if (more) more.hidden = matching.length <= shown;
    }
    $all("[data-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        current = chip.getAttribute("data-filter");
        shown = pageSize;
        $all("[data-filter]").forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        render();
      });
    });
    if (more) more.addEventListener("click", function () { shown += pageSize; render(); });
    render();
  }

  /* ---------- forms ---------- */
  var MAX_INLINE = 3.5 * 1024 * 1024;
  var MAX_UPLOAD = 50 * 1024 * 1024;
  var ALLOWED = /\.(pdf|dwg|dxf|step|stp|iges|igs|stl|x_t|sldprt|jpg|jpeg|png|heic|zip)$/i;

  function setInvalid(field, msg) {
    field.classList.add("is-invalid");
    var err = $(".field__error", field);
    if (err && msg) err.textContent = msg;
  }
  function validate(form) {
    var ok = true;
    $all(".field", form).forEach(function (f) { f.classList.remove("is-invalid"); });
    $all("[required]", form).forEach(function (input) {
      var f = input.closest(".field");
      var v = (input.value || "").trim();
      if (!v) { ok = false; if (f) setInvalid(f, "Please fill this in."); }
      else if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { ok = false; if (f) setInvalid(f, "Please check the email address."); }
    });
    var file = $("input[type=file]", form);
    if (file && file.files && file.files[0]) {
      var fl = file.files[0], ff = file.closest(".field");
      if (!ALLOWED.test(fl.name)) { ok = false; setInvalid(ff, "Please attach a PDF, CAD file (DWG, DXF, STEP, IGES, STL), image or ZIP."); }
      else if (fl.size > MAX_UPLOAD) { ok = false; setInvalid(ff, "Files can be up to 50MB. For bigger files, email us and we will send a transfer link."); }
    }
    if (!ok) { var first = $(".is-invalid .input, .is-invalid input", form); if (first) first.focus(); }
    return ok;
  }
  function status(form, kind, msg) {
    var s = $(".form__status", form);
    if (!s) return;
    s.className = "form__status " + (kind ? "is-" + kind : "");
    s.textContent = msg || "";
  }
  function readAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function uploadToBlob(file, onProgress) {
    return import(ROOT + "assets/upload.js").then(function (m) { return m.uploadDrawing(file, onProgress); });
  }

  $all("form[data-form]").forEach(function (form) {
    var started = Date.now();
    var fileInput = $("input[type=file]", form);
    var fileBox = fileInput ? fileInput.closest(".file") : null;
    var fileLabel = fileBox ? $(".file__name", fileBox) : null;
    if (fileInput && fileBox) {
      fileInput.addEventListener("change", function () {
        var f = fileInput.files && fileInput.files[0];
        fileBox.classList.toggle("has-file", !!f);
        if (fileLabel) fileLabel.textContent = f ? f.name + " (" + Math.max(1, Math.round(f.size / 1024)) + " KB)" : fileLabel.getAttribute("data-empty");
      });
      ["dragenter", "dragover"].forEach(function (ev) { fileBox.addEventListener(ev, function () { fileBox.classList.add("is-drag"); }); });
      ["dragleave", "drop"].forEach(function (ev) { fileBox.addEventListener(ev, function () { fileBox.classList.remove("is-drag"); }); });
    }
    // preselect enquiry type from ?type=
    var typeSel = $("select[name=enquiry_type]", form);
    if (typeSel) {
      var q = new URLSearchParams(location.search).get("type");
      if (q) $all("option", typeSel).forEach(function (o) { if (o.value.toLowerCase() === q.toLowerCase()) typeSel.value = o.value; });
    }
    var svcSel = $("select[name=service]", form);
    if (svcSel) {
      var sq = new URLSearchParams(location.search).get("service");
      if (sq) $all("option", svcSel).forEach(function (o) { if (o.getAttribute("data-slug") === sq) svcSel.value = o.value; });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status(form, "", "");
      if (!validate(form)) { status(form, "error", "Please check the highlighted fields."); return; }
      var btn = $("button[type=submit]", form);
      btn.setAttribute("aria-busy", "true"); btn.disabled = true;
      var kind = form.getAttribute("data-form");
      var data = {};
      new FormData(form).forEach(function (v, k) { if (typeof v === "string") data[k] = v.trim(); });
      data.form = kind;
      data.page = location.pathname;
      data.referrer = document.referrer || "";
      data.elapsed_ms = Date.now() - started;
      var params = new URLSearchParams(location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"].forEach(function (k) { if (params.get(k)) data[k] = params.get(k); });
      try { var stored = JSON.parse(sessionStorage.getItem("ertone_utm") || "{}"); for (var k in stored) if (!data[k]) data[k] = stored[k]; } catch (err) {}
      var file = fileInput && fileInput.files && fileInput.files[0];
      var prog = $(".progress", form), bar = prog ? $("span", prog) : null;

      function done() {
        // Quote and contact conversions are counted on the thank you page, once per enquiry.
        if (PREVIEW || kind === "newsletter") pushEvent(kind === "newsletter" ? "newsletter_signup" : "enquiry_submitted", { form_type: kind });
        if (PREVIEW) {
          status(form, "ok", "Preview only. On the live site this sends the enquiry to Ertone's CRM and inbox, then shows the thank you page.");
          btn.removeAttribute("aria-busy"); btn.disabled = false; form.reset();
          if (fileBox) { fileBox.classList.remove("has-file"); if (fileLabel) fileLabel.textContent = fileLabel.getAttribute("data-empty"); }
          return;
        }
        if (kind === "newsletter") {
          status(form, "ok", "Thanks. You are on the list.");
          btn.removeAttribute("aria-busy"); btn.disabled = false; form.reset();
          return;
        }
        try { sessionStorage.setItem("ertone_sent", kind); } catch (err) {}
        location.href = "/thank-you?form=" + encodeURIComponent(kind);
      }
      function fail(msg) {
        btn.removeAttribute("aria-busy"); btn.disabled = false;
        if (prog) prog.classList.remove("is-on");
        status(form, "error", msg || "Sorry, that did not send. Please try again, or email " + body.getAttribute("data-email") + ".");
      }
      function send() {
        if (PREVIEW) { setTimeout(done, 500); return; }
        fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) { if (res.ok && res.j.ok) done(); else fail(res.j && res.j.error); })
          .catch(function () { fail(); });
      }

      if (!file || PREVIEW) { if (file) data.file_name = file.name; send(); return; }
      data.file_name = file.name; data.file_size = file.size; data.file_type = file.type || "";
      if (prog) prog.classList.add("is-on");
      uploadToBlob(file, function (pct) { if (bar) bar.style.width = pct + "%"; })
        .then(function (blob) { data.file_pathname = blob.pathname; data.file_url = blob.url; send(); })
        .catch(function () {
          if (file.size <= MAX_INLINE) {
            readAsBase64(file).then(function (b64) { data.file_base64 = b64; send(); }).catch(function () { fail(); });
          } else {
            fail("We could not upload that file. Please send the enquiry without it and email the drawing to " + body.getAttribute("data-email") + ".");
          }
        });
    });
  });

  /* remember campaign parameters for the session */
  try {
    var p = new URLSearchParams(location.search), keep = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"].forEach(function (k) { if (p.get(k)) keep[k] = p.get(k); });
    if (Object.keys(keep).length) sessionStorage.setItem("ertone_utm", JSON.stringify(keep));
  } catch (err) {}

  /* ---------- cookie consent ---------- */
  var cookie = $(".cookie");
  function getConsent() { try { return localStorage.getItem("ertone_consent"); } catch (e) { return null; } }
  function setConsent(v) {
    try { localStorage.setItem("ertone_consent", v); } catch (e) {}
    if (typeof window.gtag === "function") window.gtag("consent", "update", { analytics_storage: v === "all" ? "granted" : "denied", ad_storage: v === "all" ? "granted" : "denied", ad_user_data: v === "all" ? "granted" : "denied", ad_personalization: v === "all" ? "granted" : "denied" });
    if (cookie) cookie.classList.remove("is-open");
  }
  if (cookie) {
    if (!getConsent() && !PREVIEW) cookie.classList.add("is-open");
    $all("[data-consent]", cookie).forEach(function (b) { b.addEventListener("click", function () { setConsent(b.getAttribute("data-consent")); }); });
  }
  $all("[data-cookie-settings]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); if (cookie) cookie.classList.add("is-open"); }); });

  /* ---------- motion ---------- */
  // Keep REVEAL in step with the reveal list in site.css
  var REVEAL = ".heading-group, .wrap > .eyebrow, .also > .eyebrow, .split__text .prose, .split__img, .card, .lcard, .highlight, .fact, .cap__img, .acc__item, .faq__item, .chips > li, .product, .stats__bar, .stat-row > div, .numbers > div, .duo__panel, .person, .article-card, .featured, .dl, .quote__intro, .quote > .form, .form-panel, .contact__details, .map, .cta-panel, .banner, .process__head > p, .newsletter, .article-body, .article-hero, .loop-panel, .mould, .footer__col, .notice > *";

  function startMotion() {
    /* scroll reveals, staggered within each batch that arrives together */
    var pending = [];
    var rvIO = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.style.setProperty("--i", Math.min(k++, 7));
        el.classList.add("is-in");
        rvIO.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    $all(REVEAL).forEach(function (el) { rvIO.observe(el); pending.push(el); });
    // at the very bottom of the page, show anything still waiting
    window.addEventListener("scroll", function () {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      pending.forEach(function (el) { if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in"); });
    }, { passive: true });

    /* hero headlines rise word by word */
    $all(".hero h1").forEach(function (h) {
      var n = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var frag = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement("span"); w.className = "w";
              var inner = document.createElement("span"); inner.textContent = part; inner.style.setProperty("--wi", n++);
              w.appendChild(inner); frag.appendChild(w);
            });
            node.replaceChild(frag, c);
          } else if (c.nodeType === 1) walk(c);
        });
      })(h);
      h.classList.add("is-split");
    });

    /* odometer figures */
    var odoIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("odo-in"); odoIO.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    $all(".stat__value, .stat-row__value, .number__value").forEach(function (el) {
      var text = el.textContent.trim();
      if (/\d/.test(text)) {
        var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = text;
        var row = document.createElement("span"); row.className = "odo-row"; row.setAttribute("aria-hidden", "true");
        var k = 0;
        text.split("").forEach(function (ch) {
          var s = document.createElement("span");
          if (/\d/.test(ch)) {
            s.className = "odo";
            var reel = document.createElement("span"); reel.className = "odo__reel";
            reel.innerHTML = "0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9";
            reel.style.setProperty("--d", ch); reel.style.setProperty("--k", k++);
            s.appendChild(reel);
          } else { s.className = "odo-s"; s.textContent = ch; }
          row.appendChild(s);
        });
        el.textContent = "";
        el.appendChild(sr); el.appendChild(row);
        odoIO.observe(el);
      }
      el.classList.add("odo-ready");
    });

    /* process flow, closed loop: run once in view */
    var runIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add(en.target.classList.contains("flow") ? "is-run" : "is-in"); runIO.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -18% 0px" });
    $all(".flow, [data-loop]").forEach(function (el) { runIO.observe(el); });

    /* images fade in once loaded */
    $all('img[loading="lazy"]').forEach(function (im) {
      function ok() { im.classList.add("is-loaded"); }
      if (im.complete) ok(); else { im.addEventListener("load", ok, { once: true }); im.addEventListener("error", ok, { once: true }); }
    });

    /* menus: stagger the links */
    $all(".mega, .mobile-menu").forEach(function (menu) {
      Array.prototype.forEach.call(menu.children, function (c, i) { c.style.setProperty("--i", i); });
    });

    /* the bar tucks away on the way down and comes back on the way up */
    if (nav) {
      var lastY = window.scrollY, ticking = false;
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          var y = window.scrollY, dy = y - lastY;
          if (Math.abs(dy) < 8) return;
          var tuck = dy > 0 && y > 260 && !openItem && !nav.classList.contains("is-menu") && !nav.contains(document.activeElement);
          nav.classList.toggle("is-tucked", tuck);
          lastY = y;
        });
      }, { passive: true });
      nav.addEventListener("focusin", function () { nav.classList.remove("is-tucked"); });
    }
  }

  /* ---------- inside the tool: scroll runs one moulding cycle ---------- */
  function startMould() {
    var box = $("[data-mould]");
    if (!box) return;
    var svg = $("svg", box), melt = $(".m-melt", box), gB = $(".m-b", box), gEj = $(".m-ej", box), gPart = $(".m-part", box);
    var plastic = $all(".m-plastic", box), lMelt = $(".m-l-melt", box), lEj = $(".m-l-ej", box), lPart = $(".m-l-part", box);
    var steps = $all(".mould__steps li", box);
    function seg(p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); }
    function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    var HOT = [246, 194, 122], COOL = [182, 227, 213];
    function draw(p) {
      var inj = ease(seg(p, .04, .27)), cool = seg(p, .27, .38), open = ease(seg(p, .4, .6)), ej = ease(seg(p, .62, .74)), drop = ease(seg(p, .74, .88));
      melt.setAttribute("width", (180 * inj).toFixed(1));
      var col = "rgb(" + HOT.map(function (h, i) { return Math.round(h + (COOL[i] - h) * cool); }).join(",") + ")";
      plastic.forEach(function (el) { el.style.fill = col; });
      gB.setAttribute("transform", "translate(" + (300 * open).toFixed(1) + " 0)");
      gEj.setAttribute("transform", "translate(" + (-64 * ej).toFixed(1) + " 0)");
      gPart.setAttribute("transform", "translate(" + (300 * open - 64 * ej - 12 * drop).toFixed(1) + " " + (70 * drop).toFixed(1) + ") rotate(" + (-9 * drop).toFixed(2) + " 290 220)");
      lMelt.style.opacity = (Math.min(1, inj * 4) * (1 - cool)).toFixed(2);
      lEj.style.opacity = seg(p, .6, .66).toFixed(2);
      lPart.style.opacity = seg(p, .84, .9).toFixed(2);
      var active = p < .27 ? 0 : p < .39 ? 1 : p < .61 ? 2 : 3;
      steps.forEach(function (li, i) { li.classList.toggle("is-on", i === active); });
    }
    if (!MOTION) { draw(1); return; }
    var target = 0, cur = 0, raf = null;
    function tick() {
      cur += (target - cur) * .2;
      if (Math.abs(target - cur) < .0015) cur = target;
      draw(cur);
      raf = cur !== target ? window.requestAnimationFrame(tick) : null;
    }
    var track = box.parentNode, spacer = $(".mould-spacer", track);
    var stacked = window.matchMedia("(max-width: 900px)");
    var list = $(".mould__steps", box);
    var pinTop = 0;
    function layout() {
      // pin only when the whole panel fits on screen below the nav bar
      var vh = window.innerHeight, navH = nav ? nav.offsetHeight : 0, h = box.offsetHeight;
      var fits = !stacked.matches && h <= vh - navH - 32;
      track.classList.toggle("is-pinned", fits);
      pinTop = Math.max(navH + 12, Math.round((vh - h) / 2));
      track.style.setProperty("--mould-top", pinTop + "px");
    }
    function measure() {
      var vh = window.innerHeight, r;
      if (track.classList.contains("is-pinned")) {
        // the whole cycle plays while the panel is held in the middle of the screen
        r = track.getBoundingClientRect();
        target = Math.min(1, Math.max(0, (pinTop - r.top) / Math.max(1, spacer.offsetHeight)));
      } else if (stacked.matches && list) {
        // on phones the drawing stays pinned while the steps scroll underneath
        r = list.getBoundingClientRect();
        target = Math.min(1, Math.max(0, (vh * .85 - r.top) / Math.max(1, r.height)));
      } else {
        // short screens: run the cycle as the drawing crosses the middle of the screen
        r = svg.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        target = Math.min(1, Math.max(0, (vh * .8 - mid) / (vh * .5)));
      }
      if (!raf) raf = window.requestAnimationFrame(tick);
    }
    layout();
    window.addEventListener("resize", function () { layout(); measure(); });
    window.addEventListener("scroll", measure, { passive: true });
    draw(0);
    measure();
  }

  if (MOTION) {
    try { startMotion(); window.__ertoneMotion = true; }
    catch (err) { doc.classList.remove("motion"); MOTION = false; }
  }
  startMould();

  /* ---------- page transitions: a card's photo grows into the next page's hero ---------- */
  window.addEventListener("pageswap", function (e) {
    if (!e.viewTransition) return;
    var hero = $(".hero:not(.hero--home)");
    var url = e.activation && e.activation.entry && e.activation.entry.url;
    var pic = null;
    if (url) $all("a.card").some(function (a) {
      if (a.href !== url) return false;
      var r = a.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
      pic = $(".card__img", a);
      return !!pic;
    });
    if (pic) { if (hero) hero.style.viewTransitionName = "none"; pic.style.viewTransitionName = "hero-img"; }
    else if (hero && hero.getBoundingClientRect().bottom < 0) hero.style.viewTransitionName = "none";
  });
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    $all(".hero, .card__img").forEach(function (el) { if (el.style.viewTransitionName) el.style.viewTransitionName = ""; });
  });
})();
