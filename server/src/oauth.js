// Login com Google e Discord (OAuth 2.0, código de autorização com state e PKCE S256), mais um provedor falso só para teste.
// Fluxo: POST /api/auth/start → URL do provedor → /api/auth/<provedor>/callback → volta ao jogo com #login=<código de uso único>
// → POST /api/auth/exchange devolve a ficha. A ficha nunca passa pela URL.
// Ids de cliente: env.GOOGLE_CLIENT_ID, env.DISCORD_CLIENT_ID (vars). Segredos: env.GOOGLE_CLIENT_SECRET, env.DISCORD_CLIENT_SECRET
// (só `wrangler secret put`). Provedor falso: env.DEV_AUTH = '1' (nunca em produção).
import { signToken, verifyToken, randomId } from './auth.js';

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomB64u = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
async function s256(v){ return b64u(await crypto.subtle.digest('SHA-256', enc.encode(v))); }
const STATE_TTL = 10 * 60000, CODE_TTL = 2 * 60000;

export const PROVIDERS = {
  google:{ name:'Google', authorize:'https://accounts.google.com/o/oauth2/v2/auth', token:'https://oauth2.googleapis.com/token',
    profile:'https://openidconnect.googleapis.com/v1/userinfo', scope:'openid profile', id:'GOOGLE_CLIENT_ID', secret:'GOOGLE_CLIENT_SECRET',
    who:p => ({ sub:p.sub, name:p.given_name || p.name }) },
  discord:{ name:'Discord', authorize:'https://discord.com/oauth2/authorize', token:'https://discord.com/api/oauth2/token',
    profile:'https://discord.com/api/users/@me', scope:'identify', id:'DISCORD_CLIENT_ID', secret:'DISCORD_CLIENT_SECRET',
    who:p => ({ sub:p.id, name:p.global_name || p.username }) },
  fake:{ name:'Teste', dev:true },
};
export function enabled(env){
  const out = [];
  for (const [k, P] of Object.entries(PROVIDERS)){
    if (P.dev ? env.DEV_AUTH === '1' : !!(env[P.id] && env[P.secret])) out.push({ id:k, name:P.name });
  }
  return out;
}
const redirectUri = (req, provider) => new URL(req.url).origin + `/api/auth/${provider}/callback`;
// a volta só vai para uma página do jogo numa origem permitida (sem redirecionamento aberto)
export function safeReturn(env, u){
  try {
    const x = new URL(u), allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(s => s && s !== '*');
    if (!allowed.includes(x.origin)) return null;
    x.hash = '';
    return x.toString();
  } catch (e){ return null; }
}

export async function startLogin(req, env, guest, provider, ret){
  const P = PROVIDERS[provider];
  if (!P || !enabled(env).some(x => x.id === provider)) return { err:'Login indisponível.', status:400 };
  const back = safeReturn(env, ret);
  if (!back) return { err:'Endereço de volta não permitido.', status:400 };
  const now = Date.now(), state = randomB64u(24), verifier = randomB64u(48), challenge = await s256(verifier);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_states WHERE created < ?').bind(now - STATE_TTL),
    env.DB.prepare('DELETE FROM login_codes WHERE created < ?').bind(now - CODE_TTL),
    env.DB.prepare('INSERT INTO oauth_states (state, provider, verifier, guest_id, return_url, created) VALUES (?, ?, ?, ?, ?, ?)').bind(state, provider, verifier, guest ? guest.uid : null, back, now),
  ]);
  const q = new URLSearchParams({ response_type:'code', redirect_uri:redirectUri(req, provider), state, code_challenge:challenge, code_challenge_method:'S256' });
  if (P.dev) return { url:new URL(req.url).origin + '/api/auth/fake/authorize?' + q };
  q.set('client_id', env[P.id]); q.set('scope', P.scope);
  if (provider === 'google') q.set('prompt', 'select_account');
  return { url:P.authorize + '?' + q };
}

// provedor falso: uma página com um campo de nome (ou ?sub=&name= direto, para testes automáticos).
// O "código" é assinado e carrega o desafio PKCE; a troca confere o verificador como um provedor de verdade.
export async function fakeAuthorize(req, env){
  if (env.DEV_AUTH !== '1') return new Response('não encontrado', { status:404 });
  const u = new URL(req.url), p = u.searchParams, sub = p.get('sub'), name = p.get('name') || sub;
  const redirect = p.get('redirect_uri') || '', state = p.get('state') || '', ch = p.get('code_challenge') || '';
  if (!redirect.startsWith(u.origin + '/api/auth/fake/callback')) return new Response('redirect_uri inválido', { status:400 });
  if (!sub){
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
    const hidden = ['response_type', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method'].map(k => `<input type="hidden" name="${k}" value="${esc(p.get(k) || '')}">`).join('');
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login de teste</title>
<body style="font:16px system-ui;background:#111;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0"><form method="get" style="display:grid;gap:10px;padding:20px;border:1px solid #555;border-radius:6px">
<b>Provedor de teste (só no servidor local)</b><label>Identificador <input name="sub" id="sub" required value="teste1"></label><label>Nome <input name="name" id="name" value="Jogador Teste"></label>${hidden}<button id="ok">Entrar</button></form></body>`, { headers:{ 'content-type':'text/html; charset=utf-8' } });
  }
  const code = await signToken({ uid:'fake', sub, name, ch, prov:'fake' }, env.SESSION_SECRET);
  return Response.redirect(redirect + '?' + new URLSearchParams({ code, state }), 302);
}

async function exchange(req, env, provider, code, verifier){
  const P = PROVIDERS[provider];
  if (P.dev){
    const c = await verifyToken(code, env.SESSION_SECRET);
    if (!c || c.prov !== 'fake') throw new Error('código inválido');
    if (c.ch !== await s256(verifier)) throw new Error('pkce');
    return { sub:'fake:' + c.sub, name:c.name };
  }
  const body = new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:redirectUri(req, provider), client_id:env[P.id], client_secret:env[P.secret], code_verifier:verifier });
  const t = await fetch(P.token, { method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded', accept:'application/json' }, body });
  const tj = await t.json().catch(() => ({}));
  if (!t.ok || !tj.access_token) throw new Error('troca recusada');
  const pr = await fetch(P.profile, { headers:{ Authorization:'Bearer ' + tj.access_token, accept:'application/json' } });
  const pj = await pr.json().catch(() => ({}));
  const w = P.who(pj);
  if (!pr.ok || !w.sub) throw new Error('perfil');
  return { sub:String(w.sub), name:w.name || P.name };
}

const DEFAULT_NAME = /^Convidado \d{4}$/;
function cleanName(n){
  const s = String(n || '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s.length >= 3 ? s : null;
}
// funde o convidado numa conta que já existia: em cada modo fica a nota com mais partidas (empate: a mais firme),
// e as partidas somam; o histórico passa para a conta e o convidado fica marcado como fundido
export async function mergeGuest(db, guestId, accountId){
  if (!guestId || guestId === accountId) return;
  const rows = (await db.prepare('SELECT user_id, pool, r, rd, vol, games, updated FROM ratings WHERE user_id IN (?, ?)').bind(guestId, accountId).all()).results;
  const st = [];
  for (const pool of new Set(rows.map(r => r.pool))){
    const g = rows.find(r => r.pool === pool && r.user_id === guestId), a = rows.find(r => r.pool === pool && r.user_id === accountId);
    if (!g) continue;
    const keep = !a ? g : g.games > a.games || (g.games === a.games && g.rd < a.rd) ? g : a;
    const games = (a ? a.games : 0) + g.games;
    st.push(db.prepare('INSERT INTO ratings (user_id, pool, r, rd, vol, games, updated) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, pool) DO UPDATE SET r = excluded.r, rd = excluded.rd, vol = excluded.vol, games = excluded.games, updated = excluded.updated')
      .bind(accountId, pool, keep.r, keep.rd, keep.vol, games, Math.max(g.updated || 0, a ? a.updated || 0 : 0)));
  }
  st.push(db.prepare('DELETE FROM ratings WHERE user_id = ?').bind(guestId));
  st.push(db.prepare('UPDATE games SET white = ? WHERE white = ?').bind(accountId, guestId));
  st.push(db.prepare('UPDATE games SET black = ? WHERE black = ?').bind(accountId, guestId));
  // campanha: as estrelas do convidado somam às da conta; cartas e Selos entram na coleção dela
  st.push(db.prepare('INSERT INTO campaign_progress (user_id, phase, stars, updated) SELECT ?, phase, stars, updated FROM campaign_progress WHERE user_id = ? ON CONFLICT(user_id, phase) DO UPDATE SET stars = campaign_progress.stars | excluded.stars, updated = MAX(campaign_progress.updated, excluded.updated)').bind(accountId, guestId));
  st.push(db.prepare('INSERT OR IGNORE INTO campaign_items (user_id, kind, item, created) SELECT ?, kind, item, created FROM campaign_items WHERE user_id = ?').bind(accountId, guestId));
  st.push(db.prepare('DELETE FROM campaign_progress WHERE user_id = ?').bind(guestId));
  st.push(db.prepare('DELETE FROM campaign_items WHERE user_id = ?').bind(guestId));
  st.push(db.prepare('UPDATE users SET deleted = 1, merged_into = ? WHERE id = ?').bind(accountId, guestId));
  await db.batch(st);
}

export async function callback(req, env, provider){
  const u = new URL(req.url), state = u.searchParams.get('state') || '', code = u.searchParams.get('code') || '';
  const row = state ? await env.DB.prepare('SELECT state, provider, verifier, guest_id, return_url, created FROM oauth_states WHERE state = ?').bind(state).first() : null;
  if (row) await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();   // uso único
  const fail = (why, back) => back ? Response.redirect(back + '#login-erro=' + encodeURIComponent(why), 302) : new Response('Login inválido ou expirado. Volte ao jogo e tente de novo.', { status:400, headers:{ 'content-type':'text/plain; charset=utf-8' } });
  if (!row || row.provider !== provider || Date.now() - row.created > STATE_TTL) return fail('estado', row && row.return_url);
  if (u.searchParams.get('error') || !code) return fail('cancelado', row.return_url);
  let who;
  try { who = await exchange(req, env, provider, code, row.verifier); } catch (e){ return fail(e.message === 'pkce' ? 'pkce' : 'provedor', row.return_url); }
  const db = env.DB, now = Date.now();
  const ident = await db.prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?').bind(provider, who.sub).first();
  const guest = row.guest_id ? await db.prepare('SELECT id, kind, name, deleted FROM users WHERE id = ?').bind(row.guest_id).first() : null;
  let uid;
  if (ident){
    // conta que já existe: o convidado (com a nota dele) é fundido nela
    uid = ident.user_id;
    if (guest && !guest.deleted && guest.kind === 'guest') await mergeGuest(db, guest.id, uid);
  } else if (guest && !guest.deleted && guest.kind === 'guest'){
    // primeira vez: o próprio convidado vira conta (mesmo id, mesma nota); o nome padrão dá lugar ao do provedor
    uid = guest.id;
    const name = DEFAULT_NAME.test(guest.name) ? cleanName(who.name) || guest.name : guest.name;
    await db.batch([
      db.prepare("UPDATE users SET kind = 'account', name = ? WHERE id = ?").bind(name, uid),
      db.prepare('INSERT INTO identities (provider, subject, user_id, created) VALUES (?, ?, ?, ?)').bind(provider, who.sub, uid, now),
    ]);
  } else {
    uid = 'u_' + randomId(12);
    await db.batch([
      db.prepare("INSERT INTO users (id, kind, name, created, last_seen) VALUES (?, 'account', ?, ?, ?)").bind(uid, cleanName(who.name) || 'Jogador ' + randomId(4), now, now),
      db.prepare('INSERT INTO identities (provider, subject, user_id, created) VALUES (?, ?, ?, ?)').bind(provider, who.sub, uid, now),
    ]);
  }
  const lc = randomB64u(24);
  await db.prepare('INSERT INTO login_codes (code, user_id, created) VALUES (?, ?, ?)').bind(lc, uid, now).run();
  return Response.redirect(row.return_url + '#login=' + lc, 302);
}

export async function exchangeLogin(env, code){
  if (typeof code !== 'string' || code.length > 64) return null;
  const row = await env.DB.prepare('SELECT user_id, created FROM login_codes WHERE code = ?').bind(code).first();
  if (!row) return null;
  await env.DB.prepare('DELETE FROM login_codes WHERE code = ?').bind(code).run();
  if (Date.now() - row.created > CODE_TTL) return null;
  const u = await env.DB.prepare('SELECT id, kind, name FROM users WHERE id = ? AND deleted = 0').bind(row.user_id).first();
  if (!u) return null;
  const token = await signToken({ uid:u.id, name:u.name, kind:u.kind }, env.SESSION_SECRET);
  return { token, user:u };
}
