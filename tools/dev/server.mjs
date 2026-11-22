/* Local test server: the static site plus the /api function, with a SQLite file standing in for Cloudflare D1.
   Sign-in without Google is allowed (DEV_LOGIN), so never expose this server to the internet.

   node --no-warnings tools/dev/server.mjs [port] [db file]
     TEACHER_EMAILS=you@example.com  sets the teacher accounts (default teacher@example.com) */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = +process.argv[2] || 8790;
const sqlite = new DatabaseSync(process.argv[3] || ":memory:");
const api = await import(pathToFileURL(path.join(ROOT, "functions/api/[[path]].js")).href);

/* the parts of D1's API the function uses */
class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.sql, args); }
  _s() { return sqlite.prepare(this.sql); }
  async first() { return this._s().get(...this.args) ?? null; }
  async all() { return { results: this._s().all(...this.args) }; }
  async run() { const r = this._s().run(...this.args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; }
}
const DB = {
  prepare: sql => new Stmt(sql),
  async batch(stmts) {
    sqlite.exec("BEGIN");
    try { const out = []; for (const s of stmts) out.push(await (/^\s*select/i.test(s.sql) ? s.all() : s.run())); sqlite.exec("COMMIT"); return out; }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  },
};
const env = { DB, GOOGLE_CLIENT_ID: "", TEACHER_EMAILS: process.env.TEACHER_EMAILS || "teacher@example.com", DEV_LOGIN: "1" };

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf", ".xml": "application/xml", ".txt": "text/plain" };
function staticFile(p) {
  const safe = path.normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, "");
  for (const f of [safe, safe + ".html", path.join(safe, "index.html")]) {
    const full = path.join(ROOT, f);
    if (full.startsWith(ROOT) && fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return path.join(ROOT, "index.html");   /* like Cloudflare Pages: an unknown address gets the app */
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(u, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const r = await api.onRequest({ request, env, params: {} });
    const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const f = staticFile(u.pathname);
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (teachers: ${env.TEACHER_EMAILS})`));
