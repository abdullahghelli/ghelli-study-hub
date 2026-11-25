/* Writing on question cards: pen, highlighter and eraser right on the question (its own answer lines), plus
   "More space" below it for working that doesn't fit. Works in the question bank and in quizzes.

   Each question's writing: { s: [items on the question], x: [items in the extra space], n: extra blocks }.
   Items are the paper viewer's own ink items; points are fractions of the card's width (x and y alike), so the
   writing stays in place at any screen size. Kept in this browser; set work also saves it to the account
   (app.js passes a sync), and a teacher reviewing a student's work sees it read-only. */
(() => {
  /* practice in the question bank keeps the original key; quizzes and each piece of set work have their own,
     so homework never picks up (or overwrites) practice writing on the same question */
  const KEY = id => ctx.key === "local" ? "gsh-cink:" + id : `gsh-cink:${ctx.key}:${id}`;
  /* set work that hasn't reached the account yet (offline, a failed save): sent again later */
  const UNSENT = id => `gsh-cink-unsent:${ctx.key}:${id}`;
  const get = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const W = { pen: 0.0032, highlighter: 0.02 };
  /* the paper viewer's own colours, in its order */
  const COLORS = Object.keys(window.Viewer?.Ink?.PALETTE || { green: 1, coral: 1, yellow: 1, purple: 1, ink: 1 });
  const BLOCK = 0.42;   /* height of one block of extra space, as a fraction of the width */
  /* eraser sizes: the circle's diameter, as a fraction of the width */
  const ESIZES = [["Small eraser", 0.018], ["Medium eraser", 0.035], ["Large eraser", 0.07]];
  const has = d => d && ((d.s && d.s.length) || (d.x && d.x.length));
  const siteDark = () => { const t = (document.documentElement.dataset.theme || "").replace(/"/g, ""); return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = {
    pen: '<path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 0 1 3 3L8 15l-4 1Z"/>',
    highlighter: '<path d="M6 13 13.5 5.5l3 3L9 16H6v-3Z"/><path d="M4 17.5h7"/>',
    eraser: '<path d="M8 16.5h8M4.5 12.5l6.8-6.8a1.6 1.6 0 0 1 2.3 0l2.7 2.7a1.6 1.6 0 0 1 0 2.3l-5.5 5.5H7.5l-3-3a.5.5 0 0 1 0-.7Z"/>',
    undo: '<path d="M7.5 6 4 9.5 7.5 13"/><path d="M4.5 9.5h7a4 4 0 0 1 0 8H9"/>',
    redo: '<path d="M12.5 6 16 9.5 12.5 13"/><path d="M15.5 9.5h-7a4 4 0 0 0 0 8H11"/>',
    lasso: '<path d="M10 3.8c4 0 6.8 1.9 6.8 4.3S14 12.4 10 12.4 3.2 10.5 3.2 8.1 6 3.8 10 3.8Z" stroke-dasharray="2.2 2"/><path d="M6.2 11.6c-.9 1.2-.7 2.9.6 3.6 1.1.6 1.7 1.7 1.4 2.7"/>',
    trash: '<path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5"/>',
  };
  const svg = k => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  let ctx = { key: "local", sync: null, readOnly: false, preset: null };   /* set by app.js for the questions on screen */
  const state = {};   /* per question id: { data, undo: [] } */
  const prefs = (() => { const p = get("gsh-cink-prefs") || {}; return { tool: ["pen", "highlighter", "eraser", "lasso"].includes(p.tool) ? p.tool : "pen", color: COLORS.includes(p.color) ? p.color : "green", esize: ESIZES.some(([, v]) => v === p.esize) ? p.esize : 0.035 }; })();
  /* once this device has used a Pencil, fingers scroll rather than write (remembered, shared with the viewer) */
  let penSeen = !!window.GSHPalm?.seen;
  /* palm rejection is shared with the paper viewer (viewer.js) */
  const penBusy = () => window.GSHPalm ? window.GSHPalm.busy() : false;
  const palmy = e => window.GSHPalm ? window.GSHPalm.palmy(e) : false;

  function dataFor(id) {
    if (!state[id]) {
      const pre = ctx.preset ? ctx.preset[id] : undefined;
      const unsent = !ctx.readOnly && ctx.sync && get(UNSENT(id));
      const d = unsent ? get(KEY(id)) : pre !== undefined ? pre : (ctx.readOnly ? null : get(KEY(id)));
      if (unsent) retrySoon();
      /* set work and quizzes: a writing space under every question from the start, for the answer */
      state[id] = { data: Object.assign({ s: [], x: [], n: ctx.sync || ctx.space ? 1 : 0 }, d || {}), undo: [], redo: [] };
    }
    return state[id];
  }
  const timers = {}, pending = {};
  const cardOf = id => document.querySelector(`[data-qb-card="${CSS.escape(id)}"]`);
  function save(id) {
    const st = state[id]; if (!st || ctx.readOnly) return;
    clearTimeout(timers[id]);
    const sync = ctx.sync, key = KEY(id), unsent = UNSENT(id);
    pending[id] = async () => {
      delete pending[id]; clearTimeout(timers[id]);
      const d = st.data, keep = has(d) || d.n ? d : null;
      let stored = true;
      if (keep) stored = put(key, keep); else { try { localStorage.removeItem(key); } catch (e) {} }
      if (!stored) { const c = cardOf(id); if (c) hint(c, sync ? "This browser's storage is full · your writing is still being sent to your account" : "Couldn't save · this browser's storage is full"); }
      if (!sync) return;
      put(unsent, 1);
      const ok = await Promise.resolve(sync(id, keep)).then(r => r !== false, () => false);
      if (ok) { try { localStorage.removeItem(unsent); } catch (e) {} } else retrySoon();
    };
    timers[id] = setTimeout(() => pending[id]?.(), 900);
  }
  /* send set work that didn't get through: every 20 s while any is waiting, and as soon as the connection is back */
  let retryT = 0;
  function retrySoon(ms = 20000) { clearTimeout(retryT); retryT = setTimeout(retryUnsent, ms); }
  function retryUnsent() {
    if (!ctx.sync || ctx.readOnly) return;
    const pre = `gsh-cink-unsent:${ctx.key}:`;
    let keys = []; try { keys = Object.keys(localStorage).filter(k => k.startsWith(pre)); } catch (e) {}
    for (const k of keys) {
      const id = k.slice(pre.length);
      if (pending[id]) continue;
      if (!state[id]) dataFor(id);
      save(id); pending[id]?.();
    }
  }
  window.addEventListener("online", () => retrySoon(500));
  /* save anything still waiting (before the page goes away), giving the account a moment to receive it */
  const flush = () => Promise.race([Promise.all(Object.keys(pending).map(id => Promise.resolve(pending[id]?.()).catch(() => {}))), new Promise(r => setTimeout(r, 1500))]);
  window.addEventListener("pagehide", () => { flush(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

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
      if (on && !cv._live) { cv._live = document.createElement("canvas"); cv._live.className = "qb-live"; cv.after(cv._live); }
      const c = sizeCanvas(cv, w, wrap.clientHeight);
      window.Viewer.Ink.draw(c, st.data.s, w, w, dark);
      extras(c, st, "s", w);
    }
    /* the extra space under it */
    let xs = card.querySelector(".qb-xspace");
    if (st.data.n > 0) {
      if (!xs) {
        xs = document.createElement("div"); xs.className = "qb-xspace";
        xs.innerHTML = `<canvas class="qb-ink"></canvas><canvas class="qb-live"></canvas>`;
        xs.firstElementChild._live = xs.lastElementChild;
        wrap.after(xs); bind(card, xs.firstElementChild, "x");
      }
      const h = Math.round(st.data.n * BLOCK * w);
      xs.style.height = h + "px";
      const c = sizeCanvas(xs.firstElementChild, w, h);
      window.Viewer.Ink.draw(c, st.data.x, w, w, dark);
      extras(c, st, "x", w);
    } else xs?.remove();
    /* Write sits just above the space and More space just below it, where the writing runs out */
    const show = st.data.n > 0 && !ctx.readOnly;
    card.classList.toggle("has-space", st.data.n > 0);
    let top = card.querySelector(".qb-xtop"), bot = card.querySelector(".qb-xbot");
    if (show && (!top || !bot)) {
      top?.remove(); bot?.remove();
      xs.insertAdjacentHTML("beforebegin", `<div class="qb-xtop"><span>Your answer</span><button type="button" class="qb-btn qb-write" data-qb-write="${esc(id)}"></button></div>`);
      xs.insertAdjacentHTML("afterend", `<div class="qb-xbot"></div>`);
      onChange(card);
    } else if (!show) { top?.remove(); bot?.remove(); }
  }

  /* the stroke being written is drawn on its own layer over the card, so the rest of the writing isn't redrawn on
     every move of the pen (that made long answers sluggish on iPad); only where the stroke was is wiped */
  function drawLive(cv, it) {
    const lv = cv._live; if (!lv) return;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (lv.width !== W || lv.height !== H) { lv.width = W; lv.height = H; lv.style.width = w + "px"; lv.style.height = h + "px"; lv._box = null; }
    const c = lv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bb = lv._box; if (bb) c.clearRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); else c.clearRect(0, 0, w, h);
    lv._box = null;
    if (!it) return;
    window.Viewer.Ink.draw(c, [it], w, w, siteDark());
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of it._pred ? it.p.concat(it._pred) : it.p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    const m = it.w * w * 1.5 + 4;
    lv._box = [x0 * w - m, y0 * w - m, x1 * w + m, y1 * w + m];
  }

  /* the lasso being drawn, and the box round what it selected */
  const selBox = (st, area) => {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const i of st.sel.idx) { const it = st.data[area][i]; if (!it) continue; const m = (it.w || 0) / 2 + 0.006; for (const [x, y] of it.p) b = [Math.min(b[0], x - m), Math.min(b[1], y - m), Math.max(b[2], x + m), Math.max(b[3], y + m)]; }
    return isFinite(b[0]) ? b : null;
  };
  function extras(c, st, area, w) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f6d68";
    c.save(); c.globalAlpha = 1; c.strokeStyle = accent; c.lineWidth = 1.5; c.setLineDash([6, 5]);
    if (st.live && st.live.area === area && st.live.lasso) {
      const p = st.live.lasso; c.beginPath(); p.forEach(([x, y], k) => k ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)); c.stroke();
    }
    if (st.sel && st.sel.area === area) {
      const b = selBox(st, area);
      if (b) { c.fillStyle = accent; c.globalAlpha = 0.07; c.fillRect(b[0] * w, b[1] * w, (b[2] - b[0]) * w, (b[3] - b[1]) * w); c.globalAlpha = 1; c.strokeRect(b[0] * w, b[1] * w, (b[2] - b[0]) * w, (b[3] - b[1]) * w); }
    }
    c.restore();
  }

  /* the eraser, shown as a circle of its size where the pen or mouse is */
  const ecur = document.createElement("div"); ecur.className = "qb-ecursor"; ecur.hidden = true;
  /* placed inside the writing area, relative to the canvas, so it sits under the pen whatever the zoom
     (Safari measures the pen against the zoomed view but places fixed elements against the unzoomed page) */
  const placeEraser = (el, target, e, d) => {
    const host = target.offsetParent || document.body;
    if (el.parentNode !== host) host.appendChild(el);
    const r = target.getBoundingClientRect(), k = target.offsetWidth ? r.width / target.offsetWidth : 1, s = d / k;
    Object.assign(el.style, { position: "absolute", width: s + "px", height: s + "px",
      left: target.offsetLeft + (e.clientX - r.left) / k - s / 2 + "px", top: target.offsetTop + (e.clientY - r.top) / k - s / 2 + "px" });
    el.hidden = false;
  };
  const showEraser = (cv, e) => placeEraser(ecur, cv, e, prefs.esize * cv.getBoundingClientRect().width);
  const hideEraser = () => { ecur.hidden = true; };

  /* ---------- writing ---------- */
  function bind(card, cv, area) {
    const id = card.dataset.qbCard;
    const pos = e => { const b = cv.getBoundingClientRect(); return [+(((e.clientX - b.left) / b.width)).toFixed(5), +(((e.clientY - b.top) / b.width)).toFixed(5)]; };
    let cur = null, erasing = null, raf = 0, lraf = 0, fingerScroll = null, lasso = null, moving = null, erSnap = false;
    /* the pointer doing the writing (others are ignored), and the fingers on the writing area: two fingers are a
       pinch, never writing (their moves used to join up into one stroke and fill the area between them) */
    let owner = null;
    const abandon = () => {
      const st = dataFor(id);
      if (cur) { cur = null; cancelAnimationFrame(lraf); lraf = 0; drawLive(cv, null); }
      if (erasing && erSnap) { st.data = JSON.parse(st.undo.pop()); erSnap = false; }
      if (moving) { st.data = JSON.parse(st.undo.pop()); moving = null; }
      if (lasso) { lasso = null; st.live = null; }
      erasing = null; owner = null; hideEraser(); paint(card); onChange(card);
    };
    const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(card); }); };
    const redrawLive = () => { if (!lraf) lraf = requestAnimationFrame(() => { lraf = 0; drawLive(cv, cur); }); };
    /* iPad: a Pencil press would otherwise start a text selection or the long-press menu on the page */
    /* (only the Pencil's touches: stopping a finger's would also stop two fingers pinch-zooming the page) */
    cv.addEventListener("touchstart", e => { if (card.classList.contains("writing") && !ctx.readOnly && [...e.changedTouches].some(t => t.touchType === "stylus")) e.preventDefault(); }, { passive: false });
    cv.addEventListener("pointerdown", e => {
      if (!card.classList.contains("writing") || ctx.readOnly) return;
      if (e.pointerType === "pen" && !penSeen) { penSeen = true; onChange(card); }
      if (e.pointerType === "touch" && fingers.size > 1) { fingerScroll = null; if (owner != null && owner !== e.pointerId) abandon(); return; }
      if (pinch || owner != null) return;
      /* with a stylus, fingers scroll the page. The browser only pinch-zooms on the writing area (touch-action:
         pinch-zoom, or iPad would scroll on the Pencil's up-and-down strokes too), so one finger's scroll is done here */
      if (penSeen && e.pointerType === "touch") {
        /* a palm (while the pen is busy, or a broad contact), or a second finger: no scrolling */
        if (palmy(e) || fingerScroll) { fingerScroll = null; return; }
        fingerScroll = { y: e.clientY, x: e.clientX, top: scrollY, left: scrollX, id: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      owner = e.pointerId;
      const st = dataFor(id), [x, y] = pos(e);
      const snap = () => snapshot(st);
      if (prefs.tool === "lasso") {
        /* inside the selection: move it; anywhere else: draw a new lasso */
        const b = st.sel && st.sel.area === area && selBox(st, area);
        if (b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) { snap(); moving = { from: [x, y], orig: st.sel.idx.map(i => st.data[area][i].p.map(q => q.slice())) }; return; }
        st.sel = null; lasso = [[x, y]]; st.live = { area, lasso }; redraw(); onChange(card); return;
      }
      if (st.sel) { st.sel = null; onChange(card); }
      /* the eraser only adds an undo step once it actually rubs something out */
      if (prefs.tool === "eraser") { erasing = [x, y]; erSnap = false; showEraser(cv, e); eraseAt(st, area, x, y, () => { if (!erSnap) { erSnap = true; snap(); } }) && redraw(); return; }
      cur = { t: prefs.tool, c: prefs.color, w: W[prefs.tool], p: [e.pointerType === "pen" && prefs.tool === "pen" ? [x, y, +(e.pressure || 0.5).toFixed(2)] : [x, y]] };
      /* not saved: whether it's still being written, and where the Pencil is about to be */
      Object.defineProperty(cur, "_live", { value: true, writable: true });
      Object.defineProperty(cur, "_pred", { value: null, writable: true });
      redrawLive();
    });
    cv.addEventListener("pointermove", e => {
      if (fingerScroll && e.pointerId === fingerScroll.id) {
        if (penBusy()) { fingerScroll = null; return; }    /* the pen came down: that "finger" was the hand */
        const slop = window.GSHPalm ? window.GSHPalm.SLOP : 10;
        if (!fingerScroll.go && Math.hypot(e.clientX - fingerScroll.x, e.clientY - fingerScroll.y) < slop) return;
        fingerScroll.go = true;
        window.scrollTo(fingerScroll.left, fingerScroll.top - (e.clientY - fingerScroll.y)); return;
      }
      if (e.pointerType === "touch" && penSeen) return;    /* other touches (a palm) never draw once a pen is in use */
      if (owner != null && e.pointerId !== owner) return;
      if (pinch && e.pointerType === "touch" && owner != null) { abandon(); return; }   /* a second finger came down elsewhere */
      const st = dataFor(id);
      if (prefs.tool === "eraser" && card.classList.contains("writing") && !(penSeen && e.pointerType === "touch")) showEraser(cv, e);
      if (erasing) {
        /* every point along the way, so a quick sweep doesn't skip any writing */
        const [x, y] = pos(e), [x0, y0] = erasing, step = prefs.esize / 3, n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / step));
        const before = () => { if (!erSnap) { erSnap = true; snapshot(st); } };
        let hit = false; for (let k = 1; k <= n; k++) hit = eraseAt(st, area, x0 + (x - x0) * k / n, y0 + (y - y0) * k / n, before) || hit;
        erasing = [x, y]; if (hit) redraw(); return;
      }
      if (lasso) { const [x, y] = pos(e), l = lasso[lasso.length - 1]; if (Math.hypot(x - l[0], y - l[1]) > 0.003) { lasso.push([x, y]); redraw(); } return; }
      if (moving) {
        const [x, y] = pos(e), dx = x - moving.from[0], dy = y - moving.from[1];
        st.sel.idx.forEach((i, k) => { st.data[area][i].p = moving.orig[k].map(q => [+(q[0] + dx).toFixed(5), +(q[1] + dy).toFixed(5), ...q.slice(2)]); });
        redraw(); return;
      }
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
      /* draw a little ahead, where the browser predicts the Pencil is going, so the ink keeps up with the tip */
      if (withP && e.getPredictedEvents) { const last = cur.p[cur.p.length - 1]; cur._pred = e.getPredictedEvents().slice(0, 3).map(ev => [...pos(ev), last[2]]); }
      redrawLive();
    });
    const end = e => {
      if (fingerScroll && e && e.pointerId === fingerScroll.id) { fingerScroll = null; return; }
      if (e && owner != null && e.pointerId !== owner) return;
      /* the browser took over a finger (a pinch, a scroll): drop what it was writing rather than keep a stray line */
      if (e && e.type === "pointercancel" && e.pointerType === "touch") { abandon(); return; }
      owner = null;
      const st = dataFor(id);
      if (e && e.pointerType !== "mouse") hideEraser();
      if (erasing) { erasing = null; if (erSnap) { save(id); onChange(card); } return; }
      if (lasso) {
        /* what the loop goes round: strokes with at least half their points inside it */
        const idx = lasso.length > 3 ? st.data[area].map((it, i) => [it, i]).filter(([it]) => it.p && it.p.filter(q => inPoly(q, lasso)).length >= it.p.length / 2).map(([, i]) => i) : [];
        st.sel = idx.length ? { area, idx } : null; lasso = null; st.live = null;
        redraw(); onChange(card); return;
      }
      if (moving) { moving = null; save(id); onChange(card); return; }
      if (!cur) return;
      /* finish exactly where the Pencil lifted (the steadying holds the line back a little) */
      if (cur.p[0].length > 2 && e && e.type === "pointerup" && e.clientX != null) {
        const [x, y] = pos(e), last = cur.p[cur.p.length - 1];
        if (Math.hypot(x - last[0], y - last[1]) > 0.3 / cv.clientWidth) cur.p.push([x, y, last[2]]);
      }
      cur._live = false; cur._pred = null; st.live = null;
      cancelAnimationFrame(lraf); lraf = 0; drawLive(cv, null);
      snapshot(st);
      /* a quick scribble over writing rubs it out, like on paper */
      const gone = cur.t === "pen" ? scribbled(st.data[area], cur) : [];
      if (gone.length) st.data[area] = st.data[area].filter((_, i) => !gone.includes(i)); else st.data[area].push(cur);
      cur = null; redraw(); save(id); onChange(card);
      if (gone.length) hint(card, "Scribbled out · Undo brings it back");
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    /* a mouse, or a Pencil hovering (newer iPads), moving off the writing */
    cv.addEventListener("pointerleave", e => { if (e.pointerType !== "touch" && !erasing) hideEraser(); });
  }
  /* fingers on the screen, anywhere on the page: once two are down it's a pinch until they've all lifted */
  const fingers = new Set(); let pinch = false;
  document.addEventListener("pointerdown", e => { if (e.pointerType === "touch") { fingers.add(e.pointerId); if (fingers.size > 1) pinch = true; } }, true);
  const lift = e => { if (e.pointerType === "touch") { fingers.delete(e.pointerId); if (!fingers.size) pinch = false; } };
  window.addEventListener("pointerup", lift, true); window.addEventListener("pointercancel", lift, true);

  /* undo and redo: whole copies of the question's writing */
  function snapshot(st) { st.undo.push(JSON.stringify(st.data)); if (st.undo.length > 60) st.undo.shift(); st.redo = []; }
  function step(card, back) {
    const id = card.dataset.qbCard, st = dataFor(id), from = back ? st.undo : st.redo, to = back ? st.redo : st.undo;
    if (!from.length) return;
    to.push(JSON.stringify(st.data)); st.data = JSON.parse(from.pop()); st.sel = null;
    paint(card); save(id); onChange(card);
  }
  /* rub out just what's under the circle: a stroke it crosses is split, leaving the parts either side */
  function eraseAt(st, area, x, y, before) {
    const r = prefs.esize / 2; let changed = false; const out = [];
    for (const it of st.data[area]) {
      const lim = r + (it.w || 0) / 2, lim2 = lim * lim, p = it.p || [];
      const inside = q => (q[0] - x) ** 2 + (q[1] - y) ** 2 < lim2;
      const crosses = (a, b) => {   /* the line between two points passes under the circle */
        const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; if (!L) return false;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
        return (a[0] + t * dx - x) ** 2 + (a[1] + t * dy - y) ** 2 < lim2;
      };
      if (!p.some((q, k) => inside(q) || (k && crosses(p[k - 1], q)))) { out.push(it); continue; }
      changed = true;
      let run = [];
      const cut = () => { if (run.length >= 2) out.push({ t: it.t, c: it.c, w: it.w, p: run }); run = []; };
      p.forEach((q, k) => { if (inside(q)) cut(); else { if (run.length && crosses(p[k - 1], q)) cut(); run.push(q); } });
      cut();
    }
    if (changed) { before?.(); st.data[area] = out; }
    return changed;
  }
  const inPoly = ([x, y], poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  /* a scribble: lots of back-and-forth in a small area. Returns the strokes it covers (none if it isn't one). */
  function scribbled(items, s) {
    const p = s.p; if (p.length < 14 || !items.length) return [];
    let len = 0, rx = 0, ry = 0, sx = 0, sy = 0, b = [Infinity, Infinity, -Infinity, -Infinity];
    for (let k = 0; k < p.length; k++) {
      const [x, y] = p[k]; b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
      if (!k) continue;
      const dx = x - p[k - 1][0], dy = y - p[k - 1][1]; len += Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.0015) { const v = Math.sign(dx); if (sx && v !== sx) rx++; sx = v; }
      if (Math.abs(dy) > 0.0015) { const v = Math.sign(dy); if (sy && v !== sy) ry++; sy = v; }
    }
    const diag = Math.hypot(b[2] - b[0], b[3] - b[1]);
    /* back and forth (or a tight zigzag): many turns, and far more ink than the area it covers */
    if (Math.max(rx, ry) < 6 || len < diag * 2.5) return [];
    /* rubs out strokes it touches that lie mostly under it, so crossing the end of a long line doesn't take the whole line */
    const pad = 0.012, inBox = ([x, y]) => x >= b[0] - pad && x <= b[2] + pad && y >= b[1] - pad && y <= b[3] + pad;
    const touches = (it, d) => it.p.some(([x, y]) => inBox([x, y]) && p.some(q => (q[0] - x) ** 2 + (q[1] - y) ** 2 < d * d));
    return items.map((it, i) => it.p && it.p.filter(inBox).length >= it.p.length * 0.5 && touches(it, Math.max((it.w || 0) / 2 + 0.008, 0.012)) ? i : -1).filter(i => i >= 0);
  }
  function hint(card, msg) {
    const h = card.querySelector(".qb-ihint"); if (!h) return;
    h.textContent = msg; h.classList.add("flash"); clearTimeout(h._t);
    h._t = setTimeout(() => { if (h.isConnected) onChange(card); }, 2500);
  }

  /* ---------- the toolbar on a card being written on ---------- */
  function toolbar(card) {
    const id = card.dataset.qbCard, st = dataFor(id), dark = siteDark();
    return `<div class="qb-inkbar" role="toolbar" aria-label="Writing tools">
      ${["pen", "highlighter", "eraser", "lasso"].map(t => `<button type="button" class="qb-ibtn ${prefs.tool === t ? "on" : ""}" data-ink-tool="${t}" title="${{ pen: "Pen · scribble over writing to rub it out", highlighter: "Highlighter", eraser: "Eraser", lasso: "Lasso · circle writing to move, recolour or delete it" }[t]}" aria-label="${t}" aria-pressed="${prefs.tool === t}">${svg(t)}</button>`).join("")}
      ${prefs.tool === "eraser" ? `<span class="qb-esizes" role="group" aria-label="Eraser size">${ESIZES.map(([name, v], k) => `<button type="button" class="qb-esize ${prefs.esize === v ? "on" : ""}" data-ink-esize="${v}" title="${name}" aria-label="${name}" aria-pressed="${prefs.esize === v}"><i style="--d:${[8, 13, 20][k]}px"></i></button>`).join("")}</span>` : ""}
      ${st.sel ? `<button type="button" class="qb-itext qb-idel" data-ink-delsel>${svg("trash")}Delete</button>` : ""}
      <span class="qb-isep"></span>
      ${COLORS.map(c => `<button type="button" class="qb-icol ${prefs.color === c ? "on" : ""}" data-ink-color="${c}" title="${esc(c === "ink" ? (dark ? "White" : "Black") : window.Viewer.Ink.PALETTE[c].name)}" aria-label="${esc(c === "ink" ? (dark ? "White" : "Black") : window.Viewer.Ink.PALETTE[c].name)}" aria-pressed="${prefs.color === c}"><i style="background:${window.Viewer.Ink.colorOf(c, dark)}"></i></button>`).join("")}
      <span class="qb-isep"></span>
      <button type="button" class="qb-ibtn" data-ink-undo title="Undo (⌘Z)" aria-label="Undo" ${st.undo.length ? "" : "disabled"}>${svg("undo")}</button>
      <button type="button" class="qb-ibtn" data-ink-redo title="Redo (⇧⌘Z)" aria-label="Redo" ${st.redo.length ? "" : "disabled"}>${svg("redo")}</button>
      ${st.data.n ? "" : `<button type="button" class="qb-itext" data-ink-more>+ Writing space</button>`}
      <button type="button" class="qb-itext" data-ink-clear ${has(st.data) ? "" : "disabled"}>Clear</button>
      <span class="qb-ihint">${st.sel ? "Drag the box to move it · tap a colour to recolour it" : prefs.tool === "lasso" ? "Draw a loop round writing to select it" : (ctx.sync ? "Saves to your account" : "Saves in this browser") + (penSeen ? " · stylus writes, finger scrolls" : "")}</span>
      <button type="button" class="qb-btn primary qb-idone" data-ink-done>Done</button>
    </div>`;
  }
  function onChange(card) {
    /* the toolbar can change height (eraser sizes, the lasso's Delete): keep the writing where it is on screen */
    const bar = card.querySelector(".qb-inkbar"), wrap = card.querySelector(".qb-inkwrap"), t0 = bar && wrap ? wrap.getBoundingClientRect().top : 0;
    if (bar) { bar.outerHTML = toolbar(card); const d = wrap.getBoundingClientRect().top - t0; if (Math.abs(d) >= 1) window.scrollBy(0, d); }
    const d = dataFor(card.dataset.qbCard).data, on = card.classList.contains("writing");
    card.querySelectorAll("[data-qb-write]").forEach(b => { b.textContent = on ? "✓ Done writing" : has(d) ? "✎ Edit writing" : "✎ Write"; b.setAttribute("aria-pressed", on); });
    const bot = card.querySelector(".qb-xbot");
    if (bot) bot.innerHTML = `<button type="button" class="qb-btn qb-more" data-ink-more>+ More space</button>${d.n ? `<button type="button" class="qb-itext" data-ink-less>Less space</button>` : ""}`;
  }
  function setWriting(card, on) {
    card.classList.toggle("writing", on);
    if (!on) { dataFor(card.dataset.qbCard).sel = null; hideEraser(); }
    card.querySelector(".qb-inkbar")?.remove();
    if (on) card.querySelector(".qb-inkwrap").insertAdjacentHTML("beforebegin", toolbar(card));
    paint(card); onChange(card);
  }

  /* no text selection from a fast stroke while a card is being written on (as in the paper viewer) */
  document.addEventListener("selectstart", e => {
    const t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (t?.closest?.(".qb-card.writing")) e.preventDefault();
  });
  document.addEventListener("click", e => {
    /* tapping the writing space starts writing there */
    const sp = e.target.closest(".qb-card:not(.writing) .qb-xspace");
    if (sp && !ctx.readOnly) { setWriting(sp.closest("[data-qb-card]"), true); return; }
    const wb = e.target.closest("[data-qb-write]");
    if (wb) { const card = wb.closest("[data-qb-card]"); setWriting(card, !card.classList.contains("writing")); return; }
    /* More and Less space work whether or not the card is being written on (More starts writing) */
    const sc = !ctx.readOnly && e.target.closest("[data-ink-more], [data-ink-less]") ? e.target.closest("[data-qb-card]") : null;
    const card = sc || e.target.closest(".qb-card.writing"); if (!card) return;
    const id = card.dataset.qbCard, st = dataFor(id);
    const snap = () => snapshot(st);
    const t = e.target.closest("[data-ink-tool]");
    if (t) { prefs.tool = t.dataset.inkTool; put("gsh-cink-prefs", prefs); if (prefs.tool !== "lasso" && st.sel) { st.sel = null; paint(card); } onChange(card); return; }
    const es = e.target.closest("[data-ink-esize]"); if (es) { prefs.esize = +es.dataset.inkEsize; put("gsh-cink-prefs", prefs); onChange(card); return; }
    const c = e.target.closest("[data-ink-color]");
    if (c) {
      /* with a selection, the colour goes to what's selected; otherwise it's the pen's next colour */
      if (st.sel) { snap(); st.sel.idx.forEach(i => { const it = st.data[st.sel.area][i]; if (it) it.c = c.dataset.inkColor; }); paint(card); save(id); onChange(card); return; }
      prefs.color = c.dataset.inkColor; if (prefs.tool === "eraser" || prefs.tool === "lasso") prefs.tool = "pen"; put("gsh-cink-prefs", prefs); onChange(card); return;
    }
    if (e.target.closest("[data-ink-delsel]") && st.sel) { snap(); const { area, idx } = st.sel; st.data[area] = st.data[area].filter((_, i) => !idx.includes(i)); st.sel = null; paint(card); save(id); onChange(card); return; }
    if (e.target.closest("[data-ink-undo]")) { step(card, true); return; }
    if (e.target.closest("[data-ink-redo]")) { step(card, false); return; }
    if (e.target.closest("[data-ink-more]")) {
      snap(); st.data.n = Math.min(12, st.data.n + 1);
      if (!card.classList.contains("writing")) setWriting(card, true); else { paint(card); onChange(card); }
      save(id); card.querySelector(".qb-xbot")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); return;
    }
    if (e.target.closest("[data-ink-less]")) {
      snap(); st.sel = null; st.data.n = Math.max(0, st.data.n - 1);
      const lim = st.data.n * BLOCK; st.data.x = st.data.x.filter(it => (it.p || []).every(([, y]) => y <= lim));   /* writing in the removed block goes too (Undo brings it back) */
      paint(card); save(id); onChange(card); return;
    }
    if (e.target.closest("[data-ink-clear]")) { snap(); st.sel = null; st.data = { s: [], x: [], n: 0 }; paint(card); save(id); onChange(card); return; }
    if (e.target.closest("[data-ink-done]")) { setWriting(card, false); return; }
  });

  /* ⌘Z / Ctrl+Z undoes on the card being written on, ⇧⌘Z / Ctrl+Y redoes (not while typing, or in the paper viewer) */
  document.addEventListener("keydown", e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || window.Viewer?.isOpen?.()) return;
    const k = e.key.toLowerCase(); if (k !== "z" && k !== "y") return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const card = document.querySelector(".qb-card.writing"); if (!card || ctx.readOnly) return;
    e.preventDefault(); step(card, k === "z" && !e.shiftKey);
  });

  /* app.js: after drawing cards. sync(id, data) saves set work to the account; preset gives writing to show
     (a student's saved set work, or the student a teacher is reviewing); readOnly for that review. */
  const ro = new ResizeObserver(es => es.forEach(e => { const card = e.target.closest("[data-qb-card]"); if (card) paint(card); }));
  window.CardInk = {
    setContext(c) {
      /* a different set of writing (this browser's, a piece of set work, a student under review): start afresh */
      if (c.key !== ctx.key) for (const k in state) delete state[k];
      ctx = { key: c.key, sync: c.sync || null, readOnly: !!c.readOnly, preset: c.preset || null, space: !!c.space };
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
    /* a new quiz starts with clean cards */
    resetQuiz(ids) {
      for (const id of ids) { try { localStorage.removeItem(`gsh-cink:quiz:${id}`); } catch (e) {} if (ctx.key === "quiz") delete state[id]; }
    },
    button: id => ctx.readOnly ? "" : `<button type="button" class="qb-btn qb-write" data-qb-write="${esc(id)}" aria-pressed="false">✎ Write</button>`,
    repaintAll() { document.querySelectorAll("[data-qb-card]").forEach(paint); },
    flush,
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => window.CardInk.repaintAll());
  new MutationObserver(() => window.CardInk.repaintAll()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
