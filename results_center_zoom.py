from PIL import Image

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
im = Image.open(src).convert('RGB')

# Center 2x zoom (watermarks usually sit center)
c = im.crop((300, 300, 900, 900)).resize((1200, 1200), Image.LANCZOS)
c.save(r'results\center_2x.png')

# Mid strips at native res
im.crop((0, 500, 600, 700)).resize((1200, 400), Image.LANCZOS).save(r'results\mid_left_2x.png')
im.crop((600, 500, 1200, 700)).resize((1200, 400), Image.LANCZOS).save(r'results\mid_right_2x.png')
print('ok')
