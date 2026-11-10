// Conquista dos Mundos: progresso por conta. Exige login; POST soma estrelas (bits) e cartas/Selos (união); nada se perde;
// chaves e valores inválidos são ignorados; o convidado fundido numa conta leva o progresso junto (DEV_AUTH=1).
// Uso: wrangler dev local rodando (.dev.vars com DEV_AUTH=1):  node test/campanha.mjs [http://127.0.0.1:8787]
const BASE = process.argv[2] || 'http://127.0.0.1:8787', GAME = 'http://localhost:8767/index.html?api=' + BASE;
const RUN = Date.now().toString(36);
let fails = 0, passes = 0; const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FALHOU:', m); } };
async function api(path, o = {}){
  const r = await fetch(BASE + path, { method:o.body ? 'POST' : 'GET', headers:{ 'content-type':'application/json', ...(o.token ? { Authorization:'Bearer ' + o.token } : {}) }, body:o.body ? JSON.stringify(o.body) : undefined });
  let j = null; try { j = await r.json(); } catch (e){}
  return { status:r.status, j };
}
const guest = async name => (await api('/api/guest', { body:{ name } })).j;
async function login(token, sub, name){
  const st = await api('/api/auth/start', { token, body:{ provider:'fake', return:GAME } });
  const a = await fetch(new URL(st.j.url) + '&' + new URLSearchParams({ sub, name }), { redirect:'manual' });
  const c = await fetch(new URL(a.headers.get('location')), { redirect:'manual' });
  const code = ((c.headers.get('location') || '').match(/#login=([^&]+)$/) || [])[1];
  return (await api('/api/auth/exchange', { body:{ code } })).j;
}

ok((await api('/api/campanha')).status === 401, 'sem ficha deveria dar 401');
const A = await guest('Guardiao A');
let r = await api('/api/campanha', { token:A.token });
ok(r.status === 200 && Object.keys(r.j.fases).length === 0 && r.j.cartas.length === 0, 'conta nova começa vazia');
r = await api('/api/campanha', { token:A.token, body:{ fases:{ '1-1':[1,0,1], '1-2':[1,1,1], '9-1':[1,1,1], 'x':[1], '2-7':[1,0,0] }, cartas:['Olho do Bispo', '<script>', 'Passo do Relâmpago'], selos:[1, 9, 'a'] } });
ok(r.status === 200, 'POST aceito');
ok(JSON.stringify(r.j.fases) === JSON.stringify({ '1-1':[1,0,1], '1-2':[1,1,1] }), 'só as fases válidas: ' + JSON.stringify(r.j.fases));
ok(r.j.cartas.includes('Olho do Bispo') && r.j.cartas.includes('Passo do Relâmpago') && !r.j.cartas.some(c => c.includes('<')), 'cartas válidas: ' + JSON.stringify(r.j.cartas));
ok(JSON.stringify(r.j.selos) === '[1]', 'só o Selo 1: ' + JSON.stringify(r.j.selos));
// um envio com menos estrelas não apaga as que já existem
r = await api('/api/campanha', { token:A.token, body:{ fases:{ '1-1':[0,1,0] }, cartas:[], selos:[] } });
ok(JSON.stringify(r.j.fases['1-1']) === '[1,1,1]', 'estrelas somam: ' + JSON.stringify(r.j.fases['1-1']));
ok(r.j.cartas.length === 2 && r.j.selos.length === 1, 'cartas e Selos ficam');
// outro convidado não vê o progresso do primeiro
const B = await guest('Guardiao B');
r = await api('/api/campanha', { token:B.token });
ok(Object.keys(r.j.fases).length === 0, 'B começa vazio');
// conta com progresso próprio; o convidado A entra nela e o progresso se junta
const acc = await login(B.token, 'sub-camp-' + RUN, 'Conta ' + RUN);
ok(acc && acc.token, 'B virou conta');
await api('/api/campanha', { token:acc.token, body:{ fases:{ '1-1':[1,0,0], '1-3':[1,0,0] }, cartas:['Fênix'], selos:[] } });
const merged = await login(A.token, 'sub-camp-' + RUN, 'Conta ' + RUN);
ok(merged && merged.token && merged.user.id === acc.user.id, 'A fundido na mesma conta');
r = await api('/api/campanha', { token:merged.token });
ok(JSON.stringify(r.j.fases['1-1']) === '[1,1,1]' && JSON.stringify(r.j.fases['1-2']) === '[1,1,1]' && JSON.stringify(r.j.fases['1-3']) === '[1,0,0]', 'progresso somado na conta: ' + JSON.stringify(r.j.fases));
ok(r.j.cartas.length === 3 && r.j.selos.includes(1), 'cartas e Selos somados: ' + JSON.stringify(r.j));
console.log(JSON.stringify({ passes, fails }));
process.exit(fails ? 1 : 0);
