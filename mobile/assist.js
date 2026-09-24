/* ============================================================
   mobile/assist.js — mobil nişan yardımı (🤖 düğmesiyle açılıp kapanır)

   Açıkken:
   - En yakın canlıya sürekli kilitlenir (apex hariç: ondan kaçılır).
     Seçili hedef menzildeyse bırakılmaz; 🔒 ile elle başkasına geçilir.
   - Kamera kilitli hedefe döner: çubukla yürümek yeter (ileri = hedefe,
     yan = etrafında dön). Yetenekler ve uzak atış hedefe gider.
   - Ekran sürüklenince kamera bir süre oyuncuya bırakılır.
   Oyun koduna dokunmaz; sadece lockTarget ve kamera açısını ayarlar.
   ============================================================ */
window.EV = window.EV || {};

EV.MobileAssist = (function () {
  'use strict';

  const U = EV.U;
  const STORE = 'evolve_m_assist';
  const PICK_RANGE = 24;       // yeni hedef arama yarıçapı
  const KEEP_RANGE = 32;       // mevcut hedef bu mesafeye kadar bırakılmaz
  const CAM_TURN = 3.2;        // kamera dönüş hızı (açı yaklaşımı / sn)
  const MANUAL_MS = 1500;      // sürüklemeden sonra kameraya karışmama süresi

  let on = true;
  try { on = localStorage.getItem(STORE) !== '0'; } catch (e) { /* gizli sekme */ }

  const valid = (e) => e && e.alive && !e.ally && !e.peaceful && !e.isApex;

  function pickTarget(P) {
    const pos = P.group.position;
    const cur = P.lockTarget;
    if (valid(cur) && cur.group.position.distanceTo(pos) < KEEP_RANGE) return cur;
    return EV.Enemies.nearest(pos.x, pos.z, PICK_RANGE, valid);
  }

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const g = EV.Game;
    if (!on || !g || !g.started || g.paused || !g.player || !g.player.alive) return;
    const P = g.player;
    const t = pickTarget(P);
    if (t !== P.lockTarget) P.lockTarget = t;
    if (!t || now - EV.MobileBridge.lastLookAt < MANUAL_MS) return;
    const pos = P.group.position, tp = t.group.position;
    const want = Math.atan2(tp.x - pos.x, tp.z - pos.z);
    P.yaw = U.approachAngle(P.yaw, want, dt * CAM_TURN);
  }
  requestAnimationFrame(tick);

  function toggle() {
    on = !on;
    try { localStorage.setItem(STORE, on ? '1' : '0'); } catch (e) { /* gizli sekme */ }
    const g = EV.Game;
    if (!on && g && g.player) g.player.lockTarget = null;
    if (g && g.toast) g.toast(on ? '🤖 Otomatik hedef AÇIK' : 'Otomatik hedef kapalı', on ? '#9de89d' : '#ffb35a', 1400);
    return on;
  }

  return { toggle, isOn: () => on };
})();
