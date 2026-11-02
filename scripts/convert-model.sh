#!/usr/bin/env bash
# Convert an FBX boat model into a small .glb for the web.
#
#   scripts/convert-model.sh <model.fbx> <textures-folder> <output.glb>
#
# Needs: assimp (apt install assimp-utils), python3 with Pillow, and npx.
# Keeps every node separate and named (the game rotates sails and rudders by name),
# shrinks textures to 512 px WebP and quantizes the geometry.
set -euo pipefail
src=$1; textures=$2; out=$3
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

assimp export "$src" "$work/model.gltf" -f gltf2 >/dev/null

# Texture paths in FBX files point at the author's computer: re-link them by file name,
# and shrink huge images (the tools below refuse very large ones).
python3 -I - "$work/model.gltf" "$textures" <<'PY'
import json, os, shutil, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
gltf, folder = sys.argv[1], sys.argv[2]
index = {f.lower(): os.path.join(d, f) for d, _, fs in os.walk(folder) for f in fs}
g = json.load(open(gltf)); out = os.path.dirname(gltf)
for im in g.get('images', []):
    name = im['uri'].replace('\\', '/').split('/')[-1]
    found = index.get(name.lower())
    if not found:
        print('missing texture:', name); continue
    dst = os.path.join(out, name); shutil.copy(found, dst); im['uri'] = name
    img = Image.open(dst)
    if max(img.size) > 2048:
        img.thumbnail((2048, 2048)); img.save(dst)
json.dump(g, open(gltf, 'w'))
PY

gt="npx --yes @gltf-transform/cli@4.5.1"
$gt copy "$work/model.gltf" "$work/a.glb"
$gt dedup "$work/a.glb" "$work/b.glb"
$gt prune "$work/b.glb" "$work/c.glb"
$gt weld "$work/c.glb" "$work/d.glb"
$gt resize "$work/d.glb" "$work/e.glb" --width 512 --height 512
$gt webp "$work/e.glb" "$work/f.glb" --quality 75
$gt quantize "$work/f.glb" "$out"
ls -lh "$out"
