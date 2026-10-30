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
  let recent = store.get("recent2", []);
  let openGroups = store.get("open2", {});

  const level = l => S.levels.find(x => x.id === l);
  const track = (l, t) => level(l)?.tracks[t];
  const course = (l, t, s) => track(l, t)?.subjects[s];
  const subj = s => S.subjects[s];
  const tile = (s, lg) => `<span class="tile t-${subj(s).color}${lg ? " lg" : ""}">${subj(s).mark}</span>`;
  const K = (...p) => p.join("/");

  const url = {
    level: l => `/${l}`,
    track: (l, t) => `/${l}/${t}`,
    subject: (l, t, s) => `/${l}/${t}/${s}`,
    topic: (l, t, s, n) => `/${l}/${t}/${s}/${n}-${slug(course(l, t, s).topics[n - 1])}`,
    papers: (l, t, s) => `/${l}/${t}/${s}/past-papers`,
  };

  const icon = {
    home: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 9 10 3.5 16.5 9v7a.5.5 0 0 1-.5.5h-4v-5h-4v5H4a.5.5 0 0 1-.5-.5Z"/></svg>',
    search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 5 5 5-5 5"/></svg>',
    arrow: '<svg class="arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 10h10m-4-4 4 4-4 4"/></svg>',
    paper: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 2.5h7l3.5 3.5v11.5H5Z"/><path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5"/></svg>',
    sigma: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 4H5l5 6-5 6h10"/></svg>',
    clock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/></svg>',
  };

  /* Attributes for a link that opens a PDF in the pop-up viewer (plain link still works with Ctrl/Cmd-click). */
  const pdfAttrs = info => `href="${esc(info.src)}" data-pdf="${esc(JSON.stringify(info))}"`;
  const isPdf = href => /\.pdf($|[?#])/i.test(href);
  const bmIcon = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M6 3.5h8v13l-4-3-4 3Z"/></svg>';

  /* Who owns each board's past papers. */
  const ownerNote = t => {
    if (t.startsWith("edexcel")) return "Past papers and mark schemes are the property of Pearson Education Ltd (Pearson Edexcel).";
    if (t.startsWith("aqa")) return "Past papers and mark schemes are the property of AQA.";
    if (t.startsWith("cambridge")) return "Past papers and mark schemes are the property of Cambridge University Press & Assessment.";
    if (t === "hl" || t === "sl") return "Past papers and mark schemes are the property of the International Baccalaureate Organization.";
    return "Past papers and mark schemes are the property of their exam board.";
  };

  /* ---------- Data helpers ---------- */
  function resources(l, t, s, n) {
    const f = S.files[K(l, t, s, n)] || {};
    return S.resourceTypes.map(rt => {
      const given = f[rt.id] || {};
      const items = rt.slots.map(([title, kind]) => ({ title, kind, href: given[title] || "" }));
      for (const [title, href] of Object.entries(given)) if (!rt.slots.some(x => x[0] === title)) items.push({ title, kind: "PDF", href });
      return { ...rt, items };
    });
  }
  const liveCount = (l, t, s, n) => resources(l, t, s, n).reduce((a, g) => a + g.items.filter(i => i.href).length, 0);
  function eachCourse(fn) {
    for (const L of S.levels) for (const t in L.tracks) for (const s in L.tracks[t].subjects) fn(L, t, s, L.tracks[t].subjects[s]);
  }

  /* ---------- Routing ---------- */
  function parse(path) {
    const p = path.replace(/\/+$/, "").split("/").filter(Boolean);
    if (!p.length) return { kind: "home" };
    if (p[0] === "viewer") return { kind: "viewer" };
    if (p.length === 1 && ["past-papers", "formula-sheets", "exam-dates"].includes(p[0])) return { kind: p[0] };
    const [l, t, s, rest] = p;
    if (!level(l)) return { kind: "notfound" };
    if (p.length === 1) return { kind: "level", l };
    if (!track(l, t)) return { kind: "notfound" };
    if (p.length === 2) return { kind: "level", l, t };
    if (!course(l, t, s)) return { kind: "notfound" };
    if (p.length === 3) return { kind: "subject", l, t, s };
    if (rest === "past-papers") return { kind: "papers", l, t, s };
    const n = parseInt(rest, 10);
    if (n >= 1 && n <= course(l, t, s).topics.length) return { kind: "topic", l, t, s, n };
    return { kind: "notfound" };
  }
  function go(href) {
    if (href !== location.pathname + location.search) history.pushState(null, "", href);
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- Chrome ---------- */
  function renderSide(r) {
    const path = location.pathname;
    let h = `<a class="brand" href="/"><img src="/assets/favicon.svg" alt="">${esc(S.name)}</a>
      <a class="nav ${path === "/" ? "on" : ""}" href="/">${icon.home}Home</a>
      <button class="nav" data-act="search">${icon.search}Search</button>
      <div class="side-label">Qualifications</div>`;
    for (const L of S.levels) {
      const open = openGroups[L.id] ?? r.l === L.id;
      h += `<div class="group ${open ? "open" : ""}"><button class="nav ${r.l === L.id && !r.t ? "on" : ""}" data-act="group" data-id="${L.id}">${icon.chev}${esc(L.short || L.name)}</button><div class="group-kids">`;
      for (const g of L.groups) for (const t of g.tracks) {
        h += `<a class="nav ${r.l === L.id && r.t === t ? "on" : ""}" href="${url.track(L.id, t)}">${esc(L.tracks[t].name)}</a>`;
      }
      h += `</div></div>`;
    }
    h += `<div class="side-label">Exam prep</div>
      <a class="nav ${path === "/past-papers" ? "on" : ""}" href="/past-papers">${icon.paper}Past papers</a>
      <a class="nav ${path === "/formula-sheets" ? "on" : ""}" href="/formula-sheets">${icon.sigma}Formula sheets</a>
      <a class="nav ${path === "/exam-dates" ? "on" : ""}" href="/exam-dates">${icon.clock}Exam dates</a>
      <div class="side-label">PDF bookmarks</div>`;
    const bms = window.Viewer ? window.Viewer.Bookmarks.all() : [];
    h += bms.length
      ? bms.slice(0, 12).map(b => `<div class="bm"><button class="nav" data-bm='${esc(JSON.stringify({ src: b.src, page: b.page }))}' title="${esc(b.title)} · page ${b.page}">${bmIcon}<span class="bm-t">${esc(b.title)}</span><span class="bm-p">p.${b.page}</span></button><button class="bm-x" data-bm-x='${esc(JSON.stringify({ src: b.src, page: b.page }))}' aria-label="Remove bookmark">×</button></div>`).join("")
      : `<p class="side-hint">Open any PDF and tap Bookmark to save a page. It will show here.</p>`;
    $("#side").innerHTML = h;
  }
  function crumbs(parts) {
    $("#crumbs").innerHTML = parts.map((p, i) => (i ? '<span class="sep">/</span>' : "") +
      (p.href && i < parts.length - 1 ? `<a href="${p.href}">${esc(p.t)}</a>` : `<span class="cur">${esc(p.t)}</span>`)).join("");
  }
  const setTitle = t => { document.title = t ? `${t} · ${S.name}` : S.name; };
  const trackCrumbs = (l, t) => [{ t: level(l).short || level(l).name, href: url.level(l) }, { t: track(l, t).name, href: url.track(l, t) }];

  /* ---------- Views ---------- */
  function vHome() {
    crumbs([{ t: "Home" }]); setTitle();
    return `<div class="home">
      <h1>What are you revising?</h1>
      <p class="lede">Notes, flashcards, questions and past papers, sorted by exam board.</p>
      <div class="lvl-grid">` + S.levels.map(L => `
        <a class="lvl" href="${url.level(L.id)}">
          <span class="lvl-name">${L.name}</span>
          <span class="lvl-boards">${L.groups.flatMap(g => g.tracks.map(t => esc(L.tracks[t].name))).join(" · ")}</span>
          ${icon.arrow}
        </a>`).join("") + `</div>
      <button class="hero-search" data-act="search">${icon.search}<span>Or search a topic</span><kbd>⌘K</kbd></button>
    </div>`;
  }

  function vLevel({ l, t }) {
    const L = level(l);
    crumbs(t ? trackCrumbs(l, t) : [{ t: L.short || L.name }]);
    setTitle(t ? track(l, t).full : L.name);
    let h = `<h1>${L.name}</h1><p class="lede">${t ? "Pick a subject." : "Choose your exam board."}</p>`;
    h += L.groups.map(g => `<h2>${esc(g.name)}</h2><div class="boards">` + g.tracks.map(id => {
      const T = L.tracks[id], n = Object.keys(T.subjects).length;
      return `<a class="board ${id === t ? "on" : ""}" href="${url.track(l, id)}"><b>${esc(T.name)}</b><small>${n} subject${n > 1 ? "s" : ""}</small></a>`;
    }).join("") + `</div>`).join("");
    if (t) {
      const T = track(l, t);
      h += `<h2>${esc(T.full)} subjects</h2><div class="list">` + Object.entries(T.subjects).map(([s, c]) =>
        `<a class="row" href="${url.subject(l, t, s)}">${tile(s)}<span class="grow">${esc(subj(s).name)}</span><span class="aside"><span class="mono">${c.code}</span> · ${c.topics.length} topics</span></a>`).join("") + `</div>`;
    }
    return h;
  }

  function vSubject({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t), name = `${T.full} ${subj(s).name}`;
    crumbs([...trackCrumbs(l, t), { t: subj(s).name }]); setTitle(name);
    const nDone = c.topics.filter((_, i) => done[K(l, t, s, i + 1)]).length;
    return `${tile(s, true)}<h1>${esc(subj(s).name)}</h1>
      <div class="facts"><span>${esc(T.full)} <b class="mono">${c.code}</b></span><span><b>${c.topics.length}</b> topics</span><a href="${url.papers(l, t, s)}" class="link">Past papers →</a></div>
      <div class="progress"><div class="bar"><i style="width:${(nDone / c.topics.length) * 100}%"></i></div><span>${nDone}/${c.topics.length} done</span></div>
      <h2>Topics</h2><div class="list">` +
      c.topics.map((tp, i) => {
        const n = i + 1, k = K(l, t, s, n), live = liveCount(l, t, s, n);
        return `<a class="row" href="${url.topic(l, t, s, n)}"><span class="num">${String(n).padStart(2, "0")}</span><span class="grow">${esc(tp)}</span><span class="aside hide-sm">${live ? `${live} file${live > 1 ? "s" : ""}` : ""}</span><span class="tick ${done[k] ? "on" : ""}" aria-label="${done[k] ? "Done" : "Not done"}"></span></a>`;
      }).join("") + `</div>`;
  }

  function vTopic({ l, t, s, n }) {
    const c = course(l, t, s), T = track(l, t), title = c.topics[n - 1], k = K(l, t, s, n);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: title }]); setTitle(title);
    recent = [{ l, t, s, n }, ...recent.filter(x => K(x.l, x.t, x.s, x.n) !== k)].slice(0, 8); store.set("recent2", recent);
    let h = `<div class="eyebrow">${tile(s)}<span>${esc(T.full)} ${esc(subj(s).name)} <span class="mono">${c.code}</span> · Topic ${n} of ${c.topics.length}</span></div>
      <h1>${esc(title)}</h1>
      <button class="done-toggle ${done[k] ? "on" : ""}" data-act="done" data-k="${k}"><span class="tick ${done[k] ? "on" : ""}"></span>${done[k] ? "Done" : "Mark as done"}</button>`;
    for (const g of resources(l, t, s, n)) {
      h += `<section class="res-group"><h2>${g.label}<span>${g.items.filter(i => i.href).length}/${g.items.length}</span></h2><div class="list">` +
        g.items.map(it => it.href
          ? (isPdf(it.href)
              ? `<a class="row" ${pdfAttrs({ src: it.href, title: it.title, desc: `${title} · ${T.full} ${subj(s).name}` })}><span class="ftype">${it.kind}</span><span class="grow">${esc(it.title)}</span><span class="open">Open</span></a>`
              : `<a class="row" href="${esc(it.href)}" target="_blank" rel="noopener"><span class="ftype">${it.kind}</span><span class="grow">${esc(it.title)}</span><span class="open">Open ↗</span></a>`)
          : `<div class="row off"><span class="ftype">${it.kind}</span><span class="grow">${esc(it.title)}</span><span class="soon">Coming soon</span></div>`).join("") +
        `</div></section>`;
    }
    const prev = n > 1 ? `<a href="${url.topic(l, t, s, n - 1)}"><small>← Previous</small><b>${esc(c.topics[n - 2])}</b></a>` : "";
    const next = n < c.topics.length ? `<a class="next" href="${url.topic(l, t, s, n + 1)}"><small>Next →</small><b>${esc(c.topics[n])}</b></a>` : "";
    return h + `<nav class="pager">${prev}${next}</nav>`;
  }

  function vPapers({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: "Past papers" }]); setTitle(`${T.full} ${subj(s).name} past papers`);
    const links = S.papers[K(l, t, s)] || {};
    /* A course can name its own papers (c.paperList: [[id, label], …]) and list its exact series (c.paperSeries). */
    const cols = c.paperList || Array.from({ length: T.papers }, (_, i) => [String(i + 1), `Paper ${i + 1}`]);
    const seriesRows = c.paperSeries || S.years.flatMap(y => T.series.map(se => `${se} ${y}`));
    const hasER = Object.keys(links).some(k => k.endsWith("|ER")) || !c.paperList;
    const colLabel = id => (cols.find(c2 => c2[0] === String(id)) || [, "Examiner report"])[1];
    const cell = (ser, p, ty) => {
      const u = links[`${ser}|${p}|${ty}`];
      if (!u) return `<span class="chip" title="Coming soon">${ty}</span>`;
      const kind = { QP: "Question paper", MS: "Mark scheme", ER: "Examiner report" }[ty];
      const name = `${colLabel(p)} · ${ser}`;
      const ms = ty === "QP" ? links[`${ser}|${p}|MS`] : "";
      return `<a class="chip" ${pdfAttrs({ src: u, title: `${name} (${ty})`, desc: `${kind} · ${T.full} ${subj(s).name} ${c.code}`, ms })} title="${esc(`${name} · ${kind}`)}">${ty}</a>`;
    };
    const rows = seriesRows.map(ser => `<tr><td>${ser}</td>${cols.map(([id]) => `<td>${cell(ser, id, "QP")}${cell(ser, id, "MS")}</td>`).join("")}${hasER ? `<td>${cell(ser, 0, "ER")}</td>` : ""}</tr>`).join("");
    return `${tile(s, true)}<h1>${esc(subj(s).name)} past papers</h1>
      <div class="facts"><span>${esc(T.full)} <b class="mono">${c.code}</b></span></div>
      <h2>By series</h2>
      <div class="pp"><table><thead><tr><th>Series</th>${cols.map(([, label]) => `<th>${esc(label)}</th>`).join("")}${hasER ? "<th>Report</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>
      ${c.paperNote ? `<p class="legend">${esc(c.paperNote)}</p>` : ""}
      <p class="legend">QP question paper · MS mark scheme${hasER ? " · ER examiner report" : ""}. Highlighted codes are available.</p>
      <p class="legend owner">${esc(ownerNote(t))}</p>`;
  }

  function byLevel(fn) {
    return S.levels.map(L => `<h2>${esc(L.name)}</h2><div class="list">` +
      L.groups.flatMap(g => g.tracks).flatMap(t => Object.entries(L.tracks[t].subjects).map(([s, c]) => fn(L, t, s, c))).join("") + `</div>`).join("");
  }
  function vTool(kind) {
    if (kind === "past-papers") {
      crumbs([{ t: "Past papers" }]); setTitle("Past papers");
      return `<h1>Past papers</h1><p class="lede">Every series with question papers, mark schemes and examiner reports.</p>` +
        byLevel((L, t, s, c) => `<a class="row" href="${url.papers(L.id, t, s)}">${tile(s)}<span class="grow">${esc(subj(s).name)}</span><span class="aside">${esc(L.tracks[t].name)} <span class="mono">${c.code}</span></span></a>`);
    }
    if (kind === "formula-sheets") {
      crumbs([{ t: "Formula sheets" }]); setTitle("Formula sheets");
      return `<h1>Formula sheets</h1><p class="lede">Official data booklets and equation sheets.</p>` +
        byLevel((L, t, s, c) => { const u = S.formulaSheets[K(L.id, t, s)], label = `${esc(subj(s).name)} · ${esc(L.tracks[t].name)}`;
          return u ? `<a class="row" href="${esc(u)}" target="_blank" rel="noopener">${tile(s)}<span class="grow">${label}</span><span class="open">Open ↗</span></a>`
                   : `<div class="row off">${tile(s)}<span class="grow">${label}</span><span class="soon">Coming soon</span></div>`; });
    }
    if (kind === "exam-dates") {
      crumbs([{ t: "Exam dates" }]); setTitle("Exam dates");
      return `<h1>Exam dates</h1><p class="lede">The summer 2027 timetable goes here once the exam boards publish final dates.</p>`;
    }
    crumbs([{ t: "Not found" }]); setTitle("Page not found");
    return `<h1>Page not found</h1><p class="lede">That page doesn't exist. Try searching, or <a href="/" class="link">go home</a>.</p>`;
  }

  function render() {
    const r = parse(location.pathname);
    renderSide(r);
    $("#app").classList.remove("nav-open");
    const page = $("#page");
    if (r.kind === "viewer") {
      /* Old /viewer links from the previous version: go back to where they came from and pop the paper open. */
      const q = new URLSearchParams(location.search), back = q.get("back") || "/";
      history.replaceState(null, "", back.startsWith("/") && !back.startsWith("//") ? back : "/");
      render();
      if (q.get("src")) window.Viewer?.open({ src: q.get("src"), title: q.get("title") || "Paper", ms: q.get("ms") || "" });
      return;
    }
    const views = { home: vHome, level: vLevel, subject: vSubject, topic: vTopic, papers: vPapers };
    page.style.animation = "none"; void page.offsetWidth; page.style.animation = "";
    page.innerHTML = views[r.kind] ? views[r.kind](r) : vTool(r.kind);
  }

  /* ---------- Search ---------- */
  const INDEX = [];
  eachCourse((L, t, s, c) => {
    const T = L.tracks[t], where = `${T.full} · ${subj(s).name}`;
    INDEX.push({ s, type: "Subjects", text: `${subj(s).name}`, sub: `${T.full} ${c.code}`, href: url.subject(L.id, t, s) });
    INDEX.push({ s, type: "Past papers", text: `${subj(s).name} past papers`, sub: `${T.full} ${c.code}`, href: url.papers(L.id, t, s) });
    c.topics.forEach((tp, i) => INDEX.push({ s, type: "Topics", text: tp, sub: where, hay: `${c.code} ${L.name}`, href: url.topic(L.id, t, s, i + 1) }));
  });
  let sel = 0, hits = [];
  function runSearch() {
    const words = $("#q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      hits = recent.filter(x => course(x.l, x.t, x.s)?.topics[x.n - 1]).slice(0, 5)
        .map(x => ({ s: x.s, type: "Recent", text: course(x.l, x.t, x.s).topics[x.n - 1], sub: `${track(x.l, x.t).full} · ${subj(x.s).name}`, href: url.topic(x.l, x.t, x.s, x.n) }));
      if (!hits.length) hits = INDEX.filter(x => x.type === "Subjects").slice(0, 12);
    } else {
      hits = INDEX.filter(x => { const h = `${x.text} ${x.sub} ${x.hay || ""}`.toLowerCase(); return words.every(w => h.includes(w)); })
        .sort((a, b) => (a.text.toLowerCase().startsWith(words[0]) ? 0 : 1) - (b.text.toLowerCase().startsWith(words[0]) ? 0 : 1)).slice(0, 50);
    }
    sel = 0; drawHits();
  }
  function drawHits() {
    if (!hits.length) { $("#results").innerHTML = `<div class="empty">No matches. Try a topic like “Kinematics” or a code like 0625.</div>`; return; }
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
    const pdf = e.target.closest("[data-pdf]");
    if (pdf && !e.metaKey && !e.ctrlKey && !e.shiftKey && window.Viewer) { e.preventDefault(); window.Viewer.open(JSON.parse(pdf.dataset.pdf)); return; }
    const bmX = e.target.closest("[data-bm-x]");
    if (bmX) { const b = JSON.parse(bmX.dataset.bmX); window.Viewer.Bookmarks.remove(b.src, b.page); return; }
    const bm = e.target.closest("[data-bm]");
    if (bm) {
      const { src, page } = JSON.parse(bm.dataset.bm), b = window.Viewer.Bookmarks.all().find(x => x.src === src && x.page === page);
      if (b) { $("#app").classList.remove("nav-open"); window.Viewer.open(b); }
      return;
    }
    const hit = e.target.closest("[data-href]");
    if (hit) { closeSearch(); go(hit.dataset.href); return; }
    const a = e.target.closest("a[href]");
    if (a && /^https?:$/.test(a.protocol) && a.origin === location.origin && !a.target && !a.hasAttribute("download") && !a.pathname.startsWith("/files/") && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault(); go(a.pathname + a.search); return;
    }
    const tg = e.target.closest("[data-act]");
    if (!tg) return;
    const act = tg.dataset.act;
    if (act === "search") openSearch();
    if (act === "group") {
      const id = tg.dataset.id, grp = tg.parentElement;
      openGroups[id] = !grp.classList.contains("open"); store.set("open2", openGroups); grp.classList.toggle("open");
    }
    if (act === "done") {
      const k = tg.dataset.k; if (done[k]) delete done[k]; else done[k] = 1; store.set("done", done);
      tg.classList.toggle("on", !!done[k]);
      tg.innerHTML = `<span class="tick ${done[k] ? "on" : ""}"></span>${done[k] ? "Done" : "Mark as done"}`;
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
  window.addEventListener("popstate", () => { window.Viewer?.close(); render(); });
  window.addEventListener("gsh-bookmarks", () => renderSide(parse(location.pathname)));
  render();
})();
