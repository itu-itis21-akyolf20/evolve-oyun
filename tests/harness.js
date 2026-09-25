/* ============================================================
   tests/harness.js — tarayıcıya enjekte edilen test yardımcıları (window.T)

   T.start('normal'|'dehset')  yeni oyun başlatır, başlangıç kartını seçer
   T.sim(saniye, { dt, bot, pick, until })
       oyunu senkron ve HIZLANDIRILMIŞ koşturur; kart / evrim / ölüm
       ekranlarını otomatik geçer; bot=true ise otomatik oyuncu oynar
   T.state()  özet durum
   T.stats    sim boyunca toplanan sayaçlar (ölüm, kart, reaksiyon…)

   Otomatik oyuncu: en yakın düşmana kilitlenir, yaklaşır, saldırır,
   yetenekleri sırayla dener, yerdeki kırmızı uyarılardan kaçar,
   apex yaklaşınca kaçar. Amaç insan kadar iyi oynamak değil;
   oyunun her sistemini gerçek girdiyle çalıştırmak.
   ============================================================ */
window.T = (function () {
  'use strict';

  // Testler canlı liderliğe / bulut kaydına ASLA yazmasın; tarayıcı pencereleri de bloklamasın
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => (/supabase\.co/.test(String(u)) ? Promise.reject(new Error('test: ağ kapalı')) : realFetch(u, o));
  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  const G = () => EV.Game;
  const $ = (id) => document.getElementById(id);
  const stats = { deathBy: {}, deaths: 0, cards: [], genes: [], stages: [], modalLoops: 0, reactions: 0, casts: 0 };
  let release = [];
  let skillT = 0, strafeT = 0, strafe = 1, mateT = 0;

  function pickIndex(policy, n) {
    if (policy === 'first') return 0;
    if (typeof policy === 'function') return policy(n);
    return Math.floor(Math.random() * n);
  }

  function digit(i) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + (i + 1), key: String(i + 1) }));
  }

  /** Açık modal varsa geçer; bir şey yaptıysa true. */
  function handleModals(o) {
    o = o || {};
    if (!$('cardPanel').hidden) {
      const cards = document.querySelectorAll('#cardRow .card');
      if (cards.length) {
        const i = pickIndex(o.pick, cards.length);
        stats.cards.push(cards[i].querySelector('.cname') ? cards[i].querySelector('.cname').textContent : '?');
        digit(i);                     // fare tıklaması açılışta 0.8 sn kilitli; klavye (1-2-3) değil
      }
      return true;
    }
    if (!$('evolvePanel').hidden) {
      const genes = document.querySelectorAll('#evGenes .gene');
      if (genes.length) {
        const i = pickIndex(o.pickGene || o.pick, genes.length);
        stats.genes.push(genes[i].querySelector('.gn').textContent);
        digit(i);
      }
      stats.stages.push({ at: Math.round(G().time), stage: G().stageIndex, gen: G().generation, level: G().build.level });
      return true;
    }
    if (!$('deathPanel').hidden) { stats.deaths++; const by = G().lastHitBy || '?'; stats.deathBy[by] = (stats.deathBy[by] || 0) + 1; $('respawn').click(); return true; }
    if (!$('buildPanel').hidden) { EV.Cards.toggleBuild(G()); return true; }
    if (!$('invPanel').hidden) { EV.Inv.close(); return true; }
    return false;
  }

  function start(diff) {
    $('nameInput').value = 'TestBot';
    $(diff === 'dehset' ? 'diffDehset' : 'diffNormal').click();
    for (let i = 0; i < 5 && handleModals({ pick: 'first' }); i++) { /* başlangıç kartı */ }
    G().paused = false;
    return state();
  }

  /* ---------------- otomatik oyuncu ---------------- */
  function nearestHostile(g, r) {
    const p = g.player.group.position;
    return EV.Enemies.nearest(p.x, p.z, r, (e) => !e.ally && !e.peaceful);
  }

  function face(P, x, z) {
    P.yaw = Math.atan2(x - P.group.position.x, z - P.group.position.z);
    P.pitch = 0.32;
  }

  function botStep(dt) {
    const g = G(), P = g.player, I = EV.Input;
    release.forEach((c) => I._release(c));
    release = [];
    ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => { I.keys[k] = false; });
    I.mouse.left = false;
    if (!P.alive) return;

    const pp = P.group.position;
    const th = EV.Decal.threat(pp.x, pp.z, P.radius + 0.6);
    const apex = g.apex && g.apex.alive ? g.apex : null;
    const boss = g.boss && g.boss.alive ? g.boss : null;

    if (apex && !boss && apex.group.position.distanceTo(pp) < 32) {
      face(P, 2 * pp.x - apex.group.position.x, 2 * pp.z - apex.group.position.z);
      I.keys.KeyW = true;
      if (P.energy > 40) I._press('Space'), release.push('Space');
      return;
    }
    if (th) {
      // uyarıdan dışarı: merkezden uzağa koş, gerekirse atıl
      face(P, 2 * pp.x - th.x, 2 * pp.z - th.z);
      if (th.shape === 'rect') { P.yaw += Math.PI / 2; }
      I.keys.KeyW = true;
      if (P.energy > 30 && Math.random() < 0.15) { I._press('Space'); release.push('Space'); }
      return;
    }

    const t = boss || nearestHostile(g, 70);
    if (!t) {
      face(P, 0, 0);
      I.keys.KeyW = pp.length() > 10;
      return;
    }
    P.lockTarget = t;
    face(P, t.group.position.x, t.group.position.z);
    const d = EV.Creature.surfDist(t.group, pp.x, pp.z) - P.radius;
    if (d > 2.2) I.keys.KeyW = true;
    else {
      strafeT -= dt;
      if (strafeT <= 0) { strafe = -strafe; strafeT = 1.2 + Math.random(); }
      I.keys[strafe > 0 ? 'KeyD' : 'KeyA'] = true;
      I.mouse.left = true;
    }

    skillT -= dt;
    if (skillT <= 0 && d < 18) {
      skillT = 0.35;
      const codes = ['KeyQ', 'KeyE', 'KeyF'];
      const c = codes[Math.floor(Math.random() * codes.length)];
      I._press(c); release.push(c);
      stats.casts++;
      if (P.rage >= 100) { I._press('KeyR'); release.push('KeyR'); }
    }

    mateT -= dt;
    if (mateT <= 0) {
      mateT = 2;
      const mate = EV.Mating.mates(g)[0];
      if (mate && !EV.Mating.activeEgg() && mate.group.position.distanceTo(pp) < 5) { I._press('KeyF'); release.push('KeyF'); }
    }
  }

  /* ---------------- simülasyon ---------------- */
  function sim(seconds, o) {
    o = o || {};
    const dt = o.dt || 1 / 30;
    const steps = Math.ceil(seconds / dt);
    const g = G();
    let modalStreak = 0;
    for (let s = 0; s < steps; s++) {
      if (EV.EvoCine && EV.EvoCine.active) {          // evrim sinematiği: hızlı ilerlet
        EV.EvoCine.update(g, dt);
        EV.Input.endFrame();
        continue;
      }
      if (handleModals(o)) {
        if (++modalStreak > 50) { stats.modalLoops++; break; }
        continue;
      }
      modalStreak = 0;
      g.paused = false;
      if (o.bot !== false) botStep(dt);
      g.time += dt;
      EV.tick(dt);
      EV.Input.endFrame();
      if (o.until && o.until(g)) break;
    }
    return state();
  }

  function state() {
    const g = G(), P = g.player, b = g.build;
    const alive = g.enemies.filter((e) => e.alive);
    return {
      t: Math.round(g.time), stage: g.stageIndex, gen: g.generation, diff: g.diff.id,
      level: b ? b.level : 0, evo: Math.round(g.evo), evoMax: g.evoMax(), kills: g.kills,
      hp: P && P.stats ? Math.round(P.hp) + '/' + Math.round(P.stats.maxHp) : null,
      energy: P ? Math.round(P.energy) : 0, rage: P ? Math.round(P.rage) : 0,
      hostiles: alive.filter((e) => !e.ally && !e.peaceful).length, allies: alive.filter((e) => e.ally).length,
      boss: g.boss && g.boss.alive ? { name: g.boss.name, hp: Math.round(g.boss.hp), phase: g.boss.boss.phase } : null,
      apex: g.apex && g.apex.alive ? g.apex.name : null,
      skills: b ? b.skills.map((s) => s.id + ':' + s.rank) : [], ult: b && b.ult ? b.ult.id + ':' + b.ult.rank : null,
      passives: b ? b.passives.map((p) => p.id + ':' + p.rank) : [],
      legacy: g.legacy ? { genes: g.legacy.genes, parts: g.legacy.parts, echoes: g.legacy.echoes.map((e) => e.id), combos: Object.keys(g.legacy.combos) } : null,
      geometries: g.renderer.info.memory.geometries, sceneChildren: g.scene.children.length,
      decals: EV.Decal.count, fx: EV.FX.count, pickups: EV.Pickups.count, skills3d: EV.Skills.counts,
    };
  }

  return { start, sim, state, botStep, handleModals, stats };
})();
