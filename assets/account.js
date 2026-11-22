/* Accounts: sign in with Google, the teacher's page (students, work set, how each student got on) and the
   student's My work. Talks to /api (functions/api). The rest of the site works the same signed in or not.
   app.js calls GSHAccount.init(helpers) and hands it the /sign-in, /my-work, /teacher and /privacy pages. */
(() => {
  const A = window.GSHAccount = {};
  let G = null, user = null, cfg = null;
  try { user = JSON.parse(localStorage.getItem("gsh-user") || "null"); } catch (e) {}
  const remember = u => { user = u; try { u ? localStorage.setItem("gsh-user", JSON.stringify({ name: u.name, role: u.role, email: u.email })) : localStorage.removeItem("gsh-user"); } catch (e) {} };
  const $ = s => document.querySelector(s);

  async function api(path, method = "GET", body) {
    let r;
    try { r = await fetch("/api/" + path, { method, credentials: "same-origin", headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch (e) { throw Object.assign(new Error("Can't reach the site. Check your connection."), { status: 0 }); }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      if (r.status === 401 && user) { remember(null); header(); }
      throw Object.assign(new Error(j.message || (r.status === 404 ? "Sign-in isn't available on this copy of the site." : "Something went wrong. Try again.")), { status: r.status, code: j.error });
    }
    return j;
  }

  A.user = () => user;
  A.isTeacher = () => user?.role === "teacher";
  A.isStudent = () => user?.role === "student";
  A.init = helpers => {
    G = helpers; header();
    api("me").then(j => { const was = JSON.stringify(user); remember(j.user); header(); if (was !== JSON.stringify(user)) G.refresh(); }).catch(() => {});
  };

  /* ---------- Top bar: Sign in, or the signed-in person's initial with a small menu ---------- */
  const initials = n => (String(n || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2) || "?").toUpperCase();
  function header() {
    const slot = $("#acct"); if (!slot) return;
    if (!user) {
      slot.innerHTML = `<a class="acct-in" href="/sign-in"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="7" r="3.2"/><path d="M3.8 16.5c.9-3 3.3-4.5 6.2-4.5s5.3 1.5 6.2 4.5" stroke-linecap="round"/></svg><span>Sign in</span></a>`;
      return;
    }
    const home = user.role === "teacher" ? ["/teacher", "Teacher"] : ["/my-work", "My work"];
    slot.innerHTML = `<details class="acct-menu"><summary class="acct-av" aria-label="Your account: ${G.esc(user.name)}" title="${G.esc(user.name)}">${G.esc(initials(user.name))}</summary>
      <div class="acct-pop"><div class="acct-who"><b>${G.esc(user.name)}</b><small>${G.esc(user.email)}</small></div>
        <a href="${home[0]}">${home[1]}</a>${user.role === "teacher" ? `<a href="/teacher?tab=students">Students</a>` : ""}
        <button type="button" data-acct-out>Sign out</button></div></details>`;
  }
  async function signOut() {
    try { await api("auth/logout", "POST", {}); } catch (e) {}
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch (e) {}
    remember(null); header(); G.go("/");
  }
  document.addEventListener("click", e => {
    document.querySelectorAll("details.acct-menu[open]").forEach(d => { if (!d.contains(e.target) || e.target.closest(".acct-pop a")) d.open = false; });
    if (e.target.closest("[data-acct-out]")) signOut();
  });

  /* ---------- Small helpers ---------- */
  const day = d => d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
  const today = () => new Date().toISOString().slice(0, 10);
  const when = t => {
    if (!t) return "Not signed in yet";
    const s = Date.now() / 1000 - t;
    return s < 3600 ? "Active just now" : s < 86400 ? `Active ${Math.round(s / 3600)}h ago` : s < 86400 * 30 ? `Active ${Math.round(s / 86400)}d ago` : "Active " + new Date(t * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  const dueTag = (a, done) => !a.due ? "" : `<span class="aw-due ${!done && a.due < today() ? "late" : ""}">${!done && a.due < today() ? "Overdue · " : "Due "}${day(a.due)}</span>`;
  const bankName = k => { try { return G.qbLabel(k); } catch (e) { return ""; } };
  const what = a => a.kind === "paper" ? `Past paper${a.payload.desc ? " · " + a.payload.desc : ""}` : `${a.payload.items.length} question${a.payload.items.length === 1 ? "" : "s"}${a.payload.marks ? ` · ${a.payload.marks} marks` : ""}${a.bank ? " · " + bankName(a.bank) : ""}`;
  /* WhatsApp: opens a chat picker with the message written; the teacher chooses who gets it */
  const WA_ICON = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 3.2a6.8 6.8 0 0 0-5.9 10.2L3.3 16.8l3.5-.8A6.8 6.8 0 1 0 10 3.2Z" stroke-linejoin="round"/></svg>`;
  const waLink = (text, label) => `<a class="qb-btn wa" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${WA_ICON}${label}</a>`;
  const first = s => String(s.name || "").trim().split(/\s+/)[0];
  const inviteText = s => `Hi${first(s) ? " " + first(s) : ""}, I've added you on Ghelli Study Hub, where I'll set your work. Sign in with your Google account (${s.email}) here: ${location.origin}/sign-in`;
  const workText = a => `New work on Ghelli Study Hub: ${a.title}${a.due ? `, due ${day(a.due)}` : ""}. Sign in to start: ${location.origin}/my-work`;
  const workHref = a => { const [l, t, s] = (a.bank || "").split("/"); return `${G.url.qbank(l, t, s)}?a=${a.id}`; };
  /* got it / partly / missed out of n, as a bar */
  const tally = (marks, n) => { const c = { got: 0, part: 0, miss: 0, skip: 0 }; Object.values(marks || {}).forEach(v => c[v] = (c[v] || 0) + 1); c.n = n; c.marked = c.got + c.part + c.miss + c.skip; return c; };
  const bar = c => c.n ? `<span class="qb-bar aw-bar">${["got", "part", "miss"].map(v => c[v] ? `<b class="b-${v}" style="width:${c[v] / c.n * 100}%"></b>` : "").join("")}</span>` : "";
  const loading = t => `<p class="aw-empty">${t || "Loading…"}</p>`;
  const errBox = e => `<p class="aw-empty aw-err">${G.esc(e.message || e)}</p>`;
  function dialog(html, onclick) {
    const d = document.createElement("div"); d.className = "qb-dlg-wrap"; d.innerHTML = html; document.body.appendChild(d);
    const close = () => d.remove();
    d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-x]")) close(); else onclick && onclick(e, close, d); });
    d.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    return { d, close };
  }
  function confirmBox(title, text, yes, fn) {
    const { d } = dialog(`<div class="qb-dlg" role="alertdialog" aria-modal="true"><h2>${G.esc(title)}</h2><p class="qb-sv-none">${text}</p>
      <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Cancel</button><button type="button" class="qb-btn danger" data-yes>${G.esc(yes)}</button></div></div>`,
      async (e, close) => { const b = e.target.closest("[data-yes]"); if (!b) return; b.disabled = true; try { await fn(); close(); } catch (err) { G.toast(err.message); b.disabled = false; } });
    d.querySelector("[data-yes]").focus();
  }

  /* ---------- Pages ---------- */
  A.view = kind => {
    const titles = { "sign-in": "Sign in", "my-work": "My work", teacher: "Teacher", privacy: "Privacy policy" };
    G.crumbs([{ t: titles[kind] }]); G.setTitle(titles[kind]);
    setTimeout(() => ({ "sign-in": mountSignIn, "my-work": mountMyWork, teacher: mountTeacher, privacy: mountPrivacy })[kind](), 0);
    return `<div class="acct-page" id="acct-page">${kind === "privacy" ? "" : loading()}</div>`;
  };
  const page = () => $("#acct-page");

  async function mountPrivacy() {
    const box = page(); if (!box) return;
    try { box.innerHTML = await (await fetch("/assets/privacy.html")).text(); }
    catch (e) { box.innerHTML = errBox("The privacy policy couldn't load. Check your connection and refresh."); }
  }

  /* Sign in: Google's button (its script loads only on this page) */
  async function mountSignIn() {
    const box = page(); if (!box) return;
    if (user) return G.go(user.role === "teacher" ? "/teacher" : "/my-work", true);
    box.innerHTML = `<div class="acct-card">
      <h1>Sign in</h1>
      <p class="lede">For students and teachers of Ghelli tutoring. Teachers set work here, and students see what's due and mark how they got on.</p>
      <div class="acct-g" id="acct-g">${loading()}</div>
      <p class="acct-err" id="acct-err" role="alert" hidden></p>
      <ul class="acct-notes">
        <li><b>Students:</b> use the Google account your teacher added. If you don't have one, ask your teacher or a parent.</li>
        <li>You don't need an account for the rest of the site: question banks, past papers and quizzes are free and open.</li>
        <li>We only get your name and email from Google. Read the <a class="link" href="/privacy">privacy policy</a>.</li>
      </ul></div>`;
    const err = m => { const el = $("#acct-err"); if (el) { el.hidden = !m; el.textContent = m || ""; } };
    try { cfg = cfg || await api("config"); }
    catch (e) { $("#acct-g").innerHTML = errBox(e.status === 404 || e.status === 503 ? "Signing in isn't switched on yet." : e); return; }
    const done = async (path, body) => {
      err("");
      try { const j = await api(path, "POST", body); remember(j.user); header(); G.go(j.user.role === "teacher" ? "/teacher" : "/my-work", true); }
      catch (e) { err(e.message); }
    };
    const g = $("#acct-g");
    if (cfg.googleClientId) {
      g.innerHTML = `<div id="acct-gbtn"></div>`;
      const start = () => {
        google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: r => done("auth/google", { credential: r.credential }), ux_mode: "popup", auto_select: false, itp_support: true });
        google.accounts.id.renderButton($("#acct-gbtn"), { theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline", size: "large", shape: "pill", text: "signin_with", logo_alignment: "left", width: 280 });
      };
      if (window.google?.accounts?.id) start();
      else {
        const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = start;
        s.onerror = () => { g.innerHTML = errBox("Google's sign-in button couldn't load. Check your connection, or turn off any blocker for this site."); };
        document.head.appendChild(s);
      }
    } else if (!cfg.dev) g.innerHTML = errBox("Signing in isn't switched on yet.");
    else g.innerHTML = "";
    /* only on a test copy of the site: sign in with any email */
    if (cfg.dev) {
      g.insertAdjacentHTML("beforeend", `<form class="acct-dev" id="acct-dev"><label class="qb-field"><span>Test sign-in <small>Only on this test copy</small></span><input name="email" type="email" placeholder="teacher@example.com" required></label><button class="qb-btn primary">Sign in</button></form>`);
      $("#acct-dev").onsubmit = e => { e.preventDefault(); done("auth/dev", { email: e.target.email.value }); };
    }
  }

  /* My work: what's due, then what's done */
  async function mountMyWork() {
    const box = page(); if (!box) return;
    if (!user) return G.go("/sign-in", true);
    if (user.role === "teacher") return G.go("/teacher", true);
    let list;
    try { list = (await api("assignments")).assignments; } catch (e) { box.innerHTML = errBox(e); return; }
    const todo = list.filter(a => a.status !== "done").sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.created - b.created);
    const done = list.filter(a => a.status === "done").sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const row = a => {
      const isDone = a.status === "done", n = a.kind === "qs" ? a.payload.items.length : 0;
      const state = a.kind === "paper" ? (isDone ? `Done${a.score != null ? ` · ${a.score}${a.total ? "/" + a.total : ""} marks` : ""}` : "Not done yet")
        : isDone ? `Done · ${a.marked} of ${n} marked` : a.marked ? `${a.marked} of ${n} marked` : "Not started";
      const go = a.kind === "paper" ? `<button type="button" class="qb-btn ${isDone ? "" : "primary"}" data-aw-paper="${a.id}">${isDone ? "Open" : "Start"}</button>`
        : `<a class="qb-btn ${isDone ? "" : "primary"}" href="${workHref(a)}">${isDone ? "Review" : a.marked ? "Continue" : "Start"}</a>`;
      return `<li class="aw-row ${isDone ? "done" : ""}"><span class="aw-main"><b>${G.esc(a.title)}</b><small>${G.esc(what(a))}</small><small class="aw-state">${dueTag(a, isDone)}${G.esc(state)}</small></span>${go}</li>`;
    };
    box.innerHTML = `<h1>My work</h1>
      <p class="lede">${todo.length ? `You have ${todo.length} piece${todo.length === 1 ? "" : "s"} of work to do.` : list.length ? "All done. Nice work." : "Nothing set yet. Work your teacher sets shows up here."}</p>
      ${todo.length ? `<h2>To do</h2><ul class="aw-list">${todo.map(row).join("")}</ul>` : ""}
      ${done.length ? `<h2>Done</h2><ul class="aw-list">${done.map(row).join("")}</ul>` : ""}
      <p class="aw-foot">Signed in as ${G.esc(user.email)} · <button type="button" class="qb-link" data-acct-out>Sign out</button> · <button type="button" class="qb-link" data-aw-delete>Delete my account</button> · <a class="link" href="/privacy">Privacy</a></p>`;
    box.onclick = e => {
      const p = e.target.closest("[data-aw-paper]");
      if (p) return paperDialog(list.find(a => a.id === +p.dataset.awPaper));
      if (e.target.closest("[data-aw-delete]")) confirmBox("Delete your account?", "This removes your account and everything recorded for it: the work set for you and how you marked it. Your teacher will no longer see it. This can't be undone.", "Delete my account",
        async () => { await api("me", "DELETE", {}); remember(null); header(); G.toast("Your account was deleted"); G.go("/"); });
    };
  }
  /* a past paper set as work: open it, then say it's done and (optionally) the marks */
  function paperDialog(a) {
    const p = a.payload, isDone = a.status === "done";
    const { close, d } = dialog(`<form class="qb-dlg" role="dialog" aria-modal="true" aria-labelledby="aw-p-h">
      <h2 id="aw-p-h">${G.esc(a.title)}</h2>
      <p class="qb-sv-none">${G.esc(p.name || "Past paper")}${a.due ? ` · due ${day(a.due)}` : ""}</p>
      <p class="qb-sv-none">Write your answers on the paper with <b>Write on it</b> (best with a stylus or mouse), or on paper as usual. What you write on it saves to your account and your teacher can see it.</p>
      <div class="aw-open"><button type="button" class="qb-btn primary" data-aw-open="qp">Open the paper</button>${p.ms ? `<button type="button" class="qb-btn" data-aw-open="ms">Open the mark scheme</button>` : ""}</div>
      <div class="aw-score"><label class="qb-field"><span>Your marks <small>After marking it with the mark scheme (optional)</small></span>
        <span class="aw-of"><input name="score" type="number" min="0" max="1000" inputmode="numeric" value="${a.score ?? ""}"> out of <input name="total" type="number" min="0" max="1000" inputmode="numeric" value="${a.total ?? ""}"></span></label></div>
      <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Close</button>${isDone ? `<button type="button" class="qb-btn" data-aw-undo>Not done after all</button>` : ""}<button type="submit" class="qb-btn primary">${isDone ? "Save marks" : "Mark as done"}</button></div></form>`,
      async (e, close) => {
        const o = e.target.closest("[data-aw-open]");
        if (o) { close(); if (o.dataset.awOpen === "ms") window.Viewer?.open({ src: p.ms, title: `${p.name} mark scheme`, desc: p.desc }); else A.openWithInk({ src: p.src, title: p.name, desc: p.desc, ms: p.ms }, a.id); return; }
        if (e.target.closest("[data-aw-undo]")) { try { await api(`assignments/${a.id}/done`, "PUT", { undo: true }); close(); mountMyWork(); } catch (err) { G.toast(err.message); } }
      });
    d.querySelector("form").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try { await api(`assignments/${a.id}/done`, "PUT", { score: f.score.value, total: f.total.value }); close(); G.toast(isDone ? "Marks saved" : "Marked as done"); mountMyWork(); }
      catch (err) { G.toast(err.message); }
    };
  }

  /* ---------- Writing on papers of set work: saved to the account (gzip-packed) so the teacher can see it ---------- */
  const hasInk = ann => Object.values(ann || {}).some(a => a && a.length);
  const b64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  async function pack(ann) {
    if (!hasInk(ann)) return "";
    const j = JSON.stringify(ann);
    if (!window.CompressionStream) return "js:" + j;
    return "gz:" + b64(await new Response(new Blob([j]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  }
  async function unpack(d) {
    if (!d) return null;
    if (d.startsWith("js:")) return JSON.parse(d.slice(3));
    const bytes = Uint8Array.from(atob(d.slice(3)), c => c.charCodeAt(0));
    return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  }
  /* a student opening a paper of their work: their saved writing comes back, and what they write saves as they go */
  A.openWithInk = async (info, workId) => {
    let initial = null;
    try { initial = await unpack((await api(`assignments/${workId}/ink?src=${encodeURIComponent(info.src)}`)).data); }
    catch (e) { G.toast("Couldn't load your saved writing: " + e.message); }
    window.Viewer?.open({ ...info, inkSync: { initial, save: async ann => api(`assignments/${workId}/ink`, "PUT", { src: info.src, data: await pack(ann) }) } });
  };
  /* the teacher: one student's writing on one paper, read-only */
  async function viewInk(aid, sid, name, info) {
    try {
      const j = await api(`assignments/${aid}/ink?student=${sid}&src=${encodeURIComponent(info.src)}`), ann = await unpack(j.data);
      if (!ann) { G.toast("Nothing written on that paper"); return; }
      window.Viewer?.open({ ...info, title: `${name}'s writing · ${info.title}`, view: { ann, label: `${name}'s writing · view only` } });
    } catch (e) { G.toast(e.message); }
  }

  /* ---------- Work in the question bank (app.js runs it as a quiz over the set questions) ---------- */
  A.loadWork = async id => { const j = await api("assignments/" + +id); return { ...j.assignment, marks: j.marks || {} }; };
  const pending = {};
  A.mark = (id, item, mark) => {
    /* the latest mark for a question wins; a failed save is retried once */
    const k = id + ":" + item; clearTimeout(pending[k]);
    pending[k] = setTimeout(() => api(`assignments/${id}/mark`, "PUT", { item, mark: mark || null }).catch(() => setTimeout(() => api(`assignments/${id}/mark`, "PUT", { item, mark: mark || null }).catch(e => G.toast("Couldn't save your mark: " + e.message)), 3000)), 250);
  };
  A.finish = (id, got, n) => api(`assignments/${id}/done`, "PUT", { score: got, total: n }).then(() => G.toast("Saved · your teacher can see how it went")).catch(e => G.toast("Couldn't save: " + e.message));

  /* ---------- Teacher ---------- */
  let students = null;
  const loadStudents = async force => (students = !force && students ? students : (await api("students")).students);

  /* set work: from the worksheet (questions) or the past papers page (one paper) */
  A.assignDialog = async o => {
    if (!A.isTeacher()) return;
    let list;
    try { list = await loadStudents(true); } catch (e) { G.toast(e.message); return; }
    const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const papers = o.kind === "paper" ? o.papers : null;
    const { close, d } = dialog(`<form class="qb-dlg aw-assign" role="dialog" aria-modal="true" aria-labelledby="aw-a-h">
      <h2 id="aw-a-h">${papers ? "Assign a past paper" : "Assign these questions"}</h2>
      ${papers ? `<label class="qb-field"><span>Paper</span><select name="paper" class="aw-select">${papers.map((p, k) => `<option value="${k}">${G.esc(p.name)}</option>`).join("")}</select></label>`
        : `<p class="qb-sv-none">${G.esc(o.summary)}. Students work through them one at a time and mark each against the mark scheme.</p>`}
      <label class="qb-field"><span>Title <small>What students see</small></span><input name="title" maxlength="120" required value="${G.esc(papers ? papers[0].name : o.title)}"></label>
      <label class="qb-field"><span>Due</span><input name="due" type="date" value="${due}"></label>
      <fieldset class="aw-who"><legend>Students</legend>
        ${list.length ? `<label class="qb-specopt aw-all"><input type="checkbox" data-aw-all><b></b><span>All ${list.length} students</span></label>
          <div class="aw-slist">${list.map(s => `<label class="qb-specopt"><input type="checkbox" name="s" value="${s.id}"><b></b><span>${G.esc(s.name || s.email)}</span><small>${G.esc(s.name ? s.email : "")}</small></label>`).join("")}</div>`
          : `<p class="qb-sv-none">No students yet. <a class="link" href="/teacher?tab=students">Add your students</a> first, using the Google email each one signs in with.</p>`}
      </fieldset>
      <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Cancel</button><button type="submit" class="qb-btn primary" ${list.length ? "" : "disabled"}>Assign</button></div></form>`,
      (e, close) => { if (e.target.closest("a.link, a[href='/teacher']")) close(); });
    const f = d.querySelector("form"), boxes = () => [...f.querySelectorAll("[name=s]")];
    f.title.focus(); f.title.select();
    f.addEventListener("change", e => {
      if (e.target.matches("[data-aw-all]")) boxes().forEach(b => b.checked = e.target.checked);
      else if (e.target.name === "s") { const all = f.querySelector("[data-aw-all]"); if (all) all.checked = boxes().every(b => b.checked); }
      if (e.target.name === "paper" && papers) f.title.value = papers[+e.target.value].name;
    });
    f.onsubmit = async e => {
      e.preventDefault();
      const ids = boxes().filter(b => b.checked).map(b => +b.value);
      if (!ids.length) { G.toast("Tick at least one student"); return; }
      const btn = f.querySelector("[type=submit]"); btn.disabled = true;
      const body = papers ? { kind: "paper", title: f.title.value, due: f.due.value, students: ids, payload: papers[+f.paper.value] }
        : { kind: "qs", title: f.title.value, due: f.due.value, students: ids, bank: o.bank, payload: o.payload };
      try {
        await api("assignments", "POST", body);
        const names = list.filter(st => ids.includes(st.id)).map(st => st.name || st.email);
        f.innerHTML = `<h2>Assigned</h2>
          <p class="qb-sv-none"><b>${G.esc(f.title.value)}</b> is now on ${ids.length === 1 ? `${G.esc(names[0])}'s My work page` : `My work for all ${ids.length} students`}. Students aren't told automatically, so let them know.</p>
          <div class="aw-open">${waLink(workText({ title: body.title, due: body.due }), "Share on WhatsApp")}</div>
          <div class="qb-dlg-btns"><a class="qb-btn" href="/teacher">See it on your Teacher page</a><button type="button" class="qb-btn primary" data-x>Done</button></div>`;
        f.querySelector("[data-x]").focus();
      }
      catch (err) { G.toast(err.message); btn.disabled = false; }
    };
  };

  const banks = {};
  const bankData = async k => { const src = G.S.qbanks?.[k]; if (!src) return null; return banks[src] ||= fetch(src).then(r => r.json()).catch(() => null); };
  const qLabel = (it, id) => it ? `${it.series} · ${it.paper} · Q${it.q}${it.part ? ` (${it.part})` : ""}` : id;
  const MK = { got: "Got it", part: "Partly", miss: "Missed it", skip: "Skipped" };

  async function mountTeacher() {
    const box = page(); if (!box) return;
    if (!user) return G.go("/sign-in", true);
    if (user.role !== "teacher") return G.go("/my-work", true);
    const tab = new URLSearchParams(location.search).get("tab") === "students" ? "students" : "work";
    const tabs = `<div class="aw-tabs" role="tablist">${[["work", "Work set"], ["students", "Students"]].map(([k, l]) => `<a class="aw-tab ${k === tab ? "on" : ""}" href="/teacher${k === "work" ? "" : "?tab=" + k}" role="tab" aria-selected="${k === tab}">${l}</a>`).join("")}</div>`;
    box.innerHTML = `<h1>Teacher</h1>${tabs}<div id="aw-body">${loading()}</div>`;
    const body = $("#aw-body");
    try { tab === "students" ? await drawStudents(body) : await drawWork(body); } catch (e) { body.innerHTML = errBox(e); }
  }

  async function drawWork(body) {
    const [{ assignments: list }, sts] = await Promise.all([api("assignments"), loadStudents(true)]);
    const how = `<div class="aw-how"><b>To set work</b>
      <span><b>Questions:</b> open a <a class="link" href="/question-banks">question bank</a>, add questions to a worksheet, then choose <b>Assign</b> on the worksheet bar.</span>
      <span><b>A past paper:</b> open a subject's Past papers and choose <b>Assign a paper</b>.</span>
      ${sts.length ? "" : `<span>First, <a class="link" href="/teacher?tab=students">add your students</a>.</span>`}</div>`;
    if (!list.length) { body.innerHTML = `<p class="lede">Nothing set yet.</p>${how}`; return; }
    body.innerHTML = `<ul class="aw-list">${list.map(a => `<li class="aw-row aw-t" data-aw-a="${a.id}">
        <button type="button" class="aw-main aw-toggle" aria-expanded="false"><b>${G.esc(a.title)}</b><small>${G.esc(what(a))}</small><small class="aw-state">${dueTag(a, a.done === a.students)}${a.done} of ${a.students} done</small></button>
        <span class="aw-count ${a.done === a.students ? "all" : ""}">${a.done}/${a.students}</span>
        <div class="aw-detail" hidden></div></li>`).join("")}</ul>${how}`;
    body.onclick = async e => {
      const t = e.target.closest(".aw-toggle");
      if (t) {
        const li = t.closest("[data-aw-a]"), det = li.querySelector(".aw-detail"), open = det.hidden;
        det.hidden = !open; t.setAttribute("aria-expanded", open); li.classList.toggle("aw-on", open);
        if (open && !det.dataset.done) { det.innerHTML = loading(); try { await drawDetail(det, +li.dataset.awA); det.dataset.done = 1; } catch (err) { det.innerHTML = errBox(err); } }
        return;
      }
      const del = e.target.closest("[data-aw-del]");
      if (del) confirmBox("Delete this work?", "It disappears for every student it was set for, along with their marks. This can't be undone.", "Delete", async () => { await api("assignments/" + del.dataset.awDel, "DELETE", {}); G.toast("Deleted"); drawWork(body); });
      const sm = e.target.closest("[data-aw-sm]");
      if (sm) { const el = sm.parentElement.querySelector(".aw-marks"); el.hidden = !el.hidden; sm.textContent = el.hidden ? "Show questions" : "Hide questions"; }
    };
  }
  /* one piece of work: each student's status, marks and, for questions, how they marked each one */
  async function drawDetail(det, id) {
    const j = await api("assignments/" + id), a = j.assignment, data = a.kind === "qs" ? await bankData(a.bank) : null;
    const item = iid => data?.items.find(x => x.id === iid);
    const n = a.kind === "qs" ? a.payload.items.length : 0;
    const rows = j.students.map(s => {
      const c = tally(s.marks, n), name = G.esc(s.name || s.email);
      const status = s.status === "done" ? `Done ${s.done_at ? new Date(s.done_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}` : s.status === "started" ? "Started" : "Not started";
      const result = a.kind === "paper" ? (s.score != null ? `${s.score}${s.total ? "/" + s.total : ""} marks` : "")
        : c.marked ? `${c.got} got it · ${c.part} partly · ${c.miss} missed${c.skip ? ` · ${c.skip} skipped` : ""}` : "";
      const marks = a.kind === "qs" && c.marked ? `<button type="button" class="qb-link" data-aw-sm>Show questions</button><ol class="aw-marks" hidden>${a.payload.items.map(x => {
        const m = s.marks[x.id]; return `<li><span>${G.esc(qLabel(item(x.id), x.id))}${x.parts ? ` · part${x.parts.length > 1 ? "s" : ""} ${x.parts.join(", ")}` : ""}</span><span class="qb-stbadge">${m ? `<span class="b-${m}">${MK[m]}</span>` : `<span class="b-skip">Not marked</span>`}</span></li>`; }).join("")}</ol>` : "";
      /* papers this student wrote on: the paper itself, or for questions each paper a question came from */
      const inkBtns = (s.ink || []).map(k => {
        const it = data?.items.find(x => x.src === k.src), label = a.kind === "paper" ? "See their writing" : `See their writing${it ? ` · ${it.series} ${it.paper}` : ""}`;
        const info = a.kind === "paper" ? { src: k.src, title: a.payload.name, desc: a.payload.desc, ms: a.payload.ms } : { src: k.src, title: it ? `${it.series} · ${it.paper}` : "Paper", desc: data?.label || "", ms: it?.ms || "" };
        return `<button type="button" class="qb-btn aw-ink" data-aw-ink='${G.esc(JSON.stringify({ sid: s.id, name: s.name || s.email, info }))}'>${label}</button>`;
      }).join("");
      return `<li class="aw-srow ${s.status}"><span class="aw-sname"><b>${name}</b><small>${status}</small></span><span class="aw-sres">${a.kind === "qs" ? bar(c) : ""}<small>${result}</small></span>${inkBtns ? `<span class="aw-inks">${inkBtns}</span>` : ""}${marks}</li>`;
    }).join("");
    det.innerHTML = `<ul class="aw-slist2">${rows}</ul>
      <div class="aw-dacts">${waLink(workText(a), "Share on WhatsApp")}${a.kind === "qs" ? `<a class="qb-btn" href="${workHref(a)}">See the questions</a>` : `<button type="button" class="qb-btn" data-aw-view='${G.esc(JSON.stringify(a.payload))}'>Open the paper</button>`}
        <button type="button" class="qb-btn danger" data-aw-del="${a.id}">Delete</button></div>`;
    det.querySelectorAll("[data-aw-ink]").forEach(b => b.addEventListener("click", () => { const k = JSON.parse(b.dataset.awInk); viewInk(a.id, k.sid, k.name, k.info); }));
    det.querySelector("[data-aw-view]")?.addEventListener("click", e => { const p = JSON.parse(e.currentTarget.dataset.awView); window.Viewer?.open({ src: p.src, title: p.name, desc: p.desc, ms: p.ms }); });
  }

  async function drawStudents(body) {
    const list = await loadStudents(true);
    body.innerHTML = `<form class="aw-add" id="aw-add">
        <label class="qb-field"><span>Name</span><input name="name" maxlength="100" placeholder="Sara Khan" autocomplete="off"></label>
        <label class="qb-field"><span>Google email <small>The account they sign in with</small></span><input name="email" type="email" required placeholder="sara@gmail.com" autocomplete="off"></label>
        <button class="qb-btn primary">Add student</button></form>
      <p class="aw-hint">Students sign in with that Google account at <b>${G.esc(location.host)}/sign-in</b>. Nobody else can sign in as a student.</p>
      ${list.length ? `<h2>${list.length} student${list.length === 1 ? "" : "s"}</h2><ul class="aw-list">${list.map(s => `<li class="aw-row aw-t" data-aw-s="${s.id}">
          <button type="button" class="aw-main aw-stoggle" aria-expanded="false"><b>${G.esc(s.name || s.email)}</b><small>${G.esc(s.name ? s.email : "")}</small><small class="aw-state">${when(s.last_seen)} · ${s.done} of ${s.assigned} done</small></button>
          <span class="aw-count ${s.assigned && s.done === s.assigned ? "all" : ""}">${s.done}/${s.assigned}</span>
          <div class="aw-detail" hidden></div></li>`).join("")}</ul>` : `<p class="aw-empty">No students yet. Add one above.</p>`}`;
    $("#aw-add").onsubmit = async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector("button"); b.disabled = true;
      try {
        const added = { name: f.name.value.trim(), email: f.email.value.trim().toLowerCase() };
        await api("students", "POST", added); await drawStudents(body);
        body.querySelector(".aw-hint").insertAdjacentHTML("beforebegin", `<div class="aw-added" role="status"><span><b>${G.esc(added.name || added.email)}</b> added. They aren't told automatically, so send them the sign-in link.</span>${waLink(inviteText(added), "Send invite on WhatsApp")}</div>`);
        body.querySelector("[name=name]")?.focus();
      }
      catch (err) { G.toast(err.message); b.disabled = false; }
    };
    body.onclick = async e => {
      const t = e.target.closest(".aw-stoggle");
      if (t) {
        const li = t.closest("[data-aw-s]"), det = li.querySelector(".aw-detail"), open = det.hidden;
        det.hidden = !open; t.setAttribute("aria-expanded", open); li.classList.toggle("aw-on", open);
        if (open) { det.innerHTML = loading(); try { await drawStudent(det, +li.dataset.awS); } catch (err) { det.innerHTML = errBox(err); } }
        return;
      }
      const rn = e.target.closest("[data-aw-rename]");
      if (rn) {
        const sid = +rn.dataset.awRename, s = students.find(x => x.id === sid);
        const { d, close } = dialog(`<form class="qb-dlg" role="dialog" aria-modal="true"><h2>Rename</h2><label class="qb-field"><span>Name</span><input name="name" maxlength="100" value="${G.esc(s?.name || "")}"></label>
          <div class="qb-dlg-btns"><button type="button" class="qb-btn" data-x>Cancel</button><button class="qb-btn primary">Save</button></div></form>`);
        const f = d.querySelector("form"); f.name.focus(); f.name.select();
        f.onsubmit = async ev => { ev.preventDefault(); try { await api("students/" + sid, "PATCH", { name: f.name.value }); close(); drawStudents(body); } catch (err) { G.toast(err.message); } };
      }
      const rm = e.target.closest("[data-aw-remove]");
      if (rm) confirmBox("Remove this student?", "Their account is deleted, with the work set for them and their marks. They can no longer sign in. This can't be undone.", "Remove", async () => { await api("students/" + rm.dataset.awRemove, "DELETE", {}); G.toast("Student removed"); drawStudents(body); });
    };
  }
  async function drawStudent(det, id) {
    const j = await api("students/" + id), work = j.work;
    det.innerHTML = `${work.length ? `<ul class="aw-slist2">${work.map(w => {
        const n = w.kind === "qs" ? JSON.parse(w.payload || "{}").items?.length : 0;
        const st = w.status === "done" ? "Done" : w.status === "started" ? "Started" : "Not started";
        const res = w.kind === "paper" ? (w.score != null ? ` · ${w.score}${w.total ? "/" + w.total : ""} marks` : "") : w.marked ? ` · ${w.marked} marked` : "";
        return `<li class="aw-srow ${w.status}"><span class="aw-sname"><b>${G.esc(w.title)}</b><small>${st}${res}</small></span><span class="aw-sres"><small>${w.due ? `Due ${day(w.due)}` : ""}</small></span></li>`;
      }).join("")}</ul>` : `<p class="aw-empty">No work set yet.</p>`}
      <div class="aw-dacts">${waLink(inviteText(j.student), "Send invite on WhatsApp")}<button type="button" class="qb-btn" data-aw-rename="${id}">Rename</button><button type="button" class="qb-btn danger" data-aw-remove="${id}">Remove student</button></div>`;
  }
})();
