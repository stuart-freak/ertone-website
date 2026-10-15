"""Render every page at desktop and phone width. Reports console errors, failed requests,
horizontal overflow and broken images. Saves screenshots for chosen pages.

    python3 tools/check.py preview [--shots out_dir] [--only index.html,services.html]
"""
import sys, os, http.server, threading, functools, json, argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("root")
ap.add_argument("--shots")
ap.add_argument("--only", default="")
ap.add_argument("--full", action="store_true")
a = ap.parse_args()
root = Path(a.root).resolve()
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
class Quiet(Handler.func):
    def log_message(self, *x): pass
    def translate_path(self, path):
        # mimic Vercel cleanUrls: /services/injection-moulding serves services/injection-moulding.html
        p = super().translate_path(path)
        if not os.path.splitext(p)[1] and not os.path.isdir(p) and os.path.exists(p + ".html"):
            return p + ".html"
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "index.html")):
            return os.path.join(p, "index.html")
        return p
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(root)))
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
pages = sorted(str(p.relative_to(root)) for p in root.rglob("*.html"))
only = [x for x in a.only.split(",") if x]
problems = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for vw, vh, tag in [(1440, 900, "desktop"), (390, 844, "phone")]:
        ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
        for pg in pages:
            if only and pg not in only and not a.full:
                if not a.shots: pass
            page = ctx.new_page()
            errs = []
            page.on("console", lambda m: errs.append("console " + m.type + " " + m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append("pageerror " + str(e)))
            page.on("requestfailed", lambda r: errs.append("failed " + r.url))
            page.on("response", lambda r: errs.append(f"http {r.status} {r.url}") if r.status >= 400 else None)
            page.goto(f"http://127.0.0.1:{port}/{pg}", wait_until="networkidle")
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(150)
            info = page.evaluate("""() => {
              const over = document.documentElement.scrollWidth - window.innerWidth;
              const bad = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map(i => i.src);
              const wide = over > 1 ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0,5).map(e => e.tagName + '.' + e.className) : [];
              return {over, bad, wide};
            }""")
            if info["over"] > 1:
                errs.append(f"overflow {info['over']}px {info['wide']}")
            if info["bad"]:
                errs.append(f"broken images {info['bad']}")
            if errs:
                problems.append((tag, pg, errs))
            if a.shots and (not only or pg in only):
                os.makedirs(a.shots, exist_ok=True)
                page.evaluate("document.documentElement.style.scrollBehavior='auto';document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in'));document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')")
                page.wait_for_load_state("networkidle")
                page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
                page.wait_for_timeout(300)
                page.screenshot(path=f"{a.shots}/{tag}-{pg.replace('/', '_').replace('.html','')}.png", full_page=True)
            page.close()
        ctx.close()
    b.close()
print(f"Checked {len(pages)} pages at 1440 and 390.")
for t, p, e in problems:
    print(t, p)
    for x in e[:6]:
        print("   ", x)
print("OK" if not problems else f"{len(problems)} page views with problems")
