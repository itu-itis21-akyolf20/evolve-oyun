// Mobil yumuşak hedefleme: öndeki seçilir (arkadaki değil), saldırısız 3 sn'de bırakılır,
// kamera zorla dönmez; 🔒 sert kilit kamerayı çevirir, hedef ölünce bırakır; arkadan saldırı oku
const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(() => window.EV && EV.Game && EV.MobileAssist && document.getElementById('mTouch'), 15000);
T.start('normal');
const G = EV.Game, P = G.player, root = document.getElementById('mTouch');
const def = EV.MOBS.ENEMIES[0][1];
const clear = () => G.enemies.slice().forEach((e) => { if (!e.ally && e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
const pp = P.group.position;
const at = (ang, d) => { const e = EV.Enemies.make(G, def, { pos: { x: pp.x + Math.sin(ang) * d, z: pp.z + Math.cos(ang) * d }, hp: 1e6, dmg: 0 }); e.behavior = 'passive'; e.speed = 0; return e; };
let tid = 100;
const tap = (sel, hold) => { const b = root.querySelector(sel); const t = new Touch({ identifier: ++tid, target: b, clientX: 0, clientY: 0 });
  b.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [t], touches: [t], bubbles: true, cancelable: true }));
  return () => b.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], touches: [], bubbles: true, cancelable: true })); };
const r = {};

clear();
const face = P.group.rotation.y;
const front = at(face, 14);          // önde, uzakça
const back = at(face + Math.PI, 6);  // arkada, daha yakın
await sleep(300);
r.noLockBeforeAttack = P.lockTarget == null;
const yaw0 = P.yaw;
let up = tap('.mAtk'); await sleep(150); up();
r.picksFrontNotCloserBehind = P.lockTarget === front;
await sleep(800);
r.cameraNotForced = Math.abs(EV.U.wrapAngle(P.yaw - yaw0)) < 0.2;
await sleep(2600);
r.releasedAfter3s = P.lockTarget == null;

// sert kilit: arkadakine kamera döner, ölünce bırakır ve başkasına atlamaz
P.lockTarget = back;
tap('.mAtk')();                      // hedef zaten 'back' (sticky) — yine de kilit butonu mevcut hedefi alır
P.lockTarget = back;
tap('[data-a="hardlock"]')();
r.hardOn = EV.MobileAssist.hardTarget() === back && root.querySelector('[data-a="hardlock"]').classList.contains('active');
await sleep(1500);
const want = Math.atan2(back.group.position.x - pp.x, back.group.position.z - pp.z);
r.hardTurnsCamera = Math.abs(EV.U.wrapAngle(P.yaw - want)) < 0.35;
G.killEnemy(back);
await sleep(200);
r.hardReleasedOnDeath = EV.MobileAssist.hardTarget() == null && P.lockTarget !== front;

// arkadan saldırı: ekran dışı ok
clear();
const sneaky = at(P.yaw + Math.PI, 5);
sneaky.atkTarget = P; sneaky.atkT = 5; sneaky.behavior = 'aggressive';
await sleep(300);
r.threatArrow = Array.from(document.querySelectorAll('.mThreat')).some((a) => !a.hidden);
return r;
