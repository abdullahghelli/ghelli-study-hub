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
    bank: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="3" width="13" height="14" rx="2"/><path d="m6.5 7.5 1.2 1.2 2.3-2.4M6.5 12.5l1.2 1.2 2.3-2.4M12 8h2M12 13h2"/></svg>',
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
    if (p.length === 1 && ["past-papers", "question-banks", "formula-sheets", "exam-dates"].includes(p[0])) return { kind: p[0] };
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
      <a class="nav ${path === "/question-banks" ? "on" : ""}" href="/question-banks">${icon.bank}Question bank</a>
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

  /* the specs this person uses, chosen on the question bank page (kept on this device) */
  const qbKeys = () => Object.keys(S.qbanks || {}).filter(k => course(...k.split("/")));
  const qbMine = () => store.get("qb-mine", []).filter(k => (S.qbanks || {})[k]);
  let qbPicking = false;
  const qbLabel = k => { const [l, t, s] = k.split("/"); return `${subj(s).name} ${course(l, t, s).code} · ${track(l, t).full}`; };
  /* picker: every spec with a question bank, tap to add or remove it from yours */
  function qbPicker() {
    const mine = qbMine();
    return `<div class="qbk-grid qbk-pick">` + qbKeys().map(k => {
      const [l, t, s] = k.split("/"), c = course(l, t, s), on = mine.includes(k);
      return `<button type="button" class="qbk s-${subj(s).color}-q ${on ? "on" : ""}" data-qb-mine="${k}" aria-pressed="${on}">
        <span class="qbk-ic">${on ? `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>` : icon.bank}</span>
        <span class="qbk-name">${esc(subj(s).name)} <span class="qbk-code">${esc(c.code)}</span></span>
        <span class="qbk-sub">${esc(track(l, t).full)}</span>
      </button>`;
    }).join("") + `</div>`;
  }
  /* one card per subject that has a question bank */
  function qbankCards(keys = Object.keys(S.qbanks || {})) {
    return `<div class="qbk-grid">` + keys.map(k => {
      const [l, t, s] = k.split("/"), c = course(l, t, s); if (!c) return "";
      return `<a class="qbk s-${subj(s).color}-q" href="${url.qbank(l, t, s)}">
        <span class="qbk-ic">${icon.bank}</span>
        <span class="qbk-name">${esc(subj(s).name)} <span class="qbk-code">${esc(c.code)}</span></span>
        <span class="qbk-sub">${esc(track(l, t).full)}</span>
        ${icon.arrow}
      </a>`;
    }).join("") + `</div>`;
  }

  /* returning visitors: carry on where they left off, and their own specs one tap away */
  function homeMine() {
    const last = store.get("qb-last", null), mine = qbMine();
    const lastOk = last && (S.qbanks || {})[last.k] && course(...last.k.split("/"));
    if (!lastOk && !mine.length) return "";
    const lastLink = lastOk ? (() => {
      const [l, t, s] = last.k.split("/"), c = course(l, t, s);
      return `<a class="home-cont s-${subj(s).color}-q" href="${url.qbank(l, t, s)}"><small>Continue where you left off</small><b>${esc(subj(s).name)} ${esc(c.code)}${last.name ? ` · ${last.num ? last.num + " " : ""}${esc(last.name)}` : ""}</b>${icon.arrow}</a>`;
    })() : "";
    return `<section class="home-mine">${lastLink}${mine.length ? `<div class="qbk-head"><h2>Your subjects</h2><a class="qb-btn" href="/question-banks">Change</a></div>${qbankCards(mine)}` : ""}</section>`;
  }

  function vHome() {
    crumbs([{ t: "Home" }]); setTitle();
    return `<div class="home">
      <h1>What are you revising?</h1>
      <p class="lede">Every past paper question, sorted by topic and checked against the mark scheme.</p>
      <p class="home-free"><span>Free</span><span>No ads</span><span>No sign-up</span></p>
      ${homeMine()}
      <div class="lvl-grid">` + S.levels.map(L => `
        <a class="lvl lv-${L.id}" href="${url.level(L.id)}">
          <span class="lvl-name">${L.name}</span>
          <span class="lvl-boards">${L.groups.flatMap(g => g.tracks.map(t => esc(L.tracks[t].name))).join(" · ")}</span>
          ${icon.arrow}
        </a>`).join("") + `</div>
      <div class="subj-tiles home-tiles">
        ${Object.keys(S.qbanks || {}).length ? `<a class="subj-tile primary" href="/question-banks">${icon.bank}<span><b>Question bank</b><small>Past paper questions by spec topic</small></span>${icon.arrow}</a>` : ""}
        <a class="subj-tile" href="/past-papers">${icon.paper}<span><b>Past papers</b><small>Question papers and mark schemes</small></span>${icon.arrow}</a>
      </div>
      <div class="home-links">
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

  /* the subject's progress: questions tried in its question bank (once some are), otherwise topics marked done */
  function qbSubjProg(l, t, s, c, nDone) {
    const sum = Object.values(store.get("qbsum:" + K(l, t, s), {}) || {});
    const tried = sum.reduce((a, x) => a + x[0], 0), total = sum.reduce((a, x) => a + x[1], 0), got = sum.reduce((a, x) => a + x[2], 0);
    if (tried) return `<div class="progress s-${subj(s).color}-v"><div class="bar"><i style="width:${(tried / total) * 100}%"></i></div><span><b>${tried}</b> of ${total} questions tried · ${got} got it</span></div>`;
    return `<div class="progress s-${subj(s).color}-v"><div class="bar"><i style="width:${(nDone / c.topics.length) * 100}%"></i></div><span>${nDone}/${c.topics.length} done</span></div>`;
  }

  function vSubject({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t), name = `${T.full} ${subj(s).name}`;
    crumbs([...trackCrumbs(l, t), { t: subj(s).name }]); setTitle(name);
    const nDone = c.topics.filter((_, i) => done[K(l, t, s, i + 1)]).length;
    return `<h1>${esc(subj(s).name)} <span class="h-code s-${subj(s).color}-t">(${c.code})</span></h1>
      <div class="facts"><span>${esc(T.full)}</span><span><b>${c.topics.length}</b> topics</span></div>
      <div class="subj-tiles">
        ${(S.qbanks || {})[K(l, t, s)] ? `<a class="subj-tile primary" href="${url.qbank(l, t, s)}">${icon.bank}<span><b>Question bank</b><small>Past paper questions by spec topic</small></span>${icon.arrow}</a>` : ""}
        <a class="subj-tile" href="${url.papers(l, t, s)}">${icon.paper}<span><b>Past papers</b><small>Question papers and mark schemes</small></span>${icon.arrow}</a>
      </div>
      ${qbSubjProg(l, t, s, c, nDone)}
      <h2>Topics</h2><div class="list">` +
      c.topics.map((tp, i) => {
        const n = i + 1, k = K(l, t, s, n), live = liveCount(l, t, s, n);
        const head = (c.topicGroups || []).find(([from]) => from === n);
        const qb = (S.qbanks || {})[K(l, t, s)] ? `<a class="row-q" href="${url.qbank(l, t, s)}?topic=${n}" aria-label="Questions on ${esc(tp)}">Questions →</a>` : "";
        const ts = (store.get("qbsum:" + K(l, t, s), {}) || {})[n];
        const tbar = ts && ts[0] ? `<span class="row-prog" title="${ts[0]} of ${ts[1]} questions tried, ${ts[2]} got it"><i style="width:${(ts[0] / ts[1]) * 100}%"></i></span>` : "";
        return `${head ? `<div class="list-head">${esc(head[1])}</div>` : ""}<div class="row-wrap"><a class="row" href="${url.topic(l, t, s, n)}"><span class="num s-${subj(s).color}-t">${String(n).padStart(2, "0")}</span><span class="grow">${esc(tp)}</span><span class="aside hide-sm">${live ? `${live} file${live > 1 ? "s" : ""}` : ""}</span>${tbar}<span class="tick ${done[k] ? "on" : ""}" aria-label="${done[k] ? "Done" : "Not done"}"></span></a>${qb}</div>`;
      }).join("") + `</div>`;
  }

  function vTopic({ l, t, s, n }) {
    const c = course(l, t, s), T = track(l, t), title = c.topics[n - 1], k = K(l, t, s, n);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: title }]); setTitle(title);
    recent = [{ l, t, s, n }, ...recent.filter(x => K(x.l, x.t, x.s, x.n) !== k)].slice(0, 8); store.set("recent2", recent);
    let h = `<div class="eyebrow"><span>${esc(T.full)} ${esc(subj(s).name)} (${c.code}) · Topic ${n} of ${c.topics.length}</span></div>
      <h1>${esc(title)}</h1>
      <button class="done-toggle ${done[k] ? "on" : ""}" data-act="done" data-k="${k}"><span class="tick ${done[k] ? "on" : ""}"></span>${done[k] ? "Done" : "Mark as done"}</button>
      ${(S.qbanks || {})[K(l, t, s)] ? `<div class="subj-tiles"><a class="subj-tile primary" href="${url.qbank(l, t, s)}?topic=${n}">${icon.bank}<span><b>Practise this topic</b><small>Past paper questions on ${esc(title)}</small></span>${icon.arrow}</a></div>` : ""}`;
    /* only what's there: items without a file, and sections with none, are left out until they arrive */
    for (const g0 of resources(l, t, s, n)) {
      const g = { ...g0, items: g0.items.filter(i => i.href) };
      if (!g.items.length) continue;
      h += `<section class="res-group"><h2>${g.label}</h2><div class="list">` +
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
  /* jump to another spec's bank: your specs first, then the rest */
  function qbSwitch(cur) {
    const mine = qbMine(), rest = qbKeys().filter(k => !mine.includes(k));
    const opt = k => `<option value="${url.qbank(...k.split("/"))}" ${k === cur ? "selected" : ""}>${esc(qbLabel(k))}</option>`;
    return `<label class="qb-switch"><span>Spec</span><select id="qb-spec-switch" aria-label="Switch spec">${mine.length
      ? `<optgroup label="Your specs">${mine.map(opt).join("")}</optgroup>${rest.length ? `<optgroup label="Other specs">${rest.map(opt).join("")}</optgroup>` : ""}`
      : qbKeys().map(opt).join("")}</select></label>`;
  }
  document.addEventListener("change", e => { if (e.target.id === "qb-spec-switch") go(e.target.value); });
  const qbCache = {};
  const qbState = store.get("qb", { topic: null, ptype: "all", year: "all" });
  function vQbank({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: "Question bank" }]);
    setTitle(`${T.full} ${subj(s).name} question bank`);
    const src = S.qbanks[K(l, t, s)];
    setTimeout(() => qbMount(src, K(l, t, s)), 0);
    return `<h1>${esc(subj(s).name)} <span class="h-code s-${subj(s).color}-t">(${c.code})</span> question bank</h1>
      <div class="facts"><span>${esc(T.full)}</span><span data-qb-count>Loading questions…</span><a href="${url.papers(l, t, s)}" class="link">Past papers →</a>
        ${qbSwitch(K(l, t, s))}</div>
      <div class="qb" id="qb"><div class="qb-loading">Loading the question bank…</div></div>
      <p class="legend owner">${esc(ownerNote(t))}</p>`;
  }
  /* the bank topic that matches topic n of the course's own topic list: same name (topic n itself when names repeat,
     e.g. 9701's AS and A Level "Equilibria"), else the topic or unit sharing the most words */
  function qbTopicFor(data, key, n, whole) {
    const name = (course(...key.split("/")).topics || [])[n - 1]; if (!name) return null;
    const words = x => (x.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !["and", "of", "the", "in", "a"].includes(w));
    const same = data.topics.filter(t => t.name.toLowerCase() === name.toLowerCase());
    if (same.length) return (same.find(t => t.num === n) || same[0]).id;
    const want = words(name), score = x => { const w = words(x); return want.filter(v => w.includes(v)).length / want.length; };
    let best = null, top = 0.5;
    for (const t of data.topics) if (score(t.name) > top) { best = t.id; top = score(t.name); }
    let unit = null;
    for (const [g, gname] of data.groups || []) if (score(gname) > top) { best = (data.topics.find(t => t.group === g) || {}).id || best; unit = g; top = score(gname); }
    return whole && unit ? { group: unit } : best;
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
    const groups = data.groups || [["pure", "Pure"], ["stats", "Statistics"], ["mech", "Mechanics"]];
    const st = qbState;
    qbProg = { key: "qbp:" + src, map: store.get("qbp:" + src, {}) };
    st.show = ["all", "new", "weak", "got"].includes(st.show) ? st.show : "all";
    qbWs = { key: "ws:" + src, data, ids: store.get("ws:" + src, []).filter(id => data.items.some(i => i.id === id)), parts: store.get("ws:" + src + ":parts", {}) };
    qbWsBar();
    const want = +new URLSearchParams(location.search).get("topic");
    if (want) {
      const t0 = qbTopicFor(data, key, want);
      if (t0) st.topic = t0;
      history.replaceState(history.state, "", location.pathname);
    }
    if (!st.topic || !data.topics.some(t => t.id === st.topic)) st.topic = data.topics[0].id;
    /* modular courses (IAL): units are separate papers, so the bank shows one unit's topics at a time */
    const unitOf = id => (data.topics.find(t => t.id === id) || {}).group;
    const shown = () => data.modular ? groups.filter(([g]) => g === unitOf(st.topic)) : groups;
    /* banks covering several papers (Cambridge 9701: Paper 1 multiple choice, Papers 2 and 4) can show one paper at a time */
    const paperOf = () => data.papers && data.papers.some(([p]) => p === st.paper) ? st.paper : "all";
    const filtered = topicId => data.items.filter(i => (!topicId || i.topic === topicId) && (st.year === "all" || i.year === +st.year) && (paperOf() === "all" || i.ptype === paperOf()));
    const paperSel = id => data.papers ? `<label class="qb-select"><span>Paper</span><select id="${id}">${[["all", "All papers"], ...data.papers].map(([p, name]) => `<option value="${p}" ${paperOf() === p ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>` : "";
    const render = () => {
      store.set("qb", st);
      const tp = data.topics.find(t => t.id === st.topic);
      store.set("qb-last", { k: key, name: tp.name, num: tp.num || null });
      const inTopic = filtered(st.topic).sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper) || a.q - b.q || (a.part || "").localeCompare(b.part || ""));
      /* spec checklist for this topic: tick points to show only questions that cover them */
      const pts = Object.entries((data.points || {})[tp.group] || {}).filter(([c]) => tp.num && c.split(".")[0] === String(tp.num))
        .sort((a, b) => +a[0].split(".")[1] - +b[0].split(".")[1]);
      st.specs = st.specs || {};
      let picked = (st.specs[st.topic] || []).filter(c => pts.some(([p]) => p === c));
      if (pts.length === 1 && !picked.length) picked = [pts[0][0]];   /* one spec point: nothing to choose */
      /* questions load only once spec points are ticked (topics without a spec list show everything) */
      const waiting = pts.length && !picked.length;
      /* a question shows only when every point it covers from this topic is ticked: ticking 2.1 alone leaves out
         questions that also need 2.2 or 2.3 (points from other topics don't count against it) */
      const own = c => pts.some(([p]) => p === c);
      const bySpec = picked.length ? inTopic.filter(i => { const mine = (i.spec || []).filter(own); return mine.length && mine.every(c => picked.includes(c)); })
        : waiting ? [] : inTopic;
      /* Show: every question, ones not tried yet, ones missed or partly right (to go back over), or ones got */
      const shows = { all: () => true, new: i => !qbProg.map[i.id], weak: i => ["miss", "part"].includes(qbProg.map[i.id]), got: i => qbProg.map[i.id] === "got" };
      const list = bySpec.filter(shows[st.show]);
      qbSummary(data, key);
      const specBox = pts.length ? `<fieldset class="qb-specfilter"><legend>Spec points${picked.length ? ` <button type="button" class="qb-clear" data-qb-clear>Clear</button>` : ` <button type="button" class="qb-clear" data-qb-all>Select all</button>`}</legend>
          <div class="qb-speclist">${pts.map(([c, name]) => {
            const n = inTopic.filter(i => (i.spec || []).includes(c)).length;
            return `<label class="qb-specopt ${n ? "" : "none"}"><input type="checkbox" id="qb-spec-${c.replace(".", "-")}" data-qb-spec="${c}" ${picked.includes(c) ? "checked" : ""} ${n ? "" : "disabled"}><b>${c}</b><span>${esc(name)}</span><small data-qb-sprog="${c}">${qbSpecProg(inTopic, c)}</small></label>`;
          }).join("")}</div></fieldset>` : "";
      box.innerHTML = `
        <aside class="qb-topics" aria-label="Topics">
          <label class="qb-select"><span>Year</span><select id="qb-year">${["all", ...years].map(y => `<option value="${y}" ${String(st.year) === String(y) ? "selected" : ""}>${y === "all" ? "All years" : y}</option>`).join("")}</select></label>
          ${paperSel("qb-paper")}
          ${data.modular ? `<div class="qb-units" role="group" aria-label="Unit" style="--n:${groups.length}">${groups.map(([g, name]) => `<button class="qb-unit ${g === unitOf(st.topic) ? "on" : ""}" data-qb-unit="${g}" title="${esc(name)}" aria-pressed="${g === unitOf(st.topic)}">${esc(name.split(" ·")[0])}</button>`).join("")}</div>` : ""}
          ${shown().map(([g, name]) => `<div class="qb-group"><div class="qb-gname">${name}</div>${data.topics.filter(t => t.group === g).map(t => {
            const n = filtered(t.id).length;
            return `<button class="qb-topic ${t.id === st.topic ? "on" : ""}" data-qb-topic="${t.id}" ${n ? "" : "disabled"}><span>${t.num ? `<i class="qb-num">${t.num}</i>` : ""}${esc(t.name)}</span><small>${n}</small><i class="qb-tbar" data-qb-tprog="${t.id}">${qbBar(filtered(t.id))}</i></button>`;
          }).join("")}</div>`).join("")}
        </aside>
        <section class="qb-main">
          <div class="qb-mobile">${data.modular ? `<label class="qb-select"><span>Unit</span><select id="qb-unit">${groups.map(([g, name]) => `<option value="${g}" ${g === unitOf(st.topic) ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>` : ""}<label class="qb-select"><span>Year</span><select id="qb-year-m">${["all", ...years].map(y => `<option value="${y}" ${String(st.year) === String(y) ? "selected" : ""}>${y === "all" ? "All years" : y}</option>`).join("")}</select></label>
          ${paperSel("qb-paper-m")}
          <label class="qb-select"><span>Topic</span><select id="qb-topic">${shown().map(([g, name]) => `<optgroup label="${name}">${data.topics.filter(t => t.group === g).map(t => `<option value="${t.id}" ${t.id === st.topic ? "selected" : ""}>${t.num ? t.num + " " : ""}${esc(t.name)} (${filtered(t.id).length})</option>`).join("")}</optgroup>`).join("")}</select></label></div>
          <div class="qb-head"><h2>${tp.num ? `<span class="qb-num">${tp.num}</span>` : ""}${esc(tp.name)}</h2><span>${waiting ? `${inTopic.length} question${inTopic.length === 1 ? "" : "s"}` : `${list.length}${picked.length || st.show !== "all" ? ` of ${inTopic.length}` : ""} question${list.length === 1 ? "" : "s"}`}</span></div>
          <p class="qb-tprog" data-qb-hprog>${qbHeadProg(inTopic)}</p>
          ${specBox}
          ${waiting ? "" : `<div class="qb-show" role="group" aria-label="Show">${[["all", "All"], ["new", "Not tried"], ["weak", "Missed or partly"], ["got", "Got it"]].map(([v, l]) => `<button type="button" class="qb-showbtn ${st.show === v ? "on" : ""}" data-qb-show="${v}" aria-pressed="${st.show === v}">${l}</button>`).join("")}</div>`}
          ${list.length ? `<div class="qb-wsall"><span class="qb-fill"><label for="qb-fill-n">Fill a worksheet to</label><input id="qb-fill-n" type="number" min="1" max="300" value="${store.get("ws-fill", 40)}" inputmode="numeric"><span>marks</span><button type="button" class="qb-btn" data-qb-fill>Fill</button></span><button type="button" class="qb-btn" data-qb-wsall></button></div>` : ""}
          ${waiting ? `<p class="qb-empty qb-pick">Tick one or more spec points above to load their questions.</p>` : list.length ? list.map(i => qbCard(i, data)).join("") : (st.show !== "all" && bySpec.length ? `<p class="qb-empty">${{ new: "You've tried every question here.", weak: "Nothing missed here. 🎉", got: "None marked Got it yet." }[st.show]}</p>` : `<p class="qb-empty">No questions for this topic${st.year === "all" ? "" : ` in ${st.year}`} yet.</p>`)}
        </section>`;
      qbObserve(box, data); qbWsAll(box);
    };
    box.onclick = e => {
      if (e.target.closest("[data-qb-fill]")) {
        /* questions shown here, in random order, until the marks reach the target (never a question that would go well past it) */
        const n = Math.max(1, Math.min(300, +box.querySelector("#qb-fill-n").value || 40)); store.set("ws-fill", n);
        const have = qbWs.ids.reduce((a, id) => a + qbWsMarks(id), 0);
        const pool = [...box.querySelectorAll("[data-qb-card]")].map(c => c.dataset.qbCard).filter(id => !qbWs.ids.includes(id));
        for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
        let total = have; const added = [];
        for (const id of pool) {
          const m = (data.items.find(x => x.id === id) || {}).marks || 1;
          if (total + m <= n) { added.push(id); total += m; }
          if (total >= n) break;
        }
        qbWs.ids = qbWs.ids.concat(added); qbWsSave(); qbWsBar(); added.forEach(qbRefreshCard); qbWsAll(box);
        qbToast(added.length ? `Added ${added.length} question${added.length === 1 ? "" : "s"} · worksheet now ${total} marks` : total >= n ? `The worksheet already has ${total} marks` : "No more questions here fit");
        return;
      }
      const pt = e.target.closest("[data-qb-pt]");
      if (pt) { qbPartToggle(pt.dataset.qbPt, pt.dataset.l); qbWsAll(box); return; }
      const sh = e.target.closest("[data-qb-show]");
      if (sh) { st.show = sh.dataset.qbShow; render(); return; }
      const mk = e.target.closest("[data-qb-st]");
      if (mk) { const id = mk.closest("[data-qb-card]").dataset.qbCard; qbSetProg(id, qbProg.map[id] === mk.dataset.qbSt ? null : mk.dataset.qbSt, box, data, key); return; }
      /* multiple choice: pick A-D, then Check */
      const opt = e.target.closest("[data-qb-opt]");
      if (opt) {
        const mc = opt.closest("[data-qb-mcq]");
        mc.querySelectorAll("[data-qb-opt]").forEach(b => { const on = b === opt; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.classList.remove("right", "wrong"); });
        const cb = mc.querySelector("[data-qb-check]"); if (cb) cb.disabled = false;
        mc.querySelector(".qb-mcq-res").innerHTML = "";
        return;
      }
      const chk = e.target.closest("[data-qb-check], [data-qb-reveal]");
      if (chk) {
        const mc = chk.closest("[data-qb-mcq]"), it = data.items.find(x => x.id === mc.dataset.qbMcq), res = mc.querySelector(".qb-mcq-res");
        const pick = mc.querySelector("[data-qb-opt].on");
        if (chk.dataset.qbReveal !== undefined) {
          mc.querySelectorAll("[data-qb-opt]").forEach(b => b.classList.toggle("right", b.dataset.qbOpt === it.ans));
          res.innerHTML = `<span class="qb-mcq-ans">The answer is <b>${it.ans}</b></span>`;
          return;
        }
        if (!pick) return;
        const ok = pick.dataset.qbOpt === it.ans;
        qbSetProg(it.id, ok ? "got" : "miss", box, data, key);
        pick.classList.add(ok ? "right" : "wrong");
        res.innerHTML = ok ? `<span class="qb-mcq-ok">✓ Correct</span>` : `<span class="qb-mcq-no">✗ Not right</span> <button type="button" class="qb-link" data-qb-reveal>Show answer</button>`;
        return;
      }
      const wa = e.target.closest("[data-qb-wsall]");
      if (wa) {   /* every question loaded right now, in the order shown */
        const ids = [...box.querySelectorAll("[data-qb-card]")].map(c => c.dataset.qbCard);
        qbWs.ids = wa.dataset.qbWsall === "add" ? qbWs.ids.concat(ids.filter(id => !qbWs.ids.includes(id))) : qbWs.ids.filter(id => !ids.includes(id));
        if (wa.dataset.qbWsall === "add") ids.forEach(id => delete qbWs.parts[id]);
        qbWsSave(); qbWsBar(); ids.forEach(qbRefreshCard);
        qbWsAll(box); return;
      }
      const wb = e.target.closest("[data-qb-ws]");
      if (wb) { qbWsToggle(wb.dataset.qbWs); qbWsAll(box); return; }
      const ub = e.target.closest("[data-qb-unit]");
      if (ub) { st.topic = (data.topics.find(t => t.group === ub.dataset.qbUnit && filtered(t.id).length) || data.topics.find(t => t.group === ub.dataset.qbUnit)).id; render(); return; }
      const tb = e.target.closest("[data-qb-topic]");
      if (tb) { st.topic = tb.dataset.qbTopic; render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
      if (e.target.closest("[data-qb-clear]")) { st.specs[st.topic] = []; render(); return; }
      if (e.target.closest("[data-qb-all]")) { st.specs[st.topic] = [...box.querySelectorAll("[data-qb-spec]:not(:disabled)")].map(x => x.dataset.qbSpec); render(); return; }
      const act = e.target.closest("[data-qb-open]");
      if (act) {
        const it = data.items.find(x => x.id === act.dataset.qbId);
        const name = `${it.series} · ${it.paper} · Q${it.q}`;
        const part = it.part ? ` part (${it.part})` : "";
        const msPages = qbMsPages(it, data);
        if (act.dataset.qbOpen === "ms") window.Viewer.open({ src: it.ms, title: `${name}${part} mark scheme`, desc: `Mark scheme · ${data.label || "Edexcel A Level Maths 9MA0"}`, page: it.msPage || 1, y: it.msY || 0, pages: msPages, wholeLabel: "Whole mark scheme" });
        else {
          /* open the paper at the question, with the mark scheme (if shown) at the same question */
          const m = data.pdfs[it.src] || {}, s0 = it.segs[0];
          const y = s0 && m.H ? Math.max(0, (s0[1] - (m.cy || 0) - 18) / (m.H - 2 * (m.cy || 0))) : 0;
          /* opens just the page(s) the question is on; "Whole paper" in the viewer shows the rest */
          const pages = [...new Set(it.segs.map(sg => sg[0]))];
          window.Viewer.open({ src: it.src, title: `${name}${part}`, desc: `Question · ${data.label || "Edexcel A Level Maths 9MA0"}`, ms: it.ms || "", page: s0 ? s0[0] : 1, y, msPage: it.msPage || 1, msY: it.msY || 0, pages, msPages });
        }
      }
    };
    box.onchange = e => {
      if (e.target.id === "qb-year" || e.target.id === "qb-year-m") { st.year = e.target.value; render(); }
      if (e.target.id === "qb-paper" || e.target.id === "qb-paper-m") { st.paper = e.target.value; render(); }
      if (e.target.id === "qb-topic") { st.topic = e.target.value; render(); }
      if (e.target.id === "qb-unit") { const g = e.target.value; st.topic = (data.topics.find(t => t.group === g && filtered(t.id).length) || data.topics.find(t => t.group === g)).id; render(); }
      if (e.target.dataset.qbSpec) {
        const keep = window.scrollY;
        st.specs[st.topic] = [...box.querySelectorAll("[data-qb-spec]:checked")].map(x => x.dataset.qbSpec);
        render(); window.scrollTo(0, keep);
        $("#qb-spec-" + e.target.dataset.qbSpec.replace(".", "-"))?.focus({ preventScroll: true });
      }
    };
    render();
  }
  /* ----- Worksheet builder: pick questions, then download one PDF with their pages and, at the back,
     their mark scheme pages. Picks are kept per question bank in this browser. ----- */
  let qbWs = { key: "", data: null, ids: [], parts: {} };
  /* parts picked for a question on the worksheet (none listed = the whole question) */
  const qbWsSave = () => { for (const k in qbWs.parts) if (!qbWs.ids.includes(k)) delete qbWs.parts[k]; store.set(qbWs.key, qbWs.ids); store.set(qbWs.key + ":parts", qbWs.parts); };
  /* the part chips on a card: tap (a) to put only part (a) on the worksheet, tap more to add them */
  const qbPartsHtml = i => {
    if (i.part || !(i.parts || []).length) return "";
    const on = qbWs.ids.includes(i.id), sel = qbWs.parts[i.id];
    return `<span class="qb-parts" data-qb-parts="${i.id}"><small>Parts</small>${i.parts.map(p => {
      const lit = on && (!sel || sel.includes(p.l));
      return `<button type="button" class="qb-pt ${lit ? "on" : ""}" data-qb-pt="${i.id}" data-l="${p.l}" aria-pressed="${lit}">${p.l}</button>`;
    }).join("")}</span>`;
  };
  const qbRefreshCard = id => {
    document.querySelectorAll(`[data-qb-ws="${CSS.escape(id)}"]`).forEach(b => b.outerHTML = qbWsButton(id));
    const it = qbWs.data?.items.find(x => x.id === id);
    document.querySelectorAll(`[data-qb-parts="${CSS.escape(id)}"]`).forEach(b => b.outerHTML = qbPartsHtml(it));
  };
  function qbPartToggle(id, l) {
    const it = qbWs.data.items.find(x => x.id === id), all = it.parts.map(p => p.l);
    let sel = qbWs.ids.includes(id) ? (qbWs.parts[id] || all.slice()) : [];
    sel = sel.includes(l) ? sel.filter(x => x !== l) : all.filter(x => x === l || sel.includes(x));
    if (!sel.length) { qbWs.ids = qbWs.ids.filter(x => x !== id); delete qbWs.parts[id]; }
    else {
      if (!qbWs.ids.includes(id)) qbWs.ids.push(id);
      if (sel.length === all.length) delete qbWs.parts[id]; else qbWs.parts[id] = sel;
    }
    qbWsSave(); qbRefreshCard(id); qbWsBar();
  }
  const qbWsButton = id => {
    const on = qbWs.ids.includes(id);
    return `<button class="qb-btn wsb${on ? " on" : ""}" data-qb-ws="${id}" aria-pressed="${on}">${on ? "✓ On worksheet" : "+ Worksheet"}</button>`;
  };
  function qbWsToggle(id) {
    const k = qbWs.ids.indexOf(id);
    if (k >= 0) qbWs.ids.splice(k, 1); else qbWs.ids.push(id);
    delete qbWs.parts[id];
    qbWsSave(); qbRefreshCard(id);
    qbWsBar();
  }
  /* label of the "add all loaded questions" button, from the cards on screen */
  function qbWsAll(box) {
    const b = box.querySelector("[data-qb-wsall]"); if (!b) return;
    const ids = [...box.querySelectorAll("[data-qb-card]")].map(c => c.dataset.qbCard), n = ids.filter(id => qbWs.ids.includes(id)).length;
    const all = n === ids.length;
    b.dataset.qbWsall = all ? "remove" : "add"; b.classList.toggle("on", all);
    b.textContent = all ? `Remove all ${ids.length} from worksheet` : n ? `+ Add the other ${ids.length - n} to worksheet` : `+ Add all ${ids.length} to worksheet`;
  }
  /* marks a worksheet question carries: its picked parts, or the whole question */
  function qbWsMarks(id) {
    const it = qbWs.data.items.find(i => i.id === id) || {}, sel = qbWs.parts[id];
    return sel && it.parts ? it.parts.filter(p => sel.includes(p.l)).reduce((b, p) => b + (p.m || 0), 0) : it.marks || 0;
  }
  function qbToast(msg) {
    let t = $("#qb-toast"); if (!t) { t = document.createElement("div"); t.id = "qb-toast"; t.className = "qb-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600);
  }
  /* before building: title, a cover page and whether to include the mark schemes.
     The choices are remembered on this device. */
  /* every worksheet carries the site owner's name, bottom right of every page */
  const WS_FOOTER = "Abdullah Ghelli";
  function qbWsDialog() {
    const o = store.get("ws-opts", { cover: true, ms: true, footer: "" });
    const data = qbWs.data, topic = (data.topics.find(t => t.id === qbState.topic) || {}).name || "";
    const dlg = document.createElement("div"); dlg.className = "qb-dlg-wrap";
    dlg.innerHTML = `<form class="qb-dlg" role="dialog" aria-modal="true" aria-labelledby="qb-dlg-h">
      <h2 id="qb-dlg-h">Build worksheet</h2>
      <label class="qb-field"><span>Title</span><input name="title" value="${esc(o.titleFor === data.spec ? o.title : `${data.spec} · ${topic}`)}" maxlength="80"></label>
      <label class="qb-check"><input type="checkbox" name="cover" ${o.cover ? "checked" : ""}><span><b>Cover page</b><small>Title, name and date lines, total marks, suggested time and the list of questions</small></span></label>
      <label class="qb-check"><input type="checkbox" name="ms" ${o.ms ? "checked" : ""}><span><b>Mark schemes at the back</b><small>Untick for a student copy without answers</small></span></label>
      <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Cancel</button><button type="submit" class="qb-btn primary">Build PDF</button></div>
    </form>`;
    document.body.appendChild(dlg);
    const f = dlg.querySelector("form"), close = () => dlg.remove();
    f.title.focus(); f.title.select();
    dlg.onclick = e => { if (e.target === dlg || e.target.closest("[data-x]")) close(); };
    dlg.onkeydown = e => { if (e.key === "Escape") close(); };
    f.onsubmit = e => {
      e.preventDefault();
      const opts = { title: f.title.value.trim(), titleFor: data.spec, footer: WS_FOOTER, cover: f.cover.checked, ms: f.ms.checked };
      store.set("ws-opts", opts); close();
      qbWsBuild($("#qb-ws-bar [data-ws=build]"), opts);
    };
  }
  function qbWsBar() {
    let bar = $("#qb-ws-bar");
    const n = qbWs.ids.length;
    if (!n) { bar?.remove(); document.body.classList.remove("ws-on"); return; }
    if (!bar) {
      bar = document.createElement("div"); bar.id = "qb-ws-bar"; bar.className = "qb-ws-bar";
      bar.onclick = e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.ws === "clear") { const was = qbWs.ids; qbWs.ids = []; qbWs.parts = {}; qbWsSave(); was.forEach(qbRefreshCard); qbWsBar(); }
        if (b.dataset.ws === "build") qbWsDialog();
      };
      document.body.appendChild(bar);
    }
    document.body.classList.add("ws-on");
    const marks = qbWs.ids.reduce((a, id) => a + qbWsMarks(id), 0);
    bar.innerHTML = `<span><b>Worksheet</b> · ${n} question${n === 1 ? "" : "s"}${marks ? `<i class="wsm" style="font-style:normal"> · ${marks} marks</i>` : ""}</span>
      <button class="qb-btn" data-ws="clear">Clear</button>
      <button class="qb-btn primary" data-ws="build">Build PDF</button>`;
  }
  async function qbWsBuild(btn, opts = { cover: false, ms: true, title: "" }) {
    opts = { ...opts, footer: WS_FOOTER };
    const data = qbWs.data, items = qbWs.ids.map(id => data.items.find(i => i.id === id)).filter(Boolean);
    if (!items.length) return;
    btn.disabled = true; btn.textContent = "Building…";
    try {
      await window.Viewer.loadPdfLib();
      const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
      /* drawing on a page as it is seen: some mark scheme pages are stored on their side and shown turned (/Rotate).
         at(u, v) maps a point measured from the bottom left of the page as seen to the page's own coordinates. */
      const view = pg => {
        const c = pg.getCropBox(), a = ((pg.getRotation().angle % 360) + 360) % 360, side = a % 180 !== 0;
        const at = (u, v) => a === 90 ? { x: c.x + c.width - v, y: c.y + u } : a === 180 ? { x: c.x + c.width - u, y: c.y + c.height - v }
          : a === 270 ? { x: c.x + v, y: c.y + c.height - u } : { x: c.x + u, y: c.y + v };
        return { W: side ? c.height : c.width, H: side ? c.width : c.height, at, rotate: degrees(a) };
      };
      const out = await PDFDocument.create(), cache = {}, used = new Set();
      const load = async src => cache[src] ||= PDFDocument.load(await (await fetch(src)).arrayBuffer(), { ignoreEncryption: true });
      /* copy pages (1-based) of src not already in the worksheet */
      const placed = {};   /* "src|page" -> the copied page in the worksheet */
      const add = async (src, pages) => {
        const doc = await load(src), n = doc.getPageCount();
        const want = pages.filter(p => p >= 1 && p <= n && !placed[src + "|" + p]);
        if (want.length) (await out.copyPages(doc, want.map(p => p - 1))).forEach((pg, k) => { out.addPage(pg); placed[src + "|" + want[k]] = pg; });
      };
      const font = await out.embedFont(StandardFonts.Helvetica), bold = await out.embedFont(StandardFonts.HelveticaBold);
      const ink = rgb(0.11, 0.12, 0.12);
      /* the worksheet number in a circle in the left margin; top = distance from the top of the visible page */
      const stamp = (pg, num, top) => {
        if (!pg) return;
        const v = view(pg), r = 11, t = String(num), size = t.length > 1 ? 10.5 : 12;
        const cu = 19, cv = Math.min(v.H - r - 4, Math.max(r + 4, v.H - top));
        const c0 = v.at(cu, cv), t0 = v.at(cu - bold.widthOfTextAtSize(t, size) / 2, cv - size * 0.36);
        pg.drawCircle({ x: c0.x, y: c0.y, size: r, color: rgb(1, 1, 1), borderColor: ink, borderWidth: 1.3 });
        pg.drawText(t, { x: t0.x, y: t0.y, size, font: bold, color: ink, rotate: v.rotate });
      };
      /* a question's pages; for a whole question, a first page holding only a sliver of it (a stray "BLANK PAGE" line) is left out */
      /* parts picked: a part item is its own part; a question with chosen parts uses those; otherwise the whole question */
      const whole = it => it.part ? data.items.find(x => x.src === it.src && x.q === it.q && !x.part) : it;
      const pick = it => { const w = whole(it); if (!w || !(w.parts || []).length) return null;
        const sel = it.part ? [it.part] : qbWs.parts[it.id]; return sel && w.parts.some(p => sel.includes(p.l)) ? { w, sel } : null; };
      const ref = it => { const pk = pick(it);
        return `${it.series} ${it.paper.replace(/^Paper\s*/, "P")} Q${it.q}${pk ? pk.sel.map(l => `(${l})`).join("") : it.part ? `(${it.part})` : ""}`; };
      const qPages = it => {
        const h = {}; it.segs.forEach(([p, y0, y1]) => h[p] = (h[p] || 0) + (y1 - y0));
        const ps = Object.keys(h).map(Number).sort((a, b) => a - b);
        return !it.part && ps.length > 1 && h[ps[0]] < 25 ? ps.slice(1) : ps;
      };
      /* areas of a page to blank out: parts not picked, from where each starts to where the next one starts
         (the last one up to the question's total line). Only pages holding the opening lines or a picked part are kept. */
      const hidden = [];
      const partPages = ({ w, sel }) => {
        const keep = new Set([...(w.stem || []), ...w.parts.filter(p => sel.includes(p.l)).flatMap(p => p.s)].map(x => x[0]));
        const m = data.pdfs[w.src], last = w.segs[w.segs.length - 1];
        const qEnd = last[2] - last[1] < 24 ? [last[0], last[1] - 2] : [last[0], last[2] + 2];
        const top = pn => Math.min(...w.segs.filter(x => x[0] === pn).map(x => x[1]), m.H - 50) - 3;
        w.parts.forEach((p, k) => {
          if (sel.includes(p.l)) return;
          const a = [p.s[0][0], p.s[0][1] - 3], nx = w.parts[k + 1], b = nx ? [nx.s[0][0], nx.s[0][1] - 3] : qEnd;
          for (let pn = a[0]; pn <= b[0]; pn++) {
            if (!keep.has(pn)) continue;
            const y0 = pn === a[0] ? a[1] : top(pn), y1 = pn === b[0] ? b[1] : m.H - 45;
            if (y1 > y0) hidden.push({ src: w.src, pn, y0, y1, m });
          }
        });
        return [...keep].sort((x, y) => x - y);
      };
      /* cover page: title, name/date lines, marks, suggested time, the questions */
      const clean = t => String(t).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "-");
      const qMarks = it => { const pk = pick(it); return pk ? pk.w.parts.filter(p => pk.sel.includes(p.l)).reduce((a, p) => a + (p.m || 0), 0) : it.marks || 0; };
      if (opts.cover) {
        const pg = out.addPage([595.28, 841.89]), total = items.reduce((a, it) => a + qMarks(it), 0);
        /* exam pace: about 1.2 minutes a mark for written questions, a multiple-choice question about 1.9 */
        const mins = Math.round(items.reduce((a, it) => a + (it.mcq ? 1.875 : 1.2 * qMarks(it)), 0) / 5) * 5;
        pg.drawText(clean(opts.title || "Worksheet"), { x: 56, y: 760, size: 24, font: bold, color: ink, maxWidth: 480 });
        pg.drawText(clean(data.label || ""), { x: 56, y: 736, size: 11, font, color: rgb(0.4, 0.42, 0.42) });
        const line = (label, x, y, w) => { pg.drawText(label, { x, y, size: 11, font, color: ink }); const lx = x + font.widthOfTextAtSize(label, 11) + 6; pg.drawLine({ start: { x: lx, y: y - 2 }, end: { x: x + w, y: y - 2 }, thickness: 0.7, color: rgb(0.55, 0.57, 0.57) }); };
        line("Name", 56, 690, 300); line("Date", 376, 690, 163);
        const box = (label, val, x) => {
          pg.drawRectangle({ x, y: 600, width: 150, height: 58, borderColor: rgb(0.8, 0.82, 0.82), borderWidth: 1 });
          pg.drawText(label, { x: x + 12, y: 640, size: 9, font, color: rgb(0.4, 0.42, 0.42) });
          pg.drawText(val, { x: x + 12, y: 612, size: 18, font: bold, color: ink });
        };
        box("Total marks", String(total), 56); box("Suggested time", `${mins} min`, 222); box("Your mark", `       / ${total}`, 388);
        pg.drawText("Questions", { x: 56, y: 560, size: 13, font: bold, color: ink });
        let y = 536;
        items.forEach((it, k) => {
          if (y < 70) return;
          pg.drawText(clean(`${k + 1}.  ${ref(it)}`), { x: 56, y, size: 11, font, color: ink });
          const m = qMarks(it), t = `${m} mark${m === 1 ? "" : "s"}`;
          pg.drawText(t, { x: 539 - font.widthOfTextAtSize(t, 11), y, size: 11, font, color: rgb(0.4, 0.42, 0.42) });
          y -= 19;
        });
        if (y < 70) pg.drawText(`… and ${items.length - Math.floor((536 - 70) / 19) - 1} more`, { x: 56, y: 56, size: 10, font, color: rgb(0.4, 0.42, 0.42) });
      }
      for (const [k, it] of items.entries()) {
        const pk = pick(it), ps = pk ? partPages(pk) : qPages(it);
        await add(it.src, ps);
        const qp = placed[it.src + "|" + ps[0]];
        /* "Question 1: June 2024 P2 Q8" goes in the page's top margin (drawn once all questions are in) */
        if (qp) (qp.gshLabels ||= []).push(`Question ${k + 1}: ${ref(it)}`);
      }
      for (const h of hidden) {
        const pg = placed[h.src + "|" + h.pn]; if (!pg) continue;
        const mb = pg.getMediaBox(), x0 = h.m.x0 || h.m.W * 0.092, x1 = h.m.x1 || h.m.W * 0.905;
        /* past the marks column too, where answer lines end in dots, but short of the page's border */
        const right = Math.max(Math.min(x1 + 36, h.m.W - 66), x1 + 4);
        pg.drawRectangle({ x: mb.x + x0 - 10, y: mb.y + mb.height - h.y1, width: right - x0 + 10, height: h.y1 - h.y0, color: rgb(1, 1, 1) });
      }
      for (const pg of Object.values(placed)) {
        if (!pg.gshLabels) continue;
        const v = view(pg), size = 9;
        let u = 46;
        for (const label of pg.gshLabels) {
          const o = v.at(u, v.H - 30);
          pg.drawText(label, { x: o.x, y: o.y, size, font: bold, color: ink, rotate: v.rotate });
          u += bold.widthOfTextAtSize(label, size) + 20;
        }
      }
      const withMs = opts.ms ? items.filter(it => it.ms && it.msPage) : [];
      if (withMs.length) {
        /* divider page listing the questions in order */
        const pg = out.addPage([595.28, 841.89]);
        pg.drawText("Mark schemes", { x: 56, y: 760, size: 24, font: bold, color: rgb(0.1, 0.1, 0.1) });
        let y = 724;
        items.forEach((it, k) => {
          if (y < 60) return;
          pg.drawText(`Question ${k + 1}: ${ref(it)}`, { x: 56, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) }); y -= 20;
        });
        for (const [k, it] of items.entries()) {
          if (!it.ms || !it.msPage) continue;
          await add(it.ms, it.part ? [it.msPage] : qbMsPages(it, data) || [it.msPage]);
          const mp = placed[it.ms + "|" + it.msPage];
          if (mp) stamp(mp, k + 1, (it.msY || 0) * view(mp).H + 18);
        }
      }
      /* footer on every page, bottom right, on a white strip so it reads over anything printed there */
      if (opts.footer) {
        const t = clean(opts.footer), size = 8.5;
        for (const pg of out.getPages()) {
          const v = view(pg), w = font.widthOfTextAtSize(t, size), u = v.W - 24 - w, r0 = v.at(u - 4, 7), t0 = v.at(u, 10);
          pg.drawRectangle({ x: r0.x, y: r0.y, width: w + 8, height: size + 6, color: rgb(1, 1, 1), rotate: v.rotate });
          pg.drawText(t, { x: t0.x, y: t0.y, size, font, color: rgb(0.35, 0.37, 0.37), rotate: v.rotate });
        }
      }
      const blob = new Blob([await out.save()], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(opts.title || `${data.label || data.spec} worksheet`).replace(/[^\w\s.-]+/g, " ").replace(/\s+/g, " ").trim()} (${items.length} question${items.length === 1 ? "" : "s"}).pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      btn.textContent = "Build PDF";
    } catch (e) {
      console.error(e); btn.textContent = "Couldn't build, try again";
    }
    btn.disabled = false;
  }

  /* The mark scheme pages for a question: from where it starts to where the next question starts
     (the page before, if the next question begins at the top of its page). The last question runs to the end. */
  function qbMsPages(it, data) {
    if (!it.ms || !it.msPage) return null;
    const next = data.items.filter(x => x.src === it.src && !x.part && x.q > it.q && x.msPage).sort((a, b) => a.q - b.q)[0];
    const start = it.msPage, end = next ? Math.max(start, next.msY < 0.15 ? next.msPage - 1 : next.msPage) : start + 60;
    return Array.from({ length: end - start + 1 }, (_, k) => start + k);
  }
  /* Pure and Paper 3 reuse the same numbers (8.4 is integration in Pure, forces in Mechanics) */
  const GROUP_OF = (i, data) => (data.topics.find(t => t.id === i.topic) || {}).group || "pure";
  function qbCard(i, data) {
    /* spec points the question covers, e.g. "8.5 Integration by substitution and by parts" */
    const spec = (i.spec || []).map(c => `<span class="qb-spec"><b>${c}</b> ${esc(((data.points || {})[GROUP_OF(i, data)] || {})[c] || "")}</span>`).join("");
    return `<article class="qb-card ${qbProg.map[i.id] ? "st-" + qbProg.map[i.id] : ""}" data-qb-card="${i.id}">
      <header class="qb-card-head">
        <div class="qb-title"><b>${esc(i.series)} · ${esc(i.paper)} · Q${i.q}${i.part ? ` <span class="qb-part">part (${i.part})</span>` : ""}</b>
          ${spec ? `<div class="qb-specs">${spec}</div>` : ""}
          ${i.part ? `<small>Shown with the question's opening lines</small>` : ""}</div>
        <span class="qb-headr"><span class="qb-stbadge" data-qb-badge>${qbBadge(i.id)}</span>${i.marks ? `<span class="qb-marks">${i.marks} mark${i.marks === 1 ? "" : "s"}</span>` : ""}</span>
      </header>
      <div class="qb-snip" data-qb-snip="${i.id}" style="--ar:${qbAspect(i, data)}"></div>
      ${i.mcq ? qbMcq(i) : ""}
      ${i.mcq ? "" : `<div class="qb-markrow"><span>How did it go?</span>${[["got", "✓ Got it"], ["part", "◐ Partly"], ["miss", "✗ Missed it"]].map(([v, l]) => `<button type="button" class="qb-stbtn st-${v} ${qbProg.map[i.id] === v ? "on" : ""}" data-qb-st="${v}" aria-pressed="${qbProg.map[i.id] === v}">${l}</button>`).join("")}</div>`}
      <footer class="qb-card-foot">
        ${i.ms ? `<button class="qb-btn ms" data-qb-open="ms" data-qb-id="${i.id}">Mark scheme</button>` : ""}
        <button class="qb-btn" data-qb-open="paper" data-qb-id="${i.id}">Open question</button>
        ${qbPartsHtml(i)}${qbWsButton(i.id)}
      </footer>
    </article>`;
  }
  /* ----- Progress: each question marked Got it / Partly / Missed it (multiple choice: from Check), kept per bank
     in this browser. Shown on cards, topics, spec points and the subject page. ----- */
  let qbProg = { key: "", map: {} };
  const QB_ST = { got: "Got it", part: "Partly", miss: "Missed it" };
  const qbBadge = id => qbProg.map[id] ? `<span class="b-${qbProg.map[id]}">${QB_ST[qbProg.map[id]]}</span>` : "";
  const qbCounts = items => { const c = { got: 0, part: 0, miss: 0, n: items.length }; items.forEach(i => { const v = qbProg.map[i.id]; if (v) c[v]++; }); c.tried = c.got + c.part + c.miss; return c; };
  /* a thin bar: green got it, amber partly, red missed */
  function qbBar(items) {
    const c = qbCounts(items); if (!c.tried || !c.n) return "";
    return ["got", "part", "miss"].map(v => c[v] ? `<b class="b-${v}" style="width:${(c[v] / c.n) * 100}%"></b>` : "").join("");
  }
  function qbHeadProg(items) {
    const c = qbCounts(items); if (!c.tried) return "";
    return `<span class="qb-bar">${qbBar(items)}</span><span><b>${c.tried}</b> of ${c.n} tried · ${c.got} got it${c.part ? ` · ${c.part} partly` : ""}${c.miss ? ` · ${c.miss} missed` : ""}</span>`;
  }
  function qbSpecProg(items, code) {
    const its = items.filter(i => (i.spec || []).includes(code)), c = qbCounts(its);
    if (!c.tried) return `${its.length}`;
    const dot = c.miss ? "miss" : c.part ? "part" : "got";
    return `<i class="qb-dot b-${dot}" title="${c.tried} tried, ${c.got} got it"></i>${c.tried}/${its.length}`;
  }
  /* per course topic (the subject page's list): [tried, total, got], kept for the subject page */
  function qbSummary(data, key) {
    const c = course(...key.split("/")); if (!c) return;
    const sum = {};
    c.topics.forEach((_, i) => {
      /* a course topic that is a whole unit (IAL "Pure Mathematics 3") counts every topic in it */
      const t = qbTopicFor(data, key, i + 1, true); if (!t) return;
      const ids = t.group ? new Set(data.topics.filter(x => x.group === t.group).map(x => x.id)) : new Set([t]);
      const k = qbCounts(data.items.filter(it => ids.has(it.topic))); sum[i + 1] = [k.tried, k.n, k.got];
    });
    store.set("qbsum:" + key, sum);
  }
  function qbSetProg(id, v, box, data, key) {
    if (v) qbProg.map[id] = v; else delete qbProg.map[id];
    store.set(qbProg.key, qbProg.map);
    const card = box.querySelector(`[data-qb-card="${CSS.escape(id)}"]`);
    if (card) {
      card.classList.remove("st-got", "st-part", "st-miss"); if (v) card.classList.add("st-" + v);
      card.querySelector("[data-qb-badge]").innerHTML = qbBadge(id);
      card.querySelectorAll("[data-qb-st]").forEach(b => { const on = b.dataset.qbSt === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    }
    /* refresh the bars and counts in place (re-drawing the page would redraw every question) */
    const st = qbState, inTopic = data.items.filter(i => i.topic === st.topic && (st.year === "all" || i.year === +st.year) && (!data.papers || !st.paper || st.paper === "all" || i.ptype === st.paper));
    box.querySelectorAll("[data-qb-tprog]").forEach(el => {
      const tid = el.dataset.qbTprog;
      el.innerHTML = qbBar(data.items.filter(i => i.topic === tid && (st.year === "all" || i.year === +st.year) && (!data.papers || !st.paper || st.paper === "all" || i.ptype === st.paper)));
    });
    box.querySelectorAll("[data-qb-sprog]").forEach(el => el.innerHTML = qbSpecProg(inTopic, el.dataset.qbSprog));
    const h = box.querySelector("[data-qb-hprog]"); if (h) h.innerHTML = qbHeadProg(inTopic);
    qbSummary(data, key);
  }
  /* answer buttons for a multiple-choice question (no answer key for the paper: no Check) */
  function qbMcq(i) {
    return `<div class="qb-mcq" data-qb-mcq="${i.id}" role="group" aria-label="Your answer to Q${i.q}">
      ${["A", "B", "C", "D"].map(l => `<button type="button" class="qb-opt" data-qb-opt="${l}" aria-pressed="false">${l}</button>`).join("")}
      ${i.ans ? `<button type="button" class="qb-btn primary qb-check" data-qb-check disabled>Check</button>` : `<small class="qb-mcq-none">No answer key for this paper yet</small>`}
      <span class="qb-mcq-res" aria-live="polite"></span>
    </div>`;
  }
  function qbAspect(i, data) {
    const m = data.pdfs[i.src]; const w = (m.x1 || m.W * 0.905) - (m.x0 || m.W * 0.092);
    const h = i.segs.reduce((a, s) => a + (s[2] - s[1]), 0) + 4 * Math.max(0, i.segs.length - 1);
    return (w / Math.max(h, 1)).toFixed(4);
  }
  let qbObs = null, qbBox = null, qbData = null;
  function qbObserve(box, data) {
    qbObs?.disconnect(); qbDropQueue();
    qbBox = box; qbData = data;
    /* draw snips as they come near the screen and free the ones far away, so long topics stay light on memory */
    qbObs = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? qbRender(e.target, data) : qbRelease(e.target)), { rootMargin: "1200px 0px" });
    box.querySelectorAll("[data-qb-snip]").forEach(el => qbObs.observe(el));
  }
  function qbRelease(el) {
    if (!el._qb) return;
    el._qb = 0;
    try { el._task?.cancel(); } catch (e) {}
    el._task = null;
    el.querySelectorAll("canvas").forEach(c => { c.width = 0; c.height = 0; });
    if (el.dataset.ar) el.style.setProperty("--ar", el.dataset.ar);
    el.replaceChildren(); el.classList.remove("ready");
  }
  /* Snips are drawn two at a time from a queue. A fast scroll passes many questions: the ones already scrolled
     past are dropped from the queue instead of all being drawn at once (which ran phones out of memory). */
  const qbQueue = [], QB_PARALLEL = 2;
  let qbRunning = 0;
  function qbRender(el, data) {
    if (el._qb) return;
    const token = el._qb = Math.random();
    qbQueue.push([el, data, token]); qbPump();
  }
  /* queued snips that won't be drawn after all are unmarked, so they get drawn when they're next in view */
  function qbDropQueue() {
    for (const [el, , token] of qbQueue) if (el._qb === token) el._qb = 0;
    qbQueue.length = 0;
  }
  /* distance of a snip from the middle of the screen: the question being looked at is drawn first */
  const qbDist = el => { const r = el.getBoundingClientRect(); return r.bottom < 0 ? -r.bottom : r.top > innerHeight ? r.top - innerHeight : 0; };
  function qbPump() {
    while (qbRunning < QB_PARALLEL && qbQueue.length && !window.Viewer?.isOpen()) {
      let k = 0, best = Infinity;
      qbQueue.forEach(([el], i) => { const d = qbDist(el); if (d < best) { best = d; k = i; } });
      const [el, data, token] = qbQueue.splice(k, 1)[0];
      if (el._qb !== token || !el.isConnected) continue;
      qbRunning++;
      qbDraw(el, data, token).finally(() => { qbRunning--; qbPump(); });
    }
  }
  async function qbDraw(el, data, token) {
    const it = data.items.find(x => x.id === el.dataset.qbSnip); if (!it || !window.Viewer?.withDoc) return;
    const m = data.pdfs[it.src], x0 = m.x0 || m.W * 0.092, x1 = m.x1 || m.W * 0.905, cx = m.cx || 0, cy = m.cy || 0;
    const frag = document.createDocumentFragment();
    const drop = () => frag.querySelectorAll("canvas").forEach(c => { c.width = 0; c.height = 0; });
    try {
      const cssW = el.clientWidth || 700, dpr = Math.min(window.devicePixelRatio || 1, 2), scale = cssW / (x1 - x0);
      const done = await window.Viewer.withDoc(it.src, async doc => {
        for (const [pn, y0, y1] of it.segs) {
          if (el._qb !== token) return false;
          const page = await doc.getPage(pn);
          const cv = document.createElement("canvas");
          const vp = page.getViewport({ scale: scale * dpr, offsetX: -(x0 - cx) * scale * dpr, offsetY: -(y0 - cy) * scale * dpr });
          cv.width = Math.round((x1 - x0) * scale * dpr); cv.height = Math.round((y1 - y0) * scale * dpr);
          cv.style.width = "100%"; cv.style.height = "auto";   /* follows the column as it widens or narrows */
          frag.appendChild(cv);
          el._task = page.render({ canvasContext: cv.getContext("2d"), viewport: vp });
          try { await el._task.promise; } finally { el._task = null; }
        }
        return el._qb === token;
      });
      if (!done || el._qb !== token) { drop(); return; }
      el.dataset.ar = el.style.getPropertyValue("--ar") || el.dataset.ar || "";
      el.replaceChildren(frag); el.classList.add("ready"); el.style.removeProperty("--ar");
    } catch (e) {
      drop();
      if (el._qb !== token) return;
      el.innerHTML = `<p class="qb-err">This question couldn't load. <button class="qb-btn" data-qb-open="paper" data-qb-id="${it.id}">Open question</button></p>`;
    }
  }
  /* While a paper is open the question bank stops drawing (questions already drawn stay, so closing is instant)
     and picks up again when the paper closes. */
  window.addEventListener("gsh-viewer-open", () => {
    qbDropQueue();
    document.querySelectorAll("[data-qb-snip]").forEach(el => { if (el._task) qbRelease(el); });
  });
  window.addEventListener("gsh-viewer-close", () => {
    if (qbBox?.isConnected && qbData) qbObserve(qbBox, qbData);
  });

  function byLevel(fn) {
    return S.levels.map(L => `<h2>${esc(L.name)}</h2><div class="list">` +
      L.groups.flatMap(g => g.tracks).flatMap(t => Object.entries(L.tracks[t].subjects).map(([s, c]) => fn(L, t, s, c))).join("") + `</div>`).join("");
  }
  function vTool(kind) {
    if (kind === "past-papers") {
      crumbs([{ t: "Past papers" }]); setTitle("Past papers");
      return `<div class="home"><h1>Past papers</h1><p class="lede">Question papers and mark schemes for every series, opened right here to annotate.</p>${levelCards(url.ppLevel)}</div>`;
    }
    if (kind === "question-banks") {
      crumbs([{ t: "Question bank" }]); setTitle("Question bank");
      const mine = qbMine(), picking = qbPicking, rest = qbKeys().filter(k => !mine.includes(k));
      if (picking) return `<div class="home"><h1>Question bank</h1>
        <p class="lede">Tap the specs you use. They'll be at the top here and on the home page.</p>
        ${qbPicker()}
        <div class="qbk-actions"><button type="button" class="qb-btn primary" data-qb-done>${mine.length ? `Done · ${mine.length} spec${mine.length === 1 ? "" : "s"}` : "Done"}</button></div></div>`;
      if (!mine.length) return `<div class="home"><h1>Question bank</h1>
        <p class="lede">Every past paper question, sorted by spec topic and checked against its mark scheme.</p>
        <div class="qbk-head"><h2>All question banks</h2><button type="button" class="qb-btn" data-qb-edit>Choose your specs</button></div>
        ${qbankCards(qbKeys())}</div>`;
      return `<div class="home"><h1>Question bank</h1>
        <p class="lede">Every past paper question, sorted by spec topic and checked against its mark scheme.</p>
        <div class="qbk-head"><h2>Your specs</h2><button type="button" class="qb-btn" data-qb-edit>Change specs</button></div>
        ${qbankCards(mine)}
        ${rest.length ? `<details class="qbk-more"><summary>Other question banks (${rest.length})</summary>${qbankCards(rest)}</details>` : ""}</div>`;
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
    if (r.kind !== "qbank") { $("#qb-ws-bar")?.remove(); document.body.classList.remove("ws-on"); }
    const page = $("#page");
    page.classList.toggle("wide", r.kind === "qbank");   /* the question bank uses the full width of the window */
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
    const qm = e.target.closest("[data-qb-mine]");
    if (qm) {
      const k = qm.dataset.qbMine, mine = qbMine();
      store.set("qb-mine", mine.includes(k) ? mine.filter(x => x !== k) : qbKeys().filter(x => x === k || mine.includes(x)));
      const keep = window.scrollY; qbPicking = true; render(); window.scrollTo(0, keep); return;
    }
    if (e.target.closest("[data-qb-edit]")) { qbPicking = true; render(); return; }
    if (e.target.closest("[data-qb-done]")) { qbPicking = false; render(); window.scrollTo(0, 0); return; }
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
