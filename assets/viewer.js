/* Pop-up PDF viewer: page controls, bookmarks, search, annotate (pen, highlighter,
   text, eraser, undo/redo), zoom, mark scheme side by side, autosave, annotated download. */
(() => {
  /* Bundled libraries (pdf.js 6.2.108 Apache-2.0, pdf-lib 1.17.1 MIT), served from this site. */
  const PDFJS = "/assets/vendor/pdf.min.mjs";
  const COMPAT = "/assets/vendor/pdf-compat.mjs";            /* fills in new built-ins older browsers (Safari 17) lack */
  const WORKER = "/assets/vendor/pdf.worker.compat.mjs";     /* compat + pdf.worker.min.mjs */
  const PDFLIB = "/assets/vendor/pdf-lib.min.js";

  const scripts = {};
  const loadScript = src => scripts[src] ||= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error("Couldn't load " + src)); document.head.appendChild(s);
  });
  let lib = null;
  async function pdfjs() {
    if (lib) return lib;
    await import(COMPAT);
    lib = await import(PDFJS);
    lib.GlobalWorkerOptions.workerSrc = WORKER;
    return lib;
  }
  /* One PDF worker for the whole site. Without it pdf.js starts a new worker (a whole copy of its engine on
     another thread) for every PDF opened; the question bank opens many, and iPads ran out of memory. */
  let sharedWorker = null;
  const worker = L => {
    if (!sharedWorker || sharedWorker.destroyed) sharedWorker = new L.PDFWorker();
    return sharedWorker;
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  /* Pen colours: chalk white, pale yellow and mint green (from the house notes style).
     Each has a version for dark pages (true chalk colour) and a deeper one so it reads on white paper. */
  const PALETTE = {
    green:  { name: "Green",  dark: "#6ee7af", light: "#11905d" },
    coral:  { name: "Coral",  dark: "#f19d90", light: "#d2533c" },
    yellow: { name: "Yellow", dark: "#e0e582", light: "#9a8a00" },
    purple: { name: "Purple", dark: "#c3a4e6", light: "#7a4fd0" },
    ink:    { name: "White",  dark: "#f3f3ef", light: "#1b1f1e" },
  };
  const LEGACY = { red: "#d93025", blue: "#1a64d6" };
  const colorOf = (c, dark) => PALETTE[c] ? PALETTE[c][dark ? "dark" : "light"] : (LEGACY[c] || (/^#[0-9a-f]{6}$/i.test(c || "") ? c : PALETTE.ink[dark ? "dark" : "light"]));
  const RECENT_KEY = "gsh-pv-colors";
  const WIDTH = { pen: 0.0025, highlighter: 0.016 };
  /* thickness choices (times the normal width), remembered separately for the pen and the highlighter */
  const SIZES = [[0.6, "Thin"], [1, "Medium"], [1.6, "Thick"], [2.4, "Extra thick"]];
  const SIZE_KEY = "gsh-pen-size", SIZE_DOT = [3, 5, 8, 12];
  const TEXT_SIZE = 0.02;

  /* ---------- Bookmarks (shared with the sidebar) ---------- */
  const BM_KEY = "gsh-bookmarks";
  const Bookmarks = {
    all() { return store.get(BM_KEY) || []; },
    has(src, page) { return this.all().some(b => b.src === src && b.page === page); },
    toggle(info, page) {
      let list = this.all();
      if (this.has(info.src, page)) list = list.filter(b => !(b.src === info.src && b.page === page));
      else list.unshift({ src: info.src, title: info.title, desc: info.desc || "", ms: info.ms || "", page, at: Date.now() });
      store.set(BM_KEY, list.slice(0, 50));
      window.dispatchEvent(new Event("gsh-bookmarks"));
    },
    remove(src, page) {
      store.set(BM_KEY, this.all().filter(b => !(b.src === src && b.page === page)));
      window.dispatchEvent(new Event("gsh-bookmarks"));
    },
  };

  /* Apple Pencil stroke, drawn the way note-taking apps do: one solid shape whose width flows with pressure.
     The Pencil's points are first joined by a smooth curve and sampled densely; each short step between two
     samples is the hull of two circles (radius from pressure). All the hulls go in one path and are filled once,
     so the ink is a single union: smooth edges, no seams, specks or width steps, and round joins at any angle.
     Ends taper over a set length, so the stroke looks the same however fast it was written.
     pts: [[x, y, pressure], ...] in CSS pixels; width: the stroke's normal width; live: still being written */
  function inkGeom(pts, width, live = false) {
    const n = pts.length;
    const pr = pts.map((q, k) => (pts[Math.max(0, k - 1)][2] + 2 * q[2] + pts[Math.min(n - 1, k + 1)][2]) / 4);
    /* 1. dense samples along the curve through the midpoints of the points; starts[k] = first sample of piece k */
    const d = [], starts = [];
    const add = (x, y, p) => { const l = d[d.length - 1]; if (!l || Math.hypot(x - l[0], y - l[1]) > 0.25) d.push([x, y, p]); };
    const seg = (x0, y0, cx, cy, x1, y1, p0, p1) => {
      starts.push(d.length);
      const len = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy), m = Math.max(1, Math.ceil(len / 1.2));
      for (let i = 1; i <= m; i++) {
        const t = i / m, u = 1 - t;
        add(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1, p0 + (p1 - p0) * t);
      }
    };
    add(pts[0][0], pts[0][1], pr[0]);
    if (n === 2) seg(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, pts[1][0], pts[1][1], pr[0], pr[1]);
    else if (n > 2) {
      const mx = k => (pts[k][0] + pts[k + 1][0]) / 2, my = k => (pts[k][1] + pts[k + 1][1]) / 2, mp = k => (pr[k] + pr[k + 1]) / 2;
      seg(pts[0][0], pts[0][1], (pts[0][0] + mx(0)) / 2, (pts[0][1] + my(0)) / 2, mx(0), my(0), pr[0], mp(0));
      for (let k = 1; k < n - 1; k++) seg(mx(k - 1), my(k - 1), pts[k][0], pts[k][1], mx(k), my(k), mp(k - 1), mp(k));
      seg(mx(n - 2), my(n - 2), (mx(n - 2) + pts[n - 1][0]) / 2, (my(n - 2) + pts[n - 1][1]) / 2, pts[n - 1][0], pts[n - 1][1], mp(n - 2), pr[n - 1]);
    }
    /* 2. radius at each sample: pressure (gentle curve), with tapered ends measured by length */
    const dist = [0]; for (let i = 1; i < d.length; i++) dist.push(dist[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
    const total = dist[dist.length - 1], tIn = width * 3, tOut = width * 2.5;
    /* dots and very short marks keep their full size; tapering grows in as the stroke gets longer.
       While writing, the start taper uses a fixed length so finished parts of the stroke never change. */
    const tw = live ? 1 : Math.max(0, Math.min(1, (total - width) / (width * 4)));
    const rad = d.map((q, i) => {
      let r = width / 2 * (0.5 + 0.95 * Math.pow(Math.max(0, Math.min(1, q[2])), 0.85));
      r *= 1 - tw * (1 - Math.min(1, 0.5 + 0.5 * dist[i] / tIn));
      if (!live) r *= 1 - tw * (1 - Math.min(1, 0.45 + 0.55 * (total - dist[i]) / tOut));
      return Math.max(0.3, r);
    });
    return { d, rad, starts };
  }
  /* 3. hulls i0..i1-1 (hull i joins samples i-1 and i) added to the current path, all wound the same way */
  function inkHulls(ctx, g, i0, i1) {
    const { d, rad } = g;
    if (d.length === 1 && i0 <= 0) { ctx.moveTo(d[0][0] + rad[0], d[0][1]); ctx.arc(d[0][0], d[0][1], rad[0], 0, Math.PI * 2); return; }
    for (let i = Math.max(1, i0); i < i1; i++) {
      const [ax, ay] = d[i - 1], [bx, by] = d[i], ra = rad[i - 1], rb = rad[i];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (L <= Math.abs(ra - rb) + 1e-6) {   /* one circle holds the other */
        const [cx, cy, r] = ra > rb ? [ax, ay, ra] : [bx, by, rb];
        ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); continue;
      }
      const th = Math.atan2(dy, dx), ph = Math.asin((ra - rb) / L), H = Math.PI / 2;
      ctx.moveTo(ax + ra * Math.cos(th + H + ph), ay + ra * Math.sin(th + H + ph));
      ctx.arc(ax, ay, ra, th + H + ph, th + 3 * H - ph);
      ctx.arc(bx, by, rb, th + 3 * H - ph, th + 5 * H + ph);
      ctx.closePath();
    }
  }
  function drawPressure(ctx, pts, width, live = false) {
    if (!pts.length) return;
    const g = inkGeom(pts, width, live);
    ctx.beginPath(); inkHulls(ctx, g, 0, g.d.length); ctx.fill("nonzero");
  }
  const LIVE = new WeakMap();   /* drawing state of the stroke being written */
  const hullBox = (g, i, m) => {   /* bounding box of hull i (samples i-1 and i) */
    const a = g.d[Math.max(0, i - 1)], b = g.d[i], r = Math.max(g.rad[Math.max(0, i - 1)], g.rad[i]) + m;
    return [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r];
  };

  /* ---------- One scrollable PDF ---------- */
  class Pane {
    constructor(el, { src, title, annotate, startPage, startY, onChange, only }) {
      Object.assign(this, { el, src, title, annotate, onChange });
      /* question view: only these page numbers are shown (notes still belong to the real page numbers) */
      this.only = only && only.length ? only : null;
      this.startPage = startPage || 1; this.startY = startY || 0;
      this.zoom = 1; this.tool = "hand"; this.drawTool = "pen"; this.color = "green"; this.dark = false;
      this.size = Object.assign({ pen: 1, highlighter: 1 }, store.get(SIZE_KEY) || {});
      this.pages = []; this.bytes = null; this.current = 1;
      this.key = "gsh-ann:" + src;
      this.ann = (annotate && store.get(this.key)) || {};
      this.undo = []; this.redo = [];
      this.matches = []; this.matchIdx = -1;
      this.cancelInk = []; this.pinching = false;
      /* only pages near the screen keep their canvases; the rest are released so long papers
         don't run the iPad out of memory */
      this.observer = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? this.renderPage(e.target._i) : this.release(e.target._i)), { root: el, rootMargin: "900px 0px" });
      el.addEventListener("scroll", () => {
        const c = this.currentPage(); if (c !== this.current) { this.current = c; this.onChange?.(); }
      }, { passive: true });
      this.load();
    }

    status(html) { this.el.innerHTML = `<div class="vw-status">${html}</div>`; }

    async load() {
      this.status(`<div class="vw-spin"></div><p>Opening ${esc(this.title)}…</p>`);
      let L;
      try { L = await pdfjs(); } catch (e) { this.status(`<p>The viewer couldn't start. Check your connection and try again.</p>`); return; }
      try {
        const r = await fetch(this.src, { mode: "cors" });
        if (!r.ok) throw new Error(r.status);
        await this.open(L, await r.arrayBuffer());
      } catch (e) { this.fallback(L); }
    }

    fallback(L) {
      this.status(`<p class="vw-big">This paper's website doesn't let it open here directly.</p>
        <p>Download it, then open the file here. Your notes will save to this paper.</p>
        <div class="vw-actions">
          <a class="vw-btn primary" href="${esc(this.src)}" target="_blank" rel="noopener">1. Download the paper ↗</a>
          <label class="vw-btn">2. Open the downloaded file<input type="file" accept="application/pdf" hidden></label>
        </div>
        <p class="vw-hint">You can also drag the PDF onto this area.</p>`);
      const take = async f => { if (f) await this.open(L, await f.arrayBuffer()); };
      this.el.querySelector("input").onchange = e => take(e.target.files[0]);
      this.el.ondragover = e => { e.preventDefault(); this.el.classList.add("drop"); };
      this.el.ondragleave = () => this.el.classList.remove("drop");
      this.el.ondrop = e => { e.preventDefault(); this.el.classList.remove("drop"); take([...e.dataTransfer.files].find(f => f.type === "application/pdf")); };
    }

    async open(L, buf) {
      this.el.ondragover = this.el.ondrop = this.el.ondragleave = null;
      this.L = L;
      if (!this.doc) {
        this.bytes = buf.slice(0);
        try { this.doc = await L.getDocument({ data: new Uint8Array(buf), worker: worker(L) }).promise; }
        catch (e) { this.status(`<p>That file isn't a readable PDF.</p>`); return; }
      }
      const only = this.only && new Set(this.only.filter(n => n >= 1 && n <= this.doc.numPages));
      if (only && !only.size) this.only = null;
      this.pages = [];
      for (let i = 1; i <= this.doc.numPages; i++) {
        if (this.only && !only.has(i)) { this.pages.push({ hidden: true }); continue; }
        const page = await this.doc.getPage(i);
        this.pages.push({ page, base: page.getViewport({ scale: 1 }) });
      }
      this.el.innerHTML = `<div class="vw-pages"></div>`;
      this.wrap = this.el.firstChild;
      if (this._bound) { this.finishOpen(); return; }
      this._bound = true;
      this.bindPinch();
      /* iPad Safari waits after each Pencil lift to see if it is a double-tap or Scribble handwriting,
         which swallows the start of a quick next stroke. Claiming Pencil touches while a writing tool
         is on stops that wait, so strokes can follow each other immediately. */
      const pencil = e => this.tool !== "hand" && this.tool !== "text" && [...e.changedTouches].some(t => t.touchType === "stylus");
      for (const type of ["touchstart", "touchmove", "touchend"])
        this.el.addEventListener(type, e => { if (pencil(e) && e.cancelable) e.preventDefault(); }, { passive: false });
      this.finishOpen();
    }
    finishOpen() {
      this.pages.forEach((p, i) => {
        if (p.hidden) return;
        const pg = document.createElement("div"); pg.className = "pg"; pg._i = i;
        pg.innerHTML = `<canvas class="pdf"></canvas><div class="hl"></div><canvas class="live"></canvas><canvas class="ink"></canvas>`;
        this.wrap.appendChild(pg); p.el = pg; p.pdf = pg.children[0]; p.hl = pg.children[1]; p.live = pg.children[2]; p.ink = pg.children[3];
        if (this.annotate) this.bindInk(p, i);
        this.observer.observe(pg);
      });
      this.layout();
      this.setTool(this.tool);
      if (this.startPage > 1 || this.startY) this.scrollToPos({ page: this.startPage, y: this.startY });
      this.onChange?.();
    }

    /* question view → whole paper, staying on the same page */
    showAll() {
      if (!this.only || !this.doc) return;
      this.commitText(); this.flush();
      const pos = this.scrollPos();
      this.observer.disconnect();
      this.pages.forEach((p, i) => this.release(i));
      this.only = null; this.index = null; this.startPage = pos.page; this.startY = pos.y;
      this.open(this.L, null);
    }
    /* shown pages (all of them, or the question's) as 0-based indexes */
    shown() { const r = []; this.pages.forEach((p, i) => { if (!p.hidden) r.push(i); }); return r; }
    hasPrev() { return this.shown().some(i => i + 1 < this.current); }
    hasNext() { return this.shown().some(i => i + 1 > this.current); }

    fitWidth() { return Math.min(this.el.clientWidth - 32, 920); }

    layout() {
      if (!this.pages.length) return;
      const keep = this.scrollPos();
      const w = Math.max(240, this.fitWidth() * this.zoom);
      this.pages.forEach((p, i) => {
        if (p.hidden) return;
        const h = w * p.base.height / p.base.width;
        this.release(i);
        p.w = w; p.h = h;
        p.el.style.width = w + "px"; p.el.style.height = h + "px";
        for (const c of [p.pdf, p.ink, p.live]) { c.style.width = w + "px"; c.style.height = h + "px"; }
      });
      this.scrollToPos(keep);
      const R = this.el.getBoundingClientRect();
      this.pages.forEach((p, i) => { if (p.hidden) return; const r = p.el.getBoundingClientRect(); if (r.bottom > R.top - 900 && r.top < R.bottom + 900) this.renderPage(i); });
    }

    /* pixels per CSS pixel for a page: sharp on Retina, but capped so a zoomed page stays within iPad canvas limits */
    density(p) { return Math.min(window.devicePixelRatio || 1, Math.sqrt(10e6 / (p.w * p.h))); }
    alloc(p, i) {
      if (p.px) return;
      p.px = this.density(p);
      p.pdf.width = Math.round(p.w * p.px); p.pdf.height = Math.round(p.h * p.px);
      this.drawInk(p, i);
    }
    /* the ink layer only takes memory on pages that have notes (or are being written on) */
    inkCtx(p) {
      const W = Math.round(p.w * p.px), H = Math.round(p.h * p.px), c = p.ink;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const ctx = c.getContext("2d"); ctx.setTransform(p.px, 0, 0, p.px, 0, 0); return ctx;
    }
    release(i) {
      const p = this.pages[i]; if (!p || p.hidden) return;
      if (p.task) { try { p.task.cancel(); } catch (e) {} p.task = null; }
      for (const c of [p.pdf, p.ink, p.live]) { c.width = 0; c.height = 0; }
      p.px = 0; p.rendered = false; p.rendering = false;
    }
    destroy() {
      this.observer.disconnect();
      this.pages.forEach((p, i) => this.release(i));
      try { this.doc?.destroy(); } catch (e) {}
      this.pages = []; this.doc = null;
    }

    async renderPage(i) {
      const p = this.pages[i]; if (!p || p.hidden) return;
      this.alloc(p, i);
      if (p.rendered || p.rendering) return;
      p.rendering = true;
      const task = p.page.render({ canvasContext: p.pdf.getContext("2d"), viewport: p.page.getViewport({ scale: (p.w / p.base.width) * p.px }) });
      p.task = task;
      try { await task.promise; if (p.task === task) p.rendered = true; }
      catch (e) {}
      if (p.task === task) { p.task = null; p.rendering = false; }
    }

    /* ----- pages ----- */
    currentPage() {
      if (!this.pages.length) return 1;
      const mark = this.el.scrollTop + this.el.clientHeight * 0.35;
      const sh = this.shown(); let n = (sh[0] ?? 0) + 1;
      for (const i of sh) if (this.top(this.pages[i]) <= mark) n = i + 1;
      return n;
    }
    /* a page's distance from the top of the scrolling area (offsetTop can be measured from an outer box) */
    top(p) { return this.wrap ? p.el.offsetTop - this.wrap.offsetTop : p.el.offsetTop; }
    /* where the reader is: page number and how far down it (0–1), so resizing or zooming keeps the place */
    scrollPos() {
      const top = this.el.scrollTop + 12;
      const sh = this.shown(); let k = sh[0] ?? 0;
      for (const i of sh) if (this.top(this.pages[i]) <= top) k = i;
      const p = this.pages[k];
      return { page: k + 1, y: p.h ? Math.max(0, (top - this.top(p)) / p.h) : 0 };
    }
    /* the shown page nearest to page number n (in direction dir if it's hidden) */
    nearest(n, dir = 0) {
      const sh = this.shown(); if (!sh.length) return null;
      n = Math.min(Math.max(n, 1), this.pages.length);
      if (!this.pages[n - 1].hidden) return this.pages[n - 1];
      const after = sh.find(i => i + 1 > n), before = [...sh].reverse().find(i => i + 1 < n);
      const k = dir > 0 ? after : dir < 0 ? before : (after ?? before);
      return k == null ? null : this.pages[k];
    }
    scrollToPos({ page, y = 0 }) {
      const p = this.nearest(page); if (!p) return;
      this.el.scrollTop = this.top(p) - 12 + y * (p.h || 0);
      this.current = this.currentPage(); this.onChange?.();
    }
    goToPage(n, smooth = true) {
      const p = this.nearest(n, Math.sign(n - this.current)); if (!p) return;
      this.el.scrollTo({ top: this.top(p) - 12, behavior: smooth ? "smooth" : "auto" });
      this.current = this.pages.indexOf(p) + 1; this.onChange?.();
    }

    setZoom(z, at) {
      z = Math.min(3, Math.max(0.5, z));
      /* keep the spot under the fingers (or the screen centre) in place */
      const R = this.el.getBoundingClientRect();
      const cx = at ? at.x : R.left + R.width / 2, cy = at ? at.y : R.top + R.height / 2;
      let anchor = null;
      for (const p of this.pages) {
        if (p.hidden) continue;
        const r = p.el?.getBoundingClientRect(); if (!r) continue;
        if (cy <= r.bottom + 8 || p === this.pages[this.pages.length - 1]) { anchor = { p, fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height }; break; }
      }
      this.zoom = z; this.layout(); this.paintMatches();
      if (anchor) {
        const r = anchor.p.el.getBoundingClientRect();
        this.el.scrollLeft += r.left + anchor.fx * r.width - cx;
        this.el.scrollTop += r.top + anchor.fy * r.height - cy;
        this.current = this.currentPage();
      }
      this.onChange?.();
    }

    /* two-finger pinch to zoom (and trackpad pinch / Ctrl + scroll) */
    bindPinch() {
      const el = this.el;
      let g = null;
      const mid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
      const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
      el.addEventListener("touchstart", e => {
        if (e.touches.length !== 2 || !this.wrap) return;
        e.preventDefault();
        this.pinching = true; this.cancelInk.forEach(f => f());
        const m = mid(e.touches), w = this.wrap.getBoundingClientRect();
        g = { d: dist(e.touches), m, s: 1, ox: m.x - w.left, oy: m.y - w.top };
        this.wrap.style.transformOrigin = `${g.ox}px ${g.oy}px`;
        this.wrap.style.willChange = "transform";
      }, { passive: false });
      el.addEventListener("touchmove", e => {
        if (!g || e.touches.length < 2) return;
        e.preventDefault();
        const m = mid(e.touches);
        g.s = Math.min(3 / this.zoom, Math.max(0.5 / this.zoom, dist(e.touches) / g.d));
        g.at = m;
        this.wrap.style.transform = `translate(${m.x - g.m.x}px, ${m.y - g.m.y}px) scale(${g.s})`;
      }, { passive: false });
      const finish = e => {
        if (!g || (e.touches && e.touches.length >= 2)) return;
        const { s, m, at } = g; g = null;
        const pt = at || m;
        /* where the original focal point sits after the live pan */
        this.wrap.style.transform = ""; this.wrap.style.willChange = "";
        if (Math.abs(s - 1) > 0.02) {
          this.el.scrollLeft -= pt.x - m.x; this.el.scrollTop -= pt.y - m.y;
          this.setZoom(this.zoom * s, pt);
        } else { this.el.scrollLeft -= pt.x - m.x; this.el.scrollTop -= pt.y - m.y; }
        setTimeout(() => { this.pinching = false; }, 60);
      };
      el.addEventListener("touchend", finish);
      el.addEventListener("touchcancel", finish);
      /* stop Safari zooming the whole page */
      el.addEventListener("gesturestart", e => e.preventDefault());
      el.addEventListener("wheel", e => {
        if (!e.ctrlKey || !this.wrap) return;
        e.preventDefault();
        clearTimeout(this.wheelT);
        this.wheelZ = (this.wheelZ || this.zoom) * Math.exp(-e.deltaY * 0.01);
        this.wheelAt = { x: e.clientX, y: e.clientY };
        this.wheelT = setTimeout(() => { this.setZoom(this.wheelZ, this.wheelAt); this.wheelZ = 0; }, 90);
      }, { passive: false });
    }

    setTool(t) {
      this.commitText();
      this.tool = t;
      if (t !== "hand") this.drawTool = t;
      this.el.dataset.tool = t;
      this.onChange?.();
    }

    /* ----- search ----- */
    async buildIndex() {
      if (this.index) return this.index;
      const L = await pdfjs();
      this.index = [];
      for (let i = 0; i < this.pages.length; i++) {
        if (this.pages[i].hidden) { this.index.push([]); continue; }   /* question view: search the question's pages */
        const { page, base } = this.pages[i];
        const tc = await page.getTextContent();
        const items = [];
        for (const it of tc.items) {
          if (!it.str || !it.str.trim()) continue;
          const tx = L.Util.transform(base.transform, it.transform);
          const fh = Math.hypot(tx[2], tx[3]) || Math.abs(it.height) || 10;
          items.push({ s: it.str.toLowerCase(), x: tx[4] / base.width, y: (tx[5] - fh) / base.height, w: (it.width || 0) / base.width, h: (fh * 1.15) / base.height });
        }
        this.index.push(items);
      }
      return this.index;
    }
    async search(q) {
      q = q.trim().toLowerCase();
      this.matches = []; this.matchIdx = -1;
      if (q && this.pages.length) {
        const idx = await this.buildIndex();
        idx.forEach((items, i) => items.forEach(it => { if (it.s.includes(q)) this.matches.push({ page: i, it }); }));
        if (this.matches.length) {
          const from = this.matches.findIndex(m => m.page + 1 >= this.current);
          this.matchIdx = from >= 0 ? from : 0;
        }
      }
      this.paintMatches(true);
      return this.matches.length;
    }
    stepMatch(d) {
      if (!this.matches.length) return;
      this.matchIdx = (this.matchIdx + d + this.matches.length) % this.matches.length;
      this.paintMatches(true);
    }
    paintMatches(scroll) {
      this.pages.forEach(p => { if (p.hl) p.hl.innerHTML = ""; });
      this.matches.forEach((m, k) => {
        const p = this.pages[m.page], d = document.createElement("i");
        if (k === this.matchIdx) d.className = "cur";
        Object.assign(d.style, { left: m.it.x * 100 + "%", top: m.it.y * 100 + "%", width: m.it.w * 100 + "%", height: m.it.h * 100 + "%" });
        p.hl.appendChild(d);
      });
      const cur = this.matches[this.matchIdx];
      if (scroll && cur) {
        const p = this.pages[cur.page];
        this.el.scrollTo({ top: this.top(p) + cur.it.y * p.h - this.el.clientHeight * 0.35, behavior: "smooth" });
      }
      this.onChange?.();
    }

    /* ----- annotation model: ann[pageIndex] = [items], coords as fractions of page size ----- */
    snapshot() { this.undo.push(JSON.stringify(this.ann)); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
    /* only copy the one page a stroke touches, so finishing a stroke stays instant */
    snapshotPage(i) { this.undo.push({ i, v: JSON.stringify(this.ann[i] || []) }); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
    swap(from, to) {
      const e = from.pop();
      if (typeof e === "object") {
        to.push({ i: e.i, v: JSON.stringify(this.ann[e.i] || []) });
        this.ann[e.i] = JSON.parse(e.v);
        if (this.pages[e.i]) this.drawInk(this.pages[e.i], e.i);
        this.onChange?.();
      } else { to.push(JSON.stringify(this.ann)); this.ann = JSON.parse(e); this.redrawAll(); }
      this.save();
    }
    doUndo() { if (!this.undo.length) return; this.commitText(); this.swap(this.undo, this.redo); }
    doRedo() { if (!this.redo.length) return; this.swap(this.redo, this.undo); }
    clearAll() { if (!this.hasNotes()) return; this.snapshot(); this.ann = {}; this.redrawAll(); this.save(); }
    hasNotes() { return Object.values(this.ann).some(a => a.length); }
    save() {
      clearTimeout(this._t);
      /* write to storage only once writing pauses, never in the middle of the next stroke */
      const later = () => { this._t = setTimeout(() => { if (this.inking) return later(); this.flush(); }, 2000); };
      this.dirty = true; later();
      this.onChange?.();
    }
    flush() {
      clearTimeout(this._t);
      if (!this.dirty || !this.annotate) return;
      this.dirty = false; this.saved = store.set(this.key, this.ann); this.onChange?.();
    }
    redrawAll() { this.pages.forEach((p, i) => this.drawInk(p, i)); this.onChange?.(); }
    setDark(on) {
      this.dark = on; this.redrawAll();
      if (this.editing) this.editing.ta.style.color = colorOf(this.editing.it.c, on);
    }

    drawItems(ctx, items, w, h, dark = this.dark) {
      for (const it of items || []) {
        if (it.t === "text") {
          ctx.globalAlpha = 1; ctx.fillStyle = colorOf(it.c, dark);
          const size = it.s * w; ctx.font = `500 ${size}px Geist, system-ui, sans-serif`; ctx.textBaseline = "top";
          it.v.split("\n").forEach((line, k) => ctx.fillText(line, it.x * w, it.y * h + k * size * 1.25));
          continue;
        }
        const hl = it.t === "highlighter";
        ctx.globalAlpha = hl ? (dark ? 0.36 : 0.5) : 1;   /* ink blends into the page, so text under a highlight stays crisp */
        const col = colorOf(it.c, dark);
        ctx.strokeStyle = hl && PALETTE[it.c] && !dark ? PALETTE[it.c].dark.replace("#f3f3ef", "#ffe14d") : col;
        ctx.fillStyle = col;
        ctx.lineCap = hl ? "butt" : "round"; ctx.lineJoin = "round";
        const pts = it.p, n = pts.length, X = k => pts[k][0] * w, Y = k => pts[k][1] * h;
        const hasP = !hl && n > 2 && pts[0].length > 2;
        if (n < 3) {
          ctx.lineWidth = it.w * w; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
          if (n === 1) ctx.lineTo(X(0) + 0.1, Y(0)); else ctx.lineTo(X(1), Y(1));
          ctx.stroke();
        } else if (!hasP) {
          /* smooth curve through the midpoints of the sampled points */
          ctx.lineWidth = it.w * w; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
          for (let k = 1; k < n - 1; k++) ctx.quadraticCurveTo(X(k), Y(k), (X(k) + X(k + 1)) / 2, (Y(k) + Y(k + 1)) / 2);
          ctx.lineTo(X(n - 1), Y(n - 1)); ctx.stroke();
        } else {
          /* Apple Pencil: width follows pressure */
          const pp = pts.map(q => [q[0] * w, q[1] * h, q[2]]);
          /* while writing, also draw where the Pencil is about to be (if the browser predicts it), so ink keeps up with the tip */
          if (it._pred) for (const q of it._pred) pp.push([q[0] * w, q[1] * h, q[2]]);
          drawPressure(ctx, pp, it.w * w, !!it._live);
        }
      }
      ctx.globalAlpha = 1;
    }
    /* the stroke being written lives on its own layer so the rest of the page isn't redrawn on every move */
    drawLive(p, it) {
      this.alloc(p, this.pages.indexOf(p));
      /* only the page being written on keeps a full-size stroke layer */
      for (const q of this.pages) if (q !== p && q.live?.width) { q.live.width = 0; q.live.height = 0; q.liveBox = null; }
      const c = p.live, dpr = p.px, W = Math.round(p.w * dpr), H = Math.round(p.h * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; c.style.width = p.w + "px"; c.style.height = p.h + "px"; }
      const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (it && it.t === "pen" && it.p.length > 2 && it.p[0].length > 2) return this.drawLivePencil(p, it, ctx, dpr);
      /* wiping a whole full-resolution page on every Pencil move is slow on iPad: only clear where the stroke was */
      const bb = p.liveBox;
      if (bb) ctx.clearRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); else ctx.clearRect(0, 0, p.w, p.h);
      p.liveBox = null;
      if (it) {
        this.drawItems(ctx, [it], p.w, p.h);
        if (it.p) {
          let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
          for (const q of it._pred ? it.p.concat(it._pred) : it.p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
          const m = it.w * p.w + 4;
          p.liveBox = [x0 * p.w - m, y0 * p.h - m, x1 * p.w + m, y1 * p.h + m];
        }
      }
    }
    /* Pencil stroke while it's being written. Parts of the stroke that can no longer change are drawn once;
       only the end near the tip (which still moves with the next points) is wiped and redrawn on each move,
       so a long line of writing costs no more per move than a short one. */
    drawLivePencil(p, it, ctx, dpr) {
      let st = LIVE.get(it);
      if (!st || st.page !== p || st.w !== p.w) {
        ctx.clearRect(0, 0, p.w, p.h); p.liveBox = null;
        st = { page: p, w: p.w, done: 1, boxes: [], tail: null }; LIVE.set(it, st);
      }
      const raw = it.p.map(q => [q[0] * p.w, q[1] * p.h, q[2]]), n = raw.length;
      const pred = (it._pred || []).map(q => [q[0] * p.w, q[1] * p.h, q[2]]);
      const g = inkGeom(raw.concat(pred), it.w * p.w, true), N = g.d.length;
      const lim = Math.min(N, Math.max(st.done, g.starts[n - 2] ?? 1));   /* hulls before this are final */
      ctx.globalAlpha = 1; ctx.fillStyle = colorOf(it.c, this.dark);
      const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      if (st.tail) {
        const t = st.tail;
        ctx.clearRect(t[0], t[1], t[2] - t[0], t[3] - t[1]);
        ctx.save(); ctx.beginPath(); ctx.rect(t[0], t[1], t[2] - t[0], t[3] - t[1]); ctx.clip();
        ctx.beginPath(); let any = false;
        for (let i = 1; i < st.done; i++) if (hit(st.boxes[i], t)) { inkHulls(ctx, g, i, i + 1); any = true; }
        if (any) ctx.fill("nonzero");
        ctx.restore();
      }
      if (lim > st.done) {
        ctx.beginPath(); inkHulls(ctx, g, st.done, lim); ctx.fill("nonzero");
        for (let i = st.done; i < lim; i++) st.boxes[i] = hullBox(g, i, 1);
        st.done = lim;
      }
      if (N > st.done || N === 1) {
        ctx.beginPath(); inkHulls(ctx, g, N === 1 ? 0 : st.done, N); ctx.fill("nonzero");
        let b = [Infinity, Infinity, -Infinity, -Infinity];
        for (let i = Math.max(1, st.done); i < N; i++) { const h = hullBox(g, i, 2); b = [Math.min(b[0], h[0]), Math.min(b[1], h[1]), Math.max(b[2], h[2]), Math.max(b[3], h[3])]; }
        /* snap to whole device pixels so the wipe and redraw leave no seam */
        st.tail = isFinite(b[0]) ? [Math.floor(b[0] * dpr) / dpr, Math.floor(b[1] * dpr) / dpr, Math.ceil(b[2] * dpr) / dpr, Math.ceil(b[3] * dpr) / dpr] : null;
      } else st.tail = null;
    }
    clearLive(p) { const c = p.live; p.liveBox = null; if (c.width) c.getContext("2d").clearRect(0, 0, c.width, c.height); }
    addInk(p, it) {
      if (!p.px) return;
      this.drawItems(this.inkCtx(p), [it], p.w, p.h);
    }
    drawInk(p, i, extra) {
      if (!p.px) return;   /* released page: drawn again when it scrolls back into view */
      if (!this.ann[i]?.length && !extra) { p.ink.width = 0; p.ink.height = 0; return; }
      const ctx = this.inkCtx(p); ctx.clearRect(0, 0, p.w, p.h);
      this.drawItems(ctx, this.ann[i], p.w, p.h);
      if (extra) this.drawItems(ctx, [extra], p.w, p.h);
    }

    hit(it, x, y, p) {
      const r = 0.012;
      if (it.t === "text") {
        const lines = it.v.split("\n"), wFrac = Math.max(...lines.map(l => l.length)) * it.s * 0.56, hFrac = lines.length * it.s * 1.25 * p.w / p.h;
        return x >= it.x - r && x <= it.x + wFrac + r && y >= it.y - r && y <= it.y + hFrac + r;
      }
      const ry = r * p.w / p.h;
      return it.p.some(([px, py]) => Math.abs(px - x) < r + it.w / 2 && Math.abs(py - y) < ry + it.w / 2);
    }

    bindInk(p, i) {
      const pos = e => { const b = p.ink.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
      let cur = null, erasing = false;
      /* Apple Pencil: once a pen is used, fingers scroll instead of drawing (palm rejection) */
      let fingerScroll = null;
      this.cancelInk.push(() => {
        fingerScroll = null; erasing = false;
        if (cur && cur.touch) { cur = null; this.clearLive(p); }
        this.inking = false;
      });
      p.ink.addEventListener("pointerdown", e => {
        if (this.pinching && e.pointerType === "touch") return;
        if (e.pointerType === "pen" && !this.penSeen) { this.penSeen = true; this.onChange?.(); }
        if (this.penSeen && e.pointerType === "touch" && this.tool !== "hand") {
          fingerScroll = { x: e.clientX, y: e.clientY, top: this.el.scrollTop, left: this.el.scrollLeft, id: e.pointerId };
          try { p.ink.setPointerCapture(e.pointerId); } catch (err) {}
          return;
        }
        if (this.tool === "hand" || (e.pointerType === "mouse" && e.button !== 0)) return;
        const [x, y] = pos(e);
        if (this.tool === "text") {
          e.preventDefault();
          const items = this.ann[i] || [], hitIdx = items.findIndex(it => it.t === "text" && this.hit(it, x, y, p));
          this.editText(p, i, hitIdx >= 0 ? hitIdx : null, x, y);
          return;
        }
        e.preventDefault(); try { p.ink.setPointerCapture(e.pointerId); } catch (err) {}
        if (this.tool === "eraser") { this.snapshotPage(i); erasing = true; this.inking = true; this.eraseAt(p, i, x, y); return; }
        cur = { t: this.tool, c: this.color, w: +(WIDTH[this.tool] * (this.size[this.tool] || 1)).toFixed(5), p: [e.pointerType === "pen" && this.tool === "pen" ? [x, y, +(e.pressure || 0.5).toFixed(2)] : [x, y]] };
        if (e.pointerType === "touch") Object.defineProperty(cur, "touch", { value: true });
        /* not saved with the note: whether it's still being written, and the Pencil's predicted next points */
        Object.defineProperty(cur, "_live", { value: true, writable: true });
        Object.defineProperty(cur, "_pred", { value: null, writable: true });
        this.inking = true; this.drawLive(p, cur);
      });
      p.ink.addEventListener("pointermove", e => {
        if (this.pinching && e.pointerType === "touch") return;
        if (fingerScroll && e.pointerId === fingerScroll.id) {
          this.el.scrollTop = fingerScroll.top - (e.clientY - fingerScroll.y);
          this.el.scrollLeft = fingerScroll.left - (e.clientX - fingerScroll.x);
          return;
        }
        if (erasing) { const [x, y] = pos(e); this.eraseAt(p, i, x, y); return; }
        if (!cur) return;
        const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
        const withP = cur.p[0].length > 2, minD = 0.35 / p.w;   /* ignore sub-pixel jitter */
        for (const ev of evs) {
          let [x, y] = pos(ev);
          if (cur.t === "highlighter" && e.shiftKey) y = cur.p[0][1];
          const last = cur.p[cur.p.length - 1];
          if (Math.abs(x - last[0]) < minD && Math.abs(y - last[1]) * p.h / p.w < minD) continue;
          if (withP) { x = last[0] + (x - last[0]) * 0.55; y = last[1] + (y - last[1]) * 0.55; }   /* steady Pencil jitter */
          const pt = [+x.toFixed(5), +y.toFixed(5)];
          if (withP) pt.push(+((ev.pressure || 0.5) * 0.35 + last[2] * 0.65).toFixed(3));   /* smooth pressure changes */
          cur.p.push(pt);
        }
        if (withP && e.getPredictedEvents) {
          const last = cur.p[cur.p.length - 1];
          cur._pred = e.getPredictedEvents().slice(0, 3).map(ev => { const [x, y] = pos(ev); return [x, y, last[2]]; });
        }
        this.drawLive(p, cur);
      });
      const end = e => {
        if (this.pinching && e && e.pointerType === "touch") { if (cur && cur.touch) { cur = null; this.clearLive(p); this.inking = false; } fingerScroll = null; return; }
        if (fingerScroll && e && e.pointerId === fingerScroll.id) { fingerScroll = null; return; }
        if (erasing) { erasing = false; this.inking = false; this.save(); return; }
        if (!cur) return;
        if (cur.p[0].length > 2 && e && e.clientX != null && e.type === "pointerup") {   /* finish exactly where the Pencil lifted */
          const [x, y] = pos(e), last = cur.p[cur.p.length - 1];
          if (Math.hypot(x - last[0], y - last[1]) > 0.3 / p.w) cur.p.push([+x.toFixed(5), +y.toFixed(5), last[2]]);
        }
        cur._live = false; cur._pred = null;
        this.snapshotPage(i); (this.ann[i] ||= []).push(cur);
        this.addInk(p, cur); this.clearLive(p); cur = null; this.inking = false;
        this.save();
      };
      p.ink.addEventListener("pointerup", end);
      p.ink.addEventListener("pointercancel", end);
    }
    eraseAt(p, i, x, y) {
      const items = this.ann[i]; if (!items) return;
      const keep = items.filter(it => !this.hit(it, x, y, p));
      if (keep.length !== items.length) { this.ann[i] = keep; this.drawInk(p, i); }
    }

    editText(p, i, idx, x, y) {
      this.commitText();
      const items = this.ann[i] ||= [];
      const existing = idx != null ? items[idx] : null;
      const it = existing || { t: "text", c: this.color, s: TEXT_SIZE, x, y, v: "" };
      if (existing) { items.splice(idx, 1); this.drawInk(p, i); }
      const ta = document.createElement("textarea");
      ta.className = "vw-text"; ta.value = it.v; ta.spellcheck = false;
      Object.assign(ta.style, { left: it.x * p.w + "px", top: it.y * p.h + "px", fontSize: it.s * p.w + "px", color: colorOf(it.c, this.dark), background: this.dark ? "rgba(20,22,21,.85)" : "rgba(255,255,255,.85)" });
      p.el.appendChild(ta);
      const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; ta.style.width = "auto"; ta.style.width = Math.min(p.w - it.x * p.w - 4, Math.max(60, ta.scrollWidth + 8)) + "px"; };
      ta.oninput = grow; grow();
      this.editing = { ta, p, i, it, wasExisting: !!existing };
      ta.onkeydown = e => { if (e.key === "Escape") ta.blur(); e.stopPropagation(); };
      ta.onblur = () => this.commitText();
      ta.focus(); requestAnimationFrame(() => ta.focus());
    }
    commitText() {
      const ed = this.editing; if (!ed) return;
      this.editing = null;
      const v = ed.ta.value.replace(/\s+$/, "");
      ed.ta.remove();
      if (v || ed.wasExisting) this.snapshot();
      if (v) { ed.it.v = v; (this.ann[ed.i] ||= []).push(ed.it); }
      this.drawInk(ed.p, ed.i); this.save();
    }

    async download() {
      if (!this.bytes) throw new Error("not loaded");
      await loadScript(PDFLIB);
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.load(this.bytes, { ignoreEncryption: true });
      const pages = doc.getPages();
      for (const [i, items] of Object.entries(this.ann)) {
        const page = pages[+i]; if (!page || !items.length) continue;
        const { width, height } = page.getSize(), k = 3;
        const c = document.createElement("canvas"); c.width = width * k; c.height = height * k;
        const ctx = c.getContext("2d"); ctx.scale(k, k);
        this.drawItems(ctx, items, width, height, false);
        const png = await doc.embedPng(c.toDataURL("image/png"));
        page.drawImage(png, { x: 0, y: 0, width, height, ...(window.PDFLib.BlendMode ? { blendMode: window.PDFLib.BlendMode.Multiply } : {}) });
      }
      const blob = new Blob([await doc.save()], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = this.title.replace(/[^\w\s.-]+/g, " ").replace(/\s+/g, " ").trim() + (this.hasNotes() ? " (annotated)" : "") + ".pdf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  }

  /* ---------- Pop-up ---------- */
  const I = {
    file: '<path d="M5.5 2.5h6l3 3v12h-9Z"/><path d="M11.5 2.5v3h3"/>',
    pages: '<path d="M7.5 4.5h6l2.5 2.5v10.5h-8.5Z"/><path d="M5 15.5V2.5h6"/>',
    pen: '<path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 0 1 3 3L8 15Z"/><path d="M12 5l3 3"/>',
    highlighter: '<path d="m9 15-4 1 1-4 7.5-7.5 3 3Z"/><path d="M3 18h14" stroke-width="2.4" opacity=".45"/>',
    text: '<path d="M5 5h10M10 5v11M7.5 16h5"/>',
    eraser: '<path d="m7.5 16 -4-4a1.5 1.5 0 0 1 0-2.1l6.4-6.4a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L10.5 16Z"/><path d="M7.5 16H16M6 8.5l5.5 5.5"/>',
    undo: '<path d="M7 7H12a4 4 0 0 1 0 8H8"/><path d="M9.5 4.5 7 7l2.5 2.5"/>',
    redo: '<path d="M13 7H8a4 4 0 0 0 0 8h4"/><path d="M10.5 4.5 13 7l-2.5 2.5"/>',
    minus: '<path d="M5 10h10"/>', plus: '<path d="M5 10h10M10 5v10"/>',
    up: '<path d="m5.5 12 4.5-4.5 4.5 4.5"/>', down: '<path d="m5.5 8 4.5 4.5L14.5 8"/>',
    ms: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M10 4v12"/>',
    save: '<path d="M10 3.5v9m-3.5-3.5L10 12.5l3.5-3.5M4 16.5h12"/>',
    close: '<path d="m5.5 5.5 9 9m0-9-9 9"/>',
    search: '<circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/>',
    bookmark: '<path d="M6 3.5h8v13l-4-3-4 3Z"/>',
    annotate: '<path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 0 1 3 3L8 15Z"/>',
    trash: '<path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5"/>',
    moon: '<path d="M15.5 12A6 6 0 0 1 8 4.5a6 6 0 1 0 7.5 7.5Z"/>',
  };
  const svg = (n, fill) => `<svg viewBox="0 0 20 20" fill="${fill ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
  const TOOL_NAMES = { pen: "Pen (P)", highlighter: "Highlighter (H)", text: "Text (T)", eraser: "Eraser (E)" };

  let active = null;
  /* save unsaved notes if the tab is hidden or closed */
  /* Safari can still start a selection from a fast stroke; stop it inside the viewer unless it's a text field */
  document.addEventListener("selectstart", e => {
    const t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (t?.closest?.(".pv") && !t.closest("input, textarea, [contenteditable]")) e.preventDefault();
  });
  const flushAll = () => { try { active?.main?.flush(); } catch (e) {} };
  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAll(); });

  function open(info) {
    close();
    const { src, title = "Paper", desc = "", ms = "", page = 1, y = 0, msPage = 1, msY = 0, pages = null, msPages = null, wholeLabel = "Whole paper" } = info || {};
    if (!src) return;
    const root = document.createElement("div");
    root.className = "pv-scrim";
    root.innerHTML = `<div class="pv" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="pv-head">
        <span class="pv-icon">${svg("file")}</span>
        <div class="pv-name"><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</div>
        <button class="vw-ico" data-do="search" title="Search this paper" aria-label="Search this paper">${svg("search")}</button>
        <button class="vw-ico" data-do="download" title="Download" aria-label="Download">${svg("save")}</button>
        <button class="vw-ico" data-do="close" title="Close (Esc)" aria-label="Close">${svg("close")}</button>
      </header>
      <div class="pv-find" hidden>
        ${svg("search")}<input type="search" placeholder="Find in this paper" aria-label="Find in this paper" id="pv-find-input">
        <span class="pv-count" data-count></span>
        <button class="vw-ico" data-do="find-prev" title="Previous match" aria-label="Previous match">${svg("up")}</button>
        <button class="vw-ico" data-do="find-next" title="Next match" aria-label="Next match">${svg("down")}</button>
        <button class="vw-ico" data-do="find-close" title="Close search" aria-label="Close search">${svg("close")}</button>
      </div>
      <div class="pv-bar">
        <div class="pv-pager">
          <button class="vw-ico" data-do="prev" title="Previous page" aria-label="Previous page">${svg("up")}</button>
          <span data-pages>–</span>
          <button class="vw-ico" data-do="next" title="Next page" aria-label="Next page">${svg("down")}</button>
        </div>
        ${pages && pages.length ? `<button class="pv-pill" data-do="whole" title="Show every page">${svg("pages")}<span>${esc(wholeLabel)}</span></button>` : ""}
        <button class="pv-pill" data-do="bookmark">${svg("bookmark")}<span>Bookmark</span></button>
        <button class="pv-pill" data-do="annotate">${svg("annotate")}<span>Annotate</span></button>
        ${ms ? `<button class="pv-pill" data-do="ms">${svg("ms")}<span>Mark scheme</span></button>` : ""}
        <button class="pv-pill" data-do="dark" title="Dark mode (D)">${svg("moon")}<span>Dark mode</span></button>
        <div class="pv-zoom">
          <button class="vw-ico" data-do="zoomout" title="Zoom out" aria-label="Zoom out">${svg("minus")}</button>
          <span data-zoom>100%</span>
          <button class="vw-ico" data-do="zoomin" title="Zoom in" aria-label="Zoom in">${svg("plus")}</button>
        </div>
      </div>
      <div class="pv-tools" hidden role="toolbar" aria-label="Annotation tools">
        ${Object.keys(TOOL_NAMES).map(t => `<button class="vw-ico" data-tool="${t}" title="${TOOL_NAMES[t]}" aria-label="${TOOL_NAMES[t]}">${svg(t)}</button>`).join("")}
        <span class="vw-sep"></span>
        ${Object.keys(PALETTE).map(c => `<button class="vw-color" data-color="${c}" title="${PALETTE[c].name}" aria-label="${PALETTE[c].name}"><i></i></button>`).join("")}
        <button class="vw-color wheel" data-do="wheel" title="More colours" aria-label="More colours" aria-haspopup="dialog"><i></i></button>
        <span class="vw-sep"></span>
        <button class="vw-size" data-do="sizes" title="Line thickness" aria-label="Line thickness" aria-haspopup="true"><i></i></button>
        <span class="vw-sep"></span>
        <button class="vw-ico" data-do="undo" title="Undo (Ctrl+Z)" aria-label="Undo">${svg("undo")}</button>
        <button class="vw-ico" data-do="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">${svg("redo")}</button>
        <button class="vw-ico" data-do="clear" title="Clear all notes" aria-label="Clear all notes">${svg("trash")}</button>
        <span class="pv-saved" data-save></span>
      </div>
      <div class="pv-sizes" hidden role="menu" aria-label="Line thickness">
        ${SIZES.map(([m, name], k) => `<button class="vw-size" data-size="${m}" role="menuitemradio" title="${name}" aria-label="${name}" style="--d:${SIZE_DOT[k]}px"><i></i></button>`).join("")}
      </div>
      <div class="pv-wheel" hidden role="dialog" aria-label="Pick a colour">
        <canvas width="200" height="200" aria-label="Colour wheel"></canvas>
        <label class="pv-wheel-row"><span>Brightness</span><input type="range" min="15" max="85" value="55" data-light aria-label="Brightness"></label>
        <div class="pv-wheel-row"><i class="pv-wheel-prev"></i><code data-hex>#63dba4</code></div>
        <div class="pv-wheel-recent" data-recent></div>
      </div>
      <div class="vw-confirm" hidden><span>Clear every note on this paper?</span><button class="vw-btn sm danger" data-do="clear-yes">Clear notes</button><button class="vw-btn sm" data-do="clear-no">Cancel</button></div>
      <div class="vw-body">
        <div class="vw-pane main"></div>
        ${ms ? `<div class="vw-pane ms" hidden><div class="vw-pane-label">Mark scheme ${msPages && msPages.length ? `<button class="pv-ms-whole" data-do="ms-whole">Whole mark scheme</button>` : ""}<a href="${esc(ms)}" target="_blank" rel="noopener">original ↗</a></div><div class="vw-pane-inner"></div></div>` : ""}
      </div>
    </div>`;
    document.body.appendChild(root);
    document.body.classList.add("pv-open");

    const $ = s => root.querySelector(s);
    /* Viewer dark mode: starts in the website's mode each time; the toggle applies to this window only. */
    const siteDark = () => { const t = (document.documentElement.dataset.theme || "").replace(/"/g, ""); return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
    const applyDark = on => {
      root.querySelector(".pv").classList.toggle("dark-pages", on);
      const b = root.querySelector('[data-do="dark"]'); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
      st.dark = on; st.main?.setDark(on); st.ms?.setDark(on); sync?.();
    };
    const st = { info: { src, title, desc, ms }, root, annotating: false, lastFocus: document.activeElement };
    active = st;

    const sync = () => {
      if (active !== st) return;
      const p = st.main, n = p.pages.length;
      $("[data-pages]").textContent = n ? `${p.current} / ${n}` : "–";
      $('[data-do="prev"]').disabled = !n || !p.hasPrev();
      $('[data-do="next"]').disabled = !n || !p.hasNext();
      const wb2 = $('[data-do="whole"]'); if (wb2) wb2.hidden = !p.only;
      const bm = n && Bookmarks.has(src, p.current), bb = $('[data-do="bookmark"]');
      bb.classList.toggle("on", !!bm); bb.innerHTML = `${svg("bookmark", bm)}<span>${bm ? "Bookmarked" : "Bookmark"}</span>`; bb.disabled = !n;
      $('[data-do="annotate"]').classList.toggle("on", st.annotating);
      $('[data-do="annotate"]').disabled = !n;
      $(".pv-tools").hidden = !st.annotating;
      root.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === p.tool));
      const sizeFor = p.drawTool === "highlighter" ? "highlighter" : "pen";
      const cur = p.size[sizeFor] || 1, k = Math.max(0, SIZES.findIndex(([m]) => m === cur));
      root.querySelectorAll("[data-size]").forEach(b => { b.classList.toggle("on", +b.dataset.size === cur); b.setAttribute("aria-checked", +b.dataset.size === cur); });
      const sb = $('[data-do="sizes"]'); sb.style.setProperty("--d", SIZE_DOT[k] + "px"); sb.title = `Line thickness: ${SIZES[k][1]}`;
      root.querySelectorAll("[data-color]").forEach(b => { b.classList.toggle("on", b.dataset.color === p.color); b.firstElementChild.style.background = colorOf(b.dataset.color, st.dark); });
      const custom = !PALETTE[p.color], wb = $('[data-do="wheel"]');
      wb.classList.toggle("on", custom); wb.classList.toggle("has", custom); wb.firstElementChild.style.setProperty("--c", custom ? p.color : "transparent");
      $('[data-do="undo"]').disabled = !p.undo.length;
      $('[data-do="redo"]').disabled = !p.redo.length;
      $('[data-do="download"]').disabled = !p.bytes;
      $("[data-zoom]").textContent = Math.round(p.zoom * 100) + "%";
      $("[data-save]").textContent = (p.penSeen ? "Pencil writes, finger scrolls · " : "") + (!p.hasNotes() ? "Notes save in this browser" : p.saved === false ? "Couldn't save notes" : "Saved");
      const q = $("#pv-find-input").value.trim();
      $("[data-count]").textContent = !q ? "" : p.matches.length ? `${p.matchIdx + 1} of ${p.matches.length}` : "No matches";
    };
    st.main = new Pane($(".vw-pane.main"), { src, title, annotate: true, startPage: page, startY: y, onChange: sync, only: pages });
    applyDark(siteDark());
    sync();

    const setAnnotate = on => {
      st.annotating = on;
      st.main.setTool(on ? st.main.drawTool : "hand");
    };
    const toggleMs = btn => {
      const pane = $(".vw-pane.ms"), body = $(".vw-body");
      const show = pane.hidden; pane.hidden = !show; body.classList.toggle("split", show); btn.classList.toggle("on", show);
      if (show && !st.ms) { st.ms = new Pane(pane.querySelector(".vw-pane-inner"), { src: ms, title: "Mark scheme", annotate: false, startPage: msPage, startY: msY, only: msPages }); st.ms.dark = st.dark; }
      setTimeout(() => { st.main.layout(); st.ms?.layout(); }, 0);
    };
    const openFind = () => { $(".pv-find").hidden = false; const i = $("#pv-find-input"); i.focus(); i.select(); };
    const closeFind = () => { $(".pv-find").hidden = true; $("#pv-find-input").value = ""; st.main.search(""); };

    /* ----- colour wheel ----- */
    const wheel = (() => {
      const box = $(".pv-wheel"), cv = box.querySelector("canvas"), light = box.querySelector("[data-light]");
      let h = 150, sat = 0.6;
      const hsl2hex = (H, S, L) => {
        S /= 100; L /= 100;
        const k = n => (n + H / 30) % 12, a = S * Math.min(L, 1 - L);
        const f = n => Math.round(255 * (L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
        return "#" + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, "0")).join("");
      };
      const draw = () => {
        const ctx = cv.getContext("2d"), W = cv.width, R = W / 2, img = ctx.createImageData(W, W), L = +light.value;
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
          const dx = x - R, dy = y - R, r = Math.hypot(dx, dy), i = (y * W + x) * 4;
          if (r > R) { img.data[i + 3] = 0; continue; }
          const hex = hsl2hex((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, (r / R) * 100, L);
          img.data[i] = parseInt(hex.slice(1, 3), 16); img.data[i + 1] = parseInt(hex.slice(3, 5), 16); img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
          img.data[i + 3] = r > R - 1 ? Math.round(255 * (R - r)) : 255;
        }
        ctx.putImageData(img, 0, 0);
        const mx = R + Math.cos(h * Math.PI / 180) * sat * R, my = R + Math.sin(h * Math.PI / 180) * sat * R;
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.stroke();
      };
      const current = () => hsl2hex(h, sat * 100, +light.value);
      const recents = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } };
      const remember = hex => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...recents().filter(x => x !== hex)].slice(0, 8))); } catch (e) {} };
      const showRecent = () => {
        const r = recents();
        box.querySelector("[data-recent]").innerHTML = r.length ? `<span>Recent</span>${r.map(c => `<button class="vw-color" data-pick="${c}" title="${c}" aria-label="Recent colour ${c}"><i style="background:${c}"></i></button>`).join("")}` : "";
      };
      const preview = () => { const hex = current(); box.querySelector(".pv-wheel-prev").style.background = hex; box.querySelector("[data-hex]").textContent = hex; };
      const apply = () => { const hex = current(); preview(); st.main.color = hex; if (st.main.tool === "eraser" || st.main.tool === "hand") { if (!st.annotating) setAnnotate(true); st.main.setTool("pen"); } else sync(); return hex; };
      let dragging = false;
      const pickAt = e => {
        const b = cv.getBoundingClientRect(), R = b.width / 2, dx = e.clientX - b.left - R, dy = e.clientY - b.top - R;
        h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; sat = Math.min(1, Math.hypot(dx, dy) / R);
        draw(); apply();
      };
      cv.addEventListener("pointerdown", e => { dragging = true; cv.setPointerCapture(e.pointerId); pickAt(e); });
      cv.addEventListener("pointermove", e => { if (dragging) pickAt(e); });
      const end = () => { if (dragging) { dragging = false; remember(current()); showRecent(); } };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
      light.addEventListener("input", () => { draw(); apply(); });
      light.addEventListener("change", () => { remember(current()); showRecent(); });
      return {
        toggle(btn) {
          if (!box.hidden) return this.hide();
          box.hidden = false; showRecent(); draw(); preview();
          const r = btn.getBoundingClientRect(), pv = $(".pv").getBoundingClientRect();
          box.style.left = Math.max(8, Math.min(r.left - pv.left - 90, pv.width - box.offsetWidth - 8)) + "px";
          box.style.top = (r.bottom - pv.top + 8) + "px";
        },
        hide() { box.hidden = true; },
        choose(hex) { st.main.color = hex; box.querySelector(".pv-wheel-prev").style.background = hex; box.querySelector("[data-hex]").textContent = hex; remember(hex); showRecent(); if (st.main.tool === "eraser") st.main.setTool("pen"); else sync(); },
        isOpen: () => !box.hidden,
      };
    })();

    root.addEventListener("pointerdown", e => {
      const sz = $(".pv-sizes");
      if (!sz.hidden && !e.target.closest('.pv-sizes,[data-do="sizes"]')) {
        sz.hidden = true;
        if (e.target.closest(".pg")) { e.stopPropagation(); e.preventDefault(); return; }  /* this tap only closes the menu */
      }
      if (wheel.isOpen() && !e.target.closest(".pv-wheel,[data-do=\"wheel\"]")) {
        wheel.hide();
        if (e.target.closest(".pg")) { e.stopPropagation(); e.preventDefault(); }  /* this tap only closes the wheel */
      }
    }, true);
    root.addEventListener("click", async e => {
      if (e.target === root) { close(); return; }
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const p = st.main;
      if (b.dataset.tool) p.setTool(b.dataset.tool);
      if (b.dataset.color) { p.color = b.dataset.color; wheel.hide(); if (p.tool === "eraser") p.setTool("pen"); else sync(); }
      if (b.dataset.size) {
        /* applies to the pen, or to the highlighter when that's the tool in use */
        const t = p.drawTool === "highlighter" ? "highlighter" : "pen";
        p.size[t] = +b.dataset.size; store.set(SIZE_KEY, p.size);
        $(".pv-sizes").hidden = true;
        if (p.tool !== t) p.setTool(t); else sync();
        return;
      }
      if (b.dataset.do === "sizes") {
        const box = $(".pv-sizes"); wheel.hide();
        if (!box.hidden) { box.hidden = true; return; }
        box.hidden = false;
        const r = b.getBoundingClientRect(), pv = $(".pv").getBoundingClientRect();
        box.style.left = Math.max(8, Math.min(r.left - pv.left - (box.offsetWidth - r.width) / 2, pv.width - box.offsetWidth - 8)) + "px";
        box.style.top = (r.bottom - pv.top + 8) + "px";
        return;
      }
      if (b.dataset.do === "wheel") { $(".pv-sizes").hidden = true; wheel.toggle(b); return; }
      if (b.dataset.pick) { wheel.choose(b.dataset.pick); return; }
      switch (b.dataset.do) {
        case "close": close(); break;
        case "dark": applyDark(!root.querySelector(".pv").classList.contains("dark-pages")); break;
        case "prev": p.goToPage(p.current - 1); break;
        case "next": p.goToPage(p.current + 1); break;
        case "bookmark": Bookmarks.toggle(st.info, p.current); sync(); break;
        case "whole": p.showAll(); break;
        case "ms-whole": st.ms?.showAll(); b.hidden = true; break;
        case "annotate": setAnnotate(!st.annotating); break;
        case "ms": toggleMs(b); break;
        case "zoomin": p.setZoom(p.zoom + 0.2); break;
        case "zoomout": p.setZoom(p.zoom - 0.2); break;
        case "undo": p.doUndo(); break;
        case "redo": p.doRedo(); break;
        case "clear": $(".vw-confirm").hidden = false; break;
        case "clear-yes": p.clearAll(); $(".vw-confirm").hidden = true; break;
        case "clear-no": $(".vw-confirm").hidden = true; break;
        case "search": $(".pv-find").hidden ? openFind() : closeFind(); break;
        case "find-prev": p.stepMatch(-1); break;
        case "find-next": p.stepMatch(1); break;
        case "find-close": closeFind(); break;
        case "download":
          b.classList.add("busy"); b.title = "Preparing download…";
          try { await p.download(); } catch (err) { console.error(err); b.title = "Download failed, try again"; }
          b.classList.remove("busy"); setTimeout(() => { b.title = "Download"; }, 2000);
          break;
      }
    });
    let ft;
    $("#pv-find-input").addEventListener("input", e => { clearTimeout(ft); ft = setTimeout(() => st.main.search(e.target.value), 180); });
    $("#pv-find-input").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); st.main.stepMatch(e.shiftKey ? -1 : 1); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFind(); }
    });

    let rt;
    st.onResize = () => { clearTimeout(rt); rt = setTimeout(() => { st.main.layout(); st.ms?.layout(); }, 150); };
    window.addEventListener("resize", st.onResize);
    st.onKey = e => {
      if (active !== st) return;
      const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (e.key === "Escape" && !typing) { e.preventDefault(); e.stopImmediatePropagation(); if (wheel.isOpen()) wheel.hide(); else if (!$(".pv-sizes").hidden) $(".pv-sizes").hidden = true; else if (!$(".pv-find").hidden) closeFind(); else close(); return; }
      const p = st.main, k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "f") { e.preventDefault(); e.stopImmediatePropagation(); openFind(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "k") { e.stopImmediatePropagation(); e.preventDefault(); return; }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); e.shiftKey ? p.doRedo() : p.doUndo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "y") { e.preventDefault(); p.doRedo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.stopImmediatePropagation();
      if (k === "arrowdown" || k === "pagedown") { e.preventDefault(); p.goToPage(p.current + 1); }
      if (k === "arrowup" || k === "pageup") { e.preventDefault(); p.goToPage(p.current - 1); }
      if (k === "=" || k === "+") p.setZoom(p.zoom + 0.2);
      if (k === "-") p.setZoom(p.zoom - 0.2);
      if (k === "a") setAnnotate(!st.annotating);
      if (k === "d") applyDark(!root.querySelector(".pv").classList.contains("dark-pages"));
      if (k === "b" && p.pages.length) { Bookmarks.toggle(st.info, p.current); sync(); }
      if (st.annotating) {
        const map = { p: "pen", h: "highlighter", t: "text", e: "eraser" };
        if (map[k]) p.setTool(map[k]);
      }
    };
    document.addEventListener("keydown", st.onKey, true);
    st.onBm = () => sync();
    window.addEventListener("gsh-bookmarks", st.onBm);
    setTimeout(() => $('[data-do="close"]').focus({ preventScroll: true }), 0);
  }

  function close() {
    const st = active; if (!st) return;
    active = null;
    st.main?.commitText(); st.main?.flush();
    st.main?.destroy(); st.ms?.destroy();
    window.removeEventListener("resize", st.onResize);
    document.removeEventListener("keydown", st.onKey, true);
    window.removeEventListener("gsh-bookmarks", st.onBm);
    st.root.remove();
    document.body.classList.remove("pv-open");
    try { st.lastFocus?.focus({ preventScroll: true }); } catch (e) {}
    window.dispatchEvent(new Event("gsh-viewer-close"));
  }

  /* Shared PDF loading for other parts of the site (question bank snips).
     Only the few most recently used papers stay open: a long topic can draw on dozens of papers, and keeping
     them all open runs a phone out of memory (Safari then reloads the tab, "A problem repeatedly occurred"). */
  const docs = new Map(), KEEP_DOCS = 6;
  function trimDocs(keep) {
    const idle = [...docs.entries()].filter(([, d]) => !d.busy).sort((a, b) => a[1].t - b[1].t);
    let n = docs.size;
    for (const [src, d] of idle) {
      if (n <= keep) break;
      docs.delete(src); n--;
      try { d.ac?.abort(); } catch (e) {}   /* a paper still downloading for the question bank stops, so it doesn't slow the one being opened */
      d.p.then(doc => doc.destroy()).catch(() => {});
    }
  }
  async function withDoc(src, fn) {
    let d = docs.get(src);
    if (!d) {
      /* fetch the whole paper in one request (papers are ~1 MB): one round trip instead of many small range
         requests, and the browser keeps the file, so reopening it (or opening it in full) is quick */
      const ac = new AbortController();
      d = { p: Promise.all([pdfjs(), fetch(src, { signal: ac.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })])
              .then(([L, buf]) => L.getDocument({ data: new Uint8Array(buf), worker: worker(L) }).promise), busy: 0, t: 0, ac };
      docs.set(src, d);
      d.p.catch(() => docs.get(src) === d && docs.delete(src));
    }
    d.t = performance.now(); d.busy++;
    try { return await fn(await d.p); }
    finally { d.busy--; trimDocs(active ? 0 : KEEP_DOCS); }
  }

  window.Viewer = { open: info => { const r = open(info); window.dispatchEvent(new Event("gsh-viewer-open")); trimDocs(0); return r; }, close, Bookmarks, isOpen: () => !!active, withDoc, openDocs: () => docs.size };
})();
