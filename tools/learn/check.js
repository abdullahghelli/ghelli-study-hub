/* Checks the chapter content: every answer is accepted by the site's own checker, every "expand" answer is
   recomputed from the question's expression, and a set of right and wrong answers are marked as they should be.
   Usage: node tools/learn/check.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
const win = { matchMedia: () => ({ matches: false }) };
const sb = { window: win, matchMedia: win.matchMedia, localStorage: { getItem: () => null, setItem() {} }, console };
sb.GSHLearn = null; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/learn.js"), "utf8"), sb);
sb.GSHLearn = sb.window.GSHLearn;
const L = sb.GSHLearn, T = L._;
let bad = 0, n = 0;
const fail = (...m) => { bad++; console.log("FAIL", ...m); };
for (const f of fs.readdirSync(path.join(ROOT, "assets/learn"))) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/learn", f), "utf8"), sb);
  const src = "/assets/learn/" + f, C = L.content(src);
  for (const [cid, ch] of Object.entries(C)) {
    const qs = [...(ch.check || [])];
    for (const [pid, pg] of Object.entries(ch.pages)) for (const b of pg.blocks) {
      if (b.type === "fade") qs.push(b.ask);
      if (["practice", "exam", "recall"].includes(b.type)) qs.push(...b.qs);
      for (const m of [].concat(b.math || [])) try { T.parse(m.split("=").pop()); } catch (e) { fail(pid, "maths line", m); }
    }
    const ids = new Set();
    for (const q of qs) {
      n++;
      if (ids.has(q.id)) fail(cid, "duplicate id", q.id); ids.add(q.id);
      const r = T.check(q, q.a); if (!r.ok) fail(cid, q.id, "own answer rejected:", r.msg);
      if (q.form === "expand") {
        const ms = [...q.q.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
        if (ms.length === 1) { try { const a = T.poly(T.parse(ms[0])), b = T.poly(T.parse(q.a)); if (JSON.stringify(Object.entries(a).sort()) !== JSON.stringify(Object.entries(b).sort())) fail(cid, q.id, "answer is not the expansion of", ms[0]); } catch (e) { fail(cid, q.id, "can't parse", ms[0]); } }
      }
    }
  }
}
/* the checker itself */
const cases = [
  [{ a: "x^2 - 2x - 24", form: "expand" }, "x^2-2x-24", true], [{ a: "x^2 - 2x - 24", form: "expand" }, "-24 - 2x + x²", true],
  [{ a: "x^2 - 2x - 24", form: "expand" }, "x^2 - 6x + 4x - 24", false], [{ a: "x^2 - 2x - 24", form: "expand" }, "(x+4)(x-6)", false],
  [{ a: "x^2 - 2x - 24", form: "expand" }, "x^2 + 2x - 24", false], [{ a: "4x^2 - 20x + 25", form: "expand" }, "4x^2 - 25", false],
  [{ a: "(x + 3)(x + 4)", form: "factorise" }, "(x+4)(x+3)", true], [{ a: "(x + 3)(x + 4)", form: "factorise" }, "x^2+7x+12", false],
  [{ a: "2(x + 3)(x - 1)", form: "factorise" }, "(2x+6)(x-1)", false], [{ a: "2(x + 3)(x - 1)", form: "factorise" }, "2(x-1)(x+3)", true],
  [{ a: "(x - 3)^2", form: "factorise", minFactors: 1 }, "(x-3)^2", true], [{ a: "(x - 3)^2", form: "factorise" }, "(x-3)(x-3)", true],
  [{ a: "(x + 3)^2 - 8", form: "square" }, "(x+3)^2-8", true], [{ a: "(x + 3)^2 - 8", form: "square" }, "x^2+6x+1", false],
  [{ a: "x = 3 or x = -2", form: "solve" }, "x=-2, x=3", true], [{ a: "x = 3 or x = -2", form: "solve" }, "3", false], [{ a: "x = 3 or x = -2", form: "solve" }, "x = 3 or x = 2", false],
  [{ a: "x = 0.30 or x = -3.30", form: "solve", dp: 2 }, "x = 0.303 or x = -3.303", true], [{ a: "x = 0.30 or x = -3.30", form: "solve", dp: 2 }, "0.3, -3.3", false],
  [{ a: "x = 0.30 or x = -3.30", form: "solve", dp: 2 }, "x = (-3 ± sqrt(13))/2", true], [{ a: "x = 0.30 or x = -3.30", form: "solve", dp: 2 }, "0.31, -3.31", false],
  [{ a: "2x^3 + 3x^2 - 11x - 6", form: "expand" }, "2x^3+3x^2-11x-6", true], [{ a: "x^2 + 5x - 7", form: "expand" }, "x^2+5x-7", true],
  [{ a: "y^2 - 13y + 36", form: "expand" }, "y^2-13y+36", true], [{ a: "y^2 - 13y + 36", form: "expand" }, "x^2-13x+36", false],
];
for (const [q, inp, want] of cases) { n++; const r = T.check(q, inp); if (r.ok !== want) fail("checker", JSON.stringify(q), JSON.stringify(inp), "gave", r.ok, r.msg); }
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
