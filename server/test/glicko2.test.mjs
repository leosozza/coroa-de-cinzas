// Glicko-2 contra o exemplo do artigo de Glickman (r 1500, RD 200, σ 0,06 contra 1400/30 V, 1550/100 D, 1700/300 D)
import { rate, duel, aged, league } from '../src/glicko2.js';
let fails = 0; const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol){ fails++; console.log('FALHOU', m, a, 'esperado', b); } };
const x = rate({ r:1500, rd:200, vol:0.06 }, [{ r:1400, rd:30, score:1 }, { r:1550, rd:100, score:0 }, { r:1700, rd:300, score:0 }]);
near(x.r, 1464.06, 0.05, 'r'); near(x.rd, 151.52, 0.05, 'rd'); near(x.vol, 0.05999, 0.00001, 'vol');
// dois estreantes: o vencedor sobe o que o perdedor desce; empate entre iguais não muda a nota
const now = Date.now(), n = { r:1500, rd:350, vol:0.06, updated:now };
const [w, l] = duel(n, n, 1, now); near(w.r - 1500, 1500 - l.r, 0.001, 'simetria'); if (!(w.r > 1600 && w.rd < 350)) { fails++; console.log('FALHOU estreia', w); }
const [d1, d2] = duel(n, n, 0.5, now); near(d1.r, 1500, 0.001, 'empate'); near(d2.r, 1500, 0.001, 'empate');
// desvio cresce com dias parado, sem passar de 350
near(aged({ r:1500, rd:50, vol:0.06, updated:now - 365 * 86400000 }, now).rd, Math.min(350, Math.sqrt((50 / 173.7178) ** 2 + 365 * 0.0036) * 173.7178), 0.01, 'envelhece');
if (league(1199).id !== 'aprendiz' || league(1200).id !== 'alquimista' || league(1500).id !== 'mestre' || league(1800).id !== 'inquisidor' || league(1300, 12, true).id !== 'grao-mestre' || league(1300, 12, false).id !== 'alquimista'){ fails++; console.log('FALHOU ligas'); }
console.log(JSON.stringify({ exemplo:{ r:+x.r.toFixed(2), rd:+x.rd.toFixed(2), vol:+x.vol.toFixed(5) }, estreia:{ venc:+w.r.toFixed(1), perd:+l.r.toFixed(1), rd:+w.rd.toFixed(1) }, fails }));
process.exit(fails ? 1 : 0);
