/* ============================================================
   ui.js — HUD: çubuklar, yetenek çubuğu, nişangah, hedef çerçevesi,
   boss barı, uçan sayılar, bildirimler, tehlike vinyeti
   ============================================================ */
window.EV = window.EV || {};

EV.UI = (function () {
  'use strict';

  const U = EV.U;
  const DATA = EV.DATA;
  const $ = (id) => document.getElementById(id);
  const el = {};
  const slots = {};
  const proj = new THREE.Vector3();
  let toastTimer = null, saveTimer = null, castTimer = null;
  let hurtK = 0;

  const IDS = ['evoLabel', 'evoFill', 'evoText', 'bossBanner', 'bossName', 'bossFill', 'bossCast',
    'targetFrame', 'tfName', 'tfLvl', 'tfFill', 'tfHp', 'tfSt', 'stageName', 'diffName', 'killCount',
    'herdChip', 'herdCount', 'waveChip', 'waveNum', 'eggChip', 'eggTime', 'eggHp', 'saveChip',
    'crosshair', 'dangerVig', 'hurtVig', 'fleeWarn', 'fleeName', 'matePrompt', 'toast', 'dmgLayer',
    'marker', 'lockHint', 'essCount', 'hideChip', 'dmgTotal', 'dmgMax', 'scoreNow', 'echoBar', 'skillbar', 'lvlNum', 'xpRing', 'hpFill', 'shieldFill', 'hpText',
    'enFill', 'enText', 'rageFill', 'rageText', 'dmgText', 'critText', 'armorText', 'creatureName'];

  function init() { IDS.forEach((id) => { el[id] = $(id); }); }

  /* =========================================================
     Yetenek çubuğu
     ========================================================= */
  function slotEl(key, extra) {
    const d = document.createElement('div');
    d.className = 'sl ' + (extra || '');
    d.innerHTML = '<div class="gl"></div><div class="kb">' + key + '</div><div class="pips"></div>' +
      '<div class="cost"></div><div class="cd"></div><div class="cdn"></div>';
    el.skillbar.appendChild(d);
    return { root: d, gl: d.querySelector('.gl'), pips: d.querySelector('.pips'), cost: d.querySelector('.cost'),
      cd: d.querySelector('.cd'), cdn: d.querySelector('.cdn') };
  }

  function buildSkillbar(game) {
    el.skillbar.innerHTML = '';
    const b = game.build;
    const st = game.stage();
    slots.basic = slotEl('SOL', 'basic');
    slots.basic.gl.textContent = st.basic.icon;
    slots.basic.root.title = st.basic.name + ' — temel saldırı (3\'lü kombo)';

    ['Q', 'E', 'F'].forEach((k, i) => {
      const s = slotEl(k);
      const sk = b.skills[i];
      if (sk) {
        const def = DATA.skill(sk.id);
        s.gl.textContent = def.icon;
        s.root.title = def.name + ' — ' + DATA.describe(def, sk.rank);
        s.cost.textContent = DATA.params(def, sk.rank).cost;
        s.pips.innerHTML = [1, 2, 3, 4, 5].map((r) => '<i class="' + (r <= sk.rank ? 'on' : '') + '"></i>').join('');
        if (sk.fused) s.root.classList.add('fused');
      } else {
        s.root.classList.add('empty');
        s.gl.textContent = '·';
      }
      slots[i] = s;
    });

    const u = slotEl('R', 'ult');
    if (b.ult) {
      const def = DATA.skill(b.ult.id);
      u.gl.textContent = def.icon;
      u.root.title = def.name + ' (ultimate) — ' + DATA.describe(def, b.ult.rank);
      u.pips.innerHTML = [1, 2, 3, 4, 5].map((r) => '<i class="' + (r <= b.ult.rank ? 'on' : '') + '"></i>').join('');
    } else {
      u.root.classList.add('empty');
      u.gl.textContent = '🔒';
      u.root.title = 'Ultimate: 4. seviyeden sonra kartlarda çıkar';
    }
    slots.R = u;

    slots.dash = slotEl('␣', 'dashs');
    slots.dash.gl.textContent = '💨';
    slots.dash.root.title = 'Atılım — enerji harcar, kısa dokunulmazlık';

    el.echoBar.innerHTML = game.legacy.echoes.map((e) => {
      const d = DATA.skill(e.id);
      return d ? '<span class="echo" data-id="' + e.id + '" title="Kalıtsal: ' + d.name + '">' + d.icon + '</span>' : '';
    }).join('');
  }

  function setCd(s, left, max) {
    if (left > 0.05) {
      s.cd.style.height = Math.min(100, (left / Math.max(max, 0.01)) * 100) + '%';
      s.cdn.textContent = left >= 1 ? Math.ceil(left) : left.toFixed(1);
    } else {
      s.cd.style.height = '0%';
      s.cdn.textContent = '';
    }
  }

  function updateSkillbar(game) {
    const P = game.player;
    const b = game.build;
    if (!slots.basic) return;
    setCd(slots.basic, P.basicCd, 0.55 / P.stats.atkSpd);
    for (let i = 0; i < 3; i++) {
      const s = slots[i], sk = b.skills[i];
      if (!s || !sk) continue;
      setCd(s, sk.cd, sk.cdMax || 1);
      const cost = DATA.params(DATA.skill(sk.id), sk.rank).cost;
      s.root.classList.toggle('noen', P.energy < cost);
    }
    if (slots.R && b.ult) {
      setCd(slots.R, b.ult.cd, b.ult.cdMax || 2);
      slots.R.root.classList.toggle('ready', P.rage >= 100);
    }
    setCd(slots.dash, P.dashCd, EV.CFG.TUNE.dashCd);
    slots.dash.root.classList.toggle('noen', P.energy < EV.CFG.TUNE.dashCost * P.stats.dashCost);
  }

  function flashSlot(slot, reason) {
    const s = slots[slot];
    if (!s) return;
    const cls = reason ? 'bad' : 'fire';
    s.root.classList.add(cls);
    setTimeout(() => s.root.classList.remove(cls), 220);
    if (reason === 'target') toast('Hedef yok', '#ffd9a0', 700);
    if (reason === 'rage') toast('Öfke dolmadı', '#ff8a2a', 700);
  }

  function noEnergy(slot) {
    flashSlot(slot, 'energy');
    toast('Enerji yetersiz', '#8fd0ff', 600);
  }

  function echoPulse(id) {
    const n = el.echoBar.querySelector('[data-id="' + id + '"]');
    if (!n) return;
    n.classList.add('fire');
    setTimeout(() => n.classList.remove('fire'), 300);
  }

  /* =========================================================
     HUD
     ========================================================= */
  function refresh(game) {
    const P = game.player;
    if (!P || !P.stats || !game.build) return;
    const S = P.stats;
    const b = game.build;

    el.lvlNum.textContent = b.level;
    const need = EV.Build.xpNeed(game);
    el.xpRing.style.strokeDashoffset = 283 * (1 - U.clamp(b.xp / need, 0, 1));

    el.hpFill.style.width = U.clamp(P.hp / S.maxHp * 100, 0, 100) + '%';
    el.shieldFill.style.width = U.clamp(P.shield / S.maxHp * 100, 0, 100) + '%';
    el.hpText.textContent = U.fmt(Math.max(0, P.hp)) + ' / ' + U.fmt(S.maxHp) + (P.shield > 0 ? '  +' + U.fmt(P.shield) : '');
    el.enFill.style.width = U.clamp(P.energy / S.maxEnergy * 100, 0, 100) + '%';
    el.enText.textContent = Math.floor(P.energy) + ' / ' + Math.round(S.maxEnergy);
    el.rageFill.style.width = U.clamp(P.rage, 0, 100) + '%';
    el.rageFill.parentNode.classList.toggle('full', P.rage >= 100);
    el.rageText.textContent = P.rage < 100 ? 'ÖFKE' : (b.ult ? 'ÖFKE HAZIR — R' : 'ÖFKE DOLU');
    el.rageText.parentNode.title = b.ult ? '' : 'Ultimate kartları 4. seviyeden sonra çıkar';

    el.dmgText.textContent = U.fmt(S.dmg);
    el.critText.textContent = Math.round(S.crit * 100) + '%';
    el.armorText.textContent = Math.round(S.armor * 100) + '%';
    el.creatureName.textContent = game.creatureTitle();

    const evoMax = game.evoMax();
    el.evoFill.style.width = U.clamp(game.evo / evoMax * 100, 0, 100) + '%';
    el.evoText.textContent = 'EVO ' + U.fmt(game.evo) + ' / ' + U.fmt(evoMax);
    el.evoLabel.textContent = game.stageDisplayName().toLocaleUpperCase('tr-TR') +
      (game.bossActive ? ' — ALFA' : game.evo >= evoMax ? '' : '');

    el.stageName.textContent = game.stageDisplayName();
    el.diffName.textContent = game.diff.name;
    el.killCount.textContent = U.fmt(game.kills);
    el.essCount.textContent = U.fmt(game.inv ? game.inv.essence : 0);
    if (game.stats) {
      el.dmgTotal.textContent = U.fmt(game.stats.totalDmg);
      el.dmgMax.textContent = U.fmt(game.stats.maxHit);
      el.scoreNow.textContent = U.fmt(EV.Online.score(game));
      if (game.stats.maxHitNew) {
        game.stats.maxHitNew = false;
        el.dmgMax.parentNode.classList.remove('flash');
        void el.dmgMax.offsetWidth;          // animasyonu yeniden başlat
        el.dmgMax.parentNode.classList.add('flash');
      }
    }
    el.hideChip.hidden = !P.hidden;
    let allies = 0;
    for (let i = 0; i < game.enemies.length; i++) if (game.enemies[i].alive && game.enemies[i].ally) allies++;
    el.herdChip.hidden = allies === 0;
    el.herdCount.textContent = allies;
    el.waveChip.hidden = game.generation === 0;
    el.waveNum.textContent = game.generation + 1;
  }

  /* ---------------- nişangah + hedef çerçevesi ---------------- */
  function updateTarget(game) {
    const P = game.player;
    const t = (P.lockTarget && P.lockTarget.alive) ? P.lockTarget : (P.hover && P.hover.alive ? P.hover : null);
    el.crosshair.classList.toggle('enemy', !!P.hover && !P.hover.ally);
    el.crosshair.classList.toggle('locked', !!P.lockTarget);
    if (!t || t.isAlpha) { el.targetFrame.hidden = true; return; }
    el.targetFrame.hidden = false;
    el.targetFrame.classList.toggle('locked', t === P.lockTarget);
    el.tfName.textContent = t.name;
    el.tfName.style.color = t.ally ? '#9fd8ff' : t.peaceful ? '#ffb0d8' : t.isApex ? '#ff6b6b' : '#fff';
    el.tfLvl.textContent = 'Sv ' + t.lvl + (t.behavior === 'passive' ? ' · ürkek' : t.behavior === 'neutral' ? ' · nötr' : '');
    el.tfFill.style.width = U.clamp(t.hp / t.maxHp * 100, 0, 100) + '%';
    el.tfHp.textContent = U.fmt(Math.max(0, t.hp)) + ' / ' + U.fmt(t.maxHp);
    el.tfSt.innerHTML = EV.Status.list(t).map((s) =>
      '<i style="--c:' + s.def.color + '">' + s.def.icon + ' ' + s.def.name + (s.n ? ' ' + s.n : '') + '</i>').join('');
  }

  /* ---------------- boss ---------------- */
  function updateBoss(game, camera) {
    const b = game.boss;
    if (!b || !b.alive) { el.bossBanner.hidden = true; el.marker.hidden = true; return; }
    el.bossBanner.hidden = false;
    el.bossName.textContent = b.name + ' · Sv ' + b.lvl + (b.boss && b.boss.phase > 1 ? ' · Faz ' + b.boss.phase : '');
    el.bossFill.style.width = U.clamp(b.hp / b.maxHp * 100, 0, 100) + '%';

    proj.copy(b.group.position);
    proj.y += b.group.userData.height + 1.5;
    proj.project(camera);
    let x = proj.x, y = proj.y;
    if (proj.z > 1) { x = -x; y = -y; }
    const off = proj.z > 1 || Math.abs(x) > 0.95 || Math.abs(y) > 0.9;
    if (off) { const m = Math.max(Math.abs(x), Math.abs(y)) || 1; x = x / m * 0.88; y = y / m * 0.82; }
    el.marker.hidden = false;
    el.marker.style.left = (x * 0.5 + 0.5) * window.innerWidth + 'px';
    el.marker.style.top = (-y * 0.5 + 0.5) * window.innerHeight + 'px';
  }

  function bossCast(e, name) {
    if (!e.isAlpha) return;
    el.bossCast.textContent = '⚠ ' + name;
    clearTimeout(castTimer);
    castTimer = setTimeout(() => { el.bossCast.textContent = ''; }, 1600);
  }

  /* ---------------- tehlike + çiftleşme ---------------- */
  function updateDanger(game) {
    const a = game.apex;
    if (!a || !a.alive || !game.player.alive) { el.dangerVig.style.opacity = 0; el.fleeWarn.hidden = true; }
    else {
      const d = a.group.position.distanceTo(game.player.group.position);
      const k = U.clamp(1 - d / 34, 0, 1);
      el.dangerVig.style.opacity = k * 0.85;
      el.fleeWarn.hidden = k < 0.25;
      el.fleeName.textContent = a.name;
    }
    hurtK = Math.max(0, hurtK - 0.05);
    el.hurtVig.style.opacity = hurtK;
  }

  function hurtFlash(frac) { hurtK = Math.min(0.9, hurtK + 0.25 + frac * 2); }

  function updateMating(game) {
    const P = game.player;
    el.matePrompt.hidden = !(P.alive && EV.Mating.canMate(game));
    const egg = EV.Mating.activeEgg();
    if (!egg) { el.eggChip.hidden = true; return; }
    el.eggChip.hidden = false;
    const s = Math.max(0, Math.ceil(egg.time));
    el.eggTime.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    el.eggHp.textContent = U.fmt(Math.max(0, egg.hp)) + '/' + U.fmt(egg.maxHp);
    el.eggChip.style.color = egg.hp < egg.maxHp * 0.35 ? '#ff8a8a' : '#ffd8ea';
  }

  /* =========================================================
     Sayılar ve bildirimler
     ========================================================= */
  let dmgNodes = 0;
  function dmgNumber(worldPos, text, cls, camera) {
    if (dmgNodes > 70) return;
    proj.copy(worldPos).project(camera);
    if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) return;
    const d = document.createElement('div');
    d.className = 'dmg ' + (cls || '');
    d.textContent = text;
    d.style.left = ((proj.x * 0.5 + 0.5) * window.innerWidth + U.rand(-16, 16)) + 'px';
    d.style.top = ((-proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    el.dmgLayer.appendChild(d);
    dmgNodes++;
    setTimeout(() => { d.remove(); dmgNodes--; }, 900);
  }

  function floatText(worldPos, text, color) {
    const cam = EV.Game.camera;
    proj.copy(worldPos).project(cam);
    if (proj.z > 1) return;
    const d = document.createElement('div');
    d.className = 'float';
    d.textContent = text;
    d.style.color = color || '#fff';
    d.style.left = ((proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    d.style.top = ((-proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    el.dmgLayer.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  function toast(html, color, ms) {
    el.toast.innerHTML = html;
    el.toast.style.color = color || '#ffe08a';
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms || 2200);
  }

  function savedBlink() {
    el.saveChip.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.saveChip.classList.remove('show'), 900);
  }

  function setLockHint(show) { el.lockHint.hidden = !show; }

  function showDeath(html, onRespawn) {
    $('deathBody').innerHTML = html;
    $('deathPanel').hidden = false;
    $('respawn').onclick = () => { $('deathPanel').hidden = true; onRespawn(); };
  }

  return {
    init, buildSkillbar, updateSkillbar, flashSlot, noEnergy, echoPulse,
    refresh, updateTarget, updateBoss, bossCast, updateDanger, hurtFlash, updateMating,
    dmgNumber, floatText, toast, savedBlink, setLockHint, showDeath,
  };
})();
