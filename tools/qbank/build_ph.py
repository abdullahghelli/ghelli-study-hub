"""Build the 9PH0 (Edexcel A Level Physics) question bank: assets/qbank/9ph0.json.

Every question is hand-checked against its mark scheme (overrides_9ph0.json):
  - topic: where the whole question goes (the latest topic, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier topic, also listed under that topic with the question's opening lines

Usage: python3 tools/qbank/build_ph.py ext_dir papers_dir out.json
  ext_dir holds the ext-*.json files from extract.py run over the 9PH0 question papers.
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from spec_ph import TOPICS, GROUPS, NAMES
from build_ch import clean, ms_pages as ms_pages_ch
from build_ial import ms_pages as ms_pages_ial


def ms_pages(ms_path, nq):
    """Mark scheme positions: the IAL finder (bold labels, longest run in order) first, the 9CH0 one for anything it misses,
    then hand fixes (ms_fixes_9ph0.json)."""
    at = ms_pages_ch(ms_path, nq)
    at.update(ms_pages_ial(ms_path, nq))
    fx = json.load(open(os.path.join(HERE, "ms_fixes_9ph0.json"))).get(os.path.basename(ms_path).replace("-ms-", "-qp-")[:-4], {})
    for q, pos in fx.items():
        at[(int(q), None)] = tuple(pos)
        for k in [k for k in at if k[0] == int(q) and k[1]]:
            del at[k]
    return at

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jun": "June", "nov": "November"}
WEB = "/files/a-level/edexcel/physics/papers/"



def main():
    ext, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = {}
    for fn in sorted(os.listdir(ext)):
        if fn.startswith("ext-") and fn.endswith(".json"):
            data.update(json.load(open(os.path.join(ext, fn))))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_9ph0.json"))).items() if not k.startswith("_")}
    known = {t[0] for t in TOPICS}
    codes = {c for g in NAMES.values() for c in g}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(r"9ph0-p(\d)-qp-(jun|nov)(\d{4})\.pdf", f)
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
    out_data = dict(spec="9PH0", label="Edexcel A Level Physics 9PH0",
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
