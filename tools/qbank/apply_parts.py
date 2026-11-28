"""Apply the part-by-part spec mapping (parts_<code>.json) to a built maths bank (9MA0 or 8MA0).

parts_<code>.json maps each question part ("9ma0-p1-qp-jun2018-q2a") or whole question with no parts ("...-q1") to
  spec:  9MA0 spec points, prefixed P (pure), S (statistics) or M (mechanics), main point first
  needs: earlier parts whose text a student needs to see with this part
Both 8MA0 and 9MA0 use the 9MA0 numbering. The mapping was made from each part's question and mark scheme by two
independent taggers, with every disagreement settled against the specification.

In the bank:
  - a point from the question's own section (pure, statistics or mechanics) is written without its prefix ("7.3");
    one from another section keeps it ("P10.2" in a mechanics question)
  - a whole question lists every point its parts cover, and partSpec gives each part's points
  - it sits under the latest topic (in spec order) of its parts' main points; a part whose main point is in an
    earlier topic is also listed under that topic, shown with the question's opening lines and any earlier parts
    it needs (faded, labelled), as ctx
  - Statistics 2.5 and Mechanics 6.2 (not in the specification) are folded into 2.4 and 6.1

4MA1 (International GCSE, Higher) uses the specification's lettered outcomes ("F1.6G", "H2.7B": Foundation or
Higher statement, section 1.6 or 2.7, letter). The bank shows the section ("1.6"); topic is the first number.

8FM0 codes are <section>:<point> (cp:2.7, fs1:2.4); each section of spec_fm8.py is its own group.

Usage: python3 tools/qbank/apply_parts.py <9ma0|8ma0|4ma1|8fm0>
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
GROUP = {"P": "pure", "S": "stats", "M": "mech"}


def main(code):
    path = os.path.join(ROOT, "assets", "qbank", code + ".json")
    d = json.load(open(path))
    tags = json.load(open(os.path.join(HERE, f"parts_{code}.json")))
    for g, pt in (("stats", "2.5"), ("mech", "6.2")):
        d["points"].get(g, {}).pop(pt, None)
    order = {t["id"]: k for k, t in enumerate(d["topics"])}
    topic_of = {(t["group"], t["num"]): t["id"] for t in d["topics"]}
    if code == "8fm0":   # cp:2.7, fs1:2.4: section id, then the point (spec_fm8.py)
        return main_fm8(d, tags, path)
    ig = code == "4ma1"
    if ig:  # F1.6G -> section 1.6, one group, codes kept in parts_4ma1.json for the notes
        for t in tags.values():
            t["spec"] = list(dict.fromkeys("I" + c[1:-1] for c in t["spec"]))
        GROUP["I"] = "ig"
    tid = lambda c: topic_of.get((GROUP[c[0]], int(c[1:].split(".")[0])))
    wholes = [it for it in d["items"] if not it.get("part")]
    items, missing = [], []
    for w in wholes:
        labs = [p["l"] for p in w.get("parts") or []]
        keys = [w["id"] + l for l in labs] if labs else [w["id"]]
        if any(k not in tags for k in keys):
            missing.append(w["id"]); items.append(w); continue
        main = [tags[k]["spec"][0] for k in keys]
        grp = max(GROUP.values(), key=lambda g: sum(GROUP[c[0]] == g for c in main))
        own = lambda c: GROUP[c[0]] == grp
        show = lambda c: c[1:] if own(c) else c
        allc = []
        for k in keys:
            for c in tags[k]["spec"]:
                if c not in allc: allc.append(c)
        # placed by each part's main point (a supporting point, like the algebra in a proof, doesn't move it)
        top = max((tid(c) for c in main if own(c) and tid(c)), key=order.get, default=None) or \
            max((tid(c) for c in allc if own(c) and tid(c)), key=order.get)
        for k in ("partSpec", "partTopics", "checked"):
            w.pop(k, None)
        w.update(topic=top, spec=[show(c) for c in allc], checked=True)
        if labs:
            w["partSpec"] = {l: [show(c) for c in tags[w["id"] + l]["spec"]] for l in labs}
        items.append(w)
        # parts whose main point is in an earlier topic, listed there too
        segs = {p["l"]: p for p in w.get("parts") or []}
        for l in labs:
            t = tags[w["id"] + l]
            m = next((c for c in t["spec"] if own(c) and tid(c)), None)
            if not m or order[tid(m)] >= order[top]:
                continue
            p = segs[l]
            need = [n for n in t["needs"] if n in segs and n < l]
            ctx = [sg for n in need for sg in segs[n]["s"]]
            pi = {k: w[k] for k in ("series", "year", "paper", "ptype", "q", "src", "ms") if k in w}
            pi.update(id=w["id"] + l, part=l, topic=tid(m), spec=[show(c) for c in t["spec"]], marks=p.get("m"),
                      segs=(w.get("stem") or []) + ctx + p["s"], text=(w.get("text") or "")[:400], checked=True)
            if need:
                pi["ctx"] = dict(start=len(w.get("stem") or []), n=len(ctx), parts=need)
            mp = p.get("mp") or ([w["msPage"], w["msY"]] if "msPage" in w else None)
            if mp:
                pi.update(msPage=mp[0], msY=mp[1])
            items.append(pi)
    d["items"] = items
    json.dump(d, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    n_parts = sum(1 for it in items if it.get("part"))
    print(f"{code}: {len(items)} items ({len(items) - n_parts} questions, {n_parts} parts listed under earlier topics),"
          f" {sum(1 for it in items if it.get('ctx'))} with earlier parts shown; untagged: {missing}")


def main_fm8(d, tags, path):
    """8FM0: every section is its own group; codes are "<group>:<point>". Same placement as main()."""
    # papers with no published mark scheme yet (June 2024 Papers 21 to 28) stay out of the bank for now;
    # their tags are kept in parts_8fm0.json, so rebuilding brings them back once the mark schemes are out
    d["items"] = [it for it in d["items"] if it.get("ms")]
    order = {t["id"]: k for k, t in enumerate(d["topics"])}
    topic_of = {(t["group"], t["num"]): t["id"] for t in d["topics"]}
    grp = lambda c: c.split(":")[0]
    tid = lambda c: topic_of.get((grp(c), int(c.split(":")[1].split(".")[0])))
    items, missing = [], []
    for w in [it for it in d["items"] if not it.get("part")]:
        labs = [p["l"] for p in w.get("parts") or []]
        keys = [w["id"] + l for l in labs] if labs else [w["id"]]
        if any(k not in tags for k in keys):
            missing.append(w["id"]); items.append(w); continue
        main = [tags[k]["spec"][0] for k in keys]
        g = w["ptype"]   # the paper's own section (spec_fm8.PAPER_GROUP)
        own = lambda c: grp(c) == g
        show = lambda c: c.split(":")[1] if own(c) else c
        allc = []
        for k in keys:
            for c in tags[k]["spec"]:
                if c not in allc: allc.append(c)
        top = max((tid(c) for c in main if own(c) and tid(c)), key=order.get, default=None) or \
            max((tid(c) for c in allc if own(c) and tid(c)), key=order.get)
        for k in ("partSpec", "partTopics", "checked"):
            w.pop(k, None)
        w.update(topic=top, spec=[show(c) for c in allc], checked=True)
        if labs:
            w["partSpec"] = {l: [show(c) for c in tags[w["id"] + l]["spec"]] for l in labs}
        items.append(w)
        segs = {p["l"]: p for p in w.get("parts") or []}
        for l in labs:
            t = tags[w["id"] + l]
            m = next((c for c in t["spec"] if own(c) and tid(c)), None)
            if not m or order[tid(m)] >= order[top]:
                continue
            p = segs[l]
            need = [n for n in t["needs"] if n in segs and n < l]
            ctx = [sg for n in need for sg in segs[n]["s"]]
            pi = {k: w[k] for k in ("series", "year", "paper", "ptype", "q", "src", "ms") if k in w}
            pi.update(id=w["id"] + l, part=l, topic=tid(m), spec=[show(c) for c in t["spec"]], marks=p.get("m"),
                      segs=(w.get("stem") or []) + ctx + p["s"], text=(w.get("text") or "")[:400], checked=True)
            if need:
                pi["ctx"] = dict(start=len(w.get("stem") or []), n=len(ctx), parts=need)
            mp = p.get("mp") or ([w["msPage"], w["msY"]] if "msPage" in w else None)
            if mp:
                pi.update(msPage=mp[0], msY=mp[1])
            items.append(pi)
    d["items"] = items
    # the points list: every point some question uses, with its name
    import spec_fm8 as S
    used = {}
    for it in items:
        g0 = next(t["group"] for t in d["topics"] if t["id"] == it["topic"])
        for c in it["spec"]:
            g, k = (c.split(":") if ":" in c else (g0, c))
            used.setdefault(g, set()).add(k)
    d["points"] = {g: {k: n for k, n in S.NAMES[g].items() if k in used.get(g, ())} for g, _ in S.GROUPS}
    json.dump(d, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    n_parts = sum(1 for it in items if it.get("part"))
    print(f"8fm0: {len(items)} items ({len(items) - n_parts} questions, {n_parts} parts listed under earlier topics),"
          f" {sum(1 for it in items if it.get('ctx'))} with earlier parts shown; untagged: {missing}")


if __name__ == "__main__":
    main(sys.argv[1])
