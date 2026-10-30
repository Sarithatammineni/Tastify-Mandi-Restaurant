import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

src = sys.argv[1]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)

f = 1
small = a if f == 1 else np.asarray(Image.fromarray(a.astype('uint8')).resize((im.width//f, im.height//f), Image.LANCZOS)).astype(int)
blur = np.asarray(Image.fromarray(small.astype('uint8')).filter(ImageFilter.GaussianBlur(15))).astype(int)
res = small - blur
amp = np.abs(res).max(axis=2)
lum = 0.299*small[:,:,0] + 0.587*small[:,:,1] + 0.114*small[:,:,2]
H, W = amp.shape
print('grid', W, 'x', H, 'scale', f)

# Watermark is faint text ON the food AND background — visually obvious borders.
# But text watermark is usually darker than surrounding pixels or lighter.
# Let's target the region where the watermark is likely: header strip 0..100
# with threshold on amp
for thr in (10, 20, 30, 40, 50, 60, 80):
    band = amp[0:120]
    print('thr', thr, 'high-px in band 0-120:', int((band > thr).sum()), 'of', band.size)
for thr in (10, 20, 30, 40, 50, 60, 80):
    band = amp[1080:1200]
    print('thr', thr, 'high-px in band 1080-1200:', int((band > thr).sum()), 'of', band.size)
