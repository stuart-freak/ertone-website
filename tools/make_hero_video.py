#!/usr/bin/env python3
"""Build src/video/hero-home.mp4 and .webm from src/video-src/v1.png to v5.png (see docs/VIDEO.md)."""
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src" / "video-src", ROOT / "src" / "video"
W, H, D, FPS, S = 1280, 720, 5, 25, 4
moves = [(1.00, 1.10, .5, .5, .5, .5), (1.10, 1.00, .6, .5, .4, .5), (1.00, 1.10, .6, .6, .5, .4), (1.06, 1.06, .25, .5, .75, .5), (1.10, 1.00, .5, .4, .5, .5)]
files = [f"v{i}.png" for i in range(1, 6)] + ["v1.png"]
inputs, parts, chain = [], [], []
for i, f in enumerate(files):
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", str(D if i < 5 else 1), "-i", str(SRC / f)]
    z0, z1, x0, y0, x1, y1 = moves[i] if i < 5 else (moves[0][0], moves[0][0], .5, .5, .5, .5)
    n = D * FPS if i < 5 else FPS
    z = f"({z0}+({z1}-{z0})*(n/{n}))"
    cw, ch = f"(iw/{z})", f"(ih/{z})"
    x = f"(iw-{cw})*({x0}+({x1}-{x0})*(n/{n}))"
    y = f"(ih-{ch})*({y0}+({y1}-{y0})*(n/{n}))"
    parts.append(f"[{i}:v]scale={W*S}:{H*S}:flags=bicubic,crop=w='{cw}':h='{ch}':x='{x}':y='{y}',scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p[c{i}]")
prev, off = "c0", D - 1
for i in range(1, 6):
    chain.append(f"[{prev}][c{i}]xfade=transition=fade:duration=1:offset={off}[x{i}]")
    prev = f"x{i}"
    off += (D - 1) if i < 5 else 0
base = ["ffmpeg", "-y", "-loglevel", "error"] + inputs + ["-filter_complex", ";".join(parts + chain), "-map", f"[{prev}]", "-r", str(FPS), "-an"]
OUT.mkdir(exist_ok=True)
subprocess.run(base + ["-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / "hero-home.mp4")], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(OUT / "hero-home.mp4"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-an", str(OUT / "hero-home.webm")], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(SRC / "v1.png"), "-vf", f"scale={W}:-2", "-q:v", "4", str(OUT / "hero-home-poster.jpg")], check=True)
print("hero video written to", OUT)
