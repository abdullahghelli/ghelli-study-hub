/* Ghelli Study Hub · Chapters (notes that walk a student through a topic)

   Loaded by app.js when a chapter opens. Draws a chapter's overview and its pages from the course's content file
   (assets/learn/<code>.js, which calls GSHLearn.add). Has its own small toolkit, so nothing is loaded from outside:
     Maths   linear maths as students type it ("x^2 - 5x + 6", "(x+3)(x-2)", "sqrt(13)", "frac{a}{b}") drawn neatly,
             parsed and checked: same value AND the form the question asks for (expanded, factorised, completed square,
             solutions to n decimal places)
     Keypad  an on-screen maths keyboard (iPad and phones get it in place of the letter keyboard; computers can open it)
     Graph   a grapher: type equations, letters other than x become sliders, roots, turning points, y-intercepts and
             crossings are marked and labelled on tap; drag to move, pinch or scroll to zoom
   A page is a list of blocks (see the content file): idea, example (revealed a step at a time), fade (an example with
   its last steps left for the student), graph, grid (the grid method, live), practice (type and check), watch (common
   exam mistakes), exam (exam-style questions we wrote), recall (questions from earlier pages).
   Progress is kept on this device: gsh-learn:<course>/<chapter> = { <page>: { q: { <id>: "got" | "tried" }, done } }. */
(() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("gsh-" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("gsh-" + k, JSON.stringify(v)); } catch (e) {} },
  };
  const CONTENT = {};
  const touchy = () => matchMedia("(pointer: coarse)").matches;

  /* ================= Maths: tokens ================= */
  const WORDS = ["sqrt", "frac", "or", "and"];
  function tokens(src) {
    const out = []; let i = 0; const s = String(src).replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/√/g, "sqrt").replace(/²/g, "^2").replace(/³/g, "^3");
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      let m;
      if ((m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i)))) { out.push({ t: "num", v: m[0] }); i += m[0].length; continue; }
      if ((m = /^[a-zA-Z]+/.exec(s.slice(i)))) {
        let w = m[0];
        /* a word we know, else single letters (2xy is 2·x·y) */
        const kw = WORDS.find(k => w.toLowerCase().startsWith(k));
        if (kw) { out.push({ t: "word", v: kw }); i += kw.length; continue; }
        out.push({ t: "var", v: w[0] }); i += 1; continue;
      }
      if (s.startsWith("<=", i) || s.startsWith(">=", i)) { out.push({ t: "op", v: s.substr(i, 2) }); i += 2; continue; }
      if (s.startsWith("+-", i) || c === "±") { out.push({ t: "op", v: "±" }); i += c === "±" ? 1 : 2; continue; }
      if ("+-*/^=<>,(){}[]".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
      out.push({ t: "bad", v: c }); i++;
    }
    return out;
  }

  /* ================= Maths: drawing ================= */
  /* the group after ^, sqrt or frac: (...) or {...} drawn without its brackets for {}, and for () after ^ and sqrt */
  function group(tk, i) {
    const open = tk[i] && tk[i].v;
    if (open !== "(" && open !== "{") return null;
    const close = open === "(" ? ")" : "}"; let d = 0;
    for (let j = i; j < tk.length; j++) {
      if (tk[j].t === "op" && tk[j].v === open) d++;
      if (tk[j].t === "op" && tk[j].v === close && !--d) return { inner: tk.slice(i + 1, j), end: j + 1 };
    }
    return { inner: tk.slice(i + 1), end: tk.length };   /* still being typed */
  }
  function draw(tk) {
    let h = "", i = 0;
    const prevIsValue = () => { const p = tk[i - 1]; return p && (p.t === "num" || p.t === "var" || (p.t === "op" && [")", "}", "]"].includes(p.v))); };
    while (i < tk.length) {
      const k = tk[i];
      if (k.t === "num") { h += `<span class="mn">${k.v}</span>`; i++; }
      else if (k.t === "var") { h += `<i class="mv">${esc(k.v)}</i>`; i++; }
      else if (k.t === "word" && (k.v === "or" || k.v === "and")) { h += `<span class="mw">${k.v}</span>`; i++; }
      else if (k.t === "word" && k.v === "sqrt") {
        const g = group(tk, i + 1);
        if (g) { h += `<span class="msq"><span class="msq-s">√</span><span class="msq-in">${draw(g.inner) || "&#8203;"}</span></span>`; i = g.end; }
        else { h += `<span class="msq-s">√</span>`; i++; }
      }
      else if (k.t === "word" && k.v === "frac") {
        const a = group(tk, i + 1), b = a && group(tk, a.end);
        if (a && b) { h += `<span class="mfr"><span>${draw(a.inner)}</span><span>${draw(b.inner)}</span></span>`; i = b.end; }
        else { h += "frac"; i++; }
      }
      else if (k.v === "^") {
        const g = group(tk, i + 1);
        if (g) { h += `<sup>${draw(g.inner)}</sup>`; i = g.end; }
        else if (tk[i + 1] && tk[i + 1].v === "-" && tk[i + 2]) { h += `<sup>−${draw([tk[i + 2]])}</sup>`; i += 3; }
        else if (tk[i + 1]) { h += `<sup>${draw([tk[i + 1]])}</sup>`; i += 2; }
        else { h += `<sup>&#9633;</sup>`; i++; }
      }
      else if (k.v === "{" || k.v === "}") { i++; }
      else if (k.v === "-" || k.v === "+" || k.v === "±") {
        const sym = k.v === "-" ? "−" : k.v;
        h += prevIsValue() ? `<span class="mo">${sym}</span>` : `<span class="mu">${sym}</span>`; i++;
      }
      else if (k.v === "*") { h += `<span class="mo">×</span>`; i++; }
      else if (k.v === "/") { h += `<span class="ms">/</span>`; i++; }
      else if (["=", "<", ">", "<=", ">="].includes(k.v)) { h += `<span class="mo">${{ "<=": "≤", ">=": "≥", "<": "&lt;", ">": "&gt;" }[k.v] || k.v}</span>`; i++; }
      else if (k.v === ",") { h += `<span class="mc">,</span>`; i++; }
      else { h += esc(k.v); i++; }
    }
    return h;
  }
  const mathHTML = src => `<span class="m">${draw(tokens(src))}</span>`;
  /* text with $maths$, **bold** and line breaks */
  const rich = s => esc(String(s || "")).replace(/\$([^$]+)\$/g, (_, m) => mathHTML(m.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')))
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

  /* ================= Maths: parsing to a tree ================= */
  function parse(src) {
    const tk = tokens(src); let i = 0;
    if (tk.some(k => k.t === "bad")) throw new Error("bad");
    const peek = () => tk[i], isOp = v => tk[i] && tk[i].t === "op" && tk[i].v === v;
    const startsAtom = k => k && (k.t === "num" || k.t === "var" || (k.t === "word" && (k.v === "sqrt" || k.v === "frac")) || (k.t === "op" && (k.v === "(" || k.v === "{" || k.v === "[")));
    function sum() {
      const terms = []; let sign = 1;
      if (isOp("+")) i++; else if (isOp("-")) { sign = -1; i++; }
      terms.push({ sign, e: product() });
      while (isOp("+") || isOp("-")) { const sg = tk[i].v === "-" ? -1 : 1; i++; terms.push({ sign: sg, e: product() }); }
      return terms.length === 1 && terms[0].sign === 1 ? terms[0].e : { k: "add", terms };
    }
    function product() {
      const fs = [{ e: power(), div: false }];
      for (;;) {
        if (isOp("*")) { i++; fs.push({ e: power(), div: false }); }
        else if (isOp("/")) { i++; fs.push({ e: power(), div: true }); }
        else if (startsAtom(peek())) fs.push({ e: power(), div: false, implicit: true });
        else break;
      }
      return fs.length === 1 ? fs[0].e : { k: "mul", fs };
    }
    function power() {
      let b = atom();
      if (isOp("^")) { i++; let neg = false; if (isOp("-")) { neg = true; i++; } const ex = atom(); b = { k: "pow", b, ex: neg ? { k: "add", terms: [{ sign: -1, e: ex }] } : ex }; }
      return b;
    }
    function atom() {
      const k = peek();
      if (!k) throw new Error("end");
      if (k.t === "num") { i++; return { k: "num", v: parseFloat(k.v), raw: k.v }; }
      if (k.t === "var") { i++; return { k: "var", v: k.v }; }
      if (k.t === "word" && k.v === "sqrt") { i++; const a = atom(); return { k: "sqrt", a }; }
      if (k.t === "word" && k.v === "frac") { i++; const a = atom(), b = atom(); return { k: "mul", fs: [{ e: a, div: false }, { e: b, div: true }] }; }
      if (k.t === "op" && (k.v === "(" || k.v === "{" || k.v === "[")) {
        const close = { "(": ")", "{": "}", "[": "]" }[k.v]; i++;
        const e = sum();
        if (!isOp(close)) throw new Error("bracket"); i++;
        return k.v === "(" ? { k: "par", e } : e;
      }
      throw new Error("unexpected");
    }
    const e = sum();
    if (i < tk.length) throw new Error("extra");
    return e;
  }
  const unpar = e => e && e.k === "par" ? unpar(e.e) : e;
  function evalT(e, env) {
    switch (e.k) {
      case "num": return e.v;
      case "var": if (!(e.v in env)) throw new Error("var " + e.v); return env[e.v];
      case "par": return evalT(e.e, env);
      case "sqrt": return Math.sqrt(evalT(e.a, env));
      case "pow": return Math.pow(evalT(e.b, env), evalT(e.ex, env));
      case "add": return e.terms.reduce((a, t) => a + t.sign * evalT(t.e, env), 0);
      case "mul": return e.fs.reduce((a, f) => f.div ? a / evalT(f.e, env) : a * evalT(f.e, env), 1);
    }
    throw new Error("node");
  }
  const varsOf = (e, set = new Set()) => {
    if (!e) return set;
    if (e.k === "var") set.add(e.v);
    for (const c of [e.e, e.a, e.b, e.ex]) if (c) varsOf(c, set);
    for (const t of e.terms || []) varsOf(t.e, set);
    for (const f of e.fs || []) varsOf(f.e, set);
    return set;
  };

  /* polynomials (any letters): { "x2y1": coef }, so forms can be checked exactly */
  const mono = m => Object.keys(m).filter(v => m[v]).sort().map(v => v + m[v]).join("");
  const monoOf = key => { const m = {}; (key.match(/[a-zA-Z]\d+/g) || []).forEach(p => { m[p[0]] = +p.slice(1); }); return m; };
  const clean = p => { const o = {}; for (const k in p) if (Math.abs(p[k]) > 1e-9) o[k] = Math.round(p[k] * 1e9) / 1e9; return o; };
  const padd = (a, b, s = 1) => { const o = { ...a }; for (const k in b) o[k] = (o[k] || 0) + s * b[k]; return clean(o); };
  const pmul = (a, b) => { const o = {}; for (const x in a) for (const y in b) { const m = monoOf(x), n = monoOf(y); for (const v in n) m[v] = (m[v] || 0) + n[v]; const k = mono(m); o[k] = (o[k] || 0) + a[x] * b[y]; } return clean(o); };
  function poly(e) {
    switch (e.k) {
      case "num": return clean({ "": e.v });
      case "var": return { [e.v + "1"]: 1 };
      case "par": return poly(e.e);
      case "add": return e.terms.reduce((a, t) => padd(a, poly(t.e), t.sign), {});
      case "mul": return e.fs.reduce((a, f) => {
        const p = poly(f.e);
        if (!f.div) return pmul(a, p);
        const keys = Object.keys(p); if (keys.length !== 1 || keys[0] !== "") throw new Error("not poly");
        return pmul(a, { "": 1 / p[""] });
      }, { "": 1 });
      case "pow": {
        const n = evalT(e.ex, {}); if (!(n >= 0 && Number.isInteger(n) && n <= 12)) throw new Error("not poly");
        let r = { "": 1 }; const b = poly(e.b); for (let j = 0; j < n; j++) r = pmul(r, b); return r;
      }
    }
    throw new Error("not poly");
  }
  const peq = (a, b) => { const d = padd(a, b, -1); return !Object.keys(d).length; };
  const degree = p => Math.max(0, ...Object.keys(p).map(k => Object.values(monoOf(k)).reduce((a, b) => a + b, 0)));
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b > 1e-9) [a, b] = [b, a % b]; return a; };
  const content = p => Object.values(p).reduce((g, c) => Number.isInteger(c) ? gcd(g, c) : NaN, 0);
  /* a quadratic in one letter with rational roots can still be factorised */
  function splits(p) {
    const ks = Object.keys(p); const v = (ks.join("").match(/[a-zA-Z]/) || [])[0];
    if (!v || ks.some(k => k && Object.keys(monoOf(k)).some(x => x !== v))) return false;
    if (degree(p) !== 2) return false;
    const a = p[v + "2"] || 0, b = p[v + "1"] || 0, c = p[""] || 0, d = b * b - 4 * a * c;
    if (d < 0) return false; const r = Math.round(Math.sqrt(d)); return r * r === Math.round(d);
  }
  /* the factors of a product, written as the student wrote them */
  function factors(e) {
    e = unpar(e);
    if (e.k === "mul" && !e.fs.some(f => f.div)) return e.fs.flatMap(f => factors(f.e));
    if (e.k === "pow" && e.ex.k === "num" && Number.isInteger(e.ex.v)) return Array(e.ex.v).fill(unpar(e.b));
    if (e.k === "add" && e.terms.length === 1 && e.terms[0].sign === -1) return [{ k: "num", v: -1 }, ...factors(e.terms[0].e)];
    return [e];
  }
  const topTerms = e => { e = e.k === "par" ? e : e; return e.k === "add" ? e.terms.length : 1; };
  const hasBrackets = src => /[()[\]{}]/.test(String(src).replace(/sqrt\s*\(/g, ""));

  /* ================= Checking an answer =================
     q.a is the answer as we'd write it; q.form says what's being asked:
       expand      same expression, no brackets, like terms collected
       factorise   same expression, a product of brackets, nothing left to factorise
       square      same expression in the form a(x + p)^2 + q
       solve       the values of the letter, any order ("x = 3 or x = -5", "3, -5"); dp: rounded to that many places
       number      one value (dp as above)
       any         the same expression, any form
     returns { ok, msg } */
  function check(q, input) {
    const raw = String(input || "").trim();
    if (!raw) return { ok: false, msg: "Type your answer first." };
    const form = q.form || "any";
    try {
      if (form === "solve" || form === "number") return checkValues(q, raw);
      let lhs = raw.replace(/^\s*[a-zA-Z]\s*\(\s*[a-zA-Z]\s*\)\s*=|^\s*y\s*=/, "");
      if (/=/.test(lhs)) lhs = lhs.split("=").pop();
      const e = parse(lhs), want = parse(q.a);
      let same;
      try { same = peq(poly(e), poly(want)); }
      catch (err) { same = numSame(e, want); }
      if (!same) return { ok: false, msg: q.wrong || "Not quite. Check each term and its sign." };
      if (form === "expand") {
        if (hasBrackets(lhs)) return { ok: false, msg: "Right value, but multiply out the brackets." };
        if (topTerms(e) > Object.keys(poly(e)).length) return { ok: false, msg: "Nearly. Collect the like terms." };
        return { ok: true };
      }
      if (form === "factorise") {
        const fs = factors(e).filter(f => !(f.k === "num"));
        if (fs.length < (q.minFactors || 2) && !(fs.length === 1 && q.minFactors === 1)) return { ok: false, msg: "Right value, but write it as a product of brackets." };
        for (const f of fs) {
          const p = poly(f);
          if (degree(p) >= 1 && Math.abs(content(p)) > 1) return { ok: false, msg: "Not fully factorised: a bracket still has a common factor." };
          if (degree(p) === 2 && splits(p)) return { ok: false, msg: "Not fully factorised: a bracket can be factorised again." };
        }
        return { ok: true };
      }
      if (form === "square") {
        const t = e.k === "add" ? e.terms : [{ sign: 1, e }];
        const sq = t.filter(x => varsOf(x.e).size), rest = t.filter(x => !varsOf(x.e).size);
        const isSq = x => { const fs = factors(x).filter(f => f.k !== "num"); return fs.length === 2 && degree(poly(fs[0])) === 1 && peq(poly(fs[0]), poly(fs[1])); };
        if (sq.length !== 1 || !isSq(sq[0].e) || rest.length > 1) return { ok: false, msg: "Right value, but write it in the form (x + p)² + q." };
        return { ok: true };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: "We couldn't read that. Check the brackets and signs." };
    }
  }
  function numSame(a, b) {
    const vs = [...new Set([...varsOf(a), ...varsOf(b)])];
    for (let n = 0; n < 6; n++) {
      const env = {}; vs.forEach(v => { env[v] = 0.37 + n * 0.91 + Math.random(); });
      const x = evalT(a, env), y = evalT(b, env);
      if (!isFinite(x) || !isFinite(y) || Math.abs(x - y) > 1e-7 * Math.max(1, Math.abs(y))) return false;
    }
    return true;
  }
  function values(src) {
    return String(src).split(/\bor\b|\band\b|,|;/i).map(s => s.trim()).filter(Boolean).map(s => {
      const r = s.includes("=") ? s.split("=").pop() : s;
      if (/±|\+-/.test(r)) return ["+", "-"].map(sg => evalT(parse(r.replace(/±|\+-/, sg)), {}));
      return [evalT(parse(r), {})];
    }).flat();
  }
  function checkValues(q, raw) {
    let got;
    try { got = values(raw); } catch (e) { return { ok: false, msg: "We couldn't read that. Write each value, like x = 3 or x = −5." }; }
    const want = values(q.a), tol = q.dp != null ? 0.5 * Math.pow(10, -q.dp) + 1e-9 : 1e-6;
    if (got.length < want.length) return { ok: false, msg: want.length > 1 ? `There ${want.length === 2 ? "are two answers" : `are ${want.length} answers`}.` : "Not quite." };
    const left = [...want];
    for (const g of got) { const j = left.findIndex(w => Math.abs(w - g) <= tol); if (j < 0) return { ok: false, msg: q.wrong || "Not quite. Check your working." }; left.splice(j, 1); }
    if (left.length) return { ok: false, msg: "Not quite." };
    if (q.dp != null && !/sqrt|frac|\//.test(raw)) {
      const dps = (raw.match(/\d+\.(\d+)/g) || []).map(x => x.split(".")[1].length);
      if (got.some(g => Math.abs(g - Math.round(g)) > 1e-9) && dps.some(d => d < q.dp)) return { ok: false, msg: `Right, but give your answer to ${q.dp} decimal place${q.dp > 1 ? "s" : ""}.` };
    }
    return { ok: true };
  }

  /* ================= Answer box and keypad ================= */
  const KEYS = [
    ["x", "y", "(", ")", "x²|^2", "^", "√|sqrt()"],
    ["7", "8", "9", "+", "−|-", "×|*", "÷|/"],
    ["4", "5", "6", "=", "±", ",", "or| or "],
    ["1", "2", "3", "0", ".", "←|L", "→|R"],
  ];
  let pad = null, padFor = null;
  function makePad() {
    pad = document.createElement("div");
    pad.className = "mk-pad"; pad.hidden = true; pad.setAttribute("role", "group"); pad.setAttribute("aria-label", "Maths keyboard");
    pad.innerHTML = `<div class="mk-rows">${KEYS.map(r => `<div class="mk-row">${r.map(k => { const [label, val] = k.split("|"); return `<button type="button" class="mk-k${/^[0-9.]$/.test(label) ? " num" : ""}" data-k="${esc(val ?? label)}" aria-label="${esc(label)}">${esc(label)}</button>`; }).join("")}</div>`).join("")}
      <div class="mk-row"><button type="button" class="mk-k wide" data-k="ABC">abc</button><button type="button" class="mk-k wide" data-k="BS" aria-label="Delete">⌫</button><button type="button" class="mk-k wide" data-k="HIDE" aria-label="Hide keyboard">▾</button><button type="button" class="mk-k go" data-k="GO">Check</button></div></div>`;
    document.body.appendChild(pad);
    /* keep focus in the answer box: keys act on pointerdown and never take focus */
    pad.addEventListener("pointerdown", e => { const b = e.target.closest("[data-k]"); e.preventDefault(); if (b) press(b.dataset.k); });
    pad.addEventListener("click", e => e.preventDefault());
  }
  function press(k) {
    const inp = padFor; if (!inp) return;
    const s = inp.selectionStart ?? inp.value.length, e2 = inp.selectionEnd ?? s, v = inp.value;
    const put = (txt, back = 0) => { inp.value = v.slice(0, s) + txt + v.slice(e2); const c = s + txt.length - back; inp.setSelectionRange(c, c); inp.dispatchEvent(new Event("input", { bubbles: true })); };
    if (k === "L") { const c = Math.max(0, s - 1); inp.setSelectionRange(c, c); }
    else if (k === "R") { const c = Math.min(v.length, e2 + 1); inp.setSelectionRange(c, c); }
    else if (k === "BS") { if (s !== e2) put(""); else if (s > 0) { inp.value = v.slice(0, s - 1) + v.slice(s); inp.setSelectionRange(s - 1, s - 1); inp.dispatchEvent(new Event("input", { bubbles: true })); } }
    else if (k === "ABC") { inp.setAttribute("inputmode", "text"); hidePad(); inp.blur(); setTimeout(() => inp.focus(), 30); }
    else if (k === "HIDE") { hidePad(); inp.blur(); }
    else if (k === "GO") { inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
    else if (k === "sqrt()") put("sqrt()", 1);
    else put(k);
  }
  function showPad(inp) { if (!pad) makePad(); padFor = inp; pad.hidden = false; document.body.classList.add("mk-on"); requestAnimationFrame(() => inp.scrollIntoView({ block: "nearest", behavior: "smooth" })); }
  function hidePad() { if (pad) pad.hidden = true; document.body.classList.remove("mk-on"); }
  /* an answer box: what they type, drawn as maths underneath */
  const answerBox = (id, ph) => `<div class="ln-ans"><div class="ln-field"><input class="ln-in" data-ans="${esc(id)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(ph || "Type your answer")}" ${touchy() ? 'inputmode="none"' : ""}>
      <button type="button" class="ln-kb" data-kb title="Maths keyboard" aria-label="Maths keyboard"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="5" width="15" height="10" rx="2"/><path d="M5.5 8h1M9.5 8h1M13.5 8h1M6 12h8"/></svg></button></div>
      <div class="ln-prev" aria-hidden="true"></div></div>`;

  /* ================= Grapher ================= */
  const COLORS = ["#2f6fd6", "#d0453a", "#2c8a4c", "#8a4cc2", "#c47a12"];
  function grapher(box, opts) {
    const st = { view: { ...(opts.view || { x0: -6, x1: 6, y0: -6, y1: 8 }) }, rows: (opts.exprs || ["y = x^2"]).map((s, i) => ({ s, c: COLORS[i % COLORS.length] })), sliders: {}, sel: null, keys: opts.keys !== false };
    for (const [k, v] of Object.entries(opts.sliders || {})) st.sliders[k] = { v: v[0], min: v[1] ?? -10, max: v[2] ?? 10, step: v[3] ?? 0.5 };
    box.innerHTML = `<div class="gr-list"></div><div class="gr-sl"></div><div class="gr-wrap"><canvas class="gr-c" aria-label="Graph"></canvas>
      <div class="gr-tools"><button type="button" data-g="in" aria-label="Zoom in">+</button><button type="button" data-g="out" aria-label="Zoom out">−</button><button type="button" data-g="home" aria-label="Reset view">⌂</button></div>
      <div class="gr-tip" hidden></div></div>
      <label class="gr-opt"><input type="checkbox" data-g="keys" ${st.keys ? "checked" : ""}> Mark roots, turning points and crossings</label>`;
    const list = box.querySelector(".gr-list"), sl = box.querySelector(".gr-sl"), cv = box.querySelector("canvas"), tip = box.querySelector(".gr-tip"), wrap = box.querySelector(".gr-wrap");
    const home = { ...st.view };
    let fns = [], pts = [];
    const compile = () => {
      const need = new Set();
      fns = st.rows.map(r => {
        let s = r.s.trim(); r.err = ""; if (!s) return null;
        try {
          let vert = false, lhs = "y";
          if (s.includes("=")) { const [a, b] = s.split("="); lhs = a.trim(); s = b; if (/^x$/i.test(lhs)) vert = true; else if (!/^y$|^[a-z]\(x\)$/i.test(lhs)) throw 0; }
          const t = parse(s); const vs = varsOf(t);
          vs.forEach(v => { if (v !== "x" && v !== "y") need.add(v); });
          if (vs.has("y") || (vert && vs.has("x"))) throw 0;
          return { t, vert, c: r.c };
        } catch (e) { r.err = "Check this line"; return null; }
      });
      for (const v of need) if (!st.sliders[v]) st.sliders[v] = { v: 1, min: -10, max: 10, step: 0.5 };
      for (const v of Object.keys(st.sliders)) if (!need.has(v)) delete st.sliders[v];
    };
    const env = x => { const o = { x }; for (const [k, s] of Object.entries(st.sliders)) o[k] = s.v; return o; };
    const f = (F, x) => { try { return evalT(F.t, env(x)); } catch (e) { return NaN; } };
    const drawList = () => {
      list.innerHTML = st.rows.map((r, i) => `<div class="gr-row"><i style="background:${r.c}"></i><input data-row="${i}" value="${esc(r.s)}" autocomplete="off" spellcheck="false" ${touchy() ? 'inputmode="none"' : ""} aria-label="Equation ${i + 1}"><span class="gr-m">${mathHTML(r.s)}</span>${r.err ? `<em>${r.err}</em>` : ""}<button type="button" data-del="${i}" aria-label="Remove">×</button></div>`).join("")
        + (st.rows.length < 5 ? `<button type="button" class="gr-add" data-g="add">+ Add a graph</button>` : "");
    };
    const drawSliders = () => {
      sl.innerHTML = Object.entries(st.sliders).map(([k, s]) => `<label class="gr-s"><span>${mathHTML(k)} = <b>${s.v}</b></span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.v}" data-sl="${k}"></label>`).join("");
    };
    /* key points: roots, y-intercepts, turning points, crossings of two graphs */
    const keyPoints = () => {
      pts = []; if (!st.keys) return;
      const { x0, x1 } = st.view, N = 600, dx = (x1 - x0) / N;
      const refine = (g, a, b) => { let fa = g(a); for (let k = 0; k < 60; k++) { const m = (a + b) / 2, fm = g(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };
      const add = (x, y, label) => { if (!isFinite(x) || !isFinite(y)) return; if (pts.some(p => Math.abs(p.x - x) < dx * 2 && Math.abs(p.y - y) < 1e-6 + dx)) return; pts.push({ x, y, label }); };
      const live = fns.filter(F => F && !F.vert);
      for (const F of live) {
        const g = x => f(F, x);
        if (0 >= x0 && 0 <= x1) add(0, g(0), "y-intercept");
        for (let k = 0; k < N; k++) {
          const a = x0 + k * dx, b = a + dx, ga = g(a), gb = g(b);
          if (ga === 0) add(a, 0, "root"); else if (isFinite(ga) && isFinite(gb) && (ga < 0) !== (gb < 0) && Math.abs(ga - gb) < 1e3) { const r = refine(g, a, b); add(r, 0, "root"); }
          /* turning point: the slope changes sign */
          const s1 = g(a + dx / 2) - g(a - dx / 2), s2 = g(b + dx / 2) - g(b - dx / 2);
          if (isFinite(s1) && isFinite(s2) && (s1 < 0) !== (s2 < 0) && Math.abs(s1) + Math.abs(s2) > 1e-12) {
            const d = x => g(x + 1e-6) - g(x - 1e-6), r = refine(d, a - dx / 2, b + dx / 2), y = g(r);
            add(r, y, s1 < 0 ? "minimum point" : "maximum point");
          }
        }
      }
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const g = x => f(live[i], x) - f(live[j], x);
        /* the same curve written two ways: no crossings to mark */
        if ([0.13, 0.57, 1.31, 2.9, -1.7].every(x => Math.abs(g(x0 + (x1 - x0) * x / 3)) < 1e-7)) continue;
        for (let k = 0; k < N; k++) { const a = x0 + k * dx, b = a + dx, ga = g(a), gb = g(b); if (isFinite(ga) && isFinite(gb) && (ga < 0) !== (gb < 0)) { const r = refine(g, a, b); add(r, f(live[i], r), "crossing"); } }
      }
    };
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const nice = n => { const p = Math.pow(10, Math.floor(Math.log10(n))), m = n / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
    const fmt = v => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? "0" : String(r); };
    const paint = () => {
      const W = wrap.clientWidth, H = Math.round(Math.min(420, Math.max(260, W * 0.72))), dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
      const v = st.view, sx = W / (v.x1 - v.x0), sy = H / (v.y1 - v.y0);
      const X = x => (x - v.x0) * sx, Y = y => H - (y - v.y0) * sy;
      const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const line = css("--line") || "#eee", fg = css("--fg") || "#111", faint = css("--faint") || "#888";
      const step = nice(70 / sx), stepY = nice(50 / sy);
      c.lineWidth = 1; c.strokeStyle = line; c.beginPath();
      for (let x = Math.ceil(v.x0 / step) * step; x <= v.x1; x += step) { c.moveTo(Math.round(X(x)) + .5, 0); c.lineTo(Math.round(X(x)) + .5, H); }
      for (let y = Math.ceil(v.y0 / stepY) * stepY; y <= v.y1; y += stepY) { c.moveTo(0, Math.round(Y(y)) + .5); c.lineTo(W, Math.round(Y(y)) + .5); }
      c.stroke();
      c.strokeStyle = faint; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X(0), 0); c.lineTo(X(0), H); c.moveTo(0, Y(0)); c.lineTo(W, Y(0)); c.stroke();
      c.fillStyle = faint; c.font = "11px " + (css("--sans") || "sans-serif");
      const ax = Math.min(Math.max(Y(0) + 13, 13), H - 4), ay = Math.min(Math.max(X(0) - 5, 18), W - 4);
      c.textAlign = "center"; for (let x = Math.ceil(v.x0 / step) * step; x <= v.x1; x += step) if (Math.abs(x) > step / 2 && X(x) > 10 && X(x) < W - 10) c.fillText(fmt(x), X(x), ax);
      c.textAlign = "right"; for (let y = Math.ceil(v.y0 / stepY) * stepY; y <= v.y1; y += stepY) if (Math.abs(y) > stepY / 2 && Y(y) > 10 && Y(y) < H - 6) c.fillText(fmt(y), ay, Y(y) + 4);
      c.textAlign = "left"; c.fillText("x", W - 10, Y(0) - 6); c.fillText("y", X(0) + 6, 12);
      const drawn = fns.filter(Boolean);
      for (const F of fns) {
        if (!F) continue;
        /* earlier graphs a little wider, so one drawn on top of another still shows */
        c.strokeStyle = F.c; c.lineWidth = 2.4 + (drawn.length - 1 - drawn.indexOf(F)) * 3; c.globalAlpha = drawn.indexOf(F) < drawn.length - 1 ? 0.55 : 1; c.beginPath();
        if (F.vert) { const xv = f(F, 0); c.moveTo(X(xv), 0); c.lineTo(X(xv), H); c.stroke(); continue; }
        let pen = false, py = 0;
        for (let px = 0; px <= W; px += 1) {
          const y = f(F, v.x0 + px / sx), q = Y(y);
          if (!isFinite(y) || Math.abs(q) > 1e5 || (pen && Math.abs(q - py) > H * 2)) { pen = false; continue; }
          pen ? c.lineTo(px, q) : c.moveTo(px, q); pen = true; py = q;
        }
        c.stroke(); c.globalAlpha = 1;
      }
      keyPoints();
      for (const p of pts) {
        const on = st.sel === p;
        c.beginPath(); c.arc(X(p.x), Y(p.y), on ? 6 : 4.5, 0, 7); c.fillStyle = on ? fg : css("--bg") || "#fff"; c.fill(); c.lineWidth = 2; c.strokeStyle = fg; c.stroke();
      }
      st.X = X; st.Y = Y; st.sx = sx; st.sy = sy; st.H = H;
      if (st.sel && pts.includes(st.sel)) { tip.hidden = false; tip.innerHTML = `${st.sel.label}<b>(${fmt(st.sel.x)}, ${fmt(st.sel.y)})</b>`; tip.style.left = X(st.sel.x) + "px"; tip.style.top = Y(st.sel.y) + "px"; }
      else tip.hidden = true;
    };
    const redraw = (lists) => { compile(); if (lists) { drawList(); drawSliders(); } paint(); };
    redraw(true);
    new ResizeObserver(() => paint()).observe(wrap);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", paint);
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    /* typing */
    list.addEventListener("input", e => { const i = e.target.dataset.row; if (i == null) return; st.rows[i].s = e.target.value; compile(); const row = e.target.parentNode; row.querySelector(".gr-m").innerHTML = mathHTML(e.target.value); const em = row.querySelector("em"); if (em) em.remove(); drawSliders(); paint(); });
    list.addEventListener("focusout", () => { compile(); drawList(); drawSliders(); paint(); });
    list.addEventListener("focusin", e => { if (e.target.matches("input[data-row]") && touchy()) showPad(e.target); });
    list.addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
    box.addEventListener("click", e => {
      const g = e.target.closest("[data-g]"), d = e.target.closest("[data-del]");
      if (d) { st.rows.splice(+d.dataset.del, 1); redraw(true); return; }
      if (!g) return;
      const k = g.dataset.g, v = st.view, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
      const zoom = r => { const hw = (v.x1 - v.x0) / 2 * r, hh = (v.y1 - v.y0) / 2 * r; Object.assign(v, { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }); };
      if (k === "in") zoom(0.7); else if (k === "out") zoom(1 / 0.7); else if (k === "home") Object.assign(v, home);
      else if (k === "add") { st.rows.push({ s: "", c: COLORS[st.rows.length % COLORS.length] }); drawList(); list.querySelector(`[data-row="${st.rows.length - 1}"]`)?.focus(); return; }
      else if (k === "keys") { st.keys = g.checked; }
      paint();
    });
    sl.addEventListener("input", e => { const k = e.target.dataset.sl; if (!k) return; st.sliders[k].v = +e.target.value; e.target.previousElementSibling.querySelector("b").textContent = e.target.value; st.sel = null; paint(); });
    /* drag to move, pinch or scroll to zoom, tap a point for its coordinates */
    const ptrs = new Map(); let moved = false, pinch0 = 0;
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
    cv.addEventListener("pointermove", e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const v = st.view;
      if (ptrs.size === 1) {
        const dx = (e.clientX - p.x) / st.sx, dy = (e.clientY - p.y) / st.sy;
        if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 0) { if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 2) moved = true; }
        v.x0 -= dx; v.x1 -= dx; v.y0 += dy; v.y1 += dy; p.x = e.clientX; p.y = e.clientY; paint();
      } else if (ptrs.size === 2) {
        p.x = e.clientX; p.y = e.clientY; moved = true;
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) { const r = pinch0 / d, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2, hw = (v.x1 - v.x0) / 2 * r, hh = (v.y1 - v.y0) / 2 * r; Object.assign(v, { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }); paint(); }
        pinch0 = d;
      }
    });
    const up = e => {
      if (ptrs.size === 1 && !moved) {
        const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
        let best = null, bd = 22;
        for (const p of pts) { const d = Math.hypot(st.X(p.x) - mx, st.Y(p.y) - my); if (d < bd) { bd = d; best = p; } }
        st.sel = best; paint();
      }
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0;
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", e => { ptrs.delete(e.pointerId); pinch0 = 0; });
    cv.addEventListener("wheel", e => {
      e.preventDefault();
      const v = st.view, r = cv.getBoundingClientRect(), mx = v.x0 + (e.clientX - r.left) / st.sx, my = v.y0 + (st.H - (e.clientY - r.top)) / st.sy, k = Math.exp(e.deltaY * 0.0015);
      Object.assign(v, { x0: mx - (mx - v.x0) * k, x1: mx + (v.x1 - mx) * k, y0: my - (my - v.y0) * k, y1: my + (v.y1 - my) * k }); paint();
    }, { passive: false });
  }

  /* ================= The grid method, live ================= */
  function gridTool(box, start) {
    box.innerHTML = `<div class="gd-in"><span>Expand</span>${answerBox("grid", "e.g. (2x - 3)(x + 4)")}</div><div class="gd-out"></div>`;
    const inp = box.querySelector("input"), out = box.querySelector(".gd-out");
    inp.value = start;
    const termsOf = e => { e = unpar(e); return e.k === "add" ? e.terms.map(t => t.sign < 0 ? { k: "mul", fs: [{ e: { k: "num", v: -1 } }, { e: t.e }] } : t.e) : [e]; };
    const polyStr = p => {
      const ks = Object.keys(p).sort((a, b) => { const da = Object.values(monoOf(a)).reduce((x, y) => x + y, 0), db = Object.values(monoOf(b)).reduce((x, y) => x + y, 0); return db - da || (a < b ? -1 : 1); });
      if (!ks.length) return "0";
      return ks.map((k, i) => {
        const c = p[k], m = monoOf(k), body = Object.entries(m).map(([v, n]) => n > 1 ? `${v}^${n}` : v).join("");
        const mag = Math.abs(c), num = body && mag === 1 ? "" : String(Math.round(mag * 1000) / 1000);
        return (c < 0 ? (i ? " - " : "-") : i ? " + " : "") + num + body;
      }).join("");
    };
    const run = () => {
      try {
        const fs = factors(parse(inp.value)).filter(f => f.k !== "num" || f.v !== 1);
        if (fs.length !== 2) throw 0;
        const A = termsOf(fs[0]), B = termsOf(fs[1]);
        if (A.length > 3 || B.length > 3) throw 0;
        const cells = A.map(a => B.map(b => polyStr(pmul(poly(a), poly(b)))));
        const total = polyStr(pmul(poly(fs[0]), poly(fs[1])));
        out.innerHTML = `<table class="gd"><tr><th>×</th>${B.map(b => `<th>${mathHTML(polyStr(poly(b)))}</th>`).join("")}</tr>${A.map((a, i) => `<tr><th>${mathHTML(polyStr(poly(a)))}</th>${cells[i].map(c => `<td>${mathHTML(c)}</td>`).join("")}</tr>`).join("")}</table>
          <p class="gd-sum">Add the boxes: ${mathHTML(cells.flat().join(" + ").replace(/\+ -/g, "- "))}</p><p class="gd-res">= ${mathHTML(total)}</p>`;
      } catch (e) { out.innerHTML = `<p class="muted">Type two brackets multiplied together, like (x + 3)(x − 5).</p>`; }
    };
    inp.addEventListener("input", run); run();
  }

  /* ================= Pages ================= */
  let C = null, P = null, ctx = null, prog = null, saveKey = "";
  const saveProg = () => store.set(saveKey, prog);
  const pageProg = id => (prog[id] = prog[id] || { q: {} });
  function questionHTML(q, i, kind) {
    const st = P ? (pageProg(P.id).q || {})[q.id] : null;
    return `<div class="ln-q${st === "got" ? " got" : ""}" data-q="${esc(q.id)}">
      <div class="ln-qh"><span class="ln-qn">${kind === "exam" ? `Q${i + 1}` : i + 1}</span><div class="ln-qt">${rich(q.q)}${q.marks ? `<span class="ln-mk">(${q.marks} mark${q.marks > 1 ? "s" : ""})</span>` : ""}</div><span class="ln-tick" aria-label="Correct">${st === "got" ? "✓" : ""}</span></div>
      ${answerBox(q.id, q.ph)}
      <div class="ln-acts"><button type="button" class="ln-btn pri" data-check>Check</button>${q.hint ? `<button type="button" class="ln-btn" data-hint>Hint</button>` : ""}<button type="button" class="ln-btn" data-sol>Show solution</button></div>
      <div class="ln-msg" role="status"></div>
      ${q.hint ? `<div class="ln-hint" hidden>${rich(q.hint)}</div>` : ""}
      <div class="ln-sol" hidden>${(q.sol || []).map(l => `<div class="ln-step">${rich(l)}</div>`).join("")}<div class="ln-step ans">${rich(q.show || `$${q.a}$`)}</div></div>
    </div>`;
  }
  const blockHTML = {
    idea: b => `<section class="ln-b ln-idea">${b.title ? `<h3>${rich(b.title)}</h3>` : ""}<div class="ln-txt">${rich(b.text)}</div>${b.math ? `<div class="ln-big">${(Array.isArray(b.math) ? b.math : [b.math]).map(m => `<div>${mathHTML(m)}</div>`).join("")}</div>` : ""}${b.note ? `<p class="ln-note">${rich(b.note)}</p>` : ""}</section>`,
    example: (b, i) => `<section class="ln-b ln-ex" data-ex><div class="ln-tag">Worked example</div><div class="ln-qt">${rich(b.q)}</div>
      <ol class="ln-steps">${b.steps.map((s, j) => `<li ${j ? "hidden" : ""}><div class="ln-sm">${s.m ? mathHTML(s.m) : rich(s.t)}</div>${s.why ? `<div class="ln-why">${rich(s.why)}</div>` : ""}</li>`).join("")}</ol>
      <div class="ln-acts"><button type="button" class="ln-btn pri" data-next>Next step</button><button type="button" class="ln-btn" data-all>Show all</button></div></section>`,
    fade: b => `<section class="ln-b ln-ex ln-fade"><div class="ln-tag">Your turn: finish it</div><div class="ln-qt">${rich(b.q)}</div>
      <ol class="ln-steps">${b.steps.map(s => `<li><div class="ln-sm">${s.m ? mathHTML(s.m) : rich(s.t)}</div>${s.why ? `<div class="ln-why">${rich(s.why)}</div>` : ""}</li>`).join("")}</ol>
      ${questionHTML({ ...b.ask, id: b.ask.id }, 0, "fade").replace('class="ln-q', 'class="ln-q ln-q-in')}</section>`,
    grid: b => `<section class="ln-b ln-tool"><div class="ln-tag">Try it</div>${b.text ? `<p class="ln-txt">${rich(b.text)}</p>` : ""}<div class="gd-box" data-grid="${esc(b.start)}"></div></section>`,
    graph: b => `<section class="ln-b ln-tool"><div class="ln-tag">${esc(b.tag || "Explore")}</div>${b.text ? `<p class="ln-txt">${rich(b.text)}</p>` : ""}<div class="gr" data-graph="${esc(JSON.stringify({ exprs: b.exprs, sliders: b.sliders, view: b.view }))}"></div>${b.ask ? `<p class="ln-note">${rich(b.ask)}</p>` : ""}</section>`,
    watch: b => `<section class="ln-b ln-watch"><h3>Exam watch</h3><p class="ln-note">Mistakes examiners see most often on this.</p><ul>${b.items.map(x => `<li>${x.wrong ? `<span class="ln-wr">${mathHTML(x.wrong)}</span><span class="ln-ar">→</span><span class="ln-rt">${mathHTML(x.right)}</span>` : ""}<div>${rich(x.note)}</div></li>`).join("")}</ul></section>`,
    practice: b => `<section class="ln-b ln-prac"><h3>${esc(b.title || "Test yourself")}</h3>${b.text ? `<p class="ln-note">${rich(b.text)}</p>` : ""}${b.qs.map((q, i) => questionHTML(q, i, "practice")).join("")}</section>`,
    exam: b => `<section class="ln-b ln-prac ln-exam"><h3>${esc(b.title || "Exam-style questions")}</h3><p class="ln-note">${rich(b.text || "Written in the style of the exam. Show your working on paper, then type your final answer.")}</p>${b.qs.map((q, i) => questionHTML(q, i, "exam")).join("")}</section>`,
    recall: b => `<section class="ln-b ln-prac ln-recall"><h3>Quick recall</h3><p class="ln-note">Two questions from earlier pages, to keep them fresh.</p>${b.qs.map((q, i) => questionHTML(q, i, "recall")).join("")}</section>`,
  };
  const allQs = page => page.blocks.flatMap(b => b.type === "fade" ? [b.ask] : ["practice", "exam", "recall"].includes(b.type) ? b.qs : []);

  function renderOverview(root) {
    const pages = C.pages, built = id => CONTENT[ctx.L.src]?.[C.id]?.pages?.[id];
    const st = id => { const p = prog[id] || { q: {} }, n = built(id) ? allQs(built(id)).length : 0, got = Object.values(p.q || {}).filter(v => v === "got").length; return { n, got, done: p.done }; };
    const chk = CONTENT[ctx.L.src]?.[C.id]?.check || [];
    root.innerHTML = `<div class="eyebrow"><span>${esc(ctx.subject)} (${esc(ctx.course.code)}) · Chapter</span></div><h1>${esc(C.title)}</h1><p class="ln-lead">${esc(C.blurb || "")}</p>
      ${chk.length ? `<section class="ln-b ln-start"><h3>Where should I start?</h3><p class="ln-note">Try these ${chk.length} questions. We'll suggest the page to start on.</p>${chk.map((q, i) => questionHTML(q, i, "check")).join("")}<div class="ln-reco" hidden></div></section>` : ""}
      <h2 class="ln-h2">Pages</h2>
      <ol class="ln-path">${pages.map((p, i) => { const s = st(p.id); return `<li class="${p.ready ? "" : "soon"}${s.done ? " done" : ""}">${p.ready ? `<a href="${ctx.url(C.id, p.id)}">` : "<div>"}<span class="ln-dot">${s.done ? "✓" : i + 1}</span><span class="grow"><b>${esc(p.title)}</b><small>${p.ready ? (s.n ? `${s.got} of ${s.n} questions right` : "") : "Coming soon"}<span class="ln-spec">${esc(p.spec || "")}</span></small></span>${p.ready ? "</a>" : "</div>"}</li>`; }).join("")}</ol>`;
  }
  function renderPage(root) {
    const page = CONTENT[ctx.L.src][C.id].pages[P.id], idx = C.pages.findIndex(p => p.id === P.id);
    const prev = C.pages.slice(0, idx).reverse().find(p => p.ready), next = C.pages.slice(idx + 1).find(p => p.ready);
    root.innerHTML = `<div class="eyebrow"><a href="${ctx.url(C.id)}">${esc(C.title)}</a><span>·</span><span>Page ${idx + 1} of ${C.pages.length}</span>${P.spec ? `<span class="ln-spec">${esc(P.spec)}</span>` : ""}</div>
      <h1>${esc(P.title)}</h1>${page.intro ? `<p class="ln-lead">${rich(page.intro)}</p>` : ""}
      ${page.blocks.map((b, i) => blockHTML[b.type] ? blockHTML[b.type](b, i) : "").join("")}
      <div class="ln-end"><div class="ln-score"></div>
        <nav class="ln-nav">${prev ? `<a class="ln-btn" href="${ctx.url(C.id, prev.id)}">← ${esc(prev.title)}</a>` : `<a class="ln-btn" href="${ctx.url(C.id)}">← ${esc(C.title)}</a>`}${next ? `<a class="ln-btn pri" href="${ctx.url(C.id, next.id)}">${esc(next.title)} →</a>` : `<a class="ln-btn pri" href="${ctx.url(C.id)}">Back to ${esc(C.title)} →</a>`}</nav></div>`;
    root.querySelectorAll("[data-graph]").forEach(el => grapher(el, JSON.parse(el.dataset.graph)));
    root.querySelectorAll("[data-grid]").forEach(el => gridTool(el, el.dataset.grid));
    score(root);
  }
  function score(root) {
    if (!P) return;
    const page = CONTENT[ctx.L.src][C.id].pages[P.id], qs = allQs(page), p = pageProg(P.id), got = qs.filter(q => p.q[q.id] === "got").length;
    if (qs.length && got === qs.length && !p.done) { p.done = true; saveProg(); }
    const el = root.querySelector(".ln-score");
    if (el) el.innerHTML = qs.length ? `<div class="ln-bar"><i style="width:${(got / qs.length) * 100}%"></i></div><span>${got} of ${qs.length} questions right${p.done ? " · page done ✓" : ""}</span>` : "";
  }
  function findQ(id) {
    if (!P) return (CONTENT[ctx.L.src][C.id].check || []).find(q => q.id === id);
    return allQs(CONTENT[ctx.L.src][C.id].pages[P.id]).find(q => q.id === id);
  }
  function wire(root) {
    root.addEventListener("input", e => { const inp = e.target.closest("[data-ans]"); if (inp) { inp.closest(".ln-ans").querySelector(".ln-prev").innerHTML = inp.value.trim() ? mathHTML(inp.value) : ""; const m = inp.closest(".ln-q")?.querySelector(".ln-msg"); if (m) { m.textContent = ""; m.className = "ln-msg"; } } });
    root.addEventListener("focusin", e => { const inp = e.target.closest("[data-ans]"); if (inp && touchy() && inp.getAttribute("inputmode") === "none") showPad(inp); });
    root.addEventListener("focusout", e => { if (e.target.closest("[data-ans]")) setTimeout(() => { if (!document.activeElement || !document.activeElement.closest?.("[data-ans],[data-row]")) hidePad(); }, 120); });
    root.addEventListener("keydown", e => { if (e.key === "Enter") { const q = e.target.closest(".ln-q"); if (q) { e.preventDefault(); doCheck(q); } } });
    root.addEventListener("click", e => {
      const kb = e.target.closest("[data-kb]");
      if (kb) { const inp = kb.parentNode.querySelector("input"); if (pad && !pad.hidden && padFor === inp) { hidePad(); } else { inp.setAttribute("inputmode", "none"); inp.focus(); showPad(inp); } return; }
      const ex = e.target.closest("[data-ex]");
      if (ex && e.target.closest("[data-next],[data-all]")) {
        const hid = [...ex.querySelectorAll(".ln-steps li[hidden]")];
        (e.target.closest("[data-all]") ? hid : hid.slice(0, 1)).forEach(li => li.hidden = false);
        if (hid.length <= 1 || e.target.closest("[data-all]")) ex.querySelector(".ln-acts").hidden = true;
        return;
      }
      const q = e.target.closest(".ln-q"); if (!q) return;
      if (e.target.closest("[data-check]")) doCheck(q);
      else if (e.target.closest("[data-hint]")) { const h = q.querySelector(".ln-hint"); h.hidden = !h.hidden; }
      else if (e.target.closest("[data-sol]")) {
        const s = q.querySelector(".ln-sol"); s.hidden = !s.hidden;
        const id = q.dataset.q, pp = P ? pageProg(P.id) : null;
        if (pp && !s.hidden && pp.q[id] !== "got") { pp.q[id] = "tried"; saveProg(); }
      }
    });
  }
  function doCheck(qel) {
    const q = findQ(qel.dataset.q), inp = qel.querySelector("[data-ans]"), msg = qel.querySelector(".ln-msg");
    const r = check(q, inp.value);
    msg.className = "ln-msg " + (r.ok ? "ok" : "no");
    msg.innerHTML = r.ok ? (q.right ? rich(q.right) : ["Correct.", "Yes, that's right.", "Spot on."][Math.floor(Math.random() * 3)]) : rich(r.msg);
    if (P) {
      const pp = pageProg(P.id);
      if (r.ok) { pp.q[q.id] = "got"; qel.classList.add("got"); qel.querySelector(".ln-tick").textContent = "✓"; }
      else if (pp.q[q.id] !== "got") pp.q[q.id] = "tried";
      saveProg(); score(qel.closest(".ln"));
    } else {
      qel.dataset.res = r.ok ? "ok" : "no";
      const root = qel.closest(".ln-start"), all = [...root.querySelectorAll(".ln-q")];
      if (all.every(x => x.dataset.res)) {
        const first = all.find(x => x.dataset.res === "no"), page = first && C.pages.find(p => p.id === findQ(first.dataset.q).page);
        const reco = root.querySelector(".ln-reco"); reco.hidden = false;
        reco.innerHTML = page ? `Start with <b>${esc(page.title)}</b>.${page.ready ? ` <a class="ln-btn pri" href="${ctx.url(C.id, page.id)}">Go to page →</a>` : " That page is coming soon."}` : "All right. You know the basics: try the exam-style questions on each page.";
      }
    }
  }

  window.GSHLearn = {
    add(src, chapters) { CONTENT[src] = { ...(CONTENT[src] || {}), ...chapters }; },
    content: src => CONTENT[src],
    mount(root, c) {
      ctx = c; C = c.C; P = c.P; saveKey = "learn:" + c.key + "/" + C.id; prog = store.get(saveKey, {});
      hidePad();
      if (P) renderPage(root); else renderOverview(root);
      if (!root.dataset.wired) { wire(root); root.dataset.wired = "1"; }
    },
    /* for checking content and tests */
    _: { tokens, parse, poly, check, mathHTML, values },
  };
})();
