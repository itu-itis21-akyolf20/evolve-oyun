/* ============================================================
   online.js — oyuncu adı, puan, liderlik tablosu

   Sadece oyun http(s) üzerinden (server.mjs / Cloudflare tüneli)
   açıldığında çalışır; file:// ile açılınca tablo gizlenir, oyun
   yine oynanır.

   PUAN = av × 10  +  toplam hasar / 50  +  tamamlanan aşama × 10.000
          (Dehşet'te ×1.5). Oyuncu kimliği başına en iyi puan saklanır.
   ============================================================ */
window.EV = window.EV || {};

EV.Online = (function () {
  'use strict';

  const U = EV.U;
  const $ = (id) => document.getElementById(id);
  const enabled = /^https?:$/.test(location.protocol);
  let lastSent = 0;
  let open = false;

  /* API adresi: aynı sunucudan açıldıysa göreli; GitHub Pages'ten açıldıysa
     skor sunucusunun (Cloudflare tüneli) adresi api.json'dan okunur. */
  let apiBase = '';
  const ready = (async () => {
    if (!enabled || !/github\.io$/.test(location.hostname)) return;
    try {
      const r = await fetch('api.json', { cache: 'no-store' });
      const d = await r.json();
      if (d && typeof d.base === 'string' && /^https:\/\/[\w.-]+\/$/.test(d.base)) apiBase = d.base;
    } catch (e) { /* skor sunucusu kapalı: oyun yine oynanır */ }
  })();
  // Content-Type text/plain: tarayıcı ön-uçuş (CORS preflight) isteği atmaz
  const post = (body) => fetch(apiBase + 'api/score', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true });

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* gizli sekme */ }
    return null;
  }

  const id = (() => {
    let v = store('evolve_pid');
    if (!v || !/^[a-z0-9]{8,32}$/.test(v)) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
      store('evolve_pid', v);
    }
    return v;
  })();

  function cleanName(s) {
    return String(s || '').normalize('NFC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  }

  function name() { return cleanName(store('evolve_name') || ''); }
  function setName(n) { store('evolve_name', cleanName(n)); }

  function score(game) {
    const s = game.stats || { totalDmg: 0 };
    const stagesDone = game.stageIndex + game.generation;
    const raw = game.kills * 10 + Math.floor(s.totalDmg / 50) + stagesDone * 10000;
    return Math.floor(raw * (game.diff.id === 'dehset' ? 1.5 : 1));
  }

  /** Puanı gönderir; force değilse en fazla 30 sn'de bir. */
  let retryTimer = null;
  function submit(game, force, isRetry) {
    if (!enabled || !game.started || name().length < 2) return;
    const now = Date.now();
    if (!force && now - lastSent < 30000) return;
    lastSent = now;
    const s = game.stats;
    const body = JSON.stringify({
      id, name: name(), score: score(game), stage: game.stageIndex, gen: game.generation,
      kills: game.kills, totalDmg: Math.floor(s.totalDmg), maxHit: Math.floor(s.maxHit), diff: game.diff.id,
    });
    ready.then(() => post(body))
      .then((r) => {
        // hız sınırına takıldıysa (ör. ölüm, periyodik gönderimin hemen ardından) bir kez yeniden dene;
        // yoksa en güncel puan kaybolup tablo eski bir değerde kalıyordu
        if (r.status === 429 && !isRetry) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => submit(game, true, true), 3000);
        }
      })
      .catch(() => { /* çevrimdışı: bir sonraki denemede gider */ });
  }

  /** Sekme kapanırken son durumu gönder. */
  function beacon(game) {
    if (!enabled || !game.started || name().length < 2 || !navigator.sendBeacon) return;
    const s = game.stats;
    navigator.sendBeacon(apiBase + 'api/score', new Blob([JSON.stringify({
      id, name: name(), score: score(game), stage: game.stageIndex, gen: game.generation,
      kills: game.kills, totalDmg: Math.floor(s.totalDmg), maxHit: Math.floor(s.maxHit), diff: game.diff.id,
    })], { type: 'text/plain' }));
  }

  const STAGE = ['Hücre', 'Sürüngen', 'Memeli'];

  function row(e, i) {
    const tr = document.createElement('tr');
    if (e.me) tr.className = 'me';
    const cells = [
      String(i + 1),
      e.name,                                                       // textContent: isimler HTML olarak işlenmez
      U.fmt(e.score),
      (e.gen > 0 ? 'Nesil ' + (e.gen + 1) : STAGE[e.stage] || '?') + (e.diff === 'dehset' ? ' ☠️' : ''),
      U.fmt(e.totalDmg),
      U.fmt(e.maxHit),
      U.fmt(e.kills),
    ];
    cells.forEach((c) => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
    return tr;
  }

  async function show(game) {
    $('lbPanel').hidden = false;
    open = true;
    const body = $('lbRows');
    body.innerHTML = '<tr><td colspan="7">Yükleniyor…</td></tr>';
    if (game && game.started) submit(game, true);
    if (!enabled) {
      body.innerHTML = '<tr><td colspan="7">Liderlik tablosu çevrim içi linkte çalışır (dosyadan açınca kapalı).</td></tr>';
      return;
    }
    try {
      await ready;
      const r = await fetch(apiBase + 'api/leaderboard?id=' + id, { cache: 'no-store' });
      const d = await r.json();
      body.innerHTML = '';
      (d.entries || []).forEach((e, i) => body.appendChild(row(e, i)));
      if (!d.entries || !d.entries.length) body.innerHTML = '<tr><td colspan="7">Henüz kimse yok — ilk sen ol!</td></tr>';
      $('lbMe').textContent = d.rank ? 'Senin sıran: ' + d.rank + ' / ' + d.total : 'Toplam oyuncu: ' + (d.total || 0);
    } catch (e) {
      body.innerHTML = '<tr><td colspan="7">Skor sunucusu şu an kapalı — oyun oynanır, puanlar sunucu açılınca gönderilir.</td></tr>';
    }
  }

  function hide() { $('lbPanel').hidden = true; open = false; }

  return { enabled, id, name, setName, cleanName, score, submit, beacon, show, hide, isOpen: () => open };
})();
