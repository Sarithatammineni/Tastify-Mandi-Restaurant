from PIL import Image, ImageEnhance

src = r'C:\Users\tammi\AppData\Local\Temp\freebuff-desktop-pastes\paste-1791560275772-13760.png'
im = Image.open(src).convert('RGB')
w, h = im.size

boxes = [(0, 0, 600, 600), (600, 0, 1200, 600), (0, 600, 600, 1200), (600, 600, 1200, 1200)]
crops = []
for box in boxes:
    c = im.crop(box).resize((500, 500), Image.LANCZOS)
    # two variants side by side: dark-boosted (reveals light text) and bright-boosted (reveals dark text)
    d = ImageEnhance.Contrast(ImageEnhance.Brightness(c).enhance(0.4)).enhance(1.8)
    b = ImageEnhance.Contrast(ImageEnhance.Brightness(c).enhance(1.7)).enhance(1.5)
    crops.append((d, b))

grid = Image.new('RGB', (1000, 2000), (20, 20, 20))
for i, (d, b) in enumerate(crops):
    grid.paste(d, (0, i * 500))
    grid.paste(b, (500, i * 500))
grid.save(r'results\corners_grid.png')
print('ok rows: TL TR BL BR — left col dark-boost, right col bright-boost')
