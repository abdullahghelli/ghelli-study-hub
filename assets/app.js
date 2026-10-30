(() => {
  const S = window.SITE;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slug = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("gsh-" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("gsh-" + k, JSON.stringify(v)); } catch (e) {} },
  };

  let done = store.get("done", {});
  let recent = store.get("recent", []);
  let openGroups = store.get("open", { "a-level": true });

  const course = (l, s, b) => S.courses[l]?.[s]?.[b];
  const level = l => S.levels.find(x => x.id === l);
  const subj = s => S.subjects[s];
  const firstBoard = (l, s) => Object.keys(S.courses[l][s])[0];
  const tile = (s, lg) => `<span class="tile t-${subj(s).color}${lg ? " lg" : ""}">${subj(s).mark}</span>`;

  const url = {
    subject: (l, s, b) => `/${l}/${s}/${b}`,
    topic: (l, s, b, n) => `/${l}/${s}/${b}/${n}-${slug(course(l, s, b).topics[n - 1])}`,
    papers: (l, s, b) => `/${l}/${s}/${b}/past-papers`,
  };

  const icon = {
    home: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 9 10 3.5 16.5 9v7a.5.5 0 0 1-.5.5h-4v-5h-4v5H4a.5.5 0 0 1-.5-.5Z"/></svg>',
    search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 5 5 5-5 5"/></svg>',
    paper: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 2.5h7l3.5 3.5v11.5H5Z"/><path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5"/></svg>',
    sigma: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 4H5l5 6-5 6h10"/></svg>',
    clock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/></svg>',
  };

  /* ---------- Data helpers ---------- */
  function resources(l, s, b, n) {
    const f = S.files[`${l}/${s}/${b}/${n}`] || {};
    return S.resourceTypes.map(t => {
      const given = f[t.id] || {};
      const items = t.slots.map(([title, kind]) => ({ title, kind, href: given[title] || "" }));
      for (const [title, href] of Object.entries(given)) if (!t.slots.some(x => x[0] === title)) items.push({ title, kind: "PDF", href });
      return { ...t, items };
    });
  }
  const liveCount = (l, s, b, n) => resources(l, s, b, n).reduce((a, g) => a + g.items.filter(i => i.href).length, 0);
  const isExternal = h => /^https?:/.test(h);

  /* ---------- Routing ---------- */
  function parse(path) {
    const p = path.replace(/\/+$/, "").split("/").filter(Boolean);
    if (!p.length) return { kind: "home" };
    if (p.length === 1 && ["past-papers", "formula-sheets", "exam-dates"].includes(p[0])) return { kind: p[0] };
    const [l, s, b, rest] = p;
    if (p.length === 2 && S.courses[l]?.[s]) return { kind: "subject", l, s, b: firstBoard(l, s) };
    if (!course(l, s, b)) return { kind: "notfound" };
    if (p.length === 3) return { kind: "subject", l, s, b };
    if (rest === "past-papers") return { kind: "papers", l, s, b };
    const n = parseInt(rest, 10);
    if (n >= 1 && n <= course(l, s, b).topics.length) return { kind: "topic", l, s, b, n };
    return { kind: "notfound" };
  }
  function go(href) {
    if (href === location.pathname) return;
    history.pushState(null, "", href);
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- Chrome ---------- */
  function renderSide(r) {
    const path = location.pathname;
    let h = `<a class="brand" href="/"><img src="/assets/favicon.svg" alt="">${esc(S.name)}</a>
      <a class="nav ${path === "/" ? "on" : ""}" href="/">${icon.home}Home</a>
      <button class="nav" data-act="search">${icon.search}Search</button>
      <div class="side-label">Courses</div>`;
    for (const L of S.levels) {
      h += `<div class="group ${openGroups[L.id] ? "open" : ""}"><button class="nav" data-act="group" data-id="${L.id}">${icon.chev}${L.name}</button><div class="group-kids">`;
      for (const s in S.courses[L.id]) {
        const on = r.l === L.id && r.s === s;
        h += `<a class="nav ${on ? "on" : ""}" href="${url.subject(L.id, s, on ? r.b : firstBoard(L.id, s))}"><span class="swatch s-${subj(s).color}"></span>${subj(s).name}</a>`;
      }
      h += `</div></div>`;
    }
    h += `<div class="side-label">Exam prep</div>
      <a class="nav ${path === "/past-papers" ? "on" : ""}" href="/past-papers">${icon.paper}Past papers</a>
      <a class="nav ${path === "/formula-sheets" ? "on" : ""}" href="/formula-sheets">${icon.sigma}Formula sheets</a>
      <a class="nav ${path === "/exam-dates" ? "on" : ""}" href="/exam-dates">${icon.clock}Exam dates</a>
      <div class="side-foot">Free revision for A Level, IGCSE and GCSE.</div>`;
    $("#side").innerHTML = h;
  }
  function crumbs(parts) {
    $("#crumbs").innerHTML = parts.map((p, i) => (i ? '<span class="sep">/</span>' : "") +
      (p.href && i < parts.length - 1 ? `<a href="${p.href}">${esc(p.t)}</a>` : `<span class="cur">${esc(p.t)}</span>`)).join("");
  }
  function setTitle(t) { document.title = t ? `${t} · ${S.name}` : S.name; }

  /* ---------- Views ---------- */
  function vHome() {
    crumbs([{ t: "Home" }]); setTitle();
    const hr = new Date().getHours();
    const greet = hr < 5 ? "Late night revision?" : hr < 12 ? "Good morning." : hr < 18 ? "Good afternoon." : "Good evening.";
    const rec = recent.filter(x => course(x.l, x.s, x.b)?.topics[x.n - 1]).slice(0, 5);
    let h = `<h1>${greet} What are we revising?</h1>
      <p class="lede">Notes, flashcards, topic questions and past papers for A Level, IGCSE and GCSE, sorted by exam board.</p>
      <button class="hero-search" data-act="search">${icon.search}<span>Search a topic, subject or spec code</span><kbd>⌘K</kbd></button>`;
    if (rec.length) {
      h += `<h2>Jump back in</h2><div class="list">` + rec.map(x => {
        const c = course(x.l, x.s, x.b);
        return `<a class="row" href="${url.topic(x.l, x.s, x.b, x.n)}">${tile(x.s)}<span class="grow">${esc(c.topics[x.n - 1])}</span><span class="aside">${level(x.l).name} ${subj(x.s).name} · ${S.boards[x.b]}</span></a>`;
      }).join("") + `</div>`;
    }
    h += `<h2>Courses</h2><div class="levels">` + S.levels.map(L => `
      <section class="level"><h3>${L.name}</h3><p>${L.blurb}</p><div class="list">` +
      Object.entries(S.courses[L.id]).map(([s, bs]) =>
        `<a class="row" href="${url.subject(L.id, s, Object.keys(bs)[0])}">${tile(s)}<span class="grow">${subj(s).name}</span><span class="aside">${Object.keys(bs).length} board${Object.keys(bs).length > 1 ? "s" : ""}</span></a>`).join("") +
      `</div></section>`).join("") + `</div>
      <h2>Exam prep</h2><div class="tools">
        <a class="tool" href="/past-papers"><b>${icon.paper}Past papers</b><small>Papers, mark schemes and examiner reports</small></a>
        <a class="tool" href="/formula-sheets"><b>${icon.sigma}Formula sheets</b><small>Data booklets and equation lists</small></a>
        <a class="tool" href="/exam-dates"><b>${icon.clock}Exam dates</b><small>Summer 2027 timetable</small></a>
      </div>`;
    return h;
  }

  function vSubject({ l, s, b }) {
    const c = course(l, s, b), name = `${level(l).name} ${subj(s).name}`;
    crumbs([{ t: level(l).name }, { t: subj(s).name }]); setTitle(`${name} (${S.boards[b]})`);
    const boards = Object.keys(S.courses[l][s]);
    const nDone = c.topics.filter((_, i) => done[`${l}/${s}/${b}/${i + 1}`]).length;
    return `${tile(s, true)}<h1>${name}</h1>
      <div class="facts"><span>${S.boards[b]} <b class="mono">${c.code}</b></span><span><b>${c.topics.length}</b> topics</span><a href="${url.papers(l, s, b)}" style="color:var(--accent)">Past papers →</a></div>
      ${boards.length > 1 ? `<div class="seg">${boards.map(x => `<a class="${x === b ? "on" : ""}" href="${url.subject(l, s, x)}">${S.boards[x]}</a>`).join("")}</div>` : ""}
      <div class="progress"><div class="bar"><i style="width:${(nDone / c.topics.length) * 100}%"></i></div><span>${nDone}/${c.topics.length} done</span></div>
      <h2>Topics</h2><div class="list">` +
      c.topics.map((t, i) => {
        const n = i + 1, k = `${l}/${s}/${b}/${n}`, live = liveCount(l, s, b, n);
        return `<a class="row" href="${url.topic(l, s, b, n)}"><span class="num">${String(n).padStart(2, "0")}</span><span class="grow">${esc(t)}</span><span class="aside hide-sm">${live ? `${live} file${live > 1 ? "s" : ""}` : ""}</span><span class="tick ${done[k] ? "on" : ""}" aria-label="${done[k] ? "Done" : "Not done"}"></span></a>`;
      }).join("") + `</div>`;
  }

  function vTopic({ l, s, b, n }) {
    const c = course(l, s, b), title = c.topics[n - 1], k = `${l}/${s}/${b}/${n}`;
    crumbs([{ t: level(l).name }, { t: subj(s).name, href: url.subject(l, s, b) }, { t: title }]); setTitle(title);
    recent = [{ l, s, b, n }, ...recent.filter(x => `${x.l}/${x.s}/${x.b}/${x.n}` !== k)].slice(0, 8); store.set("recent", recent);
    const groups = resources(l, s, b, n);
    let h = `<div class="eyebrow">${tile(s)}<span>${level(l).name} ${subj(s).name} · ${S.boards[b]} <span class="mono">${c.code}</span> · Topic ${n} of ${c.topics.length}</span></div>
      <h1>${esc(title)}</h1>
      <button class="done-toggle ${done[k] ? "on" : ""}" data-act="done" data-k="${k}"><span class="tick ${done[k] ? "on" : ""}"></span>${done[k] ? "Done" : "Mark as done"}</button>`;
    for (const g of groups) {
      h += `<section class="res-group"><h2>${g.label}<span>${g.items.filter(i => i.href).length}/${g.items.length}</span></h2><div class="list">` +
        g.items.map(it => it.href
          ? `<a class="row" href="${esc(it.href)}" target="_blank" rel="noopener"><span class="ftype">${it.kind}</span><span class="grow">${esc(it.title)}</span><span class="open">Open ↗</span></a>`
          : `<div class="row off"><span class="ftype">${it.kind}</span><span class="grow">${esc(it.title)}</span><span class="soon">Coming soon</span></div>`).join("") +
        `</div></section>`;
    }
    const prev = n > 1 ? `<a href="${url.topic(l, s, b, n - 1)}"><small>← Previous</small><b>${esc(c.topics[n - 2])}</b></a>` : "";
    const next = n < c.topics.length ? `<a class="next" href="${url.topic(l, s, b, n + 1)}"><small>Next →</small><b>${esc(c.topics[n])}</b></a>` : "";
    return h + `<nav class="pager">${prev}${next}</nav>`;
  }

  function vPapers({ l, s, b }) {
    const c = course(l, s, b), name = `${level(l).name} ${subj(s).name}`;
    crumbs([{ t: level(l).name }, { t: subj(s).name, href: url.subject(l, s, b) }, { t: "Past papers" }]); setTitle(`${name} past papers`);
    const series = S.series[`${l}/${b}`] || ["June"], np = S.paperCount[l], links = S.papers[`${l}/${s}/${b}`] || {};
    const cell = (ser, p, t) => { const u = links[`${ser}|${p}|${t}`]; return u ? `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : `<span class="chip" title="Coming soon">${t}</span>`; };
    let rows = "";
    for (const y of S.years) for (const se of series) {
      const ser = `${se} ${y}`;
      rows += `<tr><td>${ser}</td>${Array.from({ length: np }, (_, i) => `<td>${cell(ser, i + 1, "QP")}${cell(ser, i + 1, "MS")}</td>`).join("")}<td>${cell(ser, 0, "ER")}</td></tr>`;
    }
    return `${tile(s, true)}<h1>${name} past papers</h1>
      <div class="facts"><span>${S.boards[b]} <b class="mono">${c.code}</b></span></div>
      <h2>By series</h2>
      <div class="pp"><table><thead><tr><th>Series</th>${Array.from({ length: np }, (_, i) => `<th>Paper ${i + 1}</th>`).join("")}<th>Report</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="legend">QP question paper · MS mark scheme · ER examiner report. Highlighted codes are available.</p>`;
  }

  function allCourses(fn) {
    return S.levels.map(L => `<h2>${L.name}</h2><div class="list">` +
      Object.entries(S.courses[L.id]).flatMap(([s, bs]) => Object.entries(bs).map(([b, c]) => fn(L, s, b, c))).join("") + `</div>`).join("");
  }
  function vTool(kind) {
    if (kind === "past-papers") {
      crumbs([{ t: "Past papers" }]); setTitle("Past papers");
      return `<h1>Past papers</h1><p class="lede">Every series with question papers, mark schemes and examiner reports.</p>` +
        allCourses((L, s, b, c) => `<a class="row" href="${url.papers(L.id, s, b)}">${tile(s)}<span class="grow">${subj(s).name}</span><span class="aside">${S.boards[b]} <span class="mono">${c.code}</span></span></a>`);
    }
    if (kind === "formula-sheets") {
      crumbs([{ t: "Formula sheets" }]); setTitle("Formula sheets");
      return `<h1>Formula sheets</h1><p class="lede">Official data booklets and equation sheets for each specification.</p>` +
        allCourses((L, s, b, c) => { const u = S.formulaSheets[`${L.id}/${s}/${b}`];
          return u ? `<a class="row" href="${esc(u)}" target="_blank" rel="noopener">${tile(s)}<span class="grow">${subj(s).name} · ${S.boards[b]}</span><span class="open">Open ↗</span></a>`
                   : `<div class="row off">${tile(s)}<span class="grow">${subj(s).name} · ${S.boards[b]} <span class="mono">${c.code}</span></span><span class="soon">Coming soon</span></div>`; });
    }
    if (kind === "exam-dates") {
      crumbs([{ t: "Exam dates" }]); setTitle("Exam dates");
      return `<h1>Exam dates</h1><p class="lede">The summer 2027 timetable goes here once the exam boards publish final dates.</p>`;
    }
    crumbs([{ t: "Not found" }]); setTitle("Page not found");
    return `<h1>Page not found</h1><p class="lede">That page doesn't exist. Try searching, or <a href="/" style="color:var(--accent)">go home</a>.</p>`;
  }

  function render() {
    const r = parse(location.pathname);
    renderSide(r);
    $("#app").classList.remove("nav-open");
    const views = { home: vHome, subject: vSubject, topic: vTopic, papers: vPapers };
    const page = $("#page");
    page.style.animation = "none"; void page.offsetWidth; page.style.animation = "";
    page.innerHTML = views[r.kind] ? views[r.kind](r) : vTool(r.kind);
  }

  /* ---------- Search ---------- */
  const INDEX = [];
  for (const L of S.levels) for (const s in S.courses[L.id]) for (const b in S.courses[L.id][s]) {
    const c = S.courses[L.id][s][b], where = `${L.name} ${subj(s).name} · ${S.boards[b]}`;
    INDEX.push({ s, type: "Courses", text: `${L.name} ${subj(s).name}`, sub: `${S.boards[b]} ${c.code}`, href: url.subject(L.id, s, b) });
    INDEX.push({ s, type: "Past papers", text: `${L.name} ${subj(s).name} past papers`, sub: `${S.boards[b]} ${c.code}`, href: url.papers(L.id, s, b) });
    c.topics.forEach((t, i) => INDEX.push({ s, type: "Topics", text: t, sub: where, hay: c.code, href: url.topic(L.id, s, b, i + 1) }));
  }
  let sel = 0, hits = [];
  function runSearch() {
    const words = $("#q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      const rec = recent.filter(x => course(x.l, x.s, x.b)?.topics[x.n - 1]).slice(0, 5)
        .map(x => ({ s: x.s, type: "Recent", text: course(x.l, x.s, x.b).topics[x.n - 1], sub: `${level(x.l).name} ${subj(x.s).name}`, href: url.topic(x.l, x.s, x.b, x.n) }));
      hits = rec.concat(INDEX.filter(x => x.type === "Courses"));
    } else {
      hits = INDEX.filter(x => { const h = `${x.text} ${x.sub} ${x.hay || ""}`.toLowerCase(); return words.every(w => h.includes(w)); })
        .sort((a, b) => (a.text.toLowerCase().startsWith(words[0]) ? 0 : 1) - (b.text.toLowerCase().startsWith(words[0]) ? 0 : 1)).slice(0, 50);
    }
    sel = 0; drawHits();
  }
  function drawHits() {
    if (!hits.length) { $("#results").innerHTML = `<div class="empty">No matches. Try a topic like “Kinematics” or a code like 9PH0.</div>`; return; }
    let last = "", h = "";
    hits.forEach((x, i) => {
      if (x.type !== last) { h += `<div class="res-label">${x.type}</div>`; last = x.type; }
      h += `<button class="result ${i === sel ? "sel" : ""}" data-href="${x.href}" data-i="${i}">${tile(x.s)}<span class="grow">${esc(x.text)}</span><small>${esc(x.sub)}</small></button>`;
    });
    $("#results").innerHTML = h;
    $("#results .sel")?.scrollIntoView({ block: "nearest" });
  }
  const openSearch = () => { $("#scrim").hidden = false; $("#q").value = ""; runSearch(); $("#q").focus(); };
  const closeSearch = () => { $("#scrim").hidden = true; };

  /* ---------- Events ---------- */
  document.addEventListener("click", e => {
    const hit = e.target.closest("[data-href]");
    if (hit) { closeSearch(); go(hit.dataset.href); return; }
    const a = e.target.closest("a[href]");
    if (a && a.origin === location.origin && !a.target && !a.hasAttribute("download") && !a.pathname.startsWith("/files/") && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault(); go(a.pathname); return;
    }
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const act = t.dataset.act;
    if (act === "search") openSearch();
    if (act === "group") { openGroups[t.dataset.id] = !openGroups[t.dataset.id]; store.set("open", openGroups); t.parentElement.classList.toggle("open"); }
    if (act === "done") {
      const k = t.dataset.k; if (done[k]) delete done[k]; else done[k] = 1; store.set("done", done);
      t.classList.toggle("on", !!done[k]);
      t.innerHTML = `<span class="tick ${done[k] ? "on" : ""}"></span>${done[k] ? "Done" : "Mark as done"}`;
    }
  });
  $("#results").addEventListener("mousemove", e => {
    const b = e.target.closest(".result"); if (!b || +b.dataset.i === sel) return;
    sel = +b.dataset.i; document.querySelectorAll(".result").forEach(x => x.classList.toggle("sel", x === b));
  });
  $("#searchBtn").onclick = openSearch;
  $("#scrim").addEventListener("click", e => { if (e.target.id === "scrim") closeSearch(); });
  $("#q").addEventListener("input", runSearch);
  $("#q").addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { sel = Math.min(sel + 1, hits.length - 1); drawHits(); e.preventDefault(); }
    if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); drawHits(); e.preventDefault(); }
    if (e.key === "Enter" && hits[sel]) { closeSearch(); go(hits[sel].href); }
  });
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#scrim").hidden ? openSearch() : closeSearch(); }
    else if (e.key === "Escape") closeSearch();
    else if (e.key === "/" && $("#scrim").hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });
  $("#menuBtn").onclick = () => $("#app").classList.add("nav-open");
  $("#sideScrim").onclick = () => $("#app").classList.remove("nav-open");
  $("#themeBtn").onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark"; store.set("theme", root.dataset.theme);
  };
  window.addEventListener("popstate", render);
  render();
})();
