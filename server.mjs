#!/usr/bin/env node
/* ============================================================
   server.mjs — oyun + liderlik tablosu sunucusu (bağımlılık yok)

   node server.mjs [port]        (varsayılan 8090)

   Statik: sadece index.html, style.css, js/**, vendor/** servis edilir
   (tests/, data/ ve diğer her şey dışarıdan erişilemez).

   API:
     GET  /api/leaderboard          → en iyi 50 skor
     POST /api/score  {id,name,score,stage,gen,kills,totalDmg,maxHit,diff}
          → oyuncu kimliği başına EN İYİ skor tutulur (upsert)

   Veritabanı: data/leaderboard.json (atomik yazım: geçici dosya + rename)
   Not: skor istemcide hesaplanır; hile tamamen engellenemez. Makul üst
   sınırlar ve IP başına hız sınırı ile kaba kötüye kullanım önlenir.
   ============================================================ */
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8090);
const DB_DIR = join(ROOT, 'data');
const DB = join(DB_DIR, 'leaderboard.json');
const MAX_ENTRIES = 5000;
const MAX_BODY = 2048;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
};

/* ---------------- veritabanı ---------------- */
let board = new Map();          // id -> kayıt
let saving = Promise.resolve();

async function load() {
  try {
    const rows = JSON.parse(await readFile(DB, 'utf8'));
    if (Array.isArray(rows)) rows.forEach((r) => { if (r && typeof r.id === 'string') board.set(r.id, r); });
  } catch (e) { /* ilk çalıştırma: dosya yok */ }
}

function persist() {
  saving = saving.then(async () => {
    await mkdir(DB_DIR, { recursive: true });
    const tmp = DB + '.tmp';
    await writeFile(tmp, JSON.stringify([...board.values()]), 'utf8');
    await rename(tmp, DB);
  }).catch((e) => console.error('Veritabanı yazılamadı:', e.message));
  return saving;
}

/* ---------------- doğrulama ---------------- */
const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
};

/** Harf (Türkçe dahil), rakam, boşluk, _ - . dışındaki her şey atılır. */
function cleanName(s) {
  if (typeof s !== 'string') return '';
  return s.normalize('NFC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

function validate(b) {
  if (!b || typeof b !== 'object') return null;
  const id = typeof b.id === 'string' && /^[a-z0-9]{8,32}$/.test(b.id) ? b.id : null;
  const name = cleanName(b.name);
  if (!id || name.length < 2) return null;
  const r = {
    id, name,
    stage: num(b.stage, 2), gen: num(b.gen, 200),
    kills: num(b.kills, 1e8),
    totalDmg: num(b.totalDmg, 1e15), maxHit: num(b.maxHit, 1e13),
    diff: b.diff === 'dehset' ? 'dehset' : 'normal',
  };
  r.maxHit = Math.min(r.maxHit, r.totalDmg);        // tek vuruş toplamı geçemez
  // Puan istemciden alınmaz, gönderilen istatistiklerden burada hesaplanır
  // (istemcideki formülün aynısı: js/online.js score()).
  const raw = r.kills * 10 + Math.floor(r.totalDmg / 50) + (r.stage + r.gen) * 10000;
  r.score = Math.floor(raw * (r.diff === 'dehset' ? 1.5 : 1));
  return r;
}

/* ---------------- hız sınırı ---------------- */
const lastPost = new Map();
function limited(ip) {
  const now = Date.now();
  const t = lastPost.get(ip) || 0;
  lastPost.set(ip, now);
  if (lastPost.size > 10000) lastPost.clear();
  return now - t < 2500;
}

/** En iyi n kayıt; kimlikler dışarı verilmez, sadece istekteki oyuncu 'me' ile işaretlenir. */
function top(n, meId) {
  return [...board.values()].sort((a, b) => b.score - a.score).slice(0, n)
    .map(({ id, ...r }) => ({ ...r, me: id === meId }));
}

/* ---------------- HTTP ---------------- */
// GitHub Pages'teki oyun bu sunucuya başka bir adresten istek atar
const ORIGINS = new Set(['https://itu-itis21-akyolf20.github.io']);
let reqOrigin = '';

function send(res, code, body, type) {
  const cors = ORIGINS.has(reqOrigin) ? { 'Access-Control-Allow-Origin': reqOrigin, Vary: 'Origin' } : {};
  res.writeHead(code, {
    ...cors,
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('çok büyük')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const ALLOWED = /^\/(index\.html|mobile\.html|style(-extra)?\.css|mobile\/[\w\-.]+\.(js|css)|js\/[\w\-/]+\.js|vendor\/[\w\-.]+\.js)$/;

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
  reqOrigin = String(req.headers.origin || '');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, ORIGINS.has(reqOrigin) ? { 'Access-Control-Allow-Origin': reqOrigin,
      'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {});
    return res.end();
  }

  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const me = url.searchParams.get('id') || '';
    const mine = board.get(me);
    const rank = mine ? [...board.values()].filter((x) => x.score > mine.score).length + 1 : null;
    return send(res, 200, { entries: top(50, me), total: board.size, rank });
  }

  if (url.pathname === '/api/score' && req.method === 'POST') {
    if (limited(ip)) return send(res, 429, { error: 'yavaş' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'geçersiz' }); }
    const r = validate(body);
    if (!r) return send(res, 400, { error: 'geçersiz' });
    const old = board.get(r.id);
    // oyuncu başına en iyisi; isim değişikliği her zaman güncellenir
    const best = !old || r.score >= old.score ? { ...r, t: Date.now() } : { ...old, name: r.name,
      maxHit: Math.max(old.maxHit, r.maxHit), totalDmg: Math.max(old.totalDmg, r.totalDmg) };
    board.set(r.id, best);
    if (board.size > MAX_ENTRIES) {
      const keep = [...board.values()].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
      board = new Map(keep.map((x) => [x.id, x]));
    }
    persist();
    const rank = [...board.values()].filter((x) => x.score > best.score).length + 1;
    return send(res, 200, { ok: true, rank, best: best.score });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'yöntem' });

  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!ALLOWED.test(path)) return send(res, 404, 'bulunamadı', 'text/plain; charset=utf-8');
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT + sep) || !existsSync(file)) return send(res, 404, 'bulunamadı', 'text/plain; charset=utf-8');
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) {
    send(res, 500, 'hata', 'text/plain; charset=utf-8');
  }
}

await load();
http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); try { send(res, 500, { error: 'sunucu' }); } catch (_) { /* yok */ } });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`EVOLVE sunucusu: http://127.0.0.1:${PORT}  (kayıtlı oyuncu: ${board.size})`);
});
