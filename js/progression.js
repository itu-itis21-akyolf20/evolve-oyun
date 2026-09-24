/* ============================================================
   progression.js — kartlar, yapı (build), statlar, kalıtım

   İKİ KATMAN:
   game.build  — aşamaya ait, her aşamada SIFIRLANIR:
                 seviye, XP, 3 aktif + 1 ultimate, 5 pasif, yeniden çekme
   game.legacy — kalıcı, aşamalar arası TAŞINIR:
                 genler (seçilen), parçalar (etiketlerden), yankılar
                 (en çok kullanılan yetenek), keşfedilen kombolar

   Kart türleri: skill · upSkill · ult · upUlt · passive · upPassive
                 fusion · heal · energy
   ============================================================ */
window.EV = window.EV || {};

EV.Build = (function () {
  'use strict';

  const U = EV.U;
  const CFG = EV.CFG;
  const T = CFG.TUNE;
  const DATA = EV.DATA;
  const MAX_ECHOES = 5;

  /* =========================================================
     Koşu (aşama) durumu
     ========================================================= */
  function freshRun(game) {
    return {
      stage: game.stageIndex, level: 1, xp: 0,
      skills: [], ult: null, passives: [],
      rerolls: game.diff.rerolls, uses: {}, history: [],
      picks: 0, mods: {}, hooks: null,
    };
  }

  function freshLegacy() {
    return { genes: [], parts: [], echoes: [], combos: {}, trophies: 0, forms: {}, heroes: [] };
  }

  /** Seviye (L) -> (L+1) için XP. Aşamanın EVO hedefine bağlı: ~13 seviye/aşama. */
  function xpNeed(game) {
    return Math.round((game.evoMax() / 36) * Math.pow(T.xpGrowth, game.build.level - 1));
  }

  function newRun(game) {
    game.build = freshRun(game);
    recompute(game);
  }

  /* =========================================================
     Statlar
     ========================================================= */
  function addMods(dst, src, mul) {
    if (!src) return;
    for (const k in src) dst[k] = (dst[k] || 0) + src[k] * (mul == null ? 1 : mul);
  }

  /** Kalıcı + aşama kaynaklı modları toplar ve gen kancalarını hazırlar. */
  function recompute(game) {
    const b = game.build;
    const L = game.legacy;
    const m = {};
    b.passives.forEach((p) => addMods(m, DATA.passiveMods(DATA.passive(p.id), p.rank)));
    L.genes.forEach((id) => { const g = DATA.gene(id); if (g) addMods(m, g.mods); });
    L.parts.forEach((tag) => { const p = DATA.partFor(tag); if (p) addMods(m, p.mods); });
    if (game.inv) addMods(m, EV.Items.mods(game));
    // Avcı Trofesi (apex yenince) ve seçilen beden
    const tr = L.trophies || 0;
    if (tr) addMods(m, { dmg: 0.04 * tr, maxHp: 0.04 * tr });
    // soy: bu aşamanın bedeni tam, atalar yarı etkiyle (dikenli soy zırhlı kalır)
    EV.FORMS.lineage(L.forms).forEach((x) => {
      if (x.stage === game.stageIndex) addMods(m, x.form.mods);
      else if (x.stage < game.stageIndex) addMods(m, x.form.mods, 0.5);
    });
    b.mods = m;

    const hooks = { basicSt: [], hitChanceSt: [], critSt: [], onHurtSt: [], dashSt: [] };
    L.genes.forEach((id) => {
      const g = DATA.gene(id);
      if (!g) return;
      Object.keys(hooks).forEach((k) => { if (g[k]) hooks[k].push.apply(hooks[k], g[k]); });
    });
    // efsanevi eşyaların benzersiz etkileri de aynı kanca dilini kullanır
    if (game.inv) EV.Items.hooks(game).forEach((h) => {
      Object.keys(hooks).forEach((k) => { if (h[k]) hooks[k].push.apply(hooks[k], h[k]); });
    });
    b.hooks = hooks;
    if (game.player) game.player.stats = stats(game, null);
  }

  /** Nihai statlar; buffMods her kare üstüne eklenir. */
  function stats(game, buffMods) {
    const st = game.stage();
    const base = st.base;
    const Lv = game.build.level;
    const g = game.genMul();
    const m = {};
    addMods(m, game.build.mods);
    addMods(m, buffMods);
    const v = (k) => m[k] || 0;
    return {
      maxHp: base.hp * (1 + T.hpPerLevel * (Lv - 1)) * (1 + v('maxHp')) * g,
      dmg: base.dmg * (1 + T.dmgPerLevel * (Lv - 1)) * (1 + v('dmg')) * g,
      atkSpd: Math.min(2.5, 1 + v('atkSpd')),
      speed: base.speed * Math.min(1.6, 1 + v('speed')),
      maxEnergy: base.energy * (1 + v('maxEnergy')),
      energyRegen: base.regen * (1 + v('energyRegen')) * game.diff.energyRegen,
      cdr: Math.min(0.45, v('cdr')),
      crit: Math.min(0.75, 0.05 + v('crit')),
      critDmg: 1.75 + v('critDmg'),
      lifesteal: Math.min(0.35, v('lifesteal')),
      armor: Math.min(0.7, v('armor')),
      statusPower: 1 + v('statusPower'),
      statusDur: 1 + v('statusDur'),
      area: Math.min(1.8, 1 + v('area')),
      rageGain: 1 + v('rageGain'),
      pickup: 4.5 * (1 + v('pickup')),
      xpGain: 1 + v('xpGain'),
      hpRegen: 0.0015 + v('hpRegen'),
      summonCount: Math.floor(v('summonCount')),
      summonPower: 1 + v('summonPower'),
      dashCost: Math.max(0.4, 1 + v('dashCost')),
      reflect: Math.min(0.6, v('reflect')),
      ccDmg: v('ccDmg'),
      vsBleed: v('vsBleed'),
    };
  }

  /* =========================================================
     Kartlar
     ========================================================= */
  function fusionEligible(game, f) {
    if (f.stage !== game.stageIndex) return false;
    const s = game.build.skills.find((x) => x.id === f.from);
    if (!s || s.rank < 5) return false;
    if (f.needGene) return game.legacy.genes.indexOf(f.needGene) >= 0;
    if (f.needPassive) return game.build.passives.some((p) => p.id === f.needPassive);
    return false;
  }

  function candidates(game) {
    const b = game.build;
    const st = game.stageIndex;
    const out = [];
    const ownedSkill = new Set(b.skills.map((s) => s.id));
    const fusedFrom = new Set(b.skills.filter((s) => s.fused).map((s) => DATA.skill(s.id).from));

    if (b.skills.length < T.maxActives) {
      DATA.stageSkills(st, 'active').forEach((d) => {
        if (!ownedSkill.has(d.id) && !fusedFrom.has(d.id)) out.push({ type: 'skill', def: d, w: 1.0 });
      });
    }
    b.skills.forEach((s) => {
      const d = DATA.skill(s.id);
      if (!d.fusion && s.rank < 5) out.push({ type: 'upSkill', def: d, rank: s.rank + 1, w: 1.3 });
    });
    if (!b.ult && b.level >= 4) DATA.stageSkills(st, 'ult').forEach((d) => out.push({ type: 'ult', def: d, w: 1.6 }));
    if (b.ult && b.ult.rank < 5) out.push({ type: 'upUlt', def: DATA.skill(b.ult.id), rank: b.ult.rank + 1, w: 0.9 });

    const ownedP = new Set(b.passives.map((p) => p.id));
    if (b.passives.length < T.maxPassives) {
      DATA.stagePassives(st).forEach((d) => { if (!ownedP.has(d.id)) out.push({ type: 'passive', def: d, w: 0.9 }); });
    }
    b.passives.forEach((p) => {
      const d = DATA.passive(p.id);
      if (p.rank < d.max) out.push({ type: 'upPassive', def: d, rank: p.rank + 1, w: 1.0 });
    });
    DATA.allFusions().forEach((f) => { if (fusionEligible(game, f)) out.push({ type: 'fusion', def: f, w: 8 }); });
    return out;
  }

  function roll(game, n, onlyType) {
    let pool = candidates(game);
    if (onlyType) pool = pool.filter((c) => c.type === onlyType);
    const picks = U.sampleWeighted(pool, n, (c) => c.w);
    if (!picks.length) return [{ type: 'heal' }, { type: 'energy' }];
    return picks;
  }

  function findSkill(b, id) { return b.skills.find((x) => x.id === id); }

  function apply(game, card) {
    const b = game.build;
    const P = game.player;
    let undo = null;
    switch (card.type) {
      case 'skill':
        b.skills.push({ id: card.def.id, rank: 1, cd: 0 });
        undo = { type: 'removeSkill', id: card.def.id };
        break;
      case 'upSkill':
        findSkill(b, card.def.id).rank++;
        undo = { type: 'downSkill', id: card.def.id };
        break;
      case 'ult':
        b.ult = { id: card.def.id, rank: 1, cd: 0 };
        undo = { type: 'removeUlt' };
        break;
      case 'upUlt':
        b.ult.rank++;
        undo = { type: 'downUlt' };
        break;
      case 'passive':
        b.passives.push({ id: card.def.id, rank: 1 });
        undo = { type: 'removePassive', id: card.def.id };
        break;
      case 'upPassive':
        b.passives.find((x) => x.id === card.def.id).rank++;
        undo = { type: 'downPassive', id: card.def.id };
        break;
      case 'fusion': {
        const i = b.skills.findIndex((x) => x.id === card.def.from);
        const prev = b.skills[i];
        b.skills[i] = { id: card.def.id, rank: 5, cd: 0, fused: true };
        b.uses[card.def.id] = b.uses[prev.id] || 0;
        undo = { type: 'unfuse', index: i, prev };
        game.toast('🧬 EVRİMLEŞTİ: ' + card.def.name, '#ffd23d');
        U.audio.evolve();
        break;
      }
      case 'heal': game.healPlayer(P.stats.maxHp * 0.4); break;
      case 'energy': game.addEnergy(999); game.addRage(35); break;
      default: break;
    }
    if (undo) b.history.push({ undo, name: card.def ? card.def.name : '' });
    recompute(game);
    EV.UI.buildSkillbar(game);
  }

  /** Dehşet ölüm cezası: son kartı geri alır, adını döndürür. */
  function rollback(game) {
    const b = game.build;
    const h = b.history.pop();
    if (!h) return null;
    const u = h.undo;
    switch (u.type) {
      case 'removeSkill': b.skills = b.skills.filter((s) => s.id !== u.id); break;
      case 'downSkill': { const s = findSkill(b, u.id); if (s) s.rank = Math.max(1, s.rank - 1); break; }
      case 'removeUlt': b.ult = null; break;
      case 'downUlt': if (b.ult) b.ult.rank = Math.max(1, b.ult.rank - 1); break;
      case 'removePassive': b.passives = b.passives.filter((p) => p.id !== u.id); break;
      case 'downPassive': { const p = b.passives.find((x) => x.id === u.id); if (p) p.rank = Math.max(1, p.rank - 1); break; }
      case 'unfuse': b.skills[u.index] = u.prev; break;
      default: break;
    }
    recompute(game);
    EV.UI.buildSkillbar(game);
    return h.name;
  }

  /* =========================================================
     Gen kancaları
     ========================================================= */
  function applyList(game, e, list, checkChance) {
    const pow = game.player.stats.dmg * game.player.stats.statusPower;
    for (let i = 0; i < list.length && e.alive; i++) {
      const [id, n, ch] = list[i];
      if (checkChance && ch != null && Math.random() > ch) continue;
      EV.Status.apply(game, e, id, n, pow, true);
    }
  }

  function onPlayerHit(game, e, info) {
    const h = game.build.hooks;
    if (!h) return;
    if (info.basic) applyList(game, e, h.basicSt, true);
    applyList(game, e, h.hitChanceSt, true);
    if (info.crit) applyList(game, e, h.critSt, false);
  }

  function onPlayerHurt(game, attacker) {
    const h = game.build.hooks;
    if (h && attacker && attacker.alive) applyList(game, attacker, h.onHurtSt, false);
  }

  function onDash(game) {
    const h = game.build.hooks;
    if (!h || !h.dashSt.length) return;
    const p = game.player.group.position;
    EV.Enemies.forEachNear(p.x, p.z, 4.5, (e) => { if (!e.ally && !e.peaceful) applyList(game, e, h.dashSt, false); });
    EV.FX.ring(p, 0xc27bff, 4.5, 0.35);
  }

  /* =========================================================
     Evrim: gen teklifi, parçalar, yankı
     ========================================================= */
  function stageTags(game) {
    const b = game.build;
    const w = {};
    const add = (tags, v) => (tags || []).forEach((t) => { w[t] = (w[t] || 0) + v; });
    b.skills.forEach((s) => { const d = DATA.skill(s.id); add(d.tags, d.fusion ? 6 : s.rank); });
    if (b.ult) add(DATA.skill(b.ult.id).tags, b.ult.rank);
    b.passives.forEach((p) => add(DATA.passive(p.id).tags, p.rank * 0.5));
    return w;
  }

  function evolveOffer(game) {
    const L = game.legacy;
    const tags = stageTags(game);
    const stageId = Math.min(game.stageIndex, 2);
    let pool = DATA.allGenes().filter((g) => L.genes.indexOf(g.id) < 0 && g.stage === stageId);
    if (pool.length < 3) pool = pool.concat(DATA.allGenes().filter((g) => L.genes.indexOf(g.id) < 0 && g.stage !== stageId));
    const genes = U.sampleWeighted(pool, 3, (g) => 1 + g.tags.reduce((s, t) => s + (tags[t] || 0), 0) * 0.6);

    const parts = Object.keys(tags)
      .filter((t) => tags[t] > 0 && L.parts.indexOf(t) < 0 && DATA.partFor(t))
      .sort((a, b) => tags[b] - tags[a])
      .slice(0, 2)
      .map((t) => DATA.partFor(t));

    let echo = null;
    const b = game.build;
    const cand = b.skills.slice().sort((a, x) => (b.uses[x.id] || 0) - (b.uses[a.id] || 0));
    for (let i = 0; i < cand.length; i++) {
      if ((b.uses[cand[i].id] || 0) < 3) break;
      if (!L.echoes.some((e) => e.id === cand[i].id)) { echo = { id: cand[i].id, rank: Math.min(3, cand[i].rank) }; break; }
    }
    return { genes, parts, echo };
  }

  function applyEvolution(game, offer, geneId) {
    const L = game.legacy;
    if (geneId && L.genes.indexOf(geneId) < 0) L.genes.push(geneId);
    offer.parts.forEach((p) => { if (L.parts.indexOf(p.tag) < 0) L.parts.push(p.tag); });
    if (offer.echo) {
      L.echoes.push(Object.assign({ t: 3 }, offer.echo));
      if (L.echoes.length > MAX_ECHOES) L.echoes.shift();
    }
  }

  /** Oyuncu bedenine eklenecek görsel parça kimlikleri. */
  function extras(game) {
    return game.legacy.parts.map((t) => DATA.partFor(t)).filter(Boolean).map((p) => p.visual);
  }

  return {
    freshRun, freshLegacy, newRun, xpNeed, recompute, stats,
    candidates, roll, apply, rollback, fusionEligible,
    onPlayerHit, onPlayerHurt, onDash,
    stageTags, evolveOffer, applyEvolution, extras,
  };
})();
