/* ---------- Motor do Modo Arcano ----------
   Módulo puro (sem DOM nem THREE): todo o estado é JSON e o sorteio usa um RNG com semente guardado no próprio estado,
   então o mesmo código roda no navegador e num servidor (validação de lances e cartas). Uso:
     const ARC = arcanoRules(catalogo);                   // catálogo = data/cartas.json (lista "cartas")
     let s = ARC.create(seed, { w:'tempestade', b:'cinzas' });
     ARC.legalActions(s, side) · ARC.apply(s, { type:'move'|'card'|'end', ... }) · ARC.viewFor(s, side)
     (e também legalMoves, applyMove, cardOptions, playCard, endTurn, status, fen, predict)
   Cada ação devolve { ok, state, events, err } e nunca altera o estado recebido.
   Turno: início (+1 essência) → lance → espólio se capturou (+2 essência e o artefato da peça) → fase de cartas
   (até 1 carta) → fim (compra 1 carta a cada 2 turnos; casas de runa dão 1 carta) → vez do rival.
   Efeitos nas peças ficam em piece.fx ([{ id, kind:'relic'|'aura'|'mark', turns }]); "turns" conta os fins de turno do
   dono da peça. Efeitos do tabuleiro (muralhas, lava, portais, rastros, âncoras) contam todos os fins de turno (ttl). */
const arcanoRules = (catalog = []) => {
  const FILES = 'abcdefgh';
  const toS = i => FILES[i & 7] + (8 - (i >> 4));
  const fromS = q => (8 - +q[1]) * 16 + (q.charCodeAt(0) - 97);
  const isSq = q => typeof q === 'string' && /^[a-h][1-8]$/.test(q);
  const onB = i => i >= 0 && i < 128 && !(i & 0x88);
  const DN = [-33, -31, -18, -14, 14, 18, 31, 33], DB = [-17, -15, 15, 17], DR = [-16, -1, 1, 16], DK = DB.concat(DR);
  const VAL = { p:1, n:3, b:3, r:5, q:9, k:0 };
  const NAME = { p:'Peão', n:'Cavalo', b:'Bispo', r:'Torre', q:'Dama', k:'Rei' };
  const CARD = {};
  for (const c of catalog) CARD[c.id] = c;
  const LOOT = { p:'lanca-fiel', n:'ferradura-salto', b:'grimorio-arcano', r:'pedra-terra', q:'coroa-raio' };
  const RUNES = ['d4', 'e4', 'd5', 'e5'];
  const ESS_MAX = 10, HAND_START = 3, HAND_MAX = 5, MAX_TRAPS = 2, MAX_SUMMONS = 2, MAX_SACR = 2;
  const DECKS = {
    tempestade:{ nome:'Tempestade', cartas:['passo-relampago', 'passo-relampago', 'aura-cavaleiro', 'coroa-emprestada', 'pegaso', 'andarilho-arcano', 'ponto-ancoragem', 'empuxo-gravitacional', 'empuxo-gravitacional', 'escudo-arcano',
      'armadilha-espinhos', 'armadilha-espinhos', 'visao-oraculo', 'olho-bispo', 'nevoa-fria', 'portal-runa', 'heranca-cavaleiro', 'centuriao', 'dominio-diagonal', 'canhao-cerco'] },
    cinzas:{ nome:'Cinzas', cartas:['rito-sacrificio', 'rito-sacrificio', 'necromante-cinzas', 'ressurreicao-cinzas', 'recruta-cemiterio', 'recruta-cemiterio', 'dragao-cinzas', 'fenix', 'berserker', 'berserker',
      'vinganca-isca', 'vinganca-isca', 'fosso-lava', 'fosso-lava', 'duplo-corpo', 'troca-sombra', 'contrafeitico', 'veu-sombras', 'golem-pedra', 'repercussao-impacto'] },
    arcano:{ nome:'Arcano', cartas:['visao-oraculo', 'visao-oraculo', 'profecia-selada', 'contrafeitico', 'contrafeitico', 'olho-bispo', 'olho-bispo', 'bispo-oraculo', 'espelho-posicao', 'espelho-posicao',
      'alcance-torre', 'escudo-arcano', 'troca-sombra', 'portal-runa', 'nevoa-fria', 'passo-relampago', 'veu-sombras', 'empuxo-gravitacional', 'coroa-emprestada', 'andarilho-arcano'] },
  };
  const RARE = catalog.filter(c => c.tipo !== 'artefato' && c.custo >= 5).map(c => c.id);
  const other = c => c === 'w' ? 'b' : 'w';
  const clone = s => JSON.parse(JSON.stringify(s));
  // RNG mulberry32: o estado fica em s.rng (inteiro de 32 bits), então a partida é reproduzível pela semente
  function rnd(s){
    let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(s, a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---- tabuleiro ---- */
  function loadFen(s, fen){
    const f = fen.trim().split(/\s+/);
    s.board = new Array(128).fill(null);
    let r = 0, c = 0;
    for (const ch of f[0]){
      if (ch === '/'){ r++; c = 0; continue; }
      if (ch >= '1' && ch <= '8'){ c += +ch; continue; }
      const i = r * 16 + c;
      s.board[i] = { t:ch.toLowerCase(), c:ch === ch.toLowerCase() ? 'b' : 'w', id:s.nextId++, fx:[], home:i };
      c++;
    }
    s.turn = f[1] === 'b' ? 'b' : 'w';
    s.castle = f[2] && f[2] !== '-' ? f[2] : '';
    s.ep = f[3] && f[3] !== '-' ? fromS(f[3]) : -1;
    s.half = +(f[4] || 0); s.full = +(f[5] || 1);
  }
  function fen(s){
    let out = '';
    for (let r = 0; r < 8; r++){
      let e = 0;
      for (let c = 0; c < 8; c++){
        const p = s.board[r * 16 + c];
        if (!p){ e++; continue; }
        if (e){ out += e; e = 0; }
        out += p.c === 'w' ? p.t.toUpperCase() : p.t;
      }
      if (e) out += e;
      if (r < 7) out += '/';
    }
    return `${out} ${s.turn} ${s.castle || '-'} ${s.ep >= 0 ? toS(s.ep) : '-'} ${s.half} ${s.full}`;
  }
  const posKey = s => fen(s).split(' ').slice(0, 4).join(' ') + '|' + Object.keys((s.arc && s.arc.blocked) || {}).sort().join(',');
  const squares = () => { const out = []; for (let i = 0; i < 128; i++){ if (i & 0x88){ i += 7; continue; } out.push(i); } return out; };
  const ALL = squares();
  function kingSq(s, c){ for (const i of ALL){ const p = s.board[i]; if (p && p.t === 'k' && p.c === c) return i; } return -1; }
  const fxOf = (p, id) => p && p.fx ? p.fx.find(f => f.id === id) : null;
  const has = (p, id) => !!fxOf(p, id);
  // casas bloqueadas por muralhas e lava: ninguém entra nem atravessa
  const blocked = (s, i) => !!(s.arc && s.arc.blocked && s.arc.blocked[toS(i)]);
  // lances extras de relíquias, auras e transmutações: MOVE_MODS[id](s, i, p, add) — add(f, t, fl, pr, mod)
  const slideAdd = (s, i, p, dirs, add, mod, slide, jumps = 0) => {
    for (const d of dirs){
      let t = i + d, jumped = 0;
      while (onB(t) && !blocked(s, t)){
        const q = s.board[t];
        if (q){
          if (q.c !== p.c) add(i, t, 'c', null, mod);
          if (jumped < jumps){ jumped++; t += d; if (!slide) break; continue; }
          break;
        }
        add(i, t, 'n', null, mod);
        if (!slide) break;
        t += d;
      }
    }
  };
  const MOVE_MODS = {
    heranca:(s, i, p, add) => slideAdd(s, i, p, DN, add, 'heranca', false),
    salto_herdado:(s, i, p, add) => slideAdd(s, i, p, DN, add, 'salto_herdado', false),
    ferradura:(s, i, p, add) => slideAdd(s, i, p, DN, add, 'ferradura', false),
    coroa:(s, i, p, add) => slideAdd(s, i, p, DK, add, 'coroa', true),
    coroa_raio:(s, i, p, add) => slideAdd(s, i, p, DK, add, 'coroa_raio', true),
    coroa_herdada:(s, i, p, add) => slideAdd(s, i, p, DK, add, 'coroa_herdada', true),
    visao_arcana:(s, i, p, add) => slideAdd(s, i, p, DB, add, 'visao_arcana', true),
    muralha_viva:(s, i, p, add) => slideAdd(s, i, p, DR, add, 'muralha_viva', true),
    dragao:(s, i, p, add) => slideAdd(s, i, p, DK, add, 'dragao', true, 1),
    // Aura do Cavaleiro: as linhas da própria peça atravessam uma peça no caminho
    salto:(s, i, p, add) => { const dirs = p.t === 'b' ? DB : p.t === 'r' ? DR : p.t === 'q' ? DK : null; if (dirs) slideAdd(s, i, p, dirs, add, 'salto', true, 1); },
    // Pégaso: o L se estende (até 6 casas no total)
    pegaso:(s, i, p, add) => { for (let L = 3; L <= 5; L++) for (const [a, b] of [[L, 1], [1, L]]) for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]){ const t = i + sa * a * 16 + sb * b; if (onB(t) && !blocked(s, t)){ const q = s.board[t]; if (!q) add(i, t, 'n', null, 'pegaso'); else if (q.c !== p.c) add(i, t, 'c', null, 'pegaso'); } } },
    // Canhão de Cerco: captura por cima de exatamente uma peça na linha ou coluna
    canhao:(s, i, p, add) => { for (const d of DR){ let t = i + d, screen = false; while (onB(t) && !blocked(s, t)){ const q = s.board[t]; if (q){ if (!screen) screen = true; else { if (q.c !== p.c) add(i, t, 'c', null, 'canhao'); break; } } t += d; } } },
    // Andarilho Arcano: até 2 casas em linha reta, sem capturar
    andarilho:(s, i, p, add) => { for (const d of DR){ let t = i; for (let k = 0; k < 2; k++){ t += d; if (!onB(t) || blocked(s, t) || s.board[t]) break; add(i, t, 'n', null, 'andarilho'); } } },
    // Alcance da Torre: captura nas 4 casas em cruz
    alcance:(s, i, p, add) => { for (const d of DR){ const t = i + d; if (onB(t) && !blocked(s, t) && s.board[t] && s.board[t].c !== p.c) add(i, t, 'c', null, 'alcance'); } },
    // Lança Fiel: o Peão captura uma vez em linha reta à frente
    lanca:(s, i, p, add) => { const t = i + (p.c === 'w' ? -16 : 16); if (onB(t) && !blocked(s, t) && s.board[t] && s.board[t].c !== p.c) add(i, t, 'c', null, 'lanca'); },
    // Domínio Diagonal: captura a 2 casas na diagonal, pulando uma casa vazia
    dominio:(s, i, p, add) => { const fw = p.c === 'w' ? -16 : 16; for (const dc of [-1, 1]){ const m = i + fw + dc, t = i + 2 * (fw + dc); if (onB(t) && !s.board[m] && !blocked(s, t) && s.board[t] && s.board[t].c !== p.c) add(i, t, 'c', null, 'dominio'); } },
    // Centurião: anda 1 casa para os lados e captura também de frente
    centuriao:(s, i, p, add) => {
      for (const d of [-1, 1]){ const t = i + d; if (onB(t) && !blocked(s, t) && !s.board[t]) add(i, t, 'n', null, 'centuriao'); }
      const t = i + (p.c === 'w' ? -16 : 16); if (onB(t) && !blocked(s, t) && s.board[t] && s.board[t].c !== p.c) add(i, t, 'c', null, 'centuriao');
    },
  };
  const CAP_MODS = ['heranca', 'salto_herdado', 'ferradura', 'coroa', 'coroa_raio', 'coroa_herdada', 'visao_arcana', 'muralha_viva', 'dragao', 'salto', 'pegaso', 'canhao', 'alcance', 'lanca', 'dominio', 'centuriao'];
  function attacked(s, i, by){
    const B = s.board, pd = by === 'w' ? 16 : -16;
    for (const dc of [-1, 1]){ const a = i + pd + dc; if (onB(a) && B[a] && B[a].c === by && B[a].t === 'p') return true; }
    for (const d of DN){ const a = i + d; if (onB(a) && B[a] && B[a].c === by && B[a].t === 'n') return true; }
    for (const d of DK){ const a = i + d; if (onB(a) && B[a] && B[a].c === by && B[a].t === 'k') return true; }
    for (const d of DB){ let a = i + d; while (onB(a) && !blocked(s, a)){ const p = B[a]; if (p){ if (p.c === by && (p.t === 'b' || p.t === 'q')) return true; break; } a += d; } }
    for (const d of DR){ let a = i + d; while (onB(a) && !blocked(s, a)){ const p = B[a]; if (p){ if (p.c === by && (p.t === 'r' || p.t === 'q')) return true; break; } a += d; } }
    // capturas que vêm das cartas (só conta casas ocupadas por peça do outro lado, como a do Rei)
    if (B[i] && B[i].c !== by){
      let hit = false;
      for (const a of ALL){
        const p = B[a];
        if (!p || p.c !== by || !p.fx || !p.fx.length || has(p, 'paralisado')) continue;
        for (const fx of p.fx) if (CAP_MODS.includes(fx.id) && MOVE_MODS[fx.id]){ MOVE_MODS[fx.id](s, a, p, (f, t, fl) => { if (t === i && fl === 'c') hit = true; }); if (hit) return true; }
      }
    }
    return false;
  }
  const inCheck = (s, c) => { const k = kingSq(s, c); return k >= 0 && attacked(s, k, other(c)); };
  function pseudo(s, c){
    const out = [], B = s.board, op = other(c);
    const add = (f, t, fl, pr, mod) => out.push(mod ? { f, t, fl, pr, mod } : { f, t, fl, pr });
    for (const i of ALL){
      const p = B[i];
      if (!p || p.c !== c || has(p, 'paralisado')) continue;
      const start = out.length;
      if (p.t === 'p'){
        const dir = c === 'w' ? -16 : 16, home = c === 'w' ? 6 : 1, last = c === 'w' ? 0 : 7;
        const one = i + dir;
        if (onB(one) && !B[one] && !blocked(s, one)){
          if ((one >> 4) === last) for (const pr of 'qrbn') add(i, one, 'np', pr);
          else {
            add(i, one, 'n');
            const two = one + dir;
            if ((i >> 4) === home && onB(two) && !B[two] && !blocked(s, two)) add(i, two, 'b');
          }
        }
        for (const dc of [-1, 1]){
          const t = one + dc;
          if (!onB(t) || blocked(s, t)) continue;
          if (B[t] && B[t].c === op){
            if ((t >> 4) === last) for (const pr of 'qrbn') add(i, t, 'cp', pr);
            else add(i, t, 'c');
          } else if (t === s.ep && !B[t]) add(i, t, 'e');
        }
      } else {
        const dirs = p.t === 'n' ? DN : p.t === 'b' ? DB : p.t === 'r' ? DR : DK, slide = p.t === 'b' || p.t === 'r' || p.t === 'q';
        for (const d of dirs){
          let t = i + d;
          while (onB(t) && !blocked(s, t)){
            const q = B[t];
            if (q){ if (q.c === op) add(i, t, 'c'); break; }
            add(i, t, 'n');
            if (!slide) break;
            t += d;
          }
        }
        if (p.t === 'k'){
          const home = c === 'w' ? 116 : 4, K = c === 'w' ? 'K' : 'k', Q = c === 'w' ? 'Q' : 'q';
          if (i === home && !attacked(s, i, op)){
            const rk = B[home + 3], rq = B[home - 4];
            if (s.castle.includes(K) && rk && rk.t === 'r' && rk.c === c && !B[home + 1] && !B[home + 2] && !blocked(s, home + 1) && !blocked(s, home + 2) && !attacked(s, home + 1, op) && !attacked(s, home + 2, op)) add(i, home + 2, 'k');
            if (s.castle.includes(Q) && rq && rq.t === 'r' && rq.c === c && !B[home - 1] && !B[home - 2] && !B[home - 3] && !blocked(s, home - 1) && !blocked(s, home - 2) && !attacked(s, home - 1, op) && !attacked(s, home - 2, op)) add(i, home - 2, 'q');
          }
        }
      }
      for (const fx of p.fx || []) if (MOVE_MODS[fx.id]) MOVE_MODS[fx.id](s, i, p, add, fx);
      // Peão com lance extra que chega à última fileira é promovido
      for (let k = start; k < out.length; k++){ const m = out[k]; if (m.mod && p.t === 'p' && ((m.t >> 4) === (c === 'w' ? 0 : 7))){ m.pr = 'q'; m.fl = m.fl === 'c' ? 'cp' : 'np'; } }
      // Névoa Fria: no máximo 1 casa
      if (has(p, 'nevoa')) for (let k = out.length - 1; k >= start; k--){ const m = out[k]; if (Math.max(Math.abs((m.t >> 4) - (m.f >> 4)), Math.abs((m.t & 7) - (m.f & 7))) > 1 || m.fl === 'k' || m.fl === 'q') out.splice(k, 1); }
    }
    // Portal de Runa: uma peça sua que entra numa boca pode sair pela outra
    const portal = s.arc && s.arc.portals ? s.arc.portals.find(q => q.side === c) : null;
    if (portal){
      const [A, Bq] = portal.sqs.map(fromS), extra = [];
      for (const m of out){
        if (m.fl !== 'n' && m.fl !== 'b') continue;
        if (m.t === A && !B[Bq] && !blocked(s, Bq)) extra.push({ f:m.f, t:Bq, fl:'n', portal:true, via:A });
        else if (m.t === Bq && !B[A] && !blocked(s, A)) extra.push({ f:m.f, t:A, fl:'n', portal:true, via:Bq });
      }
      for (const m of extra) if (!out.some(o => o.f === m.f && o.t === m.t)) out.push(m);
    }
    // sem lances repetidos (mods podem coincidir com o normal) e o Rei nunca é capturado
    const seen = new Set();
    return out.filter(m => { const k = m.f + ':' + m.t + ':' + (m.pr || ''); if (seen.has(k)) return false; seen.add(k); return !(B[m.t] && B[m.t].t === 'k'); });
  }
  // aplica no tabuleiro (sem regras de turno) e devolve o desfazer
  function makeBoard(s, m){
    const B = s.board, p = B[m.f], u = { m, p, cap:B[m.t], capSq:m.t, castle:s.castle, ep:s.ep, half:s.half, rook:null };
    if (m.fl === 'e'){ u.capSq = m.t + (p.c === 'w' ? 16 : -16); u.cap = B[u.capSq]; B[u.capSq] = null; }
    B[m.t] = m.pr ? Object.assign({}, p, { t:m.pr, promo:true }) : p;
    B[m.f] = null;
    if (m.fl === 'k' || m.fl === 'q'){
      const rf = m.fl === 'k' ? m.f + 3 : m.f - 4, rt = m.fl === 'k' ? m.f + 1 : m.f - 1;
      u.rook = [rf, rt]; B[rt] = B[rf]; B[rf] = null;
    }
    const drop = q => { s.castle = s.castle.replace(q, ''); };
    if (p.t === 'k'){ drop(p.c === 'w' ? 'K' : 'k'); drop(p.c === 'w' ? 'Q' : 'q'); }
    for (const [sqi, q] of [[119, 'K'], [112, 'Q'], [7, 'k'], [0, 'q']]) if (m.f === sqi || m.t === sqi) drop(q);
    s.ep = m.fl === 'b' ? (m.f + m.t) / 2 : -1;
    return u;
  }
  function unmakeBoard(s, u){
    const B = s.board, m = u.m;
    if (u.rook){ B[u.rook[0]] = B[u.rook[1]]; B[u.rook[1]] = null; }
    B[m.f] = u.p; B[m.t] = null;
    if (u.cap) B[u.capSq] = u.cap;
    s.castle = u.castle; s.ep = u.ep; s.half = u.half;
  }
  // a captura de uma peça protegida (Escudo, Mártir, Golem, Troca de Sombra) não muda a posição: só vale se o Rei já está a salvo
  const guarded = (s, i) => {
    const p = s.board[i];
    if (!p) return false;
    if (has(p, 'escudo') || has(p, 'martir') || has(p, 'golem')) return true;
    const tr = trapOn(s, p, 'troca-sombra');
    return !!tr && !s.board[fromS(tr.escape)] && !blocked(s, fromS(tr.escape));
  };
  function legalRaw(s, c){
    const out = [];
    const safeNow = !inCheck(s, c);
    for (const m of pseudo(s, c)){
      if ((m.fl === 'c' || m.fl === 'cp') && guarded(s, m.t)){ if (safeNow) out.push(m); continue; }
      const u = makeBoard(s, m);
      if (!inCheck(s, c)) out.push(m);
      unmakeBoard(s, u);
    }
    return out;
  }
  function sanOf(s, m, all){
    const p = s.board[m.f];
    let san;
    if (m.fl === 'k') san = 'O-O';
    else if (m.fl === 'q') san = 'O-O-O';
    else {
      const cap = m.fl.includes('c') || m.fl === 'e';
      if (p.t === 'p' && !m.mod) san = (cap ? FILES[m.f & 7] + 'x' : '') + toS(m.t) + (m.pr ? '=' + m.pr.toUpperCase() : '');
      else {
        const amb = all.filter(o => o !== m && o.t === m.t && o.f !== m.f && s.board[o.f].t === p.t);
        let dis = p.t === 'p' ? FILES[m.f & 7] : '';
        if (amb.length && p.t !== 'p'){
          const sf = amb.some(o => (o.f & 7) === (m.f & 7)), sr = amb.some(o => (o.f >> 4) === (m.f >> 4));
          dis = !sf ? FILES[m.f & 7] : !sr ? String(8 - (m.f >> 4)) : toS(m.f);
        }
        san = (p.t === 'p' ? '' : p.t.toUpperCase()) + dis + (cap ? 'x' : (p.t === 'p' ? '-' : '')) + toS(m.t) + (m.pr ? '=' + m.pr.toUpperCase() : '');
      }
    }
    if (!(guarded(s, m.t) && m.fl.includes('c'))){
      const u = makeBoard(s, m), op = other(p.c);
      if (inCheck(s, op)) san += legalRaw(s, op).length ? '+' : '#';
      unmakeBoard(s, u);
    }
    return san;
  }
  const verbose = (s, m, all) => {
    const p = s.board[m.f], cap = m.fl === 'e' ? 'p' : s.board[m.t] ? s.board[m.t].t : undefined;
    const o = { color:p.c, from:toS(m.f), to:toS(m.t), piece:p.t, flags:m.fl, san:sanOf(s, m, all) };
    if (cap) o.captured = cap;
    if (m.pr) o.promotion = m.pr;
    if (m.mod) o.mod = m.mod;
    if (m.portal) o.portal = toS(m.via);
    return o;
  };
  function insufficient(s){
    const minors = [];
    for (const i of ALL){
      const p = s.board[i];
      if (!p || p.t === 'k') continue;
      if (p.t === 'p' || p.t === 'r' || p.t === 'q') return false;
      minors.push({ t:p.t, col:((i >> 4) + (i & 7)) % 2 });
    }
    if (minors.length <= 1) return true;
    return minors.every(m => m.t === 'b') && minors.every(m => m.col === minors[0].col);
  }
  function status(s){
    const c = s.turn, moves = legalRaw(s, c).length, check = inCheck(s, c);
    const rep = (s.keys[posKey(s)] || 0) >= 3, fifty = s.half >= 100, ins = insufficient(s);
    let over = null;
    if (!moves) over = check ? { kind:'mate', winner:other(c) } : { kind:'stalemate' };
    else if (rep) over = { kind:'rep' };
    else if (ins) over = { kind:'material' };
    else if (fifty) over = { kind:'fifty' };
    return { turn:c, check, moves, mate:!moves && check, stalemate:!moves && !check, rep, fifty, insufficient:ins, over, phase:s.arc.phase };
  }

  /* ---- cartas: mão, compras, efeitos ---- */
  function newCard(s, id){ return { uid:'c' + (++s.arc.uid), id }; }
  function draw(s, c, n, why, ev){
    for (let i = 0; i < n; i++){
      const card = s.arc.deck[c].pop();
      if (!card){ ev.push({ k:'deckEmpty', side:c }); return; }
      giveCard(s, c, card, why, ev);
    }
  }
  function giveCard(s, c, card, why, ev){
    if (s.arc.hand[c].length >= HAND_MAX){ s.arc.discard[c].push(card); ev.push({ k:'burn', side:c, card, why }); return; }
    s.arc.hand[c].push(card);
    ev.push({ k:'draw', side:c, card, why });
  }
  const gainEss = (s, c, n, why, ev) => { const a = s.arc.ess[c], b = Math.min(ESS_MAX, a + n); s.arc.ess[c] = b; if (b !== a) ev.push({ k:'essence', side:c, delta:b - a, total:b, why }); };
  // efeito numa peça: N turnos do dono; se o efeito nasce na vez do dono, o fim desta vez não conta
  function addFx(s, p, fx, n){
    const actorNow = s.arc.phase === 'cards' ? s.arc.cardSide : s.turn;
    const f = Object.assign({}, fx);
    if (n != null) f.turns = n + (p.c === actorNow ? 1 : 0);
    // 1 relíquia (ou transmutação) por peça: a nova substitui; 1 aura de sacrifício por peça
    if (f.kind === 'relic' || f.kind === 'aura') p.fx = p.fx.filter(x => x.kind !== f.kind);
    else p.fx = p.fx.filter(x => x.id !== f.id);
    p.fx.push(f);
    return f;
  }
  const removeFx = (p, id) => { if (p) p.fx = p.fx.filter(x => x.id !== id); };
  function trapOn(s, p, id){ return s.arc.traps.find(t => t.pid === p.id && (!id || t.id === id)) || null; }
  // a peça sai do tabuleiro (captura ou sacrifício); o cemitério guarda o tipo para as invocações
  function bury(s, i, why, ev, by){
    const p = s.board[i];
    if (!p || p.t === 'k') return null;
    s.board[i] = null;
    s.arc.traps = s.arc.traps.filter(t => t.pid !== p.id);
    s.arc.grave[p.c].push(p.promo ? 'p' : p.t);
    ev.push({ k:'remove', sq:toS(i), side:p.c, t:p.t, id:p.id, why, by });
    return p;
  }
  function loot(s, c, t, ev){
    gainEss(s, c, 2, 'espolio', ev);
    if (LOOT[t] && CARD[LOOT[t]]) giveCard(s, c, newCard(s, LOOT[t]), 'espolio', ev);
    ev.push({ k:'loot', side:c, piece:t });
  }
  // carta que tira uma peça da casa: a Torre que sai de casa perde o roque daquele lado
  function dropCastleAt(s, i){ for (const [sqi, q] of [[119, 'K'], [112, 'Q'], [7, 'k'], [0, 'q']]) if (i === sqi) s.castle = s.castle.replace(q, ''); if (s.ep === i) s.ep = -1; }
  function relocate(s, f, t){
    s.board[t] = s.board[f]; s.board[f] = null;
    dropCastleAt(s, f); dropCastleAt(s, t);
  }
  // testa com casas bloqueadas provisórias (muralha, lava) e sempre desfaz
  function withBlocked(s, sqs, c){ const keep = {}; for (const q of sqs){ keep[q] = s.arc.blocked[q]; s.arc.blocked[q] = { kind:'teste', ttl:1 }; } const ok = !inCheck(s, c); for (const q of sqs){ if (keep[q] === undefined) delete s.arc.blocked[q]; else s.arc.blocked[q] = keep[q]; } return ok; }
  // simula uma mudança no tabuleiro e devolve se o Rei de c fica a salvo
  function kingSafeAfter(s, c, fn){ const b = s.board.slice(), ep = s.ep, cs = s.castle; fn(); const ok = !inCheck(s, c); s.board = b; s.ep = ep; s.castle = cs; return ok; }
  const ownPieces = (s, c, ok = () => true) => ALL.filter(i => { const p = s.board[i]; return p && p.c === c && p.t !== 'k' && ok(p, i); }).map(toS);
  // peças do rival que uma carta pode tocar (o Rei e a Muralha Viva são imunes)
  const foePieces = (s, c, ok = () => true) => ALL.filter(i => { const p = s.board[i]; return p && p.c !== c && p.t !== 'k' && !has(p, 'muralha_viva') && ok(p, i); }).map(toS);
  const emptySqs = (s, ok = () => true) => ALL.filter(i => !s.board[i] && !blocked(s, i) && ok(i)).map(toS);
  const lastRank = (c, i) => (i >> 4) === (c === 'w' ? 0 : 7) || (i >> 4) === (c === 'w' ? 7 : 0);
  const step = (prompt, options, labels) => options.length ? (labels ? { prompt, options, labels } : { prompt, options }) : { err:'Não há alvo válido para esta carta agora.' };
  // casas a até 2 passos em linha reta, livres, sem deixar o Rei do lado c em xeque
  function stepDest(s, c, f, n = 2){
    const out = [];
    for (const d of DK){
      let t = f;
      for (let k = 0; k < n; k++){
        t += d;
        if (!onB(t) || s.board[t] || blocked(s, t)) break;
        const p = s.board[f];
        if (p.t === 'p' && lastRank(p.c, t)) continue;
        const tt = t;
        if (kingSafeAfter(s, c, () => { s.board[tt] = p; s.board[f] = null; })) out.push(t);
      }
    }
    return out;
  }
  const AURA = { p:['martir', 3], n:['salto_herdado', 3], b:['visao_arcana', 2], r:['muralha_viva', 3], q:['coroa_herdada', 3] };
  // previsão dos lances do rival (Oráculo, Bispo Oráculo): captura valiosa, xeque, promoção, centro
  function predict(s, side, n = 3, salt = 0){
    const t = s.turn; s.turn = side;
    const ms = legalRaw(s, side);
    const sc = ms.map(m => {
      const cap = s.board[m.t], u = makeBoard(s, m), chk = inCheck(s, other(side)); unmakeBoard(s, u);
      const r = m.t >> 4, f = m.t & 7, center = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(f - 3.5));
      const hang = attacked(s, m.t, other(side)) ? VAL[s.board[m.f].t] * 0.6 : 0;
      return { m, v:(cap ? VAL[cap.t] * 10 : 0) + (chk ? 6 : 0) + (m.pr ? 8 : 0) + center * 0.4 - hang + ((m.f * 31 + m.t * 17 + salt) % 7) * 0.01 };
    }).sort((a, b) => b.v - a.v);
    s.turn = t;
    return sc.slice(0, n).map(x => ({ from:toS(x.m.f), to:toS(x.m.t) }));
  }
  const FX = {
    'grimorio-arcano':{ targets:() => ({ ready:true }), apply(s, c, picks, ev){ draw(s, c, 2, 'grimorio', ev); } },
    'passo-relampago':{
      targets(s, c, picks){
        if (!picks.length) return step('Escolha uma peça sua (não o Rei).', ownPieces(s, c, (p, i) => stepDest(s, c, i).length));
        if (picks.length === 1) return step('Escolha a casa de destino (até 2 casas, sem capturar).', stepDest(s, c, fromS(picks[0])).map(toS));
        return { ready:true };
      },
      apply(s, c, picks, ev){ relocate(s, fromS(picks[0]), fromS(picks[1])); ev.push({ k:'cardMove', from:picks[0], to:picks[1], style:'raio' }); },
    },
    'olho-bispo':{
      targets:() => ({ ready:true }),
      apply(s, c, picks, ev){ const tr = s.arc.traps.filter(t => t.side !== c); for (const t of tr) t.seen = true; ev.push({ k:'reveal', side:c, traps:tr.map(t => t.sq || (t.pid != null ? 'peça' : 'mão')) }); },
    },
    'espelho-posicao':{
      targets(s, c, picks){
        const okSwap = (a, b) => { const A = s.board[a], B = s.board[b]; if ((A.t === 'p' && lastRank(c, b)) || (B.t === 'p' && lastRank(c, a))) return false; return kingSafeAfter(s, c, () => { s.board[a] = B; s.board[b] = A; }); };
        if (!picks.length) return step('Escolha a primeira peça sua (não o Rei).', ownPieces(s, c, (p, i) => ownPieces(s, c).some(q => fromS(q) !== i && okSwap(i, fromS(q)))));
        if (picks.length === 1){ const a = fromS(picks[0]); return step('Escolha a peça que troca de lugar com ela.', ownPieces(s, c, (p, i) => i !== a && okSwap(a, i))); }
        return { ready:true };
      },
      apply(s, c, picks, ev){ const a = fromS(picks[0]), b = fromS(picks[1]), A = s.board[a]; s.board[a] = s.board[b]; s.board[b] = A; dropCastleAt(s, a); dropCastleAt(s, b); ev.push({ k:'swap', a:picks[0], b:picks[1] }); },
    },
    'dominio-diagonal':{
      targets:(s, c, picks) => picks.length ? { ready:true } : step('Escolha um Peão seu.', ownPieces(s, c, p => p.t === 'p')),
      apply(s, c, picks, ev){ addFx(s, s.board[fromS(picks[0])], { id:'dominio', kind:'mark' }, 2); ev.push({ k:'fx', sq:picks[0], id:'dominio' }); },
    },
    'aura-cavaleiro':{
      targets:(s, c, picks) => picks.length ? { ready:true } : step('Escolha uma Torre, Bispo ou Dama sua: por 1 turno ela salta sobre uma peça no caminho.', ownPieces(s, c, p => 'brq'.includes(p.t))),
      apply(s, c, picks, ev){ addFx(s, s.board[fromS(picks[0])], { id:'salto', kind:'mark' }, 1); ev.push({ k:'fx', sq:picks[0], id:'salto' }); },
    },
    'ponto-ancoragem':{
      targets:(s, c, picks) => picks.length ? { ready:true } : step('Escolha a peça que fica ancorada nesta casa.', ownPieces(s, c)),
      apply(s, c, picks, ev){ const p = s.board[fromS(picks[0])]; s.arc.anchors.push({ pid:p.id, side:c, sq:picks[0], ttl:4 }); ev.push({ k:'anchor', sq:picks[0] }); },
    },
    'empuxo-gravitacional':{
      targets(s, c, picks){
        const dest = f => { const out = [], p = s.board[f]; for (const d of DK){ let t = f; for (let k = 0; k < 2; k++){ t += d; if (!onB(t) || s.board[t] || blocked(s, t)) break; if (p.t === 'p' && lastRank(p.c, t)) continue; const tt = t; if (kingSafeAfter(s, c, () => { s.board[tt] = p; s.board[f] = null; })) out.push(toS(t)); } } return out; };
        if (!picks.length) return step('Escolha uma peça inimiga (não o Rei).', foePieces(s, c, (p, i) => dest(i).length));
        if (picks.length === 1) return step('Escolha para onde empurrar (1 ou 2 casas em linha reta).', dest(fromS(picks[0])));
        return { ready:true };
      },
      apply(s, c, picks, ev){ relocate(s, fromS(picks[0]), fromS(picks[1])); ev.push({ k:'cardMove', from:picks[0], to:picks[1], style:'empuxo' }); },
    },
    'visao-oraculo':{
      targets:() => ({ ready:true }),
      apply(s, c, picks, ev){
        const o = other(c), veiled = s.arc.sideFx.some(f => f.id === 'veu' && f.side === o);
        let moves = predict(s, o, 3);
        if (veiled){ const all = legalRaw(Object.assign(clone(s), { turn:o }), o); moves = shuffle(s, all.slice()).slice(0, 3).map(m => ({ from:toS(m.f), to:toS(m.t) })); }
        s.arc.oracle = { by:c, side:o, moves, guaranteed:s.arc.opts.oracle === 'garantido' && !veiled, veiled };
        ev.push({ k:'oracle', side:c, moves });
      },
    },
    'veu-sombras':{ targets:() => ({ ready:true }), apply(s, c, picks, ev){ s.arc.sideFx.push({ id:'veu', side:c, ttl:4 }); ev.push({ k:'veil', side:c }); } },
    'rito-sacrificio':{
      targets(s, c, picks){
        if (s.arc.lim.sacr[c] >= MAX_SACR) return { err:'No máximo 2 sacrifícios por partida.' };
        if (!picks.length) return step('Escolha a peça a sacrificar (não o Rei).', ownPieces(s, c, (p, i) => ownPieces(s, c).length > 1 && kingSafeAfter(s, c, () => { s.board[i] = null; })));
        if (picks.length === 1){ const a = fromS(picks[0]); return step(`Escolha quem recebe a aura (${({ p:'Escudo do Mártir', n:'Salto Herdado', b:'Visão Arcana', r:'Muralha Viva', q:'Coroa Herdada' })[s.board[a].t]}).`, ownPieces(s, c, (p, i) => i !== a)); }
        return { ready:true };
      },
      apply(s, c, picks, ev){
        const a = fromS(picks[0]), b = fromS(picks[1]), t = s.board[a].t, [aid, n] = AURA[s.board[a].promo ? 'p' : t] || AURA.p;
        s.arc.lim.sacr[c]++;
        bury(s, a, 'sacrificio', ev);
        addFx(s, s.board[b], { id:aid, kind:'aura' }, n);
        ev.push({ k:'sacrifice', from:picks[0], to:picks[1], t, aura:aid });
      },
    },
    // relíquias
    'heranca-cavaleiro':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Peão seu.', ownPieces(s, c, q => q.t === 'p')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'heranca', kind:'relic' }); ev.push({ k:'fx', sq:p[0], id:'heranca' }); } },
    'coroa-emprestada':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma peça sua (não o Rei).', ownPieces(s, c, q => q.t !== 'q')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'coroa', kind:'relic' }, 2); ev.push({ k:'fx', sq:p[0], id:'coroa' }); } },
    'escudo-arcano':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma peça sua (não o Rei).', ownPieces(s, c)), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'escudo', kind:'relic' }); ev.push({ k:'fx', sq:p[0], id:'escudo' }); } },
    'alcance-torre':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma Torre ou um Peão seu.', ownPieces(s, c, q => q.t === 'r' || q.t === 'p')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'alcance', kind:'relic' }); ev.push({ k:'fx', sq:p[0], id:'alcance' }); } },
    'vinganca-isca':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Peão ou Cavalo seu.', ownPieces(s, c, q => q.t === 'p' || q.t === 'n')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'vinganca', kind:'relic' }); ev.push({ k:'fx', sq:p[0], id:'vinganca' }); } },
    // transmutações (relíquias que transformam: ocupam o mesmo lugar da relíquia)
    'bispo-oraculo':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Bispo seu.', ownPieces(s, c, q => q.t === 'b')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'oraculo_b', kind:'relic', trans:true }, 3); ev.push({ k:'trans', sq:p[0], id:'oraculo_b' }); } },
    'pegaso':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Cavalo seu.', ownPieces(s, c, q => q.t === 'n')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'pegaso', kind:'relic', trans:true }, 2); ev.push({ k:'trans', sq:p[0], id:'pegaso' }); } },
    'dragao-cinzas':{
      targets:(s, c, p) => s.arc.lim.legend[c] >= 1 ? { err:'O Dragão das Cinzas é lendário: 1 por partida.' } : p.length ? { ready:true } : step('Escolha um Cavalo seu.', ownPieces(s, c, q => q.t === 'n')),
      apply(s, c, p, ev){ s.arc.lim.legend[c]++; addFx(s, s.board[fromS(p[0])], { id:'dragao', kind:'relic', trans:true }, 1); ev.push({ k:'trans', sq:p[0], id:'dragao' }); },
    },
    'canhao-cerco':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma Torre sua.', ownPieces(s, c, q => q.t === 'r')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'canhao', kind:'relic', trans:true }, 3); ev.push({ k:'trans', sq:p[0], id:'canhao' }); } },
    'golem-pedra':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma Torre sua.', ownPieces(s, c, q => q.t === 'r')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'golem', kind:'relic', trans:true }, 3); ev.push({ k:'trans', sq:p[0], id:'golem' }); } },
    'andarilho-arcano':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Bispo seu.', ownPieces(s, c, q => q.t === 'b')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'andarilho', kind:'relic', trans:true }, 2); ev.push({ k:'trans', sq:p[0], id:'andarilho' }); } },
    'necromante-cinzas':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Bispo seu.', ownPieces(s, c, q => q.t === 'b')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'necro', kind:'relic', trans:true }, 3); ev.push({ k:'trans', sq:p[0], id:'necro' }); } },
    'centuriao':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Peão seu.', ownPieces(s, c, q => q.t === 'p')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'centuriao', kind:'relic', trans:true }, 3); ev.push({ k:'trans', sq:p[0], id:'centuriao' }); } },
    'fenix':{
      targets:(s, c, p) => s.arc.lim.phoenix[c] >= 1 ? { err:'A Fênix só renasce uma vez por partida.' } : p.length ? { ready:true } : step('Escolha a sua Dama.', ownPieces(s, c, q => q.t === 'q')),
      apply(s, c, p, ev){ s.arc.lim.phoenix[c]++; addFx(s, s.board[fromS(p[0])], { id:'fenix', kind:'relic', trans:true }); ev.push({ k:'trans', sq:p[0], id:'fenix' }); },
    },
    // Berserker: avança até 3 casas tomando tudo no caminho (menos o Rei) e é sacrificado no fim
    'berserker':{
      targets(s, c, p){
        if (p.length) return { ready:true };
        if (s.arc.lim.sacr[c] >= MAX_SACR) return { err:'No máximo 2 sacrifícios por partida.' };
        return step('Escolha um Peão seu para a investida.', ownPieces(s, c, (q, i) => kingSafeAfter(s, c, () => berserkRun(s, c, i, null))));
      },
      apply(s, c, p, ev){ s.arc.lim.sacr[c]++; berserkRun(s, c, fromS(p[0]), ev); },
    },
    // invocações
    'ressurreicao-cinzas':{
      targets(s, c, picks){
        if (s.arc.lim.summon[c] >= MAX_SUMMONS) return { err:'No máximo 2 invocações por partida.' };
        const types = [...new Set(s.arc.grave[c].filter(t => t !== 'q' && t !== 'k'))];
        if (!picks.length) return types.length ? step('Escolha quem volta do cemitério.', types, Object.fromEntries(types.map(t => [t, NAME[t]]))) : { err:'Não há peça sua no cemitério (a Dama não volta).' };
        const row = c === 'w' ? 7 : 0;
        if (picks.length === 1) return step('Escolha uma casa vazia da sua primeira fileira.', emptySqs(s, i => (i >> 4) === row && kingSafeAfter(s, c, () => { s.board[i] = { t:picks[0], c, id:-1, fx:[] }; })));
        return { ready:true };
      },
      apply(s, c, p, ev){ summon(s, c, p[0], fromS(p[1]), ev); },
    },
    'recruta-cemiterio':{
      targets(s, c, picks){
        if (s.arc.lim.summon[c] >= MAX_SUMMONS) return { err:'No máximo 2 invocações por partida.' };
        if (!s.arc.grave[c].includes('p')) return { err:'Não há Peão seu no cemitério.' };
        const row = c === 'w' ? 6 : 1;
        if (!picks.length) return step('Escolha uma casa vazia da sua segunda fileira.', emptySqs(s, i => (i >> 4) === row && kingSafeAfter(s, c, () => { s.board[i] = { t:'p', c, id:-1, fx:[] }; })));
        return { ready:true };
      },
      apply(s, c, p, ev){ summon(s, c, 'p', fromS(p[0]), ev); },
    },
    // armadilhas (escondidas; o rival só vê um brilho na casa)
    'armadilha-espinhos':{
      targets:(s, c, p) => trapsFull(s, c) || (p.length ? { ready:true } : step('Escolha uma casa vazia para a armadilha.', emptySqs(s, i => !s.arc.traps.some(t => t.sq === toS(i))))),
      apply(s, c, p, ev){ s.arc.traps.push({ id:'armadilha-espinhos', side:c, sq:p[0] }); ev.push({ k:'trap', side:c, sq:p[0] }); },
    },
    'contrafeitico':{ targets:(s, c) => trapsFull(s, c) || { ready:true }, apply(s, c, p, ev){ s.arc.traps.push({ id:'contrafeitico', side:c }); ev.push({ k:'trap', side:c }); } },
    'troca-sombra':{
      targets(s, c, p){
        const full = trapsFull(s, c); if (full) return full;
        if (!p.length) return step('Escolha a peça protegida (não o Rei).', ownPieces(s, c, q => !trapOn(s, q)));
        if (p.length === 1) return step('Escolha a casa de fuga (vazia).', emptySqs(s, i => toS(i) !== p[0]));
        return { ready:true };
      },
      apply(s, c, p, ev){ const q = s.board[fromS(p[0])]; s.arc.traps.push({ id:'troca-sombra', side:c, pid:q.id, escape:p[1] }); ev.push({ k:'trap', side:c, sq:p[0], escape:p[1] }); },
    },
    'duplo-corpo':{
      targets:(s, c, p) => trapsFull(s, c) || (p.length ? { ready:true } : step('Escolha a peça que terá um duplo (não o Rei).', ownPieces(s, c, q => !trapOn(s, q)))),
      apply(s, c, p, ev){ const q = s.board[fromS(p[0])]; s.arc.traps.push({ id:'duplo-corpo', side:c, pid:q.id }); ev.push({ k:'trap', side:c, sq:p[0] }); },
    },
    'profecia-selada':{
      targets(s, c, p){
        const full = trapsFull(s, c); if (full) return full;
        const o = other(c), ms = legalRaw(Object.assign(clone(s), { turn:o }), o);
        if (!p.length) return step('Crave o próximo lance do rival: escolha a peça dele.', [...new Set(ms.map(m => toS(m.f)))]);
        if (p.length === 1) return step('Escolha a casa para onde você acha que ela vai.', [...new Set(ms.filter(m => toS(m.f) === p[0]).map(m => toS(m.t)))]);
        return { ready:true };
      },
      apply(s, c, p, ev){ s.arc.traps.push({ id:'profecia-selada', side:c, from:p[0], to:p[1] }); ev.push({ k:'trap', side:c }); },
    },
    // terrenos
    'fosso-lava':{
      targets(s, c, p){
        if (p.length >= 2) return { ready:true };
        return step(p.length ? 'Escolha a segunda casa de lava.' : 'Escolha a primeira casa vazia que vira lava.', emptySqs(s, i => !p.includes(toS(i)) && withBlocked(s, p.concat(toS(i)), c)));
      },
      apply(s, c, p, ev){ for (const q of p){ s.arc.blocked[q] = { kind:'lava', ttl:4, side:c }; } ev.push({ k:'terrain', kind:'lava', sqs:p.slice() }); },
    },
    'nevoa-fria':{
      targets:(s, c, p) => p.length ? { ready:true } : step('Escolha o centro da névoa (área 3×3).', ALL.filter(i => !blocked(s, i)).map(toS)),
      apply(s, c, p, ev){
        const ctr = fromS(p[0]), hit = [];
        for (const d of [0, ...DK]){ const t = ctr + d; if (!onB(t)) continue; const q = s.board[t]; if (q && q.c !== c && q.t !== 'k' && !has(q, 'muralha_viva')){ addFx(s, q, { id:'nevoa', kind:'mark' }, 1); hit.push(toS(t)); } }
        ev.push({ k:'terrain', kind:'nevoa', center:p[0], sqs:hit });
      },
    },
    'repercussao-impacto':{ targets:() => ({ ready:true }), apply(s, c, p, ev){ s.arc.sideFx.push({ id:'impacto', side:c, ttl:2 }); ev.push({ k:'impactReady', side:c }); } },
    'portal-runa':{
      targets(s, c, p){
        if (p.length >= 2) return { ready:true };
        return step(p.length ? 'Escolha a segunda boca do portal (casa vazia).' : 'Escolha a primeira boca do portal (casa vazia).', emptySqs(s, i => !p.includes(toS(i))));
      },
      apply(s, c, p, ev){ s.arc.portals = s.arc.portals.filter(q => q.side !== c); s.arc.portals.push({ side:c, sqs:p.slice(), ttl:6 }); ev.push({ k:'terrain', kind:'portal', sqs:p.slice() }); },
    },
    // artefatos (espólio)
    'lanca-fiel':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha um Peão seu.', ownPieces(s, c, q => q.t === 'p')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'lanca', kind:'mark', uses:1 }); ev.push({ k:'fx', sq:p[0], id:'lanca' }); } },
    'ferradura-salto':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma peça sua (não o Rei): no próximo lance ela pode saltar em L.', ownPieces(s, c, q => q.t !== 'n')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'ferradura', kind:'mark', uses:1 }, 1); ev.push({ k:'fx', sq:p[0], id:'ferradura' }); } },
    'pedra-terra':{
      targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma casa vazia para a muralha.', emptySqs(s, i => withBlocked(s, [toS(i)], c))),
      apply(s, c, p, ev){ s.arc.blocked[p[0]] = { kind:'muralha', ttl:4, side:c }; ev.push({ k:'terrain', kind:'muralha', sqs:[p[0]] }); },
    },
    'coroa-raio':{ targets:(s, c, p) => p.length ? { ready:true } : step('Escolha uma peça sua (não o Rei): por 1 turno ela move como Dama.', ownPieces(s, c, q => q.t !== 'q')), apply(s, c, p, ev){ addFx(s, s.board[fromS(p[0])], { id:'coroa_raio', kind:'mark' }, 1); ev.push({ k:'fx', sq:p[0], id:'coroa_raio' }); } },
  };
  const trapsFull = (s, c) => s.arc.traps.filter(t => t.side === c).length >= MAX_TRAPS ? { err:'No máximo 2 armadilhas armadas.' } : null;
  function summon(s, c, t, i, ev){
    s.arc.lim.summon[c]++;
    const k = s.arc.grave[c].indexOf(t); if (k >= 0) s.arc.grave[c].splice(k, 1);
    s.board[i] = { t, c, id:s.nextId++, fx:[], home:i, summoned:true };
    s.half = 0;
    ev.push({ k:'summon', side:c, t, sq:toS(i), id:s.board[i].id });
  }
  function berserkRun(s, c, i, ev){
    const fw = c === 'w' ? -16 : 16;
    let at = i;
    const path = [];
    for (let k = 0; k < 3; k++){
      const t = at + fw;
      if (!onB(t) || blocked(s, t)) break;
      const q = s.board[t];
      if (q && (q.c === c || q.t === 'k')) break;
      if (q){ if (ev){ const cp = bury(s, t, 'berserker', ev, c); if (cp) loot(s, c, cp.t, ev); s.half = 0; } else s.board[t] = null; }
      s.board[t] = s.board[at]; s.board[at] = null; path.push(toS(t)); at = t;
    }
    if (ev){ ev.push({ k:'berserk', from:toS(i), path }); bury(s, at, 'sacrificio', ev); }
    else s.board[at] = null;
  }
  const implemented = id => !!FX[id];

  /* ---- ações ---- */
  function create(o = {}, decks){
    if (typeof o === 'number') o = { seed:o, decks };
    const s = { v:2, rng:(o.seed >>> 0) || 1, nextId:0, board:null, turn:'w', castle:'KQkq', ep:-1, half:0, full:1, hist:[], keys:{}, over:null,
      arc:{ ess:{ w:0, b:0 }, hand:{ w:[], b:[] }, deck:{ w:[], b:[] }, discard:{ w:[], b:[] }, grave:{ w:[], b:[] }, turns:{ w:0, b:0 }, runes:{}, phase:'move', cardSide:null, played:false,
        traps:[], blocked:{}, portals:[], anchors:[], trails:[], sideFx:[], oracle:null,
        lim:{ summon:{ w:0, b:0 }, sacr:{ w:0, b:0 }, legend:{ w:0, b:0 }, phoenix:{ w:0, b:0 } }, uid:0, decks:{ w:'tempestade', b:'cinzas' },
        // Oráculo: 'garantido' (a IA se compromete com o lance revelado) ou 'previsto' (o melhor lance que o motor prevê, contra humanos)
        opts:{ oracle:o.oracle || 'previsto' } } };
    loadFen(s, o.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    for (const c of ['w', 'b']){
      const dn = (o.decks && o.decks[c]) || s.arc.decks[c], list = Array.isArray(dn) ? dn : (DECKS[dn] || DECKS.tempestade).cartas;
      s.arc.decks[c] = Array.isArray(dn) ? 'custom' : DECKS[dn] ? dn : 'tempestade';
      s.arc.deck[c] = shuffle(s, list.filter(id => CARD[id]).map(id => newCard(s, id)));
      draw(s, c, HAND_START, 'inicio', []);
    }
    for (const q of RUNES) s.arc.runes[q] = null;
    s.keys[posKey(s)] = 1;
    gainEss(s, s.turn, 1, 'inicio', []);
    return s;
  }
  function legalMoves(s, from){
    if (s.over || s.arc.phase !== 'move') return [];
    const all = legalRaw(s, s.turn), f = from ? fromS(from) : null;
    return all.filter(m => f == null || m.f === f).map(m => verbose(s, m, all));
  }
  // empurra peças inimigas vizinhas de uma casa (Golem, Repercussão); sem saída, ficam presas 1 turno
  function shove(s, c, ctr, ev, stun){
    for (const d of DK){
      const a = ctr + d;
      if (!onB(a)) continue;
      const q = s.board[a];
      if (!q || q.c === c || q.t === 'k' || has(q, 'muralha_viva')) continue;
      const t = a + d;
      if (onB(t) && !s.board[t] && !blocked(s, t) && !(q.t === 'p' && lastRank(q.c, t)) && kingSafeAfter(s, c, () => { s.board[t] = q; s.board[a] = null; })){ relocate(s, a, t); ev.push({ k:'push', from:toS(a), to:toS(t) }); }
      else if (stun){ addFx(s, q, { id:'paralisado', kind:'mark' }, 1); ev.push({ k:'stun', sq:toS(a) }); }
    }
  }
  function applyMove(s0, mv){
    if (s0.over) return { ok:false, err:'A partida terminou.' };
    if (s0.arc.phase !== 'move') return { ok:false, err:'Agora é a fase de cartas.' };
    const all = legalRaw(s0, s0.turn), f = fromS(mv.from), t = fromS(mv.to);
    const m = all.find(x => x.f === f && x.t === t && (x.pr || '') === ((mv.promotion || (x.pr ? 'q' : '')) || ''));
    if (!m) return { ok:false, err:'Lance ilegal.' };
    const s = clone(s0), ev = [], c = s.turn, o = other(c);
    const v = verbose(s, m, all);
    const mover = s.board[m.f];
    const capSq = m.fl === 'e' ? m.t + (c === 'w' ? 16 : -16) : m.t;
    const victim = (m.fl.includes('c') || m.fl === 'e') ? s.board[capSq] : null;
    let result = 'normal';
    const safeNow = !inCheck(s, c);
    // Profecia Selada do rival: se ele cravou este lance, o lance é anulado e ele ganha +3 essência
    const proph = s.arc.traps.find(x => x.id === 'profecia-selada' && x.side === o);
    if (proph){
      s.arc.traps = s.arc.traps.filter(x => x !== proph);
      if (proph.from === v.from && proph.to === v.to && safeNow){ result = 'anulado'; gainEss(s, o, 3, 'profecia', ev); ev.push({ k:'trapFire', id:'profecia-selada', side:o, from:v.from, to:v.to }); }
      else ev.push({ k:'trapMiss', id:'profecia-selada', side:o });
    }
    if (result === 'normal' && victim && safeNow){
      const tr = trapOn(s, victim, 'troca-sombra'), esc = tr ? fromS(tr.escape) : -1;
      if (tr && !s.board[esc] && !blocked(s, esc) && kingSafeAfter(s, c, () => { s.board[esc] = s.board[capSq]; s.board[capSq] = null; })){
        s.arc.traps = s.arc.traps.filter(x => x !== tr);
        relocate(s, capSq, esc);
        addFx(s, mover, { id:'paralisado', kind:'mark' }, 1);
        result = 'bloqueado'; ev.push({ k:'trapFire', id:'troca-sombra', side:o, sq:toS(capSq), to:tr.escape, attacker:v.from });
      } else if (has(victim, 'escudo') || has(victim, 'martir') || has(victim, 'golem')){
        const which = has(victim, 'escudo') ? 'escudo' : has(victim, 'martir') ? 'martir' : 'golem';
        removeFx(victim, which);
        if (which === 'golem'){ shove(s, o, capSq, ev, false); }
        result = 'bloqueado'; ev.push({ k:'shield', sq:toS(capSq), id:which, attacker:v.from });
      }
    }
    let captured = null;
    if (result === 'normal'){
      // Duplo de Corpo: o atacante toma um Peão ilusório; a peça verdadeira reaparece na primeira fileira do dono
      const dub = victim && trapOn(s, victim, 'duplo-corpo');
      makeBoard(s, m);
      if (dub){
        s.arc.traps = s.arc.traps.filter(x => x !== dub);
        const row = o === 'w' ? 7 : 0, col = capSq & 7;
        const spots = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7].map(d => row * 16 + col + d).filter(i => onB(i) && (i >> 4) === row && !s.board[i] && !blocked(s, i) && kingSafeAfter(s, c, () => { s.board[i] = victim; }));
        if (spots.length){ s.board[spots[0]] = victim; ev.push({ k:'trapFire', id:'duplo-corpo', side:o, sq:toS(capSq), to:toS(spots[0]) }); }
        else { s.arc.grave[o].push(victim.t); ev.push({ k:'remove', sq:toS(capSq), side:o, t:victim.t, id:victim.id, why:'captura', by:c }); captured = victim; loot(s, c, victim.t, ev); }
      } else if (victim){
        captured = victim;
        s.arc.traps = s.arc.traps.filter(x => x.pid !== victim.id);
        s.arc.grave[o].push(victim.promo ? 'p' : victim.t);
        loot(s, c, victim.t, ev);
        // Vingança da Isca: o atacante fica paralisado 2 turnos
        if (has(victim, 'vinganca')){ addFx(s, s.board[m.t], { id:'paralisado', kind:'mark' }, 2); ev.push({ k:'stun', sq:toS(m.t), why:'vinganca' }); }
        // Fênix: a Dama renasce na casa inicial (ou na casa vazia mais perto dela na primeira fileira)
        if (has(victim, 'fenix')){
          const home = victim.home != null ? victim.home : (o === 'w' ? 115 : 3), row = home >> 4;
          const spots = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(d => home + d).filter(i => onB(i) && (i >> 4) === row && !s.board[i] && !blocked(s, i) && kingSafeAfter(s, c, () => { s.board[i] = { t:'q', c:o, id:-1, fx:[] }; }));
          if (spots.length){
            const q = { t:'q', c:o, id:s.nextId++, fx:[], home };
            s.board[spots[0]] = q;
            s.arc.grave[o].pop();
            ev.push({ k:'phoenix', side:o, sq:toS(spots[0]), id:q.id });
          }
        }
      }
      const piece = s.board[m.t];
      if (m.mod){ const fx = fxOf(piece, m.mod); if (fx && fx.uses){ removeFx(piece, m.mod); ev.push({ k:'fxUsed', sq:toS(m.t), id:m.mod }); } }
      // Armadilha de Espinhos: a primeira peça inimiga que entra na casa volta para a origem
      const spike = !victim && piece.t !== 'k' ? s.arc.traps.find(x => x.id === 'armadilha-espinhos' && x.side === o && x.sq === toS(m.t)) : null;
      if (spike && kingSafeAfter(s, c, () => { s.board[m.f] = s.board[m.t]; s.board[m.t] = null; })){
        s.arc.traps = s.arc.traps.filter(x => x !== spike);
        s.board[m.f] = s.board[m.t]; s.board[m.t] = null;
        if (s.ep >= 0) s.ep = -1;
        ev.push({ k:'trapFire', id:'armadilha-espinhos', side:o, sq:toS(m.t), to:toS(m.f) });
        result = 'espinhos';
      }
      if (result === 'normal'){
        // Necromante das Cinzas: o Bispo deixa rastro; o inimigo que cruzar perde 1 turno
        if (has(piece, 'necro')) s.arc.trails.push({ side:c, sq:toS(m.f), ttl:6 });
        const pathSq = [];
        const df = Math.sign((m.t >> 4) - (m.f >> 4)) * 16 + Math.sign((m.t & 7) - (m.f & 7)), straight = (m.t >> 4) === (m.f >> 4) || (m.t & 7) === (m.f & 7) || Math.abs((m.t >> 4) - (m.f >> 4)) === Math.abs((m.t & 7) - (m.f & 7));
        if (straight && piece.t !== 'n'){ for (let a = m.f + df; a !== m.t && onB(a); a += df) pathSq.push(toS(a)); }
        pathSq.push(toS(m.t));
        const tr = s.arc.trails.find(x => x.side === o && pathSq.includes(x.sq));
        if (tr && piece.t !== 'k'){ s.arc.trails = s.arc.trails.filter(x => x !== tr); addFx(s, piece, { id:'paralisado', kind:'mark' }, 1); ev.push({ k:'stun', sq:toS(m.t), why:'rastro' }); }
        // Golem de Pedra: ao mover, golpeia (empurra) as peças inimigas vizinhas
        if (has(piece, 'golem')) shove(s, c, m.t, ev, false);
        // Repercussão de Impacto: na captura, as vizinhas são empurradas ou ficam presas 1 turno
        const imp = s.arc.sideFx.find(x => x.id === 'impacto' && x.side === c);
        if (imp && captured){ s.arc.sideFx = s.arc.sideFx.filter(x => x !== imp); shove(s, c, m.t, ev, true); ev.push({ k:'impact', sq:toS(m.t) }); }
        // Ponto de Ancoragem: a captura feita pela peça ancorada continua valendo; a volta é no fim do turno do rival
      }
    }
    if (result !== 'normal' && result !== 'espinhos'){
      // lance anulado ou ataque bloqueado: o atacante fica na origem
      v.san += result === 'anulado' ? ' (anulado)' : ' (bloqueado)';
    } else if (result === 'espinhos') v.san += ' (espinhos)';
    v.result = result;
    s.half = captured || (mover.t === 'p' && result === 'normal') || m.pr ? 0 : s.half + 1;
    if (c === 'b') s.full++;
    s.turn = o;
    s.hist.push(v);
    if (m.pr && result === 'normal' && RARE.length) giveCard(s, c, newCard(s, RARE[Math.floor(rnd(s) * RARE.length)]), 'promocao', ev);
    if (s.arc.oracle && s.arc.oracle.side === c){ ev.push({ k:'oracleEnd', hit:s.arc.oracle.moves.some(x => x.from === v.from && x.to === v.to) }); s.arc.oracle = null; }
    s.arc.phase = 'cards'; s.arc.cardSide = c; s.arc.played = false;
    const st = status(s);
    if (st.mate){ s.over = st.over; s.arc.phase = 'over'; ev.push({ k:'over', over:s.over }); }
    return { ok:true, state:s, move:v, events:ev };
  }
  function cardOptions(s, uid, picks = []){
    if (s.over) return { err:'A partida terminou.' };
    if (s.arc.phase !== 'cards') return { err:'Cartas só na fase de cartas, depois do lance.' };
    const c = s.arc.cardSide, card = s.arc.hand[c].find(x => x.uid === uid);
    if (!card) return { err:'Essa carta não está na sua mão.' };
    if (s.arc.played) return { err:'Só uma carta por turno.' };
    const def = CARD[card.id];
    if (!def) return { err:'Carta desconhecida.' };
    if (s.arc.ess[c] < def.custo) return { err:`Essência insuficiente (custa ${def.custo}).` };
    if (!implemented(card.id)) return { err:'O efeito desta carta chega na próxima etapa.', soon:true };
    const w = clone(s);
    const r = FX[card.id].targets(w, c, picks);
    // alvos completos: confere o resultado (nenhuma carta pode deixar o próprio Rei em xeque)
    if (r.ready){
      const t = clone(s), ev = [];
      t.arc.ess[c] -= def.custo;
      try { FX[card.id].apply(t, c, picks, ev); } catch (e){ return { err:'Alvo inválido.' }; }
      if (inCheck(t, c)) return { err:inCheck(s, c) ? 'Com o Rei em xeque, só vale carta que tira o xeque.' : 'A carta deixaria o seu Rei em xeque.' };
    }
    return r;
  }
  function playCard(s0, uid, picks = []){
    const chk = cardOptions(s0, uid, []);
    if (chk.err) return { ok:false, err:chk.err };
    for (let i = 0; i < picks.length; i++){
      const r = cardOptions(s0, uid, picks.slice(0, i));
      if (r.err) return { ok:false, err:r.err };
      if (r.ready || !r.options.includes(picks[i])) return { ok:false, err:'Alvo inválido.' };
    }
    const fin = cardOptions(s0, uid, picks);
    if (!fin.ready) return { ok:false, err:fin.err || 'Faltam alvos.' };
    const s = clone(s0), ev = [], c = s.arc.cardSide, o = other(c);
    const idx = s.arc.hand[c].findIndex(x => x.uid === uid), card = s.arc.hand[c][idx], def = CARD[card.id];
    s.arc.hand[c].splice(idx, 1);
    s.arc.ess[c] -= def.custo;
    s.arc.played = true;
    ev.push({ k:'card', side:c, card, picks:picks.slice(), cost:def.custo });
    // Contrafeitico do rival anula esta carta (a essência é gasta)
    const counter = s.arc.traps.find(x => x.id === 'contrafeitico' && x.side === o);
    if (counter){
      s.arc.traps = s.arc.traps.filter(x => x !== counter);
      s.arc.discard[c].push(card);
      ev.push({ k:'trapFire', id:'contrafeitico', side:o, card:card.id });
      return { ok:true, state:s, events:ev };
    }
    FX[card.id].apply(s, c, picks, ev);
    s.arc.discard[c].push(card);
    if (inCheck(s, c)) return { ok:false, err:'A carta deixaria o seu Rei em xeque.' };
    const st = status(s);
    if (st.mate){ s.over = st.over; s.arc.phase = 'over'; ev.push({ k:'over', over:s.over }); }
    return { ok:true, state:s, events:ev };
  }
  function endTurn(s0){
    if (s0.over) return { ok:false, err:'A partida terminou.' };
    if (s0.arc.phase !== 'cards') return { ok:false, err:'Faça o seu lance primeiro.' };
    const s = clone(s0), ev = [], c = s.arc.cardSide;
    s.arc.turns[c]++;
    for (const q of RUNES){
      const p = s.board[fromS(q)];
      if (p && p.c === c && !s.arc.runes[q]){ s.arc.runes[q] = c; ev.push({ k:'rune', side:c, sq:q }); draw(s, c, 1, 'runa', ev); }
    }
    if (s.arc.turns[c] % 2 === 0) draw(s, c, 1, 'turno', ev);
    // contadores das peças do lado que terminou
    for (const i of ALL){
      const p = s.board[i];
      if (!p || p.c !== c || !p.fx.length) continue;
      for (const fx of p.fx) if (fx.turns != null) fx.turns--;
      const gone = p.fx.filter(fx => fx.turns != null && fx.turns <= 0);
      p.fx = p.fx.filter(fx => fx.turns == null || fx.turns > 0);
      for (const fx of gone) ev.push({ k:'fxEnd', sq:toS(i), id:fx.id });
    }
    // efeitos do tabuleiro contam todos os fins de turno
    for (const q of Object.keys(s.arc.blocked)){ const b = s.arc.blocked[q]; if (--b.ttl <= 0){ delete s.arc.blocked[q]; ev.push({ k:'terrainEnd', kind:b.kind, sqs:[q] }); } }
    for (const pt of s.arc.portals) pt.ttl--;
    for (const pt of s.arc.portals.filter(x => x.ttl <= 0)) ev.push({ k:'terrainEnd', kind:'portal', sqs:pt.sqs });
    s.arc.portals = s.arc.portals.filter(x => x.ttl > 0);
    for (const tr of s.arc.trails) tr.ttl--;
    s.arc.trails = s.arc.trails.filter(x => x.ttl > 0);
    for (const f of s.arc.sideFx) f.ttl--;
    s.arc.sideFx = s.arc.sideFx.filter(x => x.ttl > 0);
    // Ponto de Ancoragem: no fim do turno do rival, a peça volta à casa marcada (se estiver livre e o Rei ficar a salvo)
    for (const an of s.arc.anchors) an.ttl--;
    for (const an of s.arc.anchors.filter(x => x.ttl <= 0)){
      const at = ALL.find(i => s.board[i] && s.board[i].id === an.pid), to = fromS(an.sq);
      if (at != null && at !== to && !s.board[to] && !blocked(s, to) && kingSafeAfter(s, an.side, () => { s.board[to] = s.board[at]; s.board[at] = null; }) && kingSafeAfter(s, other(an.side), () => { s.board[to] = s.board[at]; s.board[at] = null; })){
        relocate(s, at, to); ev.push({ k:'anchorReturn', from:toS(at), to:an.sq });
      } else ev.push({ k:'anchorFail', sq:an.sq });
    }
    s.arc.anchors = s.arc.anchors.filter(x => x.ttl > 0);
    s.arc.phase = 'move'; s.arc.cardSide = null; s.arc.played = false;
    const key = posKey(s);
    s.keys[key] = (s.keys[key] || 0) + 1;
    const st = status(s);
    if (st.over){ s.over = st.over; s.arc.phase = 'over'; ev.push({ k:'over', over:s.over }); return { ok:true, state:s, events:ev }; }
    gainEss(s, s.turn, 1, 'inicio', ev);
    ev.push({ k:'turn', side:s.turn });
    return { ok:true, state:s, events:ev };
  }
  const actor = s => s.over ? null : s.arc.phase === 'cards' ? s.arc.cardSide : s.turn;
  function cardPicks(s, uid, picks, out, cap){
    if (out.length >= cap) return;
    const o = cardOptions(s, uid, picks);
    if (o.err) return;
    if (o.ready){ out.push(picks.slice()); return; }
    for (const q of o.options){ picks.push(q); cardPicks(s, uid, picks, out, cap); picks.pop(); if (out.length >= cap) return; }
  }
  function legalActions(s, side, o = {}){
    if (side && side !== actor(s)) return [];
    if (s.over) return [];
    if (s.arc.phase === 'move') return legalMoves(s).map(m => ({ type:'move', from:m.from, to:m.to, promotion:m.promotion, san:m.san }));
    const out = [{ type:'end' }], c = s.arc.cardSide;
    if (!s.arc.played) for (const card of s.arc.hand[c]){
      const combos = [];
      cardPicks(s, card.uid, [], combos, o.cap || 24);
      for (const picks of combos) out.push({ type:'card', uid:card.uid, id:card.id, picks });
    }
    return out;
  }
  function apply(s, a){
    if (!a || !a.type) return { ok:false, err:'Ação inválida.' };
    if (a.type === 'move') return applyMove(s, a);
    if (a.type === 'card') return playCard(s, a.uid, a.picks || []);
    if (a.type === 'end') return endTurn(s);
    return { ok:false, err:'Ação desconhecida.' };
  }
  // vista para um jogador: esconde a mão e a ordem do grimório do rival, as armadilhas dele (só o brilho) e o RNG
  function viewFor(s, c){
    const v = clone(s), o = other(c);
    v.arc.hand[o] = v.arc.hand[o].map(() => ({ uid:'?', id:'?' }));
    v.arc.deck = { w:v.arc.deck.w.length, b:v.arc.deck.b.length };
    v.arc.traps = v.arc.traps.map(t => t.side === c || t.seen ? t : { id:'?', side:t.side, sq:t.sq || null, glow:t.sq || (t.pid != null ? 'peça' : null) });
    v.rng = 0;
    return v;
  }
  // brilho suspeito: casas (ou peças) com armadilha do rival que o jogador c enxerga
  function trapGlows(s, c){
    const out = [];
    for (const t of s.arc.traps){
      if (t.side === c) continue;
      if (t.sq) out.push(t.sq);
      else if (t.pid != null){ const i = ALL.find(a => s.board[a] && s.board[a].id === t.pid); if (i != null) out.push(toS(i)); }
    }
    return out;
  }

  /* ---- IA do Arcano (pura, roda no Worker ou num servidor) ----
     choose(state, side, nivel) → { action } dentro do orçamento de tempo. A IA enxerga só o que o jogador enxergaria:
     as armadilhas escondidas do rival somem da cópia em que ela pensa. Avaliação: material + centro + avanço dos Peões +
     segurança do Rei + valor dos efeitos de carta nas peças + essência e mão. No lance, nível 1 olha 1 lance com ruído,
     nível 2 pune peças penduradas, nível 3 olha a melhor resposta do rival (2 lances). Na fase de cartas compara cada
     carta jogável (com alvos) com não jogar nada. Com o Oráculo garantido, a IA joga o lance revelado. */
  const AI_LV = { 1:{ ms:250, noise:70, cardP:0.45 }, 2:{ ms:700, noise:12, cardP:1 }, 3:{ ms:1400, noise:0, cardP:1 } };
  const FX_VAL = { escudo:90, martir:80, golem:120, heranca:90, coroa:140, coroa_raio:70, coroa_herdada:160, alcance:60, vinganca:40, salto_herdado:60, visao_arcana:50, muralha_viva:120,
    oraculo_b:40, pegaso:90, dragao:260, canhao:110, andarilho:50, necro:40, centuriao:50, fenix:200, dominio:30, salto:40, lanca:30, ferradura:25, paralisado:-1, nevoa:-30 };
  // valor de carta que a avaliação do tabuleiro não enxerga (armadilhas, informação, portais): sem isso a IA sem ruído nunca as joga
  const CARD_AI = { 'armadilha-espinhos':40, 'troca-sombra':45, 'duplo-corpo':45, 'profecia-selada':40, 'visao-oraculo':30, 'veu-sombras':15, 'bispo-oraculo':55,
    'portal-runa':25, 'ponto-ancoragem':20, 'necromante-cinzas':15, 'grimorio-arcano':10 };
  function cardAI(s, s0, me, id){
    let v = CARD_AI[id] || 0;
    if (id === 'contrafeitico') v += s.arc.hand[other(me)].length ? 50 : 0;
    if (id === 'olho-bispo') v += 30 * s0.arc.traps.filter(t => t.side !== me && !t.seen).length;
    if (id === 'repercussao-impacto') v += legalMoves(s).some(m => m.captured) ? 35 : 0;
    return v;
  }
  function aiView(s, me){ const v = clone(s); v.arc.traps = v.arc.traps.filter(t => t.side === me || t.seen); return v; }
  function evalFor(s, me){
    if (s.over) return s.over.kind === 'mate' ? (s.over.winner === me ? 100000 : -100000) : 0;
    let v = 0;
    const center = i => 3.5 - Math.max(Math.abs((i >> 4) - 3.5), Math.abs((i & 7) - 3.5));
    for (const i of ALL){
      const p = s.board[i];
      if (!p) continue;
      const sg = p.c === me ? 1 : -1;
      let x = VAL[p.t] * 100;
      if (p.t === 'p') x += (p.c === 'w' ? 6 - (i >> 4) : (i >> 4) - 1) * 8;
      if (p.t === 'n' || p.t === 'b') x += center(i) * 8;
      if (p.t === 'q' || p.t === 'r') x += center(i) * 2;
      if (p.t === 'k') x += (s.hist.length < 50 ? -center(i) * 10 : center(i) * 6);
      for (const f of p.fx) x += f.id === 'paralisado' ? -VAL[p.t] * 35 : (FX_VAL[f.id] || 20) * (f.turns != null ? Math.min(1, 0.35 + f.turns * 0.25) : 1);
      v += sg * x;
    }
    for (const c of ['w', 'b']){ const sg = c === me ? 1 : -1; v += sg * (s.arc.ess[c] * 9 + s.arc.hand[c].length * 18 + s.arc.traps.filter(t => t.side === c).length * 35); }
    if (inCheck(s, me)) v -= 60;
    if (inCheck(s, other(me))) v += 40;
    return v;
  }
  // peças minhas atacadas e sem defesa (ou atacadas por peça mais barata), do ponto de vista de "me"
  function hanging(s, me){
    let worst = 0;
    for (const i of ALL){
      const p = s.board[i];
      if (!p || p.c !== me || p.t === 'k' || has(p, 'escudo') || has(p, 'martir') || has(p, 'golem')) continue;
      if (!attacked(s, i, other(me))) continue;
      const q = s.board[i]; s.board[i] = { t:'p', c:other(me), id:-2, fx:[] };
      const def = attacked(s, i, me);
      s.board[i] = q;
      const loss = def ? VAL[p.t] * 100 * 0.35 : VAL[p.t] * 100;
      if (loss > worst) worst = loss;
    }
    return worst;
  }
  function choose(s0, side, level = 2, o = {}){
    const L = AI_LV[level] || AI_LV[2], t0 = Date.now(), deadline = t0 + (o.ms || L.ms);
    const me = side || actor(s0);
    if (!me || s0.over) return { action:null };
    const s = aiView(s0, me);
    const rnd01 = () => rnd(s);
    if (s.arc.phase === 'move'){
      const ms = legalMoves(s);
      if (!ms.length) return { action:null };
      // Oráculo garantido contra a IA: ela cumpre o lance revelado
      const orc = s0.arc.oracle;
      if (orc && orc.side === me && orc.guaranteed && orc.moves[0]){ const m = ms.find(x => x.from === orc.moves[0].from && x.to === orc.moves[0].to); if (m) return { action:{ type:'move', from:m.from, to:m.to, promotion:m.promotion }, oracle:true }; }
      const scored = [];
      const order = ms.slice().sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0));
      for (const m of order){
        const r = applyMove(s, m);
        if (!r.ok) continue;
        let v = evalFor(r.state, me);
        if (r.state.over && r.state.over.kind === 'mate'){ scored.push({ m, v:1e6 }); break; }
        if (level >= 2) v -= hanging(r.state, me) * (level >= 3 ? 0.5 : 0.9);
        if (level >= 3 && Date.now() < deadline){
          // melhor resposta do rival (depois da fase de cartas vazia)
          const e = endTurn(r.state);
          if (e.ok && !e.state.over){
            const op = legalMoves(e.state).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0)).slice(0, 14);
            let worst = Infinity;
            for (const om of op){
              if (Date.now() > deadline) break;
              const r2 = applyMove(e.state, om);
              if (!r2.ok) continue;
              const v2 = evalFor(r2.state, me);
              if (v2 < worst) worst = v2;
            }
            if (worst !== Infinity) v = Math.min(v, worst + 15);
          } else if (e.ok && e.state.over) v = evalFor(e.state, me);
        }
        v += (rnd01() - 0.5) * 2 * L.noise;
        scored.push({ m, v });
        if (Date.now() > deadline + 600) break;
      }
      scored.sort((a, b) => b.v - a.v);
      // a IA pensou sem ver as armadilhas do rival: confere o lance no estado real
      for (const x of scored){ const a = { type:'move', from:x.m.from, to:x.m.to, promotion:x.m.promotion }; if (applyMove(s0, a).ok) return { action:a, score:x.v, ms:Date.now() - t0 }; }
      const real = legalMoves(s0)[0];
      return { action:real ? { type:'move', from:real.from, to:real.to, promotion:real.promotion } : null, ms:Date.now() - t0 };
    }
    if (s.arc.phase === 'cards'){
      const acts = legalActions(s, me, { cap:o.cap || (level >= 3 ? 14 : 8) });
      const base = evalFor(s, me) - (level >= 2 ? hanging(s, me) * 0.8 : 0);
      const okReal = a => a.type === 'end' || playCard(s0, a.uid, a.picks).ok;
      let best = { a:{ type:'end' }, v:base };
      if (rnd01() > L.cardP) return { action:best.a };
      const cardsOnly = acts.filter(a => a.type === 'card');
      if (level === 1 && cardsOnly.length){ const a = cardsOnly[Math.floor(rnd01() * cardsOnly.length)], x = { type:'card', uid:a.uid, picks:a.picks }; return { action:okReal(x) ? x : { type:'end' } }; }
      for (const a of cardsOnly){
        if (Date.now() > deadline) break;
        const r = playCard(s, a.uid, a.picks);
        if (!r.ok) continue;
        const cost = (CARD[a.id] || {}).custo || 0;
        // a essência gasta já sai da avaliação; um pequeno bônus para cartas que viram valor no tabuleiro
        // a carta jogada sai da mão mas vira efeito (+18 devolve o valor de mão); a essência gasta já sai da avaliação
        let v = evalFor(r.state, me) - (level >= 2 ? hanging(r.state, me) * 0.8 : 0) + cost * 4 + 18 + cardAI(s, s0, me, a.id);
        if (r.state.over && r.state.over.kind === 'mate' && r.state.over.winner === me) v = 1e6;
        v += (rnd01() - 0.5) * 2 * L.noise;
        if (v > best.v + 8){ const x = { type:'card', uid:a.uid, picks:a.picks }; if (okReal(x)) best = { a:x, v }; }
      }
      return { action:best.a, score:best.v, ms:Date.now() - t0 };
    }
    return { action:null };
  }
  const board8 = s => { const out = []; for (let r = 0; r < 8; r++){ const row = []; for (let c = 0; c < 8; c++){ const p = s.board[r * 16 + c]; row.push(p ? { type:p.t, color:p.c, eid:p.id } : null); } out.push(row); } return out; };
  const pieceAt = (s, q) => s.board[fromS(q)];
  const perft = (s, d) => { if (!d) return 1; let n = 0; for (const m of legalRaw(s, s.turn)){ const u = makeBoard(s, m), t = s.turn; s.turn = other(t); n += perft(s, d - 1); s.turn = t; unmakeBoard(s, u); } return n; };
  return { create, legalMoves, legalActions, apply, actor, choose, evalFor, applyMove, cardOptions, playCard, endTurn, status, fen, viewFor, board8, pieceAt, predict, trapGlows,
    perft:(fenStr, d) => { const s = { nextId:0, arc:{ blocked:{}, portals:[], traps:[] } }; loadFen(s, fenStr); return perft(s, d); },
    implemented, DECKS, RUNES, LOOT, ESS_MAX, HAND_MAX, MOVE_MODS, FX, card:id => CARD[id], other, NAME };
};
/* ---------- fim do motor do Arcano ---------- */

// Node/Workers: const arcanoRules = require("./arcano-rules.js"); const ARC = arcanoRules(require("../data/cartas.json").cartas);
if (typeof module !== "undefined" && module.exports) module.exports = arcanoRules;
