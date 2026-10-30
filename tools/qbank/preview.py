"""Stitch a question's segments into one image for checking. Usage: preview.py data.json paper.pdf q [part] out.png"""
import json, subprocess, sys, os, tempfile
from PIL import Image
d = json.load(open(sys.argv[1])); f = sys.argv[2]; q = int(sys.argv[3]); part = sys.argv[4] if len(sys.argv) > 5 else None; out = sys.argv[-1]
r = d[f]; qd = [x for x in r["questions"] if x["q"] == q][0]
segs = qd["segs"] if not part else qd["stem"] + [p for p in qd["parts"] if p["label"] == part][0]["segs"]
dpi = 90; k = dpi / 72; tmp = tempfile.mkdtemp(); src = os.path.join("files/a-level/edexcel/maths/papers", f)
ims = []
for pg, y0, y1 in segs:
    png = os.path.join(tmp, f"p{pg}")
    if not os.path.exists(png + ".png"):
        subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(pg), "-l", str(pg), "-png", "-singlefile", src, png], check=True)
    im = Image.open(png + ".png")
    ims.append(im.crop((int(0.092 * r["W"] * k), int(y0 * k), int(0.905 * r["W"] * k), int(y1 * k))))
W = max(i.width for i in ims); H = sum(i.height for i in ims) + 6 * len(ims)
c = Image.new("RGB", (W, H), "#ccc"); y = 0
for i in ims: c.paste(i, (0, y)); y += i.height + 6
c.save(out)
