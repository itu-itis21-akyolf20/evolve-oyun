/* ============================================================
   mobile/controls.js — dokunmatik kontroller

   Sol yarı : parmağın değdiği yerde beliren sanal çubuk (hareket)
   Sağ yarı : sürükle = bak / nişan al
   Düğmeler : ⚔️ yakın saldırı (basılı tut) · 🎯 uzak atış (basılı tut)
              💨 atılım · Q E F yetenek · R ultimate
              Yer hedefli yetenek: düğmeye bas, parmağı kaydırarak nişan al, bırak
   Üst sol  : ☰ menü/liderlik · 🎒 çanta · 📜 yapı · 🔒 kamera kilidi ·
              🤖 otomatik hedef · ⛶ tam ekran

   Her dokunuş kimliğiyle izlenir (çoklu dokunma): bir parmak yürürken
   diğeri bakıp saldırabilir. Üretilen her şey EV.MobileBridge'e gider.
   ============================================================ */
(function () {
  'use strict';

  const B = EV.MobileBridge;
  const STICK_R = 56;                    // çubuğun tam eğilme yarıçapı (px)
  const LOOK_ZONE = 0.42;                // ekranın bu oranından sağı bakış bölgesi

  const SKILL_BTNS = [
    { a: 'skill1', slot: 0, label: 'Q' },
    { a: 'skill2', slot: 1, label: 'E' },
    { a: 'skill3', slot: 2, label: 'F' },
    { a: 'ult', slot: 'R', label: 'R' },
  ];

  /* ---------------- DOM ---------------- */
  const root = document.createElement('div');
  root.id = 'mTouch';
  root.innerHTML =
    '<div id="mStick" hidden><div id="mKnob"></div></div>' +
    '<div id="mTop">' +
      '<button data-a="menu" title="Menü">☰</button>' +
      '<button data-a="bag" title="Çanta">🎒</button>' +
      '<button data-a="build" title="Yapı">📜</button>' +
      '<button data-a="hardlock" title="Kamerayı hedefe kilitle">🔒</button>' +
      '<button data-a="assist" title="Otomatik hedef" class="mAssist">🤖</button>' +
      '<button data-a="view" title="Birinci / üçüncü şahıs">👁️</button>' +
      '<button data-a="auto" title="Otomatik yetenek" class="mAuto">🔁</button>' +
      '<button data-a="full" title="Tam ekran">⛶</button>' +
    '</div>' +
    '<div id="mBtns">' +
      '<button data-a="attack" class="mAtk">⚔️</button>' +
      '<button data-a="shoot" class="mShoot">🎯</button>' +
      '<button data-a="dash" class="mDash">💨</button>' +
      SKILL_BTNS.map((s) => '<button data-a="' + s.a + '" class="mSkill m-' + s.a + '"><span class="ic">' + s.label +
        '</span><span class="cd"></span><span class="key">' + s.label + '</span></button>').join('') +
    '</div>';
  // #app içinde: oyunun panelleri (z-index 20) her zaman dokunmatik katmanın üstünde kalır
  (document.getElementById('app') || document.body).appendChild(root);

  const rot = document.createElement('div');
  rot.id = 'mRotate';
  rot.textContent = '🔄 Telefonu yan çevir';
  document.body.appendChild(rot);

  const stick = root.querySelector('#mStick');
  const knob = root.querySelector('#mKnob');

  /* ---------------- dokunuş takibi ---------------- */
  const touches = new Map();             // identifier → { kind, x0, y0, x, y, action }

  function game() { return EV.Game; }

  function anyModal() {
    const g = game();
    return EV.Cards.isOpen() || EV.Inv.isOpen() || EV.Online.isOpen() ||
      !document.getElementById('deathPanel').hidden || !g.player || !g.player.alive;
  }

  /** Duraklatılmışsa (ör. menü Esc ile kapandı) dokununca oyuna dön. */
  function wake() {
    const g = game();
    if (g.started && g.paused && !anyModal()) g.resume();
  }

  function fullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    Promise.resolve(req.call(el)).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { /* desteklenmiyor */ });
    }).catch(() => { /* kullanıcı reddetti */ });
  }

  function onStart(e) {
    e.preventDefault();
    wake();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('button[data-a]');
      if (btn) {
        const a = btn.dataset.a;
        if (a === 'full') { fullscreen(); continue; }
        if (a === 'assist') { EV.MobileAssist.toggleSoft(); continue; }
        if (a === 'hardlock') { EV.MobileAssist.toggleHard(); continue; }
        btn.classList.add('on');
        touches.set(t.identifier, { kind: 'btn', action: a, btn, x: t.clientX, y: t.clientY });
        B.action(a, true);
      } else if (t.clientX < window.innerWidth * LOOK_ZONE) {
        touches.set(t.identifier, { kind: 'stick', x0: t.clientX, y0: t.clientY });
        stick.hidden = false;
        stick.style.left = t.clientX + 'px';
        stick.style.top = t.clientY + 'px';
        knob.style.transform = 'translate(-50%,-50%)';
      } else {
        touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
      }
    }
  }

  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      if (s.kind === 'stick') {
        let dx = t.clientX - s.x0, dy = t.clientY - s.y0;
        const l = Math.hypot(dx, dy);
        if (l > STICK_R) { dx *= STICK_R / l; dy *= STICK_R / l; }
        knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
        B.applyMove({ x: dx / STICK_R, y: -dy / STICK_R });
      } else {
        // bakış bölgesi ve yetenek düğmeleri (basılı tutup kaydırarak nişan) kamerayı çevirir
        const aimable = s.kind === 'look' || /^(skill|ult|shoot)/.test(s.action);
        if (aimable) B.applyLook(t.clientX - s.x, t.clientY - s.y);
        s.x = t.clientX;
        s.y = t.clientY;
      }
    }
  }

  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      touches.delete(t.identifier);
      if (s.kind === 'stick') {
        stick.hidden = true;
        B.applyMove({ x: 0, y: 0 });
      } else if (s.kind === 'btn') {
        s.btn.classList.remove('on');
        B.action(s.action, false);
      }
    }
  }

  root.addEventListener('touchstart', onStart, { passive: false });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onEnd, { passive: false });
  root.addEventListener('touchcancel', onEnd, { passive: false });

  function resetAll() {
    touches.clear();
    stick.hidden = true;
    root.querySelectorAll('button.on').forEach((b) => b.classList.remove('on'));
    B.applyMove({ x: 0, y: 0 });
    B.releaseAll();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetAll(); });

  /* Çantanın masaüstünde düğmesi yok (Tab/Esc ile kapanır): mobilde Kapat düğmesi ekle */
  (function addInvClose() {
    const panel = document.querySelector('#invPanel .panel');
    if (!panel || panel.querySelector('.mInvClose')) return;
    const b = document.createElement('button');
    b.className = 'mInvClose';
    b.textContent = 'Kapat ✕';
    b.onclick = () => { EV.Inv.close(); EV.Game.resume(); };
    panel.appendChild(b);
  })();

  /* ---------------- düğme durumları (ikon, bekleme, öfke) ---------------- */
  const skillEls = SKILL_BTNS.map((s) => {
    const el = root.querySelector('.m-' + s.a);
    return { s, el, ic: el.querySelector('.ic'), cd: el.querySelector('.cd'), last: '' };
  });

  function refresh() {
    const g = game();
    document.body.classList.toggle('mPlaying', !!g.started);
    if (anyModal()) { if (touches.size) resetAll(); }
    if (!g.started || !g.build) return;
    const b = g.build, P = g.player;
    root.querySelector('.mAuto').classList.toggle('active', !!P.autoCast);
    const rageMax = EV.CFG.TUNE.rageMax;
    skillEls.forEach((x) => {
      const sk = x.s.slot === 'R' ? b.ult : b.skills[x.s.slot];
      const def = sk && EV.DATA.skill(sk.id);
      const icon = def ? def.icon : x.s.label;
      if (x.last !== icon) {
        x.ic.textContent = icon;
        x.last = icon;
        // her yetenek kendi element renginde çerçevelenir: düğmeler birbirine / atılıma benzemesin
        x.el.style.setProperty('--sk', def ? '#' + EV.Skills.tagColor(def).toString(16).padStart(6, '0') : '');
      }
      x.el.classList.toggle('empty', !def);
      let frac = 0;
      if (def && x.s.slot === 'R') frac = 1 - Math.min(1, P.rage / rageMax);
      else if (def && sk.cd > 0) frac = Math.min(1, sk.cd / (sk.cdMax || sk.cd));
      x.el.style.setProperty('--cd', (frac * 100).toFixed(0) + '%');
      x.el.classList.toggle('ready', !!def && frac <= 0);
      x.cd.textContent = def && x.s.slot !== 'R' && sk.cd > 0.05 ? Math.ceil(sk.cd) : '';
    });
  }
  setInterval(refresh, 120);
  refresh();

})();
