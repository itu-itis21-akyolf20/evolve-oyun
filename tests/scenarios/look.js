// Görsel kontrol: 25 sn oyna, sonra kamerayı kendimize çevirip dur
T.start('normal');
T.sim(25, { dt: 1 / 30 });
const G = EV.Game; G.paused = true;
G.player.pitch = 0.45;
return T.state();
