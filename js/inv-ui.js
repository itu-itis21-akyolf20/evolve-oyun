/* ============================================================
   inv-ui.js — Tab: BEDEN / MUTASYONLAR ekranı

   Sol: beden şeması (aşamaya göre hücre / sürüngen / memeli silueti)
        üstünde 6 bölge: Baş · Çene · Sırt · Deri · Pençe · Kuyruk.
        Bölgeye dokun → takılı mutasyonun ayrıntısı + depo o bölgeye süzülür.
        Altında soy uyumları ve "Mutasyon üret" (bölge seç, rastgele parça).
   Orta: GEN DEPOSU — emilen parçalar (bölge sekmeleriyle süzülür).
   Sağ: ayrıntı — Tak / Çıkar · 🧬 Evrimleştir (+0…+9, parça büyür) ·
        Nadirlik yükselt · Emilim (Gen Özü'ne çevir).
   Riskli evrimleştirme (+6 ve üstü, başarısızlıkta geriler) iki dokunuşla onaylanır.
   Fare ve dokunmatik aynı (click); yatay telefonda (~780×360) sütunlar ayrı kayar.
   ============================================================ */
window.EV = window.EV || {};

EV.Inv = (function () {
  'use strict';

  const U = EV.U;
  const R = EV.CFG.RARITY;
  const IC = EV.CFG.ITEMS;
  const I = () => EV.Items;
  const $ = (id) => document.getElementById(id);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  /* Türkçe yönelme eki: +5'e, +6'ya, +7'ye, +9'a */
  const DAT = ["'a", "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"];
  const toPlus = (n) => '+' + n + DAT[n % 10];

  let game = null;
  let sel = null;       // { where: 'bag'|'equip', idx }
  let region = null;    // seçili beden bölgesi (depo süzgeci); null = tümü
  let isOpen = false;
  let armed = null;     // riskli evrimleştirme için onay bekleyen mutasyonun uid'i
  let flash = null;     // { uid, cls, html } son evrimleştirme sonucu
  let msgTimer = null;

  /* ---------------------------------------------------------
     Beden şemaları (viewBox 240×180, sağa bakar). Siluet (120,96)
     etrafında sc ile küçültülür; a: bölgenin siluetteki noktası
     (küçültülmeden önceki koordinat), c: bölge düğmesinin yeri
     (son koordinat; yoksa noktanın üstünde).
     --------------------------------------------------------- */
  const BODY = {
    cell: {
      sc: 0.9,
      svg: '<path class="flag" d="M72 96 C58 86 50 104 38 96 S20 82 10 90"/>' +
        '<ellipse cx="120" cy="96" rx="52" ry="40"/>' +
        '<ellipse class="in" cx="112" cy="100" rx="17" ry="14"/>' +
        '<circle class="eye" cx="150" cy="80" r="5"/><circle class="eye" cx="140" cy="76" r="4"/>' +
        '<circle class="in" cx="170" cy="96" r="6"/>',
      at: {
        head: { a: [146, 62], c: [168, 32] }, jaw: { a: [172, 96], c: [210, 96] }, back: { a: [110, 57], c: [94, 30] },
        hide: { a: [120, 110] }, claws: { a: [132, 134], c: [150, 152] }, tail: { a: [14, 90], c: [32, 50] },
      },
    },
    reptile: {
      sc: 0.85,
      svg: '<path class="lim" d="M62 98 Q34 104 6 122 Q34 98 60 106 Z"/>' +
        '<path class="lim" d="M146 110 L160 128 L170 128 L154 108 Z"/><path class="lim" d="M136 112 L128 132 L138 132 L146 112 Z"/>' +
        '<path class="lim" d="M80 110 L66 130 L76 130 L90 110 Z"/><path class="lim" d="M92 112 L100 132 L110 132 L100 110 Z"/>' +
        '<ellipse cx="112" cy="100" rx="58" ry="19"/>' +
        '<ellipse cx="180" cy="94" rx="22" ry="12"/><path d="M190 88 L214 96 L212 102 L190 104 Z"/>' +
        '<circle class="eye" cx="188" cy="90" r="3.5"/>',
      at: {
        head: { a: [180, 83], c: [168, 36] }, jaw: { a: [210, 100], c: [212, 136] }, back: { a: [112, 82], c: [100, 38] },
        hide: { a: [112, 102] }, claws: { a: [164, 129], c: [140, 152] }, tail: { a: [14, 118], c: [32, 70] },
      },
    },
    mammal: {
      sc: 0.8,
      svg: '<path class="lim" d="M68 84 Q38 74 28 50 Q46 70 68 94 Z"/>' +
        '<rect class="lim" x="80" y="106" width="11" height="38" rx="4"/><rect class="lim" x="96" y="108" width="11" height="36" rx="4"/>' +
        '<rect class="lim" x="136" y="106" width="11" height="38" rx="4"/><rect class="lim" x="151" y="104" width="11" height="40" rx="4"/>' +
        '<ellipse cx="118" cy="92" rx="54" ry="27"/>' +
        '<path d="M150 80 L168 56 L184 62 L170 92 Z"/><ellipse cx="178" cy="60" rx="17" ry="14"/>' +
        '<path d="M188 54 L208 62 L206 72 L186 70 Z"/><path d="M168 49 L172 34 L180 47 Z"/>' +
        '<circle class="eye" cx="184" cy="57" r="3.5"/>',
      at: {
        head: { a: [176, 47], c: [180, 30] }, jaw: { a: [204, 70], c: [212, 96] }, back: { a: [116, 65], c: [104, 30] },
        hide: { a: [120, 96] }, claws: { a: [157, 144], c: [170, 152] }, tail: { a: [32, 54], c: [32, 34] },
      },
    },
  };
  const bodyKey = (g) => (g.stageIndex <= 0 ? 'cell' : g.stageIndex === 1 ? 'reptile' : 'mammal');
  const cssHex = (n) => '#' + (Number(n) >>> 0 & 0xffffff).toString(16).padStart(6, '0');

  /** Bildirim: genel toast (panelin arkasında kalır) + panelin üstünde görünen kopya. */
  function say(html, color, ms) {
    EV.UI.toast(html, color, ms);
    const m = $('invMsg');
    if (!m) return;
    m.innerHTML = html;
    m.style.color = color || '#ffe08a';
    m.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => m.classList.remove('show'), ms || 1600);
  }

  function itemAt(s) {
    if (!s || !game) return null;
    if (s.where === 'equip') return game.inv.equip[s.idx] || null;
    const arr = game.inv[s.where];
    return Array.isArray(arr) ? arr[s.idx] || null : null;
  }

  function tipOf(it) {
    const head = it.name + ' (' + R[it.rarity].name + ' · ' + I().SLOT[it.slot].name + (it.plus ? ' · +' + it.plus : '') + ')';
    return esc([head].concat(I().describe(it)).join('\n'));
  }

  /** Mutasyon hücresi (depo ya da bölge). */
  function cell(it, where, idx, emptyIcon) {
    const on = sel && sel.where === where && String(sel.idx) === String(idx);
    const data = ' data-w="' + where + '" data-i="' + idx + '"';
    if (!it) return '<div class="icell empty' + (on ? ' sel' : '') + '"' + data + '>' + (emptyIcon || '') + '</div>';
    const p = it.plus | 0;
    const set = it.set && I().SET[it.set];
    const cls = 'icell r' + it.rarity + (on ? ' sel' : '') + (p >= 7 ? ' hi' : '') + (p >= 9 ? ' hi9' : '');
    return '<div class="' + cls + '" style="--c:' + R[it.rarity].color + '"' + data + ' title="' + tipOf(it) + '">' +
      I().partInfo(it).icon +
      (it.unique ? '<b class="star">★</b>' : '') +
      (p > 0 ? '<b class="pl">+' + p + '</b>' : '') +
      (set ? '<i class="st" style="--sc:' + set.color + '"></i>' : '') +
      '<i class="il">' + (it.ilvl + 1) + '</i></div>';
  }

  /* ---------------- beden şeması ---------------- */
  function renderBody() {
    const B = BODY[bodyKey(game)];
    const P = game.player;
    const fill = P && P.bodySpec ? cssHex(P.bodySpec.body) : '#8d5c33';
    const inv = game.inv;
    const sc = B.sc;
    const tx = (v, o) => +(o + (v - o) * sc).toFixed(1);
    let lines = '';
    let cells = '';
    I().SLOTS.forEach((s) => {
      const pos = B.at[s.id];
      const ax = tx(pos.a[0], 120), ay = tx(pos.a[1], 96);
      const cx = pos.c ? pos.c[0] : ax, cy = pos.c ? pos.c[1] : ay;
      const it = inv.equip[s.id];
      const on = region === s.id;
      const col = it ? R[it.rarity].color : '#f2e2c8';
      if (pos.c) lines += '<line x1="' + ax + '" y1="' + ay + '" x2="' + cx + '" y2="' + cy + '" stroke="' + col + '"' + (on ? ' class="on"' : '') + '/>';
      lines += '<circle class="dot' + (on ? ' on' : '') + '" cx="' + ax + '" cy="' + ay + '" r="' + (it ? 4.5 : 3.5) + '" fill="' + col + '"/>';
      cells += '<div class="rgn' + (on ? ' on' : '') + (it ? ' full' : '') + '" data-r="' + s.id + '" style="left:' + (cx / 2.4).toFixed(2) + '%;top:' + (cy / 1.8).toFixed(2) + '%">' +
        cell(it, 'equip', s.id, s.icon) + '<span>' + s.name + '</span></div>';
    });
    $('invEquip').innerHTML =
      '<svg viewBox="0 0 240 180" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<g class="sil" style="--bf:' + fill + '" transform="translate(120 96) scale(' + sc + ') translate(-120 -96)">' + B.svg + '</g>' +
      '<g class="lines">' + lines + '</g></svg>' + cells;
  }

  function renderSets() {
    const chips = I().SETS.map((s) => {
      const n = I().setCount(game, s.id);
      if (!n) return '';
      return '<span class="setchip' + (n >= 2 ? ' on' : '') + '" style="--sc:' + s.color + '" title="' +
        esc(s.name + ' uyumu — (2) ' + EV.DATA.modsText(s.b2.mods) + ' · (4) ' + s.b4.desc) + '">' + s.icon + ' ' + n + '/4</span>';
    }).join('');
    $('invSets').innerHTML = chips;
  }

  function renderDepot() {
    const inv = game.inv;
    const counts = {};
    let total = 0;
    inv.bag.forEach((it) => { if (it) { counts[it.slot] = (counts[it.slot] || 0) + 1; total++; } });
    $('invCount').textContent = total + '/' + inv.bag.length;
    $('invTabs').innerHTML = '<button class="itab' + (!region ? ' on' : '') + '" data-f="">Tümü <b>' + total + '</b></button>' +
      I().SLOTS.map((s) => '<button class="itab' + (region === s.id ? ' on' : '') + '" data-f="' + s.id + '" title="' + s.name + ' · ' + s.hint + '">' +
        s.icon + '<b>' + (counts[s.id] || 0) + '</b></button>').join('');
    const cells = [];
    inv.bag.forEach((it, i) => { if (it && (!region || it.slot === region)) cells.push(cell(it, 'bag', i)); });
    $('invBag').innerHTML = cells.length ? cells.join('') :
      '<div class="iempty">' + (region ? I().SLOT[region].name + ' parçası yok. Avla ya da üret.' : 'Depo boş. Avladığın yaratıkların parçaları buraya emilir.') + '</div>';
  }

  function render() {
    if (!game) return;
    const inv = game.inv;
    $('invEss').textContent = U.fmt(inv.essence);
    renderBody();
    renderSets();
    renderDepot();
    const poor = inv.essence < IC.craftCost;       // depo doluysa tıklanınca "Depo dolu" der
    $('invCraft').innerHTML = I().SLOTS.map((s) =>
      '<button class="craftbtn" data-s="' + s.id + '"' + (poor ? ' disabled' : '') + ' title="' + s.name + ': ' + s.hint + '">' + s.icon + ' ' + s.name + '</button>').join('');
    $('invCraftCost').textContent = IC.craftCost;

    document.querySelectorAll('#invPanel .icell').forEach((n) => {
      n.onclick = (ev) => {
        ev.stopPropagation();
        const w = n.dataset.w;
        if (w === 'equip') { pickRegion(n.dataset.i); return; }
        sel = { where: w, idx: +n.dataset.i };
        armed = null;
        render();
      };
    });
    document.querySelectorAll('#invEquip .rgn').forEach((n) => { n.onclick = () => pickRegion(n.dataset.r); });
    document.querySelectorAll('#invTabs .itab').forEach((b) => { b.onclick = () => { region = b.dataset.f || null; armed = null; render(); }; });
    document.querySelectorAll('#invCraft .craftbtn').forEach((b) => { b.onclick = () => craft(b.dataset.s); });
    renderDetail();
  }

  /** Bölge seç: takılıysa onu göster; depo o bölgeye süzülür. Aynı bölgeye ikinci dokunuş süzgeci kaldırmaz. */
  function pickRegion(id) {
    if (!I().SLOT[id]) return;
    region = id;
    sel = game.inv.equip[id] ? { where: 'equip', idx: id } : null;
    armed = null;
    render();
  }

  function craft(slot) {
    const it = I().craft(game, slot);
    if (it) {
      say('Üretildi: ' + '<span style="color:' + R[it.rarity].color + '">' + R[it.rarity].name + ' — ' + esc(it.name) + '</span>', '#fff', 2200);
      sel = { where: 'bag', idx: game.inv.bag.indexOf(it) };
      region = it.slot;
      armed = null;
    } else say(game.inv.bag.indexOf(null) < 0 ? 'Gen deposu dolu' : 'Gen Özü yetmiyor', '#ff8a8a', 1200);
    render();
  }

  /* ---------------- ayrıntı paneli ---------------- */
  function hintHtml() {
    if (region) {
      const s = I().SLOT[region];
      return '<div class="hint rgnhint"><b>' + s.icon + ' ' + s.name + '</b> — boş.<br>' + s.hint +
        '<br><br>Depodan bir ' + s.name + ' parçası seç ya da soldan üret.</div>';
    }
    return '<div class="hint">Bedenindeki bir bölgeye ya da depodaki bir parçaya dokun.<br><br>' +
      'Avladığın yaratığın bir parçası kopabilir: üstünden geç, emilsin. Takılı mutasyonlar <b>bedeninde görünür</b>; ' +
      'evrimleştirdikçe büyür, Destansı ve Efsanevi olanlar ışır.<br><br>' +
      'Nadirlik: ' + R.map((r) => '<b style="color:' + r.color + '">' + r.name + '</b>').join(' · ') +
      '<br><br>🧬 <b>Evrimleştir</b> +1…+' + IC.plusMax + ': her kademe tüm değerleri artırır. +' + IC.plusDropFrom +
      ' ve üstünde başarısızlık bir kademe geriletir.<br>☠️ Bosslar daha nadir, adlı parçalar verir.</div>';
  }

  function pips(p) {
    let h = '<div class="ipips" title="Evrim +' + p + ' / +' + IC.plusMax + '">';
    for (let i = 1; i <= IC.plusMax; i++) h += '<i class="' + (i <= p ? 'on' : '') + (i > IC.plusDropFrom ? ' r' : '') + '"></i>';
    return h + '</div>';
  }

  function plusBlock(it) {
    const P = I().plusInfo(it);
    const res = flash && flash.uid === it.uid ? '<div class="pres ' + flash.cls + '">' + flash.html + '</div>' : '';
    if (P.max) return '<div class="plusbox max">' + res + '<div class="pmax">🧬 +' + IC.plusMax + ' — tam evrimleşmiş</div></div>';
    const poor = game.inv.essence < P.cost;
    const pct = Math.round(P.chance * 100);
    const label = '🧬 Evrimleştir +' + P.plus + ' → +' + P.next + ' · %' + pct + ' · ' + U.fmt(P.cost) + ' öz';
    const btn = armed === it.uid
      ? '<button data-a="enhance" class="danger pconfirm">⚠ Onayla: +' + P.next + ' dene · %' + pct + ' · ' + U.fmt(P.cost) + ' öz</button>' +
        '<button data-a="disarm" class="ghost">Vazgeç</button>'
      : '<button data-a="enhance" class="plusbtn' + (P.risk ? ' risky' : '') + '"' + (poor ? ' disabled' : '') + '>' + label + '</button>';
    const risk = P.risk
      ? '<div class="prisk bad">⚠ Başarısızlıkta öz gider ve mutasyon ' + toPlus(P.plus - 1) + ' geriler</div>'
      : '<div class="prisk">Başarısızlıkta yalnızca öz gider' + (P.next >= IC.plusDropFrom ? ' (+' + IC.plusDropFrom + ' sonrası gerileme riski var)' : '') + '</div>';
    const gain = '<div class="pgain">Tüm değerler +' + Math.round(P.bonus * 100) + '% → <b>+' + Math.round(P.nextBonus * 100) + '%</b>' +
      (it.affixes.length ? ' · ' + esc(I().affixText(it, P.next)[0]) : '') + ' · parça büyür</div>';
    return '<div class="plusbox">' + res + btn + risk + gain + '</div>';
  }

  function setBlock(it) {
    const S = it.set && I().SET[it.set];
    if (!S) return '';
    const n = I().setCount(game, S.id);
    const eq = game.inv.equip[it.slot];
    const worn = sel.where === 'equip' ? n : n + (eq && eq.set === S.id ? 0 : 1);
    return '<div class="iset" style="--sc:' + S.color + '"><b>' + S.icon + ' ' + S.name + '</b> uyumu · takılı ' + n + '/4' +
      (sel.where !== 'equip' ? ' <span class="sub">(takarsan ' + worn + ')</span>' : '') +
      '<div class="' + (n >= 2 ? 'on' : 'off') + '">(2) ' + EV.DATA.modsText(S.b2.mods) + '</div>' +
      '<div class="' + (n >= 4 ? 'on' : 'off') + '">(4) ' + S.b4.desc + '</div></div>';
  }

  function renderDetail() {
    const it = itemAt(sel);
    const d = $('invDetail');
    if (!it) { d.innerHTML = hintHtml(); return; }
    const r = R[it.rarity];
    const info = I().partInfo(it);
    const eq = game.inv.equip[it.slot];
    const cmp = sel.where !== 'equip' && eq ? '<div class="cmp">Takılı: <span style="color:' + R[eq.rarity].color + '">' + esc(eq.name) + '</span><br>' +
      I().describe(eq).map(esc).join('<br>') + '</div>' : '';
    const up = I().upgradeCost(it);
    const lines = I().affixText(it).map(esc);
    if (it.unique) lines.push('<span class="uq">★ ' + esc(it.unique.desc) + '</span>');
    d.innerHTML =
      '<div class="iname' + ((it.plus | 0) >= 7 ? ' hi' : '') + '" style="color:' + r.color + '">' + info.icon + ' ' + esc(it.name) + '</div>' +
      '<div class="imeta">' + r.name + ' · ' + I().SLOT[it.slot].icon + ' ' + I().SLOT[it.slot].name + ' · ' + esc(info.kind) + ' · sv ' + (it.ilvl + 1) +
      (info.from ? '<br><span class="from">🧬 ' + esc(info.from) + '</span>' : '') + '</div>' +
      pips(it.plus | 0) +
      '<div class="iaff">' + lines.join('<br>') + '</div>' + setBlock(it) +
      '<div class="iact">' +
      (sel.where === 'equip' ? '<button data-a="unequip">Çıkar (depoya)</button>' : '<button data-a="equip">' + I().SLOT[it.slot].icon + ' Tak: ' + I().SLOT[it.slot].name + '</button>') +
      '</div>' + plusBlock(it) +
      '<div class="iact">' +
      (it.rarity < 4 ? '<button data-a="upgrade"' + (game.inv.essence < up ? ' disabled' : '') + '>Nadirlik yükselt → ' + R[it.rarity + 1].name + ' (' + U.fmt(up) + ' öz)</button>' : '') +
      '<button data-a="salvage" class="danger">Emilim (+' + U.fmt(I().salvageValue(it)) + ' öz)</button>' +
      '</div>' + cmp;
    d.querySelectorAll('button').forEach((b) => { b.onclick = () => act(b.dataset.a); });
  }

  /* ---------------- evrimleştirme ---------------- */
  const RESULT = {
    success: (it, r) => ({ cls: 'ok', html: '✔ EVRİMLEŞTİ! +' + r.to, toast: '🧬 Evrimleşti: ', color: '#ffd23d' }),
    fail: () => ({ cls: 'bad', html: '✖ Tutmadı — öz yandı', toast: '✖ Evrimleşme tutmadı: ', color: '#ff8a8a' }),
    drop: (it, r) => ({ cls: 'bad', html: '✖ Tutmadı — ' + toPlus(r.to) + ' geriledi', toast: '✖ Evrimleşme tutmadı, geriledi: ', color: '#ff6b6b' }),
  };

  function enhance(s) {
    const it = itemAt(s);
    if (!it) return;
    const info = I().plusInfo(it);
    if (info.risk && armed !== it.uid && game.inv.essence >= info.cost) { armed = it.uid; render(); return; }   // 1. dokunuş: onay iste
    armed = null;
    const r = I().enhance(game, s.where, s.idx);
    const f = RESULT[r.result] && RESULT[r.result](it, r);
    if (f) {
      flash = { uid: it.uid, cls: f.cls, html: f.html };
      say(f.toast + '<span style="color:' + R[it.rarity].color + '">' + esc(it.name) + '</span>', f.color, 1800);
    } else if (r.result === 'poor') say('Gen Özü yetmiyor', '#ff8a8a', 1200);
    else if (r.result === 'max') say('Mutasyon zaten +' + IC.plusMax, '#ffd23d', 1200);
    render();
  }

  function act(a) {
    const s = sel;
    let ok = false;
    switch (a) {
      case 'enhance': enhance(s); return;
      case 'disarm': armed = null; render(); return;
      case 'equip': {
        const it = itemAt(s);
        ok = I().equipFrom(game, s.where, s.idx);
        if (ok) { sel = { where: 'equip', idx: it.slot }; region = it.slot; say('🧬 Takıldı: <span style="color:' + R[it.rarity].color + '">' + esc(it.name) + '</span>', '#fff', 1200); }
        break;
      }
      case 'unequip': ok = I().unequip(game, s.idx); sel = null; if (!ok) say('Gen deposu dolu', '#ff8a8a', 1000); break;
      case 'upgrade': ok = I().upgrade(game, s.where, s.idx); break;
      case 'salvage': { const v = I().salvage(game, s.where, s.idx); if (v) say('Emilim: +' + v + ' Gen Özü', '#9de89d', 1000); sel = null; break; }
      default: break;
    }
    armed = null;
    U.audio.card();
    render();
  }

  function open(g) {
    game = g;
    sel = null;
    region = null;
    armed = null;
    flash = null;
    isOpen = true;
    $('invPanel').hidden = false;
    const x = $('invX');
    if (x) x.onclick = () => { close(); if (EV.Game && EV.Game.resume) EV.Game.resume(); };
    render();
  }

  function close() {
    isOpen = false;
    armed = null;
    clearTimeout(msgTimer);
    if ($('invMsg')) $('invMsg').classList.remove('show');
    $('invPanel').hidden = true;
    if (game) game.save();
  }

  return { open, close, render, isOpen: () => isOpen };
})();
