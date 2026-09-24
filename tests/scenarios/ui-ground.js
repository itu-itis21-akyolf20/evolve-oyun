// UI test: hold-to-aim ground skills (zone c_acid, leap r_ambush), cancel, stuck state
T.start('normal');
const G = EV.Game, P = G.player, I = EV.Input, W = EV.World;
const step = (n) => { for (let i = 0; i < n; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); } };
const setup = () => { EV.Enemies.clearAll(G); G.spawnTimer = 1e9; G.apexTimer = 1e9; G.build.picks = 0; P.iframe = 1e9; };
const indicator = () => G.scene.children.filter((c) => c.isMesh && c.renderOrder === 5 && c.material.color.getHex() === 0x7fd9ff);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const out = {};
function testSkill(id, slotKey) {
  const r = {};
  setup();
  G.build.skills = [{ id, rank: 1, cd: 0 }]; EV.UI.buildSkillbar(G);
  const p = EV.DATA.params(EV.DATA.skill(id), 1);
  P.group.position.set(3, W.groundY(3, 3), 3); P.vel.set(0,0,0);
  // aim far: pitch low so aim point is beyond castRange
  P.yaw = 0.4; P.pitch = 0.12; step(2);
  r.aimDistFromPlayer = +flat(P.aimPoint, P.group.position).toFixed(1);
  r.castRange = p.castRange;
  P.energy = 999;
  I._press(slotKey); step(1); step(5);
  const ind = indicator();
  r.aimingWhileHeld = !!P.aiming; r.indicatorMeshes = ind.length;
  const area = ind.find((m) => m.geometry.parameters && m.geometry.parameters.innerRadius < 0.01) || ind[1];
  r.areaDistFromPlayer = area ? +flat(area.position, P.group.position).toFixed(2) : null;
  // indicator hugging terrain: max |vertex y - terrain| around area
  if (area) { const pos = area.geometry.attributes.position; let worst = 0; for (let i = 0; i < pos.count; i += 7) { const wx = area.position.x + pos.getX(i), wz = area.position.z + pos.getZ(i); worst = Math.max(worst, Math.abs(pos.getY(i) - W.height(wx, wz) - 0.2)); } r.areaTerrainErr = +worst.toFixed(3); }
  const expected = area ? area.position.clone() : null;
  const z0 = EV.Skills.counts.zones, p0 = P.group.position.clone();
  I._release(slotKey); step(1);
  r.indicatorAfterRelease = indicator().length; r.aimingAfterRelease = !!P.aiming;
  r.cd = +G.build.skills[0].cd.toFixed(2);
  if (id === 'r_ambush') { step(40); r.landDistFromIndicator = expected ? +flat(P.group.position, expected).toFixed(2) : null; r.leapTravel = +flat(P.group.position, p0).toFixed(2); }
  else { r.zonesSpawned = EV.Skills.counts.zones - z0; }
  // cancel with right mouse
  G.build.skills[0].cd = 0; P.energy = 999; step(2);
  I._press(slotKey); step(3);
  I.mouse.rightPressed = true; I.mouse.right = true; step(1); I.mouse.right = false;
  r.cancelRight = { aiming: !!P.aiming, indicator: indicator().length };
  I._release(slotKey); step(1);
  r.cancelRight.castAnyway = G.build.skills[0].cd > 0;
  // cancel with Escape
  G.build.skills[0].cd = 0; step(2);
  I._press(slotKey); step(3); I._press('Escape'); step(1);
  r.cancelEsc = { aiming: !!P.aiming, indicator: indicator().length };
  I._release(slotKey); I._release('Escape'); step(1);
  r.cancelEsc.castAnyway = G.build.skills[0].cd > 0;
  // stuck: hold key, window blur (alt-tab / pointer lock loss) -> keyup never seen
  G.build.skills[0].cd = 0; step(2);
  I._press(slotKey); step(3);
  window.dispatchEvent(new Event('blur')); step(10);
  r.afterBlur = { aiming: !!P.aiming, indicator: indicator().length };
  const cb = P.basicCd; I.mouse.left = true; step(20); I.mouse.left = false;
  r.afterBlur.basicAttackBlocked = P.comboT <= 0 && P.basicCd <= 0;
  // pause (e.g. pointer lock lost / Tab) while holding
  I._press('Escape'); step(1); // clear
  G.build.skills[0].cd = 0; step(2);
  I._press(slotKey); step(3); G.pause(); I._release(slotKey); I.endFrame(); G.paused = false; step(3);
  r.afterPauseRelease = { aiming: !!P.aiming, indicator: indicator().length, cast: G.build.skills[0].cd > 0 };
  I._press('Escape'); step(1);
  return r;
}
out.c_acid = testSkill('c_acid', 'KeyQ');
G.stageIndex = 1; G.startStage(false); T.handleModals({ pick: 'first' }); G.paused = false;
out.r_ambush = testSkill('r_ambush', 'KeyQ');
// screenshot: hold indicator on a slope
setup(); G.build.skills = [{ id: 'c_acid', rank: 1, cd: 0 }]; EV.UI.buildSkillbar(G);
P.group.position.set(-20, W.groundY(-20, 30), 30); P.yaw = 0.9; P.pitch = 0.3; step(3);
I._press('KeyQ'); step(4);
G.paused = true;
return out;
