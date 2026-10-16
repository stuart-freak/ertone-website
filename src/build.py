#!/usr/bin/env python3
"""Build the Ertone website into public/.

    python3 src/build.py            production build (clean URLs, all image sizes)
    python3 src/build.py --preview  self contained preview with relative .html links, written to preview/
    python3 src/build.py --strict   production build that fails if anything is still marked to confirm

Content lives in src/content/*.json and src/content/news/*.md. Templates are in src/templates.
Images are read from src/img-src/*.png and written as WebP at several widths.
"""
import argparse, datetime, html, json, math, os, re, shutil, subprocess, sys
from pathlib import Path

import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
CONTENT = SRC / "content"

ap = argparse.ArgumentParser()
ap.add_argument("--preview", action="store_true")
ap.add_argument("--strict", action="store_true")
args = ap.parse_args()
PREVIEW = args.preview
OUT = ROOT / ("preview" if PREVIEW else "public")

site = json.loads((CONTENT / "site.json").read_text())
services = json.loads((CONTENT / "services.json").read_text())
sectors = json.loads((CONTENT / "sectors.json").read_text())
pages = json.loads((CONTENT / "pages.json").read_text())
news = json.loads((CONTENT / "news.json").read_text())
SITE = site["url"].rstrip("/")
svc_by = {s["slug"]: s for s in services}
sec_by = {s["slug"]: s for s in sectors}
TODAY = datetime.date.today().isoformat()
warnings = []

# ------------------------------------------------------------------ output folder
if OUT.exists():
    for p in OUT.iterdir():
        if p.name in ("img",):  # keep generated images between builds
            continue
        shutil.rmtree(p) if p.is_dir() else p.unlink()
OUT.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------ images
WIDTHS = [800, 1600] if PREVIEW else [480, 800, 1200, 1600, 2400]
IMG = {}
(OUT / "img").mkdir(exist_ok=True)
for src in sorted(p for p in (SRC / "img-src").iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")):
    name = src.stem
    if name.startswith("_"):
        continue
    im = Image.open(src)
    W, H = im.size
    widths = [w for w in WIDTHS if w < W] + [min(W, WIDTHS[-1])]
    widths = sorted(set(widths))
    files = []
    for w in widths:
        dst = OUT / "img" / f"{name}-{w}.webp"
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            h = round(H * w / W)
            im.convert("RGB").resize((w, h), Image.LANCZOS).save(dst, "WEBP", quality=80, method=6)
        files.append((w, dst.name))
    IMG[name] = {"w": W, "h": H, "files": files}
# remove stale image sizes from other modes
valid = {f for v in IMG.values() for _, f in v["files"]}
for p in (OUT / "img").glob("*.webp"):
    if p.name not in valid:
        p.unlink()

# brand images: logo png, favicon, share image
wm_svg = (SRC / "svg" / "wordmark.svg").read_text()
def brand_images():
    out = OUT / "img"
    logo = Image.open(SRC / "img-src" / "_logo-header.png").convert("RGB")
    logo.resize((584, 240), Image.LANCZOS).save(out / "ertone-logo.png", optimize=True)
    # favicon: gradient square with the E from the wordmark
    sq = 512
    grad = Image.new("RGB", (sq, sq))
    a, b = (0x42, 0xCC, 0xA2), (0x19, 0x5B, 0x9D)
    px = grad.load()
    for x in range(sq):
        t = x / (sq - 1)
        c = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
        for y in range(sq):
            px[x, y] = c
    src = logo
    E = src.crop((136, 177, 273, 422))  # the E glyph in the source logo
    mask = E.convert("L").point(lambda v: 255 if v > 215 else 0)
    scale = 300 / mask.size[1]
    mask = mask.resize((round(mask.size[0] * scale), 300), Image.LANCZOS)
    white = Image.new("RGB", mask.size, (255, 255, 255))
    grad.paste(white, ((sq - mask.size[0]) // 2, (sq - mask.size[1]) // 2), mask)
    grad.save(out / "icon-512.png", optimize=True)
    grad.resize((180, 180), Image.LANCZOS).save(out / "apple-touch-icon.png", optimize=True)
    grad.resize((32, 32), Image.LANCZOS).save(OUT / "favicon.png", optimize=True)
    grad.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # share image
    hero = Image.open(SRC / "img-src" / "hero-home.jpg").convert("RGB")
    hero = ImageOps.fit(hero, (1200, 630), Image.LANCZOS, centering=(0.65, 0.5))
    shade = Image.new("RGB", (1200, 630), (0, 0, 0))
    hero = Image.blend(hero, shade, 0.45)
    d = ImageDraw.Draw(hero)
    hero.paste(logo.resize((292, 120), Image.LANCZOS), (60, 60))
    try:
        f1 = ImageFont.truetype("/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf", 84)
        f2 = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 34)
    except Exception:
        f1 = f2 = ImageFont.load_default()
    d.text((60, 350), "INJECTION MOULDING.", font=f1, fill=(245, 245, 245))
    d.text((62, 460), "UK based since 1982. Aylesbury, Buckinghamshire.", font=f2, fill=(182, 227, 213))
    hero.save(out / "share.jpg", quality=86)
brand_images()

# ------------------------------------------------------------------ helpers
CURRENT = {"path": "/"}

def out_file(path):
    if path == "/":
        return "index.html"
    return path.strip("/") + ".html"

def depth_prefix():
    f = out_file(CURRENT["path"])
    return "../" * f.count("/")

def u(path):
    """Link to a site path. Production keeps clean URLs, preview uses relative .html files."""
    if path.startswith(("http", "mailto:", "tel:", "#")):
        return path
    frag = ""
    if "#" in path:
        path, frag = path.split("#", 1)
        frag = "#" + frag
    q = ""
    if "?" in path:
        path, q = path.split("?", 1)
        q = "?" + q
    if not PREVIEW:
        return (path or "/") + q + frag
    if path == "" and frag:
        return frag
    return depth_prefix() + out_file(path or "/") + q + frag

def asset(path):
    path = path.lstrip("/")
    return (depth_prefix() + path) if PREVIEW else "/" + path

def img(name, sizes="100vw", cls="", alt="", eager=False, fetch_high=False):
    if name not in IMG:
        warnings.append(f"missing image {name}")
        return Markup("")
    v = IMG[name]
    files = v["files"]
    srcset = ", ".join(f"{asset('img/' + f)} {w}w" for w, f in files)
    mid = files[min(len(files) - 1, 1)][1]
    attrs = [f'src="{asset("img/" + mid)}"', f'srcset="{srcset}"', f'sizes="{sizes}"', f'width="{v["w"]}"', f'height="{v["h"]}"', f'alt="{html.escape(alt)}"']
    if cls:
        attrs.append(f'class="{cls}"')
    attrs.append('loading="eager"' if eager else 'loading="lazy"')
    attrs.append('decoding="async"')
    if fetch_high:
        attrs.append('fetchpriority="high"')
    return Markup("<img " + " ".join(attrs) + ">")

def img_url(name, width=1600):
    v = IMG.get(name)
    if not v:
        return ""
    best = min(v["files"], key=lambda t: abs(t[0] - width))
    return SITE + "/img/" + best[1]

ICONS = {n: (SRC / "svg" / f"{n}.svg").read_text() for n in [p.stem for p in (SRC / "svg").glob("*.svg")]}
def icon(n):
    return Markup(ICONS.get(n, ""))

def jsonld(obj):
    return Markup('<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>")

def tel(p):
    return "tel:" + site["phone_e164"]

ORG = {
    "@type": ["Organization", "LocalBusiness"],
    "@id": SITE + "/#org",
    "name": site["legal_name"],
    "alternateName": site["name"],
    "url": SITE + "/",
    "logo": SITE + "/img/ertone-logo.png",
    "image": SITE + "/img/share.jpg",
    "description": site["description"],
    "email": site["email"],
    "telephone": "+44 1296 431482",
    "foundingDate": site["founded"],
    "address": {"@type": "PostalAddress", "streetAddress": site["address_lines"][0], "addressLocality": site["address_lines"][1], "addressRegion": site["address_lines"][2], "postalCode": site["address_lines"][3], "addressCountry": "GB"},
    "areaServed": "GB",
    "sameAs": [site["linkedin"]],
    "identifier": {"@type": "PropertyValue", "propertyID": "Companies House number", "value": site["company_number"]},
    "knowsAbout": ["Injection moulding", "Mould tool manufacture", "Plastic product design", "Printing, welding and assembly of moulded parts", "Plastic recycling"],
}
WEBSITE = {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": site["name"], "publisher": {"@id": SITE + "/#org"}, "inLanguage": "en-GB"}

def graph(path, title, description, crumbs=None, extra=None):
    url = SITE + ("/" if path == "/" else path)
    page = {"@type": "WebPage", "@id": url + "#page", "url": url, "name": title, "description": description, "isPartOf": {"@id": SITE + "/#website"}, "about": {"@id": SITE + "/#org"}, "inLanguage": "en-GB"}
    g = [ORG, WEBSITE, page]
    if crumbs:
        items = [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + (h if h != "/" else "/")} for i, (n, h) in enumerate([("Home", "/")] + crumbs)]
        g.append({"@type": "BreadcrumbList", "@id": url + "#crumbs", "itemListElement": items})
        page["breadcrumb"] = {"@id": url + "#crumbs"}
    for e in extra or []:
        g.append(e)
    return {"@context": "https://schema.org", "@graph": g}

def faq_ld(path, faqs):
    url = SITE + path
    return {"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [{"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in faqs]}

def sector_faqs(s):
    n = s["faq_noun"]
    return [
        {"q": f"What materials can Ertone mould for {n} parts?", "a": "We mould polycarbonate, polypropylene, polystyrene, ABS and nylon. The right polymer depends on how the part is used, so an engineer recommends one when reviewing your drawing."},
        {"q": "Do you hold ISO 9001 certification?", "a": "Yes. Ertone is ISO 9001 certified, and the certificate is available on the downloads page."},
        {"q": "Can you support low volume runs and prototypes?", "a": "Yes. We can supply prototype parts before tooling, then run low or high volumes from the production tool."},
        {"q": "What does the quote process involve?", "a": "Send a drawing, a sample or an idea. An engineer reviews it, then we send a quote with material and tooling recommendations."},
    ]

# ------------------------------------------------------------------ jinja
env = Environment(loader=FileSystemLoader(str(SRC / "templates")), autoescape=select_autoescape(["html"]), trim_blocks=True, lstrip_blocks=True)
env.globals.update(site=site, services=services, sectors=sectors, svc_by=svc_by, sec_by=sec_by, u=u, asset=asset, img=img, icon=icon, preview=PREVIEW, tel=tel, year=datetime.date.today().year, news=news)
def svc_cards(all=False):
    return [{"href": f"/services/{s['slug']}", "img": s["img"]["card"], "title": s["name"], "text": s["short"], "cta": "View service"} for s in services if all or s.get("tier") == "core"]
def sec_cards():
    return [{"href": f"/sectors/{s['slug']}", "img": s["img"]["card"], "title": s.get("card_name", s["name"]), "text": s["short"], "cta": "View sector"} for s in sectors]
def ordinal_date(d):
    n = d.day
    suf = "th" if 11 <= n % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf} {d.strftime('%b')} {d.year}"
HL_RULES = [
    (r"reprocess|in house|facility", "hl-factory"), (r"trial", "hl-gauge"), (r"transfer", "hl-transfer"),
    (r"volume|runs", "hl-volume"), (r"concept|drawing", "hl-flow"), (r"prototype", "hl-cube"), (r"fabricat", "hl-cube"),
    (r"design|advice", "hl-pencil"), (r"refine", "hl-sliders"), (r"print", "hl-print"), (r"weld|assembl", "hl-layers"),
    (r"pack|supplied|dispatch", "hl-box"), (r"collect", "hl-truck"), (r"repeat|again|reusable", "hl-repeat"),
    (r"quality|reliable", "hl-check"), (r"\blight", "hl-feather"), (r"tough|strong|durable", "hl-shield"),
    (r"precis", "hl-target"), (r"hygien", "hl-drop"), (r"tray|cover", "hl-tray"), (r"engineer", "hl-person"),
]
def hl_icon(title):
    t = title.lower()
    for rx, name in HL_RULES:
        if re.search(rx, t):
            return name
    return "hl-check"
env.globals.update(hl_icon=hl_icon, svc_cards=svc_cards, sec_cards=sec_cards, pages_home=pages["home"], closed_loop=svc_by["closed-loop-recycling"].get("loop"))
LEGAL_UPDATED = ordinal_date(datetime.date(2026, 10, 14))
env.filters["nl2br"] = lambda s: Markup("<br>".join(html.escape(x) for x in str(s).split("\n")))

SITEMAP = []
def render(path, template, title, description, ld=None, noindex=False, image=None, **ctx):
    CURRENT["path"] = path
    canonical = SITE + ("/" if path == "/" else path)
    t = env.get_template(template)
    html_out = t.render(path=path, title=title, description=description, canonical=canonical, ld=jsonld(ld) if ld else Markup(""), noindex=noindex or PREVIEW, share=image or (SITE + "/img/share.jpg"), **ctx)
    f = OUT / out_file(path)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(html_out)
    if not noindex and path != "/404":
        SITEMAP.append(canonical)

# ------------------------------------------------------------------ pages
P = pages
render("/", "home.html", "Ertone Website" if PREVIEW else P["home"]["title"], P["home"]["description"], graph("/", P["home"]["title"], P["home"]["description"]), page=P["home"])
render("/services", "services.html", P["services"]["title"], P["services"]["description"], graph("/services", P["services"]["title"], P["services"]["description"], [("Services", "/services")], [faq_ld("/services", site["faqs_moulding"])]), page=P["services"])
for s in services:
    path = f"/services/{s['slug']}"
    title = s.get("seo_title") or f"{s['name']} | Ertone"
    svc = {"@type": "Service", "@id": SITE + path + "#service", "name": s["name"], "description": s["meta_description"], "provider": {"@id": SITE + "/#org"}, "areaServed": "GB", "url": SITE + path, "image": img_url(s["img"]["hero"])}
    faqs = site["faqs_moulding"] if s.get("faqs") == "moulding" else []
    extra = [svc] + ([faq_ld(path, faqs)] if faqs else [])
    render(path, "service.html", title, s["meta_description"], graph(path, title, s["meta_description"], [("Services", "/services"), (s["name"], path)], extra), s=s, faqs=faqs, image=img_url(s["img"]["hero"], 1200))
render("/sectors", "sectors.html", P["sectors"]["title"], P["sectors"]["description"], graph("/sectors", P["sectors"]["title"], P["sectors"]["description"], [("Sectors", "/sectors")], [faq_ld("/sectors", P["sectors"]["faqs"])]), page=P["sectors"])
for s in sectors:
    # the product band shows only once every product image is in src/img-src
    s["products_ready"] = bool(s.get("products")) and all(p["img"] in IMG for p in s["products"])
    if s.get("products") and not s["products_ready"]:
        warnings.append(f"product images missing for {s['slug']}: " + ", ".join(p["img"] for p in s["products"] if p["img"] not in IMG))
    path = f"/sectors/{s['slug']}"
    title = s.get("seo_title") or f"{s['name']} | Ertone"
    faqs = sector_faqs(s)
    render(path, "sector.html", title, s["meta_description"], graph(path, title, s["meta_description"], [("Sectors", "/sectors"), (s["name"], path)], [faq_ld(path, faqs)]), s=s, faqs=faqs, image=img_url(s["img"]["hero"], 1200))

# news
md = markdown.Markdown(extensions=["extra", "sane_lists"])
articles = news["articles"]
for a in articles:
    a["pending"] = not a.get("body_file")
    if not a["pending"]:
        raw = (CONTENT / "news" / a["body_file"]).read_text()
        a["raw"] = raw if a["body_file"].endswith(".html") else md.reset().convert(raw)
    if a.get("date"):
        a["date_label"] = ordinal_date(datetime.date.fromisoformat(a["date"]))
render("/news", "news.html", P["news"]["title"], P["news"]["description"], graph("/news", P["news"]["title"], P["news"]["description"], [("News", "/news")]), page=P["news"], articles=articles, categories=news["categories"])
for i, a in enumerate(articles):
    path = f"/news/{a['slug']}"
    title = a["title"] + " | Ertone"
    art = {"@type": "Article", "@id": SITE + path + "#article", "headline": a["title"][:110], "description": a["excerpt"], "image": img_url(a["img"], 1200), "author": {"@id": SITE + "/#org"}, "publisher": {"@id": SITE + "/#org"}, "mainEntityOfPage": {"@id": SITE + path + "#page"}, "inLanguage": "en-GB"}
    if a.get("date"):
        art["datePublished"] = a["date"]
    related = [x for x in articles if x is not a and x["category"] == a["category"]][:3]
    if len(related) < 3:
        related += [x for x in articles if x is not a and x not in related][: 3 - len(related)]
    CURRENT["path"] = path
    body = Markup(a["raw"].replace('src="/img/news/', 'src="' + asset("img/news/"))) if not a["pending"] else None
    render(path, "article.html", title, a["excerpt"], graph(path, title, a["excerpt"], [("News", "/news"), (a["title"], path)], [art]), a=a, body=body, related=related, image=img_url(a["img"], 1200), og_type="article")
    if a["pending"]:
        warnings.append(f"article body pending: {a['slug']}")

render("/about", "about.html", P["about"]["title"], P["about"]["description"], graph("/about", P["about"]["title"], P["about"]["description"], [("About", "/about")]), page=P["about"])
render("/contact", "contact.html", P["contact"]["title"], P["contact"]["description"], graph("/contact", P["contact"]["title"], P["contact"]["description"], [("Contact", "/contact")]), page=P["contact"])
dl_items = []
for it in P["downloads"]["items"]:
    it = dict(it)
    it["available"] = bool(it.get("file")) and (SRC / "downloads" / Path(it["file"]).name).exists()
    if it.get("file") and not it["available"]:
        warnings.append(f"download file missing: {it['file']}")
    dl_items.append(it)
render("/downloads", "downloads.html", P["downloads"]["title"], P["downloads"]["description"], graph("/downloads", P["downloads"]["title"], P["downloads"]["description"], [("Downloads", "/downloads")]), page=P["downloads"], items=dl_items)
render("/quote", "quote.html", P["quote"]["title"], P["quote"]["description"], graph("/quote", P["quote"]["title"], P["quote"]["description"], [("Request a quote", "/quote")], [faq_ld("/quote", site["faqs_moulding"])]), page=P["quote"])
render("/thank-you", "thanks.html", P["thanks"]["title"], "Thank you for your enquiry.", None, noindex=True, page=P["thanks"])
for slug, ttl in [("privacy", "Privacy Policy"), ("cookies", "Cookie Policy"), ("terms", "Terms and Conditions")]:
    render(f"/{slug}", f"legal-{slug}.html", f"{ttl} | Ertone", f"{ttl} for the Ertone Plastics website.", graph(f"/{slug}", ttl, ttl, [(ttl, f"/{slug}")]), heading=ttl, updated=LEGAL_UPDATED)
render("/404", "404.html", "Page not found | Ertone", "This page could not be found.", None, noindex=True)

# hero video
if (SRC / "video").exists():
    shutil.copytree(SRC / "video", OUT / "video", dirs_exist_ok=True)

# article images imported from WordPress
if (SRC / "news-img").exists():
    shutil.copytree(SRC / "news-img", OUT / "img" / "news", dirs_exist_ok=True)

# downloads folder
dl_src = SRC / "downloads"
if dl_src.exists():
    shutil.copytree(dl_src, OUT / "downloads", dirs_exist_ok=True)

# ------------------------------------------------------------------ assets
(OUT / "assets").mkdir(exist_ok=True)
shutil.copy(SRC / "assets" / "site.css", OUT / "assets" / "site.css")
shutil.copy(SRC / "assets" / "site.js", OUT / "assets" / "site.js")
shutil.copytree(SRC / "fonts", OUT / "assets" / "fonts", dirs_exist_ok=True)
if not PREVIEW:
    esb = ROOT / "node_modules" / ".bin" / "esbuild"
    if esb.exists():
        subprocess.run([str(esb), str(SRC / "assets" / "upload-entry.js"), "--bundle", "--format=esm", "--minify", "--target=es2019", f"--outfile={OUT / 'assets' / 'upload.js'}", "--log-level=warning"], check=True)
    else:
        warnings.append("esbuild not installed, upload.js not rebuilt")

# ------------------------------------------------------------------ search and AI files
if not PREVIEW:
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc in SITEMAP:
        sm.append(f"  <url><loc>{loc}</loc><lastmod>{TODAY}</lastmod></url>")
    sm.append("</urlset>")
    (OUT / "sitemap.xml").write_text("\n".join(sm) + "\n")
    bots = ["*", "Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Applebot", "Google-Extended"]
    (OUT / "robots.txt").write_text(
        "# Search engines and AI assistants are welcome to read this site.\n"
        + "".join(f"User-agent: {b}\nAllow: /\nDisallow: /api/\nDisallow: /thank-you\n\n" for b in bots)
        + f"Sitemap: {SITE}/sitemap.xml\n"
    )
    L = [f"# {site['legal_name']}", "", f"> {site['description']}", "",
         f"Ertone Plastics Ltd is an ISO 9001 certified injection moulding company at {site['address_one_line']}, established in {site['founded']} (Companies House {site['company_number']}). Phone {site['phone']}, email {site['email']}.",
         "", "Key facts. Billion and Haitian presses from 100 to 600 tonnes with robot arms, parts from 1 gram to 4 kilograms, materials PC, PP, GPPS, ABS and nylon, high quality clear parts, tool transfer, design and prototyping, printing, welding, assembly and packing, and a closed loop recycling system with free collection. Supplier to the largest UK airlines for over 30 years.", "",
         "## Services"]
    for s in services:
        if s.get("tier") == "core":
            L.append(f"- [{s['name']}]({SITE}/services/{s['slug']}): {s['short']}")
    L += ["", "## Also available"]
    for s in services:
        if s.get("tier") != "core":
            L.append(f"- [{s['name']}]({SITE}/services/{s['slug']}): {s['short']}")
    L += ["", "## Sectors"]
    for s in sectors:
        L.append(f"- [{s['name']}]({SITE}/sectors/{s['slug']}): {s['short']}")
    L += ["", "## Guides"]
    for a in articles:
        L.append(f"- [{a['title']}]({SITE}/news/{a['slug']}): {a['excerpt']}")
    L += ["", "## Company", f"- [About]({SITE}/about)", f"- [Contact]({SITE}/contact)", f"- [Request a quote]({SITE}/quote)", f"- [Downloads]({SITE}/downloads)"]
    (OUT / "llms.txt").write_text("\n".join(L) + "\n")

# ------------------------------------------------------------------ checks
built = {str(p.relative_to(OUT)) for p in OUT.rglob("*.html")}
broken = []
for p in OUT.rglob("*.html"):
    text = p.read_text()
    for href in re.findall(r'href="([^"#?]+)', text):
        if href.startswith(("http", "mailto:", "tel:", "data:")):
            continue
        if PREVIEW:
            target = (p.parent / href).resolve()
            try:
                rel = str(target.relative_to(OUT.resolve()))
            except ValueError:
                broken.append((str(p.relative_to(OUT)), href)); continue
            if not (OUT / rel).exists():
                broken.append((str(p.relative_to(OUT)), href))
        else:
            if href.startswith("/assets/") or href.startswith("/img/") or href.startswith("/downloads/") or href.endswith((".png", ".ico", ".xml", ".txt", ".webmanifest")):
                continue
            f = out_file(href.rstrip("/") or "/")
            if f not in built:
                broken.append((str(p.relative_to(OUT)), href))
broken = [b for b in broken if "/downloads/" not in b[1] and "downloads/" not in b[1]]
if broken:
    print("BROKEN LINKS:")
    for b in sorted(set(broken)):
        print("  ", b)
    sys.exit(1)

print(f"Built {len(built)} pages into {OUT.relative_to(ROOT)} ({'preview' if PREVIEW else 'production'}). {len(IMG)} images.")
if warnings:
    uniq = sorted(set(warnings))
    print(f"{len(uniq)} items still to confirm:")
    for w in uniq:
        print("  -", w)
    if args.strict:
        sys.exit(2)
