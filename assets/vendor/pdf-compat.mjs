/* Polyfills so the pdf.js 6 build runs on older browsers (e.g. Safari 17 on macOS Sonoma).
   pdf.js 6 uses very new JavaScript built-ins; each one is added here only when the browser lacks it.
   Loaded before pdf.min.mjs on the page and before pdf.worker.min.mjs in the worker. */
const def = (obj, name, value) => {
  if (obj && !(name in obj)) Object.defineProperty(obj, name, { value, writable: true, configurable: true });
};
const G = globalThis;

/* Iterator global and iterator helpers (Safari < 18.4) */
const IterProto = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
if (typeof G.Iterator === "undefined") {
  const Iterator = function Iterator() {};
  Iterator.prototype = IterProto;
  def(G, "Iterator", Iterator);
}
function* mapI(it, fn) { let i = 0; for (const v of it) yield fn(v, i++); }
function* filterI(it, fn) { let i = 0; for (const v of it) if (fn(v, i++)) yield v; }
function* flatMapI(it, fn) { let i = 0; for (const v of it) yield* fn(v, i++); }
function* takeI(it, n) { if (n <= 0) return; let i = 0; for (const v of it) { yield v; if (++i >= n) return; } }
function* dropI(it, n) { let i = 0; for (const v of it) if (i++ >= n) yield v; }
const iter = self => ({ [Symbol.iterator]: () => self });
def(IterProto, "map", function (fn) { return mapI(iter(this), fn); });
def(IterProto, "filter", function (fn) { return filterI(iter(this), fn); });
def(IterProto, "flatMap", function (fn) { return flatMapI(iter(this), fn); });
def(IterProto, "take", function (n) { return takeI(iter(this), n); });
def(IterProto, "drop", function (n) { return dropI(iter(this), n); });
def(IterProto, "toArray", function () { return [...iter(this)]; });
def(IterProto, "forEach", function (fn) { let i = 0; for (const v of iter(this)) fn(v, i++); });
def(IterProto, "some", function (fn) { let i = 0; for (const v of iter(this)) if (fn(v, i++)) return true; return false; });
def(IterProto, "every", function (fn) { let i = 0; for (const v of iter(this)) if (!fn(v, i++)) return false; return true; });
def(IterProto, "find", function (fn) { let i = 0; for (const v of iter(this)) if (fn(v, i++)) return v; return undefined; });
def(IterProto, "reduce", function (fn, ...init) {
  let i = 0, acc, first = !init.length; if (!first) acc = init[0];
  for (const v of iter(this)) { if (first) { acc = v; first = false; } else acc = fn(acc, v, i); i++; }
  if (first) throw new TypeError("Reduce of empty iterator with no initial value");
  return acc;
});

/* Map / WeakMap upsert */
for (const C of [G.Map, G.WeakMap]) {
  if (!C) continue;
  def(C.prototype, "getOrInsert", function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); });
  def(C.prototype, "getOrInsertComputed", function (k, fn) { if (!this.has(k)) this.set(k, fn(k)); return this.get(k); });
}

/* Promise */
def(G.Promise, "withResolvers", function () {
  let resolve, reject; const promise = new this((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
});
def(G.Promise, "try", function (fn, ...args) { return new this(r => r(fn(...args))); });

/* Math.sumPrecise (a plain sum is close enough for pdf.js's integer byte counts) */
def(Math, "sumPrecise", function (items) { let s = 0; for (const v of items) s += v; return s; });

/* Uint8Array base64 / hex */
const U8 = G.Uint8Array;
def(U8.prototype, "toHex", function () { let s = ""; for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, "0"); return s; });
def(U8, "fromHex", function (h) { const a = new U8(h.length >> 1); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(2 * i, 2), 16); return a; });
def(U8.prototype, "toBase64", function () {
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < this.length; i += CH) s += String.fromCharCode.apply(null, this.subarray(i, i + CH));
  return btoa(s);
});
def(U8, "fromBase64", function (b) {
  const s = atob(String(b).replace(/[\s]/g, "")); const a = new U8(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
});

/* ArrayBuffer.transferToFixedLength */
def(G.ArrayBuffer.prototype, "transferToFixedLength", function (len = this.byteLength) {
  const out = new ArrayBuffer(len); new U8(out).set(new U8(this, 0, Math.min(len, this.byteLength))); return out;
});
def(G.ArrayBuffer.prototype, "transfer", function (len = this.byteLength) { return this.transferToFixedLength(len); });

/* Response / Blob .bytes() */
if (G.Response) def(G.Response.prototype, "bytes", async function () { return new U8(await this.arrayBuffer()); });
if (G.Blob) def(G.Blob.prototype, "bytes", async function () { return new U8(await this.arrayBuffer()); });
