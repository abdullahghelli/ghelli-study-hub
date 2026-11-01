"""Build the 4MA1 (Edexcel International GCSE Maths, Higher tier) question bank: assets/qbank/4ma1.json.
Covers Papers 1H and 2H and the regional papers 1HR and 2HR.

Every question is hand-checked against its mark scheme (overrides_4ma1.json):
  - topic: where the whole question goes (the latest topic, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier topic, also listed under that topic with the question's opening lines

Usage: python3 tools/qbank/build_ig.py extracted.json papers_dir out.json
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_ig import TOPICS, GROUPS, NAMES
from build_ch import clean

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jun": "June", "nov": "November", "jan": "January"}
WEB = "/files/gcse/edexcel-igcse/maths/papers/"
PAPER = {"1h": "Paper 1H", "2h": "Paper 2H", "1hr": "Paper 1HR", "2hr": "Paper 2HR"}

LABEL = re.compile(r"\*?(\d{1,2})\.?\*?(?:\([ivx]+\))?(?:\(?([a-z])\)?(?:\([ivx]+\))?)?(?:alt\w*)?")
SUB = re.compile(r"\(([a-z])\)(?:\([ivx]+\))?(?:alt\w*)?")


def ms_pages(ms_path, nq):
    """Where each question and part starts in a mark scheme: {(q, part or None): (page, y fraction)}.
    Labels sit in the left 'Question' column, e.g. "5(a)(i)", "1a", "5." or "3" then "(b)", set in bold or in the
    font of the column's "Question"/"Qu" heading. Reading starts at the first heading with question 1 below it
    (before that is the numbered marking guidance). Notes under a scheme sometimes repeat bold numbers, so the
    question starts are the longest run of labels that goes up in order; parts are read between those starts."""
    cands = []      # (position, question number or None, part or None)
    try:
        with pdfplumber.open(ms_path) as pdf:
            hf, hx, first_pg, lx = set(), 70, None, 85
            for pn in range(1, len(pdf.pages)):
                pg = pdf.pages[pn]
                H = float(pg.height)
                ws = [w for w in pg.extract_words(extra_attrs=["fontname"]) if w["x0"] < 120]
                heads = [w for w in ws if re.fullmatch(r"Q(?:u(?:es(?:tion)?)?)?", w["text"]) or re.fullmatch(r"Qu\d{1,2}", w["text"])]
                if not hf:
                    lab1 = lambda w: (LABEL.fullmatch(w["text"].replace(" ", "")) or [None, None])[1] == "1"
                    started = any(lab1(w) and 0 <= w["top"] - h["top"] < 70 for h in heads for w in ws)
                    # some schemes have no "Question" heading: start at the first page with a bold "1"/"1*"/"1(a)" in the column
                    if not started and not heads and any(lab1(w) and "Bold" in w["fontname"] and 70 <= w["x0"] <= 100 for w in ws):
                        started, hx = True, 75
                    if not started:
                        continue
                if first_pg is None: first_pg = pn + 1
                hf |= {w["fontname"] for w in heads}
                if heads: hx = min(w["x0"] for w in heads)
                hf |= {'__bold__'}
                nums = [w["x0"] for w in ws if "Bold" in w["fontname"] and re.fullmatch(r"\d{1,2}\*?", w["text"]) and w["x0"] <= hx + 40]
                if nums: lx = min(nums)
                bare = lambda w: lx + 15 <= w["x0"] <= lx + 60 and re.fullmatch(r"\(?[a-h]\)?(?:\([ivx]+\))?", w["text"])   # part letter in its own column
                ws = [w for w in ws if (w["x0"] <= hx + 40 and ("Bold" in w["fontname"] or w["fontname"] in hf or SUB.fullmatch(w["text"].replace(" ", "")))) or bare(w)]
                ws.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
                for w in ws:
                    t = re.sub(r"^Qu(?=\d)", "", w["text"].replace(" ", ""))   # "Qu6" = heading and label run together
                    pos = (pn + 1, round(max(0, w["top"] - 14) / H, 4))
                    m = LABEL.fullmatch(t)
                    if m and 1 <= int(m.group(1)) <= nq:
                        cands.append((pos, int(m.group(1)), m.group(2)))
                        continue
                    m = SUB.fullmatch(t) or (bare(w) and re.fullmatch(r"\(?([a-h])\)?(?:\([ivx]+\))?", t))
                    if m:
                        cands.append((pos, None, m.group(1)))
    except Exception:
        return {}
    # longest strictly increasing run of question numbers, earliest occurrences preferred
    qs = [(i, c[1]) for i, c in enumerate(cands) if c[1]]
    best = []    # best[k] = (length, previous index in qs)
    for k, (i, n) in enumerate(qs):
        L, prev = 1, None
        for j in range(k):
            if qs[j][1] < n and best[j][0] + 1 > L:
                L, prev = best[j][0] + 1, j
        best.append((L, prev))
    chain, k = [], (max(range(len(qs)), key=lambda k: (best[k][0], -k)) if qs else None)
    while k is not None:
        chain.append(qs[k]); k = best[k][1]
    chain.reverse()
    at = {}
    starts = [(i, n) for i, n in chain]
    for s, (i, n) in enumerate(starts):
        end = starts[s + 1][0] if s + 1 < len(starts) else len(cands)
        at[(n, None)] = cands[i][0]
        for pos, qn, part in cands[i:end]:
            if part and (qn is None or qn == n):
                at.setdefault((n, part), pos)
    if (1, None) not in at and first_pg:      # question 1's label in plain type: start of the scheme
        at[(1, None)] = (first_pg, 0.05)
    return at


def split_inline(pdf_path, q, x0):
    """Some questions have "(a)", "(b)" labels the extractor did not split (e.g. "(a) Express ... (3) The curve C ...
    (b) Find ..."). Find the labels near the left margin inside the question and cut its segments there."""
    labs = []
    with pdfplumber.open(pdf_path) as pdf:
        for pn, y0, y1 in q["segs"]:
            for w in pdf.pages[pn - 1].extract_words():
                m = re.fullmatch(r"\(([a-h])\)", w["text"])
                if m and w["x0"] < x0 + 60 and y0 - 2 <= w["top"] <= y1:
                    if not labs or (m.group(1) > labs[-1][0] and (pn, w["top"]) > labs[-1][1:]):
                        labs.append((m.group(1), pn, w["top"]))
        if len(labs) < 2:
            return {}
        W = float(pdf.pages[0].width)
        words = {pn: pdf.pages[pn - 1].extract_words() for pn in {s[0] for s in q["segs"]}}

        def row_top(pn, y):
            # the top of the label's line, which can be taller than the label (a fraction beside "(b)")
            return min([w["top"] for w in words[pn] if w["top"] < y + 8 and w["bottom"] > y + 2] + [y]) - 3

        cuts = []   # where each part ends: just after its "(n)" marks, and always above the next label's line
        for i in range(len(labs) - 1):
            (_, pn, y), (_, npn, ny) = labs[i], labs[i + 1]
            end = (npn, row_top(npn, ny))
            mk = [(p, w["bottom"]) for p in range(pn, npn + 1) for w in words.get(p, [])
                  if re.fullmatch(r"\(\d{1,2}\)", w["text"]) and w["x0"] > 0.75 * W and (pn, y) < (p, w["top"]) < (npn, ny)]
            if mk and (mk[-1][0], mk[-1][1] + 3) < end:
                mp, mb = mk[-1]
                # a lead-in line straight after the marks may start a little above them (a tall fraction)
                below = [w["top"] for w in words[mp] if w["bottom"] > mb + 4 and w["x1"] < 0.75 * W
                         and (mp, w["top"]) < end and not set(w["text"]) <= set(".")]
                end = (mp, min([mb + 3] + [t - 2 for t in below if t < mb + 3]))
            cuts.append(end)
        out = {}
        for i, (lab, pn, y) in enumerate(labs):
            a = cuts[i - 1] if i else (q["segs"][0][0], q["segs"][0][1])
            b = cuts[i] if i + 1 < len(labs) else (q["segs"][-1][0], q["segs"][-1][2])
            segs = []
            for spn, s0, s1 in q["segs"]:
                lo = max(s0, a[1]) if spn == a[0] else s0
                hi = min(s1, b[1]) if spn == b[0] else s1
                if a[0] <= spn <= b[0] and hi - lo > 4:
                    segs.append([spn, round(lo, 1), round(hi, 1)])
            body = lambda w: x0 - 25 < w["x0"] and w["x1"] < 0.93 * W
            text = " ".join(w["text"] for s in segs for w in words[s[0]] if s[1] <= w["top"] <= s[2] and body(w))
            # the part's marks, e.g. "(3)", sit at the right margin anywhere between this label and the next
            mk = [w["text"] for spn in range(a[0], b[0] + 1) for w in pdf.pages[spn - 1].extract_words()
                  if re.fullmatch(r"\(\d{1,2}\)", w["text"]) and w["x0"] > 0.75 * W
                  and (spn, w["top"]) > a and (spn, w["top"]) < b]
            out[lab] = dict(label=lab, segs=segs, text=text, marks=int(mk[-1][1:-1]) if mk else None)
        return out


def main():
    ext, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.load(open(ext))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_4ma1.json"))).items() if not k.startswith("_")}
    order = {t[0]: i for i, t in enumerate(TOPICS)}
    group = {t[0]: t[3] for t in TOPICS}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(r"4ma1-p(1hr|2hr|1h|2h)-qp-(jun|nov|jan)(\d{4})\.pdf", f)
        pid, mon, yr = m.groups()
        paper, g = PAPER[pid], "ig"
        src = WEB + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(papers_dir, msf))
        ms = WEB + msf if has_ms else None
        msp = ms_pages(os.path.join(papers_dir, msf), len(r["questions"])) if has_ms else {}
        with pdfplumber.open(os.path.join(papers_dir, f)) as pdf:
            cb, mb = pdf.pages[1].cropbox, pdf.pages[1].mediabox
            # a line of question text can run past the marks column (e.g. June 2019 3C Q7): widen the crop to fit it
            right = max((w["x1"] for pg in pdf.pages[1:] for w in pg.extract_words(extra_attrs=["upright"])
                         if w.get("upright", True) and r["x0"] < w["x0"] and w["x1"] < 0.93 * r["W"]
                         and w["top"] < 0.92 * r["H"] and "_" not in w["text"] and re.search(r"[A-Za-z0-9]", w["text"])), default=0)
            # bottoms of body text lines on each page, so a lifted question start never takes in the line above
            # (e.g. the "Answer ALL questions" header above Question 1)
            line_bottoms = {i + 1: [w["bottom"] for w in pg.extract_words()
                                    if r["x0"] - 25 < w["x0"] and w["x1"] < 0.93 * r["W"]] for i, pg in enumerate(pdf.pages)}
        x1 = r.get("x1")
        if x1 is None or abs(x1 - round(0.905 * r["W"], 1)) < 0.2:
            x1 = round(0.935 * r["W"], 1)
        x1 = max(x1, round(right + 3, 1))
        pdfs[src] = dict(W=r["W"], H=r["H"], x0=r.get("x0"), x1=x1, cx=round(cb[0] - mb[0], 2), cy=round(mb[3] - cb[3], 2))

        def ok(o, where):
            assert o["topic"] in order and group[o["topic"]] == g, where
            assert all(c in NAMES[g] for c in o["spec"]), where

        # a question's opening line can sit beside something taller (e.g. a matrix written next to "3."):
        # start each question a little higher, as long as that stays clear of the question before
        prev_end = {}
        for q in r["questions"]:
            s0 = q["segs"][0]
            above = max([b for b in line_bottoms.get(s0[0], []) if b < s0[1] - 1] + [prev_end.get(s0[0], 0)])
            room = s0[1] - above
            if room > 10:
                lift, y_orig = min(14, room - 4), s0[1]
                for sl in [q["segs"], q.get("stem") or []] + [p["segs"] for p in q.get("parts") or []]:
                    for sg in sl:
                        if sg[0] == s0[0] and abs(sg[1] - y_orig) < 0.01:
                            sg[1] = round(sg[1] - lift, 1)
            for sg in q["segs"]:
                prev_end[sg[0]] = max(prev_end.get(sg[0], 0), sg[2])

        last = None
        for q in r["questions"]:
            qid = f"{f[:-4]}-q{q['q']}"
            o = ov.get(qid)
            if not o:
                missing.append(qid); continue
            ok(o, qid)
            at = msp.get((q["q"], None)) or last
            last = at or last
            base = dict(series=f"{SERIES[mon]} {yr}", year=int(yr), paper=paper, ptype=pid, q=q["q"], src=src, ms=ms)
            if at: base.update(msPage=at[0], msY=at[1])
            whole = dict(base, id=qid, part=None, topic=o["topic"], spec=o["spec"], marks=q["marks"], segs=q["segs"],
                         text=clean(q["text"])[:400], checked=True)
            if o.get("parts"):
                whole["partTopics"] = {lab: v["topic"] for lab, v in o["parts"].items()}
            items.append(whole)
            parts = {p["label"]: p for p in q.get("parts") or []}
            if o.get("parts") and not all(lab in parts for lab in o["parts"]):
                parts = split_inline(os.path.join(papers_dir, f), q, r["x0"]) or parts
            for lab, v in (o.get("parts") or {}).items():
                ok(v, qid + lab)
                assert order[v["topic"]] < order[o["topic"]], qid + lab
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

    out_data = dict(spec="4MA1", label="Edexcel International GCSE Maths 4MA1",
                    groups=[list(x) for x in GROUPS],
                    topics=[dict(id=t[0], num=t[1], name=t[2], group=t[3]) for t in TOPICS],
                    points=NAMES, pdfs=pdfs, items=items)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(out_data, open(out, "w"), separators=(",", ":"))
    from collections import Counter
    c = Counter(i["topic"] for i in items)
    print(len(items), "items;", sum(1 for i in items if not i["part"]), "whole questions;",
          sum(1 for i in items if i["part"]), "parts; not found:", missing)
    for t in TOPICS:
        print(f"  {t[3]} {t[1]} {t[2]:45} {c.get(t[0], 0)}")


if __name__ == "__main__":
    main()
