/* ============================================================
   inv-ui.js — Tab: kuşanılanlar (6 yuva), çanta, sandık, üretim, basma
   Bir eşyaya tıkla/dokun → sağda ayrıntı ve işlemler:
   Kuşan / Çıkar · Sandığa / Çantaya · ⚒ Bas (+0…+9) · Nadirlik yükselt · Parçala
   Riskli basma (+6 ve üstü, başarısızlıkta düşer) iki dokunuşla onaylanır.
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
  let sel = null;       // { where: 'bag'|'chest'|'equip', idx }
  let isOpen = false;
  let armed = null;     // riskli basma için onay bekleyen eşyanın uid'i
  let flash = null;     // { uid, cls, html } son basma sonucu
  let msgTimer = null;

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
    const head = it.name + ' (' + R[it.rarity].name + (it.plus ? ' · +' + it.plus : '') + ')';
    return esc([head].concat(I().describe(it)).join('\n'));
  }

  function cell(it, where, idx, emptyIcon) {
    const on = sel && sel.where === where && String(sel.idx) === String(idx);
    const data = ' data-w="' + where + '" data-i="' + idx + '"';
    if (!it) return '<div class="icell empty' + (on ? ' sel' : '') + '"' + data + '>' + (emptyIcon || '') + '</div>';
    const p = it.plus | 0;
    const set = it.set && I().SET[it.set];
    const cls = 'icell' + (on ? ' sel' : '') + (p >= 7 ? ' hi' : '') + (p >= 9 ? ' hi9' : '');
    return '<div class="' + cls + '" style="--c:' + R[it.rarity].color + '"' + data + ' title="' + tipOf(it) + '">' +
      I().SLOT[it.slot].icon +
      (it.unique ? '<b class="star">★</b>' : '') +
      (p > 0 ? '<b class="pl">+' + p + '</b>' : '') +
      (set ? '<i class="st" style="--sc:' + set.color + '"></i>' : '') +
      '<i class="il">' + (it.ilvl + 1) + '</i></div>';
  }

  function renderSets() {
    const chips = I().SETS.map((s) => {
      const n = I().setCount(game, s.id);
      if (!n) return '';
      return '<span class="setchip' + (n >= 2 ? ' on' : '') + '" style="--sc:' + s.color + '" title="' +
        esc(s.name + ' — (2) ' + EV.DATA.modsText(s.b2.mods) + ' · (4) ' + s.b4.desc) + '">' + s.icon + ' ' + n + '/4</span>';
    }).join('');
    $('invSets').innerHTML = chips;
  }

  function render() {
    if (!game) return;
    const inv = game.inv;
    $('invEss').textContent = U.fmt(inv.essence);
    $('invEquip').innerHTML = I().SLOTS.map((s) =>
      '<div class="eqslot">' + cell(inv.equip[s.id], 'equip', s.id, s.icon) + '<span>' + s.name + '</span></div>').join('');
    renderSets();
    $('invBag').innerHTML = inv.bag.map((it, i) => cell(it, 'bag', i)).join('');
    $('invChest').innerHTML = inv.chest.map((it, i) => cell(it, 'chest', i)).join('');
    const poor = inv.essence < IC.craftCost;       // çanta doluysa tıklanınca "Çanta dolu" der
    $('invCraft').innerHTML = I().SLOTS.map((s) =>
      '<button class="craftbtn" data-s="' + s.id + '"' + (poor ? ' disabled' : '') + '>' + s.icon + ' ' + s.name + '</button>').join('');
    $('invCraftCost').textContent = IC.craftCost;

    document.querySelectorAll('#invPanel .icell').forEach((n) => {
      n.onclick = () => {
        sel = { where: n.dataset.w, idx: n.dataset.w === 'equip' ? n.dataset.i : +n.dataset.i };
        armed = null;
        render();
      };
    });
    document.querySelectorAll('#invCraft .craftbtn').forEach((b) => { b.onclick = () => craft(b.dataset.s); });
    renderDetail();
  }

  function craft(slot) {
    const it = I().craft(game, slot);
    if (it) {
      say('Üretildi: <span style="color:' + R[it.rarity].color + '">' + R[it.rarity].name + ' — ' + esc(it.name) + '</span>', '#fff', 2200);
      sel = { where: 'bag', idx: game.inv.bag.indexOf(it) };
      armed = null;
    } else say(game.inv.bag.indexOf(null) < 0 ? 'Çanta dolu' : 'Gen Özü yetmiyor', '#ff8a8a', 1200);
    render();
  }

  /* ---------------- ayrıntı paneli ---------------- */
  function hintHtml() {
    return '<div class="hint">Bir eşyaya tıkla.<br><br>Eşyalar kalıcıdır: evrimde seninle gelir.<br>' +
      'Nadirlik: ' + R.map((r) => '<b style="color:' + r.color + '">' + r.name + '</b>').join(' · ') +
      '<br><br>⚒ <b>Basma</b> +1…+' + IC.plusMax + ': her kademe tüm değerleri artırır. +' + IC.plusDropFrom +
      ' ve üstünde başarısızlık eşyayı bir kademe düşürür.<br>☠️ Apex avı büyük ödül verir.</div>';
  }

  function pips(p) {
    let h = '<div class="ipips" title="Basma +' + p + ' / +' + IC.plusMax + '">';
    for (let i = 1; i <= IC.plusMax; i++) h += '<i class="' + (i <= p ? 'on' : '') + (i > IC.plusDropFrom ? ' r' : '') + '"></i>';
    return h + '</div>';
  }

  function plusBlock(it) {
    const P = I().plusInfo(it);
    const res = flash && flash.uid === it.uid ? '<div class="pres ' + flash.cls + '">' + flash.html + '</div>' : '';
    if (P.max) return '<div class="plusbox max">' + res + '<div class="pmax">⚒ +' + IC.plusMax + ' — en üst basma</div></div>';
    const poor = game.inv.essence < P.cost;
    const pct = Math.round(P.chance * 100);
    const label = '⚒ Bas +' + P.plus + ' → +' + P.next + ' · %' + pct + ' · ' + U.fmt(P.cost) + ' öz';
    const btn = armed === it.uid
      ? '<button data-a="enhance" class="danger pconfirm">⚠ Onayla: +' + P.next + ' dene · %' + pct + ' · ' + U.fmt(P.cost) + ' öz</button>' +
        '<button data-a="disarm" class="ghost">Vazgeç</button>'
      : '<button data-a="enhance" class="plusbtn' + (P.risk ? ' risky' : '') + '"' + (poor ? ' disabled' : '') + '>' + label + '</button>';
    const risk = P.risk
      ? '<div class="prisk bad">⚠ Başarısızlıkta öz gider ve eşya ' + toPlus(P.plus - 1) + ' düşer</div>'
      : '<div class="prisk">Başarısızlıkta yalnızca öz gider' + (P.next >= IC.plusDropFrom ? ' (+' + IC.plusDropFrom + ' sonrası düşme riski var)' : '') + '</div>';
    const gain = '<div class="pgain">Tüm değerler +' + Math.round(P.bonus * 100) + '% → <b>+' + Math.round(P.nextBonus * 100) + '%</b>' +
      (it.affixes.length ? ' · ' + esc(I().affixText(it, P.next)[0]) : '') + '</div>';
    return '<div class="plusbox">' + res + btn + risk + gain + '</div>';
  }

  function setBlock(it) {
    const S = it.set && I().SET[it.set];
    if (!S) return '';
    const n = I().setCount(game, S.id);
    const worn = sel.where === 'equip' ? n : n + (game.inv.equip[it.slot] && game.inv.equip[it.slot].set === S.id ? 0 : 1);
    return '<div class="iset" style="--sc:' + S.color + '"><b>' + S.icon + ' ' + S.name + '</b> takımı · kuşanılı ' + n + '/4' +
      (sel.where !== 'equip' ? ' <span class="sub">(kuşanırsan ' + worn + ')</span>' : '') +
      '<div class="' + (n >= 2 ? 'on' : 'off') + '">(2) ' + EV.DATA.modsText(S.b2.mods) + '</div>' +
      '<div class="' + (n >= 4 ? 'on' : 'off') + '">(4) ' + S.b4.desc + '</div></div>';
  }

  function renderDetail() {
    const it = itemAt(sel);
    const d = $('invDetail');
    if (!it) { d.innerHTML = hintHtml(); return; }
    const r = R[it.rarity];
    const eq = game.inv.equip[it.slot];
    const cmp = sel.where !== 'equip' && eq ? '<div class="cmp">Kuşanılan: <span style="color:' + R[eq.rarity].color + '">' + esc(eq.name) + '</span><br>' +
      I().describe(eq).map(esc).join('<br>') + '</div>' : '';
    const up = I().upgradeCost(it);
    const lines = I().affixText(it).map(esc);
    if (it.unique) lines.push('<span class="uq">★ ' + esc(it.unique.desc) + '</span>');
    d.innerHTML =
      '<div class="iname' + ((it.plus | 0) >= 7 ? ' hi' : '') + '" style="color:' + r.color + '">' + esc(it.name) + '</div>' +
      '<div class="imeta">' + r.name + ' · ' + I().SLOT[it.slot].name + ' · eşya sv ' + (it.ilvl + 1) + ' · basma +' + (it.plus | 0) + '</div>' +
      pips(it.plus | 0) +
      '<div class="iaff">' + lines.join('<br>') + '</div>' + setBlock(it) +
      '<div class="iact">' +
      (sel.where === 'equip' ? '<button data-a="unequip">Çıkar</button>' : '<button data-a="equip">Kuşan</button>') +
      (sel.where === 'bag' ? '<button data-a="toChest" class="ghost">Sandığa koy</button>' : '') +
      (sel.where === 'chest' ? '<button data-a="toBag" class="ghost">Çantaya al</button>' : '') +
      '</div>' + plusBlock(it) +
      '<div class="iact">' +
      (it.rarity < 4 ? '<button data-a="upgrade"' + (game.inv.essence < up ? ' disabled' : '') + '>Nadirlik yükselt → ' + R[it.rarity + 1].name + ' (' + U.fmt(up) + ' öz)</button>' : '') +
      '<button data-a="salvage" class="danger">Parçala (+' + U.fmt(I().salvageValue(it)) + ' öz)</button>' +
      '</div>' + cmp;
    d.querySelectorAll('button').forEach((b) => { b.onclick = () => act(b.dataset.a); });
  }

  /* ---------------- basma ---------------- */
  const RESULT = {
    success: (it, r) => ({ cls: 'ok', html: '✔ BAŞARILI! +' + r.to, toast: '⚒ Basma başarılı: ', color: '#ffd23d' }),
    fail: () => ({ cls: 'bad', html: '✖ Başarısız — öz yandı', toast: '✖ Basma başarısız: ', color: '#ff8a8a' }),
    drop: (it, r) => ({ cls: 'bad', html: '✖ Başarısız — ' + toPlus(r.to) + ' düştü', toast: '✖ Basma başarısız, düştü: ', color: '#ff6b6b' }),
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
    else if (r.result === 'max') say('Eşya zaten +' + IC.plusMax, '#ffd23d', 1200);
    render();
  }

  function act(a) {
    const s = sel;
    let ok = false;
    switch (a) {
      case 'enhance': enhance(s); return;
      case 'disarm': armed = null; render(); return;
      case 'equip': { const it = itemAt(s); ok = I().equipFrom(game, s.where, s.idx); if (ok) sel = { where: 'equip', idx: it.slot }; break; }
      case 'unequip': ok = I().unequip(game, s.idx); sel = null; if (!ok) say('Çanta dolu', '#ff8a8a', 1000); break;
      case 'toChest': ok = I().move(game, 'bag', s.idx, 'chest'); sel = null; if (!ok) say('Sandık dolu', '#ff8a8a', 1000); break;
      case 'toBag': ok = I().move(game, 'chest', s.idx, 'bag'); sel = null; if (!ok) say('Çanta dolu', '#ff8a8a', 1000); break;
      case 'upgrade': ok = I().upgrade(game, s.where, s.idx); break;
      case 'salvage': { const v = I().salvage(game, s.where, s.idx); if (v) say('+' + v + ' Gen Özü', '#9de89d', 1000); sel = null; break; }
      default: break;
    }
    armed = null;
    U.audio.card();
    render();
  }

  function open(g) {
    game = g;
    sel = null;
    armed = null;
    flash = null;
    isOpen = true;
    $('invPanel').hidden = false;
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
