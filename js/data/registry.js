/* ============================================================
   data/registry.js — yetenek / pasif / füzyon / gen kayıt defteri
   İçerik dosyaları (cell.js, reptile.js …) buraya kayıt olur.

   Yetenek türleri (kind): bolt cone nova zone dash leap chain buff summon
   orbit trap hunt · beam barrage boomerang totem blink wave (js/skills.js)

   Rütbe modeli: def.base = rütbe 1 parametreleri,
   def.ranks[i] = rütbe (i+2)'de geçerli olan MUTLAK değerler.
   Delta değil mutlak değer: dengeyi okumak ve ayarlamak kolay olsun.
   ============================================================ */
window.EV = window.EV || {};

EV.DATA = (function () {
  'use strict';

  const U = EV.U;
  const skills = Object.create(null);
  const passives = Object.create(null);
  const fusions = Object.create(null);
  const genes = Object.create(null);
  const parts = Object.create(null);   // etiket -> vücut parçası

  function add(map, list) { list.forEach((d) => { map[d.id] = d; }); }

  /* ---------------- sorgular ---------------- */
  function skill(id) { return skills[id] || fusions[id] || null; }

  function stageSkills(stage, slot) {
    return Object.values(skills).filter((s) => s.stage === stage && s.slot === slot);
  }
  function stagePassives(stage) {
    return Object.values(passives).filter((p) => p.stage === stage);
  }

  /** Rütbeye göre etkin parametreler (maliyet ve bekleme dahil). */
  function params(def, rank) {
    const p = Object.assign({ cost: def.cost, cd: def.cd }, def.base);
    const ranks = def.ranks || [];
    for (let i = 0; i < rank - 1 && i < ranks.length; i++) Object.assign(p, ranks[i]);
    delete p.txt;
    return p;
  }

  /** Pasifin bu rütbedeki toplam stat katkısı. */
  function passiveMods(def, rank) {
    const out = {};
    Object.keys(def.per || {}).forEach((k) => { out[k] = def.per[k] * rank; });
    (def.bonus || []).forEach((b) => {
      if (rank >= b.at) Object.keys(b.mods).forEach((k) => { out[k] = (out[k] || 0) + b.mods[k]; });
    });
    return out;
  }

  /* ---------------- açıklama üretimi ---------------- */
  const MOD_LABEL = {
    maxHp: 'Maks. can', dmg: 'Hasar', atkSpd: 'Saldırı hızı', speed: 'Hız',
    maxEnergy: 'Maks. enerji', energyRegen: 'Enerji dolumu', cdr: 'Bekleme azalması',
    crit: 'Kritik şansı', critDmg: 'Kritik hasarı', lifesteal: 'Can çalma', armor: 'Zırh',
    statusPower: 'Durum hasarı', statusDur: 'Durum süresi', area: 'Alan',
    rageGain: 'Öfke kazanımı', pickup: 'Toplama menzili', xpGain: 'Deneyim',
    hpRegen: 'Can yenilenmesi', summonCount: 'Çağrı sayısı', summonPower: 'Çağrı gücü',
    dashCost: 'Atılım maliyeti', reflect: 'Hasar yansıtma', shield: 'Kalkan',
    ccDmg: 'Etkisizlere hasar', vsBleed: 'Kanayanlara hasar',
  };

  function modText(k, v) {
    const label = MOD_LABEL[k] || k;
    if (k === 'summonCount') return label + ' +' + v;
    if (k === 'hpRegen') return label + ' +%' + (v * 100).toFixed(1) + '/sn';
    const sign = v >= 0 ? '+' : '';
    return label + ' ' + sign + Math.round(v * 100) + '%';
  }

  function modsText(mods) {
    return Object.keys(mods || {}).map((k) => modText(k, mods[k])).join(' · ');
  }

  function statusText(st) {
    if (!st || !st.length) return '';
    return st.map(([id, n]) => {
      const d = EV.CFG.STATUS[id];
      if (!d) return id;
      return d.type === 'timed' ? d.name + ' ' + n + 'sn' : d.name + ' ' + n;
    }).join(' · ');
  }

  /** Kart ve panel için kısa, sayısal özet. */
  function describe(def, rank) {
    const p = params(def, rank);
    const bits = [];
    const dmg = p.dmg != null ? U.pct(p.dmg) + ' hasar' : '';
    switch (def.kind) {
      case 'bolt':
        bits.push(dmg, (p.radial ? p.count + ' yöne ' : p.count + ' ') + 'mermi');
        if (p.pierce) bits.push(p.pierce >= 50 ? 'her şeyi deler' : p.pierce + ' delme');
        if (p.explode) bits.push(p.explode + 'm patlama');
        if (p.pull) bits.push('çeker');
        if (p.chainOnHit) bits.push('isabette ' + p.chainOnHit + ' sekme');
        break;
      case 'cone':
        bits.push(dmg, p.range + 'm koni');
        if (p.hits > 1) bits.push(p.hits + ' vuruş');
        if (p.lunge) bits.push('ileri atılır');
        break;
      case 'nova':
        bits.push(dmg, p.r + 'm çevre');
        if (p.pulses > 1) bits.push(p.pulses + ' dalga');
        if (p.shards) bits.push(p.shards.count + ' diken');
        if (p.summon) bits.push(p.summon.count + ' yardımcı');
        break;
      case 'zone':
        bits.push(U.pct(p.dmg) + '/tık', p.r + 'm', p.dur + 'sn');
        if (p.pull) bits.push('içine çeker');
        if (p.heal) bits.push('hasarın %' + Math.round(p.heal * 100) + '\'i can');
        break;
      case 'dash': bits.push(p.dist + 'm atılım', dmg); if (p.chainOnHit) bits.push('isabette sekme'); break;
      case 'leap':
        bits.push(p.castRange + 'm sıçrama', dmg, p.r + 'm iniş');
        if (p.summon) bits.push(p.summon.count + ' yardımcı');
        break;
      case 'chain': bits.push(dmg, p.bounces ? p.bounces + ' sekme' : 'tek hedef'); break;
      case 'buff':  bits.push(p.dur + 'sn', modsText(p.mods)); if (p.onHitSt) bits.push('vuruşlar: ' + statusText(p.onHitSt)); break;
      case 'summon': bits.push(p.count + ' yardımcı', p.dur + 'sn'); if (p.healFrac) bits.push('%' + Math.round(p.healFrac * 100) + ' iyileşme'); break;
      case 'orbit': bits.push(p.count + ' küre', p.dur + 'sn', dmg); break;
      case 'trap':  bits.push(dmg, 'en fazla ' + p.max + ' tuzak'); break;
      case 'hunt':  bits.push(p.count + ' hedefe atlar', dmg, 'hep kritik'); break;
      case 'beam':
        bits.push(U.pct(p.dmg) + '/tık', p.dur + 'sn ışın', p.range + 'm');
        bits.push(p.pierce ? 'delip geçer' : 'ilk hedefte durur');
        if (p.ramp) bits.push('aynı hedefte her tık +%' + Math.round(p.ramp * 100));
        if (p.critEvery) bits.push('her ' + p.critEvery + '. tık kritik');
        break;
      case 'barrage':
        bits.push(p.count + ' × ' + dmg, p.r + 'm alan', p.blast + 'm darbe');
        if (p.seek) bits.push('avları tek tek hedefler');
        break;
      case 'boomerang':
        bits.push(dmg, (p.radial ? p.count + ' yöne ' : p.count > 1 ? p.count + ' ' : '') + 'bumerang', 'gidişte ve dönüşte vurur');
        if (p.grow) bits.push('her isabette +%' + Math.round(p.grow * 100) + ' büyür');
        if (p.pullBack) bits.push('dönüşte çeker');
        break;
      case 'totem': {
        const act = p.mode === 'pulse' ? 'nabız' : p.mode === 'zap' ? 'yıldırım' : 'tükürük';
        bits.push(dmg + ' ' + act + ' / ' + p.rate + 'sn', p.dur + 'sn', p.r + 'm');
        if (p.bounces) bits.push(p.bounces + ' sekme');
        if (p.explode) bits.push(p.explode + 'm patlama');
        if (p.max > 1) bits.push('en fazla ' + p.max);
        break;
      }
      case 'blink':
        bits.push((p.castRange || p.dist) + 'm ' + (p.burrow ? 'kum altından' : 'ışınlanma'), dmg, p.r + 'm patlama');
        if (p.behind) bits.push('hedefin arkasına geçer');
        if (p.crit) bits.push('hep kritik');
        if (p.zone) bits.push('ardında ' + p.zone.dur + 'sn asit gölü');
        break;
      case 'wave':
        bits.push(dmg, p.range + 'm menzil', p.shape === 'line' ? p.width + 'm genişlikte duvar' : 'genişleyen yay');
        if (p.count > 1) bits.push(p.count + ' dalga yelpaze');
        if (p.waves > 1) bits.push(p.waves + ' art arda');
        if (p.carry) bits.push('önüne katıp sürükler');
        break;
      default: break;
    }
    const st = statusText(p.st);
    if (st) bits.push(st);
    return bits.filter(Boolean).join(' · ');
  }

  function rankText(def, rank) {
    if (rank <= 1) return def.flavor || '';
    const r = (def.ranks || [])[rank - 2];
    return (r && r.txt) || '';
  }

  function tagChips(tags) {
    return (tags || []).map((t) => {
      const d = EV.CFG.TAGS[t];
      return d ? '<i class="tag" style="--c:' + d.color + '">' + d.name + '</i>' : '';
    }).join('');
  }

  return {
    addSkills: (l) => add(skills, l),
    addPassives: (l) => add(passives, l),
    addFusions: (l) => add(fusions, l),
    addGenes: (l) => add(genes, l),
    addParts: (l) => l.forEach((p) => { parts[p.tag] = p; }),
    skill, stageSkills, stagePassives, params, passiveMods,
    describe, rankText, statusText, modsText, modText, tagChips,
    passive: (id) => passives[id] || null,
    fusion: (id) => fusions[id] || null,
    gene: (id) => genes[id] || null,
    partFor: (tag) => parts[tag] || null,
    allFusions: () => Object.values(fusions),
    allGenes: () => Object.values(genes),
    allParts: () => Object.values(parts),
    MOD_LABEL,
  };
})();
