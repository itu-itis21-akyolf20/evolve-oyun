/* ============================================================
   main.js — oyun nesnesi, aşama akışı, ödüller, ölüm, kayıt, döngü

   Akış:
     zorluk seç → aşama başlar → başlangıç kartı → avlan, kristal topla
     → her seviyede kart → EVO dolunca Alfa → Alfa düşer → evrim ekranı
     (gen seç, parçalar ve yankı geçer) → sonraki aşama (her şey sıfır,
     genler/parçalar/yankılar kalır) → … → sonsuz nesiller
   ============================================================ */
window.EV = window.EV || {};

(function () {
  'use strict';

  const CFG = EV.CFG;
  const T = CFG.TUNE;
  const U = EV.U;
  const SAVE_KEY = 'evolve_save_v4';   // v4: kart/gen sistemi — eski kayıtlarla uyumsuz

  const Game = {
    scene: null, camera: null, renderer: null, canvas: null, clock: null, time: 0,
    player: null, enemies: [], stageIndex: 0, generation: 0, evo: 0, kills: 0,
    build: null, legacy: null, inv: null, diff: CFG.DIFFICULTY.normal,
    stats: { totalDmg: 0, maxHit: 0 },
    boss: null, bossActive: false, apex: null, apexTimer: 40, pendingStage: false,
    paused: true, started: false, spawnTimer: 0, foodTimer: 0, hadLock: false,

    /* ---------------- aşama bilgisi ---------------- */
    stage() { return CFG.STAGES[Math.min(this.stageIndex, CFG.STAGES.length - 1)]; },
    isEndless() { return this.generation > 0; },
    stageDisplayName() { return this.isEndless() ? CFG.ENDLESS.name : this.stage().name; },
    creatureTitle() {
      return this.isEndless() ? CFG.ENDLESS.name + ' · Nesil ' + (this.generation + 1) : this.stage().title;
    },
    evoMax() {
      if (!this.isEndless()) return this.stage().evoMax;
      return Math.round(CFG.ENDLESS.evoMax * Math.pow(CFG.ENDLESS.evoGrowth, this.generation - 1));
    },
    genMul() { return Math.pow(CFG.ENDLESS.playerGrowth, this.generation); },
    maxHp() { return this.player.stats.maxHp; },
    playerDamage() { return this.player.stats.dmg; },

    /* ---------------- oyuncu kaynakları ---------------- */
    healPlayer(n) {
      const P = this.player;
      if (!P.alive || !(n > 0)) return;
      P.hp = Math.min(P.stats.maxHp, P.hp + n);
    },
    addEnergy(n) { const P = this.player; P.energy = Math.min(P.stats.maxEnergy, P.energy + n); },
    addRage(n) {
      const P = this.player;
      P.rage = Math.min(T.rageMax, P.rage + n * P.stats.rageGain);
      P.lastCombatT = this.time;
    },
    addBuff(b) {
      const P = this.player;
      const i = P.buffs.findIndex((x) => x.id === b.id);
      if (i >= 0) P.buffs[i] = b; else P.buffs.push(b);
    },
    toast(t, c, ms) { EV.UI.toast(t, c, ms); },

    /* ---------------- ödüller ---------------- */
    gainEvo(evo, xp, atPos) {
      const P = this.player;
      const b = this.build;
      if (evo > 0) this.evo = Math.min(this.evoMax(), this.evo + evo);
      if (xp > 0) {
        b.xp += xp * P.stats.xpGain;
        let need = EV.Build.xpNeed(this);
        while (b.xp >= need) {
          b.xp -= need;
          b.level++;
          b.picks++;
          EV.Build.recompute(this);
          this.healPlayer(P.stats.maxHp * 0.15);
          EV.FX.ring(P.group.position, 0x7dff8a, 8, 0.6);
          need = EV.Build.xpNeed(this);
        }
      }
      if (atPos && evo > 0) {
        const p = atPos.clone(); p.y += 2;
        EV.UI.dmgNumber(p, '+' + U.fmt(evo) + ' EVO', 'evo', this.camera);
      }
      if (this.evo >= this.evoMax() && !this.bossActive && !this.pendingStage) {
        EV.Enemies.spawnAlpha(this);
        EV.UI.toast('ALFA UYANDI<br><span class="sub">Yerdeki kırmızı alanlardan kaç, açık bul, vur</span>', '#ff8a8a', 3200);
      }
    },

    killEnemy(e) {
      if (!e.alive) return;
      e.alive = false;
      EV.Status.onDeath(this, e);
      EV.Decal.cancelOwner(e);
      const pos = e.group.position;
      EV.FX.burst(pos.clone().setY(pos.y + 1), (e.def.body && e.def.body.body) || 0xffffff, e.isAlpha ? 36 : 12, e.isAlpha ? 16 : 8);
      U.audio.die();
      if (this.player.lockTarget === e) this.player.lockTarget = null;
      if (e.ally) return;
      this.kills++;
      EV.Items.onKill(this, e);
      this.addRage(5);

      const scale = (1 + 0.03 * (this.build.level - 1)) * Math.pow(CFG.ENDLESS.evoGrowth, this.generation);
      if (e.isApex) {
        this.apex = null;
        this.apexTimer = U.rand(150, 210) * this.diff.apexTimer;
        this.gainEvo(Math.round(e.evo * scale), Math.round(EV.Build.xpNeed(this) * 1.5), pos);
        EV.UI.toast('☠️ ' + e.name.toLocaleUpperCase('tr-TR') + ' DEVRİLDİ', '#ffd83d', 3000);
        U.audio.evolve();
      } else if (e.isAlpha) {
        this.gainEvo(0, e.xp, null);
        this.onAlphaDefeated(e);
      } else {
        EV.Pickups.drop(this, pos, Math.round(e.evo * scale), Math.round(e.xp * scale));
      }
    },

    onReaction(R) {
      const L = this.legacy;
      if (L.combos[R.id]) return;
      L.combos[R.id] = true;
      EV.UI.toast('✨ YENİ KOMBO: ' + R.name + '<br><span class="sub">' +
        CFG.STATUS[R.a].name + ' + ' + CFG.STATUS[R.b].name + ' — ' + R.desc + '</span>', R.color, 3500);
    },

    /* ---------------- aşama geçişi ---------------- */
    onAlphaDefeated() {
      // Bu çağrı hasar döngülerinin içinden gelir: dünyayı burada yıkmıyoruz.
      this.bossActive = false;
      this.boss = null;
      this.pendingStage = true;
      EV.UI.updateBoss(this, this.camera);
      const offer = EV.Build.evolveOffer(this);
      const last = this.stageIndex >= CFG.STAGES.length - 1;
      const next = last ? null : CFG.STAGES[this.stageIndex + 1];
      U.audio.evolve();
      this.pause();
      // Modal hemen açılır (DOM işi, dünyaya dokunmaz). Eskiden setTimeout ile
      // geciktiriliyordu; o aralıkta pendingStage takılı kalıp kart ve Alfa
      // akışını kilitleyebiliyordu. Dünyayı yeniden kurmak seçimden SONRA olur.
      EV.Cards.openEvolve(this, offer,
        last ? 'YENİ NESİL — ' + (this.generation + 2) : 'EVRİM: ' + next.name.toLocaleUpperCase('tr-TR'),
        last ? 'Alfa düştü. Yeni bir nesil, daha sert bir dünya. Yetenekler sıfırlanır; genler kalır.'
             : next.intro + '<br><b>Yetenekler ve pasifler sıfırlanır</b> — genler, parçalar ve yankılar seninle gelir.',
        (geneId) => {
          EV.Build.applyEvolution(this, offer, geneId);
          setTimeout(() => EV.Online.submit(this, true), 0);
          if (last) this.generation++; else this.stageIndex++;
          this.evo = 0;
          this.pendingStage = false;
          this.startStage(false);
        });
    },

    /** Dünyayı kurar, yapıyı (istenirse) sıfırlar, başlangıç kartını açar. */
    startStage(keepBuild) {
      const st = this.stage();
      EV.Enemies.clearAll(this);
      EV.Pickups.clear(this);
      EV.Mating.clearAll(this);
      EV.Skills.clear();
      EV.Decal.clear();
      EV.Boss.clear();
      EV.FX.clear();
      EV.Decal.hideIndicator();
      this.boss = null;
      this.bossActive = false;
      this.apex = null;
      const ad = EV.MOBS.APEX[Math.min(this.stageIndex, EV.MOBS.APEX.length - 1)];
      this.apexTimer = U.rand(ad.first[0], ad.first[1]) * this.diff.apexTimer;

      EV.Items.clear(this);
      document.getElementById('deathPanel').hidden = true;
      EV.World.applyStage(st);
      EV.Items.spawnChests(this);
      if (!keepBuild) EV.Build.newRun(this);
      else EV.Build.recompute(this);

      const P = this.player;
      const s = EV.World.randomSpawn({ x: 0, z: 0 }, 0, 8, 2);
      if (!P.group) EV.Player.rebuild(this);
      P.group.position.set(s.x, EV.World.groundY(s.x, s.z), s.z);
      EV.Player.rebuild(this);
      Object.assign(P, { alive: true, dash: null, leap: null, leapY: 0, hunt: null, aiming: null,
        lockTarget: null, hover: null, buffs: [], shield: 0, st: null, iframe: 1.5 });
      P.stats = EV.Build.stats(this, null);
      if (!keepBuild) { P.hp = P.stats.maxHp; P.energy = P.stats.maxEnergy; P.rage = 0; }
      P.vel.set(0, 0, 0);
      P.impulse.set(0, 0, 0);

      EV.Enemies.seed(this);
      EV.UI.buildSkillbar(this);
      EV.UI.refresh(this);
      if (!keepBuild) this.save();          // yüklemede can/enerji geri yüklendikten sonra kaydedilir

      if (!keepBuild || !this.build.skills.length) {
        this.pause();
        EV.Cards.openLevel(this, {
          title: this.stageDisplayName().toLocaleUpperCase('tr-TR') + ' BAŞLIYOR',
          sub: 'Başlangıç yeteneğini seç — <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>',
          cards: EV.Build.roll(this, 3, 'skill'),
          onlyType: 'skill',
          onPick: (c) => { EV.Build.apply(this, c); this.resume(); },
        });
      } else {
        this.resume();
      }
    },

    /** Bekleyen seviye kartlarını sırayla açar. */
    openNextPick() {
      const b = this.build;
      if (b.picks <= 0 || EV.Cards.isOpen() || this.pendingStage || !this.player.alive) return;
      this.pause();
      EV.Cards.openLevel(this, {
        title: 'SEVİYE ' + (b.level - b.picks + 1),
        cards: EV.Build.roll(this, 3),
        onPick: (c) => {
          EV.Build.apply(this, c);
          b.picks--;
          this.save();
          if (b.picks > 0) this.openNextPick(); else this.resume();
        },
      });
    },

    /* ---------------- ölüm ---------------- */
    onDeath() {
      const P = this.player;
      if (!P.alive || this.pendingStage) return;   // Alfa aynı karede öldüyse zafer sayılır
      P.alive = false;
      P.hp = 0;
      EV.FX.burst(P.group.position.clone().setY(P.group.position.y + 1), 0xff4d4d, 26, 12);
      this.pause();

      const lossEvo = Math.floor(this.evo * this.diff.deathEvoLoss);
      this.evo -= lossEvo;
      let lostCard = null;
      if (this.diff.deathCardLoss) lostCard = EV.Build.rollback(this);
      EV.Online.submit(this, true);

      EV.UI.refresh(this);
      EV.UI.showDeath(
        this.creatureTitle() + ' · Sv ' + this.build.level + '<br>' +
        (lossEvo > 0 ? '<b>-' + U.fmt(lossEvo) + ' EVO</b>' : 'EVO kaybı yok') + (lostCard ? '<br>Kaybedilen kart: <b>' + lostCard + '</b>' : '') +
        '<br><br><span style="font-size:12px">Olduğun yerde, kısa bir dokunulmazlıkla kalkarsın.</span>',
        () => this.respawn());
      this.save();
    },

    respawn() {
      const P = this.player;
      P.alive = true;
      P.stats = EV.Build.stats(this, null);
      P.hp = P.stats.maxHp;
      P.energy = P.stats.maxEnergy;
      P.st = null;
      P.iframe = 3;
      P.dash = P.leap = P.hunt = null;
      P.aiming = null;
      P.leapY = 0;
      const p = P.group.position;
      // yakındaki sıradan yaratıkları it; boss biraz toparlanır; apex uzaktaysa kalır
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (!e.alive || e.ally) continue;
        if (e.isAlpha) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * this.diff.bossHeal); continue; }
        const d = e.group.position.distanceTo(p);
        if (e.isApex && d < 30) {
          EV.Enemies.despawn(this, i);
          this.apex = null;
          this.apexTimer = U.rand(30, 45) * this.diff.apexTimer;
        } else if (d < 14) {
          const dx = e.group.position.x - p.x, dz = e.group.position.z - p.z, l = Math.hypot(dx, dz) || 1;
          e.knock.set(dx / l * 30, 0, dz / l * 30);
          e.aggroT = 0;
        }
      }
      EV.FX.ring(p, 0x9de89d, 14, 0.8);
      EV.UI.buildSkillbar(this);
      this.resume();
    },

    /* ---------------- duraklat / sürdür ---------------- */
    pause() {
      this.paused = true;
      if (this.player) this.player.aiming = null;
      EV.Input.releaseLock();
      EV.Decal.hideIndicator();
    },
    resume() {
      if (EV.Cards.isOpen() || EV.Inv.isOpen() || EV.Online.isOpen() || !this.player.alive) return;
      this.paused = false;
      EV.UI.setLockHint(false);
      EV.Input.requestLock();
    },

    /* ---------------- kayıt ---------------- */
    save() {
      if (!this.started || !this.build) return;
      try {
        const b = this.build, P = this.player;
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: 4, diff: this.diff.id, stageIndex: this.stageIndex, generation: this.generation,
          evo: this.evo, kills: this.kills, legacy: this.legacy, inv: EV.Items.serialize(this.inv),
          stats: { totalDmg: this.stats.totalDmg, maxHit: this.stats.maxHit },
          build: { level: b.level, xp: b.xp, skills: b.skills.map((s) => ({ id: s.id, rank: s.rank, fused: !!s.fused })),
            ult: b.ult ? { id: b.ult.id, rank: b.ult.rank } : null, passives: b.passives, rerolls: b.rerolls, uses: b.uses, picks: b.picks,
            history: b.history.slice(-12) },
          hp: P.hp, energy: P.energy, rage: P.rage,
        }));
        EV.UI.savedBlink();
      } catch (err) { console.warn('Kayıt yazılamadı:', err); }
    },

    loadRaw() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        const d = raw ? JSON.parse(raw) : null;
        return d && d.v === 4 ? d : null;
      } catch (err) { console.warn('Kayıt okunamadı:', err); return null; }
    },

    /** Kaydı doğrulayarak uygular: bilinmeyen kimlikleri atar, sayıları kırpar. */
    applySave(d) {
      const DATA = EV.DATA;
      const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
      const arr = (x) => (Array.isArray(x) ? x : []);   // yanlış tipli alan tüm kaydı silmesin
      this.diff = CFG.DIFFICULTY[d.diff] || CFG.DIFFICULTY.normal;
      this.stageIndex = U.clamp(num(d.stageIndex, 0) | 0, 0, CFG.STAGES.length - 1);
      this.generation = U.clamp(num(d.generation, 0) | 0, 0, 200);
      this.kills = Math.max(0, num(d.kills, 0));
      const st = d.stats && typeof d.stats === 'object' ? d.stats : {};
      this.stats = { totalDmg: U.clamp(num(st.totalDmg, 0), 0, 1e15), maxHit: U.clamp(num(st.maxHit, 0), 0, 1e13) };
      const lg = d.legacy || {};
      this.legacy = {
        genes: arr(lg.genes).filter((id) => DATA.gene(id)),
        parts: arr(lg.parts).filter((t) => DATA.partFor(t)),
        echoes: arr(lg.echoes).filter((e) => e && DATA.skill(e.id)).map((e) => ({ id: e.id, rank: U.clamp(e.rank | 0, 1, 5), t: 3 })),
        combos: lg.combos && typeof lg.combos === 'object' ? lg.combos : {},
      };
      this.inv = EV.Items.deserialize(d.inv);
      this.build = EV.Build.freshRun(this);
      const sb = d.build || {};
      const b = this.build;
      b.level = U.clamp(num(sb.level, 1) | 0, 1, 80);
      b.xp = Math.max(0, num(sb.xp, 0));
      b.skills = arr(sb.skills).filter((s) => s && DATA.skill(s.id)).slice(0, T.maxActives)
        .map((s) => ({ id: s.id, rank: U.clamp(s.rank | 0, 1, 5), cd: 0, fused: !!DATA.fusion(s.id) }));
      b.ult = sb.ult && DATA.skill(sb.ult.id) ? { id: sb.ult.id, rank: U.clamp(sb.ult.rank | 0, 1, 5), cd: 0 } : null;
      b.passives = arr(sb.passives).filter((p) => p && DATA.passive(p.id)).slice(0, T.maxPassives)
        .map((p) => ({ id: p.id, rank: U.clamp(p.rank | 0, 1, DATA.passive(p.id).max) }));
      b.rerolls = U.clamp(num(sb.rerolls, this.diff.rerolls) | 0, 0, 9);
      b.uses = sb.uses && typeof sb.uses === 'object' ? sb.uses : {};
      b.picks = U.clamp(num(sb.picks, 0) | 0, 0, 20);
      b.history = Array.isArray(sb.history) ? sb.history.filter((h) => h && h.undo && typeof h.undo.type === 'string') : [];
      this.evo = U.clamp(num(d.evo, 0), 0, this.evoMax() - 1);
      this.startStage(true);
      const P = this.player;
      P.hp = U.clamp(num(d.hp, P.stats.maxHp), 1, P.stats.maxHp);
      P.energy = U.clamp(num(d.energy, 0), 0, P.stats.maxEnergy);
      P.rage = U.clamp(num(d.rage, 0), 0, T.rageMax);
      this.save();
    },

    newGame(diffId) {
      EV.Items.clear(this, true);   // önceki oyunun yerdeki eşyaları yeni oyuna taşınmasın
      this.diff = CFG.DIFFICULTY[diffId] || CFG.DIFFICULTY.normal;
      this.stageIndex = 0;
      this.generation = 0;
      this.evo = 0;
      this.kills = 0;
      this.stats = { totalDmg: 0, maxHit: 0 };
      this.legacy = EV.Build.freshLegacy();
      this.inv = EV.Items.freshInv();
      this.build = EV.Build.freshRun(this);
      this.startStage(false);
    },

    cleanupDead() {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (!this.enemies[i].alive) EV.Enemies.despawn(this, i);
      }
    },
  };

  /* =========================================================
     Kurulum
     ========================================================= */
  function boot() {
    Game.canvas = document.getElementById('scene');
    Game.renderer = new THREE.WebGLRenderer({ canvas: Game.canvas, antialias: true, powerPreference: 'high-performance' });
    // HiDPI dizüstülerde 2x + MSAA ≈ 4K çizim: tümleşik GPU'da 60fps altına düşürüyordu
    Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    Game.renderer.setSize(window.innerWidth, window.innerHeight);
    Game.scene = new THREE.Scene();
    Game.camera = new THREE.PerspectiveCamera(T.fov, window.innerWidth / window.innerHeight, 0.3, 420);
    Game.clock = new THREE.Clock();

    EV.World.init(Game.scene);
    EV.FX.init(Game.scene);
    EV.Decal.init(Game.scene);
    EV.Skills.init(Game.scene);
    EV.Boss.setup(Game.scene);
    EV.UI.init();

    // menü arkasında dünya görünsün
    Game.legacy = EV.Build.freshLegacy();
    Game.inv = EV.Items.freshInv();
    Game.build = EV.Build.freshRun(Game);
    Game.player = EV.Player.create(Game);
    EV.World.applyStage(Game.stage());
    EV.Player.rebuild(Game);
    Game.player.stats = EV.Build.stats(Game, null);
    Game.player.hp = Game.player.stats.maxHp;

    // Fare kilidi kopunca: modal yoksa ve oyuncu hayattaysa "tıkla" ipucu gösterilir
    // (eskiden duraklatılmışken ipucu gizleniyordu: Esc sonrası donuk, ipucusuz ekran).
    EV.Input.init(Game.canvas, (locked) => {
      if (locked) { Game.hadLock = true; EV.UI.setLockHint(false); return; }
      if (!Game.started) return;
      const modal = EV.Cards.isOpen() || EV.Inv.isOpen() || !document.getElementById('deathPanel').hidden;
      if (!modal && Game.player.alive) {
        if (Game.hadLock) Game.paused = true;
        EV.UI.setLockHint(true);
      }
    });

    wireUI();
    window.addEventListener('resize', () => {
      Game.camera.aspect = window.innerWidth / window.innerHeight;
      Game.camera.updateProjectionMatrix();
      Game.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    requestAnimationFrame(loop);
  }

  function wireUI() {
    const $ = (id) => document.getElementById(id);
    $('descNormal').textContent = CFG.DIFFICULTY.normal.desc;
    $('descDehset').textContent = CFG.DIFFICULTY.dehset.desc;
    const nameIn = $('nameInput');
    nameIn.value = EV.Online.name();
    const nameOk = () => {
      const n = EV.Online.cleanName(nameIn.value);
      if (n.length < 2) { nameIn.classList.add('bad'); nameIn.focus(); return false; }
      EV.Online.setName(n);
      nameIn.value = n;
      return true;
    };
    nameIn.addEventListener('input', () => nameIn.classList.remove('bad'));
    $('lbOpen').onclick = () => EV.Online.show(null);
    $('lbClose').onclick = () => { EV.Online.hide(); if (Game.started) Game.resume(); };
    window.addEventListener('beforeunload', () => EV.Online.beacon(Game));
    const begin = (fn) => {
      if (!nameOk()) return;
      $('startPanel').hidden = true;
      document.body.classList.remove('prestart');
      U.audio.ensure();
      Game.started = true;
      fn();
    };
    $('diffNormal').onclick = () => begin(() => Game.newGame('normal'));
    $('diffDehset').onclick = () => begin(() => Game.newGame('dehset'));
    if (Game.loadRaw()) {
      $('continueBtn').hidden = false;
      $('continueBtn').onclick = () => begin(() => {
        const d = Game.loadRaw();
        try {
          if (!d) throw new Error('kayıt yok');
          Game.applySave(d);
          EV.UI.toast('Kayıttan devam', '#9de89d');
        } catch (err) {
          console.warn('Kayıt bozuk, yeni oyun başlıyor:', err);
          Game.newGame(d && d.diff === 'dehset' ? 'dehset' : 'normal');
          EV.UI.toast('Kayıt okunamadı — yeni oyun', '#ff8a8a', 2500);
        }
      });
    }
    $('closeBuild').onclick = () => { EV.Cards.toggleBuild(Game); Game.resume(); };

    Game.canvas.addEventListener('click', () => {
      if (!Game.started || EV.Cards.isOpen() || !Game.player.alive) return;
      if (Game.paused || !EV.Input.mouse.locked) Game.resume();
    });

    window.addEventListener('keydown', (e) => {
      if (!Game.started) return;
      if (e.repeat && (e.code === 'Tab' || e.code === 'KeyK' || e.code === 'KeyL')) { e.preventDefault(); return; }
      if (e.code === 'KeyL') {
        if (EV.Online.isOpen()) { EV.Online.hide(); Game.resume(); }
        else if (!EV.Cards.isOpen() && !EV.Inv.isOpen() && Game.player.alive) { Game.pause(); EV.Online.show(Game); }
      }
      if (e.code === 'Escape' && EV.Online.isOpen()) { EV.Online.hide(); EV.UI.setLockHint(true); }
      if (e.code === 'KeyK') {
        if (EV.Cards.which === 'build') { EV.Cards.toggleBuild(Game); Game.resume(); }
        else if (!EV.Cards.isOpen() && !EV.Inv.isOpen() && Game.player.alive) { if (EV.Cards.toggleBuild(Game)) Game.pause(); }
      }
      if (e.code === 'Escape' && EV.Cards.which === 'build') { EV.Cards.toggleBuild(Game); EV.UI.setLockHint(true); }
      if (e.code === 'Tab') {
        e.preventDefault();
        if (EV.Inv.isOpen()) { EV.Inv.close(); Game.resume(); }
        else if (!EV.Cards.isOpen() && Game.player.alive) { EV.Inv.open(Game); Game.pause(); }
      }
      if (e.code === 'Escape' && EV.Inv.isOpen()) { EV.Inv.close(); EV.UI.setLockHint(true); }
    });
  }

  /* =========================================================
     Döngü
     ========================================================= */
  let hudAcc = 0, saveAcc = 0;

  function update(dt) {
    const g = Game;
    EV.Player.update(g, dt, g.camera);
    EV.Enemies.update(g, dt);
    EV.Enemies.maintain(g, dt);
    EV.Enemies.maintainApex(g, dt);
    EV.Boss.updateShots(g, dt);
    EV.Skills.update(g, dt);
    EV.Decal.update(dt);
    EV.Mating.update(g, dt);
    EV.Pickups.update(g, dt);
    EV.Items.update(g, dt);
    EV.FX.update(dt);
    g.cleanupDead();

    EV.UI.updateSkillbar(g);
    EV.UI.updateTarget(g);
    EV.UI.updateBoss(g, g.camera);
    EV.UI.updateDanger(g);
    EV.UI.updateMating(g);
    hudAcc += dt;
    if (hudAcc > 0.08) { hudAcc = 0; EV.UI.refresh(g); }
    saveAcc += dt;
    if (saveAcc > 20) { saveAcc = 0; g.save(); EV.Online.submit(g, false); }
    if (g.build.picks > 0) g.openNextPick();
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(Game.clock.getDelta(), 0.05);
    try {
      if (Game.started && !Game.paused) {
        Game.time += dt;
        update(dt);
      } else if (Game.player && Game.player.group) {
        EV.Player.updateCamera(Game, Game.camera, dt);
        EV.UI.updateDanger(Game);
      }
    } catch (err) {
      console.error('Kare hatası:', err);
    }
    Game.renderer.render(Game.scene, Game.camera);
    EV.Input.endFrame();
  }

  EV.Game = Game;
  EV.tick = update;          // testler hızlandırılmış simülasyon için kullanır
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
