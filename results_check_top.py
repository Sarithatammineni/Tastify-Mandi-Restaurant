import numpy as np
from PIL import Image, ImageEnhance, ImageOps

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
im = Image.open(src).convert('RGB')

# Crop suspect regions. Try top-right (where site logo usually sits) and bottom-left/right corners.
crops = {
    'topright': (700, 0, 1200, 250),
    'topleft': (0, 0, 500, 250),
    'bottomright': (700, 950, 1200, 1200),
    'bottomleft': (0, 950, 500, 1200),
    'band_top': (0, 0, 1200, 120),
    'band_bottom': (0, 1080, 1200, 1200),
}
for name, box in crops.items():
    c = im.crop(box)
    c = c.resize((c.width*2, c.height*2), Image.LANCZOS)
    # Dark curve: multiply luminance down
    d = ImageEnhance.Brightness(c).enhance(0.45)
    d = ImageEnhance.Contrast(d).enhance(1.7)
    d.save(rf'results\suspect_{name}_dark.png')
    # Bright curve: multiply up to reveal dark watermark on dark bg
    b = ImageEnhance.Brightness(c).enhance(1.6)
    b = ImageEnhance.Contrast(b).enhance(1.5)
    b.save(rf'results\suspect_{name}_bright.png')
print('ok')
