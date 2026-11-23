/* Writing on question cards: pen, highlighter and eraser right on the question (its own answer lines), plus
   "More space" below it for working that doesn't fit. Works in the question bank and in quizzes.

   Each question's writing: { s: [items on the question], x: [items in the extra space], n: extra blocks }.
   Items are the paper viewer's own ink items; points are fractions of the card's width (x and y alike), so the
   writing stays in place at any screen size. Kept in this browser; set work also saves it to the account
   (app.js passes a sync), and a teacher reviewing a student's work sees it read-only. */
(() => {
  const KEY = id => "gsh-cink:" + id;
  const get = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const W = { pen: 0.0032, highlighter: 0.02 };
  /* the paper viewer's own colours, in its order */
  const COLORS = Object.keys(window.Viewer?.Ink?.PALETTE || { green: 1, coral: 1, yellow: 1, purple: 1, ink: 1 });
  const BLOCK = 0.42;   /* height of one block of extra space, as a fraction of the width */
  const has = d => d && ((d.s && d.s.length) || (d.x && d.x.length));
  const siteDark = () => { const t = (document.documentElement.dataset.theme || "").replace(/"/g, ""); return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = {
    pen: '<path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 0 1 3 3L8 15l-4 1Z"/>',
    highlighter: '<path d="M6 13 13.5 5.5l3 3L9 16H6v-3Z"/><path d="M4 17.5h7"/>',
    eraser: '<path d="M8 16.5h8M4.5 12.5l6.8-6.8a1.6 1.6 0 0 1 2.3 0l2.7 2.7a1.6 1.6 0 0 1 0 2.3l-5.5 5.5H7.5l-3-3a.5.5 0 0 1 0-.7Z"/>',
    undo: '<path d="M7.5 6 4 9.5 7.5 13"/><path d="M4.5 9.5h7a4 4 0 0 1 0 8H9"/>',
  };
  const svg = k => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  let ctx = { key: "local", sync: null, readOnly: false, preset: null };   /* set by app.js for the questions on screen */
  const state = {};   /* per question id: { data, undo: [] } */
  const prefs = (() => { const p = get("gsh-cink-prefs") || {}; return { tool: p.tool || "pen", color: COLORS.includes(p.color) ? p.color : "green" }; })();
  let penSeen = false;

  function dataFor(id) {
    if (!state[id]) {
      const pre = ctx.preset ? ctx.preset[id] : undefined;
      const d = pre !== undefined ? pre : (ctx.readOnly ? null : get(KEY(id)));
      /* set work: a writing space under every question from the start, for the answer */
      state[id] = { data: Object.assign({ s: [], x: [], n: ctx.sync ? 1 : 0 }, d || {}), undo: [] };
    }
    return state[id];
  }
  const timers = {};
  function save(id) {
    const st = state[id]; if (!st || ctx.readOnly) return;
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => {
      const d = st.data, keep = has(d) || d.n ? d : null;
      if (keep) put(KEY(id), keep); else { try { localStorage.removeItem(KEY(id)); } catch (e) {} }
      ctx.sync?.(id, keep);
    }, 900);
  }

  /* ---------- drawing ---------- */
  function sizeCanvas(cv, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    cv.style.width = w + "px"; cv.style.height = h + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    return c;
  }
  function paint(card) {
    const id = card.dataset.qbCard, st = dataFor(id), wrap = card.querySelector(".qb-inkwrap");
    if (!wrap || !window.Viewer?.Ink) return;
    const w = wrap.clientWidth; if (!w) return;
    const dark = siteDark(), on = card.classList.contains("writing");
    /* on the question */
    let cv = wrap.querySelector("canvas.qb-ink");
    if (!st.data.s.length && !on) { if (cv) { cv.width = 0; cv.height = 0; } }
    else {
      if (!cv) { cv = document.createElement("canvas"); cv.className = "qb-ink"; wrap.appendChild(cv); bind(card, cv, "s"); }
      const c = sizeCanvas(cv, w, wrap.clientHeight);
      window.Viewer.Ink.draw(c, st.data.s.concat(st.live && st.live.area === "s" ? [st.live.it] : []), w, w, dark);
    }
    /* the extra space under it */
    let xs = card.querySelector(".qb-xspace");
    if (st.data.n > 0) {
      if (!xs) {
        xs = document.createElement("div"); xs.className = "qb-xspace";
        xs.innerHTML = `<canvas class="qb-ink"></canvas>`;
        wrap.after(xs); bind(card, xs.firstElementChild, "x");
      }
      const h = Math.round(st.data.n * BLOCK * w);
      xs.style.height = h + "px";
      const c = sizeCanvas(xs.firstElementChild, w, h);
      window.Viewer.Ink.draw(c, st.data.x.concat(st.live && st.live.area === "x" ? [st.live.it] : []), w, w, dark);
    } else xs?.remove();
  }

  /* ---------- writing ---------- */
  function bind(card, cv, area) {
    const id = card.dataset.qbCard;
    const pos = e => { const b = cv.getBoundingClientRect(); return [+(((e.clientX - b.left) / b.width)).toFixed(5), +(((e.clientY - b.top) / b.width)).toFixed(5)]; };
    let cur = null, erasing = false, raf = 0;
    const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(card); }); };
    cv.addEventListener("pointerdown", e => {
      if (!card.classList.contains("writing") || ctx.readOnly) return;
      if (e.pointerType === "pen") { penSeen = true; document.body.classList.add("pen-seen"); }
      if (penSeen && e.pointerType === "touch") return;   /* with a stylus, fingers scroll */
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      const st = dataFor(id), [x, y] = pos(e);
      st.undo.push(JSON.stringify(st.data)); if (st.undo.length > 60) st.undo.shift();
      if (prefs.tool === "eraser") { erasing = true; erase(st, area, x, y) && redraw(); return; }
      cur = { t: prefs.tool, c: prefs.color, w: W[prefs.tool], p: [e.pointerType === "pen" && prefs.tool === "pen" ? [x, y, +(e.pressure || 0.5).toFixed(2)] : [x, y]] };
      Object.defineProperty(cur, "_live", { value: true, writable: true });
      st.live = { area, it: cur }; redraw();
    });
    cv.addEventListener("pointermove", e => {
      const st = dataFor(id);
      if (erasing) { const [x, y] = pos(e); if (erase(st, area, x, y)) redraw(); return; }
      if (!cur) return;
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      const withP = cur.p[0].length > 2, minD = 0.4 / cv.clientWidth;
      for (const ev of evs) {
        let [x, y] = pos(ev); const last = cur.p[cur.p.length - 1];
        if (Math.abs(x - last[0]) < minD && Math.abs(y - last[1]) < minD) continue;
        if (withP) { x = +(last[0] + (x - last[0]) * 0.55).toFixed(5); y = +(last[1] + (y - last[1]) * 0.55).toFixed(5); }
        const pt = [x, y]; if (withP) pt.push(+((ev.pressure || 0.5) * 0.35 + last[2] * 0.65).toFixed(3));
        cur.p.push(pt);
      }
      redraw();
    });
    const end = () => {
      const st = dataFor(id);
      if (erasing) { erasing = false; save(id); onChange(card); return; }
      if (!cur) return;
      cur._live = false; st.data[area].push(cur); st.live = null; cur = null;
      redraw(); save(id); onChange(card);
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  }
  function erase(st, area, x, y) {
    const r = 0.014, items = st.data[area];
    const keep = items.filter(it => !(it.p || []).some(([px, py]) => Math.abs(px - x) < r + it.w / 2 && Math.abs(py - y) < r + it.w / 2));
    if (keep.length === items.length) return false;
    st.data[area] = keep; return true;
  }

  /* ---------- the toolbar on a card being written on ---------- */
  function toolbar(card) {
    const id = card.dataset.qbCard, st = dataFor(id), dark = siteDark();
    return `<div class="qb-inkbar" role="toolbar" aria-label="Writing tools">
      ${["pen", "highlighter", "eraser"].map(t => `<button type="button" class="qb-ibtn ${prefs.tool === t ? "on" : ""}" data-ink-tool="${t}" title="${t[0].toUpperCase() + t.slice(1)}" aria-label="${t}" aria-pressed="${prefs.tool === t}">${svg(t)}</button>`).join("")}
      <span class="qb-isep"></span>
      ${COLORS.map(c => `<button type="button" class="qb-icol ${prefs.color === c ? "on" : ""}" data-ink-color="${c}" title="${esc(c === "ink" ? (dark ? "White" : "Black") : window.Viewer.Ink.PALETTE[c].name)}" aria-label="${esc(c === "ink" ? (dark ? "White" : "Black") : window.Viewer.Ink.PALETTE[c].name)}" aria-pressed="${prefs.color === c}"><i style="background:${window.Viewer.Ink.colorOf(c, dark)}"></i></button>`).join("")}
      <span class="qb-isep"></span>
      <button type="button" class="qb-ibtn" data-ink-undo title="Undo" aria-label="Undo" ${st.undo.length ? "" : "disabled"}>${svg("undo")}</button>
      <button type="button" class="qb-itext" data-ink-more>+ More space</button>
      ${st.data.n ? `<button type="button" class="qb-itext" data-ink-less>Less space</button>` : ""}
      <button type="button" class="qb-itext" data-ink-clear ${has(st.data) ? "" : "disabled"}>Clear</button>
      <span class="qb-ihint">${ctx.sync ? "Saves to your account" : "Saves in this browser"}${penSeen ? " · stylus writes, finger scrolls" : ""}</span>
      <button type="button" class="qb-btn primary qb-idone" data-ink-done>Done</button>
    </div>`;
  }
  function onChange(card) {
    const bar = card.querySelector(".qb-inkbar"); if (bar) bar.outerHTML = toolbar(card);
    const b = card.querySelector("[data-qb-write]"), d = dataFor(card.dataset.qbCard).data;
    if (b) b.textContent = card.classList.contains("writing") ? "✎ Writing" : has(d) ? "✎ Edit writing" : "✎ Write";
  }
  function setWriting(card, on) {
    card.classList.toggle("writing", on);
    card.querySelector(".qb-inkbar")?.remove();
    if (on) card.querySelector(".qb-inkwrap").insertAdjacentHTML("beforebegin", toolbar(card));
    card.querySelector("[data-qb-write]")?.setAttribute("aria-pressed", on);
    paint(card); onChange(card);
  }

  document.addEventListener("click", e => {
    /* tapping the writing space starts writing there */
    const sp = e.target.closest(".qb-card:not(.writing) .qb-xspace");
    if (sp && !ctx.readOnly) { setWriting(sp.closest("[data-qb-card]"), true); return; }
    const wb = e.target.closest("[data-qb-write]");
    if (wb) { const card = wb.closest("[data-qb-card]"); setWriting(card, !card.classList.contains("writing")); return; }
    const card = e.target.closest(".qb-card.writing"); if (!card) return;
    const id = card.dataset.qbCard, st = dataFor(id);
    const t = e.target.closest("[data-ink-tool]"); if (t) { prefs.tool = t.dataset.inkTool; put("gsh-cink-prefs", prefs); onChange(card); return; }
    const c = e.target.closest("[data-ink-color]"); if (c) { prefs.color = c.dataset.inkColor; if (prefs.tool === "eraser") prefs.tool = "pen"; put("gsh-cink-prefs", prefs); onChange(card); return; }
    const snap = () => { st.undo.push(JSON.stringify(st.data)); if (st.undo.length > 60) st.undo.shift(); };
    if (e.target.closest("[data-ink-undo]")) { if (st.undo.length) { st.data = JSON.parse(st.undo.pop()); paint(card); save(id); onChange(card); } return; }
    if (e.target.closest("[data-ink-more]")) { snap(); st.data.n = Math.min(8, st.data.n + 1); paint(card); save(id); onChange(card); card.querySelector(".qb-xspace")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
    if (e.target.closest("[data-ink-less]")) {
      snap(); st.data.n = Math.max(0, st.data.n - 1);
      const lim = st.data.n * BLOCK; st.data.x = st.data.x.filter(it => (it.p || []).every(([, y]) => y <= lim));   /* writing in the removed block goes too (Undo brings it back) */
      paint(card); save(id); onChange(card); return;
    }
    if (e.target.closest("[data-ink-clear]")) { snap(); st.data = { s: [], x: [], n: 0 }; paint(card); save(id); onChange(card); return; }
    if (e.target.closest("[data-ink-done]")) { setWriting(card, false); return; }
  });

  /* app.js: after drawing cards. sync(id, data) saves set work to the account; preset gives writing to show
     (a student's saved set work, or the student a teacher is reviewing); readOnly for that review. */
  const ro = new ResizeObserver(es => es.forEach(e => { const card = e.target.closest("[data-qb-card]"); if (card) paint(card); }));
  window.CardInk = {
    setContext(c) {
      /* a different set of writing (this browser's, a piece of set work, a student under review): start afresh */
      if (c.key !== ctx.key) for (const k in state) delete state[k];
      ctx = { key: c.key, sync: c.sync || null, readOnly: !!c.readOnly, preset: c.preset || null };
    },
    mount(box) {
      box.querySelectorAll("[data-qb-card]").forEach(card => {
        const wrap = card.querySelector(".qb-inkwrap"); if (!wrap || wrap._ink) return;
        wrap._ink = true; ro.observe(wrap);
        if (has(dataFor(card.dataset.qbCard).data) || dataFor(card.dataset.qbCard).data.n) paint(card);
        onChange(card);
      });
    },
    has: id => has(dataFor(id).data),
    button: id => ctx.readOnly ? "" : `<button type="button" class="qb-btn qb-write" data-qb-write="${esc(id)}" aria-pressed="false">✎ Write</button>`,
    repaintAll() { document.querySelectorAll("[data-qb-card]").forEach(paint); },
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => window.CardInk.repaintAll());
  new MutationObserver(() => window.CardInk.repaintAll()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
