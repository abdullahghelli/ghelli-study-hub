/* Ghelli Study Hub accounts: Google sign-in, teachers, students and the work set for them.

   Runs as a Cloudflare Pages Function for every /api/... request; the rest of the site stays plain static pages.
   Needs, in the Pages project's settings:
     DB                a D1 database binding (its tables are made on first use)
     GOOGLE_CLIENT_ID  the OAuth client ID from Google Cloud Console (Web application)
     TEACHER_EMAILS    Google account emails that sign in as teachers, comma separated
   Only for testing on a computer, never on the live site:
     DEV_LOGIN = "1"   allows POST /api/auth/dev {email} to sign in without Google

   Students can sign in only once a teacher has added their Google email. Sessions are a random token in an
   HttpOnly cookie; only its SHA-256 hash is stored. */

const DAY = 86400;
const SESSION_DAYS = 30;
const COOKIE = "gsh_s";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT, picture TEXT,
     role TEXT NOT NULL, teacher_id INTEGER, created_at INTEGER NOT NULL, last_seen INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL, title TEXT NOT NULL,
     kind TEXT NOT NULL, bank TEXT, payload TEXT NOT NULL, due TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS assignees (assignment_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'todo',
     score REAL, total REAL, started_at INTEGER, done_at INTEGER, PRIMARY KEY (assignment_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS marks (assignment_id INTEGER NOT NULL, student_id INTEGER NOT NULL, item TEXT NOT NULL, mark TEXT NOT NULL,
     at INTEGER NOT NULL, PRIMARY KEY (assignment_id, student_id, item))`,
  `CREATE TABLE IF NOT EXISTS ink (assignment_id INTEGER NOT NULL, student_id INTEGER NOT NULL, src TEXT NOT NULL, data TEXT NOT NULL,
     updated INTEGER NOT NULL, PRIMARY KEY (assignment_id, student_id, src))`,
  `CREATE INDEX IF NOT EXISTS users_teacher ON users (teacher_id)`,
  `CREATE INDEX IF NOT EXISTS assignees_student ON assignees (student_id)`,
];
let ready = null;
const ensure = db => (ready ||= db.batch(SCHEMA.map(s => db.prepare(s))).catch(e => { ready = null; throw e; }));

const now = () => Math.floor(Date.now() / 1000);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
});
const fail = (status, error, message) => json({ error, message }, status);
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const sha256 = async s => b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const validEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const teacherEmails = env => String(env.TEACHER_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

/* ---------- Google ID tokens: signature from Google's published keys, then audience, issuer, expiry ---------- */
let certs = { keys: null, until: 0 };
async function googleKeys(force) {
  if (!force && certs.keys && Date.now() < certs.until) return certs.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!r.ok) throw new Error("Google keys unavailable");
  const age = +((r.headers.get("cache-control") || "").match(/max-age=(\d+)/) || [])[1] || 3600;
  certs = { keys: (await r.json()).keys, until: Date.now() + age * 1000 };
  return certs.keys;
}
async function verifyGoogle(token, clientId) {
  const bits = String(token || "").split(".");
  if (bits.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(new TextDecoder().decode(fromB64url(bits[0]))); body = JSON.parse(new TextDecoder().decode(fromB64url(bits[1]))); }
  catch (e) { return null; }
  if (head.alg !== "RS256") return null;
  let jwk = (await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await googleKeys(true)).find(k => k.kid === head.kid);   /* Google rotates its keys */
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(bits[2]), new TextEncoder().encode(bits[0] + "." + bits[1]));
  if (!ok) return null;
  const t = now();
  if (body.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(body.iss)) return null;
  if (!(body.exp > t - 60) || (body.iat && body.iat > t + 300)) return null;
  if (!body.email || body.email_verified !== true && body.email_verified !== "true") return null;
  return { email: String(body.email).toLowerCase(), name: clean(body.name, 100) };   /* nothing else from the Google account is kept */
}

/* ---------- Sessions ---------- */
function cookieOf(req) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)`));
  return m ? m[1] : null;
}
const setCookie = (token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
async function startSession(db, userId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires < ?").bind(now()),
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)").bind(await sha256(token), userId, now() + SESSION_DAYS * DAY),
    db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").bind(now(), userId),
  ]);
  return setCookie(token, SESSION_DAYS * DAY);
}
async function currentUser(db, req) {
  const token = cookieOf(req); if (!token) return null;
  const u = await db.prepare(`SELECT u.id, u.email, u.name, u.role, u.teacher_id, u.last_seen FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires > ?`).bind(await sha256(token), now()).first();
  if (u && (!u.last_seen || now() - u.last_seen > 600)) await db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").bind(now(), u.id).run();
  return u || null;
}
const publicUser = u => u && { id: u.id, email: u.email, name: u.name || u.email.split("@")[0], role: u.role };

/* sign in a verified Google account: teachers by the TEACHER_EMAILS list, students only once a teacher has added them */
async function signIn(db, env, g) {
  const isTeacher = teacherEmails(env).includes(g.email);
  let u = await db.prepare("SELECT * FROM users WHERE email = ?").bind(g.email).first();
  if (!u && !isTeacher) return fail(403, "not_invited", "This Google account hasn't been added by a teacher yet. Ask your teacher to add the email you sign in with.");
  if (!u) {
    await db.prepare("INSERT INTO users (email, name, role, created_at) VALUES (?, ?, 'teacher', ?)").bind(g.email, g.name, now()).run();
    u = await db.prepare("SELECT * FROM users WHERE email = ?").bind(g.email).first();
  } else {
    const role = isTeacher ? "teacher" : "student";
    /* a teacher's own name for a student is kept; Google's name fills it only when none was given */
    await db.prepare("UPDATE users SET role = ?, name = COALESCE(NULLIF(name, ''), ?) WHERE id = ?").bind(role, g.name, u.id).run();
    u = { ...u, role, name: u.name || g.name };
  }
  return json({ user: publicUser(u) }, 200, { "set-cookie": await startSession(db, u.id) });
}

/* ---------- Work ---------- */
/* the questions or paper an assignment holds, as sent by the teacher's page */
function readPayload(kind, p) {
  if (kind === "qs") {
    const items = (Array.isArray(p.items) ? p.items : []).slice(0, 200).map(x => ({
      id: clean(x.id, 80), parts: Array.isArray(x.parts) ? x.parts.map(l => clean(l, 2)).filter(l => /^[a-z]$/.test(l)).slice(0, 12) : undefined,
    })).filter(x => /^[\w.-]+$/.test(x.id));
    return items.length ? { items, marks: Math.max(0, Math.min(2000, +p.marks || 0)) } : null;
  }
  if (kind === "paper") {
    const src = clean(p.src, 300), ms = clean(p.ms, 300);
    if (!/^\/files\/[\w./-]+\.pdf$/.test(src) || (ms && !/^\/files\/[\w./-]+\.pdf$/.test(ms))) return null;
    return { src, ms, name: clean(p.name, 120), desc: clean(p.desc, 160) };
  }
  return null;
}
async function assignmentFor(db, id, user) {
  const a = await db.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first();
  if (!a) return null;
  if (user.role === "teacher") return a.teacher_id === user.id ? a : null;
  const mine = await db.prepare("SELECT 1 FROM assignees WHERE assignment_id = ? AND student_id = ?").bind(id, user.id).first();
  return mine ? a : null;
}
const shape = a => ({ id: a.id, title: a.title, kind: a.kind, bank: a.bank, due: a.due, created: a.created_at, payload: JSON.parse(a.payload) });

async function route(ctx, parts) {
  const { request: req, env } = ctx, db = env.DB, method = req.method;
  if (!db) return fail(503, "no_database", "Accounts aren't set up yet: the site has no database connected.");
  await ensure(db);
  const body = async () => { try { return await req.json(); } catch (e) { return {}; } };
  const [a, b, c] = parts;

  if (a === "config" && method === "GET") return json({ googleClientId: env.GOOGLE_CLIENT_ID || "", dev: env.DEV_LOGIN === "1" });

  if (a === "auth") {
    if (b === "google" && method === "POST") {
      if (!env.GOOGLE_CLIENT_ID) return fail(503, "no_google", "Google sign-in isn't set up yet.");
      let g = null;
      try { g = await verifyGoogle((await body()).credential, env.GOOGLE_CLIENT_ID); } catch (e) { return fail(502, "google_unreachable", "Couldn't check the sign-in with Google. Try again."); }
      if (!g) return fail(401, "bad_token", "That sign-in didn't work. Try again.");
      return signIn(db, env, g);
    }
    if (b === "dev" && method === "POST" && env.DEV_LOGIN === "1") {
      const email = clean((await body()).email, 200).toLowerCase();
      if (!validEmail(email)) return fail(400, "bad_email", "Not an email address.");
      return signIn(db, env, { email, name: email.split("@")[0] });
    }
    if (b === "logout" && method === "POST") {
      const token = cookieOf(req);
      if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
      return json({ ok: true }, 200, { "set-cookie": setCookie("", 0) });
    }
  }

  const me = await currentUser(db, req);
  if (a === "me" && method === "GET") return json({ user: publicUser(me) });
  if (!me) return fail(401, "signed_out", "Sign in first.");
  const teacher = me.role === "teacher";

  /* a student deleting their own account and everything recorded for it */
  if (a === "me" && method === "DELETE") {
    if (teacher) return fail(400, "teacher", "Teacher accounts are removed from the site's settings.");
    await wipeStudent(db, me.id);
    return json({ ok: true }, 200, { "set-cookie": setCookie("", 0) });
  }

  if (a === "students") {
    if (!teacher) return fail(403, "teachers_only", "Only teachers can do that.");
    if (!b && method === "GET") {
      const { results } = await db.prepare(`SELECT u.id, u.email, u.name, u.last_seen, u.created_at,
          (SELECT COUNT(*) FROM assignees x WHERE x.student_id = u.id) AS assigned,
          (SELECT COUNT(*) FROM assignees x WHERE x.student_id = u.id AND x.status = 'done') AS done
        FROM users u WHERE u.teacher_id = ? AND u.role = 'student' ORDER BY LOWER(COALESCE(u.name, u.email))`).bind(me.id).all();
      return json({ students: results });
    }
    if (!b && method === "POST") {
      const p = await body(), email = clean(p.email, 200).toLowerCase(), name = clean(p.name, 100);
      if (!validEmail(email)) return fail(400, "bad_email", "That doesn't look like an email address.");
      if (teacherEmails(env).includes(email)) return fail(400, "is_teacher", "That email is a teacher's.");
      const had = await db.prepare("SELECT id, teacher_id FROM users WHERE email = ?").bind(email).first();
      if (had && had.teacher_id && had.teacher_id !== me.id) return fail(409, "taken", "That student is already with another teacher.");
      if (had) await db.prepare("UPDATE users SET teacher_id = ?, name = COALESCE(NULLIF(?, ''), name), role = 'student' WHERE id = ?").bind(me.id, name, had.id).run();
      else await db.prepare("INSERT INTO users (email, name, role, teacher_id, created_at) VALUES (?, ?, 'student', ?, ?)").bind(email, name || null, me.id, now()).run();
      return json({ ok: true });
    }
    const sid = +b, st = sid && await db.prepare("SELECT * FROM users WHERE id = ? AND teacher_id = ? AND role = 'student'").bind(sid, me.id).first();
    if (!st) return fail(404, "not_found", "No such student.");
    if (method === "PATCH") { await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(clean((await body()).name, 100) || null, sid).run(); return json({ ok: true }); }
    if (method === "DELETE") { await wipeStudent(db, sid); return json({ ok: true }); }
    if (method === "GET") {
      const { results } = await db.prepare(`SELECT a.id, a.title, a.kind, a.bank, a.payload, a.due, a.created_at, x.status, x.score, x.total, x.done_at,
          (SELECT COUNT(*) FROM marks m WHERE m.assignment_id = a.id AND m.student_id = x.student_id) AS marked
        FROM assignees x JOIN assignments a ON a.id = x.assignment_id WHERE x.student_id = ? ORDER BY a.created_at DESC`).bind(sid).all();
      return json({ student: { id: st.id, email: st.email, name: st.name, last_seen: st.last_seen }, work: results });
    }
  }

  if (a === "assignments") {
    if (!b && method === "GET") {
      if (teacher) {
        const { results } = await db.prepare(`SELECT a.id, a.title, a.kind, a.bank, a.due, a.created_at, a.payload,
            (SELECT COUNT(*) FROM assignees x WHERE x.assignment_id = a.id) AS students,
            (SELECT COUNT(*) FROM assignees x WHERE x.assignment_id = a.id AND x.status = 'done') AS done
          FROM assignments a WHERE a.teacher_id = ? ORDER BY a.created_at DESC`).bind(me.id).all();
        return json({ assignments: results.map(r => ({ ...shape(r), students: r.students, done: r.done })) });
      }
      const { results } = await db.prepare(`SELECT a.*, x.status, x.score, x.total, x.done_at,
          (SELECT COUNT(*) FROM marks m WHERE m.assignment_id = a.id AND m.student_id = x.student_id) AS marked
        FROM assignees x JOIN assignments a ON a.id = x.assignment_id WHERE x.student_id = ? ORDER BY a.created_at DESC`).bind(me.id).all();
      return json({ assignments: results.map(r => ({ ...shape(r), status: r.status, score: r.score, total: r.total, doneAt: r.done_at, marked: r.marked })) });
    }
    if (!b && method === "POST") {
      if (!teacher) return fail(403, "teachers_only", "Only teachers can set work.");
      const p = await body(), kind = p.kind, payload = readPayload(kind, p.payload || {});
      const title = clean(p.title, 120), due = /^\d{4}-\d{2}-\d{2}$/.test(p.due || "") ? p.due : null;
      if (!title || !payload) return fail(400, "bad_assignment", "Give the work a title and something to do.");
      const ids = [...new Set((Array.isArray(p.students) ? p.students : []).map(Number).filter(Boolean))];
      if (!ids.length) return fail(400, "no_students", "Pick at least one student.");
      const { results: mine } = await db.prepare(`SELECT id FROM users WHERE teacher_id = ? AND role = 'student' AND id IN (${ids.map(() => "?").join(",")})`).bind(me.id, ...ids).all();
      if (mine.length !== ids.length) return fail(400, "bad_students", "Some of those students aren't yours.");
      const r = await db.prepare("INSERT INTO assignments (teacher_id, title, kind, bank, payload, due, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(me.id, title, kind, kind === "qs" ? clean(p.bank, 80) : null, JSON.stringify(payload), due, now()).run();
      const aid = r.meta.last_row_id;
      await db.batch(ids.map(sid => db.prepare("INSERT INTO assignees (assignment_id, student_id) VALUES (?, ?)").bind(aid, sid)));
      return json({ ok: true, id: aid });
    }
    const aid = +b, as = aid && await assignmentFor(db, aid, me);
    if (!as) return fail(404, "not_found", "No such work.");
    if (!c && method === "GET") {
      if (teacher) {
        const { results: rows } = await db.prepare(`SELECT u.id, u.email, u.name, x.status, x.score, x.total, x.started_at, x.done_at
          FROM assignees x JOIN users u ON u.id = x.student_id WHERE x.assignment_id = ? ORDER BY LOWER(COALESCE(u.name, u.email))`).bind(aid).all();
        const { results: marks } = await db.prepare("SELECT student_id, item, mark FROM marks WHERE assignment_id = ?").bind(aid).all();
        const { results: inks } = await db.prepare("SELECT student_id, src, updated FROM ink WHERE assignment_id = ? ORDER BY src").bind(aid).all();
        return json({ assignment: shape(as), students: rows.map(s => ({ ...s, marks: Object.fromEntries(marks.filter(m => m.student_id === s.id).map(m => [m.item, m.mark])),
          ink: inks.filter(k => k.student_id === s.id).map(k => ({ src: k.src, updated: k.updated })) })) });
      }
      const x = await db.prepare("SELECT status, score, total, done_at FROM assignees WHERE assignment_id = ? AND student_id = ?").bind(aid, me.id).first();
      const { results: marks } = await db.prepare("SELECT item, mark FROM marks WHERE assignment_id = ? AND student_id = ?").bind(aid, me.id).all();
      return json({ assignment: { ...shape(as), status: x.status, score: x.score, total: x.total, doneAt: x.done_at }, marks: Object.fromEntries(marks.map(m => [m.item, m.mark])) });
    }
    if (!c && method === "DELETE") {
      if (!teacher) return fail(403, "teachers_only", "Only teachers can delete work.");
      await db.batch(["marks", "ink", "assignees"].map(t => db.prepare(`DELETE FROM ${t} WHERE assignment_id = ?`).bind(aid))
        .concat(db.prepare("DELETE FROM assignments WHERE id = ?").bind(aid)));
      return json({ ok: true });
    }
    /* writing on a paper of the work: the student's own, or (for the teacher) a given student's */
    if (c === "ink" && method === "GET") {
      const src = new URL(req.url).searchParams.get("src") || "", sid = teacher ? +new URL(req.url).searchParams.get("student") : me.id;
      const row = await db.prepare("SELECT data, updated FROM ink WHERE assignment_id = ? AND student_id = ? AND src = ?").bind(aid, sid, src).first();
      return json({ data: row ? row.data : null, updated: row ? row.updated : null });
    }
    if (teacher) return fail(403, "students_only", "That's for students.");
    if (c === "ink" && method === "PUT") {
      const p = await body(), src = clean(p.src, 300), data = typeof p.data === "string" ? p.data : "";
      if (!/^\/files\/[\w./-]+\.pdf$/.test(src) || (as.kind === "paper" && src !== JSON.parse(as.payload).src)) return fail(400, "bad_src", "That paper isn't part of this work.");
      if (data.length > 1900000) return fail(413, "too_big", "There's too much writing on this paper to save online. It's still saved in this browser.");
      if (!data) await db.prepare("DELETE FROM ink WHERE assignment_id = ? AND student_id = ? AND src = ?").bind(aid, me.id, src).run();
      else await db.batch([
        db.prepare("INSERT INTO ink (assignment_id, student_id, src, data, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (assignment_id, student_id, src) DO UPDATE SET data = excluded.data, updated = excluded.updated").bind(aid, me.id, src, data, now()),
        db.prepare("UPDATE assignees SET status = CASE WHEN status = 'todo' THEN 'started' ELSE status END, started_at = COALESCE(started_at, ?) WHERE assignment_id = ? AND student_id = ?").bind(now(), aid, me.id)]);
      return json({ ok: true });
    }
    /* a student marking a question of the work, or finishing it */
    if (c === "mark" && method === "PUT") {
      const p = await body(), item = clean(p.item, 80), mark = p.mark;
      if (as.kind !== "qs" || !JSON.parse(as.payload).items.some(x => x.id === item)) return fail(400, "bad_item", "That question isn't part of this work.");
      const st = [mark ? db.prepare("INSERT INTO marks (assignment_id, student_id, item, mark, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (assignment_id, student_id, item) DO UPDATE SET mark = excluded.mark, at = excluded.at")
          .bind(aid, me.id, item, ["got", "part", "miss"].includes(mark) ? mark : "skip", now())
        : db.prepare("DELETE FROM marks WHERE assignment_id = ? AND student_id = ? AND item = ?").bind(aid, me.id, item),
        db.prepare("UPDATE assignees SET status = CASE WHEN status = 'todo' THEN 'started' ELSE status END, started_at = COALESCE(started_at, ?) WHERE assignment_id = ? AND student_id = ?").bind(now(), aid, me.id)];
      await db.batch(st);
      return json({ ok: true });
    }
    if (c === "done" && method === "PUT") {
      const p = await body(), score = p.score === "" || p.score == null ? null : Math.max(0, Math.min(1000, +p.score)), total = p.total === "" || p.total == null ? null : Math.max(0, Math.min(1000, +p.total));
      if (p.undo) await db.prepare("UPDATE assignees SET status = 'started', done_at = NULL WHERE assignment_id = ? AND student_id = ?").bind(aid, me.id).run();
      else await db.prepare("UPDATE assignees SET status = 'done', score = ?, total = ?, started_at = COALESCE(started_at, ?), done_at = ? WHERE assignment_id = ? AND student_id = ?")
        .bind(Number.isFinite(score) ? score : null, Number.isFinite(total) ? total : null, now(), now(), aid, me.id).run();
      return json({ ok: true });
    }
  }
  return fail(404, "not_found", "No such page.");
}
async function wipeStudent(db, sid) {
  await db.batch(["marks WHERE student_id", "ink WHERE student_id", "assignees WHERE student_id", "sessions WHERE user_id", "users WHERE id"]
    .map(w => db.prepare(`DELETE FROM ${w} = ?`).bind(sid)));
}

export async function onRequest(ctx) {
  const { request: req } = ctx, u = new URL(req.url);
  /* changes only from the site's own pages (a form on another site can't post JSON here with the cookie) */
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== u.host) return fail(403, "bad_origin", "Requests must come from the site itself.");
    if (!(req.headers.get("content-type") || "").includes("application/json")) return fail(415, "json_only", "Send JSON.");
  }
  try {
    return await route(ctx, u.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean));
  } catch (e) {
    console.error(e);
    return fail(500, "server_error", "Something went wrong on the server. Try again.");
  }
}
