/* ---------- Motor do Modo Arcano ----------
   Módulo puro (sem DOM nem THREE): todo o estado é JSON e o sorteio usa um RNG com semente guardado no próprio estado,
   então o mesmo código roda no navegador e num servidor (validação de lances e cartas). Uso:
     const ARC = arcanoRules(catalogo);           // catálogo = data/cartas.json (lista "cartas")
     let s = ARC.create({ seed, decks:{ w:'tempestade', b:'cinzas' } });
     ARC.legalMoves(s, 'e2') · ARC.applyMove(s, { from, to, promotion }) · ARC.cardOptions(s, uid, picks)
     ARC.playCard(s, uid, picks) · ARC.endTurn(s) · ARC.status(s) · ARC.fen(s)
   Cada ação devolve { ok, state, events, err } e nunca altera o estado recebido.
   Turno: início (+1 essência) → lance → espólio se capturou (+2 essência e o artefato da peça) → fase de cartas
   (até 1 carta) → fim (compra 1 carta a cada 2 turnos; casas de runa dão 1 carta) → vez do rival. */
const arcanoRules = (catalog = []) => {
  const FILES = 'abcdefgh';
  const toS = i => FILES[i & 7] + (8 - (i >> 4));
  const fromS = q => (8 - +q[1]) * 16 + (q.charCodeAt(0) - 97);
  const onB = i => i >= 0 && i < 128 && !(i & 0x88);
  const DN = [-33, -31, -18, -14, 14, 18, 31, 33], DB = [-17, -15, 15, 17], DR = [-16, -1, 1, 16], DK = DB.concat(DR);
  const VAL = { p:1, n:3, b:3, r:5, q:9, k:0 };
  const CARD = {};
  for (const c of catalog) CARD[c.id] = c;
  const LOOT = { p:'lanca-fiel', n:'ferradura-salto', b:'grimorio-arcano', r:'pedra-terra', q:'coroa-raio' };
  const RUNES = ['d4', 'e4', 'd5', 'e5'];
  const ESS_MAX = 10, HAND_START = 3, HAND_MAX = 5;
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
      s.board[r * 16 + c] = { t:ch.toLowerCase(), c:ch === ch.toLowerCase() ? 'b' : 'w', id:s.nextId++, fx:[] };
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
  const posKey = s => fen(s).split(' ').slice(0, 4).join(' ');
  function kingSq(s, c){ for (let i = 0; i < 128; i++){ if (i & 0x88){ i += 7; continue; } const p = s.board[i]; if (p && p.t === 'k' && p.c === c) return i; } return -1; }
  function attacked(s, i, by){
    const B = s.board, pd = by === 'w' ? 16 : -16;
    for (const dc of [-1, 1]){ const a = i + pd + dc; if (onB(a) && B[a] && B[a].c === by && B[a].t === 'p') return true; }
    for (const d of DN){ const a = i + d; if (onB(a) && B[a] && B[a].c === by && B[a].t === 'n') return true; }
    for (const d of DK){ const a = i + d; if (onB(a) && B[a] && B[a].c === by && B[a].t === 'k') return true; }
    for (const d of DB){ let a = i + d; while (onB(a)){ const p = B[a]; if (p){ if (p.c === by && (p.t === 'b' || p.t === 'q')) return true; break; } a += d; } }
    for (const d of DR){ let a = i + d; while (onB(a)){ const p = B[a]; if (p){ if (p.c === by && (p.t === 'r' || p.t === 'q')) return true; break; } a += d; } }
    return false;
  }
  const inCheck = (s, c) => { const k = kingSq(s, c); return k >= 0 && attacked(s, k, other(c)); };
  // casas bloqueadas por terrenos/muralhas (Fase D preenche s.arc.blocked)
  const blocked = (s, i) => !!(s.arc && s.arc.blocked && s.arc.blocked[toS(i)]);
  // lances extras vindos de relíquias e transmutações (Fase D): MOVE_MODS[fx.id](s, i, piece, add)
  const MOVE_MODS = {};
  function pseudo(s, c){
    const out = [], B = s.board, op = other(c);
    const add = (f, t, fl, pr) => out.push({ f, t, fl, pr });
    for (let i = 0; i < 128; i++){
      if (i & 0x88){ i += 7; continue; }
      const p = B[i];
      if (!p || p.c !== c) continue;
      if (p.t === 'p'){
        const dir = c === 'w' ? -16 : 16, start = c === 'w' ? 6 : 1, last = c === 'w' ? 0 : 7;
        const one = i + dir;
        if (onB(one) && !B[one] && !blocked(s, one)){
          if ((one >> 4) === last) for (const pr of 'qrbn') add(i, one, 'np', pr);
          else {
            add(i, one, 'n');
            const two = one + dir;
            if ((i >> 4) === start && onB(two) && !B[two] && !blocked(s, two)) add(i, two, 'b');
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
            if (s.castle.includes(K) && rk && rk.t === 'r' && rk.c === c && !B[home + 1] && !B[home + 2] && !attacked(s, home + 1, op) && !attacked(s, home + 2, op)) add(i, home + 2, 'k');
            if (s.castle.includes(Q) && rq && rq.t === 'r' && rq.c === c && !B[home - 1] && !B[home - 2] && !B[home - 3] && !attacked(s, home - 1, op) && !attacked(s, home - 2, op)) add(i, home - 2, 'q');
          }
        }
      }
      for (const fx of p.fx || []) if (MOVE_MODS[fx.id]) MOVE_MODS[fx.id](s, i, p, add, fx);
    }
    // o Rei nunca é capturado (mate antes); lances que capturariam o Rei não existem
    return out.filter(m => !(B[m.t] && B[m.t].t === 'k'));
  }
  // aplica no tabuleiro (sem regras de turno) e devolve o desfazer
  function makeBoard(s, m){
    const B = s.board, p = B[m.f], u = { m, p, cap:B[m.t], capSq:m.t, castle:s.castle, ep:s.ep, half:s.half, rook:null };
    if (m.fl === 'e'){ u.capSq = m.t + (p.c === 'w' ? 16 : -16); u.cap = B[u.capSq]; B[u.capSq] = null; }
    B[m.t] = m.pr ? { t:m.pr, c:p.c, id:p.id, fx:p.fx || [], promo:true } : p;
    B[m.f] = null;
    if (m.fl === 'k' || m.fl === 'q'){
      const rf = m.fl === 'k' ? m.f + 3 : m.f - 4, rt = m.fl === 'k' ? m.f + 1 : m.f - 1;
      u.rook = [rf, rt]; B[rt] = B[rf]; B[rf] = null;
    }
    // direitos de roque: o Rei ou a Torre saiu de casa, ou a Torre foi tomada
    const drop = q => { s.castle = s.castle.replace(q, ''); };
    if (p.t === 'k') { drop(p.c === 'w' ? 'K' : 'k'); drop(p.c === 'w' ? 'Q' : 'q'); }
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
  function legalRaw(s, c){
    const out = [];
    for (const m of pseudo(s, c)){ const u = makeBoard(s, m); if (!inCheck(s, c)) out.push(m); unmakeBoard(s, u); }
    return out;
  }
  function sanOf(s, m, all){
    const p = s.board[m.f];
    let san;
    if (m.fl === 'k') san = 'O-O';
    else if (m.fl === 'q') san = 'O-O-O';
    else {
      const cap = m.fl.includes('c') || m.fl === 'e';
      if (p.t === 'p') san = (cap ? FILES[m.f & 7] + 'x' : '') + toS(m.t) + (m.pr ? '=' + m.pr.toUpperCase() : '');
      else {
        const amb = all.filter(o => o !== m && o.t === m.t && o.f !== m.f && s.board[o.f].t === p.t);
        let dis = '';
        if (amb.length){
          const sf = amb.some(o => (o.f & 7) === (m.f & 7)), sr = amb.some(o => (o.f >> 4) === (m.f >> 4));
          dis = !sf ? FILES[m.f & 7] : !sr ? String(8 - (m.f >> 4)) : toS(m.f);
        }
        san = p.t.toUpperCase() + dis + (cap ? 'x' : '') + toS(m.t);
      }
    }
    const u = makeBoard(s, m), op = other(p.c);
    if (inCheck(s, op)) san += legalRaw(s, op).length ? '+' : '#';
    unmakeBoard(s, u);
    return san;
  }
  const verbose = (s, m, all) => {
    const p = s.board[m.f], cap = m.fl === 'e' ? 'p' : s.board[m.t] ? s.board[m.t].t : undefined;
    const o = { color:p.c, from:toS(m.f), to:toS(m.t), piece:p.t, flags:m.fl, san:sanOf(s, m, all) };
    if (cap) o.captured = cap;
    if (m.pr) o.promotion = m.pr;
    return o;
  };
  function insufficient(s){
    const minors = [];
    for (let i = 0; i < 128; i++){
      if (i & 0x88){ i += 7; continue; }
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

  /* ---- cartas ---- */
  function newCard(s, id){ return { uid:'c' + (++s.arc.uid), id }; }
  function draw(s, c, n, why, ev){
    for (let i = 0; i < n; i++){
      const card = s.arc.deck[c].pop();
      if (!card){ ev.push({ k:'deckEmpty', side:c }); return; }
      giveCard(s, c, card, why, ev);
    }
  }
  // carta nova: mão cheia queima a carta (vai para o descarte)
  function giveCard(s, c, card, why, ev){
    if (s.arc.hand[c].length >= HAND_MAX){ s.arc.discard[c].push(card); ev.push({ k:'burn', side:c, card, why }); return; }
    s.arc.hand[c].push(card);
    ev.push({ k:'draw', side:c, card, why });
  }
  const gainEss = (s, c, n, why, ev) => { const a = s.arc.ess[c], b = Math.min(ESS_MAX, a + n); s.arc.ess[c] = b; if (b !== a) ev.push({ k:'essence', side:c, delta:b - a, total:b, why }); };
  // efeitos de carta: targets(s, side, picks) → { ready } ou { prompt, options:[casas] }; apply(s, side, picks, ev)
  const FX = {
    'grimorio-arcano':{
      targets:() => ({ ready:true }),
      apply(s, c, picks, ev){ draw(s, c, 2, 'grimorio', ev); },
    },
    'passo-relampago':{
      targets(s, c, picks){
        if (!picks.length){
          const opts = [];
          for (let i = 0; i < 128; i++){ if (i & 0x88){ i += 7; continue; } const p = s.board[i]; if (p && p.c === c && p.t !== 'k' && stepDest(s, c, i).length) opts.push(toS(i)); }
          return opts.length ? { prompt:'Escolha uma peça sua (não o Rei).', options:opts } : { err:'Nenhuma peça sua pode dar o passo.' };
        }
        if (picks.length === 1) return { prompt:'Escolha a casa de destino (até 2 casas, sem capturar).', options:stepDest(s, c, fromS(picks[0])).map(toS) };
        return { ready:true };
      },
      apply(s, c, picks, ev){
        const f = fromS(picks[0]), t = fromS(picks[1]);
        relocate(s, f, t);
        ev.push({ k:'cardMove', from:picks[0], to:picks[1] });
      },
    },
    'olho-bispo':{
      targets:() => ({ ready:true }),
      apply(s, c, picks, ev){ ev.push({ k:'reveal', side:c, traps:s.arc.traps.filter(t => t.side !== c).map(t => t.sq) }); },
    },
  };
  // carta que tira uma peça da casa: a Torre que sai de casa perde o roque daquele lado
  function relocate(s, f, t){
    s.board[t] = s.board[f]; s.board[f] = null;
    for (const [sqi, q] of [[119, 'K'], [112, 'Q'], [7, 'k'], [0, 'q']]) if (f === sqi || t === sqi) s.castle = s.castle.replace(q, '');
    if (s.ep === t) s.ep = -1;
  }
  // casas a até 2 passos em linha reta, livres, sem deixar o próprio Rei em xeque
  function stepDest(s, c, f){
    const out = [];
    for (const d of DK){
      let t = f;
      for (let k = 0; k < 2; k++){
        t += d;
        if (!onB(t) || s.board[t] || blocked(s, t)) break;
        const p = s.board[f]; s.board[t] = p; s.board[f] = null;
        const ok = !inCheck(s, c);
        s.board[f] = p; s.board[t] = null;
        if (ok) out.push(t);
      }
    }
    return out;
  }
  const implemented = id => !!FX[id];

  /* ---- ações ---- */
  function create(o = {}, decks){
    if (typeof o === 'number') o = { seed:o, decks };
    const s = { v:1, rng:(o.seed >>> 0) || 1, nextId:0, board:null, turn:'w', castle:'KQkq', ep:-1, half:0, full:1, hist:[], keys:{}, over:null,
      arc:{ ess:{ w:0, b:0 }, hand:{ w:[], b:[] }, deck:{ w:[], b:[] }, discard:{ w:[], b:[] }, turns:{ w:0, b:0 }, runes:{}, phase:'move', cardSide:null, played:false,
        fx:[], traps:[], blocked:{}, lim:{ summon:{ w:0, b:0 }, sacr:{ w:0, b:0 }, legend:{ w:0, b:0 }, phoenix:{ w:0, b:0 } }, uid:0, decks:{ w:'tempestade', b:'cinzas' },
        // opções de efeito: Oráculo 'garantido' (a IA se compromete com o lance revelado) ou 'previsto' (o melhor lance que o motor prevê, contra humanos)
        opts:{ oracle:o.oracle || 'previsto' } } };
    loadFen(s, o.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    for (const c of ['w', 'b']){
      const dn = (o.decks && o.decks[c]) || s.arc.decks[c], list = Array.isArray(dn) ? dn : (DECKS[dn] || DECKS.tempestade).cartas;
      s.arc.decks[c] = Array.isArray(dn) ? 'custom' : DECKS[dn] ? dn : 'tempestade';
      s.arc.deck[c] = shuffle(s, list.filter(id => CARD[id]).map(id => newCard(s, id)));
      const ev = [];
      draw(s, c, HAND_START, 'inicio', ev);
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
  function applyMove(s0, mv){
    if (s0.over) return { ok:false, err:'A partida terminou.' };
    if (s0.arc.phase !== 'move') return { ok:false, err:'Agora é a fase de cartas.' };
    const all = legalRaw(s0, s0.turn), f = fromS(mv.from), t = fromS(mv.to);
    const m = all.find(x => x.f === f && x.t === t && (x.pr || '') === ((mv.promotion || (x.pr ? 'q' : '')) || ''));
    if (!m) return { ok:false, err:'Lance ilegal.' };
    const s = clone(s0), ev = [], c = s.turn;
    const v = verbose(s, m, all);
    const cap = m.fl === 'e' ? s.board[m.t + (c === 'w' ? 16 : -16)] : s.board[m.t];
    makeBoard(s, m);
    s.half = cap || s.board[m.t].t === 'p' || m.pr ? 0 : s.half + 1;
    if (c === 'b') s.full++;
    s.turn = other(c);
    s.hist.push(v);
    // espólio: +2 essência e o artefato da peça tomada
    if (cap){
      gainEss(s, c, 2, 'espolio', ev);
      if (LOOT[cap.t] && CARD[LOOT[cap.t]]) giveCard(s, c, newCard(s, LOOT[cap.t]), 'espolio', ev);
      ev.push({ k:'loot', side:c, piece:cap.t });
    }
    // promoção: uma carta rara
    if (m.pr && RARE.length){ giveCard(s, c, newCard(s, RARE[Math.floor(rnd(s) * RARE.length)]), 'promocao', ev); }
    s.arc.phase = 'cards'; s.arc.cardSide = c; s.arc.played = false;
    // mate no lance encerra na hora; afogamento e empates esperam o fim do turno (uma carta pode mudar a posição)
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
    const r = FX[card.id].targets(s, c, picks);
    if (r.options && picks.length && !r.ready){ /* passo intermediário */ }
    return r;
  }
  function playCard(s0, uid, picks = []){
    const chk = cardOptions(s0, uid, []);
    if (chk.err) return { ok:false, err:chk.err };
    // confere cada escolha contra as opções válidas daquele passo
    for (let i = 0; i < picks.length; i++){
      const r = cardOptions(s0, uid, picks.slice(0, i));
      if (r.err) return { ok:false, err:r.err };
      if (r.ready || !r.options.includes(picks[i])) return { ok:false, err:'Alvo inválido.' };
    }
    const fin = cardOptions(s0, uid, picks);
    if (!fin.ready) return { ok:false, err:fin.err || 'Faltam alvos.' };
    const s = clone(s0), ev = [], c = s.arc.cardSide;
    const idx = s.arc.hand[c].findIndex(x => x.uid === uid), card = s.arc.hand[c][idx], def = CARD[card.id];
    s.arc.hand[c].splice(idx, 1);
    s.arc.ess[c] -= def.custo;
    ev.push({ k:'card', side:c, card, picks:picks.slice(), cost:def.custo });
    FX[card.id].apply(s, c, picks, ev);
    s.arc.discard[c].push(card);
    s.arc.played = true;
    // a carta não pode deixar o próprio Rei em xeque (os alvos já filtram; aqui é a última garantia)
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
    // casas de runa: terminar o turno numa delas dá 1 carta (uma vez por casa por partida)
    for (const q of RUNES){
      const p = s.board[fromS(q)];
      if (p && p.c === c && !s.arc.runes[q]){ s.arc.runes[q] = c; ev.push({ k:'rune', side:c, sq:q }); draw(s, c, 1, 'runa', ev); }
    }
    if (s.arc.turns[c] % 2 === 0) draw(s, c, 1, 'turno', ev);
    // contadores de relíquias e transmutações do lado que terminou (Fase D)
    for (const p of s.board) if (p && p.c === c && p.fx && p.fx.length){ for (const fx of p.fx) if (fx.turns != null) fx.turns--; p.fx = p.fx.filter(fx => fx.turns == null || fx.turns > 0); }
    s.arc.phase = 'move'; s.arc.cardSide = null; s.arc.played = false;
    const key = posKey(s);
    s.keys[key] = (s.keys[key] || 0) + 1;
    const st = status(s);
    if (st.over){ s.over = st.over; s.arc.phase = 'over'; ev.push({ k:'over', over:s.over }); return { ok:true, state:s, events:ev }; }
    gainEss(s, s.turn, 1, 'inicio', ev);
    ev.push({ k:'turn', side:s.turn });
    return { ok:true, state:s, events:ev };
  }
  // quem age agora (lance ou cartas) e a lista de ações válidas dele: { type:'move'|'card'|'end', ... }
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
      cardPicks(s, card.uid, [], combos, o.cap || 64);
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
  // vista para um jogador: esconde a mão e a ordem do grimório do rival (para o futuro modo online)
  function viewFor(s, c){
    const v = clone(s), o = other(c);
    v.arc.hand[o] = v.arc.hand[o].map(() => ({ uid:'?', id:'?' }));
    v.arc.deck = { w:v.arc.deck.w.length, b:v.arc.deck.b.length };
    v.arc.traps = v.arc.traps.filter(t => t.side === c);
    v.rng = 0;
    return v;
  }
  const board8 = s => { const out = []; for (let r = 0; r < 8; r++){ const row = []; for (let c = 0; c < 8; c++){ const p = s.board[r * 16 + c]; row.push(p ? { type:p.t, color:p.c } : null); } out.push(row); } return out; };
  const perft = (s, d) => { if (!d) return 1; let n = 0; for (const m of legalRaw(s, s.turn)){ const u = makeBoard(s, m), t = s.turn; s.turn = other(t); n += perft(s, d - 1); s.turn = t; unmakeBoard(s, u); } return n; };
  return { create, legalMoves, legalActions, apply, actor, applyMove, cardOptions, playCard, endTurn, status, fen, viewFor, board8, perft:(fenStr, d) => { const s = { nextId:0, arc:{ blocked:{} } }; loadFen(s, fenStr); return perft(s, d); },
    implemented, DECKS, RUNES, LOOT, ESS_MAX, HAND_MAX, MOVE_MODS, FX, card:id => CARD[id], other };
};
/* ---------- fim do motor do Arcano ---------- */

// Node/Workers: const arcanoRules = require("./arcano-rules.js"); const ARC = arcanoRules(require("../data/cartas.json").cartas);
if (typeof module !== "undefined" && module.exports) module.exports = arcanoRules;
