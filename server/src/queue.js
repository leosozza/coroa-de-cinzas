// Fila (Durable Object): uma por fila e ritmo, ex. "ranked:10+0". Junta jogadores por nota com uma janela que abre
// conforme a espera; achou o par, cria a sala já com os dois lugares e avisa os dois. Sem rival em 30 s, oferece a IA
// (no aparelho do jogador, sem nota) e continua procurando enquanto ele quiser.
import { verifySession, randomId } from './auth.js';
import { getRating } from './ratings.js';

export const QUEUES = { ranked:['10+0', '3+2'], casual:['10+0', '3+2', '5+3'] };
const TICK = 2000;
// janela de nota: 150 pontos, +25 a cada segundo de espera; na ranqueada até 500, na casual sem limite depois de 20 s
export function windowFor(queue, waitedMs){
  const w = 150 + 25 * waitedMs / 1000;
  return queue === 'ranked' ? Math.min(500, w) : waitedMs >= 20000 ? Infinity : w;
}
// nível da IA de reserva pela nota (1 Recruta, 2 Veterano, 3 Mestre)
export const aiLevel = r => (r < 1300 ? 1 : r < 1700 ? 2 : 3);

export class Matchmaker {
  constructor(ctx, env){ this.ctx = ctx; this.env = env; }
  get aiMs(){ return +this.env.QUEUE_AI_MS || 30000; }
  tickets(){ return this.ctx.getWebSockets().map(ws => ({ ws, t:ws.deserializeAttachment() || {} })).filter(x => x.t.uid && !x.t.done); }
  send(ws, o){ try { ws.send(JSON.stringify(o)); } catch (e){} }

  async fetch(req){
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('use WebSocket', { status:426 });
    const url = new URL(req.url), m = url.pathname.match(/\/api\/queue\/(ranked|casual)\/([0-9+]+)\/ws$/);
    if (!m || !(QUEUES[m[1]] || []).includes(m[2])) return new Response('fila desconhecida', { status:404 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ queue:m[1], tc:m[2] });
    return new Response(null, { status:101, webSocket:pair[0] });
  }
  async webSocketMessage(ws, raw){
    let m; try { m = JSON.parse(String(raw).slice(0, 4096)); } catch (e){ return; }
    const t = ws.deserializeAttachment() || {};
    if (m.t === 'ping') return this.send(ws, { t:'pong' });
    if (t.uid || m.t !== 'hello') return;
    const p = await verifySession(m.token, this.env);
    if (!p){ this.send(ws, { t:'error', err:'Sessão inválida.', code:'auth' }); ws.close(4001, 'auth'); return; }
    // a mesma pessoa em duas abas: fica só a mais nova
    for (const x of this.tickets()) if (x.t.uid === p.uid && x.ws !== ws){ x.t.done = true; x.ws.serializeAttachment(x.t); this.send(x.ws, { t:'replaced' }); try { x.ws.close(4002, 'outra aba'); } catch (e){} }
    const rt = await getRating(this.env.DB, p.uid, 'xadrez');
    Object.assign(t, { uid:p.uid, name:p.name, r:rt.r, rd:rt.rd, since:Date.now(), offered:false });
    ws.serializeAttachment(t);
    this.send(ws, { t:'queued', queue:t.queue, tc:t.tc, r:Math.round(t.r) });
    await this.match();
  }
  async webSocketClose(ws, code){ try { ws.close(code === 1005 ? 1000 : code, 'tchau'); } catch (e){} }
  async webSocketError(){}
  async alarm(){ await this.match(); }

  async match(){
    const now = Date.now(), list = this.tickets().sort((a, b) => a.t.since - b.t.since);
    const used = new Set();
    for (let i = 0; i < list.length; i++){
      const A = list[i];
      if (used.has(i)) continue;
      for (let j = i + 1; j < list.length; j++){
        const B = list[j];
        if (used.has(j) || A.t.uid === B.t.uid) continue;
        const gap = Math.abs(A.t.r - B.t.r);
        if (gap <= windowFor(A.t.queue, now - A.t.since) && gap <= windowFor(B.t.queue, now - B.t.since)){
          used.add(i); used.add(j);
          await this.pair(A, B);
          break;
        }
      }
    }
    for (const x of this.tickets()){
      const waited = now - x.t.since;
      if (!x.t.offered && waited >= this.aiMs){ x.t.offered = true; x.ws.serializeAttachment(x.t); this.send(x.ws, { t:'offer-ai', level:aiLevel(x.t.r), waited }); }
      else this.send(x.ws, { t:'waiting', waited, size:this.tickets().length, window:Math.round(Math.min(9999, windowFor(x.t.queue, waited))) });
    }
    if (this.tickets().length) await this.ctx.storage.setAlarm(now + TICK);
  }
  async pair(A, B){
    const id = randomId(8), flip = crypto.getRandomValues(new Uint8Array(1))[0] & 1;
    const [W, Bk] = flip ? [A, B] : [B, A];
    const seats = { w:{ uid:W.t.uid, name:W.t.name }, b:{ uid:Bk.t.uid, name:Bk.t.name } };
    const stub = this.env.GAME.get(this.env.GAME.idFromName(id));
    const r = await stub.fetch('https://sala/init', { method:'POST', body:JSON.stringify({ id, uid:W.t.uid, name:W.t.name, mode:'xadrez', tc:A.t.tc, color:'w', ranked:A.t.queue === 'ranked', queue:A.t.queue, seats }) });
    if (!r.ok) return;
    for (const [x, color, opp] of [[W, 'w', Bk], [Bk, 'b', W]]){
      x.t.done = true; x.ws.serializeAttachment(x.t);
      this.send(x.ws, { t:'match', room:id, color, ranked:A.t.queue === 'ranked', tc:A.t.tc, opponent:{ name:opp.t.name, r:Math.round(opp.t.r) } });
      try { x.ws.close(1000, 'pareado'); } catch (e){}
    }
  }
}
