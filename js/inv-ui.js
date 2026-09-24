/* ============================================================
   inv-ui.js — Tab: kuşanılanlar, çanta, sandık, eşya basma
   Bir eşyaya tıkla → sağda ayrıntı ve işlemler:
   Kuşan / Çıkar · Sandığa / Çantaya · Yükselt · Parçala
   ============================================================ */
window.EV = window.EV || {};

EV.Inv = (function () {
  'use strict';

  const U = EV.U;
  const R = EV.CFG.RARITY;
  const IC = EV.CFG.ITEMS;
  const I = () => EV.Items;
  const $ = (id) => document.getElementById(id);

  let game = null;
  let sel = null;       // { where: 'bag'|'chest'|'equip', idx }
  let isOpen = false;

  function itemAt(s) {
    if (!s) return null;
    return s.where === 'equip' ? game.inv.equip[s.idx] : game.inv[s.where][s.idx];
  }

  function cell(it, where, idx, emptyIcon) {
    const on = sel && sel.where === where && String(sel.idx) === String(idx);
    if (!it) return '<div class="icell empty' + (on ? ' sel' : '') + '" data-w="' + where + '" data-i="' + idx + '">' + (emptyIcon || '') + '</div>';
    const c = R[it.rarity].color;
    const tip = it.name + ' (' + R[it.rarity].name + ')\n' + I().describe(it).join('\n');
    return '<div class="icell' + (on ? ' sel' : '') + '" style="--c:' + c + '" data-w="' + where + '" data-i="' + idx + '" title="' + tip.replace(/"/g, '') + '">' +
      I().SLOT[it.slot].icon + (it.unique ? '<b class="star">★</b>' : '') + '<i class="il">' + (it.ilvl + 1) + '</i></div>';
  }

  function render() {
    const inv = game.inv;
    $('invEss').textContent = U.fmt(inv.essence);
    $('invEquip').innerHTML = I().SLOTS.map((s) =>
      '<div class="eqslot"><span>' + s.name + '</span>' + cell(inv.equip[s.id], 'equip', s.id, s.icon) + '</div>').join('');
    $('invBag').innerHTML = inv.bag.map((it, i) => cell(it, 'bag', i)).join('');
    $('invChest').innerHTML = inv.chest.map((it, i) => cell(it, 'chest', i)).join('');
    $('invCraft').innerHTML = I().SLOTS.map((s) =>
      '<button class="craftbtn" data-s="' + s.id + '"' + (inv.essence < IC.craftCost || inv.bag.indexOf(null) < 0 ? ' disabled' : '') + '>' + s.icon + ' ' + s.name + '</button>').join('');
    $('invCraftCost').textContent = IC.craftCost;

    document.querySelectorAll('#invPanel .icell').forEach((n) => {
      n.onclick = () => { sel = { where: n.dataset.w, idx: n.dataset.w === 'equip' ? n.dataset.i : +n.dataset.i }; render(); };
    });
    document.querySelectorAll('#invCraft .craftbtn').forEach((b) => {
      b.onclick = () => {
        const it = I().craft(game, b.dataset.s);
        if (it) {
          EV.UI.toast('Basıldı: <span style="color:' + R[it.rarity].color + '">' + R[it.rarity].name + ' — ' + it.name + '</span>', '#fff', 2200);
          sel = { where: 'bag', idx: game.inv.bag.indexOf(it) };
        } else EV.UI.toast(game.inv.bag.indexOf(null) < 0 ? 'Çanta dolu' : 'Gen Özü yetmiyor', '#ff8a8a', 1200);
        render();
      };
    });
    renderDetail();
  }

  function renderDetail() {
    const it = itemAt(sel);
    const d = $('invDetail');
    if (!it) { d.innerHTML = '<div class="hint">Bir eşyaya tıkla.<br><br>Eşyalar kalıcıdır: evrimde seninle gelir.<br>' +
      'Nadirlik: ' + R.map((r) => '<b style="color:' + r.color + '">' + r.name + '</b>').join(' · ') + '</div>'; return; }
    const r = R[it.rarity];
    const eq = game.inv.equip[it.slot];
    const cmp = sel.where !== 'equip' && eq ? '<div class="cmp">Kuşanılan: <span style="color:' + R[eq.rarity].color + '">' + eq.name + '</span><br>' +
      I().describe(eq).join('<br>') + '</div>' : '';
    const up = I().upgradeCost(it);
    d.innerHTML =
      '<div class="iname" style="color:' + r.color + '">' + it.name + '</div>' +
      '<div class="imeta">' + r.name + ' · ' + I().SLOT[it.slot].name + ' · eşya seviyesi ' + (it.ilvl + 1) + '</div>' +
      '<div class="iaff">' + I().describe(it).join('<br>') + '</div>' + cmp +
      '<div class="iact">' +
      (sel.where === 'equip' ? '<button data-a="unequip">Çıkar</button>' : '<button data-a="equip">Kuşan</button>') +
      (sel.where === 'bag' ? '<button data-a="toChest" class="ghost">Sandığa koy</button>' : '') +
      (sel.where === 'chest' ? '<button data-a="toBag" class="ghost">Çantaya al</button>' : '') +
      (it.rarity < 4 ? '<button data-a="upgrade"' + (game.inv.essence < up ? ' disabled' : '') + '>Yükselt → ' + R[it.rarity + 1].name + ' (' + U.fmt(up) + ' öz)</button>' : '') +
      '<button data-a="salvage" class="danger">Parçala (+' + I().salvageValue(it) + ' öz)</button>' +
      '</div>';
    d.querySelectorAll('button').forEach((b) => { b.onclick = () => act(b.dataset.a); });
  }

  function act(a) {
    const s = sel;
    let ok = false;
    switch (a) {
      case 'equip': { const it = itemAt(s); ok = I().equipFrom(game, s.where, s.idx); if (ok) sel = { where: 'equip', idx: it.slot }; break; }
      case 'unequip': ok = I().unequip(game, s.idx); sel = null; if (!ok) EV.UI.toast('Çanta dolu', '#ff8a8a', 1000); break;
      case 'toChest': ok = I().move(game, 'bag', s.idx, 'chest'); sel = null; if (!ok) EV.UI.toast('Sandık dolu', '#ff8a8a', 1000); break;
      case 'toBag': ok = I().move(game, 'chest', s.idx, 'bag'); sel = null; if (!ok) EV.UI.toast('Çanta dolu', '#ff8a8a', 1000); break;
      case 'upgrade': ok = I().upgrade(game, s.where, s.idx); break;
      case 'salvage': { const v = I().salvage(game, s.where, s.idx); if (v) EV.UI.toast('+' + v + ' Gen Özü', '#9de89d', 1000); sel = null; break; }
      default: break;
    }
    U.audio.card();
    render();
  }

  function open(g) {
    game = g;
    sel = null;
    isOpen = true;
    $('invPanel').hidden = false;
    render();
  }

  function close() {
    isOpen = false;
    $('invPanel').hidden = true;
    if (game) game.save();
  }

  return { open, close, render, isOpen: () => isOpen };
})();
