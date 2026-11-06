// Balanceamento do Arcano com a IA de verdade (ARC.choose nos dois lados).
// Lote:   node tools/arcano-balance.js run <html|engine/arcano-rules.js> data/cartas.json <partidas> <nível> <semente> > lote.json
// Tabela: node tools/arcano-balance.js merge lote1.json lote2.json ... > relatorio.md
// Os grimórios giram nas 9 combinações (com espelho) e trocam de lado. Meta: nenhum deck nem carta acima de 55%.
const fs = require('fs');
const [, , MODE, ...args] = process.argv;
if (MODE === 'run'){
  const [SRC, CATF, N = '36', LV = '2', SEED = '1'] = args;
  const src = fs.readFileSync(SRC, 'utf8'), A = '/* ---------- Motor do Modo Arcano', Z = '/* ---------- fim do motor do Arcano';
  const ARC = new Function(src.slice(src.indexOf(A), src.indexOf(Z)) + '\nreturn arcanoRules;')()(JSON.parse(fs.readFileSync(CATF, 'utf8')).cartas);
  const decks = Object.keys(ARC.DECKS), games = [];
  for (let g = 0; g < +N; g++){
    const k = (g + +SEED) % 9, dw = decks[k % 3], db = decks[Math.floor(k / 3)];
    let s = ARC.create(1000 * +SEED + g, { w:dw, b:db });
    const played = { w:[], b:[] }, loot = { w:[], b:[] };
    for (let step = 0; step < 900 && !s.over && s.hist.length < 200; step++){
      const side = ARC.actor(s), r = ARC.choose(s, side, +LV);
      if (!r.action) break;
      if (r.action.type === 'card'){ const c = s.arc.hand[side].find(x => x.uid === r.action.uid); if (c) played[side].push(c.id); }
      const x = ARC.apply(s, r.action);
      if (!x.ok) throw new Error(`ação inválida: ${JSON.stringify(r.action)} ${x.err}`);
      for (const e of x.events || []) if (e.k === 'loot' && loot[e.side]) loot[e.side].push(e.piece);
      s = x.state;
    }
    const o = s.over;
    games.push({ w:dw, b:db, res:o && o.kind === 'mate' ? (o.winner === 'w' ? 1 : 0) : 0.5, fim:o ? o.kind : 'limite', lances:s.hist.length, played, loot });
  }
  console.log(JSON.stringify({ nivel:+LV, games }));
} else if (MODE === 'merge'){
  // Ajuste: cada partida conta pontos − média da célula (lado × grimório × grimório do rival); 50% = neutro.
  // Assim a vantagem das Brancas e o confronto não inflam deck nem carta. ± = margem aproximada de 95%.
  const all = []; let lv = null;
  for (const f of args){ const d = JSON.parse(fs.readFileSync(f, 'utf8')); lv = d.nivel; all.push(...d.games); }
  const rows = [];
  for (const g of all) for (const side of ['w', 'b']){
    const me = g[side], op = g[side === 'w' ? 'b' : 'w'], pts = side === 'w' ? g.res : 1 - g.res;
    rows.push({ side, me, op, pts, played:new Set(g.played[side] || []), loot:new Set((g.loot && g.loot[side]) || []) });
  }
  const cell = {};
  for (const r of rows){ const k = r.side + '|' + r.me + '|' + r.op, c = cell[k] || (cell[k] = { n:0, p:0 }); c.n++; c.p += r.pts; }
  const sideMean = s => { const R = rows.filter(r => r.side === s); return R.reduce((a, r) => a + r.pts, 0) / R.length; };
  // grimório: desconta só o lado (o confronto é o que se quer medir)
  const sm = { w:sideMean('w'), b:sideMean('b') };
  for (const r of rows){ const c = cell[r.side + '|' + r.me + '|' + r.op]; r.dev = r.pts - c.p / c.n; r.devSide = r.pts - sm[r.side]; }
  const stat = (R, key) => { const n = R.length, m = R.reduce((a, r) => a + r[key], 0) / n, v = R.reduce((a, r) => a + (r[key] - m) ** 2, 0) / Math.max(1, n - 1); return { n, m, e:1.96 * Math.sqrt(v / n) }; };
  const P = x => (x * 100).toFixed(1) + '%', PM = x => '±' + (x * 100).toFixed(1);
  const flag = (n, v, e) => n < 20 ? 'amostra pequena' : v - e > 0.55 ? 'ACIMA de 55% (certo)' : v > 0.55 ? 'acima de 55% (provável)' : v + e < 0.45 ? 'abaixo de 45% (certo)' : v < 0.45 ? 'abaixo de 45% (provável)' : 'ok';
  const fins = {}; for (const g of all) fins[g.fim] = (fins[g.fim] || 0) + 1;
  const W = stat(rows.filter(r => r.side === 'w'), 'pts');
  const out = [`# Balanceamento do Arcano (IA nível ${lv}, ${all.length} partidas)`, '', `Fins: ${Object.entries(fins).map(([k, v]) => `${k} ${v}`).join(', ')}. Pontos das Brancas: ${P(W.m)} ${PM(W.e)} (vitória 1, empate 0,5).`, '',
    '| Grimório | Jogos | Bruto | Ajustado ao lado | Critério |', '|---|---|---|---|---|'];
  for (const d of [...new Set(rows.map(r => r.me))]){ const R = rows.filter(r => r.me === d), b = stat(R, 'pts'), a = stat(R, 'devSide'); out.push(`| ${d} | ${R.length} | ${P(b.m)} | ${P(0.5 + a.m)} ${PM(a.e)} | ${flag(R.length, 0.5 + a.m, a.e)} |`); }
  out.push('', '| Grimório | contra | Jogos | Ajustado ao lado |', '|---|---|---|---|');
  for (const k of Object.keys(cell).filter(k => k.startsWith('w|')).map(k => k.slice(2)).sort()){
    const [me, op] = k.split('|'), R = rows.filter(r => r.me === me && r.op === op), a = stat(R, 'devSide'); out.push(`| ${me} | ${op} | ${R.length} | ${P(0.5 + a.m)} ${PM(a.e)} |`);
  }
  out.push('', '| Carta | Grimório | Partidas em que foi jogada | Bruto | Ajustado (lado e confronto) | Critério |', '|---|---|---|---|---|---|');
  const ids = [...new Set(rows.flatMap(r => [...r.played]))];
  const cards = ids.map(id => { const R = rows.filter(r => r.played.has(id)), b = stat(R, 'pts'), a = stat(R, 'dev'), dk = {}; for (const r of R) dk[r.me] = (dk[r.me] || 0) + 1; return { id, n:R.length, b:b.m, a:0.5 + a.m, e:a.e, deck:Object.entries(dk).sort((x, y) => y[1] - x[1])[0][0] }; });
  for (const c of cards.sort((x, y) => y.a - x.a)) out.push(`| ${c.id} | ${c.deck} | ${c.n} | ${P(c.b)} | ${P(c.a)} ${PM(c.e)} | ${flag(c.n, c.a, c.e)} |`);
  // espólios: só aparecem para quem já capturou a peça (vantagem de material). Controle: quem ganhou o espólio e jogou × quem ganhou e não jogou
  if (rows.some(r => r.loot.size)){
    out.push('', '| Espólio | Peça capturada | Ganhou e jogou | Ganhou e não jogou | Efeito da carta |', '|---|---|---|---|---|');
    for (const [pc, id] of Object.entries({ q:'coroa-raio', n:'ferradura-salto', p:'lanca-fiel', r:'pedra-terra', b:'grimorio-arcano' })){
      const got = rows.filter(r => r.loot.has(pc)), a = got.filter(r => r.played.has(id)), b = got.filter(r => !r.played.has(id));
      if (!got.length) continue;
      const m = R => R.length ? stat(R, 'dev') : null, A = m(a), B = m(b);
      out.push(`| ${id} | ${pc} | ${a.length ? P(0.5 + A.m) + ' (' + a.length + ')' : '-'} | ${b.length ? P(0.5 + B.m) + ' (' + b.length + ')' : '-'} | ${A && B ? ((A.m - B.m) * 100 >= 0 ? '+' : '') + ((A.m - B.m) * 100).toFixed(1) + ' p.p.' : '-'} |`);
    }
  }
  console.log(out.join('\n'));
}
