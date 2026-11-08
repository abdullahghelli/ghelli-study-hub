"""Build the YMA01 (Edexcel International A Level Maths) question bank: assets/qbank/yma01.json.
Covers units P1 (WMA11), P2 (WMA12, and the June 2024 regional WMA12R), P3 (WMA13), P4 (WMA14), M1 (WME01), S1 (WST01).

Every question is checked against its paper (overrides_yma01.json):
  - topic: where the whole question goes (the latest section of its unit, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier section, also listed under that section with the question's opening lines

Usage: python3 tools/qbank/build_ial.py ext_dir papers_dir out.json
"""
import glob, json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_ial import TOPICS, GROUPS, NAMES
from build_ch import clean
from build_ig import split_inline

LABEL = re.compile(r"\*?(\d{1,2})\.?\*?(?:\([ivx]+\))?(?:\(?([a-z])\)?(?:\([ivx]+\))?)?(?:alt\w*)?")
SUB = re.compile(r"\(([a-z])\)(?:\([ivx]+\))?(?:alt\w*)?")


def ms_pages(ms_path, nq):
    """As build_ig.ms_pages, widened for IAL schemes: an upper-case "QUESTION NUMBER" heading, labels further right
    (up to x = 140) and a first label up to 120 pt below its heading."""
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
                ws = [w for w in pg.extract_words(extra_attrs=["fontname"]) if w["x0"] < 140]
                heads = [w for w in ws if re.fullmatch(r"Q(?:u(?:es(?:tion)?)?)?|QUESTION", w["text"]) or re.fullmatch(r"Qu\d{1,2}", w["text"])]
                if not hf:
                    lab1 = lambda w: (LABEL.fullmatch(w["text"].replace(" ", "")) or [None, None])[1] == "1"
                    started = any(lab1(w) and 0 <= w["top"] - h["top"] < 120 for h in heads for w in ws)
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
                        cands.append((pos, int(m.group(1)), m.group(2), "Bold" in w["fontname"]))
                        continue
                    m = SUB.fullmatch(t) or (bare(w) and re.fullmatch(r"\(?([a-h])\)?(?:\([ivx]+\))?", t))
                    if m:
                        cands.append((pos, None, m.group(1), "Bold" in w["fontname"]))
    except Exception:
        return {}
    # longest strictly increasing run of question numbers, earliest occurrences preferred
    def run(qs):
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
        return chain[::-1]
    # where the labels are in bold, numbers in the working (set in the same plain type as the heading) are not labels:
    # use the bold labels alone when they give every question in order
    chain = run([(i, c[1]) for i, c in enumerate(cands) if c[1] and c[3]])
    if [n for _, n in chain] != list(range(1, nq + 1)):
        chain = run([(i, c[1]) for i, c in enumerate(cands) if c[1]])
    at = {}
    starts = [(i, n) for i, n in chain]
    for s, (i, n) in enumerate(starts):
        end = starts[s + 1][0] if s + 1 < len(starts) else len(cands)
        at[(n, None)] = cands[i][0]
        for pos, qn, part, _ in cands[i:end]:
            if part and (qn is None or qn == n):
                at.setdefault((n, part), pos)
    if (1, None) not in at and first_pg:      # question 1's label in plain type: start of the scheme
        at[(1, None)] = (first_pg, 0.05)
    return at



HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jan": "January", "jun": "June", "oct": "October"}
WEB = "/files/a-level/edexcel-ial/maths/papers/"
UNIT = {"wma11": ("P1", "p1"), "wma12": ("P2", "p2"), "wma12r": ("P2R", "p2"), "wma13": ("P3", "p3"),
        "wma14": ("P4", "p4"), "wme01": ("M1", "m1"), "wst01": ("S1", "s1")}


def main():
    ext_dir, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = {}
    for f in sorted(glob.glob(os.path.join(ext_dir, "ext-*.json"))):
        data.update(json.load(open(f)))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_yma01.json"))).items() if not k.startswith("_")}
    fixes = {k: v for k, v in json.load(open(os.path.join(HERE, "ms_fixes_yma01.json"))).items() if not k.startswith("_")}
    order = {t[0]: i for i, t in enumerate(TOPICS)}
    group = {t[0]: t[3] for t in TOPICS}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(r"(wma11|wma12r|wma12|wma13|wma14|wme01|wst01)-qp-(jan|jun|oct)(\d{4})\.pdf", f)
        code, mon, yr = m.groups()
        paper, g = UNIT[code]
        src = WEB + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(papers_dir, msf))
        ms = WEB + msf if has_ms else None
        msp = ms_pages(os.path.join(papers_dir, msf), len(r["questions"])) if has_ms else {}
        for qn, pos in fixes.get(f[:-4], {}).items():
            msp[(int(qn), None)] = tuple(pos)
            for k in [k for k in msp if k[0] == int(qn) and k[1]]:
                del msp[k]
        with pdfplumber.open(os.path.join(papers_dir, f)) as pdf:
            cb, mb = pdf.pages[1].cropbox, pdf.pages[1].mediabox
            right = max((w["x1"] for pg in pdf.pages[1:] for w in pg.extract_words(extra_attrs=["upright"])
                         if w.get("upright", True) and r["x0"] < w["x0"] and w["x1"] < 0.93 * r["W"]
                         and w["top"] < 0.92 * r["H"] and "_" not in w["text"] and re.search(r"[A-Za-z0-9]", w["text"])), default=0)
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

        # start each question a little higher when there is room (a matrix or fraction beside "3.")
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
            base = dict(series=f"{SERIES[mon]} {yr}", year=int(yr), paper=paper, ptype=code, q=q["q"], src=src, ms=ms)
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

    out_data = dict(spec="YMA01", label="Edexcel International A Level Maths YMA01",
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
        print(f"  {t[3]} {t[1]} {t[2]:40} {c.get(t[0], 0)}")


if __name__ == "__main__":
    main()
