"""Build the Cambridge International AS & A Level Chemistry 9701 question bank: assets/qbank/9701.json.
Papers 1 (multiple choice), 2 (AS structured) and 4 (A Level structured), 2021 to 2026, every variant.

  - overrides_9701.json: for each paper, the spec points each question covers. A question goes under the
    latest topic, in spec order, that it covers. 2021 Paper 1 lists only questions 1-30: Section B
    (questions 31-40) is left out.
  - keys_9701.json: Paper 1 answer keys (the A-D answer each multiple-choice question carries as "ans").

Usage: python3 tools/qbank/build_9701.py ext_dir out.json
  then: python3 tools/qbank/add_ms_parts.py out.json   (where each part starts in the mark scheme)
  ext_dir holds the ext-p<paper><variant>.json files from extract_caie.py.
"""
import glob, json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_9701 import TOPICS, GROUPS, NAMES
from build_ch import clean
from extract_caie import bbox_words

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = "/files/a-level/cambridge/chemistry/papers/"
PAPERS = "files" + WEB[len("/files"):]
SERIES = {"mar": "Feb/Mar", "jun": "May/Jun", "nov": "Oct/Nov"}
TOTAL = {"1": 40, "2": 60, "4": 100}
LABEL = re.compile(r"(\d{1,2})(?:\(([a-z])\))?(?:\(.*)?")


def ms_pages(path, nq, col=0.13):
    """Where each question (and part) starts in a Cambridge mark scheme: {(q, part or None): (page, y fraction)}.
    Labels such as "3", "3(b)" or "3(b)(ii)" sit in the left-hand "Question" column; reading starts at the first
    page with that heading, and a question counts only once the previous one has been found."""
    at, cur = {}, 0
    with pdfplumber.open(path) as pdf:
        sizes = [(float(p.width), float(p.height)) for p in pdf.pages]
    started = False
    for pn, (W, H) in enumerate(sizes):
        ws = bbox_words(path, pn)
        if not started:
            started = any(w["text"] == "Question" for w in ws)
            if not started:
                continue
        # the "Question" column only (a subscript "2" in the answer column is not question 2)
        for w in sorted((w for w in ws if w["x0"] < col * W and 0.05 * H < w["top"] < 0.95 * H), key=lambda w: (w["top"], w["x0"])):
            m = LABEL.fullmatch(w["text"])
            if not m:
                continue
            q, part = int(m.group(1)), m.group(2)
            pos = (pn + 1, round(max(0, w["top"] - 6) / H, 4))
            if q == cur + 1 and q <= nq:
                cur = q
                at[(q, None)] = pos
            if q == cur and part:
                at.setdefault((q, part), pos)
    return at


MARKS = re.compile(r"\[(\d{1,2})\]$")


def mark_sum(path, segs, cy):
    """The marks ("[n]" at the right) inside a part's segments."""
    tot = 0
    for pn, y0, y1 in segs:
        ws = bbox_words(path, pn - 1)
        W = max((w["x1"] for w in ws), default=600)
        for w in ws:
            m = MARKS.search(w["text"])
            if m and w["x1"] > 0.75 * W and y0 - 2 <= w["top"] + cy <= y1 + 4 and not w["text"].lower().startswith("[total"):
                tot += int(m.group(1))
    return tot


PLABEL = re.compile(r"^\(([a-z])\)")


def rebound(path, ps, cy):
    """Where each part really starts: after the last "[n]" of the part before it (lines leading into a part belong to
    it). The extractor's boundaries are off where it missed a mark, so a part could take in the end of the one before;
    the parts' segments are cut again at these points."""
    pieces = sorted([tuple(x) for p in ps for x in p["s"]])
    if not pieces:
        return
    pages = sorted({x[0] for x in pieces})
    words = []
    for pn in pages:
        ws = bbox_words(path, pn - 1)
        W = max((w["x1"] for w in ws), default=600)
        for w in ws:
            y = w["top"] + cy
            if not any(x[0] == pn and x[1] - 3 <= y <= x[2] + 3 for x in pieces):
                continue
            m = PLABEL.match(w["text"])
            if m and w["x0"] < 0.16 * W:
                words.append(("l", m.group(1), pn, y, y))
            elif MARKS.search(w["text"]) and w["x1"] > 0.75 * W:
                words.append(("m", None, pn, y, w["bottom"] + cy))
    words.sort(key=lambda e: (e[2], e[3]))
    cuts, prev = [], (0, 0)
    for k in range(1, len(ps)):
        lab = next(((e[2], e[3]) for e in words if e[0] == "l" and e[1] == ps[k]["l"] and (e[2], e[3]) > prev), None)
        if not lab:
            return
        marks = [(e[2], e[4]) for e in words if e[0] == "m" and prev < (e[2], e[3]) < lab]
        cuts.append((marks[-1][0], marks[-1][1] + 6) if marks else (lab[0], lab[1] - 4))
        prev = lab
    out = [[] for _ in ps]
    for pn, y0, y1 in pieces:
        k = 0
        while k < len(cuts) and (pn, y0) >= cuts[k]:
            k += 1
        while k < len(cuts) and cuts[k][0] == pn and y0 < cuts[k][1] < y1:
            if cuts[k][1] - y0 > 2:
                out[k].append([pn, round(y0, 1), round(cuts[k][1], 1)])
            y0 = cuts[k][1]; k += 1
        if y1 - y0 > 2:
            out[k].append([pn, round(y0, 1), round(y1, 1)])
    if all(out):
        for p, segs in zip(ps, out):
            p["s"] = segs


def main():
    ext_dir, out = sys.argv[1], sys.argv[2]
    data = {}
    for f in sorted(glob.glob(os.path.join(ext_dir, "ext-p[124][1-4].json"))):
        data.update(json.load(open(f)))
    ov = {k: v for k, v in json.load(open(os.path.join(HERE, "overrides_9701.json"))).items() if not k.startswith("_")}
    keys = {k: v for k, v in json.load(open(os.path.join(HERE, "keys_9701.json"))).items() if not k.startswith("_")}
    num = {t[0]: t[1] for t in TOPICS}
    items, pdfs, problems = [], {}, []
    for f, r in sorted(data.items()):
        pid = f[:-4]
        m = re.match(r"9701-p([124])([1-4])-qp-(mar|jun|nov)(\d{4})\.pdf", f)
        paper, var, mon, yr = m.groups()
        codes = ov.get(pid)
        if codes is None:
            problems.append(("not classified", pid)); continue
        src = WEB + f
        msf = f.replace("-qp-", "-ms-")
        has_ms = os.path.exists(os.path.join(PAPERS, msf))
        ms = WEB + msf if has_ms else None
        msp = ms_pages(os.path.join(PAPERS, msf), len(r["questions"]), 0.2 if paper == "1" else 0.13) if has_ms else {}
        with pdfplumber.open(os.path.join(PAPERS, f)) as pdf:
            cb, mb = pdf.pages[1].cropbox, pdf.pages[1].mediabox
        x1 = r.get("x1") or round(0.935 * r["W"], 1)
        pdfs[src] = dict(W=r["W"], H=r["H"], x0=r.get("x0"), x1=x1, cx=round(cb[0] - mb[0], 2), cy=round(mb[3] - cb[3], 2))
        qs = r["questions"]
        # a few structured questions lost their "[Total: n]": the paper total less the others
        if paper != "1":
            gap = [q for q in qs if not q["marks"]]
            if len(gap) == 1:
                gap[0]["marks"] = TOTAL[paper] - sum(q["marks"] for q in qs if q["marks"])
            elif gap:
                problems.append(("no totals", pid, [q["q"] for q in gap]))
        if paper == "1":
            keep = 30 if yr == "2021" else 40
            if len(qs) != 40 or len(codes) != keep:
                problems.append(("mcq count", pid, len(qs), len(codes)))
            qs = qs[:keep]
        elif len(codes) != len(qs):
            problems.append(("count", pid, len(qs), len(codes))); continue
        key = keys.get(pid)
        last = None
        for q, spec in zip(qs, codes):
            assert all(c in NAMES for c in spec), (pid, q["q"], spec)
            topic = "t" + str(max(int(c.split(".")[0]) for c in spec))
            at = msp.get((q["q"], None)) or last
            last = at or last
            it = dict(id=f"{pid}-q{q['q']}", part=None, topic=topic,
                      spec=sorted(set(spec), key=lambda c: tuple(map(int, c.split(".")))),
                      series=f"{SERIES[mon]} {yr}", year=int(yr), paper=f"Paper {paper}{var}", ptype=f"p{paper}",
                      q=q["q"], src=src, ms=ms, marks=1 if paper == "1" else q["marks"], segs=q["segs"],
                      text=clean(q["text"])[:400], checked=True)
            if at and ms:
                it.update(msPage=at[0], msY=at[1])
            # parts, so a worksheet can keep just the ones picked (see add_parts.py)
            ps = [dict(l=x["label"], m=x["marks"], s=x["segs"]) for x in q.get("parts") or [] if x.get("segs")]
            stem = q.get("stem") or []
            # "1 (a) ..." on one line: the (a) sits behind the question number and isn't read as a part; it is
            # everything before (b)
            if ps and ps[0]["l"] == "b" and stem:
                ps = [dict(l="a", m=None, s=stem)] + ps; stem = []
            if paper != "1" and len(ps) >= 2 and [x["l"] for x in ps] == [chr(97 + k) for k in range(len(ps))] and q["marks"]:
                # marks: the "[n]"s in each part, read again from the page (the extractor misses some), else the
                # extractor's, with one part's left out filled from the total
                rebound(os.path.join(PAPERS, f), ps, pdfs[src]["cy"])
                again = [mark_sum(os.path.join(PAPERS, f), x["s"], pdfs[src]["cy"]) for x in ps]
                if all(again) and sum(again) == q["marks"]:
                    for x, m in zip(ps, again): x["m"] = m
                else:
                    gap = [x for x in ps if not x["m"]]
                    if len(gap) == 1 and q["marks"] - sum(x["m"] for x in ps if x["m"]) > 0:
                        gap[0]["m"] = q["marks"] - sum(x["m"] for x in ps if x["m"])
                if all(x["m"] for x in ps) and sum(x["m"] for x in ps) == q["marks"]:
                    it["stem"] = stem
                    it["parts"] = ps
            if paper == "1":
                it["mcq"] = True
                if key:
                    it["ans"] = key[q["q"] - 1]
            items.append(it)

    # the same question set in more than one variant (whole papers, e.g. Oct/Nov 11 and 13, or single questions):
    # keep the first copy (lowest variant)
    # compared within one series and paper type; extraction can differ a little between copies, so near matches count
    from difflib import SequenceMatcher
    norm = lambda t: re.sub(r"[^a-z]", "", re.sub(r"^\s*\d{1,2}\s|\([a-z]{1,4}\)", " ", t.lower()))[:300]
    seen, kept, dups = {}, [], 0
    for it in sorted(items, key=lambda i: (i["year"], i["series"], i["ptype"], i["paper"], i["q"])):
        k, t = (it["series"], it["ptype"]), norm(it["text"])
        if len(t) > 40 and any(SequenceMatcher(None, t, u).ratio() > 0.85 for u in seen.get(k, [])):
            dups += 1; continue
        seen.setdefault(k, []).append(t); kept.append(it)
    # a paper that is mostly a copy of another variant is a copy throughout (its few unmatched questions were read a
    # little differently, e.g. a diagram with labels): leave it out whole
    from collections import Counter
    total, left = Counter(i["src"] for i in items), Counter(i["src"] for i in kept)
    copies = {src for src in total if left[src] < 0.4 * total[src]}
    dups += sum(left[src] for src in copies)
    items = sorted((i for i in kept if i["src"] not in copies), key=lambda i: (i["src"], i["q"]))
    print(dups, "repeated questions left out")

    used = {c for it in items for c in it["spec"]}
    out_data = dict(spec="9701", label="Cambridge International AS & A Level Chemistry 9701",
                    groups=[list(g) for g in GROUPS],
                    topics=[dict(id=t[0], num=t[1], name=t[2], group=t[3]) for t in TOPICS],
                    points={g: {c: n for c, n in NAMES.items() if c in used and ("t" + c.split(".")[0]) in
                                {t[0] for t in TOPICS if t[3] == g}} for g, _ in GROUPS},
                    papers=[["p1", "Paper 1 · Multiple choice"], ["p2", "Paper 2 · AS structured"], ["p4", "Paper 4 · A Level structured"]],
                    pdfs=pdfs, items=items)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(out_data, open(out, "w"), separators=(",", ":"))
    from collections import Counter
    c = Counter(i["topic"] for i in items)
    print(len(items), "questions;", sum(1 for i in items if i.get("mcq")), "multiple choice;",
          sum(1 for i in items if i.get("ans")), "with answers;", sum(1 for i in items if i.get("msPage")), "with mark scheme positions")
    print("problems:", problems)
    for t in TOPICS:
        print(f"  {t[1]:>2} {t[2]:55} {c.get(t[0], 0)}")


if __name__ == "__main__":
    main()
