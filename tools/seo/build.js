/* Pages for search engines: for every page worth finding (home, the subjects with past papers or a question bank,
   their topics, question banks and past paper pages) a copy of index.html with that page's own title, description,
   canonical link and a plain-HTML summary inside #page (the site's script replaces it as soon as it runs), plus
   sitemap.xml and robots.txt.

   Each page is written as <path>.html (Cloudflare Pages serves /a/b from /a/b.html). Run it after changing
   assets/data.js or a question bank:   node tools/seo/build.js
*/
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
const BASE = "https://ghelli-study-hub.pages.dev";
const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "assets/data.js"), "utf8"), { window: w });
const S = w.SITE;
const slug = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const K = (...p) => p.join("/");
const TEMPLATE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const START = "<!--seo:start-->", END = "<!--seo:end-->";
const today = new Date().toISOString().slice(0, 10);

/* the bank's topic for topic n of the course list: same name, else the most words in common (as the site does) */
function bankTopic(data, names, n) {
  const name = names[n - 1]; if (!name) return null;
  const words = x => (x.toLowerCase().match(/[a-z0-9]+/g) || []).filter(v => !["and", "of", "the", "in", "a"].includes(v));
  const same = data.topics.filter(t => t.name.toLowerCase() === name.toLowerCase());
  if (same.length) return [(same.find(t => t.num === n) || same[0]).id];
  const want = words(name), score = x => { const v = words(x); return want.filter(u => v.includes(u)).length / want.length; };
  let best = null, top = 0.5;
  for (const t of data.topics) if (score(t.name) > top) { best = [t.id]; top = score(t.name); }
  for (const [g, gname] of data.groups || []) if (score(gname) > top) { best = data.topics.filter(t => t.group === g).map(t => t.id); top = score(gname); }
  return best;
}

const pages = [];
const add = (route, title, desc, body, priority) => pages.push({ route, title, desc, body, priority });
const nav = links => `<ul>${links.map(([href, text]) => `<li><a href="${href}">${esc(text)}</a></li>`).join("")}</ul>`;

const subjects = [];
for (const L of S.levels) for (const t in L.tracks) for (const s in L.tracks[t].subjects) {
  const key = K(L.id, t, s), c = L.tracks[t].subjects[s], T = L.tracks[t], sub = S.subjects[s];
  const papers = Object.keys(S.papers[key] || {}).length, bankSrc = (S.qbanks || {})[key];
  if (!papers && !bankSrc) continue;
  const data = bankSrc ? JSON.parse(fs.readFileSync(path.join(ROOT, bankSrc), "utf8")) : null;
  const items = data ? data.items.filter(i => !i.part) : [];
  const years = items.length ? `${Math.min(...items.map(i => i.year))}–${Math.max(...items.map(i => i.year))}` : "";
  subjects.push({ L, t, s, key, c, T, sub, papers, data, items, years });
}

/* home and the hubs */
add("/", "Ghelli Study Hub · Past paper questions by topic for A Level, IGCSE and GCSE",
  "Free past paper questions sorted by topic and spec point, with mark schemes, quizzes and printable worksheets for Edexcel, Cambridge and AQA. No ads, no sign-up.",
  `<h1>Every past paper question, sorted by topic and checked against the mark scheme.</h1>
   <p>Free, no ads, no sign-up. Question banks, past papers, quizzes and printable worksheets.</p>
   <h2>Subjects</h2>${nav(subjects.map(x => [`/${x.key}`, `${x.T.full} ${x.sub.name} (${x.c.code})`]))}`, "1.0");
const banks = subjects.filter(x => x.data);
add("/question-banks", "Question banks · past paper questions by topic",
  "Topic question banks for Edexcel, Cambridge and IGCSE: every past paper question sorted by spec point, with its mark scheme, quizzes and worksheets.",
  `<h1>Question banks</h1>${nav(banks.map(x => [`/${x.key}/question-bank`, `${x.T.full} ${x.sub.name} (${x.c.code}) · ${x.items.length} questions`]))}`, "0.9");
add("/past-papers", "Past papers and mark schemes",
  "Past papers and mark schemes for Edexcel, Cambridge and IGCSE, by subject and year.",
  `<h1>Past papers</h1>${nav(subjects.filter(x => x.papers).map(x => [`/${x.key}/past-papers`, `${x.T.full} ${x.sub.name} (${x.c.code}) past papers`]))}`, "0.8");

for (const x of subjects) {
  const { L, t, s, key, c, T, sub, papers, data, items, years } = x;
  const name = `${T.full} ${sub.name}`, code = c.code;
  const topicLinks = c.topics.map((tp, i) => [`/${key}/${i + 1}-${slug(tp)}`, `${i + 1}. ${tp}`]);
  add(`/${key}`, `${name} (${code}) · topics, past paper questions and papers`,
    `${name} (${code}): ${data ? `${items.length} past paper questions sorted by topic, ` : ""}past papers and mark schemes, for all ${c.topics.length} topics.`,
    `<h1>${esc(sub.name)} (${esc(code)})</h1><p>${esc(T.full)} · ${c.topics.length} topics</p>
     ${data ? `<p><a href="/${key}/question-bank">Question bank: ${items.length} questions by topic</a></p>` : ""}
     ${papers ? `<p><a href="/${key}/past-papers">Past papers and mark schemes</a></p>` : ""}
     <h2>Topics</h2>${nav(topicLinks)}`, "0.9");
  if (data) {
    add(`/${key}/question-bank`, `${name} (${code}) question bank · ${items.length} past paper questions by topic`,
      `${items.length} ${name} (${code}) past paper questions${years ? ` from ${years}` : ""}, sorted by topic and spec point, with mark schemes. Quiz yourself or build a worksheet.`,
      `<h1>${esc(sub.name)} (${esc(code)}) question bank</h1><p>${items.length} questions${years ? `, ${years}` : ""}, sorted by topic, each with its mark scheme.</p>
       ${nav(data.topics.map(tp => [`/${key}/question-bank`, `${tp.num ? tp.num + " " : ""}${tp.name} · ${items.filter(i => i.topic === tp.id).length} questions`]))}`, "0.9");
  }
  if (papers) add(`/${key}/past-papers`, `${name} (${code}) past papers and mark schemes`,
    `Every ${name} (${code}) past paper with its mark scheme, by year and series.`,
    `<h1>${esc(sub.name)} (${esc(code)}) past papers</h1><p>Question papers and mark schemes by year.</p>`, "0.7");
  c.topics.forEach((tp, i) => {
    const n = i + 1, ids = data ? bankTopic(data, c.topics, n) : null;
    const k = ids ? items.filter(it => ids.includes(it.topic)).length : 0;
    add(`/${key}/${n}-${slug(tp)}`, `${tp} · ${name} (${code})${k ? ` · ${k} past paper questions` : ""}`,
      k ? `${k} ${name} (${code}) past paper questions on ${tp}${years ? ` from ${years}` : ""}, sorted by spec point, with mark schemes.`
        : `${tp}: ${name} (${code}) topic ${n} of ${c.topics.length}.`,
      `<h1>${esc(tp)}</h1><p>${esc(name)} (${esc(code)}) · Topic ${n} of ${c.topics.length}</p>
       ${k ? `<p><a href="/${key}/question-bank?topic=${n}">Practise this topic: ${k} past paper questions with mark schemes</a></p>` : ""}
       <p><a href="/${key}">All ${esc(sub.name)} topics</a></p>`, k ? "0.7" : "0.4");
  });
}

/* write the pages */
let written = 0;
for (const p of pages) {
  const canon = BASE + (p.route === "/" ? "/" : p.route);
  const head = `${START}<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Ghelli Study Hub">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}"><meta property="og:url" content="${canon}">
<meta name="twitter:card" content="summary">${END}`;
  let html = TEMPLATE.replace(new RegExp(`${START}[\\s\\S]*?${END}`), head)
    .replace(/<div class="page" id="page">[\s\S]*?<\/div><!--page-->/, `<div class="page" id="page">${p.body.replace(/\n\s+/g, "\n")}</div><!--page-->`);
  const file = p.route === "/" ? "index.html" : p.route.slice(1) + ".html";
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), html); written++;
}
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${BASE}${p.route === "/" ? "/" : p.route}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
console.log(written, "pages,", subjects.length, "subjects; sitemap.xml and robots.txt written");
