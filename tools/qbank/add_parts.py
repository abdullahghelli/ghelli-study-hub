"""Add each question's part positions to a built question bank, so a worksheet can leave out parts nobody picked.

For every whole question whose extraction found two or more labelled parts, the item gets
  stem:  segments of the opening lines before part (a)
  parts: [{l: "a", m: marks, s: segments}, ...] in order
Segments are [page, y0, y1] in PDF points from the top of the page, as everywhere else in the bank.
Only questions whose extracted segments match the bank's are touched (some builders move the first segment's top up
to take in the question number, so that one value may differ), so a bank built from other data is left as it is.

Usage: python3 tools/qbank/add_parts.py bank.json ext.json [ext.json ...]
"""
import json, sys


def main():
    bank, exts = sys.argv[1], sys.argv[2:]
    ext = {}
    for f in exts:
        ext.update(json.load(open(f)))
    d = json.load(open(bank))
    added = whole = 0
    for it in d["items"]:
        if it["part"]:
            continue
        whole += 1
        it.pop("parts", None); it.pop("stem", None)
        r = ext.get(it["src"].split("/")[-1])
        q = next((x for x in (r or {}).get("questions", []) if x["q"] == it["q"]), None)
        same = lambda a, b: len(a) == len(b) and all(x[0] == y[0] and x[2] == y[2] and (k == 0 or x[1] == y[1]) and abs(x[1] - y[1]) < 25
                                                     for k, (x, y) in enumerate(zip(a, b)))
        if not q or not same(q["segs"], it["segs"]):
            continue
        ps = [p for p in q.get("parts") or [] if p.get("segs")]
        if len(ps) < 2:
            continue
        it["stem"] = q.get("stem") or []
        it["parts"] = [dict(l=p["label"], m=p["marks"], s=p["segs"]) for p in ps]
        added += 1
    json.dump(d, open(bank, "w"), separators=(",", ":"))
    print(f"{bank}: parts added to {added} of {whole} questions")


if __name__ == "__main__":
    main()
