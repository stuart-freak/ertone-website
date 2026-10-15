import sys, glob
from PIL import Image
d = sys.argv[1]
for f in sorted(glob.glob(d + '/desktop-*.png')):
    im = Image.open(f).convert('RGB'); w, h = im.size; s = 720 / w; im = im.resize((720, int(h * s)))
    H = im.size[1]; n = (H + 1599) // 1600
    for i in range(n):
        im.crop((0, i * 1600, 720, min(H, (i + 1) * 1600))).save(f[:-4] + f'_v{i}.jpg', quality=72)
for f in sorted(glob.glob(d + '/phone-*.png')):
    im = Image.open(f).convert('RGB'); w, h = im.size; seg = 2400; n = (h + seg - 1) // seg
    c = Image.new('RGB', (n * (w + 10), seg), 'white')
    for i in range(n): c.paste(im.crop((0, i * seg, w, min(h, (i + 1) * seg))), (i * (w + 10), 0))
    c = c.resize((c.size[0] // 2, seg // 2)); c.save(f[:-4] + '_strip.jpg', quality=72)
