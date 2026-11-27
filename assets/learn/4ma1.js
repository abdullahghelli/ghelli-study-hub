/* Edexcel International GCSE Maths A (4MA1) · Chapters
   Each page: short ideas, worked examples revealed step by step, an example to finish, practice that checks itself,
   the mistakes examiners see most (in our words), and exam-style questions we wrote ourselves.
   Maths is written as students type it: x^2 - 5x + 6, (x + 3)(x - 2), sqrt(13), frac{a}{b}. Every answer here is
   checked by tools/learn/check.js. */
GSHLearn.add("/assets/learn/4ma1.js", {
  quadratics: {
    /* the chapter's "Where should I start?" check: the first one missed names the page to start on */
    check: [
      { id: "c1", page: "expanding-brackets", q: "Expand and simplify $(x + 2)(x + 5)$", a: "x^2 + 7x + 10", form: "expand" },
      { id: "c2", page: "factorising", q: "Factorise $x^2 + 7x + 12$", a: "(x + 3)(x + 4)", form: "factorise" },
      { id: "c3", page: "solving-by-factorising", q: "Solve $x^2 - x - 6 = 0$", a: "x = 3 or x = -2", form: "solve" },
      { id: "c4", page: "completing-the-square", q: "Write $x^2 + 6x + 1$ in the form $(x + p)^2 + q$", a: "(x + 3)^2 - 8", form: "square" },
      { id: "c5", page: "quadratic-formula", q: "Solve $x^2 + 3x - 1 = 0$. Give your answers to 2 decimal places.", a: "x = 0.30 or x = -3.30", form: "solve", dp: 2 },
      { id: "c6", page: "quadratic-graphs", q: "Where does the curve $y = x^2 - 4x + 3$ cross the $x$-axis? Give the $x$ values.", a: "x = 1 or x = 3", form: "solve" },
    ],
    pages: {
      "expanding-brackets": {
        intro: "Expanding means multiplying out the brackets. You'll use it all through this chapter.",
        blocks: [
          { type: "idea", title: "Every term times every term",
            text: "To expand two brackets, multiply **each term** in the first bracket by **each term** in the second. Then collect like terms.",
            math: ["(x + 3)(x + 5) = x^2 + 5x + 3x + 15", "= x^2 + 8x + 15"],
            note: "Four multiplications for two brackets with two terms each. Then add them up." },
          { type: "grid", text: "The **grid method** keeps track of all four. Change the brackets and watch the grid fill in.", start: "(x + 3)(x + 5)" },
          { type: "example", q: "Expand and simplify $(x + 4)(x - 6)$",
            steps: [
              { m: "x * x = x^2", why: "First term times first term." },
              { m: "x * (-6) = -6x", why: "Keep the sign with each term: the second term is $-6$." },
              { m: "4 * x = 4x" },
              { m: "4 * (-6) = -24", why: "Positive times negative is negative." },
              { m: "x^2 - 6x + 4x - 24 = x^2 - 2x - 24", why: "Collect the $x$ terms: $-6x + 4x = -2x$." },
            ] },
          { type: "example", q: "Expand and simplify $(2x - 5)^2$",
            steps: [
              { m: "(2x - 5)^2 = (2x - 5)(2x - 5)", why: "Squaring means multiplying the bracket by itself. Write it out twice." },
              { m: "= 4x^2 - 10x - 10x + 25", why: "$2x * 2x = 4x^2$, $2x * (-5) = -10x$ twice, and $(-5) * (-5) = +25$." },
              { m: "= 4x^2 - 20x + 25", why: "It is **not** $4x^2 - 25$. There is always a middle term." },
            ] },
          { type: "fade", q: "Expand and simplify $(3x + 2)(x - 4)$",
            steps: [
              { m: "3x * x = 3x^2" },
              { m: "3x * (-4) = -12x" },
              { m: "2 * x = 2x" },
              { m: "2 * (-4) = -8" },
            ],
            ask: { id: "f1", q: "Now collect the like terms. What is the answer?", a: "3x^2 - 10x - 8", form: "expand", sol: ["$3x^2 - 12x + 2x - 8$", "$-12x + 2x = -10x$"] } },
          { type: "graph", tag: "See it",
            text: "Expanding doesn't change the expression, just how it's written. Both of these draw the **same curve**. Move the sliders: they stay on top of each other.",
            exprs: ["y = (x + a)(x + b)", "y = x^2 + (a + b)x + ab"], sliders: { a: [1, -5, 5, 1], b: [-3, -5, 5, 1] }, view: { x0: -7, x1: 7, y0: -10, y1: 10 },
            ask: "Notice the number on its own, $ab$, is where the curve crosses the $y$-axis." },
          { type: "idea", title: "Three brackets (Higher)",
            text: "Expand **two** brackets first. Then multiply the answer by the third bracket, term by term.",
            math: ["(x + 1)(x + 2)(x - 3)", "= (x^2 + 3x + 2)(x - 3)", "= x^3 - 3x^2 + 3x^2 - 9x + 2x - 6", "= x^3 - 7x - 6"],
            note: "Three terms times two terms gives six multiplications. Count them, so you don't miss one." },
          { type: "practice", title: "Test yourself", text: "Expand and simplify. Use the maths keyboard, or type: x^2 for $x^2$.", qs: [
            { id: "p1", q: "$(x + 3)(x + 7)$", a: "x^2 + 10x + 21", form: "expand", sol: ["$x^2 + 7x + 3x + 21$"] },
            { id: "p2", q: "$(x - 5)(x + 2)$", a: "x^2 - 3x - 10", form: "expand", hint: "The four products are $x^2$, $2x$, $-5x$ and $-10$.", sol: ["$x^2 + 2x - 5x - 10$"] },
            { id: "p3", q: "$(y - 4)(y - 9)$", a: "y^2 - 13y + 36", form: "expand", hint: "Negative times negative is positive.", sol: ["$y^2 - 9y - 4y + 36$"] },
            { id: "p4", q: "$(2x + 1)(3x - 4)$", a: "6x^2 - 5x - 4", form: "expand", sol: ["$6x^2 - 8x + 3x - 4$"] },
            { id: "p5", q: "$(x + 6)^2$", a: "x^2 + 12x + 36", form: "expand", hint: "Write it as $(x + 6)(x + 6)$ first.", sol: ["$(x + 6)(x + 6)$", "$x^2 + 6x + 6x + 36$"] },
            { id: "p6", q: "$(3x - 2)^2$", a: "9x^2 - 12x + 4", form: "expand", hint: "Write it as $(3x - 2)(3x - 2)$. There is a middle term.", sol: ["$(3x - 2)(3x - 2)$", "$9x^2 - 6x - 6x + 4$"] },
            { id: "p7", q: "$(x + 2)(x - 2)$", a: "x^2 - 4", form: "expand", right: "Right. The $x$ terms cancel: $2x - 2x = 0$. You'll meet this again as the **difference of two squares**.", sol: ["$x^2 - 2x + 2x - 4$"] },
            { id: "p8", q: "$(x + 2)(x + 3)(x - 1)$ (Higher)", a: "x^3 + 4x^2 + x - 6", form: "expand", hint: "First $(x + 2)(x + 3) = x^2 + 5x + 6$.", sol: ["$(x + 2)(x + 3) = x^2 + 5x + 6$", "$(x^2 + 5x + 6)(x - 1) = x^3 - x^2 + 5x^2 - 5x + 6x - 6$"] },
          ] },
          { type: "watch", items: [
            { wrong: "(2x - 5)^2 = 4x^2 - 25", right: "4x^2 - 20x + 25", note: "Squaring a bracket: write it out twice and do all four multiplications." },
            { wrong: "(-5) * (-5) = -25", right: "+25", note: "Negative times negative is **positive**. Most lost marks here are sign slips." },
            { wrong: "e^2 - 2 - 15", right: "e^2 - 2e - 15", note: "Keep the letter on the middle term." },
            { note: "Three brackets: do two at a time. Multiplying all three at once is where terms go missing." },
            { note: "**Expand** just wants the expression multiplied out. Don't go on to solve it or factorise it back." },
          ] },
          { type: "exam", qs: [
            { id: "e1", q: "Expand and simplify $(x + 7)(x - 3)$", marks: 2, a: "x^2 + 4x - 21", form: "expand", sol: ["$x^2 - 3x + 7x - 21$"] },
            { id: "e2", q: "Expand and simplify $(3y - 2)^2$", marks: 2, a: "9y^2 - 12y + 4", form: "expand", sol: ["$(3y - 2)(3y - 2)$", "$9y^2 - 6y - 6y + 4$"] },
            { id: "e3", q: "Expand and simplify $(2x + 3)(x - 1) - (x - 2)^2$", marks: 3, a: "x^2 + 5x - 7", form: "expand", hint: "Expand each part separately. Then take away the **whole** of the second one: put it in brackets.", sol: ["$(2x + 3)(x - 1) = 2x^2 + x - 3$", "$(x - 2)^2 = x^2 - 4x + 4$", "$2x^2 + x - 3 - (x^2 - 4x + 4) = 2x^2 + x - 3 - x^2 + 4x - 4$"] },
            { id: "e4", q: "Expand and simplify $(x + 3)(x - 2)(2x + 1)$", marks: 3, a: "2x^3 + 3x^2 - 11x - 6", form: "expand", sol: ["$(x + 3)(x - 2) = x^2 + x - 6$", "$(x^2 + x - 6)(2x + 1) = 2x^3 + x^2 + 2x^2 + x - 12x - 6$"] },
            { id: "e5", q: "A rectangle is $(2x + 5)$ cm long and $(x - 1)$ cm wide. Write an expression for its area, in cm². Expand and simplify your answer.", marks: 2, a: "2x^2 + 3x - 5", form: "expand", sol: ["Area = length × width = $(2x + 5)(x - 1)$", "$2x^2 - 2x + 5x - 5$"] },
          ] },
        ],
      },
    },
  },
});
