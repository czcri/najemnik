# Vygeneruje ikony aplikace (domek s mincí). Spuštění: python nastroje/ikony.py
from PIL import Image, ImageDraw
from pathlib import Path

CIL = Path(__file__).resolve().parent.parent / 'app' / 'ikony'
MODRA, BILA, ZLATA = (31, 95, 139), (255, 255, 255), (242, 178, 51)

def ikona(velikost, maskable):
    s = 4 * velikost  # kreslit větší a zmenšit = hladké hrany
    img = Image.new('RGBA', (s, s), MODRA if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=MODRA)
    m = 0.2 if maskable else 0.14  # bezpečná zóna pro maskable
    u = lambda x: s * (m + (1 - 2 * m) * x)
    d.polygon([(u(0.5), u(0.08)), (u(0.95), u(0.47)), (u(0.05), u(0.47))], fill=BILA)
    d.rectangle([u(0.17), u(0.45), u(0.83), u(0.92)], fill=BILA)
    d.ellipse([u(0.33), u(0.52), u(0.67), u(0.86)], fill=ZLATA)
    d.rectangle([u(0.47), u(0.6), u(0.53), u(0.78)], fill=BILA)
    return img.resize((velikost, velikost), Image.LANCZOS)

CIL.mkdir(parents=True, exist_ok=True)
ikona(192, False).save(CIL / 'ikona-192.png')
ikona(512, False).save(CIL / 'ikona-512.png')
ikona(512, True).save(CIL / 'ikona-maskable-512.png')
print('ok')
