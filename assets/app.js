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
  const ACCT = ["sign-in", "my-work", "teacher", "privacy"];   /* pages drawn by account.js */
  function parse(path) {
    const p = path.replace(/\/+$/, "").replace(/\.html$/, "").split("/").filter(Boolean);
    if (!p.length) return { kind: "home" };
    if (p[0] === "viewer") return { kind: "viewer" };
    if (p.length === 1 && ["past-papers", "question-banks", "formula-sheets", "exam-dates"].includes(p[0])) return { kind: p[0] };
    if (p.length === 1 && ACCT.includes(p[0])) return { kind: p[0] };
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
  /* Updates: pages carry the version they were built with (gsh-version). When the site has been updated since this
     page loaded, the next page opened loads afresh instead of running old code (writing still waiting to save is
     saved first). Checked at most every two minutes, on moving between pages and on coming back to the tab. */
  const VERSION = document.querySelector('meta[name="gsh-version"]')?.content || "";
  let stale = false, lastCheck = Date.now();
  const checkVersion = force => {
    if (!VERSION || stale || (!force && Date.now() - lastCheck < 120000)) return;
    lastCheck = Date.now();
    fetch("/version.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.v && j.v !== VERSION) stale = true; }).catch(() => {});
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkVersion(true); });
  async function goFresh(href) { try { await window.CardInk?.flush?.(); } catch (e) {} location.assign(href); }
  function go(href) {
    checkVersion();
    if (stale) { goFresh(href); return; }
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
      <button class="nav" data-act="search">${icon.search}Search</button>`;
    const mine = mySubjects();
    if (mine.length) h += `<div class="side-label">My specs</div>` + mine.map(k => {
      const [l, t, s] = k.split("/"), on = r.l === l && r.t === t && r.s === s;
      return `<a class="nav ${on ? "on" : ""}" href="${url.subject(l, t, s)}"><span class="side-dot s-${subj(s).color}-v"></span>${esc(subj(s).name)} <span class="side-code">${esc(course(l, t, s).code)}</span></a>`;
    }).join("");
    h += `<div class="side-label">All subjects</div>`;
    for (const L of liveLevels()) {
      const open = openGroups[L.id] ?? (r.l === L.id && !r.quiet);
      h += `<div class="group ${open ? "open" : ""}"><button class="nav ${r.l === L.id && !r.t && !r.quiet ? "on" : ""}" data-act="group" data-id="${L.id}">${icon.chev}${esc(L.short || L.name)}</button><div class="group-kids">`;
      for (const t of liveTracks(L)) h += `<a class="nav ${r.l === L.id && r.t === t ? "on" : ""}" href="${url.track(L.id, t)}">${esc(L.tracks[t].name)}</a>`;
      h += `</div></div>`;
    }
    const tools = [Object.keys(S.formulaSheets || {}).length && `<a class="nav ${path === "/formula-sheets" ? "on" : ""}" href="/formula-sheets">${icon.sigma}Formula sheets</a>`,
      (S.examDates || []).length && `<a class="nav ${path === "/exam-dates" ? "on" : ""}" href="/exam-dates">${icon.clock}Exam dates</a>`].filter(Boolean);
    if (tools.length) h += `<div class="side-label">Exam prep</div>` + tools.join("");
    const bms = window.Viewer ? window.Viewer.Bookmarks.all() : [];
    if (bms.length) h += `<div class="side-label">PDF bookmarks</div>`;
    h += bms.length
      ? bms.slice(0, 12).map(b => `<div class="bm"><button class="nav" data-bm='${esc(JSON.stringify({ src: b.src, page: b.page }))}' title="${esc(b.title)} · page ${b.page}">${bmIcon}<span class="bm-t">${esc(b.title)}</span><span class="bm-p">p.${b.page}</span></button><button class="bm-x" data-bm-x='${esc(JSON.stringify({ src: b.src, page: b.page }))}' aria-label="Remove bookmark">×</button></div>`).join("")
      : "";
    h += `<div class="side-foot"><a href="/privacy">Privacy</a></div>`;
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
  /* only what has something in it is shown: a subject with papers, a question bank or files; the boards and levels
     holding one. The rest stay in data.js and appear by themselves once they get content. */
  const hasBank = (l, t, s) => !!(S.qbanks || {})[K(l, t, s)];
  const isLive = (l, t, s) => !!course(l, t, s) && (hasBank(l, t, s) || paperCount(l, t, s) > 0 || (S.formulaSheets || {})[K(l, t, s)] || course(l, t, s).topics.some((_, i) => liveCount(l, t, s, i + 1)));
  const liveSubjects = (l, t) => Object.keys(track(l, t).subjects).filter(s => isLive(l, t, s));
  const liveTracks = L => L.groups.flatMap(g => g.tracks).filter(t => liveSubjects(L.id, t).length);
  const liveLevels = () => S.levels.filter(L => liveTracks(L).length);
  /* subjects this person uses: the ones they chose, then the ones they've opened lately */
  const chosenSpecs = () => store.get("qb-mine", []).filter(k => isLive(...k.split("/")));
  const mySubjects = () => (chosenSpecs().length ? chosenSpecs() : store.get("subj-recent", []).filter(k => isLive(...k.split("/")))).slice(0, 8);
  let homePicking = false;
  const noteSubject = k => store.set("subj-recent", [k, ...store.get("subj-recent", []).filter(x => x !== k)].slice(0, 6));
  const subjCard = k => {
    const [l, t, s] = k.split("/"), c = course(l, t, s);
    return `<a class="sc s-${subj(s).color}-q" href="${url.subject(l, t, s)}"><span class="sc-name">${esc(subj(s).name)} <span class="sc-code">${esc(c.code)}</span></span><span class="sc-sub">${esc(track(l, t).full)}</span>${icon.arrow}</a>`;
  };
  /* a subject as a small pill: its colour, name and code (with the board when it stands alone) */
  const subjChip = (k, board) => {
    const [l, t, s] = k.split("/");
    return `<a class="chip-s s-${subj(s).color}-q" href="${url.subject(l, t, s)}"><i></i>${esc(subj(s).name)} <b>${esc(course(l, t, s).code)}</b>${board ? `<small>${esc(track(l, t).name)}</small>` : ""}</a>`;
  };
  /* the strip of tabs on every subject page */
  function subjHead(l, t, s, tab) {
    const c = course(l, t, s), T = track(l, t), k = K(l, t, s); noteSubject(k);
    const tabs = [["topics", "Topics", url.subject(l, t, s)], hasBank(l, t, s) && ["questions", "Questions", url.qbank(l, t, s)],
      paperCount(l, t, s) && ["papers", "Past papers", url.papers(l, t, s)], hasBank(l, t, s) && ["quiz", "Quiz", url.qbank(l, t, s) + "?mix=1"]].filter(Boolean);
    return `<h1>${esc(subj(s).name)} <span class="h-code s-${subj(s).color}-t">(${c.code})</span></h1>
      <div class="facts"><span>${esc(T.full)}</span>${tab === "questions" || tab === "quiz" ? `<span data-qb-count>Loading questions…</span>` : `<span><b>${c.topics.length}</b> topics</span>`}</div>
      ${tabs.length > 1 ? `<nav class="stabs" aria-label="${esc(subj(s).name)}">${tabs.map(([id, label, href]) => `<a class="stab ${id === tab ? "on" : ""}" data-stab="${id}" href="${href}" ${id === tab ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav>` : ""}`;
  }

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
    const last = store.get("qb-last", null), lastOk = last && hasBank(...last.k.split("/"));
    const cont = lastOk ? (() => { const [l, t, s] = last.k.split("/"), c = course(l, t, s);
      return `<a class="home-cont s-${subj(s).color}-q" href="${url.qbank(l, t, s)}"><small>Continue where you left off</small><b>${esc(subj(s).name)} ${esc(c.code)}${last.name ? ` · ${last.num ? last.num + " " : ""}${esc(last.name)}` : ""}</b>${icon.arrow}</a>`; })() : "";
    const mine = mySubjects(), chosen = chosenSpecs();
    /* signed in: a line about their own work (filled in by account.js) */
    const acct = window.GSHAccount?.user();
    if (acct) setTimeout(() => window.GSHAccount.homeCard($("#home-acct")), 0);
    return `<div class="home">
      ${acct ? `<div class="home-acct" id="home-acct" aria-live="polite"></div>` : ""}
      <h1>What are you revising?</h1>
      <p class="lede">Every past paper question, sorted by topic and checked against the mark scheme.</p>
      <p class="home-free"><span>Free</span><span>No ads</span><span>No sign-up needed</span></p>
      ${cont}
      <section class="home-sec">
        <div class="sec-head"><h2>Your specs</h2><button type="button" class="qb-btn ${homePicking ? "primary" : ""}" data-home-edit>${homePicking ? "Done" : chosen.length ? "Change" : "Choose your specs"}</button></div>
        ${homePicking ? `<p class="sec-note">Tick the specs you study. They stay here and in the sidebar on this device.</p>`
          : mine.length ? `<div class="sc-grid">${mine.map(subjCard).join("")}</div>${chosen.length ? "" : `<p class="sec-note">Recently opened. Choose your specs to keep the right ones here.</p>`}`
          : `<p class="sec-note">Choose the specs you study to keep them one tap away.</p>`}
      </section>
      <section class="home-sec"><h2>All subjects</h2>
        <div class="spec-cols ${homePicking ? "picking" : ""}">${liveLevels().flatMap(L => liveTracks(L).map(t =>
          `<div class="spec-col"><h3>${esc(L.tracks[t].full)}</h3>${liveSubjects(L.id, t).map(s => {
            const k = K(L.id, t, s), code = `<small class="s-${subj(s).color}-t">${esc(course(L.id, t, s).code)}</small>`;
            return homePicking ? `<button type="button" class="spec-opt ${chosen.includes(k) ? "on" : ""}" data-home-pick="${k}" aria-pressed="${chosen.includes(k)}"><span><i></i>${esc(subj(s).name)}</span>${code}</button>`
              : `<a href="${url.subject(L.id, t, s)}"><span>${esc(subj(s).name)}</span>${code}</a>`;
          }).join("")}</div>`)).join("")}</div></section>
      <section class="home-tutor" aria-labelledby="tutor-h">
        <div><h2 id="tutor-h">Want one-to-one help?</h2>
          <p>Online tutoring in all subjects for GCSE, IGCSE, A Level and IB, and preparation for university admissions tests. Message us on WhatsApp to book your demo.</p></div>
        <a class="tutor-btn" href="https://wa.me/923323332003?text=${encodeURIComponent("Hi, I found Ghelli Study Hub and I'd like to book a demo lesson.")}" target="_blank" rel="noopener">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 3.2a6.8 6.8 0 0 0-5.9 10.2L3.3 16.8l3.5-.8A6.8 6.8 0 1 0 10 3.2Z" stroke-linejoin="round"/><path d="M7.6 7.4c.2 1.9 2.4 4.4 4.9 5l.8-1.3-1.4-.8-.6.6c-.9-.4-1.8-1.3-2.2-2.2l.6-.6-.8-1.4-1.3.7Z" fill="currentColor" stroke="none"/></svg>
          Contact us on WhatsApp</a>
      </section>
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
    const lt = liveTracks(L);
    if (!t) h += L.groups.filter(g => g.tracks.some(id => lt.includes(id))).map(g => `<h2>${esc(g.name)}</h2><div class="boards">` + g.tracks.filter(id => lt.includes(id)).map(id => {
      const T = L.tracks[id], n = liveSubjects(l, id).length;
      return `<a class="board lv-${l} ${id === t ? "on" : ""}" href="${trackHref(id)}"><b>${esc(T.name)}</b><small>${n} subject${n > 1 ? "s" : ""}</small></a>`;
    }).join("") + `</div>`).join("");
    if (t) {
      const T = track(l, t);
      h += `<div class="list" style="margin-top:28px">` + Object.entries(T.subjects).filter(([s]) => isLive(l, t, s)).map(([s, c]) => {
        if (!pp) return `<a class="row" href="${url.subject(l, t, s)}"><span class="grow">${esc(subj(s).name)} <span class="code s-${subj(s).color}-t">(${c.code})</span></span><span class="aside">${c.topics.length} topics</span></a>`;
        const n = paperCount(l, t, s);
        return `<a class="row" href="${url.papers(l, t, s)}"><span class="grow">${esc(subj(s).name)} <span class="code s-${subj(s).color}-t">(${c.code})</span></span><span class="aside">${n ? `${n} files` : "Coming soon"}</span></a>`;
      }).join("") + `</div>`;
    }
    return h;
  }

  /* the subject's progress: questions tried in its question bank */
  function qbSubjProg(l, t, s) {
    const sum = Object.values(store.get("qbsum:" + K(l, t, s), {}) || {});
    const tried = sum.reduce((a, x) => a + x[0], 0), total = sum.reduce((a, x) => a + x[1], 0), got = sum.reduce((a, x) => a + x[2], 0);
    return tried ? `<div class="progress s-${subj(s).color}-v"><div class="bar"><i style="width:${(tried / total) * 100}%"></i></div><span><b>${tried}</b> of ${total} questions tried · ${got} got it</span></div>` : "";
  }

  function vSubject({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t), name = `${T.full} ${subj(s).name}`, bank = hasBank(l, t, s);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name }]); setTitle(name);
    const sum = store.get("qbsum:" + K(l, t, s), {}) || {};
    return subjHead(l, t, s, "topics") + qbSubjProg(l, t, s) +
      `<div class="list topic-list">` +
      c.topics.map((tp, i) => {
        const n = i + 1, live = liveCount(l, t, s, n);
        const head = (c.topicGroups || []).find(([from]) => from === n);
        const ts = sum[n];
        const tbar = ts && ts[0] ? `<span class="row-prog" title="${ts[0]} of ${ts[1]} questions tried, ${ts[2]} got it"><i style="width:${(ts[0] / ts[1]) * 100}%"></i></span>` : "";
        /* a topic opens its questions; one with notes or files of its own opens its page */
        const href = bank && !live ? `${url.qbank(l, t, s)}?topic=${n}` : url.topic(l, t, s, n);
        return `${head ? `<div class="list-head">${esc(head[1])}</div>` : ""}<a class="row" href="${href}"><span class="num s-${subj(s).color}-t">${String(n).padStart(2, "0")}</span><span class="grow">${esc(tp)}</span>${live ? `<span class="aside hide-sm">${live} file${live > 1 ? "s" : ""}</span>` : ""}${tbar}${icon.arrow}</a>`;
      }).join("") + `</div>`;
  }

  function vTopic({ l, t, s, n }) {
    const c = course(l, t, s), T = track(l, t), title = c.topics[n - 1], k = K(l, t, s, n);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: title }]); setTitle(title);
    recent = [{ l, t, s, n }, ...recent.filter(x => K(x.l, x.t, x.s, x.n) !== k)].slice(0, 8); store.set("recent2", recent);
    let h = `<div class="eyebrow"><span>${esc(T.full)} ${esc(subj(s).name)} (${c.code}) · Topic ${n} of ${c.topics.length}</span></div>
      <h1>${esc(title)}</h1>
      ${hasBank(l, t, s) ? `<div class="subj-tiles"><a class="subj-tile primary" href="${url.qbank(l, t, s)}?topic=${n}">${icon.bank}<span><b>Questions</b><small>Past paper questions on ${esc(title)}</small></span>${icon.arrow}</a></div>` : ""}`;
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

  let paperChoices = null;
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
    /* teachers: set one of these papers as work */
    paperChoices = window.GSHAccount?.isTeacher() ? seriesRows.flatMap(ser => cols.filter(([id]) => links[`${ser}|${id}|QP`]).map(([id, label]) => ({
      name: `${label} · ${ser}`, src: links[`${ser}|${id}|QP`], ms: links[`${ser}|${id}|MS`] || "", desc: `${T.full} ${subj(s).name} ${c.code}` }))) : null;
    return subjHead(l, t, s, "papers") + `
      <div class="pp-head"><h2>By series</h2>${paperChoices && paperChoices.length ? `<button type="button" class="qb-btn" data-assign-paper>Assign a paper</button>` : ""}</div>
      <div class="pp"><table><thead><tr><th>Series</th>${cols.map(([, label]) => `<th>${esc(label)}</th>`).join("")}${hasER ? "<th>Report</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>
      ${c.paperNote ? `<p class="legend">${esc(c.paperNote)}</p>` : ""}
      <p class="legend">QP question paper · MS mark scheme${hasER ? " · ER examiner report" : ""}. Highlighted codes are available.</p>
      <p class="legend owner">${esc(ownerNote(t))}</p>`;
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
  document.addEventListener("change", e => { if ((e.target.id === "qb-spec-switch" || e.target.id === "home-spec") && e.target.value) go(e.target.value); });
  const qbCache = {};
  const qbState = store.get("qb", { topic: null, ptype: "all", year: "all" });
  function vQbank({ l, t, s }) {
    const c = course(l, t, s), T = track(l, t);
    crumbs([...trackCrumbs(l, t), { t: subj(s).name, href: url.subject(l, t, s) }, { t: "Questions" }]);
    setTitle(`${T.full} ${subj(s).name} question bank`);
    const src = S.qbanks[K(l, t, s)];
    setTimeout(() => qbMount(src, K(l, t, s)), 0);
    return subjHead(l, t, s, new URLSearchParams(location.search).has("mix") ? "quiz" : "questions") + `
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
    qbDifficulty(data);
    const groups = data.groups || [["pure", "Pure"], ["stats", "Statistics"], ["mech", "Mechanics"]];
    const st = qbState;
    qbProg = { key: "qbp:" + src, map: store.get("qbp:" + src, {}) };
    st.show = ["all", "new", "weak", "got"].includes(st.show) ? st.show : "all";
    qbWs = { key: "ws:" + src, bank: key, data, ids: store.get("ws:" + src, []).filter(id => data.items.some(i => i.id === id)), parts: store.get("ws:" + src + ":parts", {}) };
    qbWsBar();
    const want = +new URLSearchParams(location.search).get("topic");
    if (want) {
      const t0 = qbTopicFor(data, key, want);
      if (t0) st.topic = t0;
      history.replaceState(history.state, "", location.pathname);
    }
    if (!st.topic || !data.topics.some(t => t.id === st.topic)) st.topic = data.topics[0].id;
    const askMix = new URLSearchParams(location.search).has("mix");
    const shared = new URLSearchParams(location.search).get("ws"), sharedTitle = new URLSearchParams(location.search).get("t");
    if (shared) { history.replaceState(history.state, "", location.pathname); setTimeout(() => qbSharedOffer(shared, sharedTitle), 300); }
    if (askMix) history.replaceState(history.state, "", location.pathname);
    const workId = new URLSearchParams(location.search).get("a"), reviewSid = new URLSearchParams(location.search).get("s");
    if (workId) history.replaceState(history.state, "", location.pathname);
    /* modular courses (IAL): units are separate papers, so the bank shows one unit's topics at a time */
    const unitOf = id => (data.topics.find(t => t.id === id) || {}).group;
    const shown = () => data.modular ? groups.filter(([g]) => g === unitOf(st.topic)) : groups;
    /* banks covering several papers (Cambridge 9701: Paper 1 multiple choice, Papers 2 and 4) can show one paper at a time */
    const paperOf = () => data.papers && data.papers.some(([p]) => p === st.paper) ? st.paper : "all";
    st.diff = ["all", "1", "2", "3"].includes(String(st.diff)) ? String(st.diff) : "all";
    const filtered = topicId => data.items.filter(i => (!topicId || i.topic === topicId) && (st.year === "all" || i.year === +st.year) && (paperOf() === "all" || i.ptype === paperOf()) && (st.diff === "all" || i.diff === +st.diff));
    const diffSel = id => `<label class="qb-select"><span>Difficulty</span><select id="${id}">${[["all", "Any difficulty"], ["1", "Easier"], ["2", "Medium"], ["3", "Harder"]].map(([v, l]) => `<option value="${v}" ${st.diff === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    const paperSel = id => data.papers ? `<label class="qb-select"><span>Paper</span><select id="${id}">${[["all", "All papers"], ...data.papers].map(([p, name]) => `<option value="${p}" ${paperOf() === p ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>` : "";
    /* ----- Quiz me: the questions shown here, one at a time (missed or partly first, then not tried, Got it last) ----- */
    let qz = null, qzList = [];
    const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
    const quizPool = list => {
      /* a part card whose whole question is also here would repeat it; multiple choice needs an answer key to check */
      const whole = new Set(list.filter(i => !i.part).map(i => i.src + "#" + i.q));
      const ok = list.filter(i => !(i.mcq && !i.ans) && !(i.part && whole.has(i.src + "#" + i.q)));
      const by = f => shuffle(ok.filter(f));
      return [...by(i => ["miss", "part"].includes(qbProg.map[i.id])), ...by(i => !qbProg.map[i.id]), ...by(i => qbProg.map[i.id] === "got")].map(i => i.id);
    };
    /* work set by a teacher: its questions as a quiz, carrying on from the marks saved so far */
    const workGo = async id => {
      box.innerHTML = `<div class="qb-loading">Loading your work…</div>`;
      let w, inks = {};
      const review = !!reviewSid && window.GSHAccount.isTeacher();
      try {
        w = review ? await window.GSHAccount.loadReview(id, reviewSid) : await window.GSHAccount.loadWork(id);
        inks = await window.GSHAccount.loadCardInks(id, review ? reviewSid : null).catch(() => ({}));
      }
      catch (e) { qbToast(e.message); qz = null; render(); return; }
      const ids = w.kind === "qs" ? w.payload.items.map(x => x.id).filter(iid => data.items.some(i => i.id === iid)) : [];
      if (!ids.length) { qbToast("That work has no questions from this bank"); qz = null; render(); return; }
      const res = {}; ids.forEach(iid => { if (w.marks[iid]) res[iid] = w.marks[iid]; });
      const first = ids.findIndex(iid => !res[iid]);
      const parts = Object.fromEntries(w.payload.items.filter(x => x.parts && x.parts.length).map(x => [x.id, x.parts]));
      qz = { ids, k: first < 0 ? ids.length - 1 : first, res, end: first < 0, work: { id: w.id, title: w.title, due: w.due, parts, sent: first < 0, inks } };
      /* a teacher looking over a student's work: their marks and writing, nothing can be changed */
      if (review) { qz.k = 0; qz.end = false; qz.work.sent = true; qz.work.review = w.student; qbProg = { key: "", map: { ...res } }; }
      render(); box.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    /* writing on the cards: kept in this browser, or for set work saved to the account; a review shows the student's */
    const inkContext = () => {
      const w = qz && qz.work;
      if (!window.CardInk) return;
      if (!w) return window.CardInk.setContext(qz && !qz.setup ? { key: "quiz", space: true } : { key: "local" });
      if (w.review) return window.CardInk.setContext({ key: `review:${w.id}:${reviewSid}`, readOnly: true, preset: w.inks });
      window.CardInk.setContext({ key: "work:" + w.id, preset: w.inks, sync: (iid, d) => { w.inks[iid] = d; return window.GSHAccount.saveCardInk(w.id, iid, d); } });
    };
    const quizGo = (ids, mix) => { qz = ids.length ? { ids, k: 0, res: {}, mix } : null; render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); };
    /* ----- Mixed quiz: questions from several topics, taken in turn from each so no one topic fills it ----- */
    const mixKey = "qz-mix:" + src;
    const mixItems = (tid, paper) => data.items.filter(i => i.topic === tid && (!data.papers || paper === "all" || i.ptype === paper));
    const mixPool = m => {
      const per = shuffle([...m.topics]).map(tid => quizPool(mixItems(tid, m.paper)));
      const fresh = per.map(ids => ids.filter(id => qbProg.map[id] !== "got")), got = per.map(ids => ids.filter(id => qbProg.map[id] === "got"));
      const out = [], take = lists => { for (let r = 0; lists.some(l => l.length > r); r++) lists.forEach(l => { if (l[r]) out.push(l[r]); }); };
      take(fresh); take(got);
      return out;
    };
    const mixSetup = () => {
      const saved = store.get(mixKey, null) || {};
      /* units of a modular course are sat separately: start with the unit being looked at */
      const start = data.modular ? data.topics.filter(t => t.group === unitOf(st.topic)).map(t => t.id) : data.topics.map(t => t.id);
      const topics = (saved.topics || start).filter(id => data.topics.some(t => t.id === id));
      qz = { setup: true, m: { topics, paper: data.papers && data.papers.some(([p]) => p === saved.paper) ? saved.paper : "all" } };
      render(); box.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    const setupView = () => {
      const m = qz.m, cnt = tid => quizPool(mixItems(tid, m.paper)).length;
      const total = m.topics.reduce((a, tid) => a + cnt(tid), 0);
      return `<section class="qb-main qz" aria-label="Mixed quiz">
        <div class="qz-done qz-setup">
          <small>${esc(data.label || "")}</small>
          <h2>Mixed quiz</h2><button type="button" class="qb-btn qz-cancel" data-qz-back>Cancel</button>
          <p class="qz-sum">Questions from across the topics you tick, taken in turn from each. Ones you missed or haven't tried come first.</p>
          ${data.papers ? `<label class="qb-select qz-paper"><span>Paper</span><select id="qz-paper">${[["all", "All papers"], ...data.papers].map(([p, name]) => `<option value="${p}" ${m.paper === p ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>` : ""}
          <div class="qz-quick"><span>Topics</span>
            <button type="button" class="qb-btn" data-qz-mall>All</button><button type="button" class="qb-btn" data-qz-mnone>None</button>
            ${groups.length > 1 ? groups.map(([g, name]) => `<button type="button" class="qb-btn" data-qz-mg="${g}">${esc(name.split(" ·")[0])} only</button>`).join("") : ""}
          </div>
          ${groups.map(([g, name]) => `<fieldset class="qz-group"><legend>${esc(name)}</legend><div class="qz-tlist">${data.topics.filter(t => t.group === g).map(t => {
            const n = cnt(t.id);
            return `<label class="qb-specopt ${n ? "" : "none"}"><input type="checkbox" data-qz-mt="${t.id}" ${m.topics.includes(t.id) && n ? "checked" : ""} ${n ? "" : "disabled"}>${t.num ? `<b>${t.num}</b>` : "<b></b>"}<span>${esc(t.name)}</span><small>${n}</small></label>`;
          }).join("")}</div></fieldset>`).join("")}
          <div class="qz-go"><span><b>${m.topics.filter(cnt).length}</b> topics · ${total} questions</span>
            <span class="qz-ns"><small>Start with</small>${[10, 20, 30].map(n => `<button type="button" class="qb-btn primary" data-qz-mn="${n}" ${total ? "" : "disabled"}>${n}</button>`).join("")}<small>questions</small></span></div>
        </div>
      </section>`;
    };
    const QZ_L = { ...QB_ST, skip: "Skipped" };
    const qzBar = () => qz.ids.map((id, k) => `<i class="${qz.res[id] ? "b-" + qz.res[id] : k === qz.k ? "now" : ""}"></i>`).join("");
    const qzDone = () => qz.ids.slice(0, qz.k + (qz.k < qz.ids.length && qz.res[qz.ids[qz.k]] ? 1 : 0));
    /* the Next button and the bar follow the marking without redrawing the question */
    const qzNav = () => {
      const b = box.querySelector("[data-qz-next]"); if (!b) return;
      const on = !!qz.res[qz.ids[qz.k]], last = qz.k === qz.ids.length - 1;
      b.textContent = on || qz.work?.review ? (last ? "See results" : "Next question →") : (last ? "Skip and finish" : "Skip");
      b.classList.toggle("primary", on);
      box.querySelector("[data-qz-bar]").innerHTML = qzBar();
    };
    const quizView = tp => {
      const n = qz.ids.length;
      if (!qz.end && qz.k < n) {
        const it = data.items.find(x => x.id === qz.ids[qz.k]);
        const wp = qz.work && qz.work.parts[it.id];
        return `<section class="qb-main qz ${qz.mix ? "mix" : ""} ${qz.work ? "work" : ""}" aria-label="Quiz">
          <div class="qz-head"><div class="qz-title"><small>${qz.work?.review ? `${esc(qz.work.review)}'s work · ${esc(qz.work.title)}` : qz.work ? "Set work · " + esc(qz.work.title) : qz.mix ? "Mixed quiz" : "Quiz · " + esc(tp.name)}</small><b>Question ${qz.k + 1} of ${n}</b></div>
            ${qz.work?.review ? `<a class="qb-btn" href="/teacher">Back to Teacher page</a>` : qz.work ? `<a class="qb-btn" href="/my-work">Save and leave</a>` : `<button type="button" class="qb-btn" data-qz-end>End quiz</button>`}</div>
          <div class="qz-bar" data-qz-bar style="--n:${n}">${qzBar()}</div>
          ${qz.work?.review ? `<p class="qz-work">Their mark: <b>${{ got: "Got it", part: "Partly", miss: "Missed it", skip: "Skipped" }[qz.res[it.id]] || "not marked"}</b>${wp ? ` · set just part${wp.length > 1 ? "s" : ""} ${wp.map(l => `(${l})`).join(", ")}` : ""}. Their answer is written on the question and in the space below it.</p>` : qz.work ? `<p class="qz-work">${wp ? `Do just part${wp.length > 1 ? "s" : ""} ${wp.map(l => `(${l})`).join(", ")} of this question. ` : ""}Tap <b>✎ Write</b> and answer in the space below the question (or on its answer lines). Your teacher sees what you write. Then show the answer and mark how it went.</p>` : `<p class="qz-work">Answer in the space below the question (tap it to write), then show the answer and mark how it went.</p>`}
          ${qbCard(it, data)}
          <div class="qz-nav"><button type="button" class="qb-btn qz-next" data-qz-next></button></div>
        </section>`;
      }
      const done = qzDone(), c = { got: 0, part: 0, miss: 0, skip: 0 };
      done.forEach(id => c[qz.res[id] || "skip"]++);
      if (qz.work && !qz.work.sent) { qz.work.sent = true; window.GSHAccount.finish(qz.work.id, c.got, qz.ids.length); }
      const weak = done.filter(id => ["miss", "part"].includes(qz.res[id]));
      const item = id => data.items.find(x => x.id === id);
      /* mixed quiz: how each topic went, weakest first, each a link to its questions */
      const byTopic = {};
      done.forEach(id => { const t = item(id).topic, b = byTopic[t] = byTopic[t] || { n: 0, got: 0, weak: 0 }; b.n++; if (qz.res[id] === "got") b.got++; if (["miss", "part"].includes(qz.res[id])) b.weak++; });
      const topicRows = qz.mix ? Object.entries(byTopic).sort((a, b) => a[1].got / a[1].n - b[1].got / b[1].n || b[1].n - a[1].n).map(([tid, b]) => {
        const t = data.topics.find(x => x.id === tid);
        return `<li class="${b.got === b.n ? "all" : b.weak ? "weak" : ""}"><button type="button" class="qz-tlink" data-qz-topic="${tid}">${t.num ? `<b>${t.num}</b> ` : ""}${esc(t.name)}</button><span>${b.got}/${b.n}</span></li>`;
      }).join("") : "";
      return `<section class="qb-main qz" aria-label="Quiz results">
        <div class="qz-done">
          <small>${qz.work ? "Set work · " + esc(qz.work.title) : qz.mix ? "Mixed quiz" : "Quiz · " + esc(tp.name)}</small>
          <h2>${c.got === done.length ? "Every one right 🎉" : qz.work ? "Work done" : "Quiz done"}</h2>
          <p class="qz-sum"><b>${c.got}</b> of ${done.length} got it${c.part ? ` · ${c.part} partly` : ""}${c.miss ? ` · ${c.miss} missed` : ""}${c.skip ? ` · ${c.skip} skipped` : ""}</p>
          <div class="qz-bar big" style="--n:${done.length}">${done.map(id => `<i class="b-${qz.res[id] || "skip"}"></i>`).join("")}</div>
          ${topicRows ? `<h3 class="qz-h3">By topic</h3><ul class="qz-topics">${topicRows}</ul><h3 class="qz-h3">Questions</h3>` : ""}
          <ol class="qz-list">${done.map(id => { const i = item(id); return `<li><span>${esc(i.series)} · ${esc(i.paper)} · Q${i.q}${i.part ? ` (${i.part})` : ""}</span><span class="qb-stbadge"><span class="b-${qz.res[id] || "skip"}">${QZ_L[qz.res[id] || "skip"]}</span></span></li>`; }).join("")}</ol>
          <div class="qz-actions">
            ${qz.work?.review ? `<a class="qb-btn primary" href="/teacher">Back to Teacher page</a><button type="button" class="qb-btn" data-qz-redo>Look again</button>` : qz.work ? `<a class="qb-btn primary" href="/my-work">Back to My work</a><button type="button" class="qb-btn" data-qz-redo>Change a mark</button>` : ""}
            ${weak.length && !qz.work ? `<button type="button" class="qb-btn primary" data-qz-retry>Retry ${weak.length === 1 ? "the one" : `the ${weak.length}`} I missed or got partly</button>` : ""}
            ${qz.work ? "" : `<button type="button" class="qb-btn ${weak.length ? "" : "primary"}" data-qz-again>Quiz again</button>`}
            ${weak.length && !qz.work ? `<button type="button" class="qb-btn" data-qz-ws>Add ${weak.length === 1 ? "it" : "them"} to my worksheet</button>` : ""}
            ${qz.work ? "" : `<button type="button" class="qb-btn" data-qz-back>Back to questions</button>`}
          </div>
        </div>
      </section>`;
    };
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
      qzList = list;
      box.classList.toggle("qz-on", !!qz);
      document.querySelectorAll("[data-stab]").forEach(a => { const on = a.dataset.stab === (qz && (qz.setup || qz.mix) ? "quiz" : "questions"); a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
      if (qz && qz.setup) { box.innerHTML = setupView(); return; }
      inkContext();
      if (qz) { box.innerHTML = quizView(tp); qbObserve(box, data); window.CardInk?.mount(box); qzNav(); return; }
      const qn = quizPool(list).length;
      /* filters (year, paper, difficulty) sit behind one button; spec points fold away once chosen */
      const nOn = (st.year !== "all") + (paperOf() !== "all") + (st.diff !== "all");
      const yearSel = id => `<label class="qb-select"><span>Year</span><select id="${id}">${["all", ...years].map(y => `<option value="${y}" ${String(st.year) === String(y) ? "selected" : ""}>${y === "all" ? "All years" : y}</option>`).join("")}</select></label>`;
      const filters = m => `<details class="qb-filters" data-qb-fbox ${st._fopen ? "open" : ""}><summary><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 5.5h13M6 10h8M8.5 14.5h3"/></svg>Filters${nOn ? `<b>${nOn}</b>` : ""}</summary>
          <div class="qb-filters-in">${yearSel("qb-year" + m)}${paperSel("qb-paper" + m)}${diffSel("qb-diff" + m)}${nOn ? `<button type="button" class="qb-clear" data-qb-freset>Reset filters</button>` : ""}</div></details>`;
      const specSum = picked.length === pts.length ? `All ${pts.length}` : picked.length ? picked.join(", ") : "Tick to load questions";
      const specBox = pts.length > 1 ? `<details class="qb-specfilter" data-qb-sbox ${waiting || st._sopen ? "open" : ""}><summary><span>Spec points</span><em>${specSum}</em></summary>
          <div class="qb-specacts">${picked.length < pts.length ? `<button type="button" class="qb-clear" data-qb-all>Select all</button>` : ""}${picked.length ? `<button type="button" class="qb-clear" data-qb-clear>Clear</button>` : ""}</div>
          <div class="qb-speclist">${pts.map(([c, name]) => {
            const n = inTopic.filter(i => (i.spec || []).includes(c)).length;
            return `<label class="qb-specopt ${n ? "" : "none"}"><input type="checkbox" id="qb-spec-${c.replace(".", "-")}" data-qb-spec="${c}" ${picked.includes(c) ? "checked" : ""} ${n ? "" : "disabled"}><b>${c}</b><span>${esc(name)}</span><small data-qb-sprog="${c}">${qbSpecProg(inTopic, c)}</small></label>`;
          }).join("")}</div></details>` : "";
      /* one row: what to show, then Quiz me and the worksheet tools, each behind a button */
      const toolbar = waiting ? "" : `<div class="qb-toolbar">
          <div class="qb-show" role="group" aria-label="Show">${[["all", "All"], ["new", "Not tried"], ["weak", "Missed or partly"], ["got", "Got it"]].map(([v, l]) => `<button type="button" class="qb-showbtn ${st.show === v ? "on" : ""}" data-qb-show="${v}" aria-pressed="${st.show === v}">${l}</button>`).join("")}</div>
          <div class="qb-acts">
            ${qn ? `<details class="qb-menu"><summary class="qb-btn primary">Quiz me</summary><div class="qb-pop"><p>One question at a time, missed and new ones first.</p><div class="qz-ns">${[5, 10, 20].filter(n => n < qn).map(n => `<button type="button" class="qb-btn" data-qz-n="${n}">${n}</button>`).join("")}${qn <= 20 ? `<button type="button" class="qb-btn" data-qz-n="${qn}">All ${qn}</button>` : ""}<small>questions</small></div></div></details>` : ""}
            ${list.length || qbSaved().length ? `<details class="qb-menu"><summary class="qb-btn">Worksheet</summary><div class="qb-pop">
              ${list.length ? `<button type="button" class="qb-btn" data-qb-wsall></button>
              <span class="qb-fill"><label for="qb-fill-n">Fill to</label><input id="qb-fill-n" type="number" min="1" max="300" value="${store.get("ws-fill", 40)}" inputmode="numeric"><span>marks</span><button type="button" class="qb-btn" data-qb-fill>Fill</button></span>` : ""}
              ${qbSaved().length ? `<button type="button" class="qb-btn" data-qb-saved>Saved worksheets (${qbSaved().length})</button>` : ""}
            </div></details>` : ""}
          </div></div>`;
      box.innerHTML = `
        <aside class="qb-topics" aria-label="Topics">
          ${filters("")}
          ${data.modular ? `<div class="qb-units" role="group" aria-label="Unit" style="--n:${groups.length}">${groups.map(([g, name]) => `<button class="qb-unit ${g === unitOf(st.topic) ? "on" : ""}" data-qb-unit="${g}" title="${esc(name)}" aria-pressed="${g === unitOf(st.topic)}">${esc(name.split(" ·")[0])}</button>`).join("")}</div>` : ""}
          ${shown().map(([g, name]) => `<div class="qb-group"><div class="qb-gname">${name}</div>${data.topics.filter(t => t.group === g).map(t => {
            const n = filtered(t.id).length;
            return `<button class="qb-topic ${t.id === st.topic ? "on" : ""}" data-qb-topic="${t.id}" ${n ? "" : "disabled"}><span>${t.num ? `<i class="qb-num">${t.num}</i>` : ""}${esc(t.name)}</span><small>${n}</small><i class="qb-tbar" data-qb-tprog="${t.id}">${qbBar(filtered(t.id))}</i></button>`;
          }).join("")}</div>`).join("")}
        </aside>
        <section class="qb-main">
          <div class="qb-mobile">${data.modular ? `<label class="qb-select"><span>Unit</span><select id="qb-unit">${groups.map(([g, name]) => `<option value="${g}" ${g === unitOf(st.topic) ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>` : ""}
          <label class="qb-select"><span>Topic</span><select id="qb-topic">${shown().map(([g, name]) => `<optgroup label="${name}">${data.topics.filter(t => t.group === g).map(t => `<option value="${t.id}" ${t.id === st.topic ? "selected" : ""}>${t.num ? t.num + " " : ""}${esc(t.name)} (${filtered(t.id).length})</option>`).join("")}</optgroup>`).join("")}</select></label>
          ${filters("-m")}</div>
          <div class="qb-head"><h2>${tp.num ? `<span class="qb-num">${tp.num}</span>` : ""}${esc(tp.name)}</h2><span>${waiting ? `${inTopic.length} question${inTopic.length === 1 ? "" : "s"}` : `${list.length}${picked.length < pts.length || st.show !== "all" ? ` of ${inTopic.length}` : ""} question${list.length === 1 ? "" : "s"}`}</span></div>
          <p class="qb-tprog" data-qb-hprog>${qbHeadProg(inTopic)}</p>
          ${specBox}
          ${toolbar}
          ${waiting ? `<p class="qb-empty qb-pick">Tick one or more spec points above to load their questions.</p>` : list.length ? list.map(i => qbCard(i, data)).join("") : (st.show !== "all" && bySpec.length ? `<p class="qb-empty">${{ new: "You've tried every question here.", weak: "Nothing missed here. 🎉", got: "None marked Got it yet." }[st.show]}</p>` : `<p class="qb-empty">No questions for this topic${nOn ? " with these filters" : ""} yet.</p>`)}
        </section>`;
      qbObserve(box, data); window.CardInk?.mount(box); qbWsAll(box);
    };
    box.onclick = e => {
      /* folding boxes: note the new state straight away (a redraw can come before the toggle event) */
      const fs = e.target.closest("[data-qb-fbox] > summary, [data-qb-sbox] > summary");
      if (fs) { const d = fs.parentElement; st[d.matches("[data-qb-fbox]") ? "_fopen" : "_sopen"] = !d.open; }
      const qn = e.target.closest("[data-qz-n]");
      if (qn) { quizGo(quizPool(qzList).slice(0, +qn.dataset.qzN)); return; }
      if (e.target.closest("[data-qz-setup]")) { mixSetup(); return; }
      if (qz && qz.setup) {
        const m = qz.m, avail = () => data.topics.filter(t => quizPool(mixItems(t.id, m.paper)).length).map(t => t.id);
        const keep = window.scrollY, redo = () => { store.set(mixKey, { topics: m.topics, paper: m.paper }); render(); window.scrollTo(0, keep); };
        if (e.target.closest("[data-qz-mall]")) { m.topics = avail(); redo(); return; }
        if (e.target.closest("[data-qz-mnone]")) { m.topics = []; redo(); return; }
        const mg = e.target.closest("[data-qz-mg]");
        if (mg) { m.topics = avail().filter(id => data.topics.find(t => t.id === id).group === mg.dataset.qzMg); redo(); return; }
        const mn = e.target.closest("[data-qz-mn]");
        if (mn) { store.set(mixKey, { topics: m.topics, paper: m.paper }); const mix = { ...m }; quizGo(mixPool(mix).slice(0, +mn.dataset.qzMn), mix); return; }
        if (e.target.closest("[data-qz-back]")) { qz = null; render(); return; }
        return;
      }
      if (qz) {
        const tl = e.target.closest("[data-qz-topic]");
        if (tl) { st.topic = tl.dataset.qzTopic; st.specs = st.specs || {}; st.specs[st.topic] = []; qz = null; render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
        if (e.target.closest("[data-qz-end]")) { if (qzDone().length) qz.end = true; else qz = null; render(); return; }
        if (e.target.closest("[data-qz-next]")) {
          const id = qz.ids[qz.k]; if (!qz.res[id]) { qz.res[id] = "skip"; if (qz.work) window.GSHAccount.mark(qz.work.id, id, "skip"); }
          qz.k++;
          render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); return;
        }
        if (e.target.closest("[data-qz-redo]")) { qz.end = false; qz.k = 0; qz.work.sent = !!qz.work.review; render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
        if (e.target.closest("[data-qz-back]")) { qz = null; render(); return; }
        if (e.target.closest("[data-qz-again]")) { quizGo(qz.mix ? mixPool(qz.mix).slice(0, qz.ids.length) : quizPool(qzList).slice(0, qz.ids.length), qz.mix); return; }
        const weak = () => qzDone().filter(id => ["miss", "part"].includes(qz.res[id]));
        if (e.target.closest("[data-qz-retry]")) { quizGo(shuffle(weak()), qz.mix); return; }
        const qw = e.target.closest("[data-qz-ws]");
        if (qw) {
          const add = weak().filter(id => !qbWs.ids.includes(id));
          qbWs.ids = qbWs.ids.concat(add); add.forEach(id => delete qbWs.parts[id]); qbWsSave(); qbWsBar();
          qbToast(add.length ? `Added ${add.length} question${add.length === 1 ? "" : "s"} to your worksheet` : "They're already on your worksheet");
          qw.disabled = true; return;
        }
      }
      if (e.target.closest("[data-qb-saved]")) { qbSavedDialog(false); return; }
      if (e.target.closest("[data-qb-freset]")) { st.year = "all"; st.paper = "all"; st.diff = "all"; render(); return; }
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
      if (qz && qz.work && qz.work.review && e.target.closest("[data-qb-st], [data-qb-opt], [data-qb-check]")) { qbToast("This is the student's work: marks can't be changed here"); return; }
      const mk = e.target.closest("[data-qb-st]");
      if (mk) {
        const id = mk.closest("[data-qb-card]").dataset.qbCard, v = qbProg.map[id] === mk.dataset.qbSt && (!qz || qz.res[id]) ? null : mk.dataset.qbSt;
        qbSetProg(id, v, box, data, key);
        if (qz) { if (v) qz.res[id] = v; else delete qz.res[id]; qzNav(); if (qz.work) window.GSHAccount.mark(qz.work.id, id, v); }
        return;
      }
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
        /* in a quiz the first answer counts */
        if (qz) { qz.res[it.id] = ok ? "got" : "miss"; mc.querySelectorAll("[data-qb-opt], [data-qb-check]").forEach(b => b.disabled = true); qzNav(); if (qz.work) window.GSHAccount.mark(qz.work.id, it.id, qz.res[it.id]); }
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
      const ab = e.target.closest("[data-qb-ans]");
      if (ab) ab.closest("[data-qb-card]")?.classList.add("seen");
      if (ab) {
        const el = box.querySelector(`[data-qb-ansbox="${CSS.escape(ab.dataset.qbAns)}"]`), open = el.hidden;
        el.hidden = !open; ab.textContent = open ? "Hide answer" : "Show answer"; ab.setAttribute("aria-expanded", open); ab.classList.toggle("on", open);
        if (open) qbAnswer(el, data.items.find(x => x.id === ab.dataset.qbAns), data);
        else { el.querySelectorAll("canvas").forEach(c => { c.width = 0; c.height = 0; }); el.replaceChildren(); }
        return;
      }
      const wb = e.target.closest("[data-qb-ws]");
      if (wb) { qbWsToggle(wb.dataset.qbWs); qbWsAll(box); return; }
      const ub = e.target.closest("[data-qb-unit]");
      if (ub) { st.topic = (data.topics.find(t => t.group === ub.dataset.qbUnit && filtered(t.id).length) || data.topics.find(t => t.group === ub.dataset.qbUnit)).id; render(); return; }
      const tb = e.target.closest("[data-qb-topic]");
      if (tb) { st.topic = tb.dataset.qbTopic; st._sopen = false; render(); box.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
      if (e.target.closest("[data-qb-clear]")) { st.specs[st.topic] = []; render(); return; }
      if (e.target.closest("[data-qb-all]")) { st.specs[st.topic] = [...box.querySelectorAll("[data-qb-spec]:not(:disabled)")].map(x => x.dataset.qbSpec); render(); return; }
      const act = e.target.closest("[data-qb-open]");
      if (act) act.closest("[data-qb-card]")?.classList.add("seen");
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
          const info = { src: it.src, title: `${name}${part}`, desc: `Question · ${data.label || "Edexcel A Level Maths 9MA0"}`, ms: it.ms || "", page: s0 ? s0[0] : 1, y, msPage: it.msPage || 1, msY: it.msY || 0, pages, msPages };
          window.Viewer.open(info);
        }
      }
    };
    /* folding boxes remember whether they're open across redraws */
    box.ontoggle = null;
    if (!box._tg) { box._tg = true; box.addEventListener("toggle", e => {
      if (e.target.matches(".qb-menu") && e.target.open) box.querySelectorAll(".qb-menu[open]").forEach(d => d !== e.target && (d.open = false));
    }, true); }
    box.onchange = e => {
      if (qz && qz.setup) {
        const keep = window.scrollY;
        if (e.target.id === "qz-paper") qz.m.paper = e.target.value;
        if (e.target.dataset.qzMt) qz.m.topics = [...box.querySelectorAll("[data-qz-mt]:checked")].map(x => x.dataset.qzMt);
        store.set(mixKey, { topics: qz.m.topics, paper: qz.m.paper }); render(); window.scrollTo(0, keep);
        if (e.target.dataset.qzMt) box.querySelector(`[data-qz-mt="${CSS.escape(e.target.dataset.qzMt)}"]`)?.focus({ preventScroll: true });
        return;
      }
      if (e.target.id === "qb-year" || e.target.id === "qb-year-m") { st.year = e.target.value; render(); }
      if (e.target.id === "qb-paper" || e.target.id === "qb-paper-m") { st.paper = e.target.value; render(); }
      if (e.target.id === "qb-diff" || e.target.id === "qb-diff-m") { st.diff = e.target.value; render(); }
      if (e.target.id === "qb-topic") { st.topic = e.target.value; st._sopen = false; render(); }
      if (e.target.id === "qb-unit") { const g = e.target.value; st.topic = (data.topics.find(t => t.group === g && filtered(t.id).length) || data.topics.find(t => t.group === g)).id; render(); }
      if (e.target.dataset.qbSpec) {
        const keep = window.scrollY;
        st.specs[st.topic] = [...box.querySelectorAll("[data-qb-spec]:checked")].map(x => x.dataset.qbSpec); st._sopen = true;
        render(); window.scrollTo(0, keep);
        $("#qb-spec-" + e.target.dataset.qbSpec.replace(".", "-"))?.focus({ preventScroll: true });
      }
    };
    if (workId && window.GSHAccount) workGo(workId); else if (askMix) mixSetup(); else render();
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
        if (b.dataset.ws === "save") qbSavedDialog(true);
        if (b.dataset.ws === "assign") {
          const topic = (qbWs.data.topics.find(t => t.id === qbState.topic) || {}).name || "", marks = qbWs.ids.reduce((a, id) => a + qbWsMarks(id), 0), n = qbWs.ids.length;
          window.GSHAccount.assignDialog({ kind: "qs", bank: qbWs.bank, title: `${qbWs.data.spec} · ${topic}`, summary: `${n} question${n === 1 ? "" : "s"}${marks ? ` · ${marks} marks` : ""}`,
            payload: { items: qbWs.ids.map(id => qbWs.parts[id] ? { id, parts: qbWs.parts[id] } : { id }), marks } });
        }
      };
      document.body.appendChild(bar);
    }
    document.body.classList.add("ws-on");
    const marks = qbWs.ids.reduce((a, id) => a + qbWsMarks(id), 0);
    bar.innerHTML = `<span><b>Worksheet</b> · ${n} question${n === 1 ? "" : "s"}${marks ? `<i class="wsm" style="font-style:normal"> · ${marks} marks</i>` : ""}</span>
      <button class="qb-btn" data-ws="clear">Clear</button>
      <button class="qb-btn" data-ws="save">Save<span class="ws-long"> or share</span></button>
      ${window.GSHAccount?.isTeacher() ? `<button class="qb-btn" data-ws="assign">Assign</button>` : ""}
      <button class="qb-btn primary" data-ws="build">Build PDF</button>`;
  }
  /* ----- Saved worksheets (kept in this browser, per question bank) and share links that rebuild the same set ----- */
  const qbSavedKey = () => "ws-saved:" + qbWs.key;
  const qbSaved = () => store.get(qbSavedKey(), []).filter(w => w && Array.isArray(w.ids));
  /* a worksheet in a link: question ids, each with its picked parts after "~" (3 to 4 KB for 40 questions) */
  const qbWsEncode = (ids, parts) => ids.map(id => id + (parts[id] ? "~" + parts[id].join("") : "")).join(".");
  const qbWsDecode = (str, data) => {
    const ids = [], parts = {};
    for (const bit of String(str || "").split(".")) {
      const [id, pl] = bit.split("~"), it = data.items.find(x => x.id === id);
      if (!it || ids.includes(id)) continue;
      ids.push(id);
      const ok = (pl || "").split("").filter(l => (it.parts || []).some(p => p.l === l));
      if (ok.length) parts[id] = ok;
    }
    return { ids, parts };
  };
  const qbWsLink = (ids, parts, title) => `${location.origin}${url.qbank(...qbWs.bank.split("/"))}?ws=${encodeURIComponent(qbWsEncode(ids, parts))}${title ? `&t=${encodeURIComponent(title)}` : ""}`;
  const qbSetWs = (ids, parts) => {
    const was = qbWs.ids; qbWs.ids = [...ids]; qbWs.parts = JSON.parse(JSON.stringify(parts || {}));
    qbWsSave(); qbWsBar(); [...new Set([...was, ...ids])].forEach(qbRefreshCard);
    const box = $("#qb"); if (box) qbWsAll(box);
  };
  function qbSavedDialog(withCurrent) {
    const data = qbWs.data, topic = (data.topics.find(t => t.id === qbState.topic) || {}).name || "";
    const dlg = document.createElement("div"); dlg.className = "qb-dlg-wrap";
    const draw = () => {
      const list = qbSaved(), n = qbWs.ids.length;
      const marks = ids => ids.reduce((a, id) => a + qbWsMarks(id), 0);
      dlg.innerHTML = `<div class="qb-dlg qb-saved" role="dialog" aria-modal="true" aria-labelledby="qb-sv-h">
        <h2 id="qb-sv-h">${withCurrent && n ? "Save or share this worksheet" : "Saved worksheets"}</h2>
        ${withCurrent && n ? `<form class="qb-sv-save" data-sv-form>
            <label class="qb-field"><span>Name</span><input name="name" value="${esc(`${data.spec} · ${topic}`)}" maxlength="80"></label>
            <button type="submit" class="qb-btn primary">Save</button></form>
          <div class="qb-field"><span>Share link <small>Anyone with the link gets these ${n} questions${Object.keys(qbWs.parts).length ? " and the parts picked" : ""}</small></span>
            <div class="qb-sv-link"><input readonly value="${esc(qbWsLink(qbWs.ids, qbWs.parts, ""))}" data-sv-link><button type="button" class="qb-btn" data-sv-copy>Copy</button></div></div>` : ""}
        ${list.length ? `<h3>Saved in this browser</h3><ul class="qb-sv-list">${list.map((w, k) => `<li><span><b>${esc(w.name)}</b><small>${w.ids.length} question${w.ids.length === 1 ? "" : "s"} · ${marks(w.ids)} marks · ${new Date(w.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small></span>
            <button type="button" class="qb-btn" data-sv-load="${k}">Open</button><button type="button" class="qb-btn" data-sv-share="${k}">Copy link</button><button type="button" class="qb-btn qb-sv-del" data-sv-del="${k}" aria-label="Delete ${esc(w.name)}">Delete</button></li>`).join("")}</ul>`
          : `<p class="qb-sv-none">${withCurrent && n ? "Saved worksheets appear here, ready to open again or share." : "No saved worksheets yet. Add questions to a worksheet, then choose Save or share."}</p>`}
        <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Close</button></div>
      </div>`;
    };
    draw();
    document.body.appendChild(dlg);
    const close = () => dlg.remove();
    const copy = async (text, btn) => {
      try { await navigator.clipboard.writeText(text); qbToast("Link copied"); }
      catch (e) { const i = dlg.querySelector("[data-sv-link]"); if (i) { i.select(); } qbToast("Select the link and copy it"); }
      if (btn) { const was = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { if (btn.isConnected) btn.textContent = was; }, 1500); }
    };
    dlg.onclick = e => {
      if (e.target === dlg || e.target.closest("[data-x]")) return close();
      if (e.target.closest("[data-sv-link]")) return e.target.select();
      const c = e.target.closest("[data-sv-copy]"); if (c) { const nm = dlg.querySelector("[data-sv-form] [name=name]")?.value.trim() || ""; const link = qbWsLink(qbWs.ids, qbWs.parts, nm); dlg.querySelector("[data-sv-link]").value = link; return copy(link, c); }
      const list = qbSaved();
      const sh = e.target.closest("[data-sv-share]"); if (sh) { const w = list[+sh.dataset.svShare]; return copy(qbWsLink(w.ids, w.parts || {}, w.name), sh); }
      const ld = e.target.closest("[data-sv-load]");
      if (ld) { const w = list[+ld.dataset.svLoad]; const d = qbWsDecode(qbWsEncode(w.ids, w.parts || {}), qbWs.data); qbSetWs(d.ids, d.parts); qbToast(`Opened “${w.name}” · ${d.ids.length} questions`); return close(); }
      const del = e.target.closest("[data-sv-del]");
      if (del) { list.splice(+del.dataset.svDel, 1); store.set(qbSavedKey(), list); draw(); }
    };
    dlg.onsubmit = e => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim() || "Worksheet", list = qbSaved().filter(w => w.name !== name);
      list.unshift({ name, ids: [...qbWs.ids], parts: JSON.parse(JSON.stringify(qbWs.parts)), at: Date.now() });
      store.set(qbSavedKey(), list.slice(0, 30)); qbToast(`Saved “${name}”`); draw();
    };
    dlg.onkeydown = e => { if (e.key === "Escape") close(); };
  }
  /* a shared link: offer its questions as this browser's worksheet */
  function qbSharedOffer(str, title, after) {
    const d = qbWsDecode(str, qbWs.data); if (!d.ids.length) return;
    const n = qbWs.ids.length, marks = d.ids.reduce((a, id) => { const it = qbWs.data.items.find(x => x.id === id), sel = d.parts[id];
      return a + (sel && it.parts ? it.parts.filter(p => sel.includes(p.l)).reduce((b, p) => b + (p.m || 0), 0) : it.marks || 0); }, 0);
    const dlg = document.createElement("div"); dlg.className = "qb-dlg-wrap";
    dlg.innerHTML = `<div class="qb-dlg" role="dialog" aria-modal="true" aria-labelledby="qb-sh-h">
      <h2 id="qb-sh-h">Shared worksheet</h2>
      <p class="qb-sv-none"><b>${esc(title || "A worksheet")}</b><br>${d.ids.length} question${d.ids.length === 1 ? "" : "s"} · ${marks} marks</p>
      ${n ? `<p class="qb-sv-none">You already have ${n} question${n === 1 ? "" : "s"} on your worksheet.</p>` : ""}
      <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Not now</button>
        ${n ? `<button type="button" class="qb-btn" data-sh="add">Add to mine</button><button type="button" class="qb-btn primary" data-sh="replace">Replace mine</button>` : `<button type="button" class="qb-btn primary" data-sh="replace">Open it</button>`}</div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.onclick = e => {
      const b = e.target.closest("[data-sh]");
      if (e.target === dlg || e.target.closest("[data-x]") || b) dlg.remove();
      if (!b) return;
      if (b.dataset.sh === "replace") qbSetWs(d.ids, d.parts);
      else { const parts = { ...qbWs.parts }; d.ids.forEach(id => { if (!qbWs.ids.includes(id) && d.parts[id]) parts[id] = d.parts[id]; }); qbSetWs([...qbWs.ids, ...d.ids.filter(id => !qbWs.ids.includes(id))], parts); }
      qbToast(`Worksheet now has ${qbWs.ids.length} questions · Build PDF when ready`);
      after && after();
    };
  }
  /* The worksheet is built afresh: each question is cut from its paper (only its own lines, with the space and
     diagrams between them) and laid onto clean A4 pages, numbered 1, 2, 3… in worksheet order under a line naming
     its source. The paper's own question number is covered, and parts not picked are left out. Pages get their own
     numbers and the footer. Mark schemes follow, cut the same way; multiple-choice answers go in one table. */
  async function qbWsBuild(btn, opts = { cover: false, ms: true, title: "" }) {
    opts = { ...opts, footer: WS_FOOTER };
    const data = qbWs.data, items = qbWs.ids.map(id => data.items.find(i => i.id === id)).filter(Boolean);
    if (!items.length) return;
    btn.disabled = true; btn.textContent = "Building…";
    try {
      await window.Viewer.loadPdfLib();
      const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
      const out = await PDFDocument.create(), cache = {};
      const load = async src => cache[src] ||= PDFDocument.load(await (await fetch(src)).arrayBuffer(), { ignoreEncryption: true });
      const font = await out.embedFont(StandardFonts.Helvetica), bold = await out.embedFont(StandardFonts.HelveticaBold);
      const ink = rgb(0.11, 0.12, 0.12), grey = rgb(0.4, 0.42, 0.42), white = rgb(1, 1, 1);
      const clean = t => String(t).replace(/[^\x20-\x7E -ÿ]/g, "-");
      /* parts picked: a part card is its own part; a question with chosen parts uses those; otherwise the whole question */
      const whole = it => it.part ? data.items.find(x => x.src === it.src && x.q === it.q && !x.part) : it;
      const pick = it => { const w = whole(it); if (!w || !(w.parts || []).length) return null;
        const sel = it.part ? [it.part] : qbWs.parts[it.id]; return sel && w.parts.some(p => sel.includes(p.l)) ? { w, sel } : null; };
      const ref = it => { const pk = pick(it);
        return `${it.series} ${it.paper.replace(/^Paper\s*/, "P")} Q${String(it.q).padStart(2, "0")}${pk ? pk.sel.map(l => `(${l})`).join("") : it.part ? `(${it.part})` : ""}`; };
      const qMarks = it => { const pk = pick(it); return pk ? pk.w.parts.filter(p => pk.sel.includes(p.l)).reduce((a, p) => a + (p.m || 0), 0) : it.marks || 0; };

      /* the bands of a question to show, each [page, top, bottom] in points from the top of the paper's page.
         Lines next to each other stay together with whatever lies between them (working space, diagrams);
         a part not picked breaks the run, so it and the space around it drop out. */
      const bandsOf = it => {
        const pk = pick(it);
        let groups;    /* runs of segments, each group shown in order; a new group starts after something left out */
        if (pk) {
          const parts = pk.w.parts, keep = [{ k: -1, s: pk.w.stem || [] }, ...parts.map((p, k) => ({ k, s: p.s })).filter(g => pk.sel.includes(parts[g.k].l))];
          groups = []; let prev = null;
          for (const g of keep) { if (!g.s.length) continue; if (prev !== null && g.k === prev + 1) groups[groups.length - 1].push(...g.s); else groups.push([...g.s]); prev = g.k; }
        } else {
          const w = whole(it), stem = it.part && w && w.stem ? w.stem : null;
          groups = stem ? [stem, it.segs.filter(sg => !stem.some(x => x[0] === sg[0] && Math.abs(x[1] - sg[1]) < 0.5))] : [it.segs];
        }
        const bands = [];
        for (const g of groups) {
          const byPage = {};
          g.forEach(([pn, y0, y1]) => { const b = byPage[pn] ||= [pn, y0, y1]; b[1] = Math.min(b[1], y0); b[2] = Math.max(b[2], y1); });
          bands.push(...Object.values(byPage).sort((a, b) => a[0] - b[0]));
        }
        /* a whole question starting with a sliver at the foot of a page (a stray line) leaves that sliver out */
        if (!pk && !it.part && bands.length > 1 && bands[0][2] - bands[0][1] < 25) bands.shift();
        return bands;
      };
      /* where the paper prints the question's own number (to cover it): from the page's text, near the left edge on its first line */
      const numberBox = async (it, band, m) => {
        try {
          return await window.Viewer.withDoc(it.src, async doc => {
            /* the bank measures from the top of the full page (media box); the text from the visible part (crop box) is cy higher */
            const page = await doc.getPage(band[0]), tc = await page.getTextContent(), top = page.view[3] + (m.cy || 0);
            const x0 = m.x0 || m.W * 0.092, want = new RegExp(`^\\s*(0?${it.q}\\.?)(\\s|$)`);
            for (const t of tc.items) {
              const s = t.str || "", mt = s.match(want), x = t.transform[4], base = top - t.transform[5], size = Math.hypot(t.transform[2], t.transform[3]) || t.height || 11;
              if (mt && x < x0 + 30 && base > band[1] && base < band[1] + 60) {
                /* a run like "5. The curve…": cover just the number */
                const w = s.trim().length > mt[1].length ? (t.width || 0) * (mt[0].trimEnd().length / s.length) : (t.width || size * 0.6 * mt[1].length);
                return { x0: x - 1.5, x1: x + (w || size * 0.55 * mt[1].length) + 1, y0: base - size * 0.85, y1: base + size * 0.3 };
              }
            }
            return null;
          });
        } catch (e) { return null; }
      };

      /* page layout */
      const PW = 595.28, PH = 841.89, M = 42, TOP = PH - 46, BOTTOM = 58, COLW = PW - 2 * M;
      let page = null, y = 0;
      const body = [];   /* pages that get a page number */
      const newPage = () => { page = out.addPage([PW, PH]); body.push(page); y = TOP; };
      const room = () => page ? y - BOTTOM : 0;
      const heading = (num, label, need) => {
        if (!page || room() < 24 + Math.min(need, TOP - BOTTOM - 24)) newPage();
        page.drawText(String(num), { x: M, y: y - 12, size: 12.5, font: bold, color: ink });
        page.drawText(clean(label), { x: M + 34, y: y - 12, size: 12.5, font: bold, color: ink });
        y -= 24;
      };
      /* draw a band of a source page at the cursor, scaled to the column, starting a new page when it doesn't fit */
      /* x0, x1, t, b are measured on the page as it is seen (some mark scheme pages are stored on their side, /Rotate) */
      const drawBand = async (srcDoc, pn, x0, x1, t, b, cover) => {
        const sp = srcDoc.getPage(pn - 1), mb = sp.getMediaBox(), rot = ((sp.getRotation().angle % 360) + 360) % 360;
        const box = rot === 90 ? { left: mb.x + t, right: mb.x + b, bottom: mb.y + x0, top: mb.y + x1 }
          : rot === 270 ? { left: mb.x + mb.width - b, right: mb.x + mb.width - t, bottom: mb.y + mb.height - x1, top: mb.y + mb.height - x0 }
          : rot === 180 ? { left: mb.x + mb.width - x1, right: mb.x + mb.width - x0, bottom: mb.y + t, top: mb.y + b }
          : { left: mb.x + x0, right: mb.x + x1, bottom: mb.y + mb.height - b, top: mb.y + mb.height - t };
        const ep = await out.embedPage(sp, box);
        let sc = Math.min(1, COLW / (x1 - x0)), h = (b - t) * sc;
        if (h > TOP - BOTTOM) { sc *= (TOP - BOTTOM) / h; h = TOP - BOTTOM; }
        if (!page || room() < h) newPage();
        const left = M, by = y - h, w = (x1 - x0) * sc;
        const at = rot === 90 ? { x: left, y: by + h, rotate: degrees(-90) } : rot === 270 ? { x: left + w, y: by, rotate: degrees(90) }
          : rot === 180 ? { x: left + w, y: by + h, rotate: degrees(180) } : { x: left, y: by };
        page.drawPage(ep, { ...at, xScale: sc, yScale: sc });
        if (cover) page.drawRectangle({ x: left + (cover.x0 - x0) * sc, y: by + (b - cover.y1) * sc, width: (cover.x1 - cover.x0) * sc, height: (cover.y1 - cover.y0) * sc, color: white });
        y = by - 6;
      };

      /* cover page */
      if (opts.cover) {
        const pg = out.addPage([PW, PH]), total = items.reduce((a, it) => a + qMarks(it), 0);
        /* exam pace: about 1.2 minutes a mark for written questions, a multiple-choice question about 1.9 */
        const mins = Math.max(5, Math.round(items.reduce((a, it) => a + (it.mcq ? 1.875 : 1.2 * qMarks(it)), 0) / 5) * 5);
        pg.drawText(clean(opts.title || "Worksheet"), { x: 56, y: 760, size: 24, font: bold, color: ink, maxWidth: 480 });
        pg.drawText(clean(data.label || ""), { x: 56, y: 736, size: 11, font, color: grey });
        const line = (label, x, yy, w) => { pg.drawText(label, { x, y: yy, size: 11, font, color: ink }); const lx = x + font.widthOfTextAtSize(label, 11) + 6; pg.drawLine({ start: { x: lx, y: yy - 2 }, end: { x: x + w, y: yy - 2 }, thickness: 0.7, color: rgb(0.55, 0.57, 0.57) }); };
        line("Name", 56, 690, 300); line("Date", 376, 690, 163);
        const tile = (label, val, x) => {
          pg.drawRectangle({ x, y: 600, width: 150, height: 58, borderColor: rgb(0.8, 0.82, 0.82), borderWidth: 1 });
          pg.drawText(label, { x: x + 12, y: 640, size: 9, font, color: grey });
          pg.drawText(val, { x: x + 12, y: 612, size: 18, font: bold, color: ink });
        };
        tile("Total marks", String(total), 56); tile("Suggested time", `${mins} min`, 222); tile("Your mark", `       / ${total}`, 388);
        pg.drawText("Questions", { x: 56, y: 560, size: 13, font: bold, color: ink });
        let yy = 536; const fits = Math.floor((536 - 70) / 19);
        items.slice(0, fits).forEach((it, k) => {
          pg.drawText(clean(`${k + 1}.  ${ref(it)}`), { x: 56, y: yy, size: 11, font, color: ink });
          const mk = qMarks(it), t = `${mk} mark${mk === 1 ? "" : "s"}`;
          pg.drawText(t, { x: 539 - font.widthOfTextAtSize(t, 11), y: yy, size: 11, font, color: grey });
          yy -= 19;
        });
        if (items.length > fits) pg.drawText(`… and ${items.length - fits} more`, { x: 56, y: 56, size: 10, font, color: grey });
      }

      /* the questions */
      for (const [k, it] of items.entries()) {
        const m = data.pdfs[it.src], doc = await load(it.src), bands = bandsOf(it); if (!bands.length) continue;
        const x0 = (m.x0 || m.W * 0.092) - 4, x1 = (m.x1 || m.W * 0.905) + 6;
        const num = await numberBox(it, bands[0], m);
        heading(k + 1, ref(it), (bands[0][2] - bands[0][1]) * Math.min(1, COLW / (x1 - x0)));
        for (const [j, [pn, t, b]] of bands.entries()) await drawBand(doc, pn, x0, x1, t - 3, b + 6, j === 0 ? num : null);
        y -= 18;
      }

      /* mark schemes: one answer table for multiple choice, then each written question's rows */
      if (opts.ms) {
        const mcq = items.map((it, k) => [k + 1, it]).filter(([, it]) => it.mcq);
        const written = items.map((it, k) => [k + 1, it]).filter(([, it]) => !it.mcq && it.ms && it.msPage);
        if (mcq.length || written.length) {
          newPage();
          page.drawText("Mark schemes", { x: M, y: y - 22, size: 22, font: bold, color: ink }); y -= 46;
          if (mcq.length) {
            page.drawText("Multiple-choice answers", { x: M, y: y - 12, size: 12.5, font: bold, color: ink }); y -= 28;
            const cols = 5, cw = COLW / cols;
            mcq.forEach(([n, it], k) => {
              if (k % cols === 0 && k) y -= 20;
              if (y < BOTTOM + 20) newPage();
              const x = M + (k % cols) * cw;
              page.drawText(`${n}.`, { x, y: y - 12, size: 11.5, font, color: grey });
              page.drawText(it.ans || "–", { x: x + 30, y: y - 12, size: 11.5, font: bold, color: ink });
            });
            y -= 40;
          }
          for (const [n, it] of written) {
            const msDoc = await load(it.ms), pc = msDoc.getPageCount();
            /* the page as seen: a page stored on its side is seen the other way round */
            const seen = pn => { const pg = msDoc.getPage(pn - 1), r = pg.getRotation().angle % 180 !== 0; return r ? [pg.getHeight(), pg.getWidth()] : [pg.getWidth(), pg.getHeight()]; };
            /* the question's rows, as Show answer finds them */
            const pk = pick(it), by = pk && pk.w.msPage && pk.w.parts.every(p => p.mp) ? pk.w : it;
            const bands = qbAnsBands(by, data, seen, pc, pk && by === pk.w ? pk.sel : undefined).map(([pn, t, b]) => { const [pw] = seen(pn); return [pn, pw * 0.04, pw * 0.96, t, b]; });
            if (!bands.length) continue;
            /* the heading stays with the first rows */
            const [, fx0, fx1, ft, fb] = bands[0];
            heading(n, `${ref(it)} mark scheme`, (fb - ft) * Math.min(1, COLW / (fx1 - fx0)));
            for (const [pn, bx0, bx1, t, b] of bands) await drawBand(msDoc, pn, bx0, bx1, t, b, null);
            y -= 18;
          }
        }
      }

      /* page numbers and the footer on every page after the cover */
      body.forEach((pg, k) => {
        const c = pg.getCropBox(), rot = pg.getRotation().angle % 360, size = 8.5;
        if (rot) return;   /* a copied sideways page keeps its own markings */
        const pnum = `Page ${k + 1} of ${body.length}`;
        pg.drawText(pnum, { x: c.x + c.width / 2 - font.widthOfTextAtSize(pnum, size) / 2, y: c.y + 22, size, font, color: grey });
        const t = clean(opts.footer), w = font.widthOfTextAtSize(t, size);
        pg.drawText(t, { x: c.x + c.width - M - w, y: c.y + 22, size, font, color: grey });
      });
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
        <span class="qb-headr"><span class="qb-stbadge" data-qb-badge>${qbBadge(i.id)}</span>${i.diff ? `<span class="qb-diff d${i.diff}" title="Estimated from the marks and where the question comes in its paper">${QB_DIFF[i.diff]}</span>` : ""}${i.marks ? `<span class="qb-marks">${i.marks} mark${i.marks === 1 ? "" : "s"}</span>` : ""}</span>
      </header>
      <div class="qb-inkwrap"><div class="qb-snip" data-qb-snip="${i.id}" style="--ar:${qbAspect(i, data)}"></div></div>
      ${qbHasAns(i) ? `<div class="qb-ans" data-qb-ansbox="${i.id}" hidden></div>` : ""}
      ${i.mcq ? qbMcq(i) : ""}
      ${i.mcq ? "" : `<div class="qb-markrow"><span>How did it go?</span>${[["got", "✓ Got it"], ["part", "◐ Partly"], ["miss", "✗ Missed it"]].map(([v, l]) => `<button type="button" class="qb-stbtn st-${v} ${qbProg.map[i.id] === v ? "on" : ""}" data-qb-st="${v}" aria-pressed="${qbProg.map[i.id] === v}">${l}</button>`).join("")}</div>`}
      <footer class="qb-card-foot">
        ${qbHasAns(i) ? `<button class="qb-btn ans" data-qb-ans="${i.id}" aria-expanded="false">Show answer</button>` : ""}
        ${i.ms && !qbHasAns(i) && !i.mcq ? `<button class="qb-btn ms" data-qb-open="ms" data-qb-id="${i.id}">Mark scheme</button>` : ""}
        ${window.CardInk ? window.CardInk.button(i.id) : ""}
        <button class="qb-btn" data-qb-open="paper" data-qb-id="${i.id}">Open paper</button>
        ${qbPartsHtml(i)}${qbWsButton(i.id)}
      </footer>
    </article>`;
  }
  /* ----- Difficulty, estimated: later in the paper and more marks reads as harder. Ranked within each kind of paper
     and split into thirds: Easier, Medium, Harder. Multiple choice is left unlabelled (its order follows the syllabus). */
  const QB_DIFF = ["", "Easier", "Medium", "Harder"];
  function qbDifficulty(data) {
    if (data._diff) return; data._diff = true;
    const last = {};
    data.items.forEach(i => { last[i.src] = Math.max(last[i.src] || 1, i.q); });
    const groups = {};
    data.items.filter(i => !i.mcq).forEach(i => (groups[i.ptype || "all"] ||= []).push(i));
    for (const its of Object.values(groups)) {
      const ms = its.map(i => i.marks || 0).sort((a, b) => a - b);
      const pct = m => { let lo = 0, hi = ms.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ms[mid] < m) lo = mid + 1; else hi = mid; } return lo / Math.max(1, ms.length - 1); };
      its.forEach(i => { i._ds = 0.55 * ((i.q - 1) / Math.max(1, last[i.src] - 1)) + 0.45 * pct(i.marks || 0); });
      const sc = its.map(i => i._ds).sort((a, b) => a - b), cut1 = sc[Math.floor(sc.length / 3)], cut2 = sc[Math.floor(2 * sc.length / 3)];
      its.forEach(i => { i.diff = i._ds < cut1 ? 1 : i._ds < cut2 ? 2 : 3; });
    }
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
    if (!qbProg.key) return;   /* a teacher looking over a student's work: not this browser's own progress */
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
    const st = qbState, keep = i => (st.year === "all" || i.year === +st.year) && (!data.papers || !st.paper || st.paper === "all" || i.ptype === st.paper) && (!st.diff || st.diff === "all" || i.diff === +st.diff);
    const inTopic = data.items.filter(i => i.topic === st.topic && keep(i));
    box.querySelectorAll("[data-qb-tprog]").forEach(el => {
      const tid = el.dataset.qbTprog;
      el.innerHTML = qbBar(data.items.filter(i => i.topic === tid && keep(i)));
    });
    box.querySelectorAll("[data-qb-sprog]").forEach(el => el.innerHTML = qbSpecProg(inTopic, el.dataset.qbSprog));
    const h = box.querySelector("[data-qb-hprog]"); if (h) h.innerHTML = qbHeadProg(inTopic);
    qbSummary(data, key);
  }
  /* ----- Show answer: the question's own rows of its mark scheme, cut out and drawn under the question ----- */
  const qbHasAns = i => !i.mcq && i.ms && i.msPage;
  /* where a question's answer runs in its mark scheme: [page, top, bottom] in points on the page as seen.
     From where it starts to where the next question starts (a part card: to the foot of its first page). */
  function qbAnsBands(it, data, size, pages, picked) {
    /* a part card stops where a later part of the same question starts (when the bank lists one), else at the next question */
    const later = it.part ? data.items.filter(x => x.ms === it.ms && x.q === it.q && x.part > it.part && x.msPage && (x.msPage > it.msPage || x.msY > it.msY))
      .sort((a, b) => a.msPage - b.msPage || a.msY - b.msY)[0] : null;
    const next = later || data.items.filter(x => x.ms === it.ms && !x.part && x.q > it.q && x.msPage).sort((a, b) => a.q - b.q)[0];
    const H = pn => size(pn)[1];
    const start = [it.msPage, (it.msY || 0) * H(it.msPage)];
    let end = next ? [next.msPage, next.msY * H(next.msPage)] : [it.part ? it.msPage : Math.min(pages, it.msPage + 2), H(it.msPage) * 0.92];
    if (it.part && !later && next && next.msPage > it.msPage) end = [it.msPage, H(it.msPage) * 0.92];
    /* the next question (or part) usually opens with its own heading row: stop above it */
    if (next && end[0] === next.msPage) end[1] -= data.spec === "9701" ? 24 : 16;
    if (next && next.msY < 0.12) end = [next.msPage - 1, H(Math.max(1, next.msPage - 1)) * 0.92];
    const between = (start, end) => {
      const out = [];
      for (let pn = start[0]; pn <= Math.max(start[0], end[0]) && pn <= pages; pn++) {
        const t = pn === start[0] ? start[1] : H(pn) * 0.09, b = pn === end[0] ? Math.min(end[1], H(pn) * 0.92) : H(pn) * 0.92;
        if (b - t > 8) out.push([pn, t, b]);
      }
      return out;
    };
    /* a worksheet keeping only some parts: just their rows, each from where it starts to where the next part starts */
    const ps = it.parts || [];
    if (picked && picked.length && ps.length && ps.every(p => p.mp)) {
      const out = [];
      ps.forEach((p, k) => {
        if (!picked.includes(p.l)) return;
        const e = ps[k + 1] ? [ps[k + 1].mp[0], ps[k + 1].mp[1] * H(ps[k + 1].mp[0])] : end;
        for (const band of between([p.mp[0], p.mp[1] * H(p.mp[0])], e)) {
          const last = out[out.length - 1];
          if (last && last[0] === band[0] && Math.abs(last[2] - band[1]) < 2) last[2] = band[2]; else out.push(band);
        }
      });
      if (out.length) return out;
    }
    return between(start, end);
  }
  async function qbAnswer(el, it, data) {
    el.innerHTML = `<p class="qb-ans-msg">Loading the mark scheme…</p>`;
    const token = el._ans = Math.random();
    try {
      await window.Viewer.withDoc(it.ms, async doc => {
        const sizes = {};
        const size = pn => sizes[pn];
        for (let pn = it.msPage; pn <= Math.min(doc.numPages, it.msPage + 4); pn++) { const vp = (await doc.getPage(pn)).getViewport({ scale: 1 }); sizes[pn] = [vp.width, vp.height]; }
        const bands = qbAnsBands(it, data, pn => sizes[pn] || sizes[it.msPage], doc.numPages);
        const frag = document.createDocumentFragment(), cssW = el.clientWidth || 700, dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (const [pn, t, b] of bands) {
          if (el._ans !== token) return;
          const page = await doc.getPage(pn), [W] = size(pn), x0 = W * 0.04, bw = W * 0.92, sc = cssW / bw;
          const cv = document.createElement("canvas");
          cv.width = Math.round(bw * sc * dpr); cv.height = Math.round((b - t) * sc * dpr);
          cv.style.width = "100%"; cv.style.height = "auto";
          await page.render({ canvasContext: cv.getContext("2d"), viewport: page.getViewport({ scale: sc * dpr, offsetX: -x0 * sc * dpr, offsetY: -t * sc * dpr }) }).promise;
          frag.appendChild(cv);
        }
        if (el._ans !== token) return;
        el.replaceChildren(frag);
        const note = document.createElement("p"); note.className = "qb-ans-note";
        note.innerHTML = `Mark scheme · ${esc(it.series)} ${esc(it.paper)} Q${it.q}${it.part ? ` part (${it.part})` : ""}. Then mark how it went below.`;
        el.prepend(note);
      });
    } catch (e) {
      if (el._ans === token) el.innerHTML = `<p class="qb-ans-msg">The mark scheme couldn't load. Check your connection and try again.</p>`;
    }
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
      const keys = liveLevels().flatMap(L => liveTracks(L).flatMap(t => liveSubjects(L.id, t).filter(s => paperCount(L.id, t, s)).map(s => K(L.id, t, s))));
      return `<div class="home"><h1>Past papers</h1><p class="lede">Question papers and mark schemes for every series, opened right here to annotate.</p>
        <div class="sc-grid">${keys.map(k => { const [l, t, s] = k.split("/"); return subjCard(k).replace(`href="${url.subject(l, t, s)}"`, `href="${url.papers(l, t, s)}"`); }).join("")}</div></div>`;
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
        (Object.keys(S.formulaSheets || {}).length ? byLevel((L, t, s, c) => { const u = S.formulaSheets[K(L.id, t, s)], label = `${esc(subj(s).name)} (${c.code}) · ${esc(L.tracks[t].name)}`;
          return u ? `<a class="row" href="${esc(u)}" target="_blank" rel="noopener"><span class="grow">${label}</span><span class="open">Open ↗</span></a>` : ""; }).replace(/<h2>[^<]*<\/h2><div class="list"><\/div>/g, "") : `<p class="legend">None added yet.</p>`);
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
    /* fade the page in only when it's a different page, not when this one redraws (ticking a spec, say) */
    if (page.dataset.path !== location.pathname) { page.style.animation = "none"; void page.offsetWidth; page.style.animation = ""; }
    page.dataset.path = location.pathname;
    page.innerHTML = views[r.kind] ? views[r.kind](r) : ACCT.includes(r.kind) && window.GSHAccount ? window.GSHAccount.view(r.kind) : vTool(r.kind);
    renderSide(r);   /* after the page: it lists the subjects opened lately, this one included */
    /* search engines: a page that isn't there isn't indexed; the address of this page without a trailing slash */
    let rb = document.querySelector('meta[name="robots"]');
    if (r.kind === "notfound" || (ACCT.includes(r.kind) && r.kind !== "privacy")) { if (!rb) { rb = document.createElement("meta"); rb.name = "robots"; document.head.appendChild(rb); } rb.content = "noindex"; } else rb?.remove();
    const cl = document.querySelector('link[rel="canonical"]'); if (cl) cl.href = location.origin + (location.pathname.replace(/\/+$/, "").replace(/\.html$/, "").replace(/\/index$/, "") || "/");
  }

  /* ---------- Search ---------- */
  const INDEX = [];
  eachCourse((L, t, s, c) => {
    if (!isLive(L.id, t, s)) return;
    const T = L.tracks[t], where = `${T.full} · ${subj(s).name}`, bank = hasBank(L.id, t, s);
    INDEX.push({ s, type: "Subjects", text: `${subj(s).name}`, sub: `${T.full} ${c.code}`, href: url.subject(L.id, t, s) });
    if (paperCount(L.id, t, s)) INDEX.push({ s, type: "Past papers", text: `${subj(s).name} past papers`, sub: `${T.full} ${c.code}`, href: url.papers(L.id, t, s) });
    c.topics.forEach((tp, i) => INDEX.push({ s, type: "Topics", text: tp, sub: where, hay: `${c.code} ${L.name}`, href: bank && !liveCount(L.id, t, s, i + 1) ? `${url.qbank(L.id, t, s)}?topic=${i + 1}` : url.topic(L.id, t, s, i + 1) }));
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
    /* an open menu (Quiz me, Worksheet) closes on a click anywhere else */
    document.querySelectorAll("details.qb-menu[open]").forEach(d => { if (!d.contains(e.target)) d.open = false; });
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
    if (e.target.closest("[data-assign-paper]") && paperChoices) { window.GSHAccount.assignDialog({ kind: "paper", papers: paperChoices }); return; }
    if (e.target.closest("[data-home-edit]")) { homePicking = !homePicking; const y = scrollY; render(); scrollTo(0, y); return; }
    const hp = e.target.closest("[data-home-pick]");
    if (hp) { const k = hp.dataset.homePick, c = chosenSpecs(); store.set("qb-mine", c.includes(k) ? c.filter(x => x !== k) : [...c, k]); const y = scrollY; render(); scrollTo(0, y); return; }
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
  window.addEventListener("popstate", () => { if (stale) { goFresh(location.pathname + location.search); return; } window.Viewer?.close(); render(); });
  window.addEventListener("gsh-bookmarks", () => renderSide(parse(location.pathname)));
  /* accounts (account.js): what it needs from here, and redraws when who's signed in changes */
  window.GSHAccount?.init({
    S, esc, url, crumbs, setTitle, qbLabel, toast: m => qbToast(m),
    go: (href, replace) => { if (replace) { history.replaceState(null, "", href); render(); window.scrollTo(0, 0); } else go(href); },
    refresh: () => {
      const k = parse(location.pathname).kind;
      if ($("#qb-ws-bar")) qbWsBar();
      if (k === "papers" || k === "home" || ACCT.includes(k)) render();
    },
  });
  render();
})();
