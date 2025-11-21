"""
Convert images in `images/` to optimized variants and write a manifest.
Generates:
 - images/optimized/{name}-1600.webp
 - images/optimized/{name}-900.webp
 - images/optimized/{name}-placeholder.jpg  (tiny blurred placeholder)
Also writes images/optimized/manifest.json mapping originals to generated files.

Usage: python tools/convert_images.py
"""
from PIL import Image, ImageFilter
import os
import json

ROOT = os.path.dirname(os.path.dirname(__file__))
IMG_DIR = os.path.join(ROOT, 'images')
OUT_DIR = os.path.join(IMG_DIR, 'optimized')
MANIFEST_PATH = os.path.join(OUT_DIR, 'manifest.json')

SIZES = {
    '1600': 1600,
    '900': 900,
}
PLACEHOLDER_SIZE = 40

QUALITY = 80

os.makedirs(OUT_DIR, exist_ok=True)

# Load list from images.json if present, else list JPG files
images_json = os.path.join(ROOT, 'images.json')
if os.path.exists(images_json):
    with open(images_json, 'r', encoding='utf-8') as f:
        files = json.load(f)
else:
    files = [f for f in os.listdir(IMG_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

manifest = {}

for fname in files:
    src = os.path.join(IMG_DIR, fname)
    name, ext = os.path.splitext(fname)
    entry = {}
    try:
        with Image.open(src) as im:
            im = im.convert('RGB')
            w, h = im.size
            max_edge = max(w, h)

            for label, target in SIZES.items():
                # compute scale
                if max_edge <= target:
                    resized = im.copy()
                else:
                    scale = target / float(max_edge)
                    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
                    resized = im.resize(new_size, Image.LANCZOS)

                out_name = f"{name}-{label}.webp"
                out_path = os.path.join(OUT_DIR, out_name)
                resized.save(out_path, 'WEBP', quality=QUALITY, method=6)
                entry[label] = os.path.relpath(out_path, ROOT).replace('\\', '/')

            # placeholder: small, slightly blurred jpg for quick LQIP
            ph = im.copy()
            if max_edge > PLACEHOLDER_SIZE:
                scale = PLACEHOLDER_SIZE / float(max_edge)
                new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
                ph = ph.resize(new_size, Image.LANCZOS)
            ph = ph.filter(ImageFilter.GaussianBlur(radius=1))
            ph_name = f"{name}-placeholder.jpg"
            ph_path = os.path.join(OUT_DIR, ph_name)
            ph.save(ph_path, 'JPEG', quality=30, optimize=True)
            entry['placeholder'] = os.path.relpath(ph_path, ROOT).replace('\\', '/')

            manifest[fname] = entry
            print(f"Converted {fname} -> {', '.join(entry.values())}")

    except Exception as e:
        print(f"Failed to convert {fname}: {e}")

with open(MANIFEST_PATH, 'w', encoding='utf-8') as mf:
    json.dump(manifest, mf, indent=2)

print('\nWrote manifest to', MANIFEST_PATH)
