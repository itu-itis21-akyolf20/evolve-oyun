/* ============================================================
   status.js — durum etkileri ve REAKSİYONLAR

   Her hedef (düşman ya da oyuncu) bir `st` sözlüğü taşır:
     yüklü:   st[id] = { n, t, pow }   (poison, bleed, burn, shock, slow, vuln)
     süreli:  st[id] = { t }           (stun, fear)
   pow: uygulayanın o anki hasar gücü; DoT'ler buna göre ölçeklenir.

   Reaksiyonlar sadece oyuncu tarafının uyguladığı durumlarla,
   düşmanlar üzerinde tetiklenir. Aynı hedefte aynı reaksiyonun
   1.5 sn bekleme süresi var: sonsuz zincirleri engeller.
   ============================================================ */
window.EV = window.EV || {};

EV.Status = (function () {
  'use strict';

  const U = EV.U;
  const DEF = EV.CFG.STATUS;
  const REACTIONS = EV.CFG.REACTIONS;
  const TICK = 0.5;
  const REACT_CD = 1.5;

  const isBoss = (t) => !!(t.isAlpha || t.isApex);
  const alive = (game, t) => (t === game.player ? t.alive : t.alive);

  function has(t, id) { return !!(t.st && t.st[id]); }
  function stacks(t, id) { return (t.st && t.st[id] && t.st[id].n) || 0; }
  function stunned(t) { return has(t, 'stun'); }
  function feared(t) { return has(t, 'fear'); }

  function speedMul(t) {
    if (!t.st) return 1;
    if (t.st.stun) return 0;
    const s = t.st.slow;
    return s ? Math.max(0.25, 1 - s.n * DEF.slow.per * (isBoss(t) ? 0.5 : 1)) : 1;
  }

  function dmgTakenMul(t) {
    const v = t.st && t.st.vuln;
    return v ? 1 + v.n * DEF.vuln.per : 1;
  }

  /* ---------------------------------------------------------
     apply — durum ekler; yüklü durumlarda üst sınırı uygular,
     şok dolunca patlar, sonra reaksiyonları kontrol eder.
     --------------------------------------------------------- */
  function apply(game, t, id, n, pow, fromPlayer) {
    const def = DEF[id];
    if (!def || !n || !alive(game, t)) return;
    if (!t.st) t.st = {};
    const st = t.st;
    const onEnemy = t !== game.player;
    const durMul = fromPlayer ? game.player.stats.statusDur : 1;

    if (def.type === 'stack') {
      const cur = st[id] || (st[id] = { n: 0, t: 0, pow: 0 });
      cur.n = Math.min(def.max, cur.n + n);
      cur.t = def.dur * durMul;
      cur.pow = Math.max(cur.pow, pow || 0);

      if (id === 'shock' && onEnemy && cur.n >= def.max) {
        cur.n = 0;
        const p = cur.pow;
        EV.Combat.hitEnemy(game, t, p * def.burst, { source: 'reaction', cls: 'shock' });
        apply(game, t, 'stun', def.stun, p, fromPlayer);
      }
    } else {
      const dur = n * (isBoss(t) ? (def.bossMul || 1) : 1) * durMul;
      const cur = st[id] || (st[id] = { t: 0 });
      cur.t = Math.max(cur.t, dur);
    }

    if (onEnemy && fromPlayer && t.alive) checkReactions(game, t, id);
  }

  function checkReactions(game, t, id) {
    for (let i = 0; i < REACTIONS.length; i++) {
      const R = REACTIONS[i];
      let other = null;
      if (R.a === id) other = R.b;
      else if (R.b === id) other = R.a;
      if (!other || !has(t, other) || !has(t, id)) continue;
      if (!t.rcd) t.rcd = {};
      if ((t.rcd[R.id] || 0) > 0) continue;
      t.rcd[R.id] = REACT_CD;
      trigger(game, t, R);
      if (!t.alive) return;
    }
  }

  /** Reaksiyonun gücü: iki durumdan güçlüsü; en az oyuncunun hasarının %80'i. */
  function powOf(game, t, a, b) {
    const s = t.st;
    return Math.max((s[a] && s[a].pow) || 0, (s[b] && s[b].pow) || 0, game.player.stats.dmg * 0.8);
  }

  function trigger(game, t, R) {
    const st = t.st;
    const pow = powOf(game, t, R.a, R.b);
    const hit = (dmg, cls) => EV.Combat.hitEnemy(game, t, dmg, { source: 'reaction', cls: cls || 'react' });

    switch (R.id) {
      case 'neuro': {
        const n = stacks(t, 'poison');
        delete st.poison;
        hit(pow * (0.6 + 0.25 * n));
        apply(game, t, 'stun', 1.2, pow, true);
        break;
      }
      case 'smoke':
        EV.Skills.spawnZone(game, {
          x: t.group.position.x, z: t.group.position.z, r: 4, dur: 3, tick: 0.5,
          dmgAbs: pow * 0.3, st: [['poison', 1]], color: 0x9acd32, source: 'reaction',
        });
        break;
      case 'sepsis':
        t.sepsisT = 4;
        break;
      case 'shred': {
        const n = stacks(t, 'bleed');
        delete st.bleed;
        hit(pow * 2.2 * (0.6 + 0.2 * n));
        break;
      }
      case 'sear': {
        const dealt = hit(pow * 1.6);
        game.healPlayer(dealt * 0.3);
        break;
      }
      case 'overload': {
        const c = t.group.position;
        EV.Enemies.forEachNear(c.x, c.z, 5.5, (o) => {
          if (o === t || o.ally || o.peaceful) return;
          EV.FX.beam(c.clone().setY(c.y + 1), o.group.position.clone().setY(o.group.position.y + 1), 0x7fd0ff);
          EV.Combat.hitEnemy(game, o, pow * 1.2, { source: 'reaction', cls: 'shock' });
          apply(game, o, 'shock', 1, pow, false);
        });
        hit(pow * 0.8);
        break;
      }
      case 'paralyze':
        apply(game, t, 'stun', 2, pow, true);
        break;
      case 'execute':
        if (!isBoss(t) && t.hp / t.maxHp < 0.22) EV.Combat.hitEnemy(game, t, t.hp + 1, { source: 'reaction', cls: 'crit', pure: true });
        else hit(pow * 3, 'crit');
        break;
      case 'terror':
        if (st.bleed) st.bleed.n = DEF.bleed.max;
        break;
      default: break;
    }

    if (t.group) {
      const p = t.group.position.clone();
      p.y += (t.group.userData.height || 2) + 1.2;
      EV.UI.floatText(p, R.name + '!', R.color);
    }
    U.audio.react();
    game.onReaction(R);
  }

  /* ---------------------------------------------------------
     tick — DoT hasarı ve süre sayaçları
     --------------------------------------------------------- */
  function tick(game, t, dt) {
    const st = t.st;
    if (!st) return;
    if (t.rcd) for (const k in t.rcd) if (t.rcd[k] > 0) t.rcd[k] -= dt;
    if (t.sepsisT > 0) t.sepsisT -= dt;

    t.dotAcc = (t.dotAcc || 0) + dt;
    if (t.dotAcc >= TICK) {
      t.dotAcc -= TICK;
      let dmg = 0;
      if (st.poison) dmg += st.poison.pow * DEF.poison.dot * st.poison.n;
      if (st.bleed) dmg += st.bleed.pow * DEF.bleed.dot * st.bleed.n * (t.moving ? DEF.bleed.movingMul : 1);
      if (st.burn) dmg += st.burn.pow * DEF.burn.dot * st.burn.n;
      dmg *= TICK * (t.sepsisT > 0 ? 1.8 : 1);
      if (dmg > 0.5) {
        if (t === game.player) EV.Combat.hitPlayer(game, dmg, { dot: true });
        else EV.Combat.hitEnemy(game, t, dmg, { source: 'dot', cls: 'dot' });
        if (!alive(game, t)) return;
      }
    }

    for (const id in st) {
      const s = st[id];
      s.t -= dt;
      if (s.t <= 0) delete st[id];
    }
  }

  /** Yanık, taşıyıcısı ölünce yakındakilere sıçrar. */
  function onDeath(game, t) {
    const b = t.st && t.st.burn;
    if (!b || !t.group) return;
    const c = t.group.position;
    EV.Enemies.forEachNear(c.x, c.z, 4, (o) => {
      if (o !== t && !o.ally && !o.peaceful) apply(game, o, 'burn', Math.max(1, b.n - 1), b.pow, true);
    });
  }

  function clear(t) { t.st = null; t.rcd = null; t.sepsisT = 0; }

  /** Hedef çerçevesi / can barı için en fazla 4 aktif durum. */
  function list(t) {
    if (!t.st) return [];
    return Object.keys(t.st).slice(0, 4).map((id) => ({ id, n: t.st[id].n || 0, def: DEF[id] }));
  }

  return { apply, tick, has, stacks, stunned, feared, speedMul, dmgTakenMul, onDeath, clear, list };
})();
