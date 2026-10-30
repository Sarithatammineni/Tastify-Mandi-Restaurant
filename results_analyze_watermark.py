from PIL import Image, ImageEnhance, ImageOps
from PIL import ImageFilter

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
im = Image.open(src).convert('RGB')
w, h = im.size

# Slices: 3x3 grid enlarged 3x with boosted contrast & brightness-down to reveal faint light watermarks
for gy in range(3):
    for gx in range(3):
        box = (gx*w//3, gy*h//3, (gx+1)*w//3, (gy+1)*h//3)
        c = im.crop(box)
        c = c.resize((c.width*3, c.height*3), Image.LANCZOS)
        # gamma dark to bring out white-ish overlays
        g = ImageEnhance.Brightness(c).enhance(0.6)
        g = ImageEnhance.Contrast(g).enhance(1.6)
        g.save(rf'results\slice_{gy}{gx}_dark.png')
        # gamma bright to bring out dark watermarks
        g2 = ImageEnhance.Brightness(c).enhance(1.4)
        g2 = ImageEnhance.Contrast(g2).enhance(1.4)
        g2.save(rf'results\slice_{gy}{gx}_bright.png')
print('ok')
