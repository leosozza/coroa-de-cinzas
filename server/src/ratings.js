// Notas no D1 (tabela ratings): leitura com o desvio envelhecido, atualização de uma partida ranqueada e posição no ranking.
import { START, aged, duel, league, PROVISIONAL_RD } from './glicko2.js';

export async function getRating(db, uid, pool, now = Date.now()){
  const row = db ? await db.prepare('SELECT r, rd, vol, games, updated FROM ratings WHERE user_id = ? AND pool = ?').bind(uid, pool).first() : null;
  return aged(row || { ...START, games:0, updated:0 }, now);
}
// posição entre as notas firmes (desvio até 110) de contas; o convidado não entra no topo
export async function rankOf(db, r, pool){
  if (!db) return null;
  const x = await db.prepare("SELECT count(*) AS n FROM ratings JOIN users ON users.id = ratings.user_id WHERE pool = ? AND rd <= ? AND r > ? AND users.kind = 'account' AND users.deleted = 0").bind(pool, PROVISIONAL_RD, r).first();
  return (x ? x.n : 0) + 1;
}
export async function publicRating(db, uid, kind, pool){
  const p = await getRating(db, uid, pool);
  const firm = p.rd <= PROVISIONAL_RD, rank = firm && kind === 'account' ? await rankOf(db, p.r, pool) : null;
  const L = league(p.r, rank, firm && kind === 'account');
  return { r:Math.round(p.r), rd:Math.round(p.rd), games:p.games || 0, provisional:!firm, league:L.id, leagueName:L.name, rank };
}
// partida ranqueada terminada: score das Brancas 1, 0,5 ou 0. Grava as duas notas numa transação (batch)
export async function rateGame(db, pool, wUid, bUid, scoreW, now = Date.now()){
  const [w0, b0] = await Promise.all([getRating(db, wUid, pool, now), getRating(db, bUid, pool, now)]);
  const [w1, b1] = duel(w0, b0, scoreW, now);
  const up = (uid, p, games) => db.prepare('INSERT INTO ratings (user_id, pool, r, rd, vol, games, updated) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, pool) DO UPDATE SET r = excluded.r, rd = excluded.rd, vol = excluded.vol, games = excluded.games, updated = excluded.updated')
    .bind(uid, pool, p.r, p.rd, p.vol, games, now);
  await db.batch([up(wUid, w1, (w0.games || 0) + 1), up(bUid, b1, (b0.games || 0) + 1)]);
  const out = (a, b) => ({ before:Math.round(a.r), after:Math.round(b.r), delta:Math.round(b.r) - Math.round(a.r), rd:Math.round(b.rd) });
  return { w:out(w0, w1), b:out(b0, b1) };
}
