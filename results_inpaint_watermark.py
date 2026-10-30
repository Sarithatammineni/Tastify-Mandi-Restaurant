# Inpaints the "…nna Ang…" photographer watermark in the bottom-right corner.
# Usage: python results_inpaint_watermark.py <src> <dst> [x0 y0 x1 y1]
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
# default mask region = bottom-right corner where the watermark text sits
x0, y0, x1, y1 = (int(v) for v in sys.argv[3:7]) if len(sys.argv) > 6 else (540, 578, 600, 600)

img = cv2.imread(src)
h, w = img.shape[:2]
# clamp region to image bounds
x0, y0 = max(0, x0), max(0, y0)
x1, y1 = min(w, x1), min(h, y1)

region = img[y0:y1, x0:x1]
gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
# The watermark is lighter than its dark blurry background: threshold bright pixels.
blur = cv2.GaussianBlur(gray, (0, 0), 3)
diff = cv2.absdiff(gray, blur)  # catches text both lighter and darker than bg
_, mask_region = cv2.threshold(diff, 10, 255, cv2.THRESH_BINARY)
# close gaps inside glyphs, then dilate so inpaint eats the halo
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
mask_region = cv2.morphologyEx(mask_region, cv2.MORPH_CLOSE, k, iterations=2)
mask_region = cv2.dilate(mask_region, k, iterations=3)

mask = np.zeros((h, w), np.uint8)
mask[y0:y1, x0:x1] = mask_region
print(f"mask pixels: {int(mask.sum()/255)} of {(x1-x0)*(y1-y0)} in region")

result = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)
cv2.imwrite(dst, result)

# verification crops: same zoom window, before/after, autocontrast for visibility
crop_box = (max(0, x0 - 10), max(0, y0 - 10), w, h)
for tag, frame in (("before", img), ("after", result)):
    c = frame[crop_box[1]:crop_box[3], crop_box[0]:crop_box[2]]
    c = cv2.resize(c, None, fx=10, fy=10, interpolation=cv2.INTER_LANCZOS4)
    c = cv2.normalize(c, None, 0, 255, cv2.NORM_MINMAX)
    cv2.imwrite(f"results/wm_{tag}_zoom.png", c)
print(f"saved {dst} + results/wm_before_zoom.png + results/wm_after_zoom.png")
