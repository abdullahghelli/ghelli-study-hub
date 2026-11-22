"""Add where each part of a question starts in its mark scheme, so a worksheet that keeps only some parts can show
only their mark scheme rows.

For every item with "parts" and a mark scheme position (msPage, msY), the mark scheme's left-hand "Question" column
is read from the question's start to the next question's start. Labels such as "3(b)", "3 (b)", "(b)" or "3(b)(ii)"
mark where a part starts. Each part gets  mp: [page, y]  (y a fraction of the page height as seen, like msY), but
only when every part of the question is found, once each, in order: otherwise the question is left as it is and a
worksheet shows its whole mark scheme.

Usage: python3 tools/qbank/add_ms_parts.py bank.json [bank.json ...]
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_caie import bbox_words

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LABEL = re.compile(r"(?:(\d{1,2})\s*)?\(([a-z])\)(?:\(.*)?")
_sizes = {}


def sizes(path):
    if path not in _sizes:
        with pdfplumber.open(path) as pdf:
            _sizes[path] = [(float(p.width), float(p.height)) for p in pdf.pages]
    return _sizes[path]


def labels(path, q, start, end):
    """Part labels in the left column between start and end ((page, y fraction)), in reading order."""
    out = []
    sz = sizes(path)
    for pn in range(start[0], min(end[0], len(sz)) + 1):
        W, H = sz[pn - 1]
        ws = bbox_words(path, pn - 1)
        # a label split into two words ("3" then "(b)") is put back together
        ws = sorted((w for w in ws if w["x0"] < 0.22 * W and 0.04 * H < w["top"] < 0.96 * H), key=lambda w: (round(w["top"]), w["x0"]))
        for k, w in enumerate(ws):
            y = w["top"] / H
            if (pn == start[0] and y < start[1] - 0.005) or (pn == end[0] and y >= end[1] - 0.002):
                continue
            t = w["text"]
            if re.fullmatch(r"\d{1,2}", t) and k + 1 < len(ws) and abs(ws[k + 1]["top"] - w["top"]) < 3:
                continue   # the number; its "(b)" follows
            m = LABEL.fullmatch(t)
            if not m or (m.group(1) and int(m.group(1)) != q):
                continue
            out.append((m.group(2), pn, round(max(0, w["top"] - 6) / H, 4)))
    return out


def main():
    for bank in sys.argv[1:]:
        d = json.load(open(bank))
        by_ms = {}
        for it in d["items"]:
            if it.get("ms") and it.get("msPage") and not it["part"]:
                by_ms.setdefault(it["ms"], []).append(it)
        done = tried = 0
        for it in d["items"]:
            for p in it.get("parts") or []:
                p.pop("mp", None)
            if not it.get("parts") or not it.get("ms") or not it.get("msPage"):
                continue
            tried += 1
            path = os.path.join(ROOT, it["ms"].lstrip("/"))
            if not os.path.exists(path):
                continue
            nxt = sorted((x for x in by_ms[it["ms"]] if x["q"] > it["q"]), key=lambda x: x["q"])
            end = (nxt[0]["msPage"], nxt[0]["msY"]) if nxt else (min(len(sizes(path)), it["msPage"] + 3), 1.0)
            found = labels(path, it["q"], (it["msPage"], it["msY"]), end)
            want, at, k = [p["l"] for p in it["parts"]], {}, 0
            # first sighting of each part, in order (a later "(a)" inside part (b)'s rows is ignored)
            for l, pn, y in found:
                if k < len(want) and l == want[k] and (not at or (pn, y) > at[want[k - 1]]):
                    at[l] = (pn, y); k += 1
            if k != len(want):
                continue
            for p in it["parts"]:
                p["mp"] = list(at[p["l"]])
            done += 1
        json.dump(d, open(bank, "w"), separators=(",", ":"))
        print(f"{bank}: mark scheme parts found for {done} of {tried} questions with parts")


if __name__ == "__main__":
    main()
