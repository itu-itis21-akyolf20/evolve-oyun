/* ============================================================
   items.js — MUTASYONLAR: avlanan yaratıktan parça emme, beden
   bölgeleri, Gen deposu, evrimleştirme (+0…+9), emilim

   Avladığın yaratığın bir vücut parçası kopabilir (Oklu Kirpi → Kirpi
   Dikeni, Mamut → Fildişi, Kaya Kartalı → Kartal Pençesi…). Üstünden
   geçince Gen deposuna emilir; Tab ekranında (BEDEN) 6 bölgeden birine
   takılır ve BEDENİNDE GÖRÜNÜR (creature.js addMutations): +seviye
   büyüdükçe parça büyür, Destansı/Efsanevi ışır.

   Bölgeler (eski kayıt yuvası → bölge):
     Çene   jaw   ← fang   dişler · kılıç diş · fildişi · kıskaç
     Pençe  claws ← claw   pençe · tırnak · orak tırnak · kanca
     Sırt   back  ← organ  diken · plaka · sırt dikeni · yelken · kanat zarı
     Kuyruk tail  ← tail   topuz · iğne · çıngırak · yüzgeç · kamçı · püskül
     Baş    head  ← relic  boynuz · çatal boynuz · ibik · yaka · duyarga · göz
     Deri   hide  ← hide   pul · kürk · mukus · bez · koku bezi · kapsid
   (organ → Sırt: eski organ statları enerji/yetenek; sırt yelkeni/dikeni
    da ısı-enerji-öfke temalı. Eski özellik havuzları korunur, kayıt kaybolmaz.)

   Nadirlik: Sıradan · Nadir · Değerli · Destansı (ışır) · Efsanevi (adlı mutasyon).
   Gen Özü: her av tier'ı kadar öz verir. Mutasyon KALICIDIR (aşamalar arası).
   Mutasyon seviyesi (ilvl) = aşama + nesil.
   EVRİMLEŞTİR (+0…+9): her kademe tüm değerleri birikimli artırır ve parçayı
   büyütür; +6 ve üstünde başarısızlık bir kademe geriletir.
   SOY UYUMU: Değerli+ mutasyonlar bir soya ait olabilir; 2 ve 4 parça bonusu.
   ============================================================ */
window.EV = window.EV || {};

EV.Items = (function () {
  'use strict';

  const U = EV.U;
  const CFG = EV.CFG;
  const R = CFG.RARITY;
  const IC = CFG.ITEMS;
  const DEPOT = IC.depotSize || 72;
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  /* ---------------------------------------------------------
     BEDEN BÖLGELERİ — sıra, BEDEN ekranındaki sıradır.
     Havuzlar eski yuvaların havuzlarını AYNEN içerir (eski kayıttaki
     özellikler geçerli kalsın); Sırt'a diken/plaka teması için yansıtma eklendi.
     --------------------------------------------------------- */
  const SLOTS = [
    { id: 'head',  old: 'relic', name: 'Baş',    icon: '🦌', hint: 'boynuz · ibik · yaka · duyarga',
      pool: ['statusPower', 'statusDur', 'area', 'crit', 'xpGain', 'pickup'] },
    { id: 'jaw',   old: 'fang',  name: 'Çene',   icon: '🦷', hint: 'diş · kılıç diş · fildişi · kıskaç',
      pool: ['dmg', 'critDmg', 'atkSpd', 'crit', 'lifesteal'] },
    { id: 'back',  old: 'organ', name: 'Sırt',   icon: '🦔', hint: 'diken · plaka · yelken · kanat zarı',
      pool: ['energyRegen', 'maxEnergy', 'cdr', 'rageGain', 'speed', 'reflect'] },
    { id: 'hide',  old: 'hide',  name: 'Deri',   icon: '🐊', hint: 'pul · kürk · mukus · bez',
      pool: ['maxHp', 'armor', 'hpRegen', 'reflect', 'speed'] },
    { id: 'claws', old: 'claw',  name: 'Pençe',  icon: '🐾', hint: 'pençe · tırnak · orak · kanca',
      pool: ['crit', 'critDmg', 'atkSpd', 'ccDmg', 'vsBleed'] },
    { id: 'tail',  old: 'tail',  name: 'Kuyruk', icon: '🦂', hint: 'topuz · iğne · çıngırak · yüzgeç',
      pool: ['speed', 'dashCost', 'area', 'summonPower', 'rageGain', 'pickup'] },
  ];
  const SLOT = {};
  const ALIAS = {};            // eski ve yeni kimlik → bölge
  SLOTS.forEach((s) => { SLOT[s.id] = s; ALIAS[s.id] = s.id; ALIAS[s.old] = s.id; });
  const regionOf = (x) => (own(ALIAS, x) ? ALIAS[x] : null);

  /* rütbe 0, ilvl 0, Sıradan, +0 için taban değer (dashCost NEGATİF = ucuz atılım) */
  const AFFIX = {
    dmg: 0.06, critDmg: 0.12, atkSpd: 0.06, crit: 0.025, lifesteal: 0.012,
    maxHp: 0.07, armor: 0.035, hpRegen: 0.0015, reflect: 0.05, speed: 0.035,
    energyRegen: 0.07, maxEnergy: 0.07, cdr: 0.03, rageGain: 0.08,
    statusPower: 0.08, statusDur: 0.05, area: 0.045, xpGain: 0.04, pickup: 0.12,
    ccDmg: 0.08, vsBleed: 0.09, summonPower: 0.08, dashCost: -0.05,
  };
  const PREFIX = {
    dmg: 'Keskin', critDmg: 'Parçalayan', atkSpd: 'Çevik', crit: 'Ölümcül', lifesteal: 'Kana Susamış',
    maxHp: 'Dayanıklı', armor: 'Sert', hpRegen: 'Yenilenen', reflect: 'Dikenli', speed: 'Hafif',
    energyRegen: 'Canlı', maxEnergy: 'Derin', cdr: 'Hızlı', rageGain: 'Öfkeli',
    statusPower: 'Zehirli', statusDur: 'Kalıcı', area: 'Geniş', xpGain: 'Bilge', pickup: 'Açgözlü',
    ccDmg: 'Acımasız', vsBleed: 'Yırtıcı', summonPower: 'Buyurgan', dashCost: 'Fırlayan',
  };

  /* ---------------------------------------------------------
     PARÇA TÜRLERİ — bedende nasıl görüneceğini belirler (creature.js)
     --------------------------------------------------------- */
  const KINDS = {
    fangs:     { region: 'jaw',   name: 'Dişler',        icon: '🦷' },
    sabre:     { region: 'jaw',   name: 'Kılıç Diş',     icon: '🐯' },
    tusks:     { region: 'jaw',   name: 'Fildişi',       icon: '🐘' },
    mandibles: { region: 'jaw',   name: 'Kıskaç Çene',   icon: '🦗' },
    claws:     { region: 'claws', name: 'Pençe',         icon: '🐾' },
    talons:    { region: 'claws', name: 'Tırnak',        icon: '🦅' },
    sickle:    { region: 'claws', name: 'Orak Tırnak',   icon: '🦖' },
    hooks:     { region: 'claws', name: 'Tutunma Kancası', icon: '⚓' },
    quills:    { region: 'back',  name: 'Oklu Diken',    icon: '🦔' },
    plates:    { region: 'back',  name: 'Sırt Plakası',  icon: '🐢' },
    spines:    { region: 'back',  name: 'Sırt Dikeni',   icon: '🦕' },
    sail:      { region: 'back',  name: 'Sırt Yelkeni',  icon: '⛵' },
    wings:     { region: 'back',  name: 'Kanat Zarı',    icon: '🦇' },
    club:      { region: 'tail',  name: 'Kuyruk Topuzu', icon: '🔨' },
    stinger:   { region: 'tail',  name: 'İğne',          icon: '🦂' },
    rattle:    { region: 'tail',  name: 'Çıngırak',      icon: '🐍' },
    fin:       { region: 'tail',  name: 'Kuyruk Yüzgeci', icon: '🐟' },
    whip:      { region: 'tail',  name: 'Kamçı',         icon: '〰️' },
    brush:     { region: 'tail',  name: 'Püskül',        icon: '🦊' },
    horns:     { region: 'head',  name: 'Boynuz',        icon: '🐐' },
    antlers:   { region: 'head',  name: 'Çatal Boynuz',  icon: '🦌' },
    crest:     { region: 'head',  name: 'İbik',          icon: '🐓' },
    frill:     { region: 'head',  name: 'Boyun Yakası',  icon: '🦎' },
    antennae:  { region: 'head',  name: 'Duyarga',       icon: '🐜' },
    eye:       { region: 'head',  name: 'Üçüncü Göz',    icon: '👁️' },
    scutes:    { region: 'hide',  name: 'Kemik Pul',     icon: '🐊' },
    fur:       { region: 'hide',  name: 'Kürk',          icon: '🐻' },
    slime:     { region: 'hide',  name: 'Mukus',         icon: '💧' },
    glands:    { region: 'hide',  name: 'Bez',           icon: '💠' },
    musk:      { region: 'hide',  name: 'Koku Bezi',     icon: '🦨' },
    capsid:    { region: 'hide',  name: 'Kapsid Dikenleri', icon: '🦠' },
  };
  const kindOk = (k, region) => own(KINDS, k) && KINDS[k].region === region;

  /* ---------------------------------------------------------
     VERİCİLER — her yaratığın koparılabilen parçaları [tür, ad].
     Bosslar (ara boss · Alfa · Apex · hazine) daha çok ve daha adlı parça verir.
     --------------------------------------------------------- */
  const DONORS = {
    /* hücre */
    alga: [['slime', 'Alg Jeli'], ['whip', 'Alg Kamçısı']],
    amoeba: [['slime', 'Amip Zarı'], ['hooks', 'Yalancı Ayak']],
    flagel: [['whip', 'Kamçılı Kuyrukçuk'], ['antennae', 'Kamçı Duyargası']],
    diatom: [['plates', 'Silika Kabuk'], ['spines', 'Silika İğnesi']],
    toxin: [['glands', 'Zehir Kesesi'], ['stinger', 'Zehir İğnesi']],
    whip: [['whip', 'Kırbaç Kamçısı'], ['fangs', 'Kırbaç Dişi']],
    sporer: [['glands', 'Spor Kesesi'], ['crest', 'Spor Tacı']],
    glowcell: [['eye', 'Işık Gözü'], ['glands', 'Işıklı Kese']],
    virus: [['capsid', 'Kapsid Dikenleri'], ['spines', 'Protein Dikeni']],
    jelly: [['glands', 'Yakıcı Keseler'], ['stinger', 'Yakıcı İplik']],
    colony: [['slime', 'Koloni Jeli'], ['club', 'Koloni Topuzu'], ['mandibles', 'Koloni Ağzı']],
    colonyling: [['slime', 'Koloni Jeli']],
    symbiote: [['fur', 'Titrek Siller'], ['antennae', 'Simbiyot Duyargası']],
    spiro: [['mandibles', 'Sarmal Kıskaç'], ['hooks', 'Sarmal Kanca']],
    bigamoeba: [['slime', 'Dev Amip Zarı'], ['hooks', 'Dev Yalancı Ayak'], ['mandibles', 'Dev Amip Ağzı']],
    memqueen: [['crest', 'Zar Kraliçesi Tacı'], ['glands', 'Kraliçe Kesesi'], ['sail', 'Kraliçe Zarı']],
    eelcell: [['fin', 'Elektrik Yüzgeci'], ['sail', 'Elektrik Sırtı'], ['eye', 'Elektrik Gözü']],
    devourer: [['mandibles', 'Yırtıcı Ağız'], ['spines', 'Yırtıcı Dikenler'], ['whip', 'Yırtıcı Kamçı'], ['hooks', 'Yırtıcı Kanca']],
    leviacell: [['mandibles', 'Yutucu Ağzı'], ['spines', 'Yutucu Dikenleri'], ['capsid', 'Yutucu Zarı'], ['antennae', 'Yutucu Duyargası']],
    goldcell: [['glands', 'Altın Kese'], ['whip', 'Altın Kamçı']],
    /* sürüngen */
    bug: [['mandibles', 'Böcek Kıskacı'], ['antennae', 'Böcek Anteni']],
    lizard: [['frill', 'Kertenkele Yakası'], ['claws', 'Kertenkele Pençesi'], ['whip', 'Kertenkele Kuyruğu']],
    shell: [['plates', 'Kaplumbağa Kabuğu'], ['scutes', 'Kabuk Pulları']],
    serpent: [['fangs', 'Yılan Zehir Dişi'], ['rattle', 'Kum Çıngırağı']],
    raptor: [['sickle', 'Raptor Orak Tırnağı'], ['fangs', 'Raptor Dişi']],
    hornlizard: [['horns', 'Kertenkele Boynuzu'], ['spines', 'Boynuzlu Sırt'], ['club', 'Boynuzlu Topuz']],
    spitter: [['glands', 'Tükürük Bezesi'], ['frill', 'Tükürgen Yakası']],
    quillback: [['quills', 'Ok Dikenleri'], ['spines', 'Dikenli Sırt']],
    ptero: [['wings', 'Pterozor Zarı'], ['crest', 'Pterozor İbiği'], ['talons', 'Pterozor Tırnağı']],
    frog: [['slime', 'Kurbağa Mukusu'], ['glands', 'Zehir Bezesi']],
    croc: [['scutes', 'Timsah Pulu'], ['fangs', 'Timsah Dişi'], ['fin', 'Timsah Kuyruğu']],
    shaman: [['crest', 'Şaman İbiği'], ['eye', 'Şaman Gözü']],
    brood: [['glands', 'Kuluçka Kesesi'], ['mandibles', 'Ana Kıskacı']],
    hornlead: [['horns', 'Lider Boynuzu'], ['club', 'Lider Topuzu'], ['spines', 'Lider Sırtı']],
    skyhunter: [['wings', 'Gök Avcısı Zarı'], ['talons', 'Gök Avcısı Tırnağı'], ['crest', 'Gök Avcısı İbiği']],
    broodqueen: [['mandibles', 'Kraliçe Kıskacı'], ['glands', 'Kraliçe Kesesi'], ['antennae', 'Kraliçe Anteni']],
    varanus: [['scutes', 'Varanus Pulu'], ['fangs', 'Varanus Zehir Dişi'], ['horns', 'Varanus Boynuzu'], ['claws', 'Varanus Pençesi'], ['whip', 'Varanus Kuyruğu']],
    terrorbird: [['talons', 'Dehşet Pençesi'], ['crest', 'Dehşet İbiği'], ['sickle', 'Dehşet Orağı']],
    goldlizard: [['scutes', 'Altın Pul'], ['frill', 'Altın Yaka']],
    /* memeli */
    rodent: [['fangs', 'Kemirgen Kesici Dişi'], ['whip', 'Kemirgen Kuyruğu']],
    fox: [['brush', 'Tilki Kuyruğu'], ['fur', 'Tilki Kürkü']],
    boar: [['tusks', 'Domuz Azısı'], ['fur', 'Domuz Kılı'], ['spines', 'Domuz Yelesi']],
    deer: [['antlers', 'Geyik Boynuzu']],
    cub: [['claws', 'Ayı Pençesi'], ['fur', 'Ayı Kürkü']],
    saber: [['sabre', 'Kılıç Diş'], ['claws', 'Kaplan Pençesi']],
    porcupine: [['quills', 'Kirpi Dikeni'], ['club', 'Dikenli Kuyruk']],
    howler: [['fangs', 'Çakal Dişi'], ['brush', 'Çakal Kuyruğu']],
    bat: [['wings', 'Yarasa Zarı'], ['fangs', 'Vampir Dişi'], ['frill', 'Yarasa Kulağı']],
    eagle: [['talons', 'Kartal Pençesi'], ['crest', 'Kartal Tepeliği']],
    skunk: [['musk', 'Kokarca Bezesi'], ['brush', 'Kokarca Kuyruğu']],
    whitedeer: [['antlers', 'Ak Geyik Boynuzu'], ['fur', 'Ak Post']],
    hyena: [['fangs', 'Sırtlan Çenesi'], ['fur', 'Sırtlan Postu']],
    mammoth: [['tusks', 'Mamut Fildişi'], ['fur', 'Mamut Postu']],
    oldboar: [['tusks', 'Yaşlı Azı'], ['fur', 'Kır Kıl'], ['spines', 'Yaşlı Yele']],
    wolfleader: [['fangs', 'Lider Dişi'], ['fur', 'Lider Yelesi'], ['brush', 'Lider Kuyruğu'], ['claws', 'Kurt Pençesi']],
    oldmammoth: [['tusks', 'Kadim Fildişi'], ['fur', 'Kadim Post']],
    saberking: [['sabre', 'Kral Kılıç Dişi'], ['claws', 'Kral Pençesi'], ['spines', 'Kral Yelesi'], ['horns', 'Kral Boynuzu'], ['brush', 'Kral Kuyruğu']],
    direbear: [['claws', 'Korku Pençesi'], ['fur', 'Korku Postu'], ['horns', 'Korku Boynuzu'], ['spines', 'Korku Sırtı']],
    goldhare: [['fur', 'Altın Post'], ['brush', 'Altın Kuyruk']],
    /* geçmiş benlik: kendi eski bedeninin yankısı */
    nemesis: [['horns', 'Geçmiş Boynuz'], ['sabre', 'Geçmiş Kılıç Diş'], ['quills', 'Geçmiş Dikenler'],
      ['talons', 'Geçmiş Tırnaklar'], ['stinger', 'Geçmiş İğne'], ['scutes', 'Geçmiş Pullar']],
  };

  /** Verici parçası (doğrulanmış): { kind, name, region } ya da null. */
  function donorEntry(src, di) {
    if (!own(DONORS, src)) return null;
    const list = DONORS[src];
    const i = Number(di);
    if (!Number.isInteger(i) || i < 0 || i >= list.length) return null;
    const e = list[i];
    return own(KINDS, e[0]) ? { kind: e[0], name: e[1], region: KINDS[e[0]].region } : null;
  }

  /* Aşama bantları: bir bölge için rastgele parça (üretim, sandık, eski eşya) o aşamanın yaratıklarından */
  const BAND = [[], [], []];
  (function buildBands() {
    const M = EV.MOBS || {};
    (M.ENEMIES || []).forEach((pool, s) => { if (BAND[s]) pool.forEach((d) => { if (own(DONORS, d.id)) BAND[s].push(d.id); }); });
  })();

  function bandParts(band, region) {
    const out = [];
    (BAND[U.clamp(band | 0, 0, BAND.length - 1)] || []).forEach((src) => {
      DONORS[src].forEach((e, di) => { if (own(KINDS, e[0]) && KINDS[e[0]].region === region) out.push({ src, di }); });
    });
    return out;
  }

  /* Eski kayıttaki (türü/vericisi olmayan) mutasyonların adları; ilk ad eski sürümün adıdır
     (anlamlı kaldığı yerde). [ad, tür] — bv ile seçilir. */
  const GENERIC = [
    {
      jaw: [['Protoplazma Dikeni', 'fangs'], ['Silika İğnesi', 'fangs'], ['Enzim Kancası', 'mandibles'], ['Asit Sivrisi', 'fangs']],
      hide: [['Hücre Zarı', 'slime'], ['Jel Kılıf', 'slime'], ['Kitin Zar', 'scutes'], ['Silis Kabuk', 'scutes']],
      back: [['Mitokondri Dikenleri', 'spines'], ['Koful Yelkeni', 'sail'], ['Kloroplast Plakası', 'plates'], ['Ribozom Dikenleri', 'quills']],
      head: [['Kristal Duyarga', 'antennae'], ['Işıyan Göz', 'eye'], ['Fosil Taç', 'crest'], ['Diatom Yakası', 'frill']],
      claws: [['Sil Demeti', 'hooks'], ['Yalancı Ayak', 'hooks'], ['Tutunma Kancası', 'hooks'], ['Kıskaç Lifi', 'claws']],
      tail: [['Kamçı', 'whip'], ['Titrek Kamçı', 'whip'], ['Sarmal Kuyrukçuk', 'fin'], ['Kamçı İğnesi', 'stinger']],
    },
    {
      jaw: [['Kemik Diş', 'fangs'], ['Zehir Dişi', 'fangs'], ['Testere Diş', 'fangs'], ['Kanca Diş', 'sabre']],
      hide: [['Pul Zırh', 'scutes'], ['Kemik Plaka', 'scutes'], ['Dikenli Deri', 'capsid'], ['Kum Derisi', 'scutes']],
      back: [['Güneş Yelkeni', 'sail'], ['Kemik Plakalar', 'plates'], ['Sırt Dikenleri', 'spines'], ['Taş Sırt', 'plates']],
      head: [['Güneş İbiği', 'crest'], ['Boynuz Taslağı', 'horns'], ['Kehanet Yakası', 'frill'], ['Fosil Göz', 'eye']],
      claws: [['Kum Pençesi', 'claws'], ['Kanca Tırnak', 'sickle'], ['Taş Tırnak', 'claws'], ['Kazıcı Pençe', 'claws']],
      tail: [['Kırbaç Kuyruk', 'whip'], ['Topuz Kuyruk', 'club'], ['Dikenli Kuyruk', 'stinger'], ['Çıngırak Kuyruk', 'rattle']],
    },
    {
      jaw: [['Kılıç Diş', 'sabre'], ['Azı Dişi', 'tusks'], ['Kurt Dişi', 'fangs'], ['Kaplan Dişi', 'fangs']],
      hide: [['Kalın Post', 'fur'], ['Ayı Kürkü', 'fur'], ['Kış Postu', 'fur'], ['Yaralı Deri', 'scutes']],
      back: [['Kirpi Sırtı', 'quills'], ['Tatu Plakaları', 'plates'], ['Diken Yele', 'spines'], ['Zar Kanat', 'wings']],
      head: [['Ay Boynuzu', 'horns'], ['Ata Boynuzu', 'antlers'], ['Totem Tacı', 'crest'], ['Kehribar Göz', 'eye']],
      claws: [['Kurt Pençesi', 'claws'], ['Ayı Pençesi', 'claws'], ['Vaşak Tırnağı', 'talons'], ['Pars Pençesi', 'claws']],
      tail: [['Tilki Kuyruğu', 'brush'], ['Pars Kuyruğu', 'whip'], ['Sürü Kuyruğu', 'brush'], ['Topuz Kuyruk', 'club']],
    },
  ];
  function genericEntry(it) {
    const list = GENERIC[Math.min(it.ilvl | 0, GENERIC.length - 1)][it.slot];
    const e = list[(it.bv | 0) % list.length];
    return { name: e[0], kind: e[1] };
  }

  /* ---------------------------------------------------------
     EFSANEVİ ADLI MUTASYONLAR — gen kancalarıyla aynı dil
     (basicSt · hitChanceSt · critSt · onHurtSt · dashSt) + sabit modlar.
     old: eski sürümdeki eşya adı (kayıt uyumu). tint: bedendeki ışıma rengi.
     --------------------------------------------------------- */
  const UNIQUES = [
    { region: 'jaw', kind: 'fangs', name: 'Yutucunun Dişleri', old: 'Yutucunun Dişi', tint: '#8ce04a',
      desc: 'Temel saldırılar 2 Zehir bırakır.', hooks: { basicSt: [['poison', 2, 1]] } },
    { region: 'jaw', kind: 'sabre', name: 'Alfa Kılıç Dişleri', old: 'Alfa Pençesi', tint: '#ff4a5a',
      desc: 'İsabetlerin %30 ihtimalle kanatır.', hooks: { hitChanceSt: [['bleed', 1, 0.3]] } },
    { region: 'jaw', kind: 'tusks', name: 'Kemik Kıran Çene', old: 'Kemik Kıran', tint: '#ffd23d',
      desc: 'Kritikler 2 Kırılganlık bırakır; kritik hasarı +%25.', hooks: { critSt: [['vuln', 2]] }, mods: { critDmg: 0.25 } },
    { region: 'jaw', kind: 'fangs', name: 'Kor Dişleri', old: 'Kor Dişi', tint: '#ff8a2a',
      desc: 'Temel saldırılar %40 ihtimalle 2 Yanık bırakır; hasar +%6.', hooks: { basicSt: [['burn', 2, 0.4]] }, mods: { dmg: 0.06 } },

    { region: 'head', kind: 'horns', name: 'Yıldırım Boynuzları', old: 'Yıldırım Çekirdeği', tint: '#6fc8ff',
      desc: 'Kritik vuruşlar Şok 2 bırakır.', hooks: { critSt: [['shock', 2]] } },
    { region: 'head', kind: 'crest', name: 'Veba İbiği', old: 'Veba Totemi', tint: '#8ce04a',
      desc: 'İsabetlerin %25 ihtimalle 2 Zehir bırakır; durum hasarı +%20.', hooks: { hitChanceSt: [['poison', 2, 0.25]] }, mods: { statusPower: 0.2 } },
    { region: 'head', kind: 'eye', name: 'Buz Gözü', old: 'Buz Gözü', tint: '#9aeaff',
      desc: 'İsabetlerin %20 ihtimalle 2 Yavaşlama bırakır; durum süresi +%25.', hooks: { hitChanceSt: [['slow', 2, 0.2]] }, mods: { statusDur: 0.25 } },
    { region: 'head', kind: 'antlers', name: 'Kâhin Boynuzu', old: 'Kâhin Kemiği', tint: '#ffe08a',
      desc: 'Kritikler 1 Kırılganlık bırakır; deneyim +%25, toplama menzili +%60.', hooks: { critSt: [['vuln', 1]] }, mods: { xpGain: 0.25, pickup: 0.6 } },

    { region: 'hide', kind: 'scutes', name: 'Taş Pullar', old: 'Taş Kalp', tint: '#c8d0dc',
      desc: 'Sana vuran Yavaşlama 2 yer; zırh +%8.', hooks: { onHurtSt: [['slow', 2]] }, mods: { armor: 0.08 } },
    { region: 'hide', kind: 'capsid', name: 'Diken Postu', old: 'Diken Postu', tint: '#ff4a5a',
      desc: 'Sana vuran 2 Kanama yer; hasar yansıtma +%12.', hooks: { onHurtSt: [['bleed', 2]] }, mods: { reflect: 0.12 } },
    { region: 'hide', kind: 'scutes', name: 'Ejder Pulları', old: 'Ejder Pulu', tint: '#ff6a2a',
      desc: 'Sana vuran 2 Yanık yer; maks. can +%10.', hooks: { onHurtSt: [['burn', 2]] }, mods: { maxHp: 0.1 } },
    { region: 'hide', kind: 'fur', name: 'Korku Postu', old: 'Korku Postu', tint: '#c27bff',
      desc: 'Sana vuran 1 sn korkar; can yenilenmesi +%0.3/sn.', hooks: { onHurtSt: [['fear', 1]] }, mods: { hpRegen: 0.003 } },

    { region: 'back', kind: 'wings', name: 'Vampir Kanatları', old: 'Kan Pınarı', tint: '#ff3a4a',
      desc: 'Can çalma +%6.', hooks: {}, mods: { lifesteal: 0.06 } },
    { region: 'back', kind: 'sail', name: 'Rüzgâr Yelkeni', old: 'Rüzgar Kesesi', tint: '#bfefff',
      desc: 'Atılım çevreyi yavaşlatır, %30 ucuzlar.', hooks: { dashSt: [['slow', 2]] }, mods: { dashCost: -0.3 } },
    { region: 'back', kind: 'quills', name: 'Öfke Dikenleri', old: 'Öfke Bezesi', tint: '#ff5a3d',
      desc: 'Kritikler 0.6 sn korkutur; öfke kazanımı +%40.', hooks: { critSt: [['fear', 0.6]] }, mods: { rageGain: 0.4 } },
    { region: 'back', kind: 'spines', name: 'Şimşek Sırtı', old: 'Şimşek Kesesi', tint: '#6fc8ff',
      desc: 'Atılım çevreye 2 Şok bırakır; enerji dolumu +%20.', hooks: { dashSt: [['shock', 2]] }, mods: { energyRegen: 0.2 } },

    { region: 'claws', kind: 'sickle', name: 'Kanlı Orak', old: 'Kanlı Orak', tint: '#ff4a5a',
      desc: 'İsabetlerin %35 ihtimalle kanatır; kanayanlara +%25 hasar.', hooks: { hitChanceSt: [['bleed', 1, 0.35]] }, mods: { vsBleed: 0.25 } },
    { region: 'claws', kind: 'talons', name: 'Gök Gürültüsü Pençesi', old: 'Gök Gürültüsü Pençesi', tint: '#6fc8ff',
      desc: 'Kritikler 0.5 sn sersemletir; etkisizlere +%20 hasar.', hooks: { critSt: [['stun', 0.5]] }, mods: { ccDmg: 0.2 } },
    { region: 'claws', kind: 'claws', name: 'Yırtıcı Tırnak', old: 'Yırtıcı Tırnak', tint: '#ffd23d',
      desc: 'Temel saldırılar 1 Kanama, %30 ihtimalle 1 Kırılganlık bırakır; kritik şansı +%6.', hooks: { basicSt: [['bleed', 1, 1], ['vuln', 1, 0.3]] }, mods: { crit: 0.06 } },
    { region: 'claws', kind: 'claws', name: 'Buz Pençesi', old: 'Buz Pençesi', tint: '#9aeaff',
      desc: 'Temel saldırılar 1 Yavaşlama bırakır; etkisizlere +%15 hasar.', hooks: { basicSt: [['slow', 1, 1]] }, mods: { ccDmg: 0.15 } },

    { region: 'tail', kind: 'fin', name: 'Fırtına Yüzgeci', old: 'Fırtına Kuyruğu', tint: '#6fc8ff',
      desc: 'Atılım çevreye 2 Şok + 1 Yavaşlama bırakır; atılım %25 ucuz.', hooks: { dashSt: [['shock', 2], ['slow', 1]] }, mods: { dashCost: -0.25 } },
    { region: 'tail', kind: 'club', name: 'Kum Fırtınası Topuzu', old: 'Kum Fırtınası', tint: '#e8c078',
      desc: 'Atılım çevreyi 0.6 sn sersemletir; alan +%10.', hooks: { dashSt: [['stun', 0.6]] }, mods: { area: 0.1 } },
    { region: 'tail', kind: 'stinger', name: 'Alev İğnesi', old: 'Alev Kuyruğu', tint: '#ff8a2a',
      desc: 'Atılım çevreye 3 Yanık bırakır; hız +%8.', hooks: { dashSt: [['burn', 3]] }, mods: { speed: 0.08 } },
    { region: 'tail', kind: 'rattle', name: 'Sürü Anası Çıngırağı', old: 'Sürü Anası', tint: '#9de89d',
      desc: 'Çağrı sayısı +1, çağrı gücü +%30; sana vuran 1 Kırılganlık yer.', hooks: { onHurtSt: [['vuln', 1]] }, mods: { summonCount: 1, summonPower: 0.3 } },
    { region: 'tail', kind: 'whip', name: 'Gölge Kırbacı', old: 'Gölge Kuyruk', tint: '#9a6aff',
      desc: 'Atılım yakındakileri 1.2 sn korkutur; öfke kazanımı +%25.', hooks: { dashSt: [['fear', 1.2]] }, mods: { rageGain: 0.25 } },
  ];
  UNIQUES.forEach((u) => { u.slot = u.region; });     // eski API adı (it.unique.slot)

  /* Soy uyumu: aynı soydan 2 ve 4 mutasyon takılıysa bonus (kimlikler kayıt uyumu için sabit) */
  const SETS = [
    { id: 'kurt', name: 'Kurt Soyu', icon: '🐺', color: '#ff8a5a',
      b2: { mods: { atkSpd: 0.08, speed: 0.05 } },
      b4: { mods: { vsBleed: 0.2 }, hooks: { hitChanceSt: [['bleed', 1, 0.2]] }, desc: 'İsabetlerin %20 kanatır; kanayanlara +%20 hasar' } },
    { id: 'yilan', name: 'Yılan Soyu', icon: '🐍', color: '#8ce04a',
      b2: { mods: { statusPower: 0.15 } },
      b4: { mods: { statusDur: 0.2 }, hooks: { basicSt: [['poison', 1, 1]] }, desc: 'Temel saldırılar 1 Zehir bırakır; durum süresi +%20' } },
    { id: 'kaya', name: 'Kaplumbağa Soyu', icon: '🐢', color: '#d9c7a0',
      b2: { mods: { armor: 0.05, maxHp: 0.06 } },
      b4: { mods: { reflect: 0.1 }, hooks: { onHurtSt: [['stun', 0.4]] }, desc: 'Sana vuran 0.4 sn sersemler; hasar yansıtma +%10' } },
    { id: 'firtina', name: 'Yılanbalığı Soyu', icon: '⚡', color: '#6fc8ff',
      b2: { mods: { cdr: 0.05, energyRegen: 0.1 } },
      b4: { mods: { crit: 0.05 }, hooks: { critSt: [['shock', 1]] }, desc: 'Kritikler 1 Şok bırakır; kritik şansı +%5' } },
  ];
  const SET = {};
  SETS.forEach((s) => { SET[s.id] = s; });

  let uidSeq = 1;
  const ground = [];
  const chests = [];

  /* =========================================================
     Üretim
     ========================================================= */
  function freshInv() {
    const equip = {};
    SLOTS.forEach((s) => { equip[s.id] = null; });
    return { bag: new Array(DEPOT).fill(null), chest: [], equip, essence: 0 };
  }

  function rollRarity(key, boost) {
    const r = U.weightedPick(R, (x) => x[key] * (x.id >= 2 ? (boost || 1) : 1));
    return r ? r.id : 0;
  }

  const plusOf = (it) => U.clamp(it.plus | 0, 0, IC.plusMax);
  const plusMul = (p) => 1 + IC.plusBonus[U.clamp(p | 0, 0, IC.plusMax)];

  /** Özelliğin etkin değeri; plus verilirse o evrim seviyesi için (önizleme). */
  function value(it, a, plus) {
    return AFFIX[a.k] * R[it.rarity].mul * (1 + 0.3 * it.ilvl) * a.roll * plusMul(plus == null ? plusOf(it) : plus);
  }

  /** Parçanın kendi adı (ön ek ve + olmadan). */
  function partName(it) {
    const d = it.src ? donorEntry(it.src, it.di) : null;
    if (d && d.region === it.slot) return d.name;
    return genericEntry(it).name;
  }

  function rename(it) {
    const p = plusOf(it);
    const pre = p > 0 ? '+' + p + ' ' : '';
    if (it.unique) { it.name = pre + it.unique.name; return; }
    const top = it.affixes[0];
    it.name = pre + (top ? PREFIX[top.k] + ' ' : '') + partName(it);
  }

  function addAffix(it) {
    const pool = SLOT[it.slot].pool.filter((k) => !it.affixes.some((a) => a.k === k));
    if (!pool.length) return;
    it.affixes.push({ k: U.pick(pool), roll: U.rand(0.7, 1.0) });
  }

  /** Bölgenin adlı mutasyonlarından biri; aynı türden olan tercih edilir (parça görünüşü korunsun). */
  function pickUnique(region, kind) {
    const cands = UNIQUES.filter((u) => u.region === region);
    const same = cands.filter((u) => u.kind === kind);
    if (same.length && Math.random() < 0.6) return U.pick(same);
    return cands.length ? U.pick(cands) : null;
  }

  function setUnique(it, u) {
    it.unique = u || null;
    if (u) it.kind = u.kind;
  }

  function rollSet(it) {
    if (it.rarity >= 2 && !it.set && Math.random() < IC.setChance) it.set = U.pick(SETS).id;
  }

  /** Parçanın vericisini ve türünü ata: verici verilmemişse aşamanın yaratıklarından rastgele. */
  function assignPart(it, part) {
    const d = part ? donorEntry(part.src, part.di) : null;
    if (d && d.region === it.slot) { it.src = part.src; it.di = part.di | 0; it.kind = d.kind; return; }
    const opts = bandParts(it.ilvl, it.slot);
    if (opts.length) {
      const o = U.pick(opts);
      it.src = o.src; it.di = o.di; it.kind = donorEntry(o.src, o.di).kind;
      return;
    }
    it.src = null; it.di = 0; it.kind = genericEntry(it).kind;
  }

  /**
   * Yeni mutasyon. slot: bölge (eski yuva adı da olur: fang → jaw …).
   * part: { src: verici kimliği, di: parça sırası } — verilirse bölgeyi o belirler.
   */
  function makeItem(slot, rarity, ilvl, part) {
    const d = part ? donorEntry(part.src, part.di) : null;
    const reg = d ? d.region : regionOf(slot) || U.pick(SLOTS).id;
    const r = U.clamp(Math.round(Number(rarity)) || 0, 0, R.length - 1);
    const il = U.clamp(Number(ilvl) | 0, 0, 12);
    const it = { uid: uidSeq++, slot: reg, rarity: r, ilvl: il, plus: 0, bv: Math.floor(Math.random() * 4), set: null,
      affixes: [], unique: null, name: '', kind: null, src: null, di: 0 };
    assignPart(it, part);
    for (let i = 0; i < R[r].affixes; i++) addAffix(it);
    if (r === 4) setUnique(it, pickUnique(reg, it.kind));
    rollSet(it);
    rename(it);
    return it;
  }

  const ilvlOf = (game) => Math.min(game.stageIndex + game.generation, 12);
  const stageBand = (game) => U.clamp(game.stageIndex | 0, 0, BAND.length - 1);

  /** Aşamanın yaratıklarından (bölge verilirse o bölgeden) rastgele parça. */
  function randomItem(game, key, boost, region) {
    const reg = regionOf(region) || U.pick(SLOTS).id;
    const opts = bandParts(stageBand(game), reg);
    return makeItem(reg, rollRarity(key, boost), ilvlOf(game), opts.length ? U.pick(opts) : null);
  }

  /** Avlanan yaratığın parçaları (verici listesi); tanınmıyorsa null. */
  function donorParts(id) {
    return own(DONORS, id) ? DONORS[id].map((e, di) => ({ src: id, di })) : null;
  }

  /* =========================================================
     Statlar ve kancalar (takılı mutasyonlar)
     ========================================================= */
  function addMods(out, src) {
    if (!src) return;
    for (const k in src) out[k] = (out[k] || 0) + src[k];
  }

  function equipped(game) {
    const eq = (game && game.inv && game.inv.equip) || {};
    return SLOTS.map((s) => eq[s.id]).filter((it) => it && it.slot && own(SLOT, it.slot));
  }

  function setCount(game, id) {
    return equipped(game).filter((it) => it.set === id).length;
  }

  /** Etkin soy uyumları: [{ set, n, tiers: [b2, b4?] }] */
  function activeSets(game) {
    const out = [];
    SETS.forEach((s) => {
      const n = setCount(game, s.id);
      if (n >= 2) out.push({ set: s, n, tiers: n >= 4 ? [s.b2, s.b4] : [s.b2] });
    });
    return out;
  }

  function mods(game) {
    const out = {};
    equipped(game).forEach((it) => {
      it.affixes.forEach((a) => { out[a.k] = (out[a.k] || 0) + value(it, a); });
      if (it.unique) addMods(out, it.unique.mods);
    });
    activeSets(game).forEach((a) => a.tiers.forEach((t) => addMods(out, t.mods)));
    return out;
  }

  function hooks(game) {
    const out = [];
    equipped(game).forEach((it) => { if (it.unique && it.unique.hooks) out.push(it.unique.hooks); });
    activeSets(game).forEach((a) => a.tiers.forEach((t) => { if (t.hooks) out.push(t.hooks); }));
    return out;
  }

  const hexNum = (css) => { const n = parseInt(String(css || '').replace('#', ''), 16); return Number.isFinite(n) ? n : 0xffffff; };

  /** Rengin bedendeki karşılığı: adlı mutasyon kendi element rengi, diğerleri nadirlik rengi. */
  function tintOf(it) {
    return hexNum(it.unique && it.unique.tint ? it.unique.tint : R[it.rarity].color);
  }

  /**
   * Takılı mutasyonların beden tarifi (player.js rebuild → spec.mutations → creature.js).
   * [{ region, kind, plus, rarity, color, glow }]
   */
  function bodyMutations(game) {
    return equipped(game).filter((it) => kindOk(it.kind, it.slot)).map((it) => ({
      region: it.slot, kind: it.kind, plus: plusOf(it), rarity: it.rarity,
      color: tintOf(it), glow: R[it.rarity].glow ? 1 : 0,
    }));
  }

  /* =========================================================
     Dünyadaki parçalar ve gen kozaları
     ========================================================= */
  /* bölgeye göre küçük ışıklı parça biçimi (paylaşılan geometri) */
  const DROP_GEO = {
    jaw: new THREE.ConeGeometry(0.2, 0.9, 5),
    claws: new THREE.ConeGeometry(0.17, 0.75, 4),
    back: new THREE.ConeGeometry(0.09, 1.2, 4),
    head: new THREE.ConeGeometry(0.24, 1.0, 5),
    tail: new THREE.OctahedronGeometry(0.42, 0),
    hide: new THREE.CylinderGeometry(0.46, 0.46, 0.12, 6),
  };
  const DROP_TILT = { jaw: 0.5, claws: 0.9, back: 0.35, head: -0.3, tail: 0, hide: Math.PI / 2 };
  const beamGeo = new THREE.CylinderGeometry(0.08, 0.2, 5, 6, 1, true);
  const eggLow = new THREE.SphereGeometry(0.62, 9, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const eggTop = new THREE.SphereGeometry(0.62, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);

  const rarityHtml = (it, txt) => '<span style="color:' + R[it.rarity].color + '">' + txt + '</span>';

  function dropAt(game, pos, it, quiet) {
    const color = new THREE.Color(tintOf(it));
    const g = new THREE.Group();
    const orb = new THREE.Mesh(DROP_GEO[it.slot] || DROP_GEO.tail, new THREE.MeshBasicMaterial({ color }));
    orb.scale.setScalar(0.9 + Math.max(0, it.rarity - 1) * 0.12);
    orb.rotation.z = DROP_TILT[it.slot] || 0;
    orb.position.y = 0.9;
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 + it.rarity * 0.08, depthWrite: false }));
    const tall = it.rarity >= 3 ? 1.9 : 1;          // destansı/efsanevi: uzaktan görünen yüksek ışık
    beam.scale.set(tall, tall, tall);
    beam.position.y = 2.6 * tall;
    g.add(orb, beam);
    g.position.set(pos.x + U.rand(-0.8, 0.8), EV.World.groundY(pos.x, pos.z), pos.z + U.rand(-0.8, 0.8));
    game.scene.add(g);
    ground.push({ g, orb, it, t: 0, life: 240 });
    if (quiet) return;
    if (EV.UI.floatText && game.camera) EV.UI.floatText(g.position.clone().setY(g.position.y + 2), partName(it), R[it.rarity].color);
    if (it.rarity >= 2) EV.UI.toast(rarityHtml(it, R[it.rarity].name + ' parça koptu: ' + it.name), '#fff', 1600);
  }

  function spawnChests(game) {
    clearChests(game);
    const covers = EV.World.covers;
    const cell = game.stage().kind === 'cell';
    covers.forEach((c, i) => {
      if (i % 2) return;                                // her iki saklanma yerinden birinde bir gen kozası
      const g = new THREE.Group();
      const shell = cell ? 0x8fe8d0 : 0xe8dcc0;
      const low = new THREE.Mesh(eggLow, new THREE.MeshPhongMaterial({ color: shell, flatShading: true }));
      low.scale.set(1, 1.1, 1);
      low.position.y = 0.68;
      const lid = new THREE.Mesh(eggTop, new THREE.MeshPhongMaterial({ color: cell ? 0xb8fff0 : 0xf2ead2, flatShading: true,
        emissive: 0x5a4a10, emissiveIntensity: 0.35 }));
      lid.scale.set(1, 1.45, 1);
      lid.position.y = 0.68;
      g.add(low, lid);
      g.position.set(c.x, EV.World.groundY(c.x, c.z), c.z);
      g.rotation.y = U.rand(0, 6);
      game.scene.add(g);
      chests.push({ g, lid, opened: false });
    });
  }

  function openChest(game, ch) {
    ch.opened = true;
    ch.lid.rotation.x = -1.3;
    ch.lid.position.set(0, 0.35, -0.75);
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) dropAt(game, ch.g.position, randomItem(game, 'drop', 3));
    const ess = 20 + game.stageIndex * 15 + game.generation * 10;
    game.inv.essence += ess;
    EV.FX.ring(ch.g.position, 0xffd23d, 5, 0.5);
    EV.UI.toast('🥚 Gen kozası açıldı · +' + ess + ' Gen Özü', '#ffd23d', 1800);
    U.audio.levelUp();
  }

  function update(game, dt) {
    const P = game.player;
    const pp = P.group.position;
    for (let i = ground.length - 1; i >= 0; i--) {
      const o = ground[i];
      o.t += dt;
      o.life -= dt;
      o.orb.rotation.y += dt * 2;
      o.orb.position.y = 0.9 + Math.sin(o.t * 2.5) * 0.15;
      const d = o.g.position.distanceTo(pp);
      if (o.life <= 0 || d > 160) { removeGround(game, i); continue; }
      if (P.alive && d < 2.2) {
        if (addTo(game.inv.bag, o.it)) {
          EV.UI.toast('🧬 ' + rarityHtml(o.it, o.it.name) + ' <span class="sub">Gen deposuna emildi (Tab)</span>', '#fff', 1400);
          U.audio.eat();
          removeGround(game, i);
        } else if (!o.warned) {
          o.warned = true;
          EV.UI.toast('Gen deposu dolu — Tab: parçaları Emilim ile öze çevir', '#ff8a8a', 1800);
        }
      }
    }
    for (let i = 0; i < chests.length; i++) {
      const ch = chests[i];
      if (!ch.opened && P.alive && ch.g.position.distanceTo(pp) < 2.4) openChest(game, ch);
    }
  }

  function removeGround(game, i) {
    const o = ground[i];
    game.scene.remove(o.g);
    o.g.children.forEach((m) => m.material.dispose());   // geometriler paylaşılır
    ground.splice(i, 1);
  }

  function clearChests(game) {
    chests.forEach((c) => {
      game.scene.remove(c.g);
      c.g.children.forEach((m) => m.material.dispose());
    });
    chests.length = 0;
  }

  /** Aşama değişirken yerde kalan parçalar kaybolmaz: depoya; depo doluysa Gen Özü'ne dönüşür. */
  function clear(game, discard) {
    let ess = 0, n = 0;
    for (let i = ground.length - 1; i >= 0; i--) {
      const it = ground[i].it;
      if (!discard && game.inv && !addTo(game.inv.bag, it)) { ess += salvageValue(it); n++; }
      removeGround(game, i);
    }
    if (n && game.inv) {
      game.inv.essence += ess;
      EV.UI.toast('Gen deposu dolu — yerdeki ' + n + ' parça emildi: +' + U.fmt(ess) + ' Gen Özü', '#ffd23d', 2500);
    }
    clearChests(game);
  }

  /* =========================================================
     Av ödülü: Gen Özü + (şansla) yaratığın bir parçası
     ========================================================= */
  const KILL_TITLE = { apex: '☠️ APEX AVLANDI', nemesis: '👤 GEÇMİŞ BENLİĞİN YENİLDİ', treasure: '💰 HAZİNE KOŞUCUSU' };

  function killKind(e) {
    if (e.isAlpha) return 'alpha';
    if (e.isApex) return 'apex';
    if (e.isNemesis) return 'nemesis';
    if (e.isMini) return 'mini';
    if (e.isTreasure) return 'treasure';
    return null;
  }

  const genMul = (game) => 1 + (game.generation || 0) * IC.genEss;
  const donorOf = (e) => (e && e.isNemesis ? 'nemesis' : (e && e.def && e.def.id) || null);

  /** Büyük avın ödülünü herkesin göreceği şekilde duyurur (DEVRİLDİ yazısından sonra tekrar). */
  function announce(game, kind, pos, out) {
    const lines = out.items.map((it) => rarityHtml(it, R[it.rarity].name + ': ' + it.name));
    const html = '<b>' + KILL_TITLE[kind] + '</b><br>+' + U.fmt(out.essence) + ' 🧬 Gen Özü · ' + out.items.length + ' parça koptu<br>' + lines.join('<br>');
    EV.UI.toast(html, '#ffd83d', 4200);
    setTimeout(() => EV.UI.toast(html, '#ffd83d', 4200), 1600);
    if (EV.FX && EV.FX.ring) { EV.FX.ring(pos, 0xffd23d, 9, 0.9); EV.FX.ring(pos, 0xff9a2a, 5, 0.6); }
    if (EV.UI.floatText && game.camera) EV.UI.floatText(pos.clone().setY(pos.y + 3), '+' + U.fmt(out.essence) + ' 🧬', '#ffd83d');
    U.audio.levelUp();
  }

  /** Yaratığın parçası: vericiyse kendi listesinden (skip: aynı avda farklı parça), değilse aşamadan rastgele. */
  function absorbPart(game, donor, rarity, skip) {
    const parts = donorParts(donor);
    if (!parts) {
      const reg = U.pick(SLOTS).id;
      const opts = bandParts(stageBand(game), reg);
      return makeItem(reg, rarity, ilvlOf(game), opts.length ? U.pick(opts) : null);
    }
    const fresh = parts.filter((p) => !skip || skip.indexOf(p.di) < 0);
    const p = U.pick(fresh.length ? fresh : parts);
    if (skip) skip.push(p.di);
    return makeItem(null, rarity, ilvlOf(game), p);
  }

  function rewardDrops(game, K, pos, quiet, donor) {
    const used = [];
    return K.drops.map((d) => {
      let r = Math.max(rollRarity('drop', K.boost), d.min || 0);
      if (d.leg && Math.random() < d.leg) r = 4;
      const it = absorbPart(game, donor, r, used);
      dropAt(game, pos, it, quiet);
      return it;
    });
  }

  /**
   * Av ödülü: Gen Özü (tier kadar, nesille artar) + düşük ihtimalle yaratığın bir parçası.
   * Özel avlar (Alfa · Apex · Geçmiş Benlik · Ara boss · Hazine) CFG.ITEMS.kill tablosundan.
   * Dönüş: { kind, essence, items } (ödül yoksa null).
   */
  function onKill(game, e) {
    if (!e || e.noLoot || !game.inv) return null;
    const pos = e.group ? e.group.position : game.player.group.position;
    const kind = killKind(e);
    const donor = donorOf(e);
    const out = { kind, essence: 0, items: [] };
    if (kind) {
      const K = IC.kill[kind];
      out.essence = Math.round(K.ess * genMul(game));
      game.inv.essence += out.essence;
      out.items = rewardDrops(game, K, pos, K.announce, donor);
      if (K.announce) announce(game, kind, pos, out);
      return out;
    }
    const tier = ((e.def && e.def.tier) || 1) + ((e.variant || 1) - 1);
    let ess = tier;
    let chance = IC.dropChance * tier;
    let boost = 1;
    if (e.isChampion) {
      ess *= IC.champion.essMul;
      chance = Math.min(1, chance * IC.champion.dropMul);
      boost = IC.champion.boost;
    }
    out.essence = Math.round(ess * genMul(game));
    game.inv.essence += out.essence;
    if (Math.random() < chance) {
      const it = absorbPart(game, donor, rollRarity('drop', boost));
      dropAt(game, pos, it);
      out.items.push(it);
    }
    return out;
  }

  /* =========================================================
     Gen deposu işlemleri (inv.bag = depo; inv.chest eski API için boş)
     ========================================================= */
  function addTo(arr, it) {
    const i = arr.indexOf(null);
    if (i < 0) return false;
    arr[i] = it;
    return true;
  }

  const isStore = (w) => w === 'bag';

  /** where/idx doğrulanmış erişim: bag (depo sırası) ya da equip (bölge; eski yuva adı da olur). */
  function itemAt(inv, where, idx) {
    if (!inv) return null;
    if (where === 'equip') { const r = regionOf(idx); return r ? inv.equip[r] || null : null; }
    if (!isStore(where)) return null;
    const arr = inv[where];
    return Array.isArray(arr) && Number.isInteger(idx) && idx >= 0 && idx < arr.length ? arr[idx] || null : null;
  }

  function setAt(inv, where, idx, it) {
    if (where === 'equip') inv.equip[regionOf(idx)] = it;
    else inv[where][idx] = it;
  }

  function equipFrom(game, where, idx) {
    const inv = game.inv;
    if (!isStore(where)) return false;
    const it = itemAt(inv, where, idx);
    if (!it) return false;
    const old = inv.equip[it.slot];
    inv.equip[it.slot] = it;
    inv[where][idx] = old || null;
    changed(game, true);
    return true;
  }

  function unequip(game, slot) {
    const inv = game.inv;
    const it = itemAt(inv, 'equip', slot);
    if (!it || !addTo(inv.bag, it)) return false;
    inv.equip[it.slot] = null;
    changed(game, true);
    return true;
  }

  /** Eski çanta↔sandık taşıma: tek depoda anlamı yok (API uyumu için duruyor). */
  function move() { return false; }

  /* ---------------- evrimleştirme (+0 … +9) ---------------- */
  /** hedef seviyeye (p+1) çıkma bedeli: seviye, nadirlik ve mutasyon seviyesiyle büyür */
  function plusStepCost(it, p) {
    return Math.round(IC.plusCost[p] * IC.plusRarityMul[it.rarity] * (1 + IC.plusIlvl * it.ilvl));
  }

  function plusCost(it) {
    const p = plusOf(it);
    return p >= IC.plusMax ? Infinity : plusStepCost(it, p);
  }

  function plusInfo(it) {
    const p = plusOf(it);
    const max = p >= IC.plusMax;
    return {
      plus: p, max, next: max ? p : p + 1,
      chance: max ? 0 : IC.plusChance[p],
      cost: plusCost(it),
      risk: !max && p >= IC.plusDropFrom,
      bonus: IC.plusBonus[p], nextBonus: IC.plusBonus[max ? p : p + 1],
    };
  }

  /**
   * Evrimleştirme denemesi. Öz her durumda harcanır; başarıda +1 (parça büyür),
   * +6 ve üstündeyken başarısızlık bir kademe geriletir.
   * Dönüş: { ok, result: 'success'|'fail'|'drop'|'max'|'poor'|'none', from, to, cost, chance }
   */
  function enhance(game, where, idx) {
    const inv = game.inv;
    const it = itemAt(inv, where, idx);
    const res = { ok: false, result: 'none', from: 0, to: 0, cost: 0, chance: 0 };
    if (!it) return res;
    const info = plusInfo(it);
    res.from = res.to = info.plus;
    if (info.max) { res.result = 'max'; return res; }
    res.cost = info.cost;
    res.chance = info.chance;
    if (!(inv.essence >= info.cost)) { res.result = 'poor'; return res; }
    inv.essence -= info.cost;
    if (Math.random() < info.chance) {
      it.plus = info.plus + 1;
      res.ok = true;
      res.result = 'success';
      if (it.plus >= 7) U.audio.evolve(); else U.audio.levelUp();
    } else if (info.risk) {
      it.plus = info.plus - 1;
      res.result = 'drop';
      U.audio.die();
    } else {
      res.result = 'fail';
      U.audio.hurt();
    }
    res.to = it.plus;
    rename(it);
    if (where === 'equip' && res.to !== res.from) changed(game, true);
    return res;
  }

  /* ---------------- emilim / üretim / nadirlik ---------------- */
  function salvageValue(it) {
    let spent = 0;
    for (let p = 0; p < plusOf(it); p++) spent += plusStepCost(it, p);
    return Math.round(IC.salvage[it.rarity] * (1 + it.ilvl * 0.25)) + Math.round(spent * IC.plusRefund);
  }

  /** Emilim: mutasyonu Gen Özü'ne çevirir. */
  function salvage(game, where, idx) {
    const inv = game.inv;
    const it = itemAt(inv, where, idx);
    if (!it) return 0;
    const v = salvageValue(it);
    setAt(inv, where, idx, null);
    if (where === 'equip') changed(game, true);
    inv.essence += v;
    return v;
  }

  /** Mutasyon üret: seçilen bölge için aşamanın yaratıklarından rastgele parça. */
  function craft(game, slot) {
    const inv = game.inv;
    const reg = regionOf(slot);
    if (!reg) return null;
    if (inv.essence < IC.craftCost) return null;
    if (inv.bag.indexOf(null) < 0) return null;
    inv.essence -= IC.craftCost;
    const it = randomItem(game, 'craft', 1, reg);
    addTo(inv.bag, it);
    U.audio.evolve();
    return it;
  }

  function upgradeCost(it) { return it.rarity >= 4 ? Infinity : Math.round(IC.upgradeCost[it.rarity] * (1 + it.ilvl * 0.2)); }

  /** Nadirlik yükseltme (evrimleştirmeden ayrı): + seviyesi korunur. */
  function upgrade(game, where, idx) {
    const inv = game.inv;
    const it = itemAt(inv, where, idx);
    if (!it || it.rarity >= 4) return false;
    const cost = upgradeCost(it);
    if (inv.essence < cost) return false;
    inv.essence -= cost;
    it.rarity++;
    while (it.affixes.length < R[it.rarity].affixes) addAffix(it);
    if (it.rarity === 4 && !it.unique) setUnique(it, pickUnique(it.slot, it.kind));
    rollSet(it);
    rename(it);
    if (where === 'equip') changed(game, true);
    U.audio.levelUp();
    return true;
  }

  /** Statları yeniden hesapla; beden değiştiyse oyuncuyu yeniden kur (mutasyonlar görünsün). */
  function changed(game, body) {
    EV.Build.recompute(game);
    if (body) refreshBody(game);
  }

  function refreshBody(game) {
    const P = game && game.player;
    if (!P || !P.group || !game.scene || !EV.Player || !EV.Player.rebuild) return;
    const pitch = P.pitch;
    try { EV.Player.rebuild(game); } catch (err) { console.warn('Beden yenilenemedi:', err); }
    P.pitch = pitch;                       // rebuild kamerayı aşamanın açısına sıfırlar; panelde bakış değişmesin
  }

  /** Özellik satırları (etkin değerler); plus verilirse o seviye için. */
  function affixText(it, plus) {
    return it.affixes.map((a) => EV.DATA.modText(a.k, value(it, a, plus)));
  }

  function describe(it) {
    const lines = affixText(it);
    if (it.unique) lines.push('★ ' + it.unique.desc);
    if (it.set && SET[it.set]) lines.push(SET[it.set].icon + ' ' + SET[it.set].name + ' uyumu');
    return lines;
  }

  /* verici kimliği → yaratığın adı ("Oklu Kirpi'den emildi") */
  const DONOR_NAME = { nemesis: 'Geçmiş Benliğin' };
  (function buildNames() {
    const M = EV.MOBS || {};
    const add = (d) => { if (d && d.id && d.name && !own(DONOR_NAME, d.id)) DONOR_NAME[d.id] = d.name; };
    (M.ENEMIES || []).forEach((pool) => pool.forEach(add));
    (M.MINIS || []).forEach((pool) => pool.forEach(add));
    [M.ALPHAS, M.APEX, M.TREASURE].forEach((list) => (list || []).forEach(add));
  })();

  /** Parçanın türü, simgesi, adı ve vericisi (arayüz için). */
  function partInfo(it) {
    const k = own(KINDS, it.kind) ? KINDS[it.kind] : null;
    const from = it.src && own(DONOR_NAME, it.src) ? DONOR_NAME[it.src] + ' parçası' : '';
    return { kind: k ? k.name : '', icon: k ? k.icon : SLOT[it.slot].icon, part: partName(it), from };
  }

  const depotCount = (inv) => (inv && Array.isArray(inv.bag) ? inv.bag.filter(Boolean).length : 0);

  /* ---------------- kayıt ---------------- */
  function serialize(inv) {
    const s = (it) => (it ? { slot: it.slot, rarity: it.rarity, ilvl: it.ilvl, plus: plusOf(it), bv: it.bv | 0, set: it.set || null,
      affixes: it.affixes, unique: it.unique ? it.unique.name : null, kind: it.kind || null, src: it.src || null, di: it.di | 0 } : null);
    const equip = {};
    SLOTS.forEach((sl) => { equip[sl.id] = s(inv.equip[sl.id]); });
    return { mv: 1, bag: inv.bag.map(s), chest: [], equip, essence: inv.essence };
  }

  const intIn = (v, a, b) => U.clamp(Math.round(Number(v)) || 0, a, b);

  /**
   * Kayıttan mutasyon: her alan doğrulanır/kırpılır; bozuk kayıt atılır ama oyun çökmez.
   * ESKİ EŞYALAR: yuva adı bölgeye çevrilir (fang→jaw, relic→head, organ→back, claw→claws),
   * nadirlik/basma(+)/özellikler/takım korunur; adlı efsaneviler eski adlarından bulunur.
   */
  function revive(d) {
    if (!d || typeof d !== 'object') return null;
    const reg = regionOf(d.slot);
    if (!reg) return null;
    const rar = intIn(d.rarity, 0, 4);
    const it = { uid: uidSeq++, slot: reg, rarity: rar, ilvl: U.clamp(Number(d.ilvl) | 0, 0, 12),
      plus: intIn(d.plus, 0, IC.plusMax), bv: intIn(d.bv, 0, 3), set: null, affixes: [], unique: null, name: '',
      kind: null, src: null, di: 0 };
    const list = Array.isArray(d.affixes) ? d.affixes : [];
    for (let i = 0; i < list.length && it.affixes.length < R[rar].affixes; i++) {
      const a = list[i];
      if (!a || !own(AFFIX, a.k) || !SLOT[reg].pool.includes(a.k) || it.affixes.some((x) => x.k === a.k)) continue;
      it.affixes.push({ k: a.k, roll: U.clamp(Number(a.roll) || 0.85, 0.7, 1) });
    }
    while (it.affixes.length < R[rar].affixes) addAffix(it);
    // parça: kayıtlı verici geçerliyse o; değilse (eski eşya) bv'ye göre kalıcı genel ad ve tür
    const de = typeof d.src === 'string' ? donorEntry(d.src, d.di) : null;
    if (de && de.region === reg) { it.src = d.src; it.di = Number(d.di) | 0; it.kind = de.kind; }
    else it.kind = genericEntry(it).kind;
    if (kindOk(d.kind, reg) && !de) it.kind = d.kind;
    if (rar === 4) {
      const cands = UNIQUES.filter((u) => u.region === reg);
      const name = typeof d.unique === 'string' ? d.unique : '';
      setUnique(it, cands.find((u) => u.name === name) || cands.find((u) => u.old === name) || (cands.length ? U.pick(cands) : null));
    }
    if (rar >= 2 && own(SET, d.set)) it.set = d.set;
    rename(it);
    return it;
  }

  /** Kayıttan envanter. Eski çanta + sandık tek Gen deposunda birleşir (sıkıştırılır). */
  function deserialize(d) {
    const inv = freshInv();
    if (!d || typeof d !== 'object') return inv;
    const arr = (x) => (Array.isArray(x) ? x : []);
    let n = 0;
    const put = (x) => { if (n >= DEPOT) return; const it = revive(x); if (it) inv.bag[n++] = it; };
    arr(d.bag).slice(0, DEPOT).forEach(put);
    arr(d.chest).slice(0, DEPOT).forEach(put);
    const eq = d.equip && typeof d.equip === 'object' ? d.equip : {};
    let lostEss = 0;
    // yeni bölge adları önce, sonra eski yuva adları (kayıt ikisini de içerebilir)
    const keys = SLOTS.map((s) => s.id).concat(SLOTS.map((s) => s.old)).filter((k, i, a) => a.indexOf(k) === i);
    keys.forEach((key) => {
      if (!own(eq, key)) return;
      const it = revive(eq[key]);
      if (!it) return;
      if (regionOf(key) === it.slot && !inv.equip[it.slot]) { inv.equip[it.slot] = it; return; }
      if (!addTo(inv.bag, it)) lostEss += salvageValue(it);    // yanlış bölgedeki mutasyon kaybolmasın: depoya, o doluysa öze
    });
    const e = Number(d.essence);
    inv.essence = (Number.isFinite(e) ? U.clamp(e, 0, 1e9) : 0) + lostEss;
    inv.essence = U.clamp(inv.essence, 0, 1e9);
    return inv;
  }

  return {
    SLOTS, SLOT, REGIONS: SLOTS, KINDS, DONORS, UNIQUES, SETS, SET, AFFIX,
    freshInv, makeItem, mods, hooks, onKill, dropAt, spawnChests, update, clear,
    equipFrom, unequip, move, salvage, salvageValue, craft, upgrade, upgradeCost,
    enhance, plusCost, plusInfo, setCount, activeSets,
    describe, affixText, partInfo, serialize, deserialize, value,
    bodyMutations, regionOf, donorParts, depotCount, refreshBody,
    get groundCount() { return ground.length; }, get chestCount() { return chests.length; },
    get depotSize() { return DEPOT; },
  };
})();
