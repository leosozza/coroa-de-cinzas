// Etapa (c): login com o provedor falso (DEV_AUTH=1). Convidado vira conta com a nota; segundo convidado é fundido na conta;
// state e código de uso único, PKCE conferido, volta só para origem permitida, data de nascimento.
// Uso: wrangler dev local rodando (.dev.vars com DEV_AUTH=1, QUEUE_AI_MS=4000, SHOW_MS=5000):  node test/auth.mjs [http://127.0.0.1:8787]
const BASE = process.argv[2] || 'http://127.0.0.1:8787', WSB = BASE.replace(/^http/, 'ws'), GAME = 'http://localhost:8767/index.html?api=' + BASE;
// identidades novas a cada execução (o banco local guarda as anteriores)
const RUN = Date.now().toString(36);
let fails = 0, passes = 0; const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FALHOU:', m); } };
async function api(path, o = {}){
  const r = await fetch(BASE + path, { method:o.body ? 'POST' : 'GET', headers:{ 'content-type':'application/json', ...(o.token ? { Authorization:'Bearer ' + o.token } : {}) }, body:o.body ? JSON.stringify(o.body) : undefined });
  let j = null; try { j = await r.json(); } catch (e){}
  return { status:r.status, j };
}
const guest = async name => (await api('/api/guest', { body:{ name } })).j;
const me = async t => (await api('/api/me', { token:t })).j;
// segue o fluxo como o navegador: start → authorize (com sub) → callback → página do jogo #login=… → exchange
async function login(token, sub, name, o = {}){
  const st = await api('/api/auth/start', { token, body:{ provider:'fake', return:o.ret || GAME } });
  if (st.status !== 200) return { start:st };
  const auth = new URL(st.j.url);
  const a = await fetch(auth + '&' + new URLSearchParams({ sub, name }), { redirect:'manual' });
  const cb = new URL(a.headers.get('location'));
  if (o.swapState) cb.searchParams.set('state', o.swapState);
  const c = await fetch(cb, { redirect:'manual' });
  const back = c.headers.get('location') || '';
  const code = (back.match(/#login=([^&]+)$/) || [])[1];
  const ex = code ? await api('/api/auth/exchange', { body:{ code } }) : null;
  return { authUrl:auth, cb, back, code, ex, state:auth.searchParams.get('state') };
}
function sock(path, token){
  const ws = new WebSocket(WSB + path), msgs = [], W = [];
  const c = { send:o => ws.send(JSON.stringify(o)), close:() => ws.close(),
    wait:(f, ms = 15000) => new Promise((res, rej) => { const g = m => { try { return f(m); } catch (e){ return false; } }; const h = msgs.find(g); if (h) return res(h); const w = { g, res }; W.push(w); setTimeout(() => { const i = W.indexOf(w); if (i >= 0){ W.splice(i, 1); rej(new Error('tempo esgotado')); } }, ms); }) };
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); msgs.push(m); for (const w of W.slice()) if (w.g(m)){ W.splice(W.indexOf(w), 1); w.res(m); } });
  ws.addEventListener('open', () => c.send({ t:'hello', token }));
  return c;
}
// uma ranqueada rápida (mate do louco) para os dois convidados terem nota
async function rankedGame(A, B){
  const qa = sock('/api/queue/ranked/10+0/ws', A.token), qb = sock('/api/queue/ranked/10+0/ws', B.token);
  const ma = await qa.wait(m => m.t === 'match'); await qb.wait(m => m.t === 'match');
  const [W, Bk] = ma.color === 'w' ? [A, B] : [B, A];
  const rw = sock(`/api/rooms/${ma.room}/ws`, W.token), rb = sock(`/api/rooms/${ma.room}/ws`, Bk.token);
  await rw.wait(m => m.t === 'state' && m.status === 'playing');
  const seq = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];
  for (let i = 0; i < 4; i++){ (i % 2 ? rb : rw).send({ t:'act', a:{ type:'move', from:seq[i][0], to:seq[i][1] } }); await rw.wait(m => m.t === 'state' && m.state && m.state.hist.length === i + 1); }
  await rw.wait(m => m.t === 'state' && m.status === 'over'); rw.close(); rb.close();
  return { winner:Bk, loser:W };
}

async function main(){
  const pv = (await api('/api/auth/providers')).j.providers;
  ok(pv.length === 1 && pv[0].id === 'fake', 'só o provedor falso ativo sem ids de verdade: ' + JSON.stringify(pv));
  const G1 = await guest(''), G2 = await guest('Bia');
  const { winner, loser } = await rankedGame(G1, G2);
  const wr = (await me(winner.token)).ratings.xadrez;
  ok(wr.r > 1600 && wr.games === 1, 'convidado com nota antes do login: ' + wr.r);

  // 1) o vencedor entra pela primeira vez: o próprio convidado vira conta, com a nota
  const L1 = await login(winner.token, 'alice-' + RUN, 'Alice Arcana');
  ok(L1.authUrl.searchParams.get('code_challenge_method') === 'S256' && L1.authUrl.searchParams.get('code_challenge').length >= 43 && L1.state.length >= 32, 'state e PKCE S256 na URL do provedor');
  ok(!/token|Bearer/i.test(L1.back) && /#login=/.test(L1.back) && L1.back.startsWith('http://localhost:8767/index.html?api='), 'volta ao jogo só com o código de uso único: ' + L1.back.slice(0, 70));
  ok(L1.ex && L1.ex.status === 200 && L1.ex.j.user.id === winner.user.id && L1.ex.j.user.kind === 'account', 'convidado virou conta com o mesmo id');
  const A = L1.ex.j.token, ma = await me(A);
  ok(ma.ratings.xadrez.r === wr.r && ma.ratings.xadrez.games === 1, 'nota preservada: ' + ma.ratings.xadrez.r);
  ok(ma.user.logins.join() === 'fake' && ma.user.birth === false, 'conta ligada ao provedor, sem data de nascimento ainda');
  ok(winner.user.name.startsWith('Convidado') ? ma.user.name === 'Alice Arcana' : ma.user.name === winner.user.name, 'nome: ' + ma.user.name);
  // código e state são de uso único
  ok((await api('/api/auth/exchange', { body:{ code:L1.code } })).status === 400, 'código de login não serve duas vezes');
  const again = await fetch(L1.cb, { redirect:'manual' });
  ok(/#login-erro=estado/.test(again.headers.get('location') || '') || again.status === 400, 'state não serve duas vezes');

  // 2) PKCE: o código de um fluxo não fecha outro fluxo (verificador diferente)
  const other = await api('/api/auth/start', { token:loser.token, body:{ provider:'fake', return:GAME } });
  const L2 = await login(loser.token, 'mallory-' + RUN, 'Mallory', { swapState:new URL(other.j.url).searchParams.get('state') });
  ok(/#login-erro=pkce/.test(L2.back) && !L2.code, 'PKCE confere o verificador: ' + L2.back.slice(-24));
  // volta só para origem permitida
  const bad = await api('/api/auth/start', { token:loser.token, body:{ provider:'fake', return:'https://malicioso.exemplo/x' } });
  ok(bad.status === 400, 'endereço de volta fora da lista recusado');
  ok((await api('/api/auth/start', { body:{ provider:'google', return:GAME } })).status === 400, 'Google sem id configurado não abre');
  ok((await fetch(BASE + '/api/auth/fake/authorize?redirect_uri=https://malicioso.exemplo/cb&state=x', { redirect:'manual' })).status === 400, 'provedor falso só volta para o próprio servidor');

  // 3) o perdedor (convidado com nota) entra com a MESMA identidade: é fundido na conta
  const L3 = await login(loser.token, 'alice-' + RUN, 'Alice Arcana');
  ok(L3.ex && L3.ex.j.user.id === winner.user.id, 'segundo aparelho entra na mesma conta');
  const m3 = await me(L3.ex.j.token);
  ok(m3.ratings.xadrez.games === 2 && m3.ratings.xadrez.r === wr.r, 'notas fundidas: fica a de mais partidas (empate: a mais firme), partidas somam: ' + JSON.stringify(m3.ratings.xadrez));
  ok((await api('/api/me', { token:loser.token })).status === 401, 'ficha do convidado fundido não vale mais');

  // 4) convidado novo sem partidas, identidade nova: conta nova a partir dele, nota inicial
  const G3 = await guest('Caio');
  const L4 = await login(G3.token, 'bob-' + RUN, 'Bob');
  const m4 = await me(L4.ex.j.token);
  ok(m4.user.id === G3.user.id && m4.user.name === 'Caio' && m4.ratings.xadrez.r === 1500, 'conta nova mantém o nome escolhido');
  // login sem convidado (outro aparelho, ficha perdida) cai na conta existente
  const L5 = await login(null, 'bob-' + RUN, 'Bob');
  ok(L5.ex && L5.ex.j.user.id === G3.user.id, 'login sem convidado encontra a conta');

  // 5) data de nascimento
  ok((await api('/api/me/birth', { token:A, body:{ birth:'2031-02-30' } })).status === 400, 'data impossível recusada');
  ok((await api('/api/me/birth', { token:A, body:{ birth:'1990-05-17' } })).status === 200 && (await me(A)).user.birth === true, 'data de nascimento gravada');
  ok((await api('/api/me/birth', { body:{ birth:'1990-05-17' } })).status === 401, 'data exige sessão');
  // a conta joga normalmente (a ficha nova vale nas salas e na fila)
  const room = (await api('/api/rooms', { token:A, body:{ mode:'xadrez', tc:'livre', color:'w' } })).j;
  const s = sock(`/api/rooms/${room.id}/ws`, A); const w = await s.wait(m => m.t === 'welcome'); s.close();
  ok(w.you.seat === 'w' && w.you.uid === winner.user.id, 'conta entra na sala');
  console.log(JSON.stringify({ passes, fails }));
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('ERRO', e.stack); process.exit(1); });
