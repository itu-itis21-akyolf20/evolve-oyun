/* ============================================================
   cards.js — modal ekranlar: seviye kartları, evrim (gen seçimi),
   yapı paneli (K). Klavye: 1-2-3 kart, 4 yeniden çek.
   ============================================================ */
window.EV = window.EV || {};

EV.Cards = (function () {
  'use strict';

  const U = EV.U;
  const DATA = EV.DATA;
  const CFG = EV.CFG;
  const $ = (id) => document.getElementById(id);

  let open = null;          // 'level' | 'evolve' | 'build'
  let current = null;       // { cards, onPick, allowReroll, game }

  const TYPE = {
    skill:     { label: 'YENİ YETENEK',  color: '#5aa9e6' },
    upSkill:   { label: 'GELİŞTİR',      color: '#7dff8a' },
    ult:       { label: 'ULTİMATE · ÖFKE', color: '#ff8a2a' },
    upUlt:     { label: 'ULTİMATE +',    color: '#ffb35a' },
    passive:   { label: 'PASİF',         color: '#c27bff' },
    upPassive: { label: 'PASİF +',       color: '#d9a8ff' },
    fusion:    { label: 'EVRİM FÜZYONU', color: '#ffd23d' },
    heal:      { label: 'İYİLEŞME',      color: '#7df07d' },
    energy:    { label: 'ENERJİ + ÖFKE', color: '#8fd0ff' },
  };

  function pips(cur, max, isNew) {
    let h = '';
    for (let r = 1; r <= max; r++) h += '<i class="' + (r < cur ? 'on' : r === cur ? (isNew ? 'new' : 'on') : '') + '"></i>';
    return '<div class="cpips">' + h + '</div>';
  }

  /** Bu yeteneğin bu aşamadaki füzyon ipucu (varsa). */
  function fusionHint(game, def) {
    const f = DATA.allFusions().find((x) => x.from === def.id && x.stage === game.stageIndex);
    if (!f) return '';
    let need, have;
    if (f.needGene) {
      const g = DATA.gene(f.needGene);
      need = (g ? g.name : f.needGene) + ' geni';
      have = game.legacy.genes.indexOf(f.needGene) >= 0;
    } else {
      const p = DATA.passive(f.needPassive);
      need = (p ? p.name : f.needPassive) + ' pasifi';
      have = game.build.passives.some((x) => x.id === f.needPassive);
    }
    return '<div class="cmeta">🧬 Füzyon: 5. rütbe + ' + need + (have ? ' <b style="color:#7dff8a">✔ sende</b>' : '') + '</div>';
  }

  function skillMeta(def, rank) {
    const p = DATA.params(def, rank);
    const bits = [];
    if (def.slot === 'ult') bits.push('Öfke 100');
    else bits.push('Enerji ' + p.cost);
    bits.push('Bekleme ' + p.cd + 'sn');
    if (['zone', 'leap', 'barrage', 'totem', 'blink', 'mark'].indexOf(def.kind) >= 0 && def.base.castRange) bits.push('basılı tut → nişan → bırak');
    if (def.kind === 'chain') bits.push('hedef gerekir');
    if (def.kind === 'beam') bits.push('nişanını izler');
    const HOW = {
      grab: def.base.roll ? 'yakala → yuvarlan → fırlat' : 'bas: yakala · basılı tut: taşı · bırak: fırlat',
      engulf: 'bas: yut · tekrar bas: tükür',
      tether: 'yakın kal: uzaklaşırsan bağ kopar',
      mark: 'tekrar bas: işaretleri patlat',
      parry: 'darbe gelmeden hemen önce bas',
      stealth: 'gizlen → ilk saldırın pusu',
      burrow: 'bas: dal · tekrar bas / saldır: fırla',
      stance: def.slot === 'ult' ? 'temel saldırın dönüşür' : 'aç/kapa · temel saldırını değiştirir',
      rush: 'basılı tut: hızlan · nişanla yönlendir · bırak',
      charge: 'basılı tut: güçlen · bırak',
      command: 'yardımcıların hedefe saldırır',
    };
    if (HOW[def.kind]) bits.push('<b>' + HOW[def.kind] + '</b>');
    return '<div class="cmeta">' + bits.join(' · ') + '</div>';
  }

  function cardHtml(game, c, i) {
    const t = TYPE[c.type];
    const d = c.def;
    let body = '';
    switch (c.type) {
      case 'skill': case 'ult':
        body = '<div class="cicon">' + d.icon + '</div><div class="cname">' + d.name + '</div>' + pips(1, 5, true) +
          '<div class="cdesc">' + DATA.describe(d, 1) + '</div><div class="cdesc" style="opacity:.75">' + (d.flavor || '') + '</div>' +
          '<div class="ctags">' + DATA.tagChips(d.tags) + '</div>' + skillMeta(d, 1) + fusionHint(game, d);
        break;
      case 'upSkill': case 'upUlt':
        body = '<div class="cicon">' + d.icon + '</div><div class="cname">' + d.name + '</div>' + pips(c.rank, 5, true) +
          '<div class="crank">Rütbe ' + c.rank + ': ' + DATA.rankText(d, c.rank) + '</div>' +
          '<div class="cdesc">' + DATA.describe(d, c.rank) + '</div>' +
          '<div class="ctags">' + DATA.tagChips(d.tags) + '</div>' + skillMeta(d, c.rank) +
          (c.rank === 5 ? fusionHint(game, d) : '');
        break;
      case 'passive': case 'upPassive': {
        const r = c.type === 'passive' ? 1 : c.rank;
        body = '<div class="cicon">' + d.icon + '</div><div class="cname">' + d.name + '</div>' + pips(r, d.max, true) +
          '<div class="cdesc">' + DATA.modsText(DATA.passiveMods(d, r)) + '</div>' +
          (d.bonus ? '<div class="cmeta">' + d.bonus.map((b) => 'Rütbe ' + b.at + ': ' + DATA.modsText(b.mods)).join(' · ') + '</div>' : '') +
          '<div class="ctags">' + DATA.tagChips(d.tags) + '</div>';
        break;
      }
      case 'fusion': {
        const from = DATA.skill(d.from);
        body = '<div class="cicon">' + d.icon + '</div><div class="cname">' + d.name + '</div>' +
          '<div class="crank">' + (from ? from.name : '') + ' evrimleşir</div>' +
          '<div class="cdesc">' + DATA.describe(d, 5) + '</div><div class="cdesc" style="opacity:.8">' + (d.flavor || '') + '</div>' +
          '<div class="ctags">' + DATA.tagChips(d.tags) + '</div>' + skillMeta(d, 5);
        break;
      }
      case 'heal':
        body = '<div class="cicon">❤️</div><div class="cname">Yenilenme</div><div class="cdesc">Maks. canın %40\'ı kadar iyileş.</div>';
        break;
      case 'energy':
        body = '<div class="cicon">⚡</div><div class="cname">Adrenalin</div><div class="cdesc">Enerjin dolar, +35 öfke.</div>';
        break;
      default: break;
    }
    return '<div class="card' + (c.type === 'fusion' ? ' fusion' : '') + '" data-i="' + i + '" style="--c:' + t.color + '">' +
      '<span class="ck">' + (i + 1) + '</span><div class="ctype">' + t.label + '</div>' + body + '</div>';
  }

  /* =========================================================
     Seviye kartları
     ========================================================= */
  function renderLevel() {
    const { game, cards, allowReroll } = current;
    $('cardRow').innerHTML = cards.map((c, i) => cardHtml(game, c, i)).join('');
    $('cardRow').querySelectorAll('.card').forEach((n) => {
      n.onclick = () => { if (!clickLocked()) pick(+n.dataset.i); };
    });
    const rb = $('rerollBtn');
    rb.hidden = !allowReroll;
    $('rerollN').textContent = game.build.rerolls;
    rb.disabled = game.build.rerolls <= 0;
  }

  /* Saldırırken sol tık basılıyken kart ekranı açılınca kart yanlışlıkla seçiliyordu:
     açıldıktan sonra kısa bir süre fareyle seçim kapalı (klavye 1-2-3 serbest). */
  const CLICK_LOCK_MS = 800;
  let lockUntil = 0;
  function clickLocked() { return performance.now() < lockUntil; }
  function lockClicks(panelId) {
    lockUntil = performance.now() + CLICK_LOCK_MS;
    const el = $(panelId);
    el.classList.add('clicklock');
    setTimeout(() => el.classList.remove('clicklock'), CLICK_LOCK_MS);
  }

  function openLevel(game, opts) {
    current = { game, cards: opts.cards, onPick: opts.onPick, allowReroll: opts.allowReroll !== false, onlyType: opts.onlyType };
    $('cardTitle').textContent = opts.title;
    $('cardSub').innerHTML = opts.sub || 'Bir kart seç — <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>';
    $('cardPanel').hidden = false;
    open = 'level';
    renderLevel();
    lockClicks('cardPanel');
    U.audio.levelUp();
  }

  function reroll() {
    if (open !== 'level' || !current.allowReroll || current.game.build.rerolls <= 0) return;
    current.game.build.rerolls--;
    current.cards = EV.Build.roll(current.game, 3, current.onlyType);
    U.audio.card();
    renderLevel();
  }

  function pick(i) {
    if (open !== 'level' || !current.cards[i]) return;
    const c = current.cards[i];
    const cb = current.onPick;
    $('cardPanel').hidden = true;
    open = null;
    current = null;
    U.audio.card();
    cb(c);
  }

  /* =========================================================
     Evrim ekranı
     ========================================================= */
  function openEvolve(game, offer, title, body, onChoose) {
    $('evTitle').textContent = title;
    $('evBody').innerHTML = body;

    // beden seçimi (varsa): tıklayınca seçili olur; gen seçimi evrimi başlatır
    const forms = offer.forms || [];
    const openForms = forms.filter((f) => !f.locked);
    let formSel = openForms.length ? (openForms.find((f) => f.id === offer.formNow) || openForms[0]).id : null;
    $('evFormSec').hidden = !forms.length;
    // soy yolu: 🦠 Kamçılı → 🦖 Raptor → ?
    const path = (offer.lineage || []).map((x) => '<span class="ln">' + x.form.icon + ' ' + x.form.name + '</span>');
    $('evForms').innerHTML = (path.length ? '<div class="lineage">Soyun: ' + path.join(' <i>→</i> ') + ' <i>→</i> <b>?</b></div>' : '') +
      forms.map((f) => {
        const trait = f.traitName ? '<div class="ft">🧬 Torunlarına: ' + f.traitName + '</div>' : '';
        return '<div class="form' + (f.locked ? ' locked' : '') + '" data-f="' + f.id + '"><div class="fi">' + f.icon + '</div>' +
          '<div class="fn">' + f.name + (f.locked ? ' 🔒' : '') + '</div><div class="fd">' + f.desc + '</div>' +
          (f.locked ? '' : '<div class="fm">' + DATA.modsText(f.mods) + '</div>' + trait) + '</div>';
      }).join('');
    const markForm = () => $('evForms').querySelectorAll('.form').forEach((n) => n.classList.toggle('sel', n.dataset.f === formSel));
    $('evForms').querySelectorAll('.form:not(.locked)').forEach((n) => { n.onclick = () => { formSel = n.dataset.f; markForm(); U.audio.card(); }; });
    markForm();
    const genes = offer.genes;
    $('evGenes').innerHTML = genes.map((g, i) => {
      const fus = DATA.allFusions().filter((f) => f.needGene === g.id).map((f) => f.name);
      return '<div class="gene" data-i="' + i + '"><div class="gi">' + g.icon + '</div><div class="gn">' + (i + 1) + '. ' + g.name + '</div>' +
        '<div class="gd">' + g.desc + '</div><div class="ctags">' + DATA.tagChips(g.tags) + '</div>' +
        (fus.length ? '<div class="gf">🧬 Sonra açar: ' + fus.join(', ') + '</div>' : '') + '</div>';
    }).join('') || '<div class="gene" data-i="0"><div class="gi">🧬</div><div class="gn">Devam et</div>' +
      '<div class="gd">Alınacak gen kalmadı — evrim devam ediyor.</div></div>';

    const carry = [];
    offer.parts.forEach((p) => carry.push(p.icon + ' <b>' + p.name + '</b> · ' + DATA.modsText(p.mods)));
    if (offer.echo) {
      const d = DATA.skill(offer.echo.id);
      carry.push('🔁 Kalıtsal yankı: <b>' + d.name + '</b> (en çok kullandığın — kendiliğinden atar)');
    }
    if (!carry.length) carry.push('Bu aşamada belirgin bir iz bırakmadın');
    $('evCarry').innerHTML = carry.map((c) => '<div class="carry">' + c + '</div>').join('');

    $('evolvePanel').hidden = false;
    open = 'evolve';
    const done = (i) => {
      if (open !== 'evolve') return;
      $('evolvePanel').hidden = true;
      open = null;
      current = null;
      onChoose(genes[i] ? genes[i].id : null, formSel);
    };
    current = { evolveDone: done, count: Math.max(1, genes.length) };
    $('evGenes').querySelectorAll('.gene').forEach((n) => { n.onclick = () => { if (!clickLocked()) done(+n.dataset.i); }; });
    lockClicks('evolvePanel');
  }

  /* =========================================================
     Yapı paneli (K)
     ========================================================= */
  function item(icon, title, text, muted) {
    return '<div class="bitem' + (muted ? ' muted' : '') + '">' + icon + ' <b>' + title + '</b><br>' + text + '</div>';
  }

  function renderBuild(game) {
    const b = game.build, L = game.legacy;
    let h = '';
    const lin = EV.FORMS.lineage(L.forms);
    if (lin.length) {
      h += '<h3>SOY AĞACI</h3><div class="brow">';
      h += lin.map((x) => item(x.form.icon, x.form.name + (x.stage === game.stageIndex ? ' (şimdi)' : ' (ata · yarı etki)'),
        DATA.modsText(x.form.mods) + (x.form.traitName && x.stage < game.stageIndex ? ' · iz: ' + x.form.traitName : ''))).join('');
      h += '</div>';
    }
    h += '<h3>AKTİF YETENEKLER (Q E F)</h3><div class="brow">';
    h += b.skills.map((s) => { const d = DATA.skill(s.id); return item(d.icon, d.name + ' · R' + s.rank + (s.fused ? ' ✦' : ''), DATA.describe(d, s.rank)); }).join('') || item('·', 'Boş', 'Seviye atladıkça kart seç');
    h += '</div><h3>ULTİMATE (R)</h3><div class="brow">';
    h += b.ult ? (() => { const d = DATA.skill(b.ult.id); return item(d.icon, d.name + ' · R' + b.ult.rank, DATA.describe(d, b.ult.rank)); })() : item('🔒', 'Yok', '4. seviyeden sonra kartlarda çıkar');
    h += '</div><h3>PASİFLER</h3><div class="brow">';
    h += b.passives.map((p) => { const d = DATA.passive(p.id); return item(d.icon, d.name + ' · R' + p.rank, DATA.modsText(DATA.passiveMods(d, p.rank))); }).join('') || item('·', 'Yok', '');
    h += '</div><h3>GENLER (kalıcı)</h3><div class="brow">';
    h += L.genes.map((id) => { const g = DATA.gene(id); return item(g.icon, g.name, g.desc); }).join('') || item('·', 'Henüz yok', 'Evrimleşince seçilir');
    h += '</div><h3>VÜCUT PARÇALARI · YANKILAR</h3><div class="brow">';
    h += L.parts.map((t) => { const p = DATA.partFor(t); return item(p.icon, p.name, DATA.modsText(p.mods)); }).join('');
    h += L.echoes.map((e) => { const d = DATA.skill(e.id); return item('🔁', 'Yankı: ' + d.name, 'Kendiliğinden, %60 güçle'); }).join('');
    if (!L.parts.length && !L.echoes.length) h += item('·', 'Henüz yok', 'Evrimde bedenine geçer');
    h += '</div><h3>BU AŞAMANIN FÜZYONLARI</h3><div class="brow">';
    h += DATA.allFusions().filter((f) => f.stage === game.stageIndex).map((f) => {
      const from = DATA.skill(f.from);
      const need = f.needGene ? (DATA.gene(f.needGene).name + ' geni') : (DATA.passive(f.needPassive).name + ' pasifi');
      const ok = EV.Build.fusionEligible(game, f);
      return item(f.icon, f.name, from.name + ' R5 + ' + need + (ok ? ' — <b>HAZIR</b>' : ''), !ok);
    }).join('');
    h += '</div><h3>KOMBOLAR (durum + durum)</h3><div class="brow">';
    h += CFG.REACTIONS.map((R) => {
      const seen = !!L.combos[R.id];
      return item(seen ? '✨' : '❔', seen ? R.name : '???', CFG.STATUS[R.a].name + ' + ' + CFG.STATUS[R.b].name + (seen ? ' — ' + R.desc : ''), !seen);
    }).join('');
    h += '</div>';
    $('buildBody').innerHTML = h;
  }

  function toggleBuild(game) {
    if (open === 'build') { $('buildPanel').hidden = true; open = null; return false; }
    if (open) return false;
    renderBuild(game);
    $('buildPanel').hidden = false;
    open = 'build';
    return true;
  }

  /* ---------------- klavye ---------------- */
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;           // basılı tutulan tuş bir sonraki kartı körlemesine seçmesin
    if (open === 'level') {
      if (e.code === 'Digit1' || e.code === 'Numpad1') pick(0);
      if (e.code === 'Digit2' || e.code === 'Numpad2') pick(1);
      if (e.code === 'Digit3' || e.code === 'Numpad3') pick(2);
      if (e.code === 'Digit4' || e.code === 'Numpad4') reroll();
    } else if (open === 'evolve' && current) {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
      if (n != null && n < current.count) current.evolveDone(n);
    }
  });
  $('rerollBtn').onclick = () => { if (!clickLocked()) reroll(); };

  return {
    openLevel, openEvolve, toggleBuild, renderBuild,
    isOpen: () => !!open,
    get which() { return open; },
  };
})();
