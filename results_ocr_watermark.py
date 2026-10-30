import numpy as np
import cv2
from PIL import Image, ImageEnhance

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
img = cv2.imdecode(np.fromfile(src, dtype=np.uint8), cv2.IMREAD_COLOR)
h, w = img.shape[:2]

# top / bottom band crops rendered very large
for name, y0, y1 in [('top', 0, 130), ('btm', 1070, 1200)]:
    band = img[y0:y1]
    pil = Image.fromarray(cv2.cvtColor(band, cv2.COLOR_BGR2RGB))
    pil = pil.resize((pil.width*2, pil.height*2), Image.LANCZOS)
    # darken to reveal light overlay
    d = ImageEnhance.Brightness(pil).enhance(0.35)
    d = ImageEnhance.Contrast(d).enhance(1.8)
    d.save(rf'results\cvband_{name}_dark.png')
    b = ImageEnhance.Brightness(pil).enhance(1.7)
    b = ImageEnhance.Contrast(b).enhance(1.5)
    b.save(rf'results\cvband_{name}_bright.png')

# Render tophat and blackhat band images
tophat = cv2.imread(r'results\cv_tophat.png', cv2.IMREAD_GRAYSCALE)
bothat = cv2.imread(r'results\cv_bothat.png', cv2.IMREAD_GRAYSCALE)
for name, m in [('tophat', tophat), ('bothat', bothat)]:
    Image.fromarray(m[0:130]).resize((2400, 260), Image.LANCZOS).save(rf'results\hat_{name}_top.png')
    Image.fromarray(m[1070:1200]).resize((2400, 260), Image.LANCZOS).save(rf'results\hat_{name}_btm.png')
print('ok')
