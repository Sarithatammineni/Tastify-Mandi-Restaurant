import numpy as np
import cv2

import sys
src = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
out_prefix = sys.argv[2] if len(sys.argv) > 2 else 'clahe'
img = cv2.imdecode(np.fromfile(src, dtype=np.uint8), cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# CLAHE reveals faint semi-transparent text overlays
clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
enh = clahe.apply(gray)

# Edge map — watermark text has strong, consistent stroke edges
edges = cv2.Canny(enh, 40, 120)
# Dilate to group strokes
k = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3))  # horizontal grouping
grp = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, k)
grp = cv2.dilate(grp, np.ones((3, 3), np.uint8))

cnts, _ = cv2.findContours(grp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hits = []
for c in cnts:
    x, y, w, h = cv2.boundingRect(c)
    # Text-line-like: wide, short-ish
    if w > 90 and 14 < h < 130 and cv2.contourArea(c) > 400:
        hits.append((x, y, w, h, int(cv2.contourArea(c))))
hits.sort(key=lambda b: -b[4])
print('text-line-like regions:', len(hits))
for b in hits[:25]:
    print('   ', b)

# Save visualization: draw boxes on CLAHE image
vis = cv2.cvtColor(enh, cv2.COLOR_GRAY2BGR)
for x, y, w, h, _ in hits:
    cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 0, 255), 3)
cv2.imencode('.png', vis)[1].tofile(rf'results\{out_prefix}_boxes.png')
cv2.imencode('.png', enh)[1].tofile(rf'results\{out_prefix}_full.png')
print(f'saved results/{out_prefix}_boxes.png, results/{out_prefix}_full.png')
