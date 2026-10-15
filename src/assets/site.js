/* Ertone website script. No framework, no build step beyond the upload helper. */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");
  var body = document.body;
  var PREVIEW = body.hasAttribute("data-preview");
  var ROOT = body.getAttribute("data-root") || "/";

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

  /* ---------- exclusive accordions ---------- */
  $all("[data-exclusive]").forEach(function (group) {
    var items = $all("details", group);
    items.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) items.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  });

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

  /* ---------- reveal on scroll ---------- */
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    $all(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    $all(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }
})();
