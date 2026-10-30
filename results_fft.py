import numpy as np
import cv2

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
img = cv2.imdecode(np.fromfile(src, dtype=np.uint8), cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

# Tiled watermarks create strong off-center FFT peaks. Natural photos decay smoothly.
win = np.hanning(gray.shape[0])[:, None] * np.hanning(gray.shape[1])[None, :]
f = np.fft.fftshift(np.fft.fft2(gray * win))
mag = np.log1p(np.abs(f))

# Mask out the DC/low-frequency center (natural spectrum), find strongest peaks
cy, cx = np.array(mag.shape) // 2
Y, X = np.mgrid[0:mag.shape[0], 0:mag.shape[1]]
r = np.hypot(Y - cy, X - cx)
mag_masked = mag.copy()
mag_masked[r < 30] = 0  # ignore very low freq

idx = np.argsort(mag_masked.ravel())[::-1][:15]
print('top FFT peaks (dy, dx, mag) — repeated pattern => consistent small dy/dx:')
for i in idx:
    y, x = divmod(int(i), mag.shape[1])
    print(f'   dy={y-cy:+4d} dx={x-cx:+4d} mag={mag_masked[y, x]:.2f}')

# Also: check local-variance flatness map for soft overlays (low-freq watermark)
blur = cv2.GaussianBlur(gray, (0, 0), 25)
mean = cv2.GaussianBlur(gray, (0, 0), 25)
sq = cv2.GaussianBlur(gray ** 2, (0, 0), 25)
var = np.clip(sq - mean ** 2, 0, None)
print('var map: min', round(float(var.min()), 1), 'max', round(float(var.max()), 1))
# Save variance map visualized (flat watermark regions = dark blobs)
vm = cv2.normalize(var, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
cv2.imencode('.png', vm)[1].tofile(r'results\varmap.png')
print('saved results/varmap.png')
