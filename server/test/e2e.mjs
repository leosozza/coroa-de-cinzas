// Teste ponta a ponta da fase 1 contra o `wrangler dev` local (node 22+, WebSocket nativo).
// Uso: (em server/) npx -y wrangler@4 dev --local --port 8787   e, noutro terminal:  node test/e2e.mjs [http://127.0.0.1:8787]
// O .dev.vars local deve ter RECONNECT_MS=3000, FIRST_MOVE_MS=8000 e DEV_TC=1 para os testes de tempo rodarem rápido.
const BASE = process.argv[2] || 'http://127.0.0.1:8787', WSB = BASE.replace(/^http/, 'ws');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FALHOU:', msg); } };
async function api(path, o = {}){
  const r = await fetch(BASE + path, { method:o.body ? 'POST' : 'GET', headers:{ 'content-type':'application/json', ...(o.token ? { Authorization:'Bearer ' + o.token } : {}) }, body:o.body ? JSON.stringify(o.body) : undefined });
  return { status:r.status, j:await r.json() };
}
async function guest(name){ return (await api('/api/guest', { body:{ name } })).j; }
// cliente: guarda as mensagens e espera por uma que satisfaça o filtro
function client(room, token){
  const ws = new WebSocket(`${WSB}/api/rooms/${room}/ws`), msgs = [], waiters = [];
  const c = { ws, msgs, last:null, seat:null,
    send:o => ws.send(JSON.stringify(o)),
    wait:(pred, ms = 5000) => new Promise((res, rej) => {
      const hit = msgs.find(pred); if (hit) return res(hit);
      const w = { pred, res }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0){ waiters.splice(i, 1); rej(new Error('tempo esgotado esperando mensagem')); } }, ms);
    }),
    clear:() => { msgs.length = 0; },
    move:(from, to, promotion) => c.send({ t:'act', a:{ type:'move', from, to, promotion } }),
    close:() => ws.close(),
  };
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data); msgs.push(m);
    if (m.t === 'state') c.last = m;
    if (m.t === 'welcome') c.seat = m.you.seat;
    for (const w of waiters.slice()) if (w.pred(m)){ waiters.splice(waiters.indexOf(w), 1); w.res(m); }
  });
  c.open = new Promise(r => ws.addEventListener('open', () => { c.send({ t:'hello', token }); r(); }));
  return c;
}
// a sala de espera manda state: null; o filtro que tropeça em null só não casa
const st = (pred) => m => { if (m.t !== 'state') return false; try { return !!pred(m); } catch (e){ return false; } };
const plies = n => st(m => m.state && m.state.hist.length >= n);

async function main(){
  const h = await api('/api/health'); ok(h.j.ok, 'health');
  const A = await guest('Ana <script>'), B = await guest(''), C = await guest('Espectador');
  ok(A.user.name === 'Ana script', 'nome limpo: ' + A.user.name); ok(/^Convidado \d{4}$/.test(B.user.name), 'nome padrão: ' + B.user.name);
  const me = await api('/api/me', { token:A.token }); ok(me.j.user && me.j.user.id === A.user.id, '/api/me');
  ok((await api('/api/me', { token:A.token + 'x' })).status === 401, 'ficha adulterada recusada');
  ok((await api('/api/rooms', { body:{ mode:'xadrez' } })).status === 401, 'sala exige sessão');

  // 1) Xadrez Puro por link: mate do pastor, lances fora da vez e ilegais recusados
  let r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'3+2', color:'w' } })).j;
  ok(/^[a-z0-9]{8}$/.test(r.id) && r.link.endsWith('#sala=' + r.id), 'link da sala');
  let a = client(r.id, A.token), b = client(r.id, B.token), c = client(r.id, C.token);
  await a.wait(m => m.t === 'welcome'); await b.wait(m => m.t === 'welcome'); await c.wait(m => m.t === 'welcome');
  ok(a.seat === 'w' && b.seat === 'b' && c.seat === null, `lugares ${a.seat} ${b.seat} ${c.seat}`);
  await a.wait(st(m => m.status === 'playing'));
  b.move('e7', 'e5'); ok((await b.wait(m => m.t === 'error')).err === 'Não é a sua vez.', 'fora da vez');
  a.move('e2', 'e5'); ok(/ilegal/i.test((await a.wait(m => m.t === 'error' && /ilegal/i.test(m.err))).err), 'lance ilegal');
  const seq = [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']];
  for (let i = 0; i < seq.length; i++){ (i % 2 ? b : a).move(...seq[i]); await a.wait(plies(i + 1)); }
  const over = await c.wait(st(m => m.status === 'over'));
  ok(over.result && over.result.score === '1-0' && over.result.reason === 'mate', 'mate: ' + JSON.stringify(over.result));
  ok(over.state.hist.map(x => x.san).join(' ') === 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#', 'SAN: ' + over.state.hist.map(x => x.san).join(' '));
  ok(a.last.clocks.w > 170000 && a.last.clocks.w <= 180000 + 4 * 2000, 'relógio com incremento: ' + a.last.clocks.w);
  ok(over.state.arc.hand.w.length === 0 && over.state.arc.ess.w === 0, 'Xadrez Puro sem cartas nem essência');
  a.close(); b.close(); c.close();
  const info = (await api('/api/rooms/' + r.id)).j; ok(info.status === 'over' && info.result.score === '1-0', 'info da sala');

  // 2) Arcano: mãos e armadilhas escondidas do rival e do espectador
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'arcano', tc:'livre', color:'b', deck:'cinzas' } })).j;
  a = client(r.id, A.token); b = client(r.id, B.token); c = client(r.id, C.token);
  await a.wait(st(m => m.status === 'playing')); await b.wait(st(m => m.status === 'playing')); await c.wait(st(m => m.status === 'playing'));
  ok(a.seat === 'b' && b.seat === 'w', 'cor escolhida pelo criador');
  ok(a.last.state.arc.decks.b === 'cinzas' && a.last.state.arc.decks.w !== 'cinzas', 'grimórios: ' + JSON.stringify(a.last.state.arc.decks));
  ok(b.last.state.arc.hand.w.every(x => x.id !== '?') && b.last.state.arc.hand.b.every(x => x.id === '?'), 'Brancas veem só a própria mão');
  ok(a.last.state.arc.hand.b.every(x => x.id !== '?') && a.last.state.arc.hand.w.every(x => x.id === '?'), 'Pretas veem só a própria mão');
  ok(c.last.state.arc.hand.w.every(x => x.id === '?') && c.last.state.arc.hand.b.every(x => x.id === '?'), 'espectador não vê mãos');
  ok(typeof a.last.state.arc.deck.w === 'number' && a.last.state.rng === 0, 'grimório e sorteio escondidos');
  b.move('e2', 'e4'); await b.wait(st(m => m.state.arc.phase === 'cards'));
  a.send({ t:'act', a:{ type:'end' } }); ok((await a.wait(m => m.t === 'error')).err === 'Não é a sua vez.', 'Pretas não fecham o turno das Brancas');
  b.send({ t:'act', a:{ type:'end' } }); await a.wait(st(m => m.state.turn === 'b' && m.state.arc.phase === 'move'));
  // jogar 6 turnos completos: compras do rival chegam mascaradas
  for (let k = 0; k < 6; k++){
    const me = k % 2 === 0 ? a : b, mine = me.seat;
    const s = me.last.state, moves = { b:[['e7', 'e5'], ['d7', 'd6'], ['g8', 'f6']], w:[['d2', 'd4'], ['g1', 'f3'], ['b1', 'c3']] }[mine][Math.floor(k / 2)];
    me.move(...moves); await me.wait(st(m => m.state.arc.phase === 'cards' && m.state.arc.cardSide === mine && m.state.hist.length === s.hist.length + 1));
    me.send({ t:'act', a:{ type:'end' } }); await me.wait(st(m => m.state.turn !== mine && m.state.arc.phase === 'move' && m.state.hist.length === s.hist.length + 1));
  }
  await sleep(300);
  const leaks = [a, b].flatMap(x => x.msgs.filter(m => m.t === 'state').flatMap(m => m.events.filter(e => (e.k === 'draw' || e.k === 'burn') && e.side !== x.seat && e.card.id !== '?')));
  const drawsSeen = [a, b].flatMap(x => x.msgs.filter(m => m.t === 'state').flatMap(m => m.events.filter(e => e.k === 'draw')));
  ok(drawsSeen.length > 0 && leaks.length === 0, `compras do rival mascaradas (${drawsSeen.length} compras, ${leaks.length} vazamentos)`);
  a.close(); b.close(); c.close();

  // 3) Reconexão: volta em menos de 3 s continua; ausência acima de 3 s perde por abandono
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'livre', color:'w' } })).j;
  a = client(r.id, A.token); b = client(r.id, B.token);
  await a.wait(st(m => m.status === 'playing')); a.move('e2', 'e4'); await b.wait(plies(1));
  b.close(); const away = await a.wait(st(m => m.players.b && !m.players.b.online)); ok(away.players.b.away > Date.now(), 'rival marcado ausente');
  await sleep(1200); b = client(r.id, B.token); await b.wait(m => m.t === 'welcome'); await b.wait(st(m => m.state));
  ok(b.seat === 'b', 'voltou para o mesmo lugar'); ok(b.last && b.last.state.hist.length === 1, 'estado restaurado');
  b.move('e7', 'e5'); await a.wait(plies(2)); ok(a.last.status === 'playing', 'partida seguiu depois da volta');
  b.close(); const ab = await a.wait(st(m => m.status === 'over'), 9000);
  ok(ab.result.score === '1-0' && ab.result.reason === 'abandono', 'abandono: ' + JSON.stringify(ab.result)); a.close();

  // 4) Tempo esgotado (3 s de relógio, só no modo de teste)
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'0.05+0', color:'w' } })).j;
  a = client(r.id, A.token); b = client(r.id, B.token);
  await a.wait(st(m => m.status === 'playing')); a.move('e2', 'e4'); await b.wait(plies(1));
  const to = await a.wait(st(m => m.status === 'over'), 9000);
  ok(to.result.score === '1-0' && to.result.reason === 'tempo' && to.clocks.b === 0, 'tempo: ' + JSON.stringify(to.result)); a.close(); b.close();

  // 5) Sem primeiro lance em 8 s: partida cancelada, sem resultado
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'10+0', color:'w' } })).j;
  a = client(r.id, A.token); b = client(r.id, B.token);
  const ab2 = await a.wait(st(m => m.status === 'aborted'), 14000); ok(ab2.result.score === 'abortada', 'cancelada sem primeiro lance'); a.close(); b.close();

  // 6) Empate por acordo e 7) desistência
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'10+0', color:'w' } })).j;
  a = client(r.id, A.token); b = client(r.id, B.token);
  await a.wait(st(m => m.status === 'playing')); a.move('e2', 'e4'); await b.wait(plies(1)); b.move('e7', 'e5'); await a.wait(plies(2));
  a.send({ t:'draw', op:'offer' }); await b.wait(st(m => m.drawOffer === 'w')); b.send({ t:'draw', op:'accept' });
  const dr = await a.wait(st(m => m.status === 'over')); ok(dr.result.score === '1/2-1/2' && dr.result.reason === 'acordo', 'empate por acordo'); a.close(); b.close();
  r = (await api('/api/rooms', { token:A.token, body:{ mode:'xadrez', tc:'10+0', color:'w' } })).j;
  a = client(r.id, A.token); b = client(r.id, B.token);
  await a.wait(st(m => m.status === 'playing')); a.move('d2', 'd4'); await b.wait(plies(1)); b.send({ t:'resign' });
  const rs = await a.wait(st(m => m.status === 'over')); ok(rs.result.score === '1-0' && rs.result.reason === 'desistencia', 'desistência'); a.close(); b.close();

  // 8) Ficha inválida no WebSocket
  const bad = client(r.id, 'x.y'); const e = await bad.wait(m => m.t === 'error'); ok(e.code === 'auth', 'ficha inválida no WebSocket'); bad.close();

  console.log(JSON.stringify({ passes, fails }));
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('ERRO', e.stack); process.exit(1); });
