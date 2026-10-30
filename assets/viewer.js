/* Pop-up PDF viewer: page controls, bookmarks, search, annotate (pen, highlighter,
   text, eraser, undo/redo), zoom, mark scheme side by side, autosave, annotated download. */
(() => {
  /* Bundled libraries (pdf.js 6.2.108 Apache-2.0, pdf-lib 1.17.1 MIT), served from this site. */
  const PDFJS = "/assets/vendor/pdf.min.mjs";
  const WORKER = "/assets/vendor/pdf.worker.min.mjs";
  const PDFLIB = "/assets/vendor/pdf-lib.min.js";

  const scripts = {};
  const loadScript = src => scripts[src] ||= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error("Couldn't load " + src)); document.head.appendChild(s);
  });
  let lib = null;
  async function pdfjs() {
    if (lib) return lib;
    lib = await import(PDFJS);
    lib.GlobalWorkerOptions.workerSrc = WORKER;
    return lib;
  }

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

  /* ---------- One scrollable PDF ---------- */
  class Pane {
    constructor(el, { src, title, annotate, startPage, onChange }) {
      Object.assign(this, { el, src, title, annotate, onChange });
      this.startPage = startPage || 1;
      this.zoom = 1; this.tool = "hand"; this.drawTool = "pen"; this.color = "green"; this.dark = false;
      this.pages = []; this.bytes = null; this.current = 1;
      this.key = "gsh-ann:" + src;
      this.ann = (annotate && store.get(this.key)) || {};
      this.undo = []; this.redo = [];
      this.matches = []; this.matchIdx = -1;
      this.observer = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && this.renderPage(e.target._i)), { root: el, rootMargin: "600px 0px" });
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
      this.bytes = buf.slice(0);
      try { this.doc = await L.getDocument({ data: new Uint8Array(buf) }).promise; }
      catch (e) { this.status(`<p>That file isn't a readable PDF.</p>`); return; }
      this.pages = [];
      for (let i = 1; i <= this.doc.numPages; i++) {
        const page = await this.doc.getPage(i);
        this.pages.push({ page, base: page.getViewport({ scale: 1 }) });
      }
      this.el.innerHTML = `<div class="vw-pages"></div>`;
      this.wrap = this.el.firstChild;
      this.pages.forEach((p, i) => {
        const pg = document.createElement("div"); pg.className = "pg"; pg._i = i;
        pg.innerHTML = `<canvas class="pdf"></canvas><div class="hl"></div><canvas class="ink"></canvas>`;
        this.wrap.appendChild(pg); p.el = pg; p.pdf = pg.children[0]; p.hl = pg.children[1]; p.ink = pg.children[2];
        if (this.annotate) this.bindInk(p, i);
        this.observer.observe(pg);
      });
      this.layout();
      this.setTool(this.tool);
      if (this.startPage > 1) this.goToPage(this.startPage, false);
      this.onChange?.();
    }

    fitWidth() { return Math.min(this.el.clientWidth - 32, 920); }

    layout() {
      if (!this.pages.length) return;
      const keepPage = this.current;
      const w = Math.max(240, this.fitWidth() * this.zoom), dpr = window.devicePixelRatio || 1;
      for (const p of this.pages) {
        const h = w * p.base.height / p.base.width;
        p.w = w; p.h = h; p.rendered = false;
        p.el.style.width = w + "px"; p.el.style.height = h + "px";
        for (const c of [p.pdf, p.ink]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + "px"; c.style.height = h + "px"; }
        this.drawInk(p, this.pages.indexOf(p));
      }
      this.goToPage(keepPage, false);
      const R = this.el.getBoundingClientRect();
      this.pages.forEach((p, i) => { const r = p.el.getBoundingClientRect(); if (r.bottom > R.top - 600 && r.top < R.bottom + 600) this.renderPage(i); });
    }

    async renderPage(i) {
      const p = this.pages[i]; if (!p || p.rendered || p.rendering) return;
      p.rendering = true;
      const dpr = window.devicePixelRatio || 1, scale = (p.w / p.base.width) * dpr;
      try { await p.page.render({ canvasContext: p.pdf.getContext("2d"), viewport: p.page.getViewport({ scale }) }).promise; p.rendered = true; }
      catch (e) {}
      p.rendering = false;
    }

    /* ----- pages ----- */
    currentPage() {
      if (!this.pages.length) return 1;
      const mark = this.el.scrollTop + this.el.clientHeight * 0.35;
      let n = 1;
      for (let i = 0; i < this.pages.length; i++) if (this.pages[i].el.offsetTop <= mark) n = i + 1;
      return n;
    }
    goToPage(n, smooth = true) {
      const p = this.pages[Math.min(Math.max(n, 1), this.pages.length) - 1]; if (!p) return;
      this.el.scrollTo({ top: p.el.offsetTop - 12, behavior: smooth ? "smooth" : "auto" });
      this.current = this.pages.indexOf(p) + 1; this.onChange?.();
    }

    setZoom(z) { this.zoom = Math.min(3, Math.max(0.5, z)); this.layout(); this.paintMatches(); this.onChange?.(); }

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
        this.el.scrollTo({ top: p.el.offsetTop + cur.it.y * p.h - this.el.clientHeight * 0.35, behavior: "smooth" });
      }
      this.onChange?.();
    }

    /* ----- annotation model: ann[pageIndex] = [items], coords as fractions of page size ----- */
    snapshot() { this.undo.push(JSON.stringify(this.ann)); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
    doUndo() { if (!this.undo.length) return; this.commitText(); this.redo.push(JSON.stringify(this.ann)); this.ann = JSON.parse(this.undo.pop()); this.redrawAll(); this.save(); }
    doRedo() { if (!this.redo.length) return; this.undo.push(JSON.stringify(this.ann)); this.ann = JSON.parse(this.redo.pop()); this.redrawAll(); this.save(); }
    clearAll() { if (!this.hasNotes()) return; this.snapshot(); this.ann = {}; this.redrawAll(); this.save(); }
    hasNotes() { return Object.values(this.ann).some(a => a.length); }
    save() {
      clearTimeout(this._t);
      this._t = setTimeout(() => { this.saved = store.set(this.key, this.ann); this.onChange?.(); }, 300);
      this.onChange?.();
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
        ctx.globalAlpha = hl ? (dark ? 0.32 : 0.38) : 1;
        const col = colorOf(it.c, dark);
        ctx.strokeStyle = hl && PALETTE[it.c] && !dark ? PALETTE[it.c].dark.replace("#f3f3ef", "#ffe14d") : col;
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
          /* Apple Pencil: same smooth curve, with line weight following pressure */
          let px = X(0), py = Y(0);
          for (let k = 1; k < n - 1; k++) {
            const mx = (X(k) + X(k + 1)) / 2, my = (Y(k) + Y(k + 1)) / 2, pr = pts[k][2];
            ctx.lineWidth = it.w * w * (0.55 + 0.9 * pr);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(X(k), Y(k), mx, my); ctx.stroke();
            px = mx; py = my;
          }
          ctx.lineWidth = it.w * w * (0.55 + 0.9 * pts[n - 1][2]);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(X(n - 1), Y(n - 1)); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    drawInk(p, i, extra) {
      const ctx = p.ink.getContext("2d"), dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, p.w, p.h);
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
      p.ink.addEventListener("pointerdown", e => {
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
        if (this.tool === "eraser") { this.snapshot(); erasing = true; this.eraseAt(p, i, x, y); return; }
        cur = { t: this.tool, c: this.color, w: WIDTH[this.tool], p: [e.pointerType === "pen" && this.tool === "pen" ? [x, y, +(e.pressure || 0.5).toFixed(2)] : [x, y]] };
        this.drawInk(p, i, cur);
      });
      p.ink.addEventListener("pointermove", e => {
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
          const pt = [+x.toFixed(5), +y.toFixed(5)];
          if (withP) pt.push(+((ev.pressure || 0.5) * 0.7 + last[2] * 0.3).toFixed(2));   /* smooth pressure changes */
          cur.p.push(pt);
        }
        this.drawInk(p, i, cur);
      });
      const end = e => {
        if (fingerScroll && e && e.pointerId === fingerScroll.id) { fingerScroll = null; return; }
        if (erasing) { erasing = false; this.save(); return; }
        if (!cur) return;
        this.snapshot(); (this.ann[i] ||= []).push(cur); cur = null;
        this.drawInk(p, i); this.save();
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
        page.drawImage(png, { x: 0, y: 0, width, height });
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

  function open(info) {
    close();
    const { src, title = "Paper", desc = "", ms = "", page = 1 } = info || {};
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
        <button class="vw-ico" data-do="undo" title="Undo (Ctrl+Z)" aria-label="Undo">${svg("undo")}</button>
        <button class="vw-ico" data-do="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">${svg("redo")}</button>
        <button class="vw-ico" data-do="clear" title="Clear all notes" aria-label="Clear all notes">${svg("trash")}</button>
        <span class="pv-saved" data-save></span>
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
        ${ms ? `<div class="vw-pane ms" hidden><div class="vw-pane-label">Mark scheme <a href="${esc(ms)}" target="_blank" rel="noopener">original ↗</a></div><div class="vw-pane-inner"></div></div>` : ""}
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
      $('[data-do="prev"]').disabled = !n || p.current <= 1;
      $('[data-do="next"]').disabled = !n || p.current >= n;
      const bm = n && Bookmarks.has(src, p.current), bb = $('[data-do="bookmark"]');
      bb.classList.toggle("on", !!bm); bb.innerHTML = `${svg("bookmark", bm)}<span>${bm ? "Bookmarked" : "Bookmark"}</span>`; bb.disabled = !n;
      $('[data-do="annotate"]').classList.toggle("on", st.annotating);
      $('[data-do="annotate"]').disabled = !n;
      $(".pv-tools").hidden = !st.annotating;
      root.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === p.tool));
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
    st.main = new Pane($(".vw-pane.main"), { src, title, annotate: true, startPage: page, onChange: sync });
    applyDark(siteDark());
    sync();

    const setAnnotate = on => {
      st.annotating = on;
      st.main.setTool(on ? st.main.drawTool : "hand");
    };
    const toggleMs = btn => {
      const pane = $(".vw-pane.ms"), body = $(".vw-body");
      const show = pane.hidden; pane.hidden = !show; body.classList.toggle("split", show); btn.classList.toggle("on", show);
      if (show && !st.ms) { st.ms = new Pane(pane.querySelector(".vw-pane-inner"), { src: ms, title: "Mark scheme", annotate: false }); st.ms.dark = st.dark; }
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
      if (b.dataset.do === "wheel") { wheel.toggle(b); return; }
      if (b.dataset.pick) { wheel.choose(b.dataset.pick); return; }
      switch (b.dataset.do) {
        case "close": close(); break;
        case "dark": applyDark(!root.querySelector(".pv").classList.contains("dark-pages")); break;
        case "prev": p.goToPage(p.current - 1); break;
        case "next": p.goToPage(p.current + 1); break;
        case "bookmark": Bookmarks.toggle(st.info, p.current); sync(); break;
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
      if (e.key === "Escape" && !typing) { e.preventDefault(); e.stopImmediatePropagation(); if (wheel.isOpen()) wheel.hide(); else if (!$(".pv-find").hidden) closeFind(); else close(); return; }
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
    st.main?.commitText();
    window.removeEventListener("resize", st.onResize);
    document.removeEventListener("keydown", st.onKey, true);
    window.removeEventListener("gsh-bookmarks", st.onBm);
    st.root.remove();
    document.body.classList.remove("pv-open");
    try { st.lastFocus?.focus({ preventScroll: true }); } catch (e) {}
  }

  /* Shared PDF loading for other parts of the site (question bank snips). */
  const docs = {};
  const getDoc = src => docs[src] ||= pdfjs().then(L => L.getDocument({ url: src, disableAutoFetch: true }).promise);

  window.Viewer = { open, close, Bookmarks, isOpen: () => !!active, getDoc };
})();
