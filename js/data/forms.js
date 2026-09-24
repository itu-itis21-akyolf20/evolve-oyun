/* ============================================================
   data/forms.js — SOY AĞACI: bedenler ve aralarındaki yollar

   Oyun başında hücre biçimi seçilir; her evrimde sadece mevcut
   bedenden TÜREYEBİLEN dallar sunulur (from). Sonraki nesillerde
   aynı beden güçlenerek kalabilir ya da yakın akrabaya geçilir (kin).

   body:  bu bedenin görünüşü (aşamanın temel bedenine uygulanır)
   trait: soydan gelen iz — torunlarda da kalır (diken, pul, pençe…)
   mods:  kalıcı stat farkları (progression.recompute ekler)
   locked: henüz oynanamayan dal (evrim ekranında "yakında")
   ============================================================ */
window.EV = window.EV || {};

EV.FORMS = (function () {
  'use strict';

  const BY_STAGE = {
    0: [
      { id: 'amoeba', name: 'Amip', icon: '🦠', desc: 'İri ve dayanıklı; yuttukça iyileşir.',
        mods: { maxHp: 0.12, lifesteal: 0.02 },
        body: { scale: 1.08, parts: { flagella: 1, cilia: true } },
        trait: { extras: ['bumps'] }, traitName: 'kabarık deri' },
      { id: 'flagellate', name: 'Kamçılı', icon: '〰️', desc: 'Hızlı ve çevik; üç kamçıyla süzülür.',
        mods: { speed: 0.08, atkSpd: 0.06 },
        body: { scale: 0.94, parts: { flagella: 3, cilia: false } },
        trait: { extras: ['stripes'] }, traitName: 'ışıklı çizgiler' },
      { id: 'spiky', name: 'Dikenli', icon: '✴️', desc: 'Zırhlı; sana vuran dikenlere batar.',
        mods: { armor: 0.06, reflect: 0.08 },
        body: { scale: 1.0, parts: { flagella: 1, spikes: true } },
        trait: { parts: { spikes: true } }, traitName: 'sırt dikenleri' },
    ],
    1: [
      { id: 'lizard', name: 'Kertenkele', icon: '🦎', from: ['amoeba', 'flagellate'], desc: 'Dengeli ve çevik; uzun kuyruk, dört bacak.',
        mods: { speed: 0.06, atkSpd: 0.05 },
        body: { scale: 1.0, parts: { legs: 4, tail: 'long' } },
        trait: { extras: ['crest'] }, traitName: 'baş ibiği' },
      { id: 'croc', name: 'Timsah', icon: '🐊', from: ['amoeba', 'spiky'], desc: 'Ağır zırhlı, dayanıklı; yavaş ama çok sert.',
        mods: { maxHp: 0.2, armor: 0.08, dmg: 0.06, speed: -0.08 },
        body: { scale: 1.12, parts: { legs: 4, tail: 'long', fangs: true }, body: 0x3f5f36, accent: 0x243a1c },
        trait: { extras: ['scutes'] }, traitName: 'sırt pulları' },
      { id: 'raptor', name: 'Raptor', icon: '🦖', from: ['flagellate'], desc: 'İki ayaklı avcı: hızlı saldırı, yüksek kritik; daha kırılgan.',
        mods: { atkSpd: 0.15, crit: 0.06, speed: 0.08, maxHp: -0.08 },
        body: { scale: 0.95, parts: { legs: 2, tail: 'long', fangs: true } },
        trait: { extras: ['claws'] }, traitName: 'orak pençeler' },
      { id: 'turtle', name: 'Kaplumbağa', icon: '🐢', from: ['spiky'], desc: 'Kabuklu kale: çok zırh ve yansıtma; en yavaşı.',
        mods: { armor: 0.14, reflect: 0.12, maxHp: 0.12, speed: -0.12 },
        body: { scale: 1.1, parts: { legs: 4, tail: 'short' }, body: 0x5a6a3a, accent: 0x34401e },
        trait: { extras: ['plates'] }, traitName: 'kabuk plakaları' },
      { id: 'plesio', name: 'Deniz Sürüngeni', icon: '🐋', from: ['amoeba', 'spiky'], locked: true, desc: 'Suya dönüş — deniz dalı yakında.' },
      { id: 'ptero', name: 'Pterozor', icon: '🦅', from: ['flagellate'], locked: true, desc: 'Göğe yükseliş — hava dalı yakında.' },
    ],
    2: [
      { id: 'wolf', name: 'Kurt', icon: '🐺', from: ['lizard', 'raptor'], kin: ['cat', 'bear'], desc: 'Sürü avcısı: hızlı, dengeli, kritik vuruşlar.',
        mods: { speed: 0.07, crit: 0.05, atkSpd: 0.05 },
        body: { scale: 1.0, parts: { legs: 4, tail: 'bushy', fur: true, ears: true, fangs: true }, body: 0x8a8a92, accent: 0x55555e },
        trait: { extras: ['mane'] }, traitName: 'yele' },
      { id: 'cat', name: 'Büyük Kedi', icon: '🐆', from: ['raptor'], kin: ['wolf'], desc: 'Pusu ustası: çok hızlı saldırı ve kritik hasar; ince yapılı.',
        mods: { atkSpd: 0.14, critDmg: 0.3, speed: 0.1, maxHp: -0.06 },
        body: { scale: 0.95, parts: { legs: 4, tail: 'long', fur: true, ears: true, fangs: true }, body: 0xd9a24e, accent: 0x7a5228 },
        trait: { extras: ['claws'] }, traitName: 'pençeler' },
      { id: 'bear', name: 'Ayı', icon: '🐻', from: ['croc', 'lizard'], kin: ['wolf', 'armadillo'], desc: 'Dev ve dayanıklı: çok can, zırh ve güç; yavaş.',
        mods: { maxHp: 0.25, armor: 0.07, dmg: 0.08, speed: -0.1 },
        body: { scale: 1.2, parts: { legs: 4, tail: 'short', fur: true, ears: true, fangs: true }, body: 0x5a3e2a, accent: 0x33241a },
        trait: { extras: ['tusks'] }, traitName: 'azı dişleri' },
      { id: 'armadillo', name: 'Dev Tatu', icon: '🦔', from: ['turtle', 'croc'], kin: ['bear'], desc: 'Zırhlı memeli: yansıtma ve dayanıklılık; kabuğunu korur.',
        mods: { armor: 0.16, reflect: 0.14, maxHp: 0.15, speed: -0.06 },
        body: { scale: 1.1, parts: { legs: 4, tail: 'long', ears: true, spikes: true }, body: 0x8a7a5a, accent: 0x5a4a30 },
        trait: { extras: ['plates'] }, traitName: 'zırh plakaları' },
      { id: 'whale', name: 'Balina', icon: '🐳', from: ['croc', 'plesio'], locked: true, desc: 'Okyanus devi — deniz dalı yakında.' },
      { id: 'bird', name: 'Yırtıcı Kuş', icon: '🦅', from: ['raptor', 'ptero'], locked: true, desc: 'Gökyüzü avcısı — hava dalı yakında.' },
    ],
  };

  function list(stage) { return BY_STAGE[stage] || []; }
  function get(stage, id) { return list(stage).find((f) => f.id === id && !f.locked) || null; }
  function any(stage, id) { return list(stage).find((f) => f.id === id) || null; }

  /** Seçilen bedenlerin soy yolu: [{stage, form}] (eski kayıtta eksik aşamalar atlanır). */
  function lineage(forms) {
    const out = [];
    [0, 1, 2].forEach((st) => { const f = get(st, (forms || {})[st]); if (f) out.push({ stage: st, form: f }); });
    return out;
  }

  /**
   * Evrim seçenekleri. nextStage > mevcut aşama: mevcut bedenden türeyenler.
   * Aynı aşama (yeni nesil): mevcut beden + yakın akrabaları.
   * Ata bilinmiyorsa (eski kayıt) aşamanın bütün açık bedenleri.
   * Kilitli dallar (deniz/hava) varsa "yakında" olarak döner.
   */
  function options(nextStage, curStage, forms) {
    forms = forms || {};
    const all = list(nextStage);
    if (nextStage === curStage) {
      const cur = get(curStage, forms[curStage]);
      if (!cur) return all.filter((f) => !f.locked);
      return [cur].concat((cur.kin || []).map((id) => get(nextStage, id)).filter(Boolean));
    }
    const parent = forms[curStage];
    if (!parent) return all.filter((f) => !f.locked);
    const out = all.filter((f) => (f.from || []).indexOf(parent) >= 0);
    return out.some((f) => !f.locked) ? out : all.filter((f) => !f.locked);
  }

  /**
   * Temel bedene soy izlerini (atalardan, eskiden yeniye) ve bu aşamanın
   * bedenini uygular. Yeni nesne döner, girdiyi değiştirmez.
   */
  function apply(spec, stage, forms) {
    forms = forms || {};
    let out = Object.assign({}, spec, { parts: Object.assign({}, spec.parts), extras: (spec.extras || []).slice() });
    const addTrait = (t) => {
      if (!t) return;
      if (t.parts) Object.assign(out.parts, t.parts);
      (t.extras || []).forEach((x) => { if (out.extras.indexOf(x) < 0) out.extras.push(x); });
    };
    for (let st = 0; st < stage; st++) { const f = get(st, forms[st]); if (f) addTrait(f.trait); }
    const cur = get(stage, forms[stage]);
    if (cur) {
      const b = cur.body || {};
      out.scale = spec.scale * (b.scale || 1);
      Object.assign(out.parts, b.parts || {});
      if (b.body != null) out.body = b.body;
      if (b.accent != null) out.accent = b.accent;
      (b.extras || []).forEach((x) => { if (out.extras.indexOf(x) < 0) out.extras.push(x); });
    }
    // soy izi dikenler kara bedeninde de kalsın (kara biçimleri parts.spikes'ı ezmesin)
    for (let st = 0; st < stage; st++) { const f = get(st, forms[st]); if (f && f.trait && f.trait.parts) Object.assign(out.parts, f.trait.parts); }
    return out;
  }

  return { list, get, any, lineage, options, apply };
})();
