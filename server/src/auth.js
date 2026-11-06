// Ficha de sessão assinada (HMAC-SHA256): "<payload base64url>.<assinatura base64url>".
// O segredo vem de env.SESSION_SECRET (em produção: `wrangler secret put SESSION_SECRET`; local: server/.dev.vars, fora do git).
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const keys = new Map();
function hmacKey(secret){
  if (!keys.has(secret)) keys.set(secret, crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign', 'verify']));
  return keys.get(secret);
}
export const TOKEN_DAYS = 90;
export async function signToken(payload, secret){
  if (!secret) throw new Error('SESSION_SECRET ausente');
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(enc.encode(JSON.stringify({ ...payload, iat:now, exp:now + TOKEN_DAYS * 86400 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return body + '.' + b64u(sig);
}
export async function verifyToken(token, secret){
  if (!secret || typeof token !== 'string' || token.length > 2048) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(dec.decode(unb64u(body)));
    if (!p.uid || (p.exp && Date.now() / 1000 > p.exp)) return null;
    return p;
  } catch (e){ return null; }
}
export function bearer(req){
  const h = req.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}
// identificadores curtos sem letras ambíguas (sala por link, convidado)
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
export function randomId(n = 8){
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const x of b) s += ALPHA[x % ALPHA.length];
  return s;
}
