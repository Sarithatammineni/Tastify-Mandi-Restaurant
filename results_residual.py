import numpy as np
import cv2
import sys

src = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
img = cv2.imdecode(np.fromfile(src, dtype=np.uint8), cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

# High-pass: subtract large-radius blur (removes photo content, keeps strokes/flat overlays)
for radius in (8, 20):
    blur = cv2.GaussianBlur(gray, (0, 0), radius)
    hp = gray - blur
    # amplify aggressively around midpoint
    vis = np.clip(128 + hp * 6, 0, 255).astype(np.uint8)
    out = rf'results\residual_{radius}.png'
    cv2.imencode('.png', vis)[1].tofile(out)
    # numeric: report strongest structured rows/cols
    print(radius, 'std:', round(float(hp.std()), 2), '->', out)

# Also split-screen: full image downscaled at 2x contrast for a holistic look
print('done')
