// Harness de balanceamento do Arcano: lotes de partidas IA x IA e taxa de vitória por deck e por carta.
// node balance.js <html|motor.js> <cartas.json> [partidas=200] [plies=240] [seed=1]
// Política provisória (a IA com cartas é a Fase E): captura a peça mais valiosa, dá xeque quando pode, senão sorteia;
// joga uma carta jogável com 60% de chance. Critério da Fase E: nenhum deck nem carta acima de 55% de vitória.
const fs = require('fs');
const [, , SRC, CATF, N = '200', MAXP = '240', SEED = '1'] = process.argv;
const src = fs.readFileSync(SRC, 'utf8');
const code = SRC.endsWith('.html') ? src.slice(src.indexOf('/* ---------- Motor do Modo Arcano'), src.indexOf('/* ---------- fim do motor do Arcano')) : src;
const ARC = new Function(code + '\nreturn arcanoRules;')()(JSON.parse(fs.readFileSync(CATF, 'utf8')).cartas);
const VAL = { p:1, n:3, b:3, r:5, q:9, k:0 };
let seed = +SEED >>> 0;
const R = () => { seed = (seed + 0x6D2B79F5) >>> 0; let x = Math.imul(seed ^ (seed >>> 15), seed | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const decks = Object.keys(ARC.DECKS), deckStat = {}, cardStat = {}, kinds = {};
const bump = (o, k, w) => { const e = o[k] || (o[k] = { jogos:0, vitorias:0, empates:0 }); e.jogos++; if (w === 1) e.vitorias++; else if (w === 0.5) e.empates++; };
for (let g = 0; g < +N; g++){
  const dw = decks[g % decks.length], db = decks[Math.floor(g / decks.length) % decks.length];
  let s = ARC.create(1000 + g, { w:dw, b:db });
  const played = { w:new Set(), b:new Set() };
  for (let ply = 0; ply < +MAXP * 3 && !s.over; ply++){
    const acts = ARC.legalActions(s);
    if (!acts.length) break;
    let a;
    if (acts[0].type === 'move'){
      const caps = acts.filter(x => /x/.test(x.san)).sort((x, y) => VAL[(ARC.status(s), 'p')] - 0);
      const best = acts.map(x => ({ x, v:(/#/.test(x.san) ? 100 : 0) + (/\+/.test(x.san) ? 2 : 0) + (/x/.test(x.san) ? 3 : 0) + R() })).sort((p, q) => q.v - p.v);
      a = best[0].x; void caps;
    } else {
      const cards = acts.filter(x => x.type === 'card');
      a = cards.length && R() < 0.6 ? cards[Math.floor(R() * cards.length)] : acts[0];
      if (a.type === 'card') played[ARC.actor(s)].add(a.id);
    }
    const r = ARC.apply(s, a);
    if (!r.ok) throw new Error('ação recusada: ' + JSON.stringify(a) + ' ' + r.err);
    s = r.state;
    if (s.hist.length >= +MAXP) break;
  }
  const o = s.over, res = o && o.kind === 'mate' ? (o.winner === 'w' ? 1 : 0) : 0.5;
  kinds[o ? o.kind : 'limite'] = (kinds[o ? o.kind : 'limite'] || 0) + 1;
  bump(deckStat, dw, res); bump(deckStat, db, 1 - res);
  for (const id of played.w) bump(cardStat, id, res);
  for (const id of played.b) bump(cardStat, id, 1 - res);
}
const pct = e => ((e.vitorias + e.empates / 2) / e.jogos * 100).toFixed(1);
const row = (k, e) => `| ${k} | ${e.jogos} | ${e.vitorias} | ${e.empates} | ${pct(e)}% | ${+pct(e) > 55 ? 'ACIMA de 55%' : 'ok'} |`;
console.log(`Partidas: ${N} · fins: ${JSON.stringify(kinds)}\n\n| Deck | Jogos | Vitórias | Empates | Pontos | Critério |\n|---|---|---|---|---|---|`);
for (const [k, e] of Object.entries(deckStat)) console.log(row(k, e));
console.log('\n| Carta | Jogos em que foi jogada | Vitórias | Empates | Pontos | Critério |\n|---|---|---|---|---|---|');
for (const [k, e] of Object.entries(cardStat).sort((a, b) => b[1].jogos - a[1].jogos)) console.log(row(k, e));
