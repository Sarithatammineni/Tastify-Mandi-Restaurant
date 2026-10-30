import numpy as np
import cv2

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
img = cv2.imdecode(np.fromfile(src, dtype=np.uint8), cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# MSER: good at low-contrast text
mser = cv2.MSER_create(delta=5, min_area=30, max_area=8000)
regions, bboxes = mser.detectRegions(gray)
print('MSER regions:', len(regions))
# Group into horizontal lines (text lines)
boxes = [cv2.boundingRect(r) for r in regions]
boxes = [b for b in boxes if 10 < b[3] < 150 and b[2] < 300]
# cluster boxes that share similar y (within 12px) and are horizontally close
lines = []
for x, y, w, h in sorted(boxes, key=lambda b: (b[1], b[0])):
    placed = False
    for L in lines:
        if abs(L['y'] - y) < 14 and (x - L['x1']) < 120 and x >= L['x0'] - 120:
            L['x0'] = min(L['x0'], x); L['x1'] = max(L['x1'], x + w)
            L['y'] = (L['y'] + y) // 2
            L['n'] += 1
            placed = True
            break
    if not placed:
        lines.append({'x0': x, 'x1': x + w, 'y': y, 'n': 1})
lines = [L for L in lines if L['n'] >= 3]
print('text-line candidates (>=3 glyph regions):', len(lines))
for L in lines[:30]:
    print('   ', L)

# Color residual: watermark text often tinted differently
b_, g_, r_ = cv2.split(img.astype(np.float32))
for name, ch in [('R', r_), ('G', g_), ('B', b_)]:
    hp = ch - cv2.GaussianBlur(ch, (0, 0), 15)
    print(name, 'hp std:', round(float(hp.std()), 2))

vis = img.copy()
for L in lines:
    cv2.rectangle(vis, (L['x0'] - 5, L['y'] - 15), (L['x1'] + 5, L['y'] + 25), (0, 0, 255), 2)
cv2.imencode('.png', vis)[1].tofile(r'results\mser_lines.png')
print('saved results/mser_lines.png')
