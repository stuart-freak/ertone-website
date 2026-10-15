#!/usr/bin/env python3
"""Import article text from a WordPress export into the new site.

    python3 tools/import_wordpress.py ertone.WordPress.2026-10-20.xml [--no-images]

For every article in src/content/news.json whose slug appears in the export, this writes the body
to src/content/news/<slug>.html, sets body_file and date in news.json, and downloads images used in
the article into src/news-img/ so they do not depend on the old site. Images are rewritten to
/img/news/<file>. Run the build afterwards.
"""
import json, re, sys, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEWS = ROOT / "src" / "content" / "news.json"
OUT = ROOT / "src" / "content" / "news"
IMG = ROOT / "src" / "news-img"
NS = {"content": "http://purl.org/rss/1.0/modules/content/", "wp": "http://wordpress.org/export/1.2/"}

def clean(html):
    html = re.sub(r"<!--\s*/?wp:.*?-->", "", html, flags=re.S)
    html = re.sub(r'\s(class|style|id|data-[\w-]+)="[^"]*"', "", html)
    html = re.sub(r"<(/?)h1>", r"<\1h2>", html)
    html = re.sub(r"<span>(.*?)</span>", r"\1", html, flags=re.S)
    html = re.sub(r"\n{3,}", "\n\n", html)
    # WordPress stores paragraphs as blank lines when the classic editor was used
    if "<p" not in html:
        html = "".join(f"<p>{p.strip()}</p>\n" for p in re.split(r"\n\s*\n", html) if p.strip())
    return html.strip()

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fetch = "--no-images" not in sys.argv
    data = json.loads(NEWS.read_text())
    wanted = {a["slug"]: a for a in data["articles"]}
    tree = ET.parse(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)
    found = 0
    for item in tree.getroot().iter("item"):
        slug = (item.findtext("wp:post_name", namespaces=NS) or "").strip()
        if slug not in wanted or (item.findtext("wp:status", namespaces=NS) or "") != "publish":
            continue
        body = clean(item.findtext("content:encoded", namespaces=NS) or "")
        n = 0
        for src in sorted(set(re.findall(r'<img[^>]+src="([^"]+)"', body))):
            n += 1
            ext = Path(src.split("?")[0]).suffix.lower() or ".jpg"
            name = f"{slug[:60]}-{n}{ext}"
            if fetch:
                try:
                    (IMG / name).write_bytes(urllib.request.urlopen(src, timeout=30).read())
                except Exception as e:
                    print(f"  could not download {src}: {e}")
                    continue
            body = body.replace(src, f"/img/news/{name}")
        body = re.sub(r'\s(srcset|sizes|width|height|loading|decoding)="[^"]*"', "", body)
        body = re.sub(r"<img(?![^>]*\balt=)", '<img alt=""', body)
        body = body.replace("<img ", '<img loading="lazy" ')
        (OUT / f"{slug}.html").write_text(body + "\n")
        a = wanted[slug]
        a["body_file"] = f"{slug}.html"
        a["date"] = (item.findtext("wp:post_date", namespaces=NS) or "")[:10]
        found += 1
        print(f"imported {slug} ({n} images)")
    NEWS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    missing = [s for s, a in wanted.items() if not a.get("body_file")]
    print(f"{found} articles imported. {len(missing)} still missing" + (": " + ", ".join(missing) if missing else "."))

if __name__ == "__main__":
    main()
