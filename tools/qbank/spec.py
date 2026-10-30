"""Pearson Edexcel A Level Mathematics (9MA0) specification points, with keyword rules for tagging questions.
Numbering follows the specification: Pure topics 1-10 (Papers 1 and 2); Statistics 1-5 and Mechanics 6-9 (Paper 3)."""
import re

NUM = {"proof": 1, "algebra": 2, "coord": 3, "sequences": 4, "trig": 5, "explog": 6, "diff": 7, "integ": 8, "numerical": 9, "vectors": 10,
       "sampling": 1, "data": 2, "prob": 3, "dist": 4, "hyp": 5, "units": 6, "kin": 7, "forces": 8, "moments": 9}

# topic -> (default point, [(point, short name, [(pattern, weight)])])
POINTS = {
 "proof": ("1.1", [("1.1", "Proof", [(r"prove|proof|contradiction|counter[- ]?example|exhaustion|disprove", 3)])]),
 "algebra": ("2.7", [
   ("2.1", "Indices", [(r"\bindices\b|index laws", 4)]),
   ("2.2", "Surds", [(r"surd|rationali[sz]", 5), (r"√", 1)]),
   ("2.3", "Quadratics", [(r"\bquadratic\b", 3), (r"discriminant|completing the square|b ?2 ?[-−] ?4 ?a ?c", 5), (r"\breal roots?\b|equal roots|no real", 3)]),
   ("2.4", "Simultaneous equations", [(r"simultaneous", 5), (r"\bintersect", 2)]),
   ("2.5", "Inequalities", [(r"inequalit|set notation", 5), (r"[⩽⩾≤≥]", 1)]),
   ("2.6", "Polynomials, factor theorem and algebraic division", [(r"factor theorem|is a factor of|remainder|algebraic division|\bfactorise", 4), (r"polynomial|\bcubic\b|quartic", 3)]),
   ("2.7", "Graphs of functions, modulus and proportion", [(r"modulus|\|\s?[\dx]", 4), (r"asymptote", 3), (r"proportional", 3), (r"sketch", 2)]),
   ("2.8", "Composite and inverse functions", [(r"composite|\bfg\s?\(|\bgf\s?\(|\bff\s?\(", 5), (r"\binverse\b|f\s?-\s?1|f −1", 4), (r"\bdomain\b|\brange\b", 3), (r"many-one|one-one", 4)]),
   ("2.9", "Graph transformations", [(r"transformation|transformed|is mapped|stretch|translat|reflect", 4), (r"y\s?=\s?\d?\s?f\s?\(\s?\d?\s?x\s?[+−-]|y\s?=\s?f\s?\(\s?\d\s?x|y\s?=\s?\d\s?f\s?\(", 4)]),
   ("2.10", "Partial fractions", [(r"partial fraction", 6)]),
   ("2.11", "Modelling with functions", [(r"\bmodel", 3)]),
 ]),
 "coord": ("3.1", [
   ("3.1", "Straight lines", [(r"straight line|equation of the line|perpendicular|parallel to|\bgradient\b|y\s?[-−]\s?y\s?1|\bline l", 3), (r"\bmid-?point", 2)]),
   ("3.2", "Circles", [(r"(?<!sector of a )\bcircle\b", 5), (r"\bcentre\b|\bradius\b", 2)]),
   ("3.3", "Parametric equations", [(r"parametric|\bparameter\b", 5), (r"cartesian equation", 4), (r"\bx\s?=.{0,15}\bt\b.{0,30}\by\s?=", 3)]),
   ("3.4", "Parametric modelling", [(r"parametric.{0,200}(model|path|track|race|ball|journey)", 4)]),
 ]),
 "sequences": ("4.2", [
   ("4.1", "Binomial expansion", [(r"binomial expansion|ascending powers|in powers of x|\bvalid\b|expansion of", 5)]),
   ("4.2", "Sequences and recurrence relations", [(r"\bsequence", 2), (r"recurrence|u\s?n\s?\+\s?1|un\+1|periodic|increasing sequence|decreasing sequence|\bnth term|n th term", 4)]),
   ("4.3", "Sigma notation", [(r"∑|σ|sigma", 4)]),
   ("4.4", "Arithmetic sequences and series", [(r"arithmetic", 5), (r"common difference", 4)]),
   ("4.5", "Geometric sequences and series", [(r"geometric", 5), (r"common ratio|sum to infinity|converge", 4)]),
   ("4.6", "Modelling with sequences and series", [(r"each year|per year|every year|salary|savings|\bmodel|£|each month|each week|each day", 3)]),
 ]),
 "trig": ("5.7", [
   ("5.1", "Trig definitions, radians, arcs and sectors", [(r"radians?\b|\barc\b|arc length|\bsector\b", 4), (r"sine rule|cosine rule|area of (?:the )?triangle", 4)]),
   ("5.2", "Small angle approximations", [(r"small angle|θ is small|small value|approximation", 5)]),
   ("5.3", "Trig graphs and periodicity", [(r"graph of y\s?=\s?\d?\s?(?:sin|cos|tan)|period|symmetr", 3)]),
   ("5.4", "sec, cosec, cot and inverse trig functions", [(r"\bsec\b|cosec|\bcot\b|arcsin|arccos|arctan", 4)]),
   ("5.5", "Trig identities", [(r"sin\s?2\s?θ\s?\+\s?cos\s?2|sec\s?2|cosec\s?2|1\s?\+\s?tan\s?2|1\s?\+\s?cot\s?2", 4), (r"identit", 2)]),
   ("5.6", "Compound and double angle formulae, R cos(θ ± α)", [(r"double angle|compound angle|addition formula", 5), (r"\bsin\s?2\s?[θxa]|\bcos\s?2\s?[θxa]|\btan\s?2\s?[θxa]", 3),
          (r"(?:sin|cos|tan)\s?\(\s?[a-zθ]\s?[+−-]\s?[a-zθ\d°]", 3), (r"\br\s?(?:cos|sin)\s?\(|\br\s?>\s?0|α", 4)]),
   ("5.7", "Solving trig equations", [(r"\bsolve\b|\binterval\b|0\s?[⩽<≤]\s?[θx]|[θx]\s?[<⩽≤]\s?(?:360|2\s?π|π|180)", 3)]),
   ("5.8", "Trig proof", [(r"\bprove\b|≡|show that.{0,80}(?:sin|cos|tan|sec|cot)", 3)]),
   ("5.9", "Trig in context", [(r"\bmodel|height|tide|wheel|temperature|depth", 3)]),
 ]),
 "explog": ("6.5", [
   ("6.1", "Exponential graphs", [(r"sketch.{0,40}(?:e\s?x|\d\s?x\b)|graph of y\s?=\s?(?:e|\d)", 3)]),
   ("6.2", "Gradient of e^kx", [(r"gradient.{0,40}e\s?\d?\s?x", 3)]),
   ("6.3", "Logarithms as the inverse of a^x", [(r"\blog\s?[a-z\d]\b", 1)]),
   ("6.4", "Laws of logarithms", [(r"laws of log|single logarithm|log\s?\d?\s?\w+\s?[+−-]\s?log|ln\s?\w+\s?[+−-]\s?ln", 4)]),
   ("6.5", "Solving equations with exponentials and logs", [(r"\bsolve\b|exact value of x|find the value of x", 3), (r"\be\s?\d?\s?x\b|\bln\b", 1)]),
   ("6.6", "Log graphs and estimating parameters", [(r"log\s?10|straight line.{0,60}log|log\s?[yvp]|y\s?=\s?a\s?x\s?n|y\s?=\s?k\s?b\s?x|\bv\s?=\s?k|\bp\s?=\s?a", 4)]),
   ("6.7", "Exponential growth and decay models", [(r"\bmodel|growth|decay|half-?life|population|years|hours|minutes|temperature|value of", 3)]),
 ]),
 "diff": ("7.2", [
   ("7.1", "Gradient, first principles and second derivatives", [(r"first principles", 6), (r"increasing|decreasing|concave|convex|inflexion|inflection|second derivative|d\s?2\s?y", 4)]),
   ("7.2", "Differentiating standard functions", [(r"differentiat", 1)]),
   ("7.3", "Tangents, normals and stationary points", [(r"\btangent\b|\bnormal\b|stationary|turning point|\bmaximum\b|\bminimum\b", 4)]),
   ("7.4", "Product, quotient and chain rules, connected rates", [(r"product rule|quotient rule|chain rule", 5), (r"d\s?[vhrav]\s?/?\s?d\s?t|connected rates|rate of (?:change|increase)", 4)]),
   ("7.5", "Implicit and parametric differentiation", [(r"implicit", 5), (r"parametric|\bx\s?=.{0,15}\bt\b.{0,30}\by\s?=", 4), (r"\by\s?2\b.{0,40}\bx\s?y\b|\bx\s?y\b.{0,40}\by\s?2", 2)]),
   ("7.6", "Forming differential equations", [(r"proportional to|form a differential equation|show that.{0,40}d\s?\w\s?/?\s?d\s?t\s?=", 4)]),
 ]),
 "integ": ("8.2", [
   ("8.1", "Fundamental Theorem of Calculus", [(r"fundamental theorem", 6)]),
   ("8.2", "Integrating standard functions", [(r"integrat|∫", 1)]),
   ("8.3", "Definite integrals and areas", [(r"\barea\b|\bregion\b|bounded by|definite", 4)]),
   ("8.4", "Integration as the limit of a sum", [(r"\blim\b|δ\s?x|limit of a sum", 5)]),
   ("8.5", "Integration by substitution and by parts", [(r"substitution|by parts|\bu\s?=", 5)]),
   ("8.6", "Integration with partial fractions", [(r"partial fraction", 6)]),
   ("8.7", "Separable differential equations", [(r"differential equation|separat|general solution|particular solution", 5)]),
   ("8.8", "Differential equations in context", [(r"differential equation.{0,400}(?:model|limitation|interpret|context|\btime\b|\bt\s?=|years|minutes|hours)", 4)]),
 ]),
 "numerical": ("9.1", [
   ("9.1", "Locating roots by change of sign", [(r"change of sign|sign change|\binterval\b|lies between", 4)]),
   ("9.2", "Iteration", [(r"iterat|x\s?n\s?\+\s?1|xn\+1|cobweb|staircase", 5)]),
   ("9.3", "Newton–Raphson", [(r"newton[- –]?raphson", 6)]),
   ("9.4", "Trapezium rule", [(r"trapezium|\bstrips?\b|ordinates", 6)]),
   ("9.5", "Numerical methods in context", [(r"\bmodel", 2)]),
 ]),
 "vectors": ("10.4", [
   ("10.1", "Vectors in 2D and 3D", [(r"three dimensions|\b3d\b|\bk\b", 2)]),
   ("10.2", "Magnitude and direction", [(r"magnitude|unit vector|\bdirection\b|bearing|angle", 3)]),
   ("10.3", "Vector addition and scalar multiples", [(r"parallel|collinear|scalar|parallelogram|in terms of a and b|in terms of", 3)]),
   ("10.4", "Position vectors and distance", [(r"position vector|distance between|\boa\b|\bob\b|→", 3)]),
   ("10.5", "Solving problems with vectors", [(r"\bforce|particle|\bship|\bboat|\bmodel", 3)]),
 ]),
 "sampling": ("1.1", [("1.1", "Populations and sampling", [(r"sampl|population|census", 2)])]),
 "data": ("2.3", [
   ("2.1", "Single-variable data diagrams", [(r"histogram|box (?:and whisker )?plot|cumulative frequency|frequency polygon|stem", 5)]),
   ("2.2", "Scatter diagrams, correlation and regression", [(r"scatter|regression|correlation|bivariate|explanatory|response variable|interpolat|extrapolat", 4)]),
   ("2.3", "Averages, spread and standard deviation", [(r"\bmean\b|\bmedian\b|standard deviation|\bvariance\b|quartile|coding|coded|∑|σ", 3)]),
   ("2.4", "Outliers", [(r"outlier", 5)]),
   ("2.5", "Cleaning data", [(r"clean|missing data|\berrors?\b", 4)]),
 ]),
 "prob": ("3.2", [
   ("3.1", "Mutually exclusive and independent events", [(r"mutually exclusive|independent", 5)]),
   ("3.2", "Conditional probability, Venn and tree diagrams", [(r"conditional|given that|venn|tree diagram|two-way|∩|∪", 4)]),
   ("3.3", "Modelling with probability", [(r"assumption|\bmodel|realistic", 3)]),
 ]),
 "dist": ("4.1", [
   ("4.1", "Discrete distributions and the binomial", [(r"binomial|\bb\s?\(\s?\d|discrete|probability distribution|random variable", 3)]),
   ("4.2", "The Normal distribution", [(r"normal|\bn\s?\(\s?[\dμ]|φ|\bz\s?~", 4)]),
   ("4.3", "Choosing a distribution and approximations", [(r"approximat|suitable (?:distribution|model)|appropriate (?:distribution|model)|explain why .{0,40}(?:binomial|normal)", 4)]),
 ]),
 "hyp": ("5.2", [
   ("5.1", "Language of hypothesis testing and correlation tests", [(r"critical region|critical value|actual significance|p-?value", 3), (r"correlation|pmcc|product moment|\bρ\b", 5)]),
   ("5.2", "Binomial hypothesis tests", [(r"binomial|\bb\s?\(\s?\d|proportion", 4)]),
   ("5.3", "Normal mean hypothesis tests", [(r"normal|\bn\s?\(\s?[\dμ]|\bmean\b|x̄|sample mean", 3)]),
 ]),
 "units": ("6.1", [("6.1", "SI units", [(r"si unit|base unit", 4)]), ("6.2", "Derived quantities and units", [(r"derived|units of", 3)])]),
 "kin": ("7.3", [
   ("7.1", "Language of kinematics", [(r"distance travelled|total distance", 3)]),
   ("7.2", "Kinematics graphs", [(r"speed[- ]time|velocity[- ]time|displacement[- ]time|distance[- ]time|\bgraph", 5)]),
   ("7.3", "Constant acceleration (suvat)", [(r"constant (?:acceleration|deceleration)|uniform acceleration|decelerat|constant speed", 4)]),
   ("7.4", "Calculus in kinematics", [(r"\bt\s?[23]\b|t\s?\^|differentiat|integrat|function of t|\bv\s?=.{0,20}\bt\b", 4)]),
   ("7.5", "Projectiles and motion with vectors", [(r"projected|projectile", 6), (r"\bi\s?[+−-]|\bj\b|position vector|vector", 3)]),
 ]),
 "forces": ("8.2", [
   ("8.1", "Forces and Newton's first law", [(r"first law|constant velocity", 2)]),
   ("8.2", "Newton's second law", [(r"accelerat|f\s?=\s?m\s?a", 2)]),
   ("8.3", "Weight and motion under gravity", [(r"weight|gravity|\bg\b", 1)]),
   ("8.4", "Newton's third law, equilibrium and connected particles", [(r"pulley|\bstring\b|connected|\btow|towbar|\blift\b|equilibrium|third law|tension", 3)]),
   ("8.5", "Resultant forces and motion in a plane", [(r"resultant|inclined|\bslope|angle .{0,40}(?:horizontal|force)|\bi\s?[+−-]\s?\d*\s?j", 3)]),
   ("8.6", "Friction", [(r"friction|\brough\b|μ|limiting", 4)]),
 ]),
 "moments": ("9.1", [("9.1", "Moments", [(r"moment", 1)])]),
}

GROUP = {"proof": "pure", "algebra": "pure", "coord": "pure", "sequences": "pure", "trig": "pure", "explog": "pure", "diff": "pure",
         "integ": "pure", "numerical": "pure", "vectors": "pure", "sampling": "stats", "data": "stats", "prob": "stats", "dist": "stats",
         "hyp": "stats", "units": "mech", "kin": "mech", "forces": "mech", "moments": "mech"}
# numbers repeat between Pure and Paper 3 (e.g. 8.4), so names are kept per paper group
NAMES = {}
for _t, (_, _pts) in POINTS.items():
    for _p, _n, _ in _pts:
        NAMES.setdefault(GROUP[_t], {})[_p] = _n

def key(code):
    a, b = code.split(".")
    return (int(a), int(b))

def points_for(text, topic, low, need=False):
    """Spec points within one topic that the text shows clear evidence for (best first, at most 3).
    need=True returns [] instead of the topic's default when nothing matches."""
    default, pts = POINTS[topic]
    sc = []
    for code, _, pats in pts:
        s = sum(w * min(2, len(re.findall(p, low))) for p, w in pats)
        if s:
            sc.append((s, code))
    sc.sort(key=lambda x: (-x[0], key(x[1])))
    top = sc[0][0] if sc else 0
    got = [c for s, c in sc if s >= 3 and s >= 0.5 * top][:3]
    return got or ([] if need else [default])
