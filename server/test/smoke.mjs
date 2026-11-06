// Teste rápido contra o servidor publicado (sem os relógios acelerados do .dev.vars).
// Uso: node test/smoke.mjs https://arcane-chess-api.leonardo-zogbi.workers.dev
// Cria convidados, joga um mate por link (e confere o replay e o perfil), abre uma sala do Arcano, pareia dois na fila casual
// de Xadrez Puro e dois na fila casual do Arcano (12+5, grimório na entrada). Exige a migração 0003 aplicada.
const BASE = process.argv[2] || 'http://127.0.0.1:8787', WSB = BASE.replace(/^http/, 'ws');
const ORIGIN = 'https://arcanechess.pages.dev';
let fails = 0, passes = 0, STEP = 0, LAST = [];
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FALHOU:', msg); } };
async function api(path, o = {}){
  const r = await fetch(BASE + path, { method:o.body ? 'POST' : 'GET', headers:{ origin:ORIGIN, 'content-type':'application/json', ...(o.token ? { Authorization:'Bearer ' + o.token } : {}) }, body:o.body ? JSON.stringify(o.body) : undefined });
  return { status:r.status, headers:r.headers, j:await r.json().catch(() => null) };
}
const guest = async name => (await api('/api/guest', { body:{ name } })).j;
function sock(path, token, extra){
  const ws = new WebSocket(WSB + path), msgs = [], waiters = [];
  const c = { msgs, last:null, seat:null, send:o => ws.send(JSON.stringify(o)), close:() => ws.close(),
    move:(from, to) => c.send({ t:'act', a:{ type:'move', from, to } }),
    wait:(pred, ms = 10000) => new Promise((res, rej) => {
      const f = m => { try { return pred(m); } catch (e){ return false; } };
      const hit = msgs.find(f); if (hit) return res(hit);
      const w = { f, res }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0){ waiters.splice(i, 1); rej(new Error('tempo esgotado: ' + pred)); } }, ms);
    }) };
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); msgs.push(m); if (m.t === 'state') c.last = m; if (m.t === 'welcome') c.seat = m.you.seat; LAST.push({t:m.t,status:m.status,err:m.err,n:m.state&&m.state.hist&&m.state.hist.length}); if (LAST.length>6) LAST.shift();
    for (const w of waiters.slice()) if (w.f(m)){ waiters.splice(waiters.indexOf(w), 1); w.res(m); } });
  ws.addEventListener('open', () => c.send({ t:'hello', token, ...(extra || (/\/queue\/arcano-/.test(path) ? { deck:'cinzas' } : {})) }));
  return c;
}
const st = p => m => m.t === 'state' && m.state && p(m);

async function main(){
  const t0 = Date.now();
  const h = await api('/api/health'); ok(h.j && h.j.ok, 'health');
  ok(h.headers.get('access-control-allow-origin') === ORIGIN, 'CORS da página do jogo');
  const A = await guest('Smoke A'), B = await guest('Smoke B');
  ok(A && A.token && B && B.token, 'convidados');

  STEP = 1;
  // 1) sala por link, Xadrez Puro, mate do pastor
  let r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'3+2', color:'w' } })).j;
  ok(r && /^[a-z0-9]{8}$/.test(r.id), 'sala criada');
  let a = sock(`/api/rooms/${r.id}/ws`, A.token); await a.wait(m => m.t === 'welcome');
  let b = sock(`/api/rooms/${r.id}/ws`, B.token); await b.wait(m => m.t === 'welcome');
  ok(a.seat === 'w' && b.seat === 'b', 'lugares');
  await a.wait(st(m => m.status === 'playing'));
  const seq = [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']];
  for (let i = 0; i < seq.length; i++){ (i % 2 ? b : a).move(...seq[i]); await a.wait(st(m => m.state.hist.length >= i + 1)); }
  const over = await b.wait(st(m => m.status === 'over'));
  ok(over.result && over.result.score === '1-0' && over.result.reason === 'mate', 'mate: ' + JSON.stringify(over.result));
  a.close(); b.close();
  // replay e perfil da partida que acabou (Fase 2)
  const rp = await api('/api/replay/' + r.id);
  ok(rp.status === 200 && typeof rp.j.seed === 'number' && rp.j.actions.length === 7 && rp.j.moves.join(' ') === 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#', 'replay gravado');
  const pf = await api('/api/profile/' + A.user.id);
  ok(pf.status === 200 && pf.j.stats.xadrez.w >= 1 && pf.j.recent[0].id === r.id && pf.j.recent[0].outcome === 'vitoria' && pf.j.recent[0].replay, 'perfil com a partida');

  STEP = 2;
  // 2) Arcano: a mão do rival chega escondida
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'arcano', tc:'livre', color:'w', deck:'cinzas' } })).j;
  a = sock(`/api/rooms/${r.id}/ws`, A.token); await a.wait(m => m.t === 'welcome');
  b = sock(`/api/rooms/${r.id}/ws`, B.token); await b.wait(m => m.t === 'welcome');
  const sa = await a.wait(st(m => m.status === 'playing'));
  const myHand = sa.state.arc.hand.w, rivalHand = sa.state.arc.hand.b;
  ok(myHand.length > 0 && myHand.every(x => x && x.id && x.id !== '?'), 'mão própria visível');
  ok(rivalHand.length > 0 && rivalHand.every(x => x.id === '?'), 'mão do rival escondida: ' + JSON.stringify(rivalHand).slice(0, 80));
  a.send({ t:'resign' }); await b.wait(st(m => m.status === 'over' || m.status === 'aborted')); // sem lances, desistir cancela
  a.close(); b.close();

  STEP = 3;
  // 3) fila casual 3+2: os dois são pareados
  const qa = sock('/api/queue/casual/3+2/ws', A.token); await qa.wait(m => m.t === 'queued');
  const qb = sock('/api/queue/casual/3+2/ws', B.token);
  const ma = await qa.wait(m => m.t === 'match', 20000), mb = await qb.wait(m => m.t === 'match', 20000);
  ok(ma.room === mb.room && ma.color !== mb.color, 'pareados pela fila');
  const [W, K] = ma.color === 'w' ? [A, B] : [B, A];
  const rw = sock(`/api/rooms/${ma.room}/ws`, W.token), rk = sock(`/api/rooms/${ma.room}/ws`, K.token);
  await rw.wait(st(m => m.status === 'playing')); rw.move('e2', 'e4'); await rk.wait(st(m => m.state.hist.length === 1));
  rk.send({ t:'resign' }); const o = await rw.wait(st(m => m.status === 'over'));
  ok(o.result.score === '1-0', 'partida da fila terminou');
  qa.close(); qb.close(); rw.close(); rk.close();

  STEP = 4;
  // 4) fila casual do Arcano 12+5: grimório na entrada, sala com os dois grimórios (sem nota)
  const xa = sock('/api/queue/arcano-casual/12+5/ws', A.token); const qx = await xa.wait(m => m.t === 'queued' || m.t === 'error');
  ok(qx.t === 'queued' && qx.mode === 'arcano', 'fila do Arcano aceita (sem grimório seria recusada)');
  xa.close(); await new Promise(r => setTimeout(r, 300));
  const ya = sock('/api/queue/arcano-casual/12+5/ws', A.token), yb = sock('/api/queue/arcano-casual/12+5/ws', B.token);
  const xm = await ya.wait(m => m.t === 'match' || m.t === 'error', 20000), ym = await yb.wait(m => m.t === 'match' || m.t === 'error', 20000);
  ok(xm.t === 'match' && ym.t === 'match' && xm.room === ym.room && xm.mode === 'arcano' && !xm.ranked, 'pareados no Arcano casual');
  ya.close(); yb.close();

  console.log(`smoke ${BASE}: ${passes} ok, ${fails} falhas, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('ERRO na etapa ' + STEP + ':', e.message, JSON.stringify(LAST)); process.exit(1); });
