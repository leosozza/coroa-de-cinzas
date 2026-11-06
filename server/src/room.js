// Sala de partida (Durable Object): uma por partida. O servidor é a autoridade — valida cada ação com o motor
// (engine/arcano-rules.js, o mesmo do jogo), guarda as mãos e grimórios escondidos, sorteia e controla o relógio.
// WebSocket com hibernação: a sala dorme entre lances e acorda com o estado salvo.
import { ARC, CATALOG, DECK_IDS as DECKS, RULES } from './engine.js';
import { verifySession } from './auth.js';
import { rateGame } from './ratings.js';

const TRAP = new Set(CATALOG.filter(c => c.tipo === 'armadilha').map(c => c.id));
// ritmos: [minutos, incremento em segundos]; 'livre' = sem relógio (amistosa)
export const TC = { '10+0':[10, 0], '3+2':[3, 2], '5+3':[5, 3], '12+5':[12, 5], livre:[0, 0] };
const other = c => (c === 'w' ? 'b' : 'w');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers:{ 'content-type':'application/json; charset=utf-8' } });
const MAX_MSG = 8192;

// o que o rival não pode ver nos eventos: cartas compradas ou queimadas, qual armadilha foi armada e onde, e a previsão do Oráculo
function eventsFor(events, viewer){
  return events.map(e => {
    if (viewer === e.side) return e;
    if ((e.k === 'draw' || e.k === 'burn') && e.card) return { ...e, card:{ uid:'?', id:'?' } };
    if (e.k === 'card' && e.card && TRAP.has(e.card.id)) return { ...e, card:{ uid:'?', id:'?' }, picks:[] };
    if (e.k === 'trap') return { k:'trap', side:e.side };
    if (e.k === 'oracle') return { k:'oracle', side:e.side, moves:[] };
    return e;
  });
}
// espectador: não vê mão nem armadilha de ninguém
function spectatorView(s){
  const v = JSON.parse(JSON.stringify(s));
  for (const c of ['w', 'b']) v.arc.hand[c] = v.arc.hand[c].map(() => ({ uid:'?', id:'?' }));
  v.arc.deck = { w:v.arc.deck.w.length, b:v.arc.deck.b.length };
  v.arc.traps = v.arc.traps.map(t => t.seen ? t : { id:'?', side:t.side, sq:t.sq || null, glow:t.sq || (t.pid != null ? 'peça' : null) });
  v.rng = 0;
  return v;
}
const RESULT = w => (w === 'w' ? '1-0' : w === 'b' ? '0-1' : '1/2-1/2');
const REASON = { mate:'mate', stalemate:'afogamento', rep:'repeticao', material:'material', fifty:'50 lances' };

export class GameRoom {
  constructor(ctx, env){
    this.ctx = ctx; this.env = env; this.g = null;
    ctx.blockConcurrencyWhile(async () => { this.g = (await ctx.storage.get('g')) || null; });
  }
  get reconnectMs(){ return +this.env.RECONNECT_MS || 60000; }
  get firstMoveMs(){ return +this.env.FIRST_MOVE_MS || 60000; }
  async save(){ await this.ctx.storage.put('g', this.g); }

  async fetch(req){
    const url = new URL(req.url), path = url.pathname;
    if (path === '/init' && req.method === 'POST'){
      if (this.g) return json({ err:'A sala já existe.' }, 409);
      const b = await req.json();
      const mode = b.mode === 'arcano' ? 'arcano' : 'xadrez';
      const tcs = this.env.DEV_TC === '1' && /^\d+(\.\d+)?\+\d+$/.test(b.tc || '') ? b.tc : TC[b.tc] ? b.tc : (mode === 'arcano' ? '12+5' : '10+0');
      const [min, inc] = TC[tcs] || tcs.split('+').map(Number);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
      const pick = d => (DECKS.includes(d) ? d : DECKS[crypto.getRandomValues(new Uint8Array(1))[0] % DECKS.length]);
      const creatorSeat = b.color === 'w' || b.color === 'b' ? b.color : (seed & 1 ? 'w' : 'b');
      // na fila do Arcano cada um escolheu o grimório ao entrar (já validado); por link, só o criador escolhe
      const decks = mode !== 'arcano' ? null : b.decks && DECKS.includes(b.decks.w) && DECKS.includes(b.decks.b) ? { w:b.decks.w, b:b.decks.b }
        : { [creatorSeat]:pick(b.deck), [other(creatorSeat)]:null };
      this.g = {
        id:b.id, mode, tc:tcs, base:min * 60000, inc:inc * 1000, ranked:!!b.ranked, created:Date.now(),
        creator:{ uid:b.uid, name:b.name }, creatorSeat, decks, seed,
        seats:{ w:null, b:null }, status:'waiting', s:null, clocks:{ w:min * 60000, b:min * 60000 }, turnStart:0, started:false,
        firstMoveBy:0, away:{ w:0, b:0 }, drawOffer:null, result:null, n:0,
        log:[],   // ações aceitas, na ordem: com a semente e os grimórios, o motor refaz a partida inteira (replay)
      };
      // na fila os dois lugares já vêm marcados
      if (b.seats){ for (const c of ['w', 'b']) if (b.seats[c]) this.g.seats[c] = b.seats[c]; this.g.queue = b.queue || null; this.g.showBy = Date.now() + (+this.env.SHOW_MS || 30000); }
      await this.save();
      if (this.g.showBy) await this.schedule();
      return json(this.info());
    }
    if (path === '/info') return this.g ? json(this.info()) : json({ err:'Sala não encontrada.' }, 404);
    if (req.headers.get('Upgrade') === 'websocket'){
      if (!this.g) return json({ err:'Sala não encontrada.' }, 404);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ uid:null, seat:null });
      return new Response(null, { status:101, webSocket:pair[0] });
    }
    return json({ err:'Rota desconhecida.' }, 404);
  }

  info(){
    const g = this.g;
    return { id:g.id, mode:g.mode, tc:g.tc, ranked:g.ranked, status:g.status, result:g.result,
      players:{ w:g.seats.w && { name:g.seats.w.name }, b:g.seats.b && { name:g.seats.b.name } }, creator:g.creator.name };
  }
  // o socket que está fechando ainda aparece em getWebSockets(): fica de fora
  sockets(){ return this.ctx.getWebSockets().filter(ws => ws !== this.closing).map(ws => ({ ws, at:ws.deserializeAttachment() || {} })); }
  online(seat){ return this.sockets().some(x => x.at.seat === seat); }
  presence(){
    const g = this.g, p = {};
    for (const c of ['w', 'b']) p[c] = g.seats[c] ? { name:g.seats[c].name, online:this.online(c), away:g.away[c] || 0 } : null;
    return p;
  }
  clockMsg(){
    const g = this.g;
    return { w:g.clocks.w, b:g.clocks.b, inc:g.inc, running:g.status === 'playing' && g.started ? ARC.actor(g.s) : null, since:g.turnStart, now:Date.now(), firstMoveBy:g.started ? 0 : g.firstMoveBy };
  }
  snapshot(seat, events = [], last = null){
    const g = this.g;
    return { t:'state', status:g.status, result:g.result, mode:g.mode, n:g.n,
      state:g.s ? (seat ? ARC.viewFor(g.s, seat) : spectatorView(g.s)) : null,
      events:eventsFor(events, seat), last, clocks:this.clockMsg(), players:this.presence(), drawOffer:g.drawOffer };
  }
  send(ws, o){ try { ws.send(JSON.stringify(o)); } catch (e){} }
  broadcast(events = [], last = null){ for (const { ws, at } of this.sockets()) if (at.uid) this.send(ws, this.snapshot(at.seat, events, last)); }

  async webSocketMessage(ws, raw){
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return this.send(ws, { t:'error', err:'Mensagem inválida.' });
    let m; try { m = JSON.parse(raw); } catch (e){ return this.send(ws, { t:'error', err:'Mensagem inválida.' }); }
    const at = ws.deserializeAttachment() || {};
    if (!at.uid){
      if (m.t !== 'hello') return this.send(ws, { t:'error', err:'Identifique-se primeiro.' });
      const p = await verifySession(m.token, this.env);
      if (!p){ this.send(ws, { t:'error', err:'Sessão inválida.', code:'auth' }); ws.close(4001, 'auth'); return; }
      at.uid = p.uid; at.name = p.name;
      return this.join(ws, at);
    }
    if (m.t === 'ping') return this.send(ws, { t:'pong', now:Date.now() });
    if (!at.seat) return this.send(ws, { t:'error', err:'Você está assistindo.' });
    if (m.t === 'act') return this.act(ws, at, m.a);
    if (m.t === 'resign') return this.resign(at.seat);
    if (m.t === 'draw') return this.draw(ws, at.seat, m.op);
    return this.send(ws, { t:'error', err:'Mensagem desconhecida.' });
  }
  async webSocketClose(ws, code){ try { ws.close(code === 1005 ? 1000 : code, 'tchau'); } catch (e){} await this.left(ws); }
  async webSocketError(ws){ await this.left(ws); }

  async join(ws, at){
    const g = this.g;
    let seat = ['w', 'b'].find(c => g.seats[c] && g.seats[c].uid === at.uid) || null;
    if (!seat && g.status === 'waiting'){
      const want = at.uid === g.creator.uid ? g.creatorSeat : other(g.creatorSeat);
      if (!g.seats[want]) seat = want;
      else if (!g.seats[other(want)] && at.uid !== g.creator.uid) seat = other(want);
      if (seat) g.seats[seat] = { uid:at.uid, name:at.name };
    }
    at.seat = seat; ws.serializeAttachment(at);
    if (seat && g.away[seat]) g.away[seat] = 0;
    // começa quando os dois lugares estão ocupados e os dois jogadores conectados (na fila os lugares já vêm marcados)
    if (g.status === 'waiting' && g.seats.w && g.seats.b && this.online('w') && this.online('b')) this.start();
    this.send(ws, { t:'welcome', you:{ uid:at.uid, name:at.name, seat }, room:this.info() });
    await this.schedule(); await this.save();
    this.broadcast();
  }
  start(){
    const g = this.g;
    if (g.mode === 'arcano'){
      const used = Object.values(g.decks || {}).filter(Boolean);
      const free = DECKS.filter(d => !used.includes(d));
      const decks = { ...g.decks };
      for (const c of ['w', 'b']) if (!decks[c]) decks[c] = free.length ? free[g.seed % free.length] : DECKS[(g.seed >> 3) % DECKS.length];
      g.decks = decks;
      g.s = ARC.create({ seed:g.seed, decks, oracle:'previsto' });
    } else g.s = ARC.create({ seed:g.seed, pure:true });
    g.status = 'playing'; g.started = false; g.firstMoveBy = Date.now() + this.firstMoveMs; g.turnStart = Date.now();
  }
  async act(ws, at, a){
    const g = this.g;
    if (g.status !== 'playing') return this.send(ws, { t:'error', err:'A partida não está em andamento.' });
    const side = ARC.actor(g.s);
    if (at.seat !== side) return this.send(ws, { t:'error', err:'Não é a sua vez.' });
    if (!a || typeof a !== 'object' || !['move', 'card', 'end'].includes(a.type)) return this.send(ws, { t:'error', err:'Ação inválida.' });
    const act = a.type === 'move' ? { type:'move', from:String(a.from), to:String(a.to), promotion:a.promotion ? String(a.promotion) : undefined }
      : a.type === 'card' ? { type:'card', uid:String(a.uid), picks:Array.isArray(a.picks) ? a.picks.slice(0, 6).map(String) : [] } : { type:'end' };
    const now = Date.now(), spent = g.started && g.base ? now - g.turnStart : 0;
    if (spent && g.clocks[side] - spent <= 0){ g.clocks[side] = 0; g.turnStart = now; return this.finish(other(side), 'tempo'); }
    const r = ARC.apply(g.s, act);
    // ação recusada não mexe no relógio (o tempo continua correndo a partir do mesmo início)
    if (!r.ok) return this.send(ws, { t:'error', err:r.err || 'Ação recusada.' });
    g.clocks[side] -= spent;
    const turnBefore = g.s.turn;
    g.s = r.state; g.n++;
    (g.log = g.log || []).push(act.type === 'move' ? (act.promotion ? { type:'move', from:act.from, to:act.to, promotion:act.promotion } : { type:'move', from:act.from, to:act.to }) : act);
    if (act.type === 'move') g.started = true;
    if (g.s.turn !== turnBefore && g.base && g.started) g.clocks[side] += g.inc;
    g.turnStart = now;
    if (g.drawOffer && g.drawOffer !== side) g.drawOffer = null;
    // o lance completo (bandeiras, captura, resultado) para o cliente animar exatamente o que o servidor aplicou
    const last = r.move ? { from:r.move.from, to:r.move.to, san:r.move.san, side, move:r.move } : { type:act.type, side };
    if (g.s.over){
      const o = g.s.over;
      return this.finish(o.kind === 'mate' ? o.winner : null, REASON[o.kind] || o.kind, r.events, last);
    }
    await this.schedule(); await this.save();
    this.broadcast(r.events, last);
  }
  async resign(seat){
    const g = this.g;
    if (g.status !== 'playing') return;
    if (!g.started) return this.abort('cancelada');
    return this.finish(other(seat), 'desistencia');
  }
  async draw(ws, seat, op){
    const g = this.g;
    if (g.status !== 'playing' || !g.started) return this.send(ws, { t:'error', err:'Sem partida para empatar.' });
    if (op === 'offer'){ if (!g.drawOffer) g.drawOffer = seat; }
    else if (op === 'accept'){ if (g.drawOffer && g.drawOffer !== seat) return this.finish(null, 'acordo'); }
    else if (op === 'decline'){ if (g.drawOffer && g.drawOffer !== seat) g.drawOffer = null; }
    await this.save(); this.broadcast();
  }
  async left(ws){
    const g = this.g;
    if (!g) return;
    const at = ws.deserializeAttachment() || {};
    if (!at.seat || g.status !== 'playing') return;
    this.closing = ws;
    try {
      if (this.online(at.seat)) return;
      g.away[at.seat] = Date.now() + this.reconnectMs;
      await this.schedule(); await this.save();
      this.broadcast();
    } finally { this.closing = null; }
  }
  async abort(why){
    const g = this.g;
    g.status = 'aborted'; g.result = { winner:null, reason:why, score:'abortada' };
    await this.ctx.storage.deleteAlarm(); await this.save(); await this.record();
    this.broadcast();
  }
  async finish(winner, reason, events = [], last = null){
    const g = this.g;
    if (g.status === 'over') return;
    // tempo esgotado contra quem só tem o Rei (ou material insuficiente) vira empate, como no xadrez
    if (reason === 'tempo' && winner && g.mode === 'xadrez' && !this.canMate(winner)){ winner = null; reason = 'tempo sem material'; }
    g.status = 'over'; g.result = { winner, reason, score:RESULT(winner) };
    if (g.s && !g.s.over) g.s.over = { kind:'servidor', winner, reason };
    await this.ctx.storage.deleteAlarm();
    // a nota vem antes do registro, para o histórico guardar a variação de cada lado
    if (g.ranked && this.env.DB && g.seats.w && g.seats.b){
      try { g.result.rating = await rateGame(this.env.DB, g.mode, g.seats.w.uid, g.seats.b.uid, winner === 'w' ? 1 : winner === 'b' ? 0 : 0.5); }
      catch (e){ console.log('nota', e.message); }
    }
    await this.save(); await this.record();
    this.broadcast(events, last);
  }
  canMate(side){
    const ps = [];
    for (const row of ARC.board8(this.g.s)) for (const p of row) if (p && p.color === side && p.type !== 'k') ps.push(p.type);
    return ps.some(t => t === 'p' || t === 'r' || t === 'q') || ps.length >= 2;
  }
  // relógio, primeiro lance e reconexão num alarme só (o mais próximo)
  async schedule(){
    const g = this.g, at = [];
    if (g.status === 'playing'){
      if (!g.started) at.push(g.firstMoveBy);
      else if (g.base) at.push(g.turnStart + Math.max(0, g.clocks[ARC.actor(g.s)]));
      for (const c of ['w', 'b']) if (g.away[c]) at.push(g.away[c]);
    }
    // sala da fila: os dois têm 30 s para aparecer
    if (g.status === 'waiting' && g.showBy) at.push(g.showBy);
    if (at.length) await this.ctx.storage.setAlarm(Math.min(...at));
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm(){
    const g = this.g;
    if (!g) return;
    const now = Date.now();
    if (g.status === 'waiting' && g.showBy && now >= g.showBy) return this.abort('rival não apareceu');
    if (g.status !== 'playing') return;
    if (!g.started && now >= g.firstMoveBy) return this.abort('sem primeiro lance');
    if (g.started && g.base){
      const side = ARC.actor(g.s);
      if (now >= g.turnStart + g.clocks[side]){ g.clocks[side] = 0; g.turnStart = now; return this.finish(other(side), 'tempo'); }
    }
    const gone = ['w', 'b'].filter(c => g.away[c] && now >= g.away[c]).sort((a, b) => g.away[a] - g.away[b]);
    if (gone.length) return this.finish(gone.length === 2 ? null : other(gone[0]), 'abandono');
    await this.schedule();
  }
  async record(){
    const g = this.g, db = this.env.DB;
    if (!db) return;
    try {
      const rt = g.result.rating, W = g.seats.w, B = g.seats.b;
      await db.prepare('INSERT OR REPLACE INTO games (id, mode, tc, ranked, white, black, result, reason, plies, started, ended, moves, seed, deck_w, deck_b, actions, rules, w_name, b_name, w_delta, b_delta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(g.id, g.mode, g.tc, g.ranked ? 1 : 0, W && W.uid, B && B.uid, g.result.score, g.result.reason,
          g.s ? g.s.hist.length : 0, g.created, Date.now(), g.s ? g.s.hist.map(h => h.san).join(' ') : '',
          g.s ? g.seed : null, g.decks ? g.decks.w : null, g.decks ? g.decks.b : null, g.s ? JSON.stringify(g.log || []) : null, RULES,
          W ? W.name : null, B ? B.name : null, rt ? rt.w.delta : null, rt ? rt.b.delta : null).run();
    } catch (e){ console.log('record', e.message); }
  }
}
