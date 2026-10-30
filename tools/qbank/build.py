"""Turn extracted question positions into the 9MA0 question bank (assets/qbank/9ma0.json).

Topic rule for questions covering several topics:
  - each part is tagged on its own
  - the whole question goes under the latest topic (in spec order) any part covers
  - parts tagged with an earlier topic also appear under that topic, shown with the question's opening lines

Usage: python3 tools/qbank/build.py extracted.json papers_dir out.json
"""
import json, os, re, sys
import pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import NUM, NAMES, points_for, key as spec_key

# Spec order (Pearson Edexcel A Level Mathematics 9MA0)
TOPICS = [
    ("proof", "Proof", "pure"),
    ("algebra", "Algebra and functions", "pure"),
    ("coord", "Coordinate geometry", "pure"),
    ("sequences", "Sequences and series", "pure"),
    ("trig", "Trigonometry", "pure"),
    ("explog", "Exponentials and logarithms", "pure"),
    ("diff", "Differentiation", "pure"),
    ("integ", "Integration", "pure"),
    ("numerical", "Numerical methods", "pure"),
    ("vectors", "Vectors", "pure"),
    ("sampling", "Statistical sampling", "stats"),
    ("data", "Data presentation and interpretation", "stats"),
    ("prob", "Probability", "stats"),
    ("dist", "Statistical distributions", "stats"),
    ("hyp", "Statistical hypothesis testing", "stats"),
    ("units", "Quantities and units in mechanics", "mech"),
    ("kin", "Kinematics", "mech"),
    ("forces", "Forces and Newton's laws", "mech"),
    ("moments", "Moments", "mech"),
]
ORDER = {t[0]: i for i, t in enumerate(TOPICS)}
GROUP = {t[0]: t[2] for t in TOPICS}

# (pattern, weight) per topic; matched against lower-cased text
KW = {
    "proof": [(r"\bprove\b", 4), (r"\bproof\b", 4), (r"contradiction", 5), (r"counter[- ]?example", 5), (r"disprove", 5), (r"\bfor all\b", 2), (r"\bexhaustion", 4)],
    "algebra": [(r"\bf\s?\(\s?x\s?\)", 1), (r"\bdomain\b", 3), (r"\brange of\b", 3), (r"\binverse\b", 3), (r"\bf\s?-\s?1|f −1", 3), (r"composite|\bfg\s?\(|\bgf\s?\(", 4),
                (r"partial fractions?", 4), (r"modulus|\|\s?x", 3), (r"inequalit", 2), (r"factor theorem|is a factor of|remainder", 4), (r"\bquadratic\b", 2),
                (r"discriminant", 4), (r"simultaneous", 2), (r"\bpolynomial", 2), (r"transformation|transformed|is mapped|stretch|translation|sketch the graph", 3),
                (r"\basymptote", 2), (r"proportional", 2), (r"surd|rationali[sz]e", 3), (r"\bindices\b", 2), (r"\bcubic\b", 2), (r"\breal roots?\b", 2), (r"many-one|one-one", 4)],
    "coord": [(r"(?<!sector of a )(?<!segment of a )\bcircle\b", 4), (r"\bcentre\b", 2), (r"\bradius\b", 2), (r"parametric", 5), (r"\bparameter\b", 4), (r"cartesian equation", 5),
              (r"\bline l\b|line l1|line l2|the line l", 2), (r"perpendicular", 2), (r"\bmid-?point", 2), (r"equation of the line", 2), (r"\bx = .{0,12}\bt\b.{0,25}\by = ", 3)],
    "sequences": [(r"arithmetic", 4), (r"geometric", 4), (r"\bsequence", 4), (r"\bseries\b", 3), (r"sum to infinity", 5), (r"common ratio", 5), (r"common difference", 5),
                  (r"binomial expansion|expand .{0,25} in ascending powers|ascending powers", 5), (r"\bnth term|\bn th term|\bu\s?n\s?\+\s?1|un\+1|recurrence", 3),
                  (r"\bs\s?n\b|\bsum of the first", 3), (r"converge", 3), (r"∑|σ", 2), (r"\bterm\b", 1)],
    "trig": [(r"\bsin\b|\bsin\s?\d|sin ?θ|sin ?x", 2), (r"\bcos\b|cos ?θ|cos ?x", 2), (r"\btan\b|tan ?θ|tan ?x", 2), (r"\bsec\b|cosec|\bcot\b", 4),
             (r"\bradians?\b", 2), (r"\barc\b|arc length", 3), (r"\bsector\b", 3), (r"θ", 2), (r"identit", 2), (r"r\s?cos\s?\(|r\s?sin\s?\(|\br > 0.{0,40}α", 4),
             (r"small angle", 5), (r"arcsin|arccos|arctan", 4), (r"\bsin\s?2|cos\s?2|double angle", 2)],
    "explog": [(r"\bln\b|\bln\s?\(|\blog\b|\blog\s?\d|logarithm", 4), (r"\be\s?\^", 2), (r"exponential", 5), (r"\bgrowth\b|\bdecay\b", 2), (r"half-?life", 3), (r"taking logarithms", 5),
               (r"log\s?10|log10", 4), (r"straight line graph .{0,40}log", 3)],
    "diff": [(r"d\s?y\s?/?\s?d\s?x|dy dx|\bd d y\b|\bd y x\b|\bd2\b|d\s?2\s?y", 4), (r"differentiat", 4), (r"stationary", 4), (r"\bmaximum\b|\bminimum\b", 2), (r"turning point", 4), (r"rate of change", 3),
             (r"gradient of the curve|gradient of c\b", 3), (r"tangent to (?:the )?curve|tangent to c\b|\bnormal to\b", 3), (r"point of inflection|inflexion", 5),
             (r"\bconcave\b|\bconvex\b", 5), (r"implicit", 4), (r"\bd\s?/\s?d\s?x|ddx", 3), (r"increasing|decreasing", 2), (r"d\s?[vhra]\s?/?\s?d\s?t|connected rates", 3),
             (r"first principles|differentiation from first", 6), (r"\bf\s?′|f'\s?\(", 3)],
    "integ": [(r"integrat", 4), (r"\bintegral\b", 4), (r"∫", 4), (r"(?<![\w(])(?<!d )d(?=\s(?![yd]\b|d\d|[yd]\s?[xt]\b))(?!\s?\()", 4), (r"δ\s?x\s?→|δx\s?→|lim\b", 3), (r"\barea\b", 1), (r"\bregion\s?r\b|region r|the region", 3), (r"differential equation", 5), (r"by parts", 5),
              (r"substitution", 3), (r"\bd\s?x\b", 1), (r"bounded by", 3), (r"\bdx\b", 2)],
    "numerical": [(r"iterat", 5), (r"x\s?n\s?\+\s?1|xn\+1|x\s?n\+1", 4), (r"newton[- ]raphson", 6), (r"change of sign|sign change", 4), (r"trapezium rule", 6),
                  (r"\bstrips?\b|ordinates", 3), (r"\broot\b.{0,40}\binterval\b|lies (?:in|between) the interval|\bα lies", 3), (r"staircase|cobweb", 4)],
    "vectors": [(r"\bvectors?\b", 4), (r"position vector", 5), (r"\bi\s?[+−-]\s?\d*\s?j\b|\d\s?i\s?[+−-]\s?\d*\s?j", 3), (r"\bk\b.{0,6}\)?$", 0), (r"unit vector", 4),
                (r"magnitude", 2), (r"→|\boa\b|\bob\b|\bab\b", 1), (r"parallelogram", 2), (r"collinear", 3)],
    "sampling": [(r"\bsampl", 3), (r"\bpopulation\b", 3), (r"census", 5), (r"opportunity|stratified|quota|systematic|simple random sample", 5), (r"sampling frame|sampling unit", 5), (r"large data set", 2)],
    "data": [(r"box (?:and whisker )?plot", 5), (r"histogram", 5), (r"outlier", 4), (r"\bmean\b", 2), (r"standard deviation", 3), (r"\bmedian\b|quartile|interquartile", 3),
             (r"\bcorrelation\b", 2), (r"regression", 4), (r"scatter", 4), (r"coding|coded", 4), (r"cumulative frequency", 4), (r"\bskew", 3), (r"∑\s?x|σ\s?x|sum of", 2),
             (r"\bvariance\b", 2), (r"interpolation", 4), (r"line of best fit", 3), (r"y\s?=\s?a\s?\+\s?b\s?x|explanatory|response variable", 4)],
    "prob": [(r"\bprobabilit", 1), (r"venn", 5), (r"independent", 4), (r"mutually exclusive", 5), (r"conditional", 4), (r"tree diagram", 5), (r"given that", 1), (r"\bp\s?\(\s?[a-z]\s?[∩∪|]", 4), (r"∩|∪", 4)],
    "dist": [(r"binomial", 4), (r"\bb\s?\(\s?\d", 4), (r"normal distribution|normally distributed", 5), (r"\bn\s?\(\s?[\dμ]", 4), (r"random variable", 3), (r"~", 2),
             (r"probability distribution", 4), (r"discrete", 2), (r"approximation", 2), (r"\bdistributed\b", 3), (r"standard normal|\bz\s?~", 4)],
    "hyp": [(r"hypothes", 6), (r"significance level|\d+\s?%\s?(?:level|significance)", 5), (r"critical region|critical value", 6), (r"\bh\s?0\b|\bh\s?1\b|h0|h1", 5),
            (r"p-value|p value", 5), (r"\btest\b", 3), (r"\bclaim", 2), (r"actual significance", 5), (r"\bpmcc\b|product moment", 3)],
    "units": [(r"\bsi units?\b|base units|dimension", 5)],
    "kin": [(r"velocity", 3), (r"acceleration", 2), (r"\bspeed\b", 2), (r"displacement", 3), (r"projected|projectile", 5), (r"constant acceleration", 4),
            (r"speed[- ]time|velocity[- ]time|distance[- ]time", 5), (r"\bv\s?=\s?|\bs\s?=\s?", 1), (r"t seconds", 2), (r"\bm\s?s\s?[-−]?\s?[12]|m s–1|m s-1|m s–2|m s-2", 2),
            (r"moving in a straight line|moves along", 3), (r"at rest", 1)],
    "forces": [(r"\bforce", 3), (r"tension", 4), (r"friction", 4), (r"coefficient of friction", 4), (r"resistance", 3), (r"normal reaction|\breaction\b", 2),
               (r"inclined|inclination|rough plane|smooth plane|slope", 4), (r"pulley", 5), (r"\bstring\b", 3), (r"\bweight\b", 2), (r"newton", 2), (r"\bnewtons?\b|\bn\b", 1),
               (r"equilibrium", 2), (r"\bmass\b.{0,20}\bkg\b", 1), (r"connected|tow|towbar|lift", 2), (r"limiting", 3)],
    "moments": [(r"\bmoments?\b", 6), (r"\brod\b", 4), (r"\bbeam\b|\bplank\b", 5), (r"\bladder\b", 6), (r"pivot|fulcrum|hinged|hinge", 5), (r"centre of mass", 4),
                (r"point of tilting|about to tilt|on the point of", 3), (r"uniform rod|non-uniform", 4), (r"\bsupports?\b", 3)],
}

def spec_points(text, topic, group):
    """Spec points for a piece of a question: points with evidence in its own topic, in the topic it scores best on,
    and in any other topic with strong evidence; the topic's main point if nothing matches."""
    low = clean(text).lower()
    sc = score(text, group)
    look = [topic] if topic else []
    if sc:
        b, bs = max(sc.items(), key=lambda kv: kv[1])
        if bs >= 4: look.append(b)
        look += [t for t, v in sc.items() if v >= 10 and v >= 0.75 * bs]
    out = []
    for t in dict.fromkeys(look):
        out += points_for(text, t, low, need=True)[:2 if t == topic else 1]
    return out or (points_for(text, topic, low) if topic else [])

def allowed_for(paper):
    return {"1": "pure", "2": "pure", "31": "stats", "32": "mech"}.get(paper)

def clean(text):
    t = re.sub(r"\*?P\d{5}[A-Z]?\d{0,6}\*?", " ", text or "")       # barcodes
    t = re.sub(r"\(cid:\d+\)", " ", t)                                 # font debris
    t = re.sub(r"In this question you (?:must|should) show all stages of your working\.?\s*Solutions relying (?:entirely )?on calculator technology are not acceptable\.?", " ", t, flags=re.I)
    return re.sub(r"\s+", " ", t)

def score(text, group):
    t = clean(text).lower()
    out = {}
    for tid, pats in KW.items():
        if GROUP[tid] != group:
            continue
        s = 0
        for pat, w in pats:
            if w:
                s += w * min(3, len(re.findall(pat, t)))
        if s:
            out[tid] = s
    return out

def best(text, group, fallback=None):
    sc = score(text, group)
    if not sc:
        return fallback
    return max(sc.items(), key=lambda kv: (kv[1], ORDER[kv[0]]))[0]

def ms_pages(ms_path, nq):
    """Find where each question and part starts in a mark scheme.
    Question labels sit in the left 'Question' column in bold (e.g. "15(a)", or "15" then "(b)").
    Returns {(q, part or None): (page, y as a fraction of page height)} using the first occurrence."""
    at = {}
    try:
        with pdfplumber.open(ms_path) as pdf:
            cur = 0
            for pn in range(2, len(pdf.pages)):
                pg = pdf.pages[pn]
                H = float(pg.height)
                ws = [w for w in pg.extract_words(extra_attrs=["fontname"]) if w["x0"] < 150 and "Bold" in w["fontname"]]
                ws.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
                for w in ws:
                    t = w["text"].replace(" ", "")
                    pos = (pn + 1, round(max(0, w["top"] - 14) / H, 4))
                    m = re.fullmatch(r"(\d{1,2})(?:\(([a-z])\)(?:\([ivx]+\))?)?", t)
                    if m:
                        n = int(m.group(1))
                        if cur < n <= min(cur + 2, nq) or (n == cur and m.group(2)):
                            cur = n
                            at.setdefault((n, None), pos)
                            if m.group(2): at.setdefault((n, m.group(2)), pos)
                        continue
                    m = re.fullmatch(r"\(([a-z])\)(?:\([ivx]+\))?", t)
                    if m and cur:
                        at.setdefault((cur, m.group(1)), pos)
    except Exception:
        pass
    return at

SERIES = {"jun": "June", "nov": "November"}

def main():
    ext, papers_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.load(open(ext))
    items, pdfs = [], {}
    for f, r in sorted(data.items()):
        m = re.match(r"9ma0-p(\d+)-qp-(jun|nov)(\d{4})\.pdf", f)
        pnum, mon, yr = m.groups()
        series = f"{SERIES[mon]} {yr}"
        src = f"/files/a-level/edexcel/maths/papers/{f}"
        msf = f.replace("-qp-", "-ms-")
        ms = f"/files/a-level/edexcel/maths/papers/{msf}" if os.path.exists(os.path.join(papers_dir, msf)) else None
        msp = ms_pages(os.path.join(papers_dir, msf), len(r["questions"])) if ms else {}
        with pdfplumber.open(os.path.join(papers_dir, f)) as _pdf:
            _pg = _pdf.pages[1]
            cb, mb = _pg.cropbox, _pg.mediabox
        # the browser renderer draws the crop box; positions here are measured on the media box
        x1 = r.get("x1")
        if x1 is None or abs(x1 - round(0.905 * r["W"], 1)) < 0.2:  # marks not found (scanned paper): use a wider crop
            x1 = round(0.935 * r["W"], 1)
        pdfs[src] = dict(W=r["W"], H=r["H"], x0=r.get("x0"), x1=x1, cx=round(cb[0] - mb[0], 2), cy=round(mb[3] - cb[3], 2))
        combined = pnum == "3"  # June 2018 combined Statistics & Mechanics paper
        for q in r["questions"]:
            # paper type
            if combined:
                g = "stats" if sum(score(q["text"], "stats").values()) >= sum(score(q["text"], "mech").values()) else "mech"
                paper_label = "Paper 3"
                ptype = g
            else:
                g = allowed_for(pnum)
                paper_label = f"Paper {pnum}"
                ptype = g
            qtopic_fallback = best(q["text"], g, fallback={"pure": "algebra", "stats": "data", "mech": "kin"}[g])
            if g == "mech" and score(q["text"], "mech").get("moments", 0) >= 8:
                qtopic_fallback = "moments"  # rods, beams, planks and ladders in equilibrium are moments questions
            base = dict(series=series, year=int(yr), paper=paper_label, ptype=ptype, q=q["q"], src=src, ms=ms, msAt=msp.get((q["q"], None)))
            parts = q.get("parts") or []
            if parts:
                stem_t = q.get("stem_text", "")
                ptags = []
                for p in parts:
                    # A part gets its own topic only with clear evidence; otherwise it shares the question's main topic.
                    sc = score(p["text"], g)
                    tag = qtopic_fallback
                    if sc:
                        cand, cs = max(sc.items(), key=lambda kv: (kv[1], ORDER[kv[0]]))
                        if cand != qtopic_fallback and cs >= 6 and cs >= 1.5 * sc.get(qtopic_fallback, 0):
                            tag = cand
                    ptags.append(tag)
                top = max(ptags, key=lambda t: ORDER[t])
                pspec = [spec_points(stem_t + " " + p["text"], t, g) for p, t in zip(parts, ptags)]
                allspec = sorted({c for ps in pspec for c in ps}, key=spec_key)
                items.append(dict(base, id=f"{f[:-4]}-q{q['q']}", part=None, topic=top, spec=allspec, marks=q["marks"], segs=q["segs"],
                                  partTopics={p["label"]: t for p, t in zip(parts, ptags)}, text=clean(q["text"])[:400]))
                for p, t, ps in zip(parts, ptags, pspec):
                    if ORDER[t] < ORDER[top]:
                        lab = re.sub(r"[^a-z]", "", p["label"])[:1]
                        items.append(dict(base, msAt=msp.get((q["q"], lab)) or base["msAt"], spec=sorted(set(ps), key=spec_key), id=f"{f[:-4]}-q{q['q']}{p['label']}", part=p["label"], topic=t, marks=p["marks"],
                                          segs=q.get("stem", []) + p["segs"], text=clean(stem_t + " " + p["text"])[:400]))
            else:
                items.append(dict(base, id=f"{f[:-4]}-q{q['q']}", part=None, topic=qtopic_fallback,
                                  spec=sorted(set(spec_points(q["text"], qtopic_fallback, g)), key=spec_key), marks=q["marks"], segs=q["segs"], text=clean(q["text"])[:400]))
    for it in items:   # not found: start at the previous question's mark scheme instead of page 1
        if not it.get("msAt") and it.get("ms"):
            prev = [o["msAt"] for o in items if o.get("ms") == it["ms"] and o["q"] < it["q"] and o.get("msAt")]
            if prev: it["msAt"] = max(prev)
    for it in items:   # page + position for the viewer; keep msPage for older code
        a = it.pop("msAt", None)
        if a: it["msPage"], it["msY"] = a
    out_data = dict(spec="9MA0", topics=[dict(id=t[0], num=NUM[t[0]], name=t[1], group=t[2]) for t in TOPICS],
                    points=NAMES, pdfs=pdfs, items=items)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(out_data, open(out, "w"), separators=(",", ":"))
    from collections import Counter
    c = Counter(i["topic"] for i in items)
    print(len(items), "items;", sum(1 for i in items if not i["part"]), "whole questions;", sum(1 for i in items if i["part"]), "parts")
    for t in TOPICS:
        print(f"  {t[1]:40} {c.get(t[0], 0)}")

if __name__ == "__main__":
    main()
