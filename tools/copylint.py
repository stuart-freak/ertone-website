"""Check visible copy on built pages against the house style.
No semicolons, colons, em or en dashes, Oxford commas, ampersands in prose, American spellings,
and hyphens only where needed. Prints each finding with the page so it can be fixed in the content.

    python3 tools/copylint.py public
"""
import re, sys
from html.parser import HTMLParser
from pathlib import Path

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.out = []
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "svg", "code", "pre"): self.skip += 1
        a = dict(attrs)
        for k in ("alt", "placeholder", "aria-label", "title"):
            if a.get(k): self.out.append(a[k])
    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg", "code", "pre"): self.skip -= 1
    def handle_data(self, d):
        if not self.skip and d.strip(): self.out.append(d.strip())

US = r"\b(color|colors|center|centers|organization|organize|optimize|optimized|customize|customized|recognized|analyze|favorite|behavior|aluminum|gray|license[ds]?|catalog)\b"
ALLOWED_HYPHEN = {"e-mail"}
rules = [
    ("semicolon", re.compile(r";")),
    ("colon", re.compile(r"(?<!\d):(?!\d)|:$")),
    ("dash", re.compile(r"[—–]")),
    ("oxford comma", re.compile(r"\w+, [\w ]+, (and|or) ")),
    ("ampersand", re.compile(r"&")),
    ("US spelling", re.compile(US, re.I)),
    ("hyphen", re.compile(r"\b[A-Za-z]+-[A-Za-z]+\b")),
]
root = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
found = {}
for f in sorted(root.rglob("*.html")):
    t = Text(); t.feed(f.read_text())
    for s in t.out:
        if "@" in s or s.startswith("http") or "/" in s and " " not in s: continue
        for name, rx in rules:
            for m in rx.finditer(s):
                frag = m.group(0)
                if name == "hyphen" and frag.lower() in ALLOWED_HYPHEN: continue
                key = (name, s[:140])
                found.setdefault(key, set()).add(str(f.relative_to(root)))
for (name, s), pages in sorted(found.items()):
    print(f"[{name}] {s}  ({len(pages)} pages, e.g. {sorted(pages)[0]})")
print(f"{len(found)} findings")
