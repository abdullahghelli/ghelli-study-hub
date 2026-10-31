"""Build the 9CH0 (Edexcel A Level Chemistry) question bank: assets/qbank/9ch0.json.

Every question is hand-checked against its mark scheme (overrides_9ch0.json):
  - topic: where the whole question goes (the latest topic, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier topic, also listed under that topic with the question's opening lines

Usage: python3 tools/qbank/build_ch.py extracted.json papers_dir out.json
  extracted.json comes from extract.py run over the 9CH0 question papers.
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_ch import TOPICS, GROUPS, NAMES

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jun": "June", "nov": "November"}
WEB = "/files/a-level/edexcel/chemistry/papers/"


def clean(text):
    t = re.sub(r"\*?P\d{5}[A-Z]?\d{0,6}\*?", " ", text or "")       # barcodes
    t = re.sub(r"\(cid:\d+\)", " ", t)
    t = re.sub(r"DO NOT WRITE IN THIS AREA", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def ms_pages(ms_path, nq):
    """Where each question and part starts in a mark scheme: {(q, part or None): (page, y fraction)}.
    Labels sit in bold in the left 'Question Number' column, e.g. "5(a)(i)", "*4 (a)" or "10" then "(b)"."""
    at = {}
    try:
        with pdfplumber.open(ms_path) as pdf:
            cur = 0
            for pn in range(1, len(pdf.pages)):
                pg = pdf.pages[pn]
                H = float(pg.height)
                ws = [w for w in pg.extract_words(extra_attrs=["fontname"]) if w["x0"] < 150 and "Bold" in w["fontname"]]
                ws.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
                for w in ws:
                    t = w["text"].replace(" ", "")
                    pos = (pn + 1, round(max(0, w["top"] - 14) / H, 4))
                    m = re.fullmatch(r"\*?(\d{1,2})\*?(?:\(([a-z])\)(?:\([ivx]+\))?)?", t)
                    if m:
                        n = int(m.group(1))
                        if cur < n <= min(cur + 2, nq) or (n == cur and m.group(2)):
                            cur = n
                            at.setdefault((n, None), pos)
                            if m.group(2): at.setdefault((n, m.group(2)), pos)
                        continue
                    m = re.fullmatch(r"\(([a-z])\)(?:\([ivx]+\))?", t)
                    if m and cur:
                        at.setdefault((cur, m.group(1)), pos)
    except Exception:
        pass
    return at


def main():
    ext, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.load(open(ext))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_9ch0.json"))).items() if not k.startswith("_")}
    known = {t[0] for t in TOPICS}
    codes = {c for g in NAMES.values() for c in g}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(r"9ch0-p(\d)-qp-(jun|nov)(\d{4})\.pdf", f)
        pnum, mon, yr = m.groups()
        src = WEB + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(papers_dir, msf))
        ms = WEB + msf if has_ms else None
        msp = ms_pages(os.path.join(papers_dir, msf), len(r["questions"])) if has_ms else {}
        with pdfplumber.open(os.path.join(papers_dir, f)) as pdf:
            cb, mb = pdf.pages[1].cropbox, pdf.pages[1].mediabox
        x1 = r.get("x1")
        if x1 is None or abs(x1 - round(0.905 * r["W"], 1)) < 0.2:   # marks column not found (scanned paper)
            x1 = round(0.935 * r["W"], 1)
        pdfs[src] = dict(W=r["W"], H=r["H"], x0=r.get("x0"), x1=x1, cx=round(cb[0] - mb[0], 2), cy=round(mb[3] - cb[3], 2))

        last = None
        for q in r["questions"]:
            qid = f"{f[:-4]}-q{q['q']}"
            o = ov.get(qid)
            if not o:
                missing.append(qid); continue
            assert o["topic"] in known and all(c in codes for c in o["spec"]), qid
            at = msp.get((q["q"], None)) or last       # not found: start at the previous question's mark scheme
            last = at or last
            base = dict(series=f"{SERIES[mon]} {yr}", year=int(yr), paper=f"Paper {pnum}", ptype=f"p{pnum}", q=q["q"], src=src, ms=ms)
            if at: base.update(msPage=at[0], msY=at[1])
            whole = dict(base, id=qid, part=None, topic=o["topic"], spec=o["spec"], marks=q["marks"], segs=q["segs"],
                         text=clean(q["text"])[:400], checked=True)
            if o.get("parts"):
                whole["partTopics"] = {lab: v["topic"] for lab, v in o["parts"].items()}
            items.append(whole)
            parts = {p["label"]: p for p in q.get("parts") or []}
            for lab, v in (o.get("parts") or {}).items():
                assert v["topic"] in known and all(c in codes for c in v["spec"]), (qid, lab)
                p = parts.get(lab)
                if p:
                    segs, text = q.get("stem", []) + p["segs"], clean(q.get("stem_text", "") + " " + p["text"])[:400]
                elif lab == "a" and q.get("stem"):
                    segs, text = q["stem"], clean(q.get("stem_text", ""))[:400]
                else:
                    missing.append(qid + lab); continue
                pa = msp.get((q["q"], lab)) or at
                pi = dict(base, id=qid + lab, part=lab, topic=v["topic"], spec=v["spec"], marks=p["marks"] if p else None,
                          segs=segs, text=text, checked=True)
                if pa: pi.update(msPage=pa[0], msY=pa[1])
                items.append(pi)

    # spec point codes are unique across the whole spec, so every group can name every code
    allpts = {c: n for g in NAMES.values() for c, n in g.items()}
    out_data = dict(spec="9CH0", label="Edexcel A Level Chemistry 9CH0",
                    groups=[list(g) for g in GROUPS],
                    topics=[dict(id=t[0], num=t[1], name=t[2], group=t[3]) for t in TOPICS],
                    points={g: allpts for g, _ in GROUPS}, pdfs=pdfs, items=items)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(out_data, open(out, "w"), separators=(",", ":"))
    from collections import Counter
    c = Counter(i["topic"] for i in items)
    print(len(items), "items;", sum(1 for i in items if not i["part"]), "whole questions;",
          sum(1 for i in items if i["part"]), "parts; not found:", missing)
    for t in TOPICS:
        print(f"  {t[1]:>2} {t[2]:45} {c.get(t[0], 0)}")


if __name__ == "__main__":
    main()
