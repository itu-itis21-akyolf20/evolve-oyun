// Esc: pencere yokken liderlik açılır; çanta/yapı açıkken sadece onları kapatır
T.start('normal');
T.sim(2, { dt: 1 / 30 });
const G = EV.Game;
const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
const lb = () => EV.Online.isOpen();
const r = {};
key('Escape'); r.escOpensLb = lb() && G.paused;
key('Escape'); r.escClosesLb = !lb();
key('Tab'); r.invOpen = EV.Inv.isOpen();
key('Escape'); r.escClosesInvOnly = !EV.Inv.isOpen() && !lb();
key('KeyK'); r.buildOpen = EV.Cards.which === 'build';
key('Escape'); r.escClosesBuildOnly = EV.Cards.which !== 'build' && !lb();
key('KeyL'); r.lOpens = lb();
key('KeyL'); r.lCloses = !lb();
return r;
