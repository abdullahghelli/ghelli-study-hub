/* PDF viewer with annotation: pen, highlighter, text, eraser, undo/redo, zoom,
   mark scheme side by side, autosave in the browser, download annotated PDF. */
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

  const COLORS = { ink: "#1b1f1e", red: "#d93025", blue: "#1a64d6", green: "#16803c" };
  const HIGHLIGHT = { ink: "#ffe14d", red: "#ff8a80", blue: "#7fb8ff", green: "#7be08f" };
  const WIDTH = { pen: 0.0022, highlighter: 0.016 };
  const TEXT_SIZE = 0.02;

  /* ---------- One scrollable PDF ---------- */
  class Pane {
    constructor(el, { src, title, annotate, onChange }) {
      Object.assign(this, { el, src, title, annotate, onChange });
      this.zoom = 1; this.tool = annotate ? "pen" : "hand"; this.color = "ink";
      this.pages = []; this.bytes = null;
      this.key = "gsh-ann:" + src;
      this.ann = (annotate && store.get(this.key)) || {};
      this.undo = []; this.redo = [];
      this.observer = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && this.renderPage(e.target._i)), { root: el, rootMargin: "600px 0px" });
      this.load();
    }

    status(html) { this.el.innerHTML = `<div class="vw-status">${html}</div>`; }

    async load() {
      this.status(`<div class="vw-spin"></div><p>Opening ${esc(this.title)}…</p>`);
      let lib;
      try { lib = await pdfjs(); } catch (e) { this.status(`<p>The viewer couldn't start. Check your connection and refresh.</p>`); return; }
      try {
        const r = await fetch(this.src, { mode: "cors" });
        if (!r.ok) throw new Error(r.status);
        await this.open(lib, await r.arrayBuffer());
      } catch (e) { this.fallback(lib); }
    }

    fallback(lib) {
      this.status(`<p class="vw-big">This paper's website doesn't let it open here directly.</p>
        <p>Download it, then open the file here. Your notes will save to this paper.</p>
        <div class="vw-actions">
          <a class="vw-btn primary" href="${esc(this.src)}" target="_blank" rel="noopener">1. Download the paper ↗</a>
          <label class="vw-btn">2. Open the downloaded file<input type="file" accept="application/pdf" hidden></label>
        </div>
        <p class="vw-hint">You can also drag the PDF onto this area.</p>`);
      const take = async f => { if (f) await this.open(lib, await f.arrayBuffer()); };
      this.el.querySelector("input").onchange = e => take(e.target.files[0]);
      this.el.ondragover = e => { e.preventDefault(); this.el.classList.add("drop"); };
      this.el.ondragleave = () => this.el.classList.remove("drop");
      this.el.ondrop = e => { e.preventDefault(); this.el.classList.remove("drop"); take([...e.dataTransfer.files].find(f => f.type === "application/pdf")); };
    }

    async open(lib, buf) {
      this.el.ondragover = this.el.ondrop = this.el.ondragleave = null;
      this.bytes = buf.slice(0);
      try { this.doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise; }
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
        pg.innerHTML = `<canvas class="pdf"></canvas><canvas class="ink"></canvas><span class="pg-num">${i + 1}</span>`;
        this.wrap.appendChild(pg); p.el = pg; p.pdf = pg.children[0]; p.ink = pg.children[1];
        if (this.annotate) this.bindInk(p, i);
        this.observer.observe(pg);
      });
      this.layout();
      this.setTool(this.tool);
      this.onChange?.();
    }

    fitWidth() { return Math.min(this.el.clientWidth - 32, 920); }

    layout() {
      const w = Math.max(240, this.fitWidth() * this.zoom), dpr = window.devicePixelRatio || 1;
      for (const p of this.pages) {
        const h = w * p.base.height / p.base.width;
        p.w = w; p.h = h; p.rendered = false;
        p.el.style.width = w + "px"; p.el.style.height = h + "px";
        for (const c of [p.pdf, p.ink]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + "px"; c.style.height = h + "px"; }
        this.drawInk(p, this.pages.indexOf(p));
      }
      const vis = this.pages.filter(p => { const r = p.el.getBoundingClientRect(), R = this.el.getBoundingClientRect(); return r.bottom > R.top - 600 && r.top < R.bottom + 600; });
      vis.forEach(p => this.renderPage(this.pages.indexOf(p)));
    }

    async renderPage(i) {
      const p = this.pages[i]; if (!p || p.rendered || p.rendering) return;
      p.rendering = true;
      const dpr = window.devicePixelRatio || 1, scale = (p.w / p.base.width) * dpr;
      try { await p.page.render({ canvasContext: p.pdf.getContext("2d"), viewport: p.page.getViewport({ scale }) }).promise; p.rendered = true; }
      catch (e) {}
      p.rendering = false;
    }

    setZoom(z) {
      const before = this.el.scrollTop / Math.max(1, this.el.scrollHeight);
      this.zoom = Math.min(3, Math.max(0.5, z)); this.layout();
      this.el.scrollTop = before * this.el.scrollHeight;
      this.onChange?.();
    }

    setTool(t) {
      this.commitText();
      this.tool = t;
      this.el.dataset.tool = t;
      this.onChange?.();
    }

    /* ----- annotation model: ann[pageIndex] = [items], coords as fractions of page size ----- */
    snapshot() { this.undo.push(JSON.stringify(this.ann)); if (this.undo.length > 80) this.undo.shift(); this.redo = []; }
    doUndo() { if (!this.undo.length) return; this.commitText(); this.redo.push(JSON.stringify(this.ann)); this.ann = JSON.parse(this.undo.pop()); this.redrawAll(); this.save(); }
    doRedo() { if (!this.redo.length) return; this.undo.push(JSON.stringify(this.ann)); this.ann = JSON.parse(this.redo.pop()); this.redrawAll(); this.save(); }
    clearAll() { if (!Object.keys(this.ann).length) return; this.snapshot(); this.ann = {}; this.redrawAll(); this.save(); }
    hasNotes() { return Object.values(this.ann).some(a => a.length); }
    save() {
      clearTimeout(this._t);
      this._t = setTimeout(() => { this.saved = store.set(this.key, this.ann); this.onChange?.(); }, 300);
      this.onChange?.();
    }
    redrawAll() { this.pages.forEach((p, i) => this.drawInk(p, i)); this.onChange?.(); }

    drawItems(ctx, items, w, h) {
      for (const it of items || []) {
        if (it.t === "text") {
          ctx.globalAlpha = 1; ctx.fillStyle = COLORS[it.c] || COLORS.ink;
          const size = it.s * w; ctx.font = `500 ${size}px Geist, system-ui, sans-serif`; ctx.textBaseline = "top";
          it.v.split("\n").forEach((line, k) => ctx.fillText(line, it.x * w, it.y * h + k * size * 1.25));
          continue;
        }
        const hl = it.t === "highlighter";
        ctx.globalAlpha = hl ? 0.38 : 1;
        ctx.strokeStyle = hl ? (HIGHLIGHT[it.c] || HIGHLIGHT.ink) : (COLORS[it.c] || COLORS.ink);
        ctx.lineWidth = it.w * w; ctx.lineCap = hl ? "butt" : "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        it.p.forEach(([x, y], k) => k ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h));
        if (it.p.length === 1) ctx.lineTo(it.p[0][0] * w + 0.1, it.p[0][1] * h);
        ctx.stroke();
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
      p.ink.addEventListener("pointerdown", e => {
        if (this.tool === "hand" || (e.pointerType === "mouse" && e.button !== 0)) return;
        const [x, y] = pos(e);
        if (this.tool === "text") {
          e.preventDefault();
          const items = this.ann[i] || [], hitIdx = items.findIndex(it => it.t === "text" && this.hit(it, x, y, p));
          this.editText(p, i, hitIdx >= 0 ? hitIdx : null, x, y);
          return;
        }
        e.preventDefault(); p.ink.setPointerCapture(e.pointerId);
        if (this.tool === "eraser") { this.snapshot(); erasing = true; this.eraseAt(p, i, x, y); return; }
        cur = { t: this.tool, c: this.color, w: WIDTH[this.tool], p: [[x, y]] };
        this.drawInk(p, i, cur);
      });
      p.ink.addEventListener("pointermove", e => {
        if (erasing) { const [x, y] = pos(e); this.eraseAt(p, i, x, y); return; }
        if (!cur) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs) {
          let [x, y] = pos(ev);
          if (cur.t === "highlighter" && e.shiftKey) y = cur.p[0][1];
          cur.p.push([+x.toFixed(4), +y.toFixed(4)]);
        }
        this.drawInk(p, i, cur);
      });
      const end = () => {
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
      Object.assign(ta.style, { left: it.x * p.w + "px", top: it.y * p.h + "px", fontSize: it.s * p.w + "px", color: COLORS[it.c] });
      p.el.appendChild(ta);
      const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; ta.style.width = "auto"; ta.style.width = Math.min(p.w - it.x * p.w - 4, Math.max(60, ta.scrollWidth + 8)) + "px"; };
      ta.oninput = grow; grow();
      this.editing = { ta, p, i, it, wasExisting: !!existing };
      ta.onkeydown = e => { if (e.key === "Escape") { ta.blur(); } e.stopPropagation(); };
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
      if (!this.bytes) return;
      await loadScript(PDFLIB);
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.load(this.bytes, { ignoreEncryption: true });
      const pages = doc.getPages();
      for (const [i, items] of Object.entries(this.ann)) {
        const page = pages[+i]; if (!page || !items.length) continue;
        const { width, height } = page.getSize(), k = 3;
        const c = document.createElement("canvas"); c.width = width * k; c.height = height * k;
        const ctx = c.getContext("2d"); ctx.scale(k, k);
        this.drawItems(ctx, items, width, height);
        const png = await doc.embedPng(c.toDataURL("image/png"));
        page.drawImage(png, { x: 0, y: 0, width, height });
      }
      const blob = new Blob([await doc.save()], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = this.title.replace(/[^\w\s.-]+/g, " ").replace(/\s+/g, " ").trim() + " (annotated).pdf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  }

  /* ---------- Viewer page ---------- */
  const I = {
    hand: '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1V4.5a1.5 1.5 0 0 1 3 0V10m0-.5V6a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-.5a5 5 0 0 1-4.2-2.3L3.5 12.7a1.5 1.5 0 0 1 2.4-1.8L7 12.5"/>',
    pen: '<path d="M4 16l1-4 8.5-8.5a2.1 2.1 0 0 1 3 3L8 15Z"/><path d="M12 5l3 3"/>',
    highlighter: '<path d="m9 15-4 1 1-4 7.5-7.5 3 3Z"/><path d="M3 18h14" stroke-width="2.4" opacity=".45"/>',
    text: '<path d="M5 5h10M10 5v11M7.5 16h5"/>',
    eraser: '<path d="m7.5 16 -4-4a1.5 1.5 0 0 1 0-2.1l6.4-6.4a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L10.5 16Z"/><path d="M7.5 16H16M6 8.5l5.5 5.5"/>',
    undo: '<path d="M7 7H12a4 4 0 0 1 0 8H8"/><path d="M9.5 4.5 7 7l2.5 2.5"/>',
    redo: '<path d="M13 7H8a4 4 0 0 0 0 8h4"/><path d="M10.5 4.5 13 7l-2.5 2.5"/>',
    minus: '<path d="M5 10h10"/>', plus: '<path d="M5 10h10M10 5v10"/>',
    ms: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M10 4v12"/>',
    down: '<path d="M10 3.5v9m-3.5-3.5L10 12.5l3.5-3.5M4 16.5h12"/>',
    back: '<path d="M12 5 7 10l5 5"/>',
    trash: '<path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5"/>',
  };
  const svg = n => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

  let active = null;

  function mount(root, params) {
    const src = params.get("src"), title = params.get("title") || "Paper", ms = params.get("ms"), back = params.get("back") || "/";
    if (!src) { root.innerHTML = `<div class="vw-status"><p>No paper chosen. <a class="link" href="/">Go home</a></p></div>`; return; }
    root.innerHTML = `<div class="vw">
      <div class="vw-bar">
        <a class="vw-ico" href="${esc(back)}" title="Back" aria-label="Back">${svg("back")}</a>
        <div class="vw-title" title="${esc(title)}">${esc(title)}</div>
        <div class="vw-tools" role="toolbar" aria-label="Annotation tools">
          ${["hand", "pen", "highlighter", "text", "eraser"].map(t => `<button class="vw-ico" data-tool="${t}" title="${{ hand: "Scroll (V)", pen: "Pen (P)", highlighter: "Highlighter (H)", text: "Text (T)", eraser: "Eraser (E)" }[t]}" aria-label="${t}">${svg(t)}</button>`).join("")}
          <span class="vw-sep"></span>
          ${Object.keys(COLORS).map(c => `<button class="vw-color" data-color="${c}" title="${c === "ink" ? "Black" : c[0].toUpperCase() + c.slice(1)}" aria-label="${c}"><i style="background:${COLORS[c]}"></i></button>`).join("")}
          <span class="vw-sep"></span>
          <button class="vw-ico" data-do="undo" title="Undo (Ctrl+Z)" aria-label="Undo">${svg("undo")}</button>
          <button class="vw-ico" data-do="redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">${svg("redo")}</button>
          <button class="vw-ico" data-do="clear" title="Clear all notes" aria-label="Clear all notes">${svg("trash")}</button>
        </div>
        <div class="vw-right">
          <button class="vw-ico" data-do="zoomout" title="Zoom out" aria-label="Zoom out">${svg("minus")}</button>
          <span class="vw-zoom" data-zoom>100%</span>
          <button class="vw-ico" data-do="zoomin" title="Zoom in" aria-label="Zoom in">${svg("plus")}</button>
          ${ms ? `<button class="vw-btn sm" data-do="ms">${svg("ms")}<span>Mark scheme</span></button>` : ""}
          <button class="vw-btn sm" data-do="download" title="Download with your notes">${svg("down")}<span>Download</span></button>
        </div>
      </div>
      <div class="vw-confirm" hidden><span>Clear every note on this paper?</span><button class="vw-btn sm danger" data-do="clear-yes">Clear notes</button><button class="vw-btn sm" data-do="clear-no">Cancel</button></div>
      <div class="vw-body">
        <div class="vw-pane main"></div>
        ${ms ? `<div class="vw-pane ms" hidden><div class="vw-pane-label">Mark scheme <a href="${esc(ms)}" target="_blank" rel="noopener">original ↗</a></div><div class="vw-pane-inner"></div></div>` : ""}
      </div>
      <div class="vw-foot"><span data-save></span><a href="${esc(src)}" target="_blank" rel="noopener">Original file ↗</a></div>
    </div>`;

    const bar = root.querySelector(".vw-bar");
    const sync = () => {
      const p = active.main;
      bar.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === p.tool));
      bar.querySelectorAll("[data-color]").forEach(b => b.classList.toggle("on", b.dataset.color === p.color));
      bar.querySelector('[data-do="undo"]').disabled = !p.undo.length;
      bar.querySelector('[data-do="redo"]').disabled = !p.redo.length;
      bar.querySelector("[data-zoom]").textContent = Math.round(p.zoom * 100) + "%";
      const s = root.querySelector("[data-save]");
      s.textContent = !p.pages.length ? "" : !p.hasNotes() ? "Notes save automatically in this browser" : p.saved === false ? "Couldn't save notes in this browser" : "Notes saved in this browser";
    };
    active = { root };
    active.main = new Pane(root.querySelector(".vw-pane.main"), { src, title, annotate: true, onChange: () => active && sync() });
    sync();

    bar.addEventListener("click", async e => {
      const b = e.target.closest("button"); if (!b) return;
      const p = active.main;
      if (b.dataset.tool) p.setTool(b.dataset.tool);
      if (b.dataset.color) { p.color = b.dataset.color; if (p.tool === "hand" || p.tool === "eraser") p.setTool("pen"); else sync(); }
      const act = b.dataset.do;
      if (act === "undo") p.doUndo();
      if (act === "redo") p.doRedo();
      if (act === "clear") root.querySelector(".vw-confirm").hidden = false;
      if (act === "zoomin") p.setZoom(p.zoom + 0.2);
      if (act === "zoomout") p.setZoom(p.zoom - 0.2);
      if (act === "ms") toggleMs(b);
      if (act === "download") {
        const label = b.querySelector("span"), old = label.textContent;
        label.textContent = "Preparing…"; b.disabled = true;
        try { await p.download(); label.textContent = "Downloaded"; } catch (err) { console.error(err); label.textContent = "Download failed"; }
        setTimeout(() => { label.textContent = old; b.disabled = false; }, 1800);
      }
    });
    root.querySelector(".vw-confirm").addEventListener("click", e => {
      const act = e.target.closest("button")?.dataset.do; if (!act) return;
      if (act === "clear-yes") active.main.clearAll();
      root.querySelector(".vw-confirm").hidden = true;
    });

    function toggleMs(btn) {
      const pane = root.querySelector(".vw-pane.ms"), body = root.querySelector(".vw-body");
      const show = pane.hidden; pane.hidden = !show; body.classList.toggle("split", show); btn.classList.toggle("on", show);
      if (show && !active.ms) active.ms = new Pane(pane.querySelector(".vw-pane-inner"), { src: ms, title: "Mark scheme", annotate: false });
      setTimeout(() => { active.main.layout(); active.ms?.pages.length && active.ms.layout(); }, 0);
    }

    let rt; window.addEventListener("resize", active.onResize = () => { clearTimeout(rt); rt = setTimeout(() => { active?.main.pages.length && active.main.layout(); active?.ms?.pages.length && active.ms.layout(); }, 150); });
    document.addEventListener("keydown", active.onKey = e => {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || !document.querySelector("#scrim").hidden) return;
      const p = active.main, k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); e.shiftKey ? p.doRedo() : p.doUndo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "y") { e.preventDefault(); p.doRedo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map = { v: "hand", p: "pen", h: "highlighter", t: "text", e: "eraser" };
      if (map[k]) p.setTool(map[k]);
      if (k === "=" || k === "+") p.setZoom(p.zoom + 0.2);
      if (k === "-") p.setZoom(p.zoom - 0.2);
    });
  }

  function unmount() {
    if (!active) return;
    active.main?.commitText();
    window.removeEventListener("resize", active.onResize);
    document.removeEventListener("keydown", active.onKey);
    active = null;
  }

  window.Viewer = { mount, unmount };
})();
