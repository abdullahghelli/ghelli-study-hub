"""Pearson Edexcel International A Level Mathematics (YMA01): units P1-P4, M1 and S1.
Each unit is a group; its numbered spec sections are the topics and their subsections the spec points.
Topic ids are "<unit>-<section>", spec point codes are "<section>.<n>" within the unit."""

UNITS = [
    ("p1", "P1 · Pure Mathematics 1", [
        ("Algebra and functions", {
            "1.1": "Laws of indices", "1.2": "Surds", "1.3": "Quadratic functions and their graphs",
            "1.4": "The discriminant", "1.5": "Completing the square, solving quadratics",
            "1.6": "Simultaneous equations", "1.7": "Linear and quadratic inequalities",
            "1.8": "Algebraic manipulation of polynomials", "1.9": "Graphs of functions, sketching curves",
            "1.10": "Transformations of graphs"}),
        ("Coordinate geometry", {"2.1": "Straight lines, parallel and perpendicular"}),
        ("Trigonometry", {"3.1": "Radians, arc length, sector and segment area", "3.2": "Sine and cosine rules, area of a triangle",
                          "3.3": "Graphs of sine, cosine and tangent"}),
        ("Differentiation", {"4.1": "Derivatives and gradients", "4.2": "Differentiating x^n",
                             "4.3": "Tangents and normals"}),
        ("Integration", {"5.1": "Indefinite integration", "5.2": "Integrating x^n, finding a curve from its gradient"}),
    ]),
    ("p2", "P2 · Pure Mathematics 2", [
        ("Proof", {"1.1": "Proof by deduction and exhaustion, disproof by counter-example"}),
        ("Algebra and functions", {"2.1": "Algebraic division, factor and remainder theorems"}),
        ("Coordinate geometry", {"3.1": "Equation of a circle", "3.2": "Circle properties, tangents and chords"}),
        ("Sequences and series", {"4.1": "Binomial expansion (positive integer n)", "4.2": "Sequences, recurrence relations",
                                  "4.3": "Arithmetic series", "4.4": "Geometric series, sum to infinity", "4.5": "Sigma notation"}),
        ("Exponentials and logarithms", {"5.1": "Exponential functions", "5.2": "Laws of logarithms",
                                         "5.3": "Solving a^x = b"}),
        ("Trigonometry", {"6.1": "Trigonometric identities", "6.2": "Solving trigonometric equations"}),
        ("Differentiation", {"7.1": "Increasing and decreasing functions", "7.2": "Stationary points",
                             "7.3": "Optimisation problems"}),
        ("Integration", {"8.1": "Definite integrals", "8.2": "Areas under and between curves", "8.3": "The trapezium rule"}),
    ]),
    ("p3", "P3 · Pure Mathematics 3", [
        ("Algebra and functions", {"1.1": "Algebraic fractions", "1.2": "Functions: domain, range, composite, inverse",
                                   "1.3": "The modulus function", "1.4": "Transformations of graphs"}),
        ("Trigonometry", {"2.1": "Sec, cosec and cot", "2.2": "Inverse trigonometric functions",
                          "2.3": "Identities: sec, cosec, cot", "2.4": "Addition and double angle formulae",
                          "2.5": "R cos(θ ± α), R sin(θ ± α)", "2.6": "Solving equations and proving identities"}),
        ("Exponentials and logarithms", {"3.1": "e^x and ln x", "3.2": "Exponential growth and decay models",
                                         "3.3": "Logarithmic graphs, y = ax^n and y = kb^x"}),
        ("Differentiation", {"4.1": "Differentiating e^x, ln x, sin x, cos x, tan x", "4.2": "Chain, product and quotient rules",
                             "4.3": "dy/dx = 1 / (dx/dy)", "4.4": "Tangents, normals and stationary points"}),
        ("Numerical methods", {"5.1": "Locating roots by a change of sign", "5.2": "Iteration x = g(x)",
                               "5.3": "Newton-Raphson method"}),
        ("Integration", {"6.1": "Integrating e^x, 1/x, sin x, cos x", "6.2": "Integrating f(ax + b)",
                         "6.3": "Definite integrals and areas"}),
    ]),
    ("p4", "P4 · Pure Mathematics 4", [
        ("Proof", {"1.1": "Proof by contradiction"}),
        ("Algebra and functions", {"2.1": "Partial fractions"}),
        ("Coordinate geometry", {"3.1": "Parametric equations and their curves"}),
        ("Binomial expansion", {"4.1": "Binomial expansion for rational n, range of validity"}),
        ("Differentiation", {"5.1": "Parametric differentiation", "5.2": "Implicit differentiation",
                             "5.3": "Rates of change, connected rates", "5.4": "Differentiating a^x"}),
        ("Integration", {"6.1": "Integration by substitution", "6.2": "Integration by parts",
                         "6.3": "Integration using partial fractions", "6.4": "Integrating with trigonometric identities",
                         "6.5": "Areas and volumes of revolution", "6.6": "Parametric areas",
                         "6.7": "Differential equations"}),
        ("Vectors", {"7.1": "Vectors in 2D and 3D, magnitude", "7.2": "Vector equation of a line",
                     "7.3": "Intersecting, parallel and skew lines", "7.4": "Scalar product, angles, perpendicular distance"}),
    ]),
    ("m1", "M1 · Mechanics 1", [
        ("Mathematical models", {"1.1": "Modelling assumptions"}),
        ("Vectors in mechanics", {"2.1": "Vectors: magnitude, direction, components", "2.2": "Velocity and position vectors"}),
        ("Kinematics", {"3.1": "Constant acceleration formulae", "3.2": "Vertical motion under gravity",
                        "3.3": "Speed-time and distance-time graphs"}),
        ("Dynamics", {"4.1": "Newton's laws of motion", "4.2": "Connected particles, pulleys",
                      "4.3": "Momentum and impulse, collisions"}),
        ("Statics", {"5.1": "Forces in equilibrium, resolving", "5.2": "Friction, limiting equilibrium"}),
        ("Moments", {"6.1": "Moments of forces, rods and beams"}),
    ]),
    ("s1", "S1 · Statistics 1", [
        ("Mathematical models", {"1.1": "Statistical models"}),
        ("Representation and summary of data", {"2.1": "Mean, median, mode, quartiles, percentiles", "2.2": "Variance and standard deviation",
                                                "2.3": "Coding", "2.4": "Histograms, stem and leaf, box plots, outliers",
                                                "2.5": "Skewness, comparing distributions"}),
        ("Probability", {"3.1": "Venn diagrams and tree diagrams", "3.2": "Conditional probability",
                         "3.3": "Independent and mutually exclusive events"}),
        ("Correlation and regression", {"4.1": "Product moment correlation coefficient", "4.2": "Least squares regression line, interpretation"}),
        ("Discrete random variables", {"5.1": "Probability distributions, cumulative distribution function",
                                       "5.2": "Expectation and variance, E(aX + b), Var(aX + b)", "5.3": "Discrete uniform distribution"}),
        ("The normal distribution", {"6.1": "Normal distribution probabilities", "6.2": "Finding mean or standard deviation"}),
    ]),
]

TOPICS = [(f"{u}-{i + 1}", i + 1, name, u) for u, _, secs in UNITS for i, (name, _) in enumerate(secs)]
GROUPS = [(u, label) for u, label, _ in UNITS]
NAMES = {u: {k: v for _, pts in secs for k, v in pts.items()} for u, _, secs in UNITS}
