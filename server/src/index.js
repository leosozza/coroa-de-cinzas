// API do Arcane Chess online (Cloudflare Worker). Fase 1: convidado, partida por link, relógio e reconexão.
//   GET  /api/health
//   POST /api/guest            { name? }                 -> { token, user }
//   GET  /api/me               (Bearer)                  -> { user, ratings }
//   POST /api/name             (Bearer) { name }         -> { token, user }
//   POST /api/rooms            (Bearer) { mode, tc, color, deck } -> { id, link, room }
//   GET  /api/rooms/:id                                  -> room
//   GET  /api/rooms/:id/ws     WebSocket; 1ª mensagem { t:'hello', token }
//   GET  /api/queue/:fila/:ritmo/ws   fila casual ou ranqueada de Xadrez Puro (WebSocket; avisa o par ou oferece a IA)
//   GET  /api/leaderboard?pool=xadrez  ranking (notas firmes de contas)
import { GameRoom, TC } from './room.js';
import { Matchmaker, QUEUES } from './queue.js';
import { signToken, verifyToken, bearer, randomId } from './auth.js';
import { publicRating } from './ratings.js';
import { LEAGUES, GRANDMASTER, PROVISIONAL_RD } from './glicko2.js';
export { GameRoom, Matchmaker };

const VERSION = 'fase1-b';
function cors(req, env){
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || allowed.includes('*');
  return ok ? { 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'Authorization, Content-Type', 'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Max-Age':'86400', Vary:'Origin' } : { Vary:'Origin' };
}
const json = (req, env, o, status = 200) => new Response(JSON.stringify(o), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...cors(req, env) } });
async function body(req){ try { const t = await req.text(); return t.length > 4096 ? {} : JSON.parse(t || '{}'); } catch (e){ return {}; } }
// nome público: letras, números, espaço, ponto, hífen e sublinhado; 3 a 20 caracteres
function cleanName(n){
  const s = String(n || '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s.length >= 3 ? s : null;
}
async function auth(req, env){ return verifyToken(bearer(req), env.SESSION_SECRET); }

export default {
  async fetch(req, env){
    const url = new URL(req.url), p = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers:cors(req, env) });
    if (!env.SESSION_SECRET) return json(req, env, { err:'Servidor sem SESSION_SECRET.' }, 500);
    try {
      if (p === '/api/health') return json(req, env, { ok:true, version:VERSION, now:Date.now() });

      if (p === '/api/guest' && req.method === 'POST'){
        const b = await body(req);
        const uid = 'g_' + randomId(12), name = cleanName(b.name) || 'Convidado ' + (1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000));
        if (env.DB) await env.DB.prepare('INSERT INTO users (id, kind, name, created, last_seen) VALUES (?, ?, ?, ?, ?)').bind(uid, 'guest', name, Date.now(), Date.now()).run();
        const token = await signToken({ uid, name, kind:'guest' }, env.SESSION_SECRET);
        return json(req, env, { token, user:{ id:uid, name, kind:'guest' } });
      }

      if (p === '/api/me'){
        const u = await auth(req, env);
        if (!u) return json(req, env, { err:'Sessão inválida.' }, 401);
        let row = null;
        if (env.DB){
          row = await env.DB.prepare('SELECT id, kind, name, created FROM users WHERE id = ? AND deleted = 0').bind(u.uid).first();
          if (!row) return json(req, env, { err:'Conta não encontrada.' }, 401);
          await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), u.uid).run();
        }
        const user = row || { id:u.uid, name:u.name, kind:u.kind };
        const ratings = { xadrez:await publicRating(env.DB, user.id, user.kind, 'xadrez'), arcano:await publicRating(env.DB, user.id, user.kind, 'arcano') };
        return json(req, env, { user, ratings });
      }

      // trocar o nome público mantém o id (e a nota); devolve uma ficha nova com o nome
      if (p === '/api/name' && req.method === 'POST'){
        const u = await auth(req, env);
        if (!u) return json(req, env, { err:'Sessão inválida.' }, 401);
        const name = cleanName((await body(req)).name);
        if (!name) return json(req, env, { err:'Use de 3 a 20 letras ou números.' }, 400);
        if (env.DB) await env.DB.prepare('UPDATE users SET name = ? WHERE id = ? AND deleted = 0').bind(name, u.uid).run();
        const token = await signToken({ uid:u.uid, name, kind:u.kind }, env.SESSION_SECRET);
        return json(req, env, { token, user:{ id:u.uid, name, kind:u.kind } });
      }

      if (p === '/api/rooms' && req.method === 'POST'){
        const u = await auth(req, env);
        if (!u) return json(req, env, { err:'Entre como convidado primeiro.' }, 401);
        const b = await body(req), id = randomId(8);
        const stub = env.GAME.get(env.GAME.idFromName(id));
        const r = await stub.fetch('https://sala/init', { method:'POST', body:JSON.stringify({ id, uid:u.uid, name:u.name, mode:b.mode, tc:b.tc, color:b.color, deck:b.deck }) });
        const room = await r.json();
        if (!r.ok) return json(req, env, room, r.status);
        const base = env.PUBLIC_URL || 'https://arcanechess.pages.dev';
        return json(req, env, { id, link:`${base}/#sala=${id}`, room });
      }

      const m = p.match(/^\/api\/rooms\/([a-z0-9]{8})(\/ws)?$/);
      if (m){
        const stub = env.GAME.get(env.GAME.idFromName(m[1]));
        if (m[2]){
          if (req.headers.get('Upgrade') !== 'websocket') return json(req, env, { err:'Use WebSocket.' }, 426);
          return stub.fetch(req);
        }
        const r = await stub.fetch('https://sala/info');
        return json(req, env, await r.json(), r.status);
      }

      const q = p.match(/^\/api\/queue\/(ranked|casual)\/([0-9+]+)\/ws$/);
      if (q){
        if (!(QUEUES[q[1]] || []).includes(q[2])) return json(req, env, { err:'Fila desconhecida.' }, 404);
        if (req.headers.get('Upgrade') !== 'websocket') return json(req, env, { err:'Use WebSocket.' }, 426);
        return env.QUEUE.get(env.QUEUE.idFromName(q[1] + ':' + q[2])).fetch(req);
      }

      if (p === '/api/leaderboard'){
        const pool = url.searchParams.get('pool') === 'arcano' ? 'arcano' : 'xadrez';
        const rows = env.DB ? (await env.DB.prepare("SELECT users.name AS name, ratings.r AS r, ratings.games AS games FROM ratings JOIN users ON users.id = ratings.user_id WHERE pool = ? AND rd <= ? AND users.kind = 'account' AND users.deleted = 0 ORDER BY r DESC LIMIT 50").bind(pool, PROVISIONAL_RD).all()).results : [];
        return json(req, env, { pool, top:rows.map((x, i) => ({ rank:i + 1, name:x.name, r:Math.round(x.r), games:x.games })) });
      }

      if (p === '/api/config') return json(req, env, { tc:Object.keys(TC), queues:QUEUES, leagues:LEAGUES, grandmaster:GRANDMASTER, provisionalRd:PROVISIONAL_RD });
      if (p === '/api/tc') return json(req, env, { tc:Object.keys(TC) });
      return json(req, env, { err:'Rota desconhecida.' }, 404);
    } catch (e){
      console.log('erro', e.stack || e.message);
      return json(req, env, { err:'Erro no servidor.' }, 500);
    }
  },
};
