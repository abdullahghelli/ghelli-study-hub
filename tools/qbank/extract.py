"""Extract question and part positions from Edexcel past papers for the question bank.

For each question paper:
  - read words (pdfplumber; OCR via tesseract when a paper has no text layer)
  - find question starts ("N." at the left margin), parts "(a)", and "(Total for Question N is X marks)"
  - render pages and find where real content sits (text, diagrams, tables), skipping ruled answer lines
  - output segments [page, y0, y1] in PDF points (top-down) for each question and each part

Usage: python3 tools/qbank/extract.py <papers_dir> <out.json>
"""
import json, os, re, subprocess, sys, tempfile
import pdfplumber
from PIL import Image
import numpy as np

DPI = 100
K = DPI / 72.0
QNUM = re.compile(r"^(\d{1,2})(\.?)$")
PART = re.compile(r"^\(([a-h])\)$")
TOTAL = re.compile(r"\(Total for Question (\d+) is (\d+) marks?\)", re.I)
MARK = re.compile(r"^\((\d{1,2})\)$")


def page_words(pdf_path, pdf, pn, ocr_dir):
    pg = pdf.pages[pn]
    W, H = float(pg.width), float(pg.height)
    words = []
    for w in pg.extract_words(extra_attrs=["fontname"], keep_blank_chars=False):
        if "Myriad" in w["fontname"]:  # rotated "DO NOT WRITE IN THIS AREA" margin text
            continue
        words.append(dict(text=w["text"], x0=w["x0"], x1=w["x1"], top=w["top"], bottom=w["bottom"],
                          bold="Bold" in w["fontname"]))
    if sum(1 for w in words if re.search(r"[a-z]{3,}", w["text"])) < 5 and ocr_dir:
        # no usable text layer: OCR the page
        png = os.path.join(ocr_dir, f"ocr-{pn + 1}.png")
        if not os.path.exists(png):
            subprocess.run(["pdftoppm", "-r", "200", "-f", str(pn + 1), "-l", str(pn + 1), "-png", "-singlefile", pdf_path, png[:-4]], check=True)
        import pytesseract
        d = pytesseract.image_to_data(Image.open(png), output_type=pytesseract.Output.DICT, config="--psm 4")
        s = 72.0 / 200
        words = []
        for i, t in enumerate(d["text"]):
            t = (t or "").strip()
            if not t:
                continue
            x, y, w, h = d["left"][i] * s, d["top"][i] * s, d["width"][i] * s, d["height"][i] * s
            words.append(dict(text=t, x0=x, x1=x + w, top=y, bottom=y + h, bold=False))
    return words, W, H


def in_body(w, W, H):
    return 0.05 * W < w["x0"] < 0.93 * W and 0.06 * H < w["top"] < 0.935 * H


def render_page(pdf_path, pn, tmp):
    out = os.path.join(tmp, f"r-{pn + 1}")
    subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-f", str(pn + 1), "-l", str(pn + 1), "-png", "-singlefile", pdf_path, out], check=True)
    return np.array(Image.open(out + ".png").convert("L"))


def content_rows(img, W, H, xl, xr):
    """Boolean per pixel-row: True where the page has real content (not blank, not a ruled answer line)."""
    h, w = img.shape
    x0, x1 = int(xl * K), int(xr * K)
    band = img[:, x0:x1] < 150
    ink = band.sum(axis=1)
    rows = ink > 0
    width = x1 - x0
    # answer lines: a row (or 1-3 rows) that is mostly one long dark run, with blank rows around it
    for y in range(h):
        if ink[y] > 0.45 * width:
            r = band[y]
            # longest run
            runs = np.diff(np.flatnonzero(np.diff(np.concatenate(([0], r.astype(np.int8), [0])))))[::2] if r.any() else []
            longest = max(runs) if len(runs) else 0
            above = band[max(0, y - 3):y].sum() < 0.05 * width * 3
            below = band[y + 1:y + 4].sum() < 0.05 * width * 3 or (y + 1 < h and ink[y + 1] > 0.45 * width)
            if longest > 0.45 * width and above and below:
                rows[y] = False
    # dotted answer lines (rows of evenly spaced dots spanning the width)
    for y in range(h):
        if rows[y] and ink[y] > 0.15 * width:
            r = band[y]
            idx = np.flatnonzero(r)
            if len(idx) and (idx[-1] - idx[0]) > 0.7 * width and ink[y] < 0.5 * width:
                gaps = np.diff(idx)
                if len(gaps) > 20 and np.median(gaps) > 2 and (gaps > 1).mean() > 0.6:
                    nb = band[max(0, y - 3):y].sum() + band[y + 1:y + 4].sum()
                    if nb < 0.04 * width * 6:
                        rows[y] = False
    return rows


def blocks_in(rows, y0, y1, gap_pt=16, pad_pt=5):
    """Merge content rows between y0..y1 (points) into blocks [(a,b)] in points."""
    a, b = int(y0 * K), int(min(y1 * K, len(rows)))
    out, start, last = [], None, None
    gap = gap_pt * K
    for y in range(a, b):
        if rows[y]:
            if start is None:
                start = y
            elif y - last > gap:
                out.append((start, last))
                start = y
            last = y
    if start is not None:
        out.append((start, last))
    res = []
    for s, e in out:
        if e - s < 4:  # specks
            continue
        res.append([max(y0, s / K - pad_pt), min(y1, e / K + pad_pt)])
    return res


def parse_paper(pdf_path):
    tmp = tempfile.mkdtemp()
    with pdfplumber.open(pdf_path) as pdf:
        n = len(pdf.pages)
        pages = []
        for pn in range(n):
            words, W, H = page_words(pdf_path, pdf, pn, tmp)
            words = [w for w in words if in_body(w, W, H) and "___" not in w["text"] and not re.fullmatch(r"[._…]{3,}", w["text"])]
            pages.append(dict(words=words, W=W, H=H))
    W, H = pages[1]["W"], pages[1]["H"]
    # question starts, parts, totals in reading order
    events = []
    for pn, p in enumerate(pages):
        lines = {}
        for w in p["words"]:
            lines.setdefault(round(w["top"] / 4), []).append(w)
        for key in sorted(lines):
            ws = sorted(lines[key], key=lambda w: w["x0"])
            first = ws[0]
            text = " ".join(w["text"] for w in ws)
            m = QNUM.match(first["text"])
            if m and first["x0"] < 0.135 * W and (m.group(2) or first["bold"]) and first["top"] < 0.9 * H:
                events.append(("q", int(m.group(1)), pn, first["top"], first["x0"]))
            mp = PART.match(first["text"])
            if mp and first["x0"] < 0.16 * W:
                events.append(("part", mp.group(1), pn, first["top"]))
            mt = TOTAL.search(text)
            if mt:
                events.append(("total", (int(mt.group(1)), int(mt.group(2))), pn, max(w["bottom"] for w in ws)))
            for w in ws:
                mm = MARK.match(w["text"])
                if mm and w["x0"] > 0.72 * W:
                    events.append(("mark", int(mm.group(1)), pn, w["top"]))
    events.sort(key=lambda e: (e[2], e[3]))
    qx = [e[4] for e in events if e[0] == "q"]
    xl = (min(qx) - 5) if qx else 0.092 * W
    mx = [w["x1"] for p in pages for w in p["words"] if MARK.match(w["text"]) and w["x0"] > 0.72 * W]
    xr = (max(mx) + 8) if mx else 0.905 * W
    # page content rows
    rows = {}
    def rows_for(pn):
        if pn not in rows:
            rows[pn] = content_rows(render_page(pdf_path, pn, tmp), W, H, xl + 6, xr - 2)
        return rows[pn]

    questions = []
    cur = None
    expected = 1
    last_end = (1, H * 0.06)
    for e in events:
        if e[0] == "total" and cur is None and e[1][0] == expected:
            # question number not found (e.g. OCR missed it): it starts where the previous question ended
            cur = dict(q=expected, start=last_end, parts=[], marks=None, part_marks=[])
            expected += 1
        if e[0] == "q" and e[1] == expected:
            if cur:
                cur["end"] = (e[2], e[3] - 2)
                questions.append(cur)
                last_end = cur["end"]
            cur = dict(q=e[1], start=(e[2], e[3] - 4), parts=[], marks=None, part_marks=[])
            expected += 1
        elif cur and e[0] == "part":
            if not cur["parts"] or e[1] > cur["parts"][-1][0]:
                cur["parts"].append((e[1], e[2], e[3] - 4))
        elif cur and e[0] == "mark":
            cur["part_marks"].append((e[2], e[3], e[1]))
        elif cur and e[0] == "total" and e[1][0] == cur["q"]:
            cur["marks"] = e[1][1]
            cur["end"] = (e[2], e[3] + 4)
            questions.append(cur)
            last_end = cur["end"]
            cur = None
    if cur:
        cur.setdefault("end", (len(pages) - 1, H * 0.915))
        questions.append(cur)
    # second pass: parts and marks inside each question's span
    for qd in questions:
        a0, b0 = qd["start"], qd["end"]
        inside = [e for e in events if (a0[0], a0[1]) <= (e[2], e[3]) <= (b0[0], b0[1])]
        parts = []
        for e in inside:
            if e[0] == "part" and (not parts or e[1] > parts[-1][0]):
                parts.append((e[1], e[2], e[3] - 4))
        qd["parts"] = parts
        qd["part_marks"] = [(e[2], e[3], e[1]) for e in inside if e[0] == "mark"]

    def segs(a, b):
        """Content segments from position a=(page,y) to b=(page,y)."""
        out = []
        for pn in range(a[0], b[0] + 1):
            y0 = a[1] if pn == a[0] else H * 0.08
            y1 = b[1] if pn == b[0] else H * 0.915
            if pn != a[0]:
                # skip the "Question N continued" header
                head = [w for w in pages[pn]["words"] if w["text"] == "continued" and w["top"] < H * 0.16]
                if head:
                    y0 = max(y0, head[0]["bottom"] + 2)
            for blk in blocks_in(rows_for(pn), y0, y1):
                out.append([pn + 1, round(blk[0], 1), round(blk[1], 1)])
        return out

    def text_between(a, b):
        t = []
        for pn in range(a[0], b[0] + 1):
            for w in pages[pn]["words"]:
                if (pn > a[0] or w["top"] >= a[1]) and (pn < b[0] or w["top"] < b[1]):
                    t.append(w["text"])
        return " ".join(t)

    def before(p1, p2):
        return (p1[0], p1[1]) <= (p2[0], p2[1])

    out = []
    for qd in questions:
        a, b = qd["start"], qd["end"]
        item = dict(q=qd["q"], marks=qd["marks"], segs=segs(a, b), text=text_between(a, b), parts=[])
        parts = qd["parts"]
        if len(parts) >= 2:
            stem_end = (parts[0][1], parts[0][2])
            item["stem"] = segs(a, stem_end)
            item["stem_text"] = text_between(a, stem_end)
            # A part runs from just after the previous part's last mark to just after its own last mark,
            # so lead-in lines between parts belong to the part they introduce.
            labels = [(pn, y) for (_, pn, y) in parts] + [b]
            bounds = []
            for i in range(len(parts)):
                la, lb = labels[i], labels[i + 1]
                ms = [(mp, my) for (mp, my, m) in qd["part_marks"] if before(la, (mp, my)) and before((mp, my), lb)]
                bounds.append((ms[-1][0], ms[-1][1] + 16) if ms and i + 1 < len(parts) else lb)
            for i, (label, pn, y) in enumerate(parts):
                pa = (pn, y) if i == 0 else bounds[i - 1]
                pb = bounds[i]
                mk = sum(m for (mp, my, m) in qd["part_marks"] if before((pn, y), (mp, my)) and before((mp, my), labels[i + 1]))
                item["parts"].append(dict(label=label, marks=mk or None, segs=segs(pa, pb), text=text_between(pa, pb)))
        out.append(item)
    return dict(W=W, H=H, x0=round(xl, 1), x1=round(xr, 1), pages=len(pages), questions=out)


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    only = sys.argv[3:] or None
    res = {}
    for f in sorted(os.listdir(src)):
        if "-qp-" not in f or (only and f not in only):
            continue
        r = parse_paper(os.path.join(src, f))
        res[f] = r
        print(f, len(r["questions"]), "questions", sum(1 for q in r["questions"] if q["marks"]), "with totals", file=sys.stderr)
    json.dump(res, open(dst, "w"), indent=1)
