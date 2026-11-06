// API do Arcane Chess online (Cloudflare Worker). Fase 1: convidado, partida por link, relógio e reconexão.
//   GET  /api/health
//   POST /api/guest            { name? }                 -> { token, user }
//   GET  /api/me               (Bearer)                  -> { user, ratings }
//   POST /api/name             (Bearer) { name }         -> { token, user }
//   POST /api/rooms            (Bearer) { mode, tc, color, deck } -> { id, link, room }
//   GET  /api/rooms/:id                                  -> room
//   GET  /api/rooms/:id/ws     WebSocket; 1ª mensagem { t:'hello', token }
//   GET  /api/queue/:fila/:ritmo/ws   filas: ranked, casual (Xadrez Puro), arcano-ranked, arcano-casual (12+5; o hello leva o grimório)
//   GET  /api/profile/:uid            perfil público: notas e ligas, vitórias/derrotas/empates por modo, grimório mais usado, últimas 20
//   GET  /api/replay/:id              replay de partida terminada: semente, grimórios e ações (o motor refaz tudo, mãos inclusive)
//   GET  /api/leaderboard?mode=xadrez|arcano&limit=50  ranking: id, nome, nota, rd e partidas (só contas com partida ranqueada)
//   GET  /api/auth/providers                      provedores de login configurados
//   POST /api/auth/start   (Bearer do convidado) { provider, return } -> { url } (state + PKCE)
//   GET  /api/auth/:provedor/callback             volta do provedor -> página do jogo #login=<código>
//   POST /api/auth/exchange { code }              -> { token, user }
//   POST /api/me/birth     (Bearer) { birth:'AAAA-MM-DD' }
import { GameRoom, TC } from './room.js';
import { Matchmaker, QUEUES, QUEUE_RE } from './queue.js';
import { DECK_IDS, RULES } from './engine.js';
import { signToken, verifyToken, bearer, randomId } from './auth.js';
import { publicRating } from './ratings.js';
import { enabled as authProviders, startLogin, callback as authCallback, fakeAuthorize, exchangeLogin } from './oauth.js';
import { LEAGUES, GRANDMASTER, PROVISIONAL_RD } from './glicko2.js';
export { GameRoom, Matchmaker };

const VERSION = 'fase2-a';
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
          row = await env.DB.prepare('SELECT id, kind, name, created, birth FROM users WHERE id = ? AND deleted = 0').bind(u.uid).first();
          if (!row) return json(req, env, { err:'Conta não encontrada.' }, 401);
          await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(Date.now(), u.uid).run();
        }
        const user = row ? { id:row.id, kind:row.kind, name:row.name, created:row.created, birth:!!row.birth } : { id:u.uid, name:u.name, kind:u.kind };
        if (row && env.DB) user.logins = (await env.DB.prepare('SELECT provider FROM identities WHERE user_id = ?').bind(row.id).all()).results.map(x => x.provider);
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

      // login (Google, Discord; o falso só com DEV_AUTH=1)
      if (p === '/api/auth/providers') return json(req, env, { providers:authProviders(env) });
      if (p === '/api/auth/start' && req.method === 'POST'){
        if (!env.DB) return json(req, env, { err:'Servidor sem banco.' }, 500);
        const b = await body(req), u = await auth(req, env);
        const r = await startLogin(req, env, u && u.kind === 'guest' ? u : null, String(b.provider || ''), String(b.return || ''));
        return r.err ? json(req, env, { err:r.err }, r.status) : json(req, env, { url:r.url });
      }
      if (p === '/api/auth/fake/authorize') return fakeAuthorize(req, env);
      const cb = p.match(/^\/api\/auth\/(google|discord|fake)\/callback$/);
      if (cb){ if (cb[1] === 'fake' && env.DEV_AUTH !== '1') return json(req, env, { err:'Rota desconhecida.' }, 404); return authCallback(req, env, cb[1]); }
      if (p === '/api/auth/exchange' && req.method === 'POST'){
        const r = await exchangeLogin(env, (await body(req)).code);
        return r ? json(req, env, r) : json(req, env, { err:'Código de login inválido ou expirado.' }, 400);
      }
      // data de nascimento (pedida ao virar conta; não aparece para ninguém)
      if (p === '/api/me/birth' && req.method === 'POST'){
        const u = await auth(req, env);
        if (!u) return json(req, env, { err:'Sessão inválida.' }, 401);
        const b = String((await body(req)).birth || ''), m = b.match(/^(\d{4})-(\d{2})-(\d{2})$/), d = m && new Date(b + 'T00:00:00Z');
        const age = d && !isNaN(d) ? (Date.now() - d.getTime()) / (365.25 * 86400000) : -1;
        if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== b || age < 3 || age > 120) return json(req, env, { err:'Data inválida.' }, 400);
        await env.DB.prepare('UPDATE users SET birth = ? WHERE id = ? AND deleted = 0').bind(b, u.uid).run();
        return json(req, env, { ok:true });
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

      const q = p.match(new RegExp('^' + QUEUE_RE.source));
      if (q){
        if (!(QUEUES[q[1]] || []).includes(q[2])) return json(req, env, { err:'Fila desconhecida.' }, 404);
        if (req.headers.get('Upgrade') !== 'websocket') return json(req, env, { err:'Use WebSocket.' }, 426);
        return env.QUEUE.get(env.QUEUE.idFromName(q[1] + ':' + q[2])).fetch(req);
      }

      if (p === '/api/leaderboard'){
        // ranking por modo (?mode= ou ?pool=, xadrez|arcano; ?limit= 1–100, padrão 50): só contas com partida ranqueada (convidados fora);
        // a nota provisória entra marcada. O id leva ao perfil (/api/profile/:uid).
        const want = url.searchParams.get('mode') || url.searchParams.get('pool');
        const pool = want === 'arcano' ? 'arcano' : 'xadrez';
        const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit'), 10) || 50));
        const rows = env.DB ? (await env.DB.prepare("SELECT users.id AS id, users.name AS name, ratings.r AS r, ratings.rd AS rd, ratings.games AS games FROM ratings JOIN users ON users.id = ratings.user_id WHERE pool = ? AND ratings.games > 0 AND users.kind = 'account' AND users.deleted = 0 ORDER BY r DESC LIMIT ?").bind(pool, limit).all()).results : [];
        return json(req, env, { mode:pool, pool, limit, top:rows.map((x, i) => ({ rank:i + 1, id:x.id, name:x.name, rating:Math.round(x.r), r:Math.round(x.r), rd:Math.round(x.rd), games:x.games, provisional:x.rd > PROVISIONAL_RD })) });
      }

      if (p === '/api/config') return json(req, env, { tc:Object.keys(TC), queues:QUEUES, decks:DECK_IDS, rules:RULES, leagues:LEAGUES, grandmaster:GRANDMASTER, provisionalRd:PROVISIONAL_RD });

      const pf = p.match(/^\/api\/profile\/([A-Za-z0-9_]{3,40})$/);
      if (pf){
        if (!env.DB) return json(req, env, { err:'Servidor sem banco.' }, 500);
        let u = await env.DB.prepare('SELECT id, kind, name, created, deleted, merged_into FROM users WHERE id = ?').bind(pf[1]).first();
        // convidado fundido numa conta: o perfil é o da conta
        if (u && u.deleted && u.merged_into) u = await env.DB.prepare('SELECT id, kind, name, created, deleted, merged_into FROM users WHERE id = ?').bind(u.merged_into).first();
        if (!u || u.deleted) return json(req, env, { err:'Jogador não encontrado.' }, 404);
        const id = u.id, done = "result IN ('1-0', '0-1', '1/2-1/2')";
        const [stats, deck, recent] = await Promise.all([
          env.DB.prepare(`SELECT mode, SUM(CASE WHEN (white = ?1 AND result = '1-0') OR (black = ?1 AND result = '0-1') THEN 1 ELSE 0 END) AS w,
            SUM(CASE WHEN (white = ?1 AND result = '0-1') OR (black = ?1 AND result = '1-0') THEN 1 ELSE 0 END) AS l,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) AS d FROM games WHERE (white = ?1 OR black = ?1) AND ${done} GROUP BY mode`).bind(id).all(),
          env.DB.prepare(`SELECT deck, COUNT(*) AS n FROM (SELECT deck_w AS deck FROM games WHERE white = ?1 AND mode = 'arcano' AND ${done}
            UNION ALL SELECT deck_b AS deck FROM games WHERE black = ?1 AND mode = 'arcano' AND ${done}) WHERE deck IS NOT NULL GROUP BY deck ORDER BY n DESC, deck LIMIT 1`).bind(id).first(),
          env.DB.prepare(`SELECT g.id, g.mode, g.tc, g.ranked, g.white, g.black, COALESCE(g.w_name, uw.name) AS w_name, COALESCE(g.b_name, ub.name) AS b_name, g.result, g.reason, g.plies, g.ended,
            g.w_delta, g.b_delta, g.deck_w, g.deck_b, g.actions IS NOT NULL AS replay FROM games g LEFT JOIN users uw ON uw.id = g.white LEFT JOIN users ub ON ub.id = g.black
            WHERE g.white = ?1 OR g.black = ?1 ORDER BY g.ended DESC LIMIT 20`).bind(id).all(),
        ]);
        const by = {}; for (const m of ['xadrez', 'arcano']) by[m] = { w:0, l:0, d:0 };
        for (const r of stats.results) by[r.mode] = { w:r.w || 0, l:r.l || 0, d:r.d || 0 };
        const games = recent.results.map(g => {
          const color = g.white === id ? 'w' : 'b', score = g.result;
          const outcome = score === 'abortada' ? 'cancelada' : score === '1/2-1/2' ? 'empate' : (score === '1-0') === (color === 'w') ? 'vitoria' : 'derrota';
          return { id:g.id, mode:g.mode, tc:g.tc, ranked:!!g.ranked, color, outcome, score, reason:g.reason, plies:g.plies, ended:g.ended,
            opponent:{ id:color === 'w' ? g.black : g.white, name:color === 'w' ? g.b_name : g.w_name }, deck:color === 'w' ? g.deck_w : g.deck_b,
            delta:color === 'w' ? g.w_delta : g.b_delta, replay:!!g.replay && score !== 'abortada' };
        });
        return json(req, env, { user:{ id, name:u.name, kind:u.kind, since:u.created },
          ratings:{ xadrez:await publicRating(env.DB, id, u.kind, 'xadrez'), arcano:await publicRating(env.DB, id, u.kind, 'arcano') },
          stats:by, deck:deck ? { id:deck.deck, games:deck.n } : null, recent:games });
      }

      const rp = p.match(/^\/api\/replay\/([a-z0-9]{8})$/);
      if (rp){
        const g = env.DB ? await env.DB.prepare(`SELECT g.*, COALESCE(g.w_name, uw.name) AS wn, COALESCE(g.b_name, ub.name) AS bn FROM games g LEFT JOIN users uw ON uw.id = g.white LEFT JOIN users ub ON ub.id = g.black WHERE g.id = ?`).bind(rp[1]).first() : null;
        // só partidas terminadas estão no histórico; sem as ações (partidas antigas ou canceladas) não há replay
        if (!g || g.actions == null || g.result === 'abortada') return json(req, env, { err:'Replay indisponível.' }, 404);
        return json(req, env, { id:g.id, mode:g.mode, tc:g.tc, ranked:!!g.ranked, seed:g.seed, decks:g.mode === 'arcano' ? { w:g.deck_w, b:g.deck_b } : null,
          players:{ w:{ id:g.white, name:g.wn }, b:{ id:g.black, name:g.bn } }, result:g.result, reason:g.reason, plies:g.plies, ended:g.ended,
          moves:g.moves ? g.moves.split(' ') : [], actions:JSON.parse(g.actions), rules:g.rules, rulesNow:RULES, delta:{ w:g.w_delta, b:g.b_delta } });
      }
      if (p === '/api/tc') return json(req, env, { tc:Object.keys(TC) });
      return json(req, env, { err:'Rota desconhecida.' }, 404);
    } catch (e){
      console.log('erro', e.stack || e.message);
      return json(req, env, { err:'Erro no servidor.' }, 500);
    }
  },
};
