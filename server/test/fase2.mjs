// Fase 2 (a): fila do Arcano (ranqueada e casual, 12+5, grimório na entrada), perfil e replays reproduzíveis pelo motor.
// Uso: wrangler dev local rodando (.dev.vars de teste, migração 0003 aplicada):  node test/fase2.mjs [http://127.0.0.1:8787]
import arcanoRules from '../../engine/arcano-rules.js';
import catalog from '../../data/cartas.json' with { type:'json' };
const ARC = arcanoRules(catalog.cartas);
const BASE = process.argv[2] || 'http://127.0.0.1:8787', WSB = BASE.replace(/^http/, 'ws');
let fails = 0, passes = 0, STEP = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FALHOU:', m); } };
async function api(path, o = {}){
  const r = await fetch(BASE + path, { method:o.body ? 'POST' : 'GET', headers:{ 'content-type':'application/json', ...(o.token ? { Authorization:'Bearer ' + o.token } : {}) }, body:o.body ? JSON.stringify(o.body) : undefined });
  let j = null; try { j = await r.json(); } catch (e){}
  return { status:r.status, j };
}
const guest = async name => (await api('/api/guest', { body:{ name } })).j;
function sock(path, token, extra = {}){
  const ws = new WebSocket(WSB + path), msgs = [], W = [];
  const c = { msgs, last:null, seat:null, send:o => ws.send(JSON.stringify(o)), close:() => ws.close(),
    act:a => c.send({ t:'act', a }),
    wait:(f, ms = 15000) => new Promise((res, rej) => {
      const g = m => { try { return f(m); } catch (e){ return false; } };
      const h = msgs.find(g); if (h) return res(h);
      const w = { g, res }; W.push(w);
      setTimeout(() => { const i = W.indexOf(w); if (i >= 0){ W.splice(i, 1); rej(new Error(`tempo esgotado na etapa ${STEP}: ${String(f).slice(0, 80)} · últimas ${JSON.stringify(msgs.slice(-2).map(m => ({ t:m.t, n:m.n, err:m.err, status:m.status })))}`)); } }, ms);
    }) };
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); msgs.push(m); if (m.t === 'state') c.last = m; if (m.t === 'welcome') c.seat = m.you.seat; for (const w of W.slice()) if (w.g(m)){ W.splice(W.indexOf(w), 1); w.res(m); } });
  ws.addEventListener('open', () => c.send({ t:'hello', token, ...extra }));
  return c;
}
const st = f => m => m.t === 'state' && m.state && f(m);
// joga um turno do Arcano a partir do estado exato do servidor (n): carta opcional ANTES do lance, e o lance (que encerra o turno)
async function arcTurn(P, n, prefer, card){
  const m0 = await P.wait(st(m => m.n === n && ARC.actor(m.state) === P.seat && m.state.arc.phase === 'move'));
  let k = n, played = null, cur = m0.state;
  if (card){
    const c = ARC.legalActions(cur, P.seat).find(a => a.type === 'card');
    // a carta válida na vista do jogador sempre conta uma ação (até anulada por Contrafeitiço); espera exatamente o próximo n
    if (c){ P.act({ type:'card', uid:c.uid, picks:c.picks }); const m2 = await P.wait(st(m => m.n === k + 1), 15000); k++; played = c.id; cur = m2.state; }
  }
  const ms = ARC.legalActions(cur, P.seat).filter(a => a.type === 'move');
  const mv = ms.find(a => prefer && a.from === prefer[0] && a.to === prefer[1]) || ms[0];
  P.act({ type:'move', from:mv.from, to:mv.to, promotion:mv.promotion });
  const m3 = await P.wait(st(m => m.n === k + 1));
  if (m3.status === 'playing' && ARC.actor(m3.state) === P.seat) throw new Error('o lance não encerrou o turno');
  return { n:k + 1, played };
}
function replay(R){
  let s = R.mode === 'arcano' ? ARC.create({ seed:R.seed, decks:R.decks, oracle:'previsto' }) : ARC.create({ seed:R.seed, pure:true });
  let okAll = true, cards = 0;
  for (const a of R.actions){ const r = ARC.apply(s, a); if (!r.ok){ okAll = false; break; } s = r.state; if (a.type === 'card') cards++; }
  return { s, okAll, cards };
}

async function main(){
  STEP = 0;
  const cfg = (await api('/api/config')).j;
  ok(cfg.queues['arcano-ranked'].join() === '12+5' && cfg.queues['arcano-casual'].join() === '12+5' && cfg.decks.join() === 'tempestade,cinzas,arcano', 'config com as filas do Arcano e os grimórios');
  ok((await api('/api/queue/arcano-ranked/10+0/ws')).status === 404, 'Arcano só em 12+5');

  // 1) grimório inválido é recusado na entrada da fila
  STEP = 1;
  const A = await guest('Ana Arcana'), B = await guest('Beto Cinza');
  const bad = sock('/api/queue/arcano-ranked/12+5/ws', A.token, { deck:'nao-existe' });
  const be = await bad.wait(m => m.t === 'error'); ok(be.code === 'deck', 'grimório inválido recusado');
  const nod = sock('/api/queue/arcano-casual/12+5/ws', A.token);
  ok((await nod.wait(m => m.t === 'error')).code === 'deck', 'sem grimório também é recusado');

  // 2) ranqueada do Arcano: cada um com o seu grimório, partida com carta, desistência; nota só no Arcano
  STEP = 2;
  const qa = sock('/api/queue/arcano-ranked/12+5/ws', A.token, { deck:'cinzas' });
  const qd = await qa.wait(m => m.t === 'queued'); ok(qd.mode === 'arcano' && qd.deck === 'cinzas' && qd.r === 1500, 'na fila do Arcano com o grimório');
  const qb = sock('/api/queue/arcano-ranked/12+5/ws', B.token, { deck:'arcano' });
  const ma = await qa.wait(m => m.t === 'match'), mb = await qb.wait(m => m.t === 'match');
  ok(ma.room === mb.room && ma.mode === 'arcano' && ma.ranked && ma.tc === '12+5' && ma.deck === 'cinzas' && mb.deck === 'arcano', 'pareados no Arcano ranqueado');
  const [WT, BT] = ma.color === 'w' ? [A, B] : [B, A], deckOf = { [A.user.id]:'cinzas', [B.user.id]:'arcano' };
  const w = sock(`/api/rooms/${ma.room}/ws`, WT.token); await w.wait(m => m.t === 'welcome');
  const b = sock(`/api/rooms/${ma.room}/ws`, BT.token); await b.wait(m => m.t === 'welcome');
  const s0 = await w.wait(st(m => m.status === 'playing'));
  ok(s0.state.arc.decks.w === deckOf[WT.user.id] && s0.state.arc.decks.b === deckOf[BT.user.id], 'sala com os grimórios escolhidos: ' + JSON.stringify(s0.state.arc.decks));
  ok(s0.clocks.w === 12 * 60000 && s0.clocks.inc === 5000, 'relógio 12+5');
  let n = 0, cardsPlayed = [];
  const plan = [[w, ['e2', 'e4']], [b, ['e7', 'e5']], [w, ['g1', 'f3']], [b, ['b8', 'c6']], [w, ['f1', 'c4']], [b, ['g8', 'f6']]];
  for (const [P, pref] of plan){ const r = await arcTurn(P, n, pref, true); n = r.n; if (r.played) cardsPlayed.push(r.played); }
  ok(cardsPlayed.length >= 1, 'cartas jogadas: ' + cardsPlayed.join(', '));
  // a posição exata depois da última ação (o socket das Brancas pode ainda não ter recebido o último lance das Pretas)
  const lastSeen = (await w.wait(st(m => m.n === n))).state;
  b.send({ t:'resign' });
  const over = await w.wait(st(m => m.status === 'over'));
  ok(over.result.score === '1-0' && over.result.reason === 'desistencia' && over.result.rating && over.result.rating.w.delta > 0, 'ranqueada do Arcano com nota: ' + JSON.stringify(over.result.rating));
  w.close(); b.close();
  const meW = (await api('/api/me', { token:WT.token })).j.ratings, meB = (await api('/api/me', { token:BT.token })).j.ratings;
  ok(meW.arcano.games === 1 && meW.arcano.r === over.result.rating.w.after && meW.xadrez.games === 0 && meW.xadrez.r === 1500, 'nota do Arcano separada da do Xadrez Puro');
  ok(meB.arcano.games === 1 && meB.arcano.r < 1500, 'perdedor desce no Arcano');

  // 3) perfil
  STEP = 3;
  const pw = (await api('/api/profile/' + WT.user.id)).j;
  ok(pw.user.name === WT.user.name && pw.ratings.arcano.games === 1 && pw.ratings.arcano.league && pw.ratings.xadrez.league, 'perfil com notas e ligas dos dois modos');
  ok(pw.stats.arcano.w === 1 && pw.stats.arcano.l === 0 && pw.stats.xadrez.w === 0, 'vitórias por modo: ' + JSON.stringify(pw.stats));
  ok(pw.deck && pw.deck.id === deckOf[WT.user.id] && pw.deck.games === 1, 'grimório mais usado: ' + JSON.stringify(pw.deck));
  const g0 = pw.recent[0];
  ok(g0 && g0.id === ma.room && g0.mode === 'arcano' && g0.ranked && g0.outcome === 'vitoria' && g0.color === 'w' && g0.opponent.name === BT.user.name && g0.delta === over.result.rating.w.delta && g0.replay, 'última partida no perfil: ' + JSON.stringify(g0));
  const pb = (await api('/api/profile/' + BT.user.id)).j;
  ok(pb.stats.arcano.l === 1 && pb.recent[0].outcome === 'derrota' && pb.recent[0].delta < 0, 'perfil do perdedor');
  ok((await api('/api/profile/g_naoexiste00')).status === 404, 'perfil inexistente');

  // 4) replay do Arcano: o motor refaz a partida inteira, com as mãos
  STEP = 4;
  const R = (await api('/api/replay/' + ma.room)).j;
  ok(R && typeof R.seed === 'number' && R.decks.w === deckOf[WT.user.id] && R.actions.length === n && R.rules === R.rulesNow, 'replay com semente, grimórios e ações');
  const rep = replay(R);
  ok(rep.okAll && rep.cards === cardsPlayed.length, 'todas as ações valem no motor (cartas: ' + rep.cards + ')');
  ok(rep.s.hist.map(h => h.san).join(' ') === R.moves.join(' ') && ARC.fen(rep.s) === ARC.fen(lastSeen), 'replay chega à mesma posição da partida');
  ok(rep.s.arc.hand.w.every(c => c.id !== '?') && rep.s.arc.hand.b.every(c => c.id !== '?') && rep.s.arc.hand.b.length > 0, 'no replay as duas mãos aparecem');

  // 5) casual do Arcano: pareia pelo grimório, sem nota
  STEP = 5;
  const C = await guest('Caio'), D = await guest('Duda');
  const qc = sock('/api/queue/arcano-casual/12+5/ws', C.token, { deck:'tempestade' }), qdd = sock('/api/queue/arcano-casual/12+5/ws', D.token, { deck:'tempestade' });
  const mc = await qc.wait(m => m.t === 'match'); await qdd.wait(m => m.t === 'match');
  ok(!mc.ranked && mc.mode === 'arcano', 'casual do Arcano sem nota');
  const [CW, CB] = mc.color === 'w' ? [C, D] : [D, C];
  const cw = sock(`/api/rooms/${mc.room}/ws`, CW.token); await cw.wait(m => m.t === 'welcome');
  const cb = sock(`/api/rooms/${mc.room}/ws`, CB.token); await cb.wait(m => m.t === 'welcome');
  const t1 = await arcTurn(cw, 0, ['d2', 'd4'], false); await arcTurn(cb, t1.n, ['d7', 'd5'], false);
  cw.send({ t:'resign' }); const oc = await cb.wait(st(m => m.status === 'over'));
  ok(oc.result.score === '0-1' && !oc.result.rating, 'casual terminou sem nota');
  cw.close(); cb.close();
  ok((await api('/api/me', { token:C.token })).j.ratings.arcano.games === 0, 'casual não conta na nota');
  ok((await api('/api/profile/' + CB.user.id)).j.stats.arcano.w === 1, 'casual conta nas vitórias do perfil');

  // 6) Xadrez Puro por link: replay até o mate; partida em andamento e cancelada não têm replay
  STEP = 6;
  const r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'3+2', color:'w' } })).j;
  const x = sock(`/api/rooms/${r.id}/ws`, A.token); await x.wait(m => m.t === 'welcome');
  const y = sock(`/api/rooms/${r.id}/ws`, B.token); await y.wait(m => m.t === 'welcome');
  await x.wait(st(m => m.status === 'playing'));
  ok((await api('/api/replay/' + r.id)).status === 404, 'partida em andamento não tem replay');
  const seq = [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']];
  for (let i = 0; i < seq.length; i++){ (i % 2 ? y : x).act({ type:'move', from:seq[i][0], to:seq[i][1] }); await x.wait(st(m => m.n === i + 1)); }
  await x.wait(st(m => m.status === 'over')); x.close(); y.close();
  const RX = (await api('/api/replay/' + r.id)).j, rx = replay(RX);
  ok(RX.mode === 'xadrez' && RX.decks === null && rx.okAll && rx.s.over && rx.s.over.kind === 'mate' && rx.s.over.winner === 'w', 'replay do Xadrez Puro termina no mate');
  ok((await api('/api/profile/' + A.user.id)).j.stats.xadrez.w === 1, 'vitória do Xadrez Puro no perfil');
  const ab = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'10+0', color:'w' } })).j;
  const ax = sock(`/api/rooms/${ab.id}/ws`, A.token); await ax.wait(m => m.t === 'welcome');
  const ay = sock(`/api/rooms/${ab.id}/ws`, B.token); await ay.wait(m => m.t === 'welcome');
  await ax.wait(st(m => m.status === 'playing')); ax.send({ t:'resign' }); await ay.wait(m => m.t === 'state' && m.status === 'aborted'); ax.close(); ay.close();
  ok((await api('/api/replay/' + ab.id)).status === 404 && (await api('/api/replay/zzzzzzzz')).status === 404, 'cancelada e inexistente sem replay');
  const pa = (await api('/api/profile/' + A.user.id)).j;
  ok(pa.recent[0].id === ab.id && pa.recent[0].outcome === 'cancelada' && !pa.recent[0].replay, 'cancelada aparece no histórico sem replay');

  console.log(JSON.stringify({ passes, fails }));
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('ERRO', e.message); process.exit(1); });
