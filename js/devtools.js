/* ============================================================
   devtools.js — TEST MODU (sadece link ?test ile açılır)

   Başlangıç ekranı: istediğin aşama / nesil / seviye / soy ile başla.
   Oyun içi 🧪 panel (P tuşu ya da 🧪 düğmesi): ara boss, Alfa, Apex,
   geçmiş benlik, hazine, sürü dalgası, Kan Ayı, şampiyon, istenen
   düşman türü (I–V), seviye, Gen Özü, eşya, ölümsüzlük, hemen evrim.

   Test modunda kayıt ayrı anahtarda tutulur (main.js SAVE_KEY);
   liderlik tablosuna ve bulut kaydına hiçbir şey gönderilmez (online.js).
   ============================================================ */
window.EV = window.EV || {};

(function () {
  'use strict';
  if (!EV.TEST) return;

  const U = EV.U;
  const $ = (id) => document.getElementById(id);
  const G = () => EV.Game;
  const STAGES = ['Hücre', 'Sürüngen', 'Memeli'];
  const RAR = EV.CFG.RARITY;
  let god = false;

  /* ---------------- stil ---------------- */
  const css = document.createElement('style');
  css.textContent = `
    #tBox{margin:6px auto 10px;padding:10px 12px;border:3px dashed #2f7a8a;border-radius:12px;background:rgba(160,230,240,.35);max-width:720px;text-align:left}
    #tBox h4{margin:0 0 6px;font-size:14px;letter-spacing:1px}
    #tBox .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0;font-size:12px;font-weight:800}
    #tBox select,#tPanel select{font:inherit;font-size:12px;font-weight:800;padding:3px 5px;border-radius:6px;border:2px solid #2f5a6a;background:#f4fbff}
    #tBox button{margin:6px 0 0 !important;padding:8px 18px !important;font-size:14px !important;background:#2f7a8a !important;color:#fff !important}
    #tBtn{position:fixed;right:10px;top:46%;z-index:23;width:44px;height:44px;border-radius:50%;border:2px solid #9fe8f5;
      background:rgba(20,60,70,.8);color:#fff;font-size:20px;cursor:pointer;padding:0;margin:0}
    body.prestart #tBtn{display:none}
    #tPanel{position:fixed;right:0;top:0;bottom:0;width:min(340px,92vw);z-index:24;overflow:auto;background:rgba(14,30,36,.94);
      color:#e8fbff;padding:10px 12px 20px;font:700 12px system-ui,sans-serif;box-shadow:-4px 0 18px rgba(0,0,0,.5)}
    #tPanel[hidden]{display:none}
    #tPanel h4{margin:10px 0 4px;font-size:12px;letter-spacing:1px;color:#9fe8f5}
    #tPanel .g{display:flex;flex-wrap:wrap;gap:5px}
    #tPanel button{margin:0;padding:6px 8px;font:800 11px system-ui,sans-serif;border-radius:7px;border:1px solid #4aa8b8;
      background:#1f4a55;color:#fff;cursor:pointer;letter-spacing:0}
    #tPanel button:active{background:#2f7a8a}
    #tPanel button.on{background:#b8862a;border-color:#ffd23d}
    #tPanel .top{display:flex;justify-content:space-between;align-items:center}
    #tPanel .st{font-size:11px;opacity:.8;margin-top:2px}
    .tbadge{position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:23;font:900 10px system-ui;color:#9fe8f5;
      background:rgba(14,30,36,.75);padding:2px 8px;border-radius:6px;pointer-events:none;letter-spacing:1px}`;
  document.head.appendChild(css);

  /* =========================================================
     Başlangıç ekranı
     ========================================================= */
  function formOpts(stage) {
    return EV.FORMS.list(stage).filter((f) => !f.locked).map((f) => '<option value="' + f.id + '">' + f.icon + ' ' + f.name + '</option>').join('');
  }

  function buildStartBox() {
    const anchor = $('cellForms');
    if (!anchor) return;
    const box = document.createElement('div');
    box.id = 'tBox';
    box.innerHTML = '<h4>🧪 TEST MODU — kayıt ayrı, liderliğe gönderilmez</h4>' +
      '<div class="row">Aşama <select id="tStage">' + STAGES.map((s, i) => '<option value="' + i + '">' + s + '</option>').join('') + '</select>' +
      'Nesil <select id="tGen">' + [0, 1, 2, 3, 4, 5, 6].map((g) => '<option value="' + g + '">' + (g + 1) + '</option>').join('') + '</select>' +
      'Seviye <select id="tLvl">' + [1, 3, 5, 8, 10, 13, 16, 20, 25].map((l) => '<option>' + l + '</option>').join('') + '</select>' +
      'Zorluk <select id="tDiff"><option value="normal">Normal</option><option value="dehset">Dehşet</option></select></div>' +
      '<div class="row">Soy: <select id="tF0">' + formOpts(0) + '</select> → <select id="tF1">' + formOpts(1) + '</select> → <select id="tF2">' + formOpts(2) + '</select></div>' +
      '<button id="tGo">🧪 Test olarak başla</button>';
    anchor.parentNode.insertBefore(box, anchor);
    $('tGo').onclick = () => start({
      stage: +$('tStage').value, gen: +$('tGen').value, level: +$('tLvl').value, diff: $('tDiff').value,
      forms: { 0: $('tF0').value, 1: $('tF1').value, 2: $('tF2').value },
    });
  }

  function start(o) {
    const g = G();
    const nameIn = $('nameInput');
    const nm = EV.Online.cleanName(nameIn.value) || 'Test';
    EV.Online.setName(nm.length >= 2 ? nm : 'Test');
    $('startPanel').hidden = true;
    document.body.classList.remove('prestart');
    U.audio.ensure();
    g.started = true;
    g.startForm = o.forms[0];
    g.newGame(o.diff);
    jump(o.stage, o.gen, o.level, o.forms);
  }

  /** İstenen aşama/nesle geç; seviyeyi rastgele kartlarla doldur; önceki aşamalar için gen ver. */
  function jump(stage, gen, level, forms) {
    const g = G();
    const L = g.legacy;
    L.forms = {};
    for (let s = 0; s <= stage; s++) if (forms && EV.FORMS.get(s, forms[s])) L.forms[s] = forms[s];
    const genes = EV.DATA.allGenes().filter((x) => L.genes.indexOf(x.id) < 0);
    for (let i = 0; i < stage + gen && genes.length; i++) L.genes.push(genes.splice(U.randInt(0, genes.length - 1), 1)[0].id);
    g.stageIndex = stage;
    g.generation = gen;
    g.evo = 0;
    g.startStage(false);
    levelUp(level - 1);
    g.player.hp = g.player.stats.maxHp;
    g.toast('🧪 ' + g.stageDisplayName() + ' · Nesil ' + (gen + 1) + ' · Seviye ' + g.build.level, '#9fe8f5', 2200);
  }

  /** n seviye: her birinde rastgele bir kart otomatik seçilir. */
  function levelUp(n) {
    const g = G();
    for (let i = 0; i < n; i++) {
      g.build.level++;
      const c = EV.Build.roll(g, 3)[0];
      if (c) EV.Build.apply(g, c);
    }
    EV.Build.recompute(g);
    EV.UI.buildSkillbar(g);
  }

  /* =========================================================
     Oyun içi panel
     ========================================================= */
  const btn = document.createElement('button');
  btn.id = 'tBtn';
  btn.textContent = '🧪';
  btn.title = 'Test paneli (P)';
  const panel = document.createElement('div');
  panel.id = 'tPanel';
  panel.hidden = true;
  const badge = document.createElement('div');
  badge.className = 'tbadge';
  badge.textContent = 'TEST MODU';

  function near(d) {
    const P = G().player;
    const a = P.yaw + U.rand(-0.6, 0.6);
    return { x: P.group.position.x + Math.sin(a) * d, z: P.group.position.z + Math.cos(a) * d };
  }

  function spawnType(id, variant, champ) {
    const g = G();
    const def = EV.MOBS.find(g.stageIndex, id) || EV.MOBS.TREASURE.find((d) => d.id === id);
    if (!def) return;
    const V = [1, 1, 1.2, 1.4, 1.75, 2.2][variant] || 1;
    const Vd = [1, 1, 1.1, 1.2, 1.32, 1.45][variant] || 1;
    const sc = EV.Enemies.statScale(g, 'normal');
    const ch = champ ? Object.keys(EV.Enemies.CHAMP).sort(() => Math.random() - 0.5).slice(0, 2) : null;
    const e = EV.Enemies.make(g, def, { pos: near(12), hp: def.hp * sc.hp * V, dmg: def.dmg * sc.dmg * Vd, variant, champ: ch });
    e.aggroT = 20;
  }

  function giveItems(rarity, n) {
    const g = G();
    const slots = EV.Items.SLOTS;
    let given = 0;
    for (let i = 0; i < n; i++) {
      const idx = g.inv.bag.indexOf(null);
      if (idx < 0) break;
      g.inv.bag[idx] = EV.Items.makeItem(U.pick(slots).id, rarity, Math.min(g.stageIndex + g.generation, 12));
      given++;
    }
    g.toast(given ? '🎁 ' + given + ' ' + RAR[rarity].name + ' eşya çantada (Tab)' : 'Çanta dolu', RAR[rarity].color, 1600);
  }

  const ACTIONS = {
    mini: (i) => { const g = G(); const d = EV.MOBS.MINIS[g.stageIndex][i]; if (g.miniBoss && g.miniBoss.alive) return g.toast('Önce mevcut ara bossu bitir', '#ffb35a'); EV.Enemies.spawnMini(g, d); },
    alpha: () => { const g = G(); if (g.bossActive) return g.toast('Alfa zaten sahada', '#ffb35a'); EV.Enemies.spawnAlpha(g); },
    apex: () => { const g = G(); if (g.apex && g.apex.alive) return; EV.Enemies.spawnApex(g); },
    nemesis: () => {
      const g = G();
      if (!(g.legacy.heroes || []).length) g.rememberHero();
      const h = g.legacy.heroes[g.legacy.heroes.length - 1];
      EV.Enemies.spawnNemesis(g, h);
    },
    treasure: () => EV.Enemies.spawnTreasure(G()),
    horde: () => { G().toast('🐾 SÜRÜ DALGASI!', '#ff8a5a', 1800); EV.Enemies.spawnHorde(G()); },
    moon: () => { const g = G(); g.bloodMoon = 60; document.body.classList.add('bloodmoon'); g.toast('🌕 KAN AYI — 60 sn', '#ff5a5a', 2000); },
    champ: () => { const g = G(); const pool = EV.MOBS.ENEMIES[g.stageIndex].filter((d) => d.spawn !== false && d.behavior !== 'passive'); spawnType(U.pick(pool).id, 2, true); },
    lvl1: () => { const g = G(); g.build.level++; g.build.picks++; },
    lvl5: () => { levelUp(5); G().toast('+5 seviye (kartlar otomatik)', '#9de89d', 1400); },
    ess: () => { const g = G(); g.inv.essence += 10000; g.toast('+10.000 🧬 Gen Özü', '#9de89d', 1400); },
    evo50: () => { const g = G(); g.gainEvo(Math.max(0, Math.ceil(g.evoMax() * 0.5 - g.evo)), 0); },
    evolve: () => { const g = G(); if (g.pendingStage) return; close(); g.onAlphaDefeated(); },
    fill: () => { const P = G().player; P.energy = P.stats.maxEnergy; P.rage = EV.CFG.TUNE.rageMax; P.hp = P.stats.maxHp; },
    clear: () => { const g = G(); g.enemies.slice().forEach((e) => { if (e.alive && !e.ally) g.killEnemy(e); }); },
    god: (b) => { god = !god; b.classList.toggle('on', god); },
    auto: () => EV.Player.toggleAuto(G()),
  };

  function renderPanel() {
    const g = G();
    const st = g.stageIndex;
    const minis = EV.MOBS.MINIS[st];
    const pool = EV.MOBS.ENEMIES[st].concat([EV.MOBS.TREASURE[st]]);
    panel.innerHTML =
      '<div class="top"><b>🧪 TEST PANELİ</b><button data-x="close">Kapat (P)</button></div>' +
      '<div class="st">' + g.stageDisplayName() + ' · Nesil ' + (g.generation + 1) + ' · Sv ' + g.build.level + ' · 🧬 ' + U.fmt(g.inv.essence) + '</div>' +
      '<h4>BOSSLAR</h4><div class="g">' + minis.map((m, i) => '<button data-a="mini" data-i="' + i + '">⚔️ ' + m.name + '</button>').join('') +
      '<button data-a="alpha">👑 Alfa</button><button data-a="apex">☠️ Apex</button><button data-a="nemesis">👤 Geçmiş Benlik</button></div>' +
      '<h4>OLAYLAR</h4><div class="g"><button data-a="horde">🐾 Sürü Dalgası</button><button data-a="moon">🌕 Kan Ayı</button>' +
      '<button data-a="treasure">✨ Hazine</button><button data-a="champ">⭐ Şampiyon</button></div>' +
      '<h4>DÜŞMAN GETİR</h4><div class="g"><select id="tMob">' + pool.map((d) => '<option value="' + d.id + '">' + d.name + ' (' + (d.behavior || '') + ')</option>').join('') + '</select>' +
      '<select id="tVar"><option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option><option value="5">V</option></select>' +
      '<button data-a="mob">Getir</button><button data-a="mobc">⭐ Şampiyon olarak</button></div>' +
      '<h4>OYUNCU</h4><div class="g"><button data-a="lvl1">+1 seviye (kart seç)</button><button data-a="lvl5">+5 seviye (oto)</button>' +
      '<button data-a="fill">Can/Enerji/Öfke doldur</button><button data-a="god" class="' + (god ? 'on' : '') + '">🛡️ Ölümsüz</button>' +
      '<button data-a="auto">🔁 Oto yetenek</button><button data-a="clear">💥 Hepsini öldür</button></div>' +
      '<h4>EŞYA · GEN ÖZÜ</h4><div class="g"><button data-a="ess">+10.000 🧬</button>' +
      RAR.map((r) => '<button data-a="item" data-r="' + r.id + '" style="border-color:' + r.color + '">3× ' + r.name + '</button>').join('') + '</div>' +
      '<h4>İLERLEME</h4><div class="g"><button data-a="evo50">EVO %50 (ara bosslar)</button><button data-a="evolve">🧬 Hemen evrimleş</button></div>' +
      '<h4>AŞAMAYA GİT</h4><div class="g"><select id="tJs">' + STAGES.map((s, i) => '<option value="' + i + '"' + (i === st ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
      '<select id="tJg">' + [0, 1, 2, 3, 4, 5, 6].map((x) => '<option value="' + x + '"' + (x === g.generation ? ' selected' : '') + '>Nesil ' + (x + 1) + '</option>').join('') + '</select>' +
      '<select id="tJl">' + [1, 5, 10, 15, 20].map((x) => '<option>' + x + '</option>').join('') + '</select><button data-a="go">Git</button></div>';
    panel.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (b.dataset.x === 'close') return close();
        if (a === 'mini') ACTIONS.mini(+b.dataset.i);
        else if (a === 'item') giveItems(+b.dataset.r, 3);
        else if (a === 'mob') spawnType($('tMob').value, +$('tVar').value, false);
        else if (a === 'mobc') spawnType($('tMob').value, +$('tVar').value, true);
        else if (a === 'go') { close(); jump(+$('tJs').value, +$('tJg').value, +$('tJl').value, G().legacy.forms); return; }
        else if (ACTIONS[a]) ACTIONS[a](b);
        const s = panel.querySelector('.st');
        if (s) s.textContent = g.stageDisplayName() + ' · Nesil ' + (g.generation + 1) + ' · Sv ' + g.build.level + ' · 🧬 ' + U.fmt(g.inv.essence);
      };
    });
  }

  function open() {
    const g = G();
    if (!g.started || EV.Cards.isOpen()) return;
    renderPanel();
    panel.hidden = false;
    g.pause();
  }
  function close() {
    panel.hidden = true;
    const g = G();
    if (g.started && !EV.Cards.isOpen() && !EV.Inv.isOpen()) g.resume();
  }
  function toggle() { if (panel.hidden) open(); else close(); }

  btn.onclick = toggle;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || (e.target && e.target.tagName === 'INPUT')) return;
    toggle();
  });

  // ölümsüzlük: oyuncuya gelen her hasar kaynağında engellenir (+ güvenlik için her kare can dolu)
  const hitPlayer0 = EV.Combat.hitPlayer;
  EV.Combat.hitPlayer = function () { return god ? 0 : hitPlayer0.apply(this, arguments); };
  (function godLoop() {
    requestAnimationFrame(godLoop);
    const g = G();
    if (god && g && g.player && g.player.alive && g.player.stats) g.player.hp = g.player.stats.maxHp;
  })();

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    document.body.appendChild(badge);
    buildStartBox();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  EV.Dev = { open, close, jump, levelUp, spawnType, giveItems, ACTIONS, get god() { return god; } };
})();
