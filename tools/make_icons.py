"""Малює PNG-іконки застосунку (ті самі форми, що й icons/icon.svg).

python -I tools/make_icons.py icons
"""
import os
import sys
from PIL import Image, ImageDraw

BG = (0x98, 0x58, 0x2D, 255)
FG = (0xFF, 0xF4, 0xE4, 255)


def cubic(p0, p1, p2, p3, steps=40):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        pts.append((mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
                    mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def book_paths():
    # Відкрита книга: контур, корінець і промені світла
    outline = (cubic((256, 196), (214, 170), (164, 162), (112, 168)) + [(112, 352)]
               + cubic((112, 352), (164, 346), (214, 354), (256, 380))
               + cubic((256, 380), (298, 354), (348, 346), (400, 352)) + [(400, 168)]
               + cubic((400, 168), (348, 162), (298, 170), (256, 196)))
    return [outline, [(256, 196), (256, 380)], [(256, 84), (256, 122)], [(188, 104), (206, 136)], [(324, 104), (306, 136)]]


def draw(size, maskable=False):
    scale = 4
    s = 512 * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BG)
        k, off = 0.78, 512 * (1 - 0.78) / 2  # вміст у безпечній зоні
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=116 * scale, fill=BG)
        k, off = 1.0, 0
    w = int(22 * scale * k)
    for path in book_paths():
        pts = [((x * k + off) * scale, (y * k + off) * scale) for x, y in path]
        d.line(pts, fill=FG, width=w, joint='curve')
        r = w / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=FG)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    draw(192).save(os.path.join(out, 'icon-192.png'))
    draw(512).save(os.path.join(out, 'icon-512.png'))
    draw(512, maskable=True).save(os.path.join(out, 'icon-maskable-512.png'))
    print('ok')
