// Teste da etapa (b): filas casual e ranqueada de Xadrez Puro, Glicko-2 no fim da ranqueada, ligas, oferta de IA e prazo para aparecer.
// Uso: com o `wrangler dev` local rodando (.dev.vars com QUEUE_AI_MS=4000 e SHOW_MS=5000):  node test/queue.mjs [http://127.0.0.1:8787]
import { windowFor, aiLevel } from '../src/queue.js';
const BASE = process.argv[2] || 'http://127.0.0.1:8787', WSB = BASE.replace(/^http/, 'ws');
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FALHOU:', msg); } };
async function api(path, o = {}){
  const r = await fetch(BASE + path, { method:o.body ? 'POST' : 'GET', headers:{ 'content-type':'application/json', ...(o.token ? { Authorization:'Bearer ' + o.token } : {}) }, body:o.body ? JSON.stringify(o.body) : undefined });
  let j = null; try { j = await r.json(); } catch (e){}
  return { status:r.status, j };
}
const guest = async name => (await api('/api/guest', { body:{ name } })).j;
function sock(path, token){
  const ws = new WebSocket(WSB + path), msgs = [], waiters = [];
  const c = { ws, msgs, last:null, send:o => ws.send(JSON.stringify(o)), close:() => ws.close(),
    wait:(pred, ms = 8000) => new Promise((res, rej) => {
      const f = m => { try { return pred(m); } catch (e){ return false; } };
      const hit = msgs.find(f); if (hit) return res(hit);
      const w = { f, res }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0){ waiters.splice(i, 1); rej(new Error('tempo esgotado: ' + pred)); } }, ms);
    }) };
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); msgs.push(m); if (m.t === 'state') c.last = m; for (const w of waiters.slice()) if (w.f(m)){ waiters.splice(waiters.indexOf(w), 1); w.res(m); } });
  ws.addEventListener('open', () => c.send({ t:'hello', token }));
  return c;
}
const queue = (q, tc, tok) => sock(`/api/queue/${q}/${tc}/ws`, tok);
const room = (id, tok) => sock(`/api/rooms/${id}/ws`, tok);
const st = p => m => m.t === 'state' && p(m);

async function main(){
  // janelas e nível da IA (unidade)
  ok(windowFor('ranked', 0) === 150 && windowFor('ranked', 10000) === 400 && windowFor('ranked', 60000) === 500, 'janela ranqueada');
  ok(windowFor('casual', 19000) === 625 && windowFor('casual', 20000) === Infinity, 'janela casual');
  ok(aiLevel(1100) === 1 && aiLevel(1500) === 2 && aiLevel(1800) === 3, 'nível da IA pela nota');
  const cfg = (await api('/api/config')).j; ok(cfg.queues.ranked.join() === '10+0,3+2' && cfg.leagues.length === 4, 'config');
  ok((await api('/api/queue/ranked/1+0/ws')).status === 404, 'ritmo fora da fila recusado');

  // 1) ranqueada: os dois são pareados, jogam o mate do louco (Pretas ganham) e as notas mudam
  const A = await guest('Alice'), B = await guest('Bruno');
  const qa = queue('ranked', '10+0', A.token); await qa.wait(m => m.t === 'queued');
  const qb = queue('ranked', '10+0', B.token);
  const ma = await qa.wait(m => m.t === 'match'), mb = await qb.wait(m => m.t === 'match');
  ok(ma.room === mb.room && ma.color !== mb.color && ma.ranked, 'pareados na mesma sala, cores opostas');
  ok(ma.opponent.name === 'Bruno' && ma.opponent.r === 1500, 'rival e nota no aviso');
  const [W, Bk] = ma.color === 'w' ? [A, B] : [B, A];
  const rw = room(ma.room, W.token), rb = room(ma.room, Bk.token);
  await rw.wait(st(m => m.status === 'playing')); await rb.wait(st(m => m.status === 'playing'));
  ok(rw.last.state.arc.hand.w.length === 0, 'sala da fila é Xadrez Puro');
  const seq = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];
  for (let i = 0; i < seq.length; i++){ (i % 2 ? rb : rw).send({ t:'act', a:{ type:'move', from:seq[i][0], to:seq[i][1] } }); await rw.wait(st(m => m.state.hist.length === i + 1)); }
  const over = await rw.wait(st(m => m.status === 'over'));
  const rt = over.result.rating;
  ok(over.result.score === '0-1' && rt && rt.w.before === 1500 && rt.b.before === 1500, 'resultado ranqueado: ' + JSON.stringify(over.result));
  ok(rt && rt.b.delta > 100 && rt.w.delta === -rt.b.delta, 'notas: ' + JSON.stringify(rt));
  const meB = (await api('/api/me', { token:Bk.token })).j.ratings.xadrez, meW = (await api('/api/me', { token:W.token })).j.ratings.xadrez;
  ok(meB.r === rt.b.after && meB.games === 1 && meB.provisional && meB.league === 'mestre', 'nota do vencedor no /api/me: ' + JSON.stringify(meB));
  ok(meW.r === rt.w.after && meW.league === 'alquimista', 'nota do perdedor no /api/me: ' + JSON.stringify(meW));
  ok((await api('/api/me', { token:A.token })).j.ratings.arcano.r === 1500, 'nota do Arcano separada');
  rw.close(); rb.close();

  // 2) casual: pareia, mas não mexe na nota
  const qa2 = queue('casual', '3+2', A.token), qb2 = queue('casual', '3+2', B.token);
  // 1338 x 1662: 324 de diferença, a janela casual chega lá em ~7 s
  const t0 = Date.now(), c1 = await qa2.wait(m => m.t === 'match', 20000); await qb2.wait(m => m.t === 'match'); ok(!c1.ranked, 'casual não é ranqueada');
  ok(Date.now() - t0 >= 5000, 'janela abriu com a espera (' + (Date.now() - t0) + ' ms)');
  const [W2, B2] = c1.color === 'w' ? [A, B] : [B, A];
  const r2w = room(c1.room, W2.token), r2b = room(c1.room, B2.token);
  await r2w.wait(st(m => m.status === 'playing')); r2w.send({ t:'act', a:{ type:'move', from:'e2', to:'e4' } }); await r2b.wait(st(m => m.state.hist.length === 1));
  r2b.send({ t:'resign' }); const o2 = await r2w.wait(st(m => m.status === 'over'));
  ok(o2.result.score === '1-0' && !o2.result.rating, 'casual sem nota');
  ok((await api('/api/me', { token:B.token })).j.ratings.xadrez.games === 1, 'casual não conta partida ranqueada');
  r2w.close(); r2b.close();

  // 3) sozinho na fila: depois do prazo vem a oferta de IA (nível pela nota) e a fila continua
  const C = await guest('Carla'); const qc = queue('casual', '5+3', C.token);
  const off = await qc.wait(m => m.t === 'offer-ai', 12000); ok(off.level === 2, 'oferta de IA nível ' + off.level);
  await qc.wait(m => m.t === 'waiting' && m.waited > off.waited); ok(true, 'continua na fila depois da oferta');
  // a mesma pessoa noutra aba substitui a primeira
  const qc2 = queue('casual', '5+3', C.token); await qc.wait(m => m.t === 'replaced'); await qc2.wait(m => m.t === 'queued'); ok(true, 'outra aba substitui');
  qc2.close();

  // 4) pareados, mas um não aparece: sala cancelada sem nota
  const D = await guest('Davi'), E = await guest('Eva');
  const qd = queue('ranked', '3+2', D.token), qe = queue('ranked', '3+2', E.token);
  const md = await qd.wait(m => m.t === 'match'); await qe.wait(m => m.t === 'match');
  const rd = room(md.room, D.token); const ab = await rd.wait(st(m => m.status === 'aborted'), 12000);
  ok(ab.result.reason === 'rival não apareceu' && !ab.result.rating, 'cancelada quando o rival não aparece');
  ok((await api('/api/me', { token:D.token })).j.ratings.xadrez.games === 0, 'sem nota na cancelada');
  rd.close();

  // ranking: só contas com partida ranqueada; os convidados desta rodada (que jogaram a ranqueada) ficam de fora
  const lb = (await api('/api/leaderboard?mode=xadrez&limit=100')).j, mine = [A, B, C, D, E].map(x => x.id || (x.user && x.user.id)).filter(Boolean);
  ok(Array.isArray(lb.top) && lb.top.every(x => x.id && typeof x.rating === 'number' && x.games > 0) && !lb.top.some(x => mine.includes(x.id)), 'ranking só com contas (convidados fora)');
  console.log(JSON.stringify({ passes, fails, exemplo:rt }));
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('ERRO', e.stack); process.exit(1); });
