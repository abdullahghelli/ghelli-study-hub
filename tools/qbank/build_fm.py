"""Build the 9FM0 (Edexcel A Level Further Maths) question bank: assets/qbank/9fm0.json.
Covers Core Pure 1 and 2 (Papers 1, 2), Further Statistics 1 (Paper 3B) and Further Mechanics 1 (Paper 3C).

Every question is hand-checked against its mark scheme (overrides_9fm0.json):
  - topic: where the whole question goes (the latest topic, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier topic, also listed under that topic with the question's opening lines

Usage: python3 tools/qbank/build_fm.py extracted.json papers_dir out.json
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_fm import TOPICS, GROUPS, NAMES
from build_ch import clean

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jun": "June", "nov": "November"}
WEB = "/files/a-level/edexcel/further-maths/papers/"
PAPER = {"1": ("Paper 1", "cp"), "2": ("Paper 2", "cp"), "3b": ("Paper 3B", "fs"), "3c": ("Paper 3C", "fm")}

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
            hf, hx = set(), 70
            for pn in range(1, len(pdf.pages)):
                pg = pdf.pages[pn]
                H = float(pg.height)
                ws = [w for w in pg.extract_words(extra_attrs=["fontname"]) if w["x0"] < 120]
                heads = [w for w in ws if re.fullmatch(r"Q(?:u(?:es(?:tion)?)?)?", w["text"]) or re.fullmatch(r"Qu\d{1,2}", w["text"])]
                if not hf:
                    lab1 = lambda w: (LABEL.fullmatch(w["text"].replace(" ", "")) or [None, None])[1] == "1"
                    if not any(lab1(w) and 0 <= w["top"] - h["top"] < 70 for h in heads for w in ws):
                        continue
                hf |= {w["fontname"] for w in heads}
                if heads: hx = min(w["x0"] for w in heads)
                ws = [w for w in ws if ("Bold" in w["fontname"] or w["fontname"] in hf) and w["x0"] <= hx + 30]
                ws.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
                for w in ws:
                    t = re.sub(r"^Qu(?=\d)", "", w["text"].replace(" ", ""))   # "Qu6" = heading and label run together
                    pos = (pn + 1, round(max(0, w["top"] - 14) / H, 4))
                    m = LABEL.fullmatch(t)
                    if m and 1 <= int(m.group(1)) <= nq:
                        cands.append((pos, int(m.group(1)), m.group(2)))
                        continue
                    m = SUB.fullmatch(t)
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
    return at


def main():
    ext, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.load(open(ext))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_9fm0.json"))).items() if not k.startswith("_")}
    order = {t[0]: i for i, t in enumerate(TOPICS)}
    group = {t[0]: t[3] for t in TOPICS}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(r"9fm0-p(1|2|3b|3c)-qp-(jun|nov)(\d{4})\.pdf", f)
        pid, mon, yr = m.groups()
        paper, g = PAPER[pid]
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
            room = s0[1] - prev_end.get(s0[0], 0)
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
            base = dict(series=f"{SERIES[mon]} {yr}", year=int(yr), paper=paper, ptype=g, q=q["q"], src=src, ms=ms)
            if at: base.update(msPage=at[0], msY=at[1])
            whole = dict(base, id=qid, part=None, topic=o["topic"], spec=o["spec"], marks=q["marks"], segs=q["segs"],
                         text=clean(q["text"])[:400], checked=True)
            if o.get("parts"):
                whole["partTopics"] = {lab: v["topic"] for lab, v in o["parts"].items()}
            items.append(whole)
            parts = {p["label"]: p for p in q.get("parts") or []}
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

    out_data = dict(spec="9FM0", label="Edexcel A Level Further Maths 9FM0",
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
