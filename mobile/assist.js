/* ============================================================
   mobile/assist.js — mobil hedefleme yardımı

   Aksiyon oyunlarındaki "yumuşak hedefleme" (Genshin Impact vb.):
   - Hedef SADECE saldırı/yetenek anında seçilir; 20 m içindeki her
     canlıya puan verilir: yakınlık × karakterin baktığı/yürüdüğü yön ×
     tehdit × (mevcut hedefse 1.2, sürekli zıplamasın). Arkadakiler çok
     düşük puan alır: kaçarken ya da arkanda biri varken ona dönülmez.
   - 3 sn saldırmazsan hedef bırakılır. Kamera ASLA zorla döndürülmez.
   - Tembel kamera: bakış bölgesine dokunmadan yürürken kamera yavaşça
     yürüdüğün yöne döner (kameraya doğru geri yürürken dönmez).
   - 🔒 SERT KİLİT (elle): kamera hedefi izler; hedef ölünce / 32 m'den
     uzaklaşınca / tekrar basınca bırakılır, başkasına atlamaz.
   - Tehdit okları: ekran dışından (ör. arkandan) saldırmak üzere olan
     canlılar ekran kenarında kırmızı okla gösterilir.
   🤖 yumuşak hedeflemeyi açıp kapatır. Oyun koduna dokunmaz.
   ============================================================ */
window.EV = window.EV || {};

EV.MobileAssist = (function () {
  'use strict';

  const U = EV.U;
  const STORE = 'evolve_m_assist';
  const RANGE = 20;              // hedef arama yarıçapı
  const STICKY = 1.2;            // mevcut hedefin puan çarpanı
  const FORGET_MS = 3000;        // saldırısız bu süreden sonra yumuşak hedef bırakılır
  const HARD_BREAK = 32;         // sert kilit bu mesafede kopar
  const MANUAL_MS = 1500;        // bakış sürüklemesinden sonra kameraya karışmama
  const LAZY_TURN = 1.1;         // tembel kamera dönüş hızı (rad/sn, tam eğimde)
  const HARD_TURN = 3.2;         // sert kilitte kamera dönüş hızı
  const THREAT_R = 14;           // tehdit oku yarıçapı

  let soft = true;
  try { soft = localStorage.getItem(STORE) !== '0'; } catch (e) { /* gizli sekme */ }
  let hard = null;               // sert kilitli hedef
  let lastActionAt = -1e9;

  const valid = (e) => e && e.alive && !e.ally && !e.peaceful && !e.isApex;
  const game = () => EV.Game;

  /** Karakterin yönü: yürüyorsa yürüyüş, değilse gövdenin baktığı yön. */
  function refYaw(P) {
    if (P.moving && Math.hypot(P.vel.x, P.vel.z) > 1) return Math.atan2(P.vel.x, P.vel.z);
    return P.group.rotation.y;
  }

  function score(P, e, ref) {
    const pos = P.group.position, ep = e.group.position;
    const d = EV.Creature.surfDist(e.group, pos.x, pos.z);
    if (d > RANGE) return 0;
    const ang = Math.abs(U.wrapAngle(Math.atan2(ep.x - pos.x, ep.z - pos.z) - ref));
    const facing = ang < 0.8 ? 1 : ang < 1.6 ? 0.55 : 0.12;                   // önde > yanda >> arkada
    const threat = e.isAlpha || e.isMini ? 1.4
      : (e.atkTarget === P || e.aggroT > 0) ? 1.3
      : e.behavior === 'passive' ? 0.8 : 1;
    const near = 1 - d / (RANGE + 1);
    return near * facing * threat * (e === P.lockTarget ? STICKY : 1);
  }

  function best(P) {
    const pos = P.group.position, ref = refYaw(P);
    let top = null, topS = 0;
    EV.Enemies.forEachNear(pos.x, pos.z, RANGE, (e) => {
      if (!valid(e)) return;
      const s = score(P, e, ref);
      if (s > topS) { topS = s; top = e; }
    });
    return top;
  }

  /** Saldırı / yetenek / atış başladığında köprü çağırır. */
  function onAction() {
    const g = game();
    if (!g || !g.player || !g.player.alive) return;
    lastActionAt = performance.now();
    if (hard) return;                                   // sert kilit varken hedef değişmez
    if (soft) g.player.lockTarget = best(g.player);
  }

  /** 🔒: sert kilidi aç / kapat. */
  function toggleHard() {
    const g = game();
    if (!g || !g.player) return false;
    if (hard) { release('Kilit bırakıldı'); return false; }
    const t = valid(g.player.lockTarget) ? g.player.lockTarget : best(g.player);
    if (!t) { g.toast('Yakında hedef yok', '#ffb35a', 1000); return false; }
    hard = t;
    g.player.lockTarget = t;
    g.toast('🔒 ' + t.name, '#ffd23d', 900);
    return true;
  }

  function release(msg) {
    const g = game();
    if (g && g.player && g.player.lockTarget === hard) g.player.lockTarget = null;
    hard = null;
    if (msg && g) g.toast(msg, '#cfc6b8', 900);
    syncButtons();
  }

  /* ---------------- tehdit okları ---------------- */
  const arrows = [];
  const layer = document.createElement('div');
  layer.id = 'mThreats';
  (document.getElementById('app') || document.body).appendChild(layer);
  for (let i = 0; i < 4; i++) {
    const a = document.createElement('div');
    a.className = 'mThreat';
    a.hidden = true;
    layer.appendChild(a);
    arrows.push(a);
  }
  const _v = new THREE.Vector3();

  function updateThreats(g) {
    const P = g.player, cam = g.camera, pos = P.group.position;
    const W = window.innerWidth, H = window.innerHeight;
    let n = 0;
    EV.Enemies.forEachNear(pos.x, pos.z, THREAT_R, (e) => {
      if (n >= arrows.length || e.ally || e.peaceful) return;
      const winding = (e.atkT > 0 && e.atkTarget === P) || e.isApex || (e.boss && e.boss.busyT > 0);
      if (!winding) return;
      _v.copy(e.group.position);
      _v.y += e.group.userData.hipY;
      _v.project(cam);
      let x = _v.x, y = _v.y;
      const behind = _v.z > 1;
      if (!behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.88) return;       // ekranda görünüyor
      if (behind) { x = -x; y = -y; if (Math.abs(y) < 0.3) y = -0.6; }        // arkada: alt kenara doğru
      const m = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.8) || 1;
      x /= m; y /= m;
      const a = arrows[n++];
      a.hidden = false;
      a.style.left = ((x * 0.5 + 0.5) * W) + 'px';
      a.style.top = ((-y * 0.5 + 0.5) * H) + 'px';
      a.style.transform = 'translate(-50%,-50%) rotate(' + Math.atan2(x, y) + 'rad)';
    });
    for (let i = n; i < arrows.length; i++) arrows[i].hidden = true;
  }

  /* ---------------- kare döngüsü ---------------- */
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const g = game();
    if (!g || !g.started || g.paused || !g.player || !g.player.alive) { arrows.forEach((a) => { a.hidden = true; }); return; }
    const P = g.player;
    const manual = now - EV.MobileBridge.lastLookAt < MANUAL_MS;

    if (hard) {
      if (!hard.alive) release('Hedef düştü');
      else if (hard.group.position.distanceTo(P.group.position) > HARD_BREAK) release('Hedef uzaklaştı');
      else {
        P.lockTarget = hard;
        if (!manual) {
          const tp = hard.group.position, pp = P.group.position;
          P.yaw = U.approachAngle(P.yaw, Math.atan2(tp.x - pp.x, tp.z - pp.z), dt * HARD_TURN);
        }
      }
    } else if (soft) {
      // yumuşak hedef: saldırı sürerken ölürse yenisi, 3 sn saldırı yoksa bırak
      if (P.lockTarget && !valid(P.lockTarget)) P.lockTarget = null;
      if (now - lastActionAt > FORGET_MS) P.lockTarget = null;
      else if (!P.lockTarget && EV.MobileBridge.attacking()) P.lockTarget = best(P);
    }

    // tembel kamera: yürüme yönüne yavaşça dön (sert kilitte ve elle bakarken değil)
    if (!hard && !manual && !P.fps && P.moving) {
      const mv = Math.atan2(P.vel.x, P.vel.z);
      const rel = U.wrapAngle(mv - P.yaw);
      const k = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / Math.max(1, P.stats.speed));
      if (Math.abs(rel) < 1.75) P.yaw = U.approachAngle(P.yaw, mv, dt * LAZY_TURN * k);
    }

    updateThreats(g);
  }
  requestAnimationFrame(tick);

  /* ---------------- düğmeler ---------------- */
  function syncButtons() {
    const ab = document.querySelector('#mTouch .mAssist');
    const lb = document.querySelector('#mTouch [data-a="hardlock"]');
    if (ab) ab.classList.toggle('off', !soft);
    if (lb) lb.classList.toggle('active', !!hard);
  }

  function toggleSoft() {
    soft = !soft;
    try { localStorage.setItem(STORE, soft ? '1' : '0'); } catch (e) { /* gizli sekme */ }
    const g = game();
    if (!soft && g && g.player && !hard) g.player.lockTarget = null;
    if (g) g.toast(soft ? '🤖 Otomatik hedef AÇIK' : 'Otomatik hedef kapalı', soft ? '#9de89d' : '#ffb35a', 1400);
    syncButtons();
    return soft;
  }

  setTimeout(syncButtons, 0);
  return { onAction, toggleSoft, toggleHard: () => { const r = toggleHard(); syncButtons(); return r; },
    isOn: () => soft, hardTarget: () => hard };
})();
