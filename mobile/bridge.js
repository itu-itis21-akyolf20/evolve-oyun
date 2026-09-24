/* ============================================================
   mobile/bridge.js — cihazdan bağımsız KONTROL NİYETİ → oyun girdisi

   Niyet (intent) oyuncunun o anki isteğidir:
     move  { x, y }   -1..1 (x sağ, y ileri)
     look  { dx, dy } bu karedeki bakış kayması (fare pikseli cinsinden)
     hold  Set<eylem> basılı tutulanlar
   Eylemler: attack shoot dash skill1 skill2 skill3 ult lock bag build menu

   Dokunmatik kontroller (controls.js) niyet üretir, bu köprü onu
   oyunun mevcut EV.Input'una klavye/fare olayı olarak uygular; oyun
   kodu değişmez. İleride çok oyunculu (co-op / PvP) modda diğer
   oyuncuların girdisi de ağ üzerinden bu biçimde taşınabilir: niyet
   küçük, cihazdan bağımsız ve sıralanabilir (JSON) bir yapıdır.
   ============================================================ */
window.EV = window.EV || {};

EV.MobileBridge = (function () {
  'use strict';

  const ACTION_KEY = {
    dash: 'Space', skill1: 'KeyQ', skill2: 'KeyE', skill3: 'KeyF', ult: 'KeyR',
    lock: 'KeyT', bag: 'Tab', build: 'KeyK', menu: 'Escape', view: 'KeyV',
  };
  const MOVE_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  const DEAD = 0.35;                 // çubuğun bu kadarı eğilmeden yön sayılmaz
  const LOOK_GAIN = 2.2;             // dokunma pikseli → fare pikseli

  const held = new Set();            // şu an basılı sanal tuşlar
  let attacking = false;
  let shooting = false;

  function key(code, down) {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  }

  function setKey(code, down) {
    if (down === held.has(code)) return;
    if (down) held.add(code); else held.delete(code);
    key(code, down);
  }

  /** Hareket niyeti → WASD (8 yön). */
  function applyMove(m) {
    setKey(MOVE_KEYS.up, m.y > DEAD);
    setKey(MOVE_KEYS.down, m.y < -DEAD);
    setKey(MOVE_KEYS.right, m.x > DEAD);
    setKey(MOVE_KEYS.left, m.x < -DEAD);
  }

  /** Bakış niyeti → fare kayması (oyun sadece 'kilitli' farede bakışı işler). */
  function applyLook(dx, dy) {
    if (dx || dy) api.lastLookAt = performance.now();   // nişan yardımı bu sırada kameraya karışmaz
    const m = EV.Input.mouse;
    m.locked = true;
    m.dx += dx * LOOK_GAIN;
    m.dy += dy * LOOK_GAIN;
  }

  function mouseButtons() {
    const m = EV.Input.mouse;
    const wasRight = m.right;
    m.left = attacking || shooting;
    m.right = shooting;                              // sağ tık basılı = nişan modu → sol tık uzak atış
    if (m.right && !wasRight) m.rightPressed = true;
    if (m.left) m.leftPressed = true;
  }

  /** Bir eylem başladı / bitti. */
  function action(name, down) {
    // saldırı/yetenek anında hedef seçilir (yumuşak hedefleme — assist.js)
    if (down && /^(attack|shoot|skill|ult)/.test(name) && EV.MobileAssist) EV.MobileAssist.onAction();
    if (name === 'attack') {
      attacking = down;
      mouseButtons();
      return;
    }
    if (name === 'shoot') {
      shooting = down;
      mouseButtons();
      return;
    }
    const code = ACTION_KEY[name];
    if (!code) return;
    // anlık eylemler (menü, çanta…) bas-bırak; yetenekler basılı tutulabilir (yer hedefliler için)
    if (name === 'menu' || name === 'bag' || name === 'build' || name === 'lock' || name === 'view') {
      if (down) { key(code, true); key(code, false); }
      return;
    }
    setKey(code, down);
  }

  /** Her şeyi bırak (duraklatma, sekme değişimi). */
  function releaseAll() {
    Array.from(held).forEach((c) => setKey(c, false));
    attacking = shooting = false;
    const m = EV.Input.mouse;
    m.left = m.right = false;
  }

  // Telefonda fare kilidi yok: oyunun kilit istekleri boşa çıkar (bazı Android tarayıcılarında
  // yarım çalışıp oyunu duraklatıyordu). Bakış her zaman açık sayılır.
  EV.Input.requestLock = function () {};
  EV.Input.releaseLock = function () {};
  EV.Input.mouse.locked = true;

  const api = { applyMove, applyLook, action, releaseAll, lastLookAt: 0, attacking: () => attacking || shooting };
  return api;
})();
