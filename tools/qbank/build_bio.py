"""Build the Edexcel Biology B question banks: 9BI0 (A level) and 8BI0 (AS): assets/qbank/<code>.json.

Every question is checked against the paper (decisions_bio.txt, one line per paper: "q=points" pairs):
  - spec: the spec points the question covers
  - topic: where the question goes, the latest topic, in spec order, that it covers
8BI0 uses the A level numbering (its content is topics 1-4).

Usage: python3 tools/qbank/build_bio.py <9bi0|8bi0> ext_dir papers_dir out.json
  ext_dir holds the ext-<code>-*.json files from extract.py run over that course's question papers.
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from spec_bio import TOPICS as ALL_TOPICS, GROUPS as ALL_GROUPS, NAMES as ALL_NAMES
from build_ch import clean, ms_pages as ms_pages_ch
from build_ial import ms_pages as ms_pages_ial


LABEL = re.compile(r"(\d{1,2})\s*\(?([a-h])?\)?(?:\(?[ivx]+\)?)*\*?")


def ms_pages_bio(path, nq):
    """Biology B mark schemes label rows "1ai", "2(b)(ii)", "3" in the "Question Number" column at the left; a question
    starts at its first label, and counts only once the one before it has been found."""
    from extract_caie import bbox_words
    at, cur = {}, 0
    with pdfplumber.open(path) as pdf:
        sizes = [(float(p.width), float(p.height)) for p in pdf.pages]
    started = False
    for pn, (W, H) in enumerate(sizes):
        ws = bbox_words(path, pn)
        if not started:
            started = any(w["text"] == "Number" for w in ws) and any(w["text"] == "Question" for w in ws)
            if not started:
                continue
        for w in sorted((w for w in ws if w["x0"] < 0.165 * W and 0.04 * H < w["top"] < 0.96 * H), key=lambda w: (w["top"], w["x0"])):
            m = LABEL.fullmatch(w["text"].replace(" ", ""))
            if not m:
                continue
            q, part = int(m.group(1)), m.group(2)
            # from the "Question Number" header over its row when there is one, else the label itself
            head = [h["top"] for h in ws if h["text"] == "Question" and 0 < w["top"] - h["top"] < 45]
            pos = (pn + 1, round(max(0, (max(head) if head else w["top"]) - 4) / H, 4))
            if q == cur + 1 and q <= nq:
                cur = q
                at[(q, None)] = pos
            if q == cur and part:
                at.setdefault((q, part), pos)
    return at


def ms_pages(ms_path, nq):
    """Mark scheme positions: the IAL finder (bold labels, longest run in order) first, the 9CH0 one for anything it misses,
    then hand fixes (ms_fixes_9ph0.json)."""
    at = ms_pages_bio(ms_path, nq)
    if sum(1 for k in at if k[1] is None) < nq:   # labels laid out some other way: the older finders
        old = ms_pages_ch(ms_path, nq); old.update(ms_pages_ial(ms_path, nq))
        for k, v in old.items(): at.setdefault(k, v)
    fp = os.path.join(HERE, "ms_fixes_bio.json")
    fx = json.load(open(fp)).get(os.path.basename(ms_path).replace("-ms-", "-qp-")[:-4], {}) if os.path.exists(fp) else {}
    for q, pos in fx.items():
        at[(int(q), None)] = tuple(pos)
        for k in [k for k in at if k[0] == int(q) and k[1]]:
            del at[k]
    return at

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jun": "June", "nov": "November"}
FIXES = {"9bi0-p2-qp-nov2020-q9": {"marks": 8, "last_page": 34}}


def decisions():
    """decisions_bio.txt: "9bi0 p1 jun2017: 1=1.4 7.1 | 2=..." -> {question id: [spec points]}"""
    out = {}
    for line in open(os.path.join(HERE, "decisions_bio.txt")):
        line = line.split("#")[0].strip()
        if not line: continue
        head, body = line.split(":", 1)
        code, p, ser = head.split()
        for bit in body.split("|"):
            q, pts = bit.split("=")
            out[f"{code}-{p}-qp-{ser}-q{int(q)}"] = pts.split()
    return out



def main():
    code, ext, papers_dir, out = sys.argv[1:5]
    as_only = code == "8bi0"
    TOPICS = [t for t in ALL_TOPICS if t[3] == "as"] if as_only else ALL_TOPICS
    GROUPS = [("as", "Topics 1–4")] if as_only else ALL_GROUPS
    NAMES = {"as": ALL_NAMES["as"]} if as_only else ALL_NAMES
    web = f"/files/a-level/{'edexcel-as' if as_only else 'edexcel'}/biology/papers/"
    data = {}
    for fn in sorted(os.listdir(ext)):
        if fn.startswith(f"ext-{code}-") and fn.endswith(".json"):
            data.update(json.load(open(os.path.join(ext, fn))))
    dec = decisions()
    num = {t[1]: t[0] for t in TOPICS}
    codes = {c for g in NAMES.values() for c in g}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(code + r"-p(\d)-qp-(jun|nov)(\d{4})\.pdf", f)
        pnum, mon, yr = m.groups()
        src = web + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(papers_dir, msf))
        ms = web + msf if has_ms else None
        msp = ms_pages(os.path.join(papers_dir, msf), len(r["questions"])) if has_ms else {}
        with pdfplumber.open(os.path.join(papers_dir, f)) as pdf:
            cb, mb = pdf.pages[1].cropbox, pdf.pages[1].mediabox
        x1 = r.get("x1")
        if x1 is None or abs(x1 - round(0.905 * r["W"], 1)) < 0.2:   # marks column not found
            x1 = round(0.935 * r["W"], 1)
        pdfs[src] = dict(W=r["W"], H=r["H"], x0=r.get("x0"), x1=x1, cx=round(cb[0] - mb[0], 2), cy=round(mb[3] - cb[3], 2))
        last = None
        for q in r["questions"]:
            qid = f"{f[:-4]}-q{q['q']}"
            fx = FIXES.get(qid)
            if fx:   # the extractor missed this question's total, so it ran on into the blank pages after it
                q = dict(q, marks=fx["marks"], segs=[sg for sg in q["segs"] if sg[0] <= fx["last_page"]])
            spec = dec.get(qid)
            if not spec:
                missing.append(qid); continue
            assert all(c in codes for c in spec), (qid, spec)
            spec = sorted(set(spec), key=lambda c: tuple(map(int, c.split("."))))
            topic = num[max(int(c.split(".")[0]) for c in spec)]
            at = msp.get((q["q"], None)) or last
            last = at or last
            it = dict(series=f"{SERIES[mon]} {yr}", year=int(yr), paper=f"Paper {pnum}", ptype=f"p{pnum}", q=q["q"], src=src, ms=ms,
                      id=qid, part=None, topic=topic, spec=spec, marks=q["marks"], segs=q["segs"], text=clean(q["text"])[:400], checked=True)
            if at: it.update(msPage=at[0], msY=at[1])
            items.append(it)

    # spec point codes are unique across the whole spec, so every group can name every code
    allpts = {c: n for g in NAMES.values() for c, n in g.items()}
    out_data = dict(spec=code.upper(), label=f"Edexcel {'AS' if as_only else 'A'} Level Biology B {code.upper()}",
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
