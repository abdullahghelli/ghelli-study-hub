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
from build_ig import ms_pages, split_inline

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
