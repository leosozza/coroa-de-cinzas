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
    const played = { w:[], b:[] };
    for (let step = 0; step < 900 && !s.over && s.hist.length < 200; step++){
      const side = ARC.actor(s), r = ARC.choose(s, side, +LV);
      if (!r.action) break;
      if (r.action.type === 'card'){ const c = s.arc.hand[side].find(x => x.uid === r.action.uid); if (c) played[side].push(c.id); }
      const x = ARC.apply(s, r.action);
      if (!x.ok) throw new Error(`ação inválida: ${JSON.stringify(r.action)} ${x.err}`);
      s = x.state;
    }
    const o = s.over;
    games.push({ w:dw, b:db, res:o && o.kind === 'mate' ? (o.winner === 'w' ? 1 : 0) : 0.5, fim:o ? o.kind : 'limite', lances:s.hist.length, played });
  }
  console.log(JSON.stringify({ nivel:+LV, games }));
} else if (MODE === 'merge'){
  const all = []; let lv = null;
  for (const f of args){ const d = JSON.parse(fs.readFileSync(f, 'utf8')); lv = d.nivel; all.push(...d.games); }
  const st = {}, cs = {}, sideS = { w:0, n:0 }, fins = {};
  const add = (o, k, pts) => { const e = o[k] || (o[k] = { j:0, p:0 }); e.j++; e.p += pts; };
  for (const g of all){
    add(st, g.w, g.res); add(st, g.b, 1 - g.res);
    sideS.w += g.res; sideS.n++;
    fins[g.fim] = (fins[g.fim] || 0) + 1;
    for (const id of new Set(g.played.w)) add(cs, id, g.res);
    for (const id of new Set(g.played.b)) add(cs, id, 1 - g.res);
  }
  const pct = e => (e.p / e.j * 100).toFixed(1);
  const flag = e => e.j < 15 ? 'amostra pequena' : +pct(e) > 55 ? 'ACIMA de 55%' : +pct(e) < 45 ? 'abaixo de 45%' : 'ok';
  const out = [`# Balanceamento do Arcano (IA nível ${lv}, ${all.length} partidas)`, '', `Fins: ${Object.entries(fins).map(([k, v]) => `${k} ${v}`).join(', ')}. Pontos das Brancas: ${(sideS.w / sideS.n * 100).toFixed(1)}% (vitória 1, empate 0,5).`, '',
    '| Grimório | Jogos | Pontos | Critério |', '|---|---|---|---|'];
  for (const [k, e] of Object.entries(st)) out.push(`| ${k} | ${e.j} | ${pct(e)}% | ${flag(e)} |`);
  out.push('', '| Carta | Partidas em que foi jogada | Pontos de quem jogou | Critério |', '|---|---|---|---|');
  for (const [k, e] of Object.entries(cs).sort((a, b) => b[1].p / b[1].j - a[1].p / a[1].j)) out.push(`| ${k} | ${e.j} | ${pct(e)}% | ${flag(e)} |`);
  console.log(out.join('\n'));
}
