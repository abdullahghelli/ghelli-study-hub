"""extract.py for Cambridge International papers: marks are "[2]", question totals "[Total: 12]",
multiple-choice questions have no totals (each runs to the next question, the last one stops at the
periodic table, a blank page or the copyright notice), and some papers' text needs shifting back.
Words come from pdftotext, which places them correctly (papers from late 2024 on embed their text so that
pdfplumber misplaces it, and pdfplumber drops the totals in some 2021-22 papers); papers whose text is shifted
use pdfplumber, which decodes them font by font.

Usage: python3 tools/qbank/extract_caie.py <papers_dir> <out.json> [file ...]
"""
import json, os, re, subprocess, sys
from html import unescape
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract as E

E.MARK = re.compile(r"^\[(\d{1,2})\]$")
E.TOTAL = re.compile(r"\[Total()\s*:?\s*(\d+)\]", re.I)
E.STOP = re.compile(r"BLANK PAGE|The Periodic Table of Elements|Permission to reproduce|Important values, constants", re.I)
E.SHIFTED = True
E.LOOSE_QNUM = True

_plumber_words = E.page_words
_bbox = {}


def bbox_words(pdf_path, pn):
    if pdf_path not in _bbox:
        out = subprocess.run(["pdftotext", "-bbox", pdf_path, "-"], capture_output=True, text=True).stdout
        pages = []
        for page in re.findall(r"<page[^>]*>(.*?)</page>", out, re.S):
            ws = []
            for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', page):
                a, b, c, d = float(a), float(b), float(c), float(d)
                # older papers set "1<tab>Atoms" as one word: split it (the number at the left, the text at the right)
                bits = [x for x in (re.sub(r"[\x00-\x08\x0b-\x1f]", "", y) for y in unescape(t).split("\t")) if x]
                if len(bits) == 2:
                    ws.append(dict(text=bits[0], x0=a, top=b, x1=a + 6 * len(bits[0]), bottom=d, bold=False))
                    ws.append(dict(text=bits[1], x0=max(a + 6 * len(bits[0]) + 10, c - 5.6 * len(bits[1])), top=b, x1=c, bottom=d, bold=False))
                elif bits:
                    ws.append(dict(text=" ".join(bits), x0=a, top=b, x1=c, bottom=d, bold=False))
            pages.append(ws)
        _bbox[pdf_path] = pages
    return _bbox[pdf_path][pn]


def page_words(pdf_path, pdf, pn, ocr_dir):
    pg = pdf.pages[pn]
    # pdftotext places words reliably and reads every font; pdfplumber is only needed for the few papers whose
    # text is shifted (it decodes those font by font, see extract.py)
    first = " ".join(w["text"] for w in bbox_words(pdf_path, 0))
    if "&DPEULGJH" not in first:
        W, H = float(pg.width), float(pg.height)
        # drop the rotated "DO NOT WRITE IN THIS MARGIN" text down the right edge
        return [w for w in bbox_words(pdf_path, pn) if w["x0"] < 0.93 * W], W, H
    return _plumber_words(pdf_path, pdf, pn, ocr_dir)


E.page_words = page_words

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    only = sys.argv[3:] or None
    res = {}
    for f in sorted(os.listdir(src)):
        if "-qp-" not in f or (only and f not in only):
            continue
        r = E.parse_paper(os.path.join(src, f))
        res[f] = r
        print(f, len(r["questions"]), "questions", sum(1 for q in r["questions"] if q["marks"]), "with totals", file=sys.stderr)
    json.dump(res, open(dst, "w"), indent=1)
