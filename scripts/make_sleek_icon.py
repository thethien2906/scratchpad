import os
from PIL import Image, ImageDraw, ImageFont

def create_sleek_icon():
    # Render at 1024x1024 with supersampling for crisp anti-aliasing
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Outer rounded container
    pad = 64
    radius = 200
    # Dark container
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=radius,
        fill=(22, 22, 24, 255),
        outline=(48, 48, 52, 255),
        width=8
    )

    # 2. Sleek Minimalist "E" / Notebook lines monogram
    # Spine vertical bar
    spine_x0 = 310
    spine_x1 = 370
    top_y = 310
    bot_y = 714
    draw.rounded_rectangle([spine_x0, top_y, spine_x1, bot_y], radius=24, fill=(240, 240, 242, 255))

    # Top horizontal bar
    draw.rounded_rectangle([spine_x0, top_y, 714, top_y + 60], radius=24, fill=(240, 240, 242, 255))

    # Middle horizontal bar (shorter, minimalist note style)
    mid_y = (top_y + bot_y) // 2 - 30
    draw.rounded_rectangle([spine_x0, mid_y, 600, mid_y + 60], radius=24, fill=(180, 180, 185, 255))

    # Bottom horizontal bar
    draw.rounded_rectangle([spine_x0, bot_y - 60, 714, bot_y], radius=24, fill=(240, 240, 242, 255))

    # Small refined accent dot on top right
    dot_r = 18
    dot_cx = 690
    dot_cy = mid_y + 30
    draw.ellipse([dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r], fill=(120, 120, 130, 255))

    # Save to different target sizes
    os.makedirs('src-tauri/icons', exist_ok=True)

    sizes = {
        '32x32.png': 32,
        '128x128.png': 128,
        '128x128@2x.png': 256,
        'icon.png': 512,
        'Square30x30Logo.png': 30,
        'Square44x44Logo.png': 44,
        'Square71x71Logo.png': 71,
        'Square89x89Logo.png': 89,
        'Square107x107Logo.png': 107,
        'Square142x142Logo.png': 142,
        'Square150x150Logo.png': 150,
        'Square284x284Logo.png': 284,
        'Square310x310Logo.png': 310,
        'StoreLogo.png': 50,
    }

    for filename, s in sizes.items():
        resized = img.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join('src-tauri/icons', filename), 'PNG')

    # ICO and ICNS
    ico_img = img.resize((256, 256), Image.Resampling.LANCZOS)
    ico_img.save('src-tauri/icons/icon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
    
    # Save 512x512 as icon.icns placeholder
    icns_img = img.resize((512, 512), Image.Resampling.LANCZOS)
    icns_img.save('src-tauri/icons/icon.icns', 'PNG')

    print("High-resolution minimalist dark icons generated successfully!")

if __name__ == '__main__':
    create_sleek_icon()
