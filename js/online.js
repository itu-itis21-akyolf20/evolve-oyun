/* ============================================================
   online.js — oyuncu adı, puan, liderlik tablosu

   Skorlar Supabase'te tutulur (supabase/leaderboard.sql). Tarayıcı
   sadece iki veritabanı fonksiyonunu çağırır; puanı sunucu kendisi
   hesaplar. Anahtar 'publishable' türündedir: herkese açık olabilir.
   Hem GitHub Pages linkinde hem de dosyadan açınca çalışır.

   PUAN = av × 10  +  toplam hasar / 50  +  tamamlanan aşama × 10.000
          (Dehşet'te ×1.5). Oyuncu kimliği başına en iyi puan saklanır.
   ============================================================ */
window.EV = window.EV || {};

EV.Online = (function () {
  'use strict';

  const U = EV.U;
  const $ = (id) => document.getElementById(id);
  const SB_URL = 'https://xrexhojwiogllccjbjne.supabase.co';
  const SB_KEY = 'sb_publishable_kWJdqAI7K9dq8IEf1fuscQ_Mpc9Nd';
  const enabled = typeof fetch === 'function';
  let lastSent = 0;
  let open = false;

  /** Supabase veritabanı fonksiyonu çağırır; JSON cevabı döner. */
  async function rpc(fn, args, keepalive) {
    const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST', keepalive: !!keepalive,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!r.ok) throw new Error('Skor sunucusu: ' + r.status);
    return r.json();
  }

  function payload(game) {
    const s = game.stats;
    return {
      p_id: id, p_name: name(), p_stage: game.stageIndex, p_gen: game.generation, p_kills: game.kills,
      p_total_dmg: Math.floor(s.totalDmg), p_max_hit: Math.floor(s.maxHit), p_diff: game.diff.id,
    };
  }

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
    rpc('submit_score', payload(game), true)
      .then((d) => {
        // hız sınırına takıldıysa (ör. ölüm, periyodik gönderimin hemen ardından) bir kez yeniden dene;
        // yoksa en güncel puan kaybolup tablo eski bir değerde kalıyordu
        if (d && d.error === 'yavaş' && !isRetry) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => submit(game, true, true), 3000);
        }
      })
      .catch(() => { /* çevrimdışı: bir sonraki denemede gider */ });
  }

  /** Sekme kapanırken son durumu gönder. */
  function beacon(game) {
    // sendBeacon başlık (apikey) gönderemez; keepalive fetch sekme kapanınca da tamamlanır
    if (!enabled || !game.started || name().length < 2) return;
    rpc('submit_score', payload(game), true).catch(() => { /* çevrimdışı */ });
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
    try {
      const d = await rpc('get_leaderboard', { p_id: id });
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
