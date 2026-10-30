from PIL import Image, ImageEnhance

# Grid: rows = region (topleft, topright, bottomleft, bottomright), cols = dark/bright variant
regions = ['topleft', 'topright', 'bottomleft', 'bottomright']
w = h = 500
grid = Image.new('RGB', (w * 2, h * 4), (15, 15, 15))
for i, r in enumerate(regions):
    for j, v in enumerate(['dark', 'bright']):
        c = Image.open(rf'results\suspect_{r}_{v}.png').resize((w, h), Image.LANCZOS)
        grid.paste(c, (j * w, i * h))
grid.save(r'results\suspects_grid.png')
print('ok rows: TL TR BL BR; left=dark right=bright')
