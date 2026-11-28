"""Build the Edexcel AS Level question banks: 8PH0 (physics), 8CH0 (chemistry), 8MA0 (maths) and 8FM0 (further maths).

Every question is hand-checked (overrides_8xx0.json, keyed by question id):
  - topic: where the whole question goes (the latest topic, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier topic, also listed under that topic with the question's opening lines

The AS papers use the A level specs' topic and point numbering (the AS content is the first part of each A level spec),
so the topics and spec point names come from spec_ph.py, spec_ch.py and spec.py.

8FM0 has its own spec (spec_fm8.py): Core Pure (Paper 1) and the eight option papers (21 to 28), each its own section.

Usage: python3 tools/qbank/build_as.py <8ph0|8ch0|8ma0|8fm0> ext_dir out.json
  ext_dir holds the ext-<code>-*.json files from extract.py run over that course's question papers.
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build_ch import clean, ms_pages as ms_pages_ch
from build_ial import ms_pages as ms_pages_ial

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jun": "June", "nov": "November"}


def course(code):
    if code == "8ph0":
        import spec_ph as s
        topics = [t for t in s.TOPICS if t[3] == "as"]
        return dict(subject="physics", label="Edexcel AS Level Physics 8PH0", topics=topics,
                    groups=[["as", "Topics 1–5"]], names=s.NAMES["as"])
    if code == "8ch0":
        import spec_ch as s
        topics = [t for t in s.TOPICS if t[3] == "as"]
        return dict(subject="chemistry", label="Edexcel AS Level Chemistry 8CH0", topics=topics,
                    groups=[["as", "Topics 1–10"]], names=s.NAMES["as"])
    if code == "8fm0":
        import spec_fm8 as f
        return dict(subject="further-maths", label="Edexcel AS Level Further Mathematics 8FM0", topics=f.TOPICS,
                    groups=[list(g) for g in f.GROUPS], names=f.NAMES, grouped=True, modular=True)
    import spec as s
    order = ["proof", "algebra", "coord", "sequences", "trig", "explog", "diff", "integ", "vectors",
             "sampling", "data", "prob", "dist", "hyp", "kin", "forces"]
    tname = {"proof": "Proof", "algebra": "Algebra and functions", "coord": "Coordinate geometry", "sequences": "Sequences and series",
             "trig": "Trigonometry", "explog": "Exponentials and logarithms", "diff": "Differentiation", "integ": "Integration",
             "vectors": "Vectors", "sampling": "Statistical sampling", "data": "Data presentation and interpretation",
             "prob": "Probability", "dist": "Statistical distributions", "hyp": "Statistical hypothesis testing",
             "units": "Quantities and units in mechanics", "kin": "Kinematics", "forces": "Forces and Newton's laws"}
    topics = [(t, s.NUM[t], tname[t], s.GROUP[t]) for t in order]
    return dict(subject="maths", label="Edexcel AS Level Mathematics 8MA0", topics=topics,
                groups=[["pure", "Pure · Paper 1"], ["stats", "Statistics · Paper 21"], ["mech", "Mechanics · Paper 22"]], names=s.NAMES, grouped=True,
                modular=True)


def ms_pages(code, ms_path, nq):
    """Mark scheme positions: the IAL finder (bold labels, longest run in order) first, the 9CH0 one for anything it misses,
    then hand fixes (ms_fixes_<code>.json)."""
    at = ms_pages_ch(ms_path, nq)
    at.update(ms_pages_ial(ms_path, nq))
    fp = os.path.join(HERE, f"ms_fixes_{code}.json")
    fx = json.load(open(fp)).get(os.path.basename(ms_path).replace("-ms-", "-qp-")[:-4], {}) if os.path.exists(fp) else {}
    for q, pos in fx.items():
        at[(int(q), None)] = tuple(pos)
        for k in [k for k in at if k[0] == int(q) and k[1]]:
            del at[k]
    return at


def paper_name(code, pnum):
    if code == "8ma0":
        return {"1": ("Paper 1", "pure"), "2": ("Paper 2", "sm"), "21": ("Paper 21", "stats"), "22": ("Paper 22", "mech")}[pnum]
    if code == "8fm0":
        import spec_fm8 as f
        return f"Paper {pnum}", f.PAPER_GROUP[pnum]
    return f"Paper {pnum}", f"p{pnum}"


def main():
    code, ext, out = sys.argv[1], sys.argv[2], sys.argv[3]
    C = course(code)
    web = f"/files/a-level/edexcel-as/{C['subject']}/papers/"
    papers_dir = "files" + web[len("/files"):]
    data = {}
    for fn in sorted(os.listdir(ext)):
        if fn.startswith(f"ext-{code}-") and fn.endswith(".json"):
            data.update(json.load(open(os.path.join(ext, fn))))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, f"overrides_{code}.json"))).items() if not k.startswith("_")}
    known = {t[0] for t in C["topics"]}
    group_of = {t[0]: t[3] for t in C["topics"]}
    names = C["names"]
    ok_code = (lambda t, c: c in names[group_of[t]]) if C.get("grouped") else (lambda t, c: c in names)
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(code + r"-p(\d+)-qp-(jun|nov)(\d{4})\.pdf", f)
        pnum, mon, yr = m.groups()
        src = web + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(papers_dir, msf))
        ms = web + msf if has_ms else None
        msp = ms_pages(code, os.path.join(papers_dir, msf), len(r["questions"])) if has_ms else {}
        with pdfplumber.open(os.path.join(papers_dir, f)) as pdf:
            cb, mb = pdf.pages[1].cropbox, pdf.pages[1].mediabox
        x1 = r.get("x1")
        if x1 is None or abs(x1 - round(0.905 * r["W"], 1)) < 0.2:   # marks column not found (scanned paper)
            x1 = round(0.935 * r["W"], 1)
        pdfs[src] = dict(W=r["W"], H=r["H"], x0=r.get("x0"), x1=x1, cx=round(cb[0] - mb[0], 2), cy=round(mb[3] - cb[3], 2))
        paper, ptype = paper_name(code, pnum)

        last = None
        for q in r["questions"]:
            qid = f"{f[:-4]}-q{q['q']}"
            o = ov.get(qid)
            if not o:
                missing.append(qid); continue
            if o.get("drop"):
                continue
            assert o["topic"] in known and all(ok_code(o["topic"], c) for c in o["spec"]), (qid, o)
            at = msp.get((q["q"], None)) or last       # not found: start at the previous question's mark scheme
            last = at or last
            base = dict(series=f"{SERIES[mon]} {yr}", year=int(yr), paper=paper, ptype=ptype, q=q["q"], src=src, ms=ms)
            if at and ms: base.update(msPage=at[0], msY=at[1])
            whole = dict(base, id=qid, part=None, topic=o["topic"], spec=o["spec"], marks=q["marks"], segs=q["segs"],
                         text=clean(q["text"])[:400], checked=True)
            if o.get("parts"):
                whole["partTopics"] = {lab: v["topic"] for lab, v in o["parts"].items()}
            ps = [p for p in q.get("parts") or [] if p.get("segs")]
            if len(ps) >= 2:   # part positions, so a worksheet can include just the parts picked (see add_parts.py)
                whole["stem"] = q.get("stem") or []
                whole["parts"] = [dict(l=p["label"], m=p["marks"], s=p["segs"]) for p in ps]
            items.append(whole)
            parts = {p["label"]: p for p in q.get("parts") or []}
            for lab, v in (o.get("parts") or {}).items():
                assert v["topic"] in known and all(ok_code(v["topic"], c) for c in v["spec"]), (qid, lab)
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
                if pa and ms: pi.update(msPage=pa[0], msY=pa[1])
                items.append(pi)

    # only the spec points some question covers (the A level specs list points the AS course doesn't have)
    used = {}
    for it in items:
        for c in it["spec"]:
            used.setdefault(group_of[it["topic"]], set()).add(c)
    if C.get("grouped"):
        points = {g: {c: n for c, n in names[g].items() if c in used.get(g, ())} for g, _ in C["groups"]}
    else:
        points = {g: {c: n for c, n in names.items() if c in used.get(g, ())} for g, _ in C["groups"]}
    out_data = dict(spec=code.upper(), label=C["label"], groups=C["groups"], **({"modular": True} if C.get("modular") else {}),
                    topics=[dict(id=t[0], num=t[1], name=t[2], group=t[3]) for t in C["topics"]],
                    points=points, pdfs=pdfs, items=items)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(out_data, open(out, "w"), separators=(",", ":"))
    from collections import Counter
    c = Counter(i["topic"] for i in items)
    print(len(items), "items;", sum(1 for i in items if not i["part"]), "whole questions;",
          sum(1 for i in items if i["part"]), "parts; not found:", missing)
    for t in C["topics"]:
        print(f"  {t[1]:>2} {t[2]:45} {c.get(t[0], 0)}")


if __name__ == "__main__":
    main()
