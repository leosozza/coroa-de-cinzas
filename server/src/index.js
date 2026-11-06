// API do Arcane Chess online (Cloudflare Worker). Fase 1: convidado, partida por link, relógio e reconexão.
//   GET  /api/health
//   POST /api/guest            { name? }                 -> { token, user }
//   GET  /api/me               (Bearer)                  -> { user }
//   POST /api/rooms            (Bearer) { mode, tc, color, deck } -> { id, link, room }
//   GET  /api/rooms/:id                                  -> room
//   GET  /api/rooms/:id/ws     WebSocket; 1ª mensagem { t:'hello', token }
import { GameRoom, TC } from './room.js';
import { signToken, verifyToken, bearer, randomId } from './auth.js';
export { GameRoom };

const VERSION = 'fase1-a';
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
        return json(req, env, { user:row || { id:u.uid, name:u.name, kind:u.kind } });
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

      if (p === '/api/tc') return json(req, env, { tc:Object.keys(TC) });
      return json(req, env, { err:'Rota desconhecida.' }, 404);
    } catch (e){
      console.log('erro', e.stack || e.message);
      return json(req, env, { err:'Erro no servidor.' }, 500);
    }
  },
};
