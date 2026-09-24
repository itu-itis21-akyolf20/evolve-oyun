/* ============================================================
   combat.js — tek hasar hattı

   Tüm hasar buradan geçer: kritik, kırılganlık, zırh, kalkan,
   can çalma, öfke, gen tetikleri, geri tepme, sayılar, ölüm.
   source:
     'player'   oyuncunun doğrudan vuruşu (kritik + gen tetikleri)
     'echo'     kalıtsal yankı (oyuncu gibi sayılır)
     'ally'     çağrılar/yavrular
     'dot'      süreli hasar
     'reaction' reaksiyon patlamaları
   ============================================================ */
window.EV = window.EV || {};

EV.Combat = (function () {
  'use strict';

  const U = EV.U;
  const T = EV.CFG.TUNE;
  const Status = EV.Status;
  const _v = new THREE.Vector3();

  function hitEnemy(game, e, amount, o) {
    if (!e || !e.alive || !(amount > 0)) return 0;
    o = o || {};
    const P = game.player, S = P.stats;
    const src = o.source || 'player';
    const direct = src === 'player' || src === 'echo';
    const friendly = src !== 'enemy';

    let dmg = amount;
    let crit = false;
    if (direct) {
      if (o.forceCrit || Math.random() < S.crit) { crit = true; dmg *= S.critDmg; }
      if (S.ccDmg && (Status.stunned(e) || Status.has(e, 'slow'))) dmg *= 1 + S.ccDmg;
      if (S.vsBleed && Status.has(e, 'bleed')) dmg *= 1 + S.vsBleed;
    }
    if (!o.pure) {
      dmg *= Status.dmgTakenMul(e);
      if (e.armor) dmg *= 1 - e.armor;
    }
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.lastHitT = game.time;
    if (src !== 'ally' && src !== 'enemy' && game.stats) {
      game.stats.totalDmg += dmg;
      if (dmg > game.stats.maxHit) { game.stats.maxHit = dmg; game.stats.maxHitNew = true; }
    }
    if (friendly) EV.Enemies.onDamaged(game, e, src);

    // durumlar
    const pow = o.pow != null ? o.pow : S.dmg * S.statusPower;
    if (o.st) {
      // reaksiyon kaynaklı durumlar zincir başlatmaz: aksi halde duman->zehir->duman sonsuza büyüyordu
      const chain = friendly && src !== 'reaction';
      for (let i = 0; i < o.st.length && e.alive; i++) Status.apply(game, e, o.st[i][0], o.st[i][1], pow, chain);
    }
    if (direct && e.alive) {
      EV.Build.onPlayerHit(game, e, { crit, basic: !!o.basic });
      const buffSt = P.buffOnHit;
      for (let i = 0; i < buffSt.length && e.alive; i++) Status.apply(game, e, buffSt[i][0], buffSt[i][1], pow, true);
    }

    // can çalma: tek vuruşta maks. canın %6'sından fazla iyileştirmez
    if (direct && S.lifesteal > 0) game.healPlayer(Math.min(dmg * S.lifesteal, S.maxHp * 0.06));

    // öfke
    if (direct && !o.noRage) game.addRage(o.basic ? 2.2 : 1.4);
    else if (src === 'dot' || src === 'reaction') game.addRage(0.2);

    // geri tepme (iri yaratıklar az savrulur)
    if (o.knock && o.from && e.alive) {
      const heavy = e.isAlpha || e.isApex || e.isMini;
      _v.set(e.group.position.x - o.from.x, 0, e.group.position.z - o.from.z);
      const l = _v.length() || 1;
      const f = o.knock * (heavy ? 0.15 : 1) * (o.pull ? -1 : 1);
      e.knock.x += (_v.x / l) * f;
      e.knock.z += (_v.z / l) * f;
    }

    EV.Creature.flash(e.group);
    const at = e.group.position.clone();
    at.y += e.group.userData.height + 0.4;
    EV.UI.dmgNumber(at, U.fmt(dmg), crit ? 'crit' : (o.cls || (src === 'ally' ? 'ally' : '')), game.camera);
    if (direct) (crit ? U.audio.crit : U.audio.hit)();

    if (e.hp <= 0) game.killEnemy(e, o);
    return dmg;
  }

  /** Belirli bir alandaki tüm düşmanlara vurur (kapsül yüzeyine göre). */
  function hitArea(game, x, z, r, amount, o) {
    let n = 0;
    EV.Enemies.forEachNear(x, z, r + 6, (e) => {
      if (e.ally || e.peaceful) return;
      if (EV.Creature.surfDist(e.group, x, z) <= r) {
        hitEnemy(game, e, amount, o);
        n++;
      }
    });
    return n;
  }

  function hitPlayer(game, amount, o) {
    o = o || {};
    const P = game.player;
    if (!P.alive || !(amount > 0)) return 0;
    if (!o.dot && P.iframe > 0) return 0;
    const S = P.stats;

    let dmg = amount * (1 - S.armor);
    let absorbed = 0;
    if (P.shield > 0) {
      absorbed = Math.min(P.shield, dmg);
      P.shield -= absorbed;
      dmg -= absorbed;
    }
    dmg = Math.round(dmg);
    const at = P.group.position.clone();
    at.y += P.group.userData.height + 0.4;

    if (dmg <= 0) {
      if (!o.dot) {
        P.iframe = T.invuln * 0.5;
        EV.UI.dmgNumber(at, 'EMİLDİ', 'shield', game.camera);
      }
      return 0;
    }

    P.hp -= dmg;
    game.lastHitBy = o.attacker ? o.attacker.name : (o.dot ? 'süreli hasar' : (o.by || 'mermi'));
    const va = o.attacker;
    if (va && va.alive && va.champ && va.champ.indexOf('vamp') >= 0) {      // vampirik şampiyon vurdukça iyileşir
      va.hp = Math.min(va.maxHp, va.hp + va.maxHp * 0.05);
      EV.FX.burst(va.group.position.clone().setY(va.group.position.y + va.group.userData.height), 0xff3d5a, 5, 3);
    }
    if (!o.dot) P.iframe = T.invuln;
    game.addRage((dmg / S.maxHp) * 80);

    if (o.st) {
      for (let i = 0; i < o.st.length; i++) Status.apply(game, P, o.st[i][0], o.st[i][1], o.pow || amount * 0.6, false);
    }
    if (o.attacker && o.attacker.alive && o.melee) {
      if (S.reflect > 0) hitEnemy(game, o.attacker, dmg * S.reflect, { source: 'reaction', cls: 'reflect' });
      EV.Build.onPlayerHurt(game, o.attacker);
    }

    EV.Creature.flash(P.group);
    EV.UI.dmgNumber(at, '-' + U.fmt(dmg), o.dot ? 'hurtdot' : 'hurt', game.camera);
    if (!o.dot) { U.audio.hurt(); EV.UI.hurtFlash(dmg / S.maxHp); }

    if (P.hp <= 0) game.onDeath();
    return dmg;
  }

  return { hitEnemy, hitArea, hitPlayer };
})();
