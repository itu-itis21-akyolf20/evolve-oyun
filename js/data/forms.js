/* ============================================================
   data/forms.js — evrimde seçilen BEDEN biçimleri

   Evrim ekranında gen ile birlikte bir beden seçilir; o aşama (ve
   sonraki nesiller, yeniden seçilene dek) bu bedenle oynanır.
   body: aşamanın temel bedenine uygulanan değişiklikler
         (scale çarpanı, parts alanları, renkler, eklenen extras)
   mods: kalıcı stat farkları (progression.recompute ekler)
   Hücre aşaması (0) oyun başında varsayılan bedenle başlar.
   ============================================================ */
window.EV = window.EV || {};

EV.FORMS = (function () {
  'use strict';

  const BY_STAGE = {
    1: [
      { id: 'lizard', name: 'Kertenkele', icon: '🦎', desc: 'Dengeli ve çevik. Uzun kuyruk, dört bacak.',
        mods: { speed: 0.06, atkSpd: 0.05 },
        body: { scale: 1.0, parts: { legs: 4, tail: 'long' } } },
      { id: 'croc', name: 'Timsah', icon: '🐊', desc: 'Ağır zırhlı, dayanıklı; yavaş ama çok sert.',
        mods: { maxHp: 0.2, armor: 0.08, dmg: 0.06, speed: -0.08 },
        body: { scale: 1.12, parts: { legs: 4, tail: 'long', fangs: true }, body: 0x3f5f36, accent: 0x243a1c, extras: ['scutes'] } },
      { id: 'raptor', name: 'Raptor', icon: '🦖', desc: 'İki ayaklı avcı: hızlı saldırı, yüksek kritik; daha kırılgan.',
        mods: { atkSpd: 0.15, crit: 0.06, speed: 0.08, maxHp: -0.08 },
        body: { scale: 0.95, parts: { legs: 2, tail: 'long', fangs: true, spikes: true }, extras: ['claws'] } },
    ],
    2: [
      { id: 'wolf', name: 'Kurt', icon: '🐺', desc: 'Sürü avcısı: hızlı, dengeli, kritik vuruşlar.',
        mods: { speed: 0.07, crit: 0.05, atkSpd: 0.05 },
        body: { scale: 1.0, parts: { legs: 4, tail: 'bushy', fur: true, ears: true, fangs: true }, body: 0x8a8a92, accent: 0x55555e } },
      { id: 'bear', name: 'Ayı', icon: '🐻', desc: 'Dev ve dayanıklı: çok can, zırh ve güç; yavaş.',
        mods: { maxHp: 0.25, armor: 0.07, dmg: 0.08, speed: -0.1 },
        body: { scale: 1.2, parts: { legs: 4, tail: 'short', fur: true, ears: true, fangs: true }, body: 0x5a3e2a, accent: 0x33241a } },
      { id: 'cat', name: 'Büyük Kedi', icon: '🐆', desc: 'Pusu ustası: çok hızlı saldırı ve kritik hasar; ince yapılı.',
        mods: { atkSpd: 0.14, critDmg: 0.3, speed: 0.1, maxHp: -0.06 },
        body: { scale: 0.95, parts: { legs: 4, tail: 'long', fur: true, ears: true, fangs: true }, body: 0xd9a24e, accent: 0x7a5228, extras: ['claws'] } },
    ],
  };

  function list(stage) { return BY_STAGE[stage] || []; }
  function get(stage, id) { return list(stage).find((f) => f.id === id) || null; }

  /** Temel bedene biçimi uygular (yeni nesne döner, girdiyi değiştirmez). */
  function apply(spec, form) {
    if (!form) return spec;
    const b = form.body || {};
    const out = Object.assign({}, spec, {
      scale: spec.scale * (b.scale || 1),
      parts: Object.assign({}, spec.parts, b.parts || {}),
      extras: (spec.extras || []).concat(b.extras || []),
    });
    if (b.body != null) out.body = b.body;
    if (b.accent != null) out.accent = b.accent;
    return out;
  }

  return { list, get, apply };
})();
