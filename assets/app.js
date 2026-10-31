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
    qbank: (l, t, s) => `/${l}/${t}/${s}/question-bank`,
    ppLevel: l => `/past-papers/${l}`,
    ppTrack: (l, t) => `/past-papers/${l}/${t}`,
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
    if (p[0] === "past-papers" && level(p[1]) && p.length <= 3) {
      if (p.length === 3 && !track(p[1], p[2])) return { kind: "notfound" };
      return { kind: "level", l: p[1], t: p[2], mode: "papers" };
    }
    const [l, t, s, rest] = p;
    if (!level(l)) return { kind: "notfound" };
    if (p.length === 1) return { kind: "level", l };
    if (!track(l, t)) return { kind: "notfound" };
    if (p.length === 2) return { kind: "level", l, t };
    if (!course(l, t, s)) return { kind: "notfound" };
    if (p.length === 3) return { kind: "subject", l, t, s };
    if (rest === "past-papers") return { kind: "papers", l, t, s };
    if (rest === "question-bank" && (S.qbanks || {})[K(l, t, s)]) return { kind: "qbank", l, t, s };
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
    if (r.mode === "papers") r = { kind: r.kind, l: r.l, mode: r.mode, quiet: true };
    const path = location.pathname;
    let h = `<a class="brand" href="/"><img src="/assets/favicon.svg" alt="">${esc(S.name)}</a>
      <a class="nav ${path === "/" ? "on" : ""}" href="/">${icon.home}Home</a>
      <button class="nav" data-act="search">${icon.search}Search</button>
      <div class="side-label">Qualifications</div>`;
    for (const L of S.levels) {
      const open = openGroups[L.id] ?? (r.l === L.id && !r.quiet);
      h += `<div class="group ${open ? "open" : ""}"><button class="nav ${r.l === L.id && !r.t && !r.quiet ? "on" : ""}" data-act="group" data-id="${L.id}">${icon.chev}${esc(L.short || L.name)}</button><div class="group-kids">`;
      for (const g of L.groups) for (const t of g.tracks) {
        h += `<a class="nav ${r.l === L.id && r.t === t ? "on" : ""}" href="${url.track(L.id, t)}">${esc(L.tracks[t].name)}</a>`;
      }
      h += `</div></div>`;
    }
    h += `<div class="side-label">Exam prep</div>
      <a class="nav ${path === "/past-papers" || path.startsWith("/past-papers/") ? "on" : ""}" href="/past-papers">${icon.paper}Past papers</a>
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
    if (!(parts[0] && parts[0].t === "Home")) parts = [{ t: "Home", href: "/" }, ...parts];
    const n = parts.length;
    $("#crumbs").innerHTML = parts.map((p, i) => {
      const mid = (i < n - 2 && n > 1) || (i === 0 && n > 1) ? " mid" : "";   /* hidden on phones: Home (the button covers it) and middle steps */
      const sepMid = mid || (i === n - 2 && n > 2) || (i === 1 && n === 2) ? " mid" : "";
      return (i ? `<span class="sep${sepMid}">/</span>` : "") +
        (p.href && i < n - 1 ? `<a class="crumb${mid}" href="${p.href}">${esc(p.t)}</a>` : `<span class="cur crumb${mid}">${esc(p.t)}</span>`);
    }).join("");
  }
  const setTitle = t => { document.title = t ? `${t} · ${S.name}` : S.name; };
  const trackCrumbs = (l, t) => [{ t: level(l).short || level(l).name, href: url.level(l) }, { t: track(l, t).name, href: url.track(l, t) }];

  /* ---------- Views ---------- */
  const levelCards = href => `<div class="lvl-grid">` + S.levels.map(L => `
        <a class="lvl lv-${L.id}" href="${href(L.id)}">
          <span class="lvl-name">${L.name}</span>
          <span class="lvl-boards">${L.groups.flatMap(g => g.tracks.map(t => esc(L.tracks[t].name))).join(" · ")}</span>
          ${icon.arrow}
        </a>`).join("") + `</div>`;
  const paperCount = (l, t, s) => Object.keys(S.papers[K(l, t, s)] || {}).length;

  function vHome() {
    crumbs([{ t: "Home" }]); setTitle();
    return `<div class="home">
      <h1>What are you revising?</h1>
      <p class="lede">Notes, flashcards, questions and past papers, sorted by exam board.</p>
      <div class="lvl-grid">` + S.levels.map(L => `
        <a class="lvl lv-${L.id}" href="${url.level(L.id)}">
          <span class="lvl-name">${L.name}</span>
          <span class="lvl-boards">${L.groups.flatMap(g => g.tracks.map(t => esc(L.tracks[t].name))).join(" · ")}</span>
          ${icon.arrow}
        </a>`).join("") + `</div>
      <div class="home-links">
        <a href="/past-papers">${icon.paper}Past papers</a>
        <a href="/formula-sheets">${icon.sigma}Formula sheets</a>
        <a href="/exam-dates">${icon.clock}Exam dates</a>
        <button data-act="search">${icon.search}Search a topic<kbd>⌘K</kbd></button>
      </div>
    </div>`;
  }

  function vLevel({ l, t, mode }) {
    const L = level(l), pp = mode === "papers";
    const trackHref = id => pp ? url.ppTrack(l, id) : url.track(l, id);
    const base = pp ? [{ t: "Past papers", href: "/past-papers" }] : [];
    const lvlCrumb = { t: L.short || L.name, href: pp ? url.ppLevel(l) : url.level(l) };
    crumbs(t ? [...base, lvlCrumb, { t: track(l, t).name }] : [...base, { t: L.short || L.name }]);
    setTitle(pp ? `${t ? track(l, t).full : L.name} past papers` : (t ? track(l, t).full : L.name));
    let h = t
      ? `<div class="eyebrow lv-${l}"><span class="lv-dot"></span>${esc(L.name)}</div><h1>${esc(track(l, t).full)}${pp ? " past papers" : ""}</h1><p class="lede">Pick a subject.</p>`
      : `<div class="eyebrow lv-${l}"><span class="lv-dot"></span>${pp ? "Past papers" : "Qualification"}</div><h1>${L.name}${pp ? " past papers" : ""}</h1><p class="lede">Choose your exam board.</p>`;
    if (!t) h += L.groups.map(g => `<h2>${esc(g.name)}</h2><div class="boards">` + g.tracks.map(id => {
      const T = L.tracks[id], n = Object.keys(T.subjects).length;
      return `<a class="board lv-${l} ${id === t ? "on" : ""}" href="${trackHref(id)}"><b>${esc(T.name)}</b><small>${n} subject${n > 1 ? "s" : ""}</small></a>`;
    }).join("") + `</div>`).join("");
    if (t) {
      const T = track(l, t);
      h += `<div class="list" style="margin-top:28px">` + Object.entries(T.subjects).map(([s, c]) => {
        if (!pp) return `<a class="row" href="${url.subject(l, t, s)}"><span class="grow">${esc(subj(s).name)} <span class="code s-${subj(s).color}-t">(${c.code})</span></span><span class="aside">${c.topics.length} topics</span></a>`;
        const n = paperCount(l, t, s);
        return `<a class="row" href="${url.papers(l, t, s)}"><span class="grow">${esc(subj(s).name)} <span class="code s-${subj(s).color}-t">(${c.code})</span></span><span class="aside">${n ? `${n} files` : "Coming soon"}</span></a>`;
      }).join("") + `</div>`;
    }
    return h;
  }

  function vSubject({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t), name = `${T.full} ${subj(s).name}`;
    crumbs([...trackCrumbs(l, t), { t: subj(s).name }]); setTitle(name);
    const nDone = c.topics.filter((_, i) => done[K(l, t, s, i + 1)]).length;
    return `<h1>${esc(subj(s).name)} <span class="h-code s-${subj(s).color}-t">(${c.code})</span></h1>
      <div class="facts"><span>${esc(T.full)}</span><span><b>${c.topics.length}</b> topics</span><a href="${url.papers(l, t, s)}" class="link">Past papers →</a>${(S.qbanks || {})[K(l, t, s)] ? `<a href="${url.qbank(l, t, s)}" class="link">Question bank →</a>` : ""}</div>
      <div class="progress s-${subj(s).color}-v"><div class="bar"><i style="width:${(nDone / c.topics.length) * 100}%"></i></div><span>${nDone}/${c.topics.length} done</span></div>
      <h2>Topics</h2><div class="list">` +
      c.topics.map((tp, i) => {
        const n = i + 1, k = K(l, t, s, n), live = liveCount(l, t, s, n);
        return `<a class="row" href="${url.topic(l, t, s, n)}"><span class="num s-${subj(s).color}-t">${String(n).padStart(2, "0")}</span><span class="grow">${esc(tp)}</span><span class="aside hide-sm">${live ? `${live} file${live > 1 ? "s" : ""}` : ""}</span><span class="tick ${done[k] ? "on" : ""}" aria-label="${done[k] ? "Done" : "Not done"}"></span></a>`;
      }).join("") + `</div>`;
  }

  function vTopic({ l, t, s, n }) {
    const c = course(l, t, s), T = track(l, t), title = c.topics[n - 1], k = K(l, t, s, n);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: title }]); setTitle(title);
    recent = [{ l, t, s, n }, ...recent.filter(x => K(x.l, x.t, x.s, x.n) !== k)].slice(0, 8); store.set("recent2", recent);
    let h = `<div class="eyebrow"><span>${esc(T.full)} ${esc(subj(s).name)} (${c.code}) · Topic ${n} of ${c.topics.length}</span></div>
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
      return `<a class="chip chip-${ty.toLowerCase()}" ${pdfAttrs({ src: u, title: `${name} (${ty})`, desc: `${kind} · ${T.full} ${subj(s).name} ${c.code}`, ms })} title="${esc(`${name} · ${kind}`)}">${ty}</a>`;
    };
    const rows = seriesRows.map(ser => `<tr><td>${ser}</td>${cols.map(([id]) => `<td>${cell(ser, id, "QP")}${cell(ser, id, "MS")}</td>`).join("")}${hasER ? `<td>${cell(ser, 0, "ER")}</td>` : ""}</tr>`).join("");
    return `<h1>${esc(subj(s).name)} <span class="h-code s-${subj(s).color}-t">(${c.code})</span> past papers</h1>
      <div class="facts"><span>${esc(T.full)}</span></div>
      <h2>By series</h2>
      <div class="pp"><table><thead><tr><th>Series</th>${cols.map(([, label]) => `<th>${esc(label)}</th>`).join("")}${hasER ? "<th>Report</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>
      ${c.paperNote ? `<p class="legend">${esc(c.paperNote)}</p>` : ""}
      <p class="legend">QP question paper · MS mark scheme${hasER ? " · ER examiner report" : ""}. Highlighted codes are available.</p>
      <p class="legend owner">${esc(ownerNote(t))}</p>
      ${(S.qbanks || {})[K(l, t, s)] ? `<a class="qb-cta" href="${url.qbank(l, t, s)}"><b>Question bank</b><span>Every question from these papers, sorted by spec topic →</span></a>` : ""}`;
  }

  /* ---------- Question bank ---------- */
  const qbCache = {};
  const qbState = store.get("qb", { topic: null, ptype: "all", year: "all" });
  function vQbank({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: "Question bank" }]);
    setTitle(`${T.full} ${subj(s).name} question bank`);
    const src = S.qbanks[K(l, t, s)];
    setTimeout(() => qbMount(src, K(l, t, s)), 0);
    return `<h1>${esc(subj(s).name)} <span class="h-code s-${subj(s).color}-t">(${c.code})</span> question bank</h1>
      <div class="facts"><span>${esc(T.full)}</span><span data-qb-count>Loading questions…</span><a href="${url.papers(l, t, s)}" class="link">Past papers →</a></div>
      <div class="qb" id="qb"><div class="qb-loading">Loading the question bank…</div></div>
      <p class="legend owner">${esc(ownerNote(t))}</p>`;
  }
  async function qbMount(src, key) {
    const box = $("#qb"); if (!box) return;
    let data = qbCache[src];
    if (!data) {
      try { data = qbCache[src] = await (await fetch(src)).json(); }
      catch (e) { box.innerHTML = `<div class="qb-loading">The question bank couldn't load. Check your connection and refresh.</div>`; return; }
    }
    if (!document.body.contains(box)) return;
    const papers = new Set(data.items.map(i => i.src));
    $("[data-qb-count]").innerHTML = `<b>${data.items.filter(i => !i.part).length}</b> questions from ${papers.size} papers`;
    const years = [...new Set(data.items.map(i => i.year))].sort((a, b) => b - a);
    const groups = [["pure", "Pure"], ["stats", "Statistics"], ["mech", "Mechanics"]];
    const st = qbState;
    if (!st.topic || !data.topics.some(t => t.id === st.topic)) st.topic = data.topics[0].id;
    const filtered = topicId => data.items.filter(i => (!topicId || i.topic === topicId) && (st.year === "all" || i.year === +st.year));
    const render = () => {
      store.set("qb", st);
      const tp = data.topics.find(t => t.id === st.topic);
      const inTopic = filtered(st.topic).sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper) || a.q - b.q || (a.part || "").localeCompare(b.part || ""));
      /* spec checklist for this topic: tick points to show only questions that cover them */
      const pts = Object.entries((data.points || {})[tp.group] || {}).filter(([c]) => tp.num && c.split(".")[0] === String(tp.num))
        .sort((a, b) => +a[0].split(".")[1] - +b[0].split(".")[1]);
      st.specs = st.specs || {};
      const picked = (st.specs[st.topic] || []).filter(c => pts.some(([p]) => p === c));
      const list = picked.length ? inTopic.filter(i => (i.spec || []).some(c => picked.includes(c))) : inTopic;
      const specBox = pts.length ? `<fieldset class="qb-specfilter"><legend>Spec points${picked.length ? ` <button type="button" class="qb-clear" data-qb-clear>Show all</button>` : ""}</legend>
          <div class="qb-speclist">${pts.map(([c, name]) => {
            const n = inTopic.filter(i => (i.spec || []).includes(c)).length;
            return `<label class="qb-specopt ${n ? "" : "none"}"><input type="checkbox" id="qb-spec-${c.replace(".", "-")}" data-qb-spec="${c}" ${picked.includes(c) ? "checked" : ""} ${n ? "" : "disabled"}><b>${c}</b><span>${esc(name)}</span><small>${n}</small></label>`;
          }).join("")}</div></fieldset>` : "";
      box.innerHTML = `
        <aside class="qb-topics" aria-label="Topics">
          <label class="qb-select"><span>Year</span><select id="qb-year">${["all", ...years].map(y => `<option value="${y}" ${String(st.year) === String(y) ? "selected" : ""}>${y === "all" ? "All years" : y}</option>`).join("")}</select></label>
          ${groups.map(([g, name]) => `<div class="qb-group"><div class="qb-gname">${name}</div>${data.topics.filter(t => t.group === g).map(t => {
            const n = filtered(t.id).length;
            return `<button class="qb-topic ${t.id === st.topic ? "on" : ""}" data-qb-topic="${t.id}" ${n ? "" : "disabled"}><span>${t.num ? `<i class="qb-num">${t.num}</i>` : ""}${esc(t.name)}</span><small>${n}</small></button>`;
          }).join("")}</div>`).join("")}
        </aside>
        <section class="qb-main">
          <div class="qb-mobile"><label class="qb-select"><span>Year</span><select id="qb-year-m">${["all", ...years].map(y => `<option value="${y}" ${String(st.year) === String(y) ? "selected" : ""}>${y === "all" ? "All years" : y}</option>`).join("")}</select></label>
          <label class="qb-select"><span>Topic</span><select id="qb-topic">${groups.map(([g, name]) => `<optgroup label="${name}">${data.topics.filter(t => t.group === g).map(t => `<option value="${t.id}" ${t.id === st.topic ? "selected" : ""}>${t.num ? t.num + " " : ""}${esc(t.name)} (${filtered(t.id).length})</option>`).join("")}</optgroup>`).join("")}</select></label></div>
          <div class="qb-head"><h2>${tp.num ? `<span class="qb-num">${tp.num}</span>` : ""}${esc(tp.name)}</h2><span>${list.length}${picked.length ? ` of ${inTopic.length}` : ""} question${list.length === 1 ? "" : "s"}</span></div>
          ${specBox}
          ${list.length ? list.map(i => qbCard(i, data)).join("") : `<p class="qb-empty">No questions for this topic${st.year === "all" ? "" : ` in ${st.year}`} yet.</p>`}
        </section>`;
      qbObserve(box, data);
    };
    box.onclick = e => {
      const tb = e.target.closest("[data-qb-topic]");
      if (tb) { st.topic = tb.dataset.qbTopic; render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
      if (e.target.closest("[data-qb-clear]")) { st.specs[st.topic] = []; render(); return; }
      const act = e.target.closest("[data-qb-open]");
      if (act) {
        const it = data.items.find(x => x.id === act.dataset.qbId);
        const name = `${it.series} · ${it.paper} · Q${it.q}`;
        const part = it.part ? ` part (${it.part})` : "";
        if (act.dataset.qbOpen === "ms") window.Viewer.open({ src: it.ms, title: `${name}${part} mark scheme`, desc: `Mark scheme · Edexcel A Level Maths 9MA0`, page: it.msPage || 1, y: it.msY || 0 });
        else {
          /* open the paper at the question, with the mark scheme (if shown) at the same question */
          const m = data.pdfs[it.src] || {}, s0 = it.segs[0];
          const y = s0 && m.H ? Math.max(0, (s0[1] - (m.cy || 0) - 18) / (m.H - 2 * (m.cy || 0))) : 0;
          window.Viewer.open({ src: it.src, title: name, desc: `Question paper · Edexcel A Level Maths 9MA0`, ms: it.ms || "", page: s0 ? s0[0] : 1, y, msPage: it.msPage || 1, msY: it.msY || 0 });
        }
      }
    };
    box.onchange = e => {
      if (e.target.id === "qb-year" || e.target.id === "qb-year-m") { st.year = e.target.value; render(); }
      if (e.target.id === "qb-topic") { st.topic = e.target.value; render(); }
      if (e.target.dataset.qbSpec) {
        const keep = window.scrollY;
        st.specs[st.topic] = [...box.querySelectorAll("[data-qb-spec]:checked")].map(x => x.dataset.qbSpec);
        render(); window.scrollTo(0, keep);
        $("#qb-spec-" + e.target.dataset.qbSpec.replace(".", "-"))?.focus({ preventScroll: true });
      }
    };
    render();
  }
  /* Pure and Paper 3 reuse the same numbers (8.4 is integration in Pure, forces in Mechanics) */
  const GROUP_OF = (i, data) => (data.topics.find(t => t.id === i.topic) || {}).group || "pure";
  function qbCard(i, data) {
    /* spec points the question covers, e.g. "8.5 Integration by substitution and by parts" */
    const spec = (i.spec || []).map(c => `<span class="qb-spec"><b>${c}</b> ${esc(((data.points || {})[GROUP_OF(i, data)] || {})[c] || "")}</span>`).join("");
    return `<article class="qb-card" data-qb-card="${i.id}">
      <header class="qb-card-head">
        <div class="qb-title"><b>${esc(i.series)} · ${esc(i.paper)} · Q${i.q}${i.part ? ` <span class="qb-part">part (${i.part})</span>` : ""}</b>
          ${spec ? `<div class="qb-specs">${spec}${i.checked ? `<span class="qb-checked" title="Spec points checked by hand against the mark scheme">✓ Checked</span>` : ""}</div>` : ""}
          ${i.part ? `<small>Shown with the question's opening lines</small>` : ""}</div>
        ${i.marks ? `<span class="qb-marks">${i.marks} mark${i.marks === 1 ? "" : "s"}</span>` : ""}
      </header>
      <div class="qb-snip" data-qb-snip="${i.id}" style="--ar:${qbAspect(i, data)}"></div>
      <footer class="qb-card-foot">
        ${i.ms ? `<button class="qb-btn ms" data-qb-open="ms" data-qb-id="${i.id}">Mark scheme</button>` : ""}
        <button class="qb-btn" data-qb-open="paper" data-qb-id="${i.id}">Open paper</button>
      </footer>
    </article>`;
  }
  function qbAspect(i, data) {
    const m = data.pdfs[i.src]; const w = (m.x1 || m.W * 0.905) - (m.x0 || m.W * 0.092);
    const h = i.segs.reduce((a, s) => a + (s[2] - s[1]), 0) + 4 * Math.max(0, i.segs.length - 1);
    return (w / Math.max(h, 1)).toFixed(4);
  }
  let qbObs = null;
  function qbObserve(box, data) {
    qbObs?.disconnect();
    /* draw snips as they come near the screen and free the ones far away, so long topics stay light on memory */
    qbObs = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? qbRender(e.target, data) : qbRelease(e.target)), { rootMargin: "1200px 0px" });
    box.querySelectorAll("[data-qb-snip]").forEach(el => qbObs.observe(el));
  }
  function qbRelease(el) {
    if (!el._qb) return;
    el._qb = 0;
    el.querySelectorAll("canvas").forEach(c => { c.width = 0; c.height = 0; });
    if (el.dataset.ar) el.style.setProperty("--ar", el.dataset.ar);
    el.replaceChildren(); el.classList.remove("ready");
  }
  async function qbRender(el, data) {
    if (el._qb) return;
    const token = el._qb = Math.random();
    const it = data.items.find(x => x.id === el.dataset.qbSnip); if (!it || !window.Viewer?.getDoc) return;
    const m = data.pdfs[it.src], x0 = m.x0 || m.W * 0.092, x1 = m.x1 || m.W * 0.905, cx = m.cx || 0, cy = m.cy || 0;
    try {
      const doc = await window.Viewer.getDoc(it.src);
      const cssW = el.clientWidth || 700, dpr = Math.min(window.devicePixelRatio || 1, 2), scale = cssW / (x1 - x0);
      const frag = document.createDocumentFragment();
      for (const [pn, y0, y1] of it.segs) {
        const page = await doc.getPage(pn);
        const cv = document.createElement("canvas");
        const vp = page.getViewport({ scale: scale * dpr, offsetX: -(x0 - cx) * scale * dpr, offsetY: -(y0 - cy) * scale * dpr });
        cv.width = Math.round((x1 - x0) * scale * dpr); cv.height = Math.round((y1 - y0) * scale * dpr);
        cv.style.width = cssW + "px"; cv.style.height = (y1 - y0) * scale + "px";
        await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        try { page.cleanup(); } catch (e) {}
        frag.appendChild(cv);
        if (el._qb !== token) { frag.querySelectorAll("canvas").forEach(c => { c.width = 0; c.height = 0; }); return; }
      }
      if (el._qb !== token) return;
      el.dataset.ar = el.style.getPropertyValue("--ar") || el.dataset.ar || "";
      el.replaceChildren(frag); el.classList.add("ready"); el.style.removeProperty("--ar");
    } catch (e) { if (el._qb !== token) return; el.innerHTML = `<p class="qb-err">This question couldn't load. <button class="qb-btn" data-qb-open="paper" data-qb-id="${it.id}">Open paper</button></p>`; }
  }

  function byLevel(fn) {
    return S.levels.map(L => `<h2>${esc(L.name)}</h2><div class="list">` +
      L.groups.flatMap(g => g.tracks).flatMap(t => Object.entries(L.tracks[t].subjects).map(([s, c]) => fn(L, t, s, c))).join("") + `</div>`).join("");
  }
  function vTool(kind) {
    if (kind === "past-papers") {
      crumbs([{ t: "Past papers" }]); setTitle("Past papers");
      return `<div class="home"><h1>Past papers</h1><p class="lede">Question papers and mark schemes for every series, opened right here to annotate.</p>${levelCards(url.ppLevel)}</div>`;
    }
    if (kind === "formula-sheets") {
      crumbs([{ t: "Formula sheets" }]); setTitle("Formula sheets");
      return `<h1>Formula sheets</h1><p class="lede">Official data booklets and equation sheets.</p>` +
        byLevel((L, t, s, c) => { const u = S.formulaSheets[K(L.id, t, s)], label = `${esc(subj(s).name)} (${c.code}) · ${esc(L.tracks[t].name)}`;
          return u ? `<a class="row" href="${esc(u)}" target="_blank" rel="noopener"><span class="grow">${label}</span><span class="open">Open ↗</span></a>`
                   : `<div class="row off"><span class="grow">${label}</span><span class="soon">Coming soon</span></div>`; });
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
    const views = { home: vHome, level: vLevel, subject: vSubject, topic: vTopic, papers: vPapers, qbank: vQbank };
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
      h += `<button class="result ${i === sel ? "sel" : ""}" data-href="${x.href}" data-i="${i}"><span class="grow">${esc(x.text)}</span><small>${esc(x.sub)}</small></button>`;
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
  /* Sidebar: hide/show on desktop (remembered), slide-in drawer on phones */
  const isPhone = () => matchMedia("(max-width: 820px), (max-width: 1400px) and (pointer: coarse)").matches;  /* drawer mode: phones and touch tablets */
  const syncSideBtn = () => {
    const hidden = isPhone() ? !$("#app").classList.contains("nav-open") : document.documentElement.classList.contains("side-hidden");
    $("#sideBtn").setAttribute("aria-label", hidden ? "Show sidebar" : "Hide sidebar");
    $("#sideBtn").title = (hidden ? "Show sidebar" : "Hide sidebar") + " (Ctrl+\\)";
  };
  const toggleSide = () => {
    if (isPhone()) $("#app").classList.toggle("nav-open");
    else { const h = document.documentElement.classList.toggle("side-hidden"); try { localStorage.setItem("gsh-side", h ? "hidden" : "shown"); } catch (e) {} }
    syncSideBtn();
  };
  $("#sideBtn").onclick = toggleSide;
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "\\" && !window.Viewer?.isOpen()) { e.preventDefault(); toggleSide(); } });
  syncSideBtn();
  $("#sideScrim").onclick = () => { $("#app").classList.remove("nav-open"); syncSideBtn(); };
  $("#themeBtn").onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark"; store.set("theme", root.dataset.theme);
  };
  window.addEventListener("popstate", () => { window.Viewer?.close(); render(); });
  window.addEventListener("gsh-bookmarks", () => renderSide(parse(location.pathname)));
  render();
})();
