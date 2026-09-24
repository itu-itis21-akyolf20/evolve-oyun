/* ============================================================
   pickups.js — toplanabilirler

   EVO kristali: ölen yaratıktan düşer (EVO + XP). Vampire Survivors
     mantığı: savaşın ortasına dalıp toplamak bir karar.
   Besin: ortamda dolaşan küçük küreler (biraz XP + enerji).
   Toplama menzili içindekiler oyuncuya uçar.
   ============================================================ */
window.EV = window.EV || {};

EV.Pickups = (function () {
  'use strict';

  const T = EV.CFG.TUNE;
  const U = EV.U;
  const W = EV.World;
  const MAX_GEMS = 140;
  const geo = new THREE.OctahedronGeometry(1, 0);
  const items = [];
  let gems = 0;

  function add(game, x, z, o) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: o.color, emissive: o.emissive }));
    m.scale.setScalar(o.size);
    m.position.set(x, W.groundY(x, z) + 0.7, z);
    game.scene.add(m);
    const it = Object.assign({ mesh: m, t: U.rand(0, 6), life: o.life || 90, flying: false }, o);
    items.push(it);
    if (it.kind === 'gem') gems++;
    return it;
  }

  /** Ölen yaratıktan kristal düşürür; çok birikirse en yakındakine ekler. */
  function drop(game, pos, evo, xp) {
    if (evo <= 0 && xp <= 0) return;
    if (gems >= MAX_GEMS) {
      let best = null, bd = Infinity;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind !== 'gem') continue;
        const d = it.mesh.position.distanceToSquared(pos);
        if (d < bd) { bd = d; best = it; }
      }
      if (best) { best.evo += evo; best.xp += xp; best.mesh.scale.setScalar(Math.min(0.9, best.mesh.scale.x + 0.03)); return; }
    }
    const big = evo > 60;
    add(game, pos.x + U.rand(-0.6, 0.6), pos.z + U.rand(-0.6, 0.6), {
      kind: 'gem', evo, xp, energy: 0,
      color: big ? 0xffd23d : 0x7dff8a, emissive: big ? 0x6a4a00 : 0x1a6a2a,
      size: big ? 0.5 : 0.34, life: 120,
    });
  }

  function spawnFood(game) {
    const s = W.randomSpawn(game.player.group.position, 10, T.spawnMax, 0.5);
    add(game, s.x, s.z, {
      kind: 'food', evo: T.foodEvo, xp: T.foodXp, energy: T.foodEnergy,
      color: 0x7fe3ff, emissive: 0x1d6ea8, size: 0.4, life: 120,
    });
  }

  function remove(game, i) {
    const it = items[i];
    game.scene.remove(it.mesh);
    it.mesh.material.dispose();
    if (it.kind === 'gem') gems--;
    items.splice(i, 1);
  }

  function update(game, dt) {
    const P = game.player;
    const p = P.group.position;
    const reach = P.stats.pickup;
    let food = 0;

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt;
      it.life -= dt;
      const m = it.mesh;
      m.rotation.y += dt * 1.8;
      const d = m.position.distanceTo(p);
      if (it.life <= 0 || d > T.despawn + 10) { remove(game, i); continue; }
      if (it.kind === 'food') food++;

      if (P.alive && (it.flying || d < reach)) {
        it.flying = true;
        const target = p.clone(); target.y += 1;
        m.position.lerp(target, Math.min(1, dt * (8 + it.t)));
      } else {
        m.position.y = W.groundY(m.position.x, m.position.z) + 0.7 + Math.sin(it.t * 2.2) * 0.2;
      }
      if (P.alive && d < 1.5) {
        game.gainEvo(it.evo, it.xp);
        if (it.energy) game.addEnergy(it.energy);
        U.audio.eat();
        remove(game, i);
      }
    }

    if (food < T.maxFood) {
      game.foodTimer -= dt;
      if (game.foodTimer <= 0) { spawnFood(game); game.foodTimer = 0.4; }
    }
  }

  function clear(game) { for (let i = items.length - 1; i >= 0; i--) remove(game, i); }

  return { drop, update, clear, spawnFood, get count() { return items.length; } };
})();
