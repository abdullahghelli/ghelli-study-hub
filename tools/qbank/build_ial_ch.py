"""Build the YCH11 (Edexcel International A Level Chemistry) question bank: assets/qbank/ych11.json.
Covers units 1-6 (WCH11-WCH16), June 2019 to October 2025.

Every question is tagged with the spec points it covers (overrides_ych11.json; first pass from tag_ial_ch.py,
then checked by hand against each question):
  - topic: where the whole question goes (the latest topic, in spec order, that any part covers)
  - spec: the spec points the question covers
  - parts: parts that belong to an earlier topic, also listed under that topic with the question's opening lines
Section A questions with a single A-D answer get the answer from the mark scheme ("The only correct answer is X").

Usage: python3 tools/qbank/build_ial_ch.py ext_dir papers_dir out.json
"""
import glob, json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_ial_ch import TOPICS, GROUPS, NAMES
from build_ch import clean, ms_pages as ms_pages_ch
from build_ial import ms_pages as ms_pages_ial
from build_ig import split_inline


def ms_pages(path, nq):
    a = ms_pages_ch(path, nq)
    b = ms_pages_ial(path, nq)
    qa, qb = {k[0] for k in a}, {k[0] for k in b}
    return a if len(qa) >= len(qb) else b


def mcq_keys(path):
    """{(q, part or None): letter} from "The only correct answer is A". The question label ("1", "1(a)") is on the
    same line or on its own line just above."""
    import subprocess
    keys = {}
    try:
        text = subprocess.run(["pdftotext", "-layout", "-l", "14", path, "-"], capture_output=True, text=True).stdout
    except Exception:
        return keys
    last = None
    for line in text.splitlines():
        lab = re.match(r"^\s*(\d{1,2})\s*(?:\(([a-h])\))?(?:\s{2,}|\s*$)", line)
        if lab:
            last = (int(lab.group(1)), lab.group(2))
        m = re.search(r"The only correct answer is ([A-D])\b", line)
        if m and last and last not in keys:
            keys[last] = m.group(1)
    return keys


ALL = {**NAMES['as'], **NAMES['a2']}   # a later unit's question can draw on earlier points
OPTS = re.compile(r"\bA\b.*\bB\b.*\bC\b.*\bD\b", re.S)

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = {"jan": "January", "jun": "June", "oct": "October"}
WEB = "/files/a-level/edexcel-ial/chemistry/papers/"
UNIT = {f"wch1{n}": (f"Unit {n}", "as" if n <= 3 else "a2") for n in range(1, 7)}


def main():
    ext_dir, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = {}
    for f in sorted(glob.glob(os.path.join(ext_dir, "ext-*.json"))):
        data.update(json.load(open(f)))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_ych11.json"))).items() if not k.startswith("_")}
    fixes = {}
    order = {t[0]: i for i, t in enumerate(TOPICS)}
    group = {t[0]: t[3] for t in TOPICS}
    items, pdfs, missing = [], {}, []
    for f, r in sorted(data.items()):
        m = re.match(r"(wch1[1-6])-qp-(jan|jun|oct)(\d{4})\.pdf", f)
        code, mon, yr = m.groups()
        paper, g = UNIT[code]
        src = WEB + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(papers_dir, msf))
        ms = WEB + msf if has_ms else None
        msp = ms_pages(os.path.join(papers_dir, msf), len(r["questions"])) if has_ms else {}
        keys = mcq_keys(os.path.join(papers_dir, msf)) if has_ms else {}
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
            assert o["topic"] in order, where
            assert all(c in ALL for c in o["spec"]), where

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
            if not q.get("parts") and q["marks"] == 1 and (q["q"], None) in keys and OPTS.search(q["text"]):
                whole["mcq"], whole["ans"] = True, keys[(q["q"], None)]
            if o.get("parts"):
                whole["partTopics"] = {lab: v["topic"] for lab, v in o["parts"].items()}
            if o.get("partSpec"):
                whole["partSpec"] = o["partSpec"]
            items.append(whole)
            parts = {p["label"]: p for p in q.get("parts") or []}
            if o.get("parts") and not all(lab in parts for lab in o["parts"]):
                parts = split_inline(os.path.join(papers_dir, f), q, r["x0"]) or parts
            for lab, v in (o.get("parts") or {}).items():
                ok(v, qid + lab)
                assert order[v["topic"]] < order[o["topic"]], qid + lab
                p = parts.get(lab)
                if p:
                    need = [n for n in (o.get("needs") or {}).get(lab, []) if n in parts]
                    ctx = [sg for n in need for sg in parts[n]["segs"]]
                    segs, text = q.get("stem", []) + ctx + p["segs"], clean(q.get("stem_text", "") + " " + p["text"])[:400]
                elif lab == "a" and q.get("stem"):
                    segs, text = q["stem"], clean(q.get("stem_text", ""))[:400]
                else:
                    missing.append(qid + lab); continue
                pa = msp.get((q["q"], lab)) or at
                pi = dict(base, id=qid + lab, part=lab, topic=v["topic"], spec=v["spec"], marks=p["marks"] if p else None,
                          segs=segs, text=text, checked=True)
                if p and need:
                    # earlier parts this part depends on: drawn faded, labelled, between the opening lines and the part
                    pi["ctx"] = dict(start=len(q.get("stem", [])), n=len(ctx), parts=need)
                if pa: pi.update(msPage=pa[0], msY=pa[1])
                items.append(pi)

    # split by unit: units are sat as separate papers, so the bank shows one unit at a time. Each unit lists its own
    # spec topics (the practical units, 3 and 6, list all the AS or A level topics), plus any earlier topic that a
    # question part in that unit's papers tests.
    UNITS = [("u1", "Unit 1 · Structure, Bonding and Introduction to Organic Chemistry", range(1, 6)),
             ("u2", "Unit 2 · Energetics, Group Chemistry, Halogenoalkanes and Alcohols", range(6, 11)),
             ("u3", "Unit 3 · Practical Skills in Chemistry I", range(1, 11)),
             ("u4", "Unit 4 · Rates, Equilibria and Further Organic Chemistry", range(11, 16)),
             ("u5", "Unit 5 · Transition Metals and Organic Nitrogen Chemistry", range(16, 21)),
             ("u6", "Unit 6 · Practical Skills in Chemistry II", range(11, 21))]
    num = {t[0]: t[1] for t in TOPICS}
    name = {t[1]: t[2] for t in TOPICS}
    uid = lambda it: "u" + it["ptype"][-1]
    native = {u: set(r) for u, _, r in UNITS}
    tnum = lambda c: int(c.split(".")[0])
    def place(it):
        """the latest topic of the unit's own that the question covers (a point from a later unit, tested in passing,
        doesn't move it); failing that, the latest topic it covers"""
        ns = {tnum(c) for c in it["spec"]}
        own = ns & native[uid(it)]
        return max(own) if own else max(ns)
    wholes = {}
    for it in items:
        if not it["part"]:
            it["topic"] = f"{uid(it)}-{place(it)}"
            wholes[it["id"]] = it
    keep = []
    for it in items:
        if it["part"]:
            w = wholes[it["id"][:-1]]
            n = num[it["topic"]]
            if n >= int(w["topic"].split("-")[1]):
                continue    # no longer earlier than where the whole question now sits
            it["topic"] = f"{uid(it)}-{n}"
        keep.append(it)
    items[:] = keep
    for it in items:
        if it.get("partTopics"):
            pts = {k: f"{uid(it)}-{num[v]}" for k, v in it["partTopics"].items()
                   if num[v] < int(it["topic"].split("-")[1])}
            if pts: it["partTopics"] = pts
            else: del it["partTopics"]
    used = {it["topic"] for it in items}
    topics = []
    for u, _, native in UNITS:
        ns = sorted(set(native) | {int(t.split("-")[1]) for t in used if t.startswith(u + "-")})
        topics += [dict(id=f"{u}-{n}", num=n, name=name[n], group=u) for n in ns]
    ALLP = {**NAMES["as"], **NAMES["a2"]}
    out_data = dict(spec="YCH11", label="Edexcel International A Level Chemistry YCH11",
                    modular=True,
                    groups=[[u, label] for u, label, _ in UNITS],
                    topics=topics,
                    points={u: ALLP for u, _, _ in UNITS}, pdfs=pdfs, items=items)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(out_data, open(out, "w"), separators=(",", ":"))
    from collections import Counter
    c = Counter(i["topic"] for i in items)
    TOPICS[:] = [(t["id"], t["num"], t["name"], t["group"]) for t in topics]
    print(len(items), "items;", sum(1 for i in items if not i["part"]), "whole questions;",
          sum(1 for i in items if i["part"]), "parts;", sum(1 for i in items if i.get("ans")), "multiple choice with answers; not found:", missing)
    for t in TOPICS:
        print(f"  {t[3]} {t[1]} {t[2]:60} {c.get(t[0], 0)}")


if __name__ == "__main__":
    main()
