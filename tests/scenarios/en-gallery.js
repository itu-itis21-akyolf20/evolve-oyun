// Galeri: bir aşamanın yeni yaratıklarını kameranın önüne dizer (ekran görüntüsü için)
const STAGE = window.__stage || 0;
const IDS = [['virus', 'jelly', 'colony', 'symbiote', 'spiro', 'colonyling'], ['ptero', 'frog', 'croc', 'shaman', 'brood', 'serpent'], ['bat', 'eagle', 'skunk', 'whitedeer', 'hyena', 'mammoth']][STAGE];
T.start('normal');
const G = EV.Game, P = G.player;
G.stageIndex = STAGE; G.startStage(false); T.sim(0.3, { dt: 1 / 30, bot: false });
G.enemies.slice().forEach((e) => { if (e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
const pp = P.group.position, yaw = P.yaw;
const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
IDS.forEach((id, i) => {
  const d = EV.MOBS.find(STAGE, id);
  const off = (i - (IDS.length - 1) / 2) * (STAGE === 2 ? 5 : STAGE === 1 ? 4 : 3);
  const e = EV.Enemies.make(G, d, { pos: { x: pp.x + fx * 13 + rx * off, z: pp.z + fz * 13 + rz * off }, hp: 1e6, dmg: 0 });
  e.behavior = 'passive'; e.speed = 0; e.ambushing = false;
  e.group.rotation.y = yaw + Math.PI + 0.5;
});
G.enemies.forEach((e) => { if (e.def.id === 'croc') e.group.traverse((o) => { if (o.material && !o.isSprite && o.userData.op0 != null) o.material.opacity = o.userData.op0; }); });
P.group.visible = false;
T.sim(0.4, { dt: 1 / 30, bot: false, until: () => { G.enemies.forEach((e) => { e.speed = 0; }); return false; } });
G.paused = true;
document.getElementById('hud').style.display = 'none';
await new Promise((r) => setTimeout(r, 400));
return G.enemies.map((e) => e.name);
