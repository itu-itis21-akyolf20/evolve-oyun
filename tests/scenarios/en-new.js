// Yeni düşman türleri: her davranış gerçekten çalışıyor mu (uçma/dalış, patlama, şifa, çağırma,
// sıçrama, pusu, bölünme, hazine kaçışı, şampiyon, IV/V seviye) — hata yok mu
T.start('normal');
const G = EV.Game, P = G.player;
const clear = () => G.enemies.slice().forEach((e) => { if (e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
const out = {};
const toStage = (s) => { G.stageIndex = s; G.evo = 0; G.startStage(false); T.sim(0.5, { dt: 1 / 30, bot: false }); };

for (let s = 0; s < 3; s++) {
  toStage(s);
  const pool = EV.MOBS.ENEMIES[s];
  const res = {};
  for (const def of pool) {
    clear();
    P.hp = P.stats.maxHp; P.iframe = 0;
    const pp = P.group.position;
    const sc = EV.Enemies.statScale(G, 'normal');
    const e = EV.Enemies.make(G, def, { pos: { x: pp.x + 9, z: pp.z + 3 }, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg });
    e.aggroT = 20;
    const r = { beh: def.behavior };
    let maxFly = 0, dive = false, hop = false, fused = false, healed = false, kids = 0, revealed = false, far0 = null, farMax = 0;
    // şifacı için yaralı bir dost
    let buddy = null;
    if (def.behavior === 'healer') {
      buddy = EV.Enemies.make(G, pool[0], { pos: { x: pp.x + 11, z: pp.z + 4 }, hp: 100, dmg: 1 });
      buddy.hp = 30; buddy.behavior = 'passive'; buddy.speed = 0;
    }
    T.sim(12, { dt: 1 / 30, bot: false, until: () => {
      if (!e.alive) return true;
      maxFly = Math.max(maxFly, e.flyNow || 0);
      if (e.diveT > 0) dive = true;
      if (e.hopT > 0) hop = true;
      if (e.fused) fused = true;
      if (buddy && buddy.hp > 30) healed = true;
      kids = Math.max(kids, e.children || 0);
      if (def.behavior === 'ambush' && !e.ambushing) revealed = true;
      const d = e.group.position.distanceTo(P.group.position);
      if (far0 == null) far0 = d;
      farMax = Math.max(farMax, d);
      P.hp = P.stats.maxHp;                                   // oyuncu ölmesin, davranışı görelim
      return false;
    } });
    if (def.fly) r.fly = +maxFly.toFixed(1) + (dive ? ' dalış✓' : ' dalış✗');
    if (def.behavior === 'bomber') r.fuse = fused || !e.alive ? '✓' : '✗';
    if (def.behavior === 'healer') r.heal = healed ? '✓' : '✗';
    if (def.behavior === 'summoner') r.summon = kids > 0 ? kids : '✗';
    if (def.behavior === 'hopper') r.hop = hop ? '✓' : '✗';
    if (def.behavior === 'ambush') r.ambush = revealed ? '✓' : '✗';
    if (def.behavior === 'treasure') r.flee = +(farMax - far0).toFixed(1);
    if (def.splitInto) {
      const before = G.enemies.filter((x) => x.alive && x.def.id === def.splitInto.id).length;
      if (e.alive) G.killEnemy(e);
      r.split = G.enemies.filter((x) => x.alive && x.def.id === def.splitInto.id).length - before;
    }
    res[def.id] = r;
  }
  // hazine
  clear();
  const tr = EV.Enemies.spawnTreasure(G);
  const d0 = tr.group.position.distanceTo(P.group.position);
  T.sim(6, { dt: 1 / 30, bot: false });
  res.treasure = { fled: +(tr.group.position.distanceTo(P.group.position) - d0).toFixed(1), life: +tr.life.toFixed(1) };
  out['stage' + s] = res;
}

// şampiyon + IV/V seviye (nesil 2)
G.generation = 2;
G.build.level = 12;
clear();
let champs = 0, v = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, names = [];
for (let i = 0; i < 120; i++) {
  const list = EV.Enemies.spawnPack(G);
  list.forEach((e) => { v[e.variant]++; if (e.isChampion) { champs++; if (names.length < 4) names.push(e.name); } });
  clear();
}
out.gen2 = { variants: v, champions: champs, sample: names, target: EV.Enemies.maintain ? 'ok' : '' };
G.generation = 0;
return out;
