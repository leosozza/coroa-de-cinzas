/* Arcane Chess — site: configuração, API, sessão, menu, link do jogo e componentes comuns.
   Sem dependências. Exposto em window.AC para as páginas (ranking, login) e para o hero. */
(function(){
  'use strict';
  document.documentElement.classList.remove('no-js');

  /* ---------- caminhos (mudar aqui na integração) ----------
     - Dentro de /site/ (teste local): o jogo está em ../coroa-de-cinzas.html.
     - No Pages, com as páginas na raiz: /jogar.html.
     - <meta name="ac-game" content="..."> em qualquer página sobrepõe os dois. */
  const meta = n => { const m = document.querySelector(`meta[name="${n}"]`); return m ? m.content : ''; };
  const IN_SITE_FOLDER = /\/site\//.test(location.pathname);
  const GAME = meta('ac-game') || (IN_SITE_FOLDER ? '../coroa-de-cinzas.html' : '/jogar.html');
  const ASSETS = meta('ac-assets') || '../assets/';
  const DATA = meta('ac-data') || '../data/';
  const API_PROD = 'https://arcane-chess-api.leonardo-zogbi.workers.dev';
  const KEY = 'coroa-de-cinzas:online';   // mesma chave do jogo: a sessão vale nos dois

  // teste local: ?api=http://127.0.0.1:8787 (só endereços locais, como o netApi() do jogo)
  const QS = new URLSearchParams(location.search);
  function apiBase(){
    const q = QS.get('api');
    if (q && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(q)) return q;
    return API_PROD;
  }
  const API = apiBase();
  const apiParam = API !== API_PROD ? QS.get('api') : null;

  /* modos que o jogo deve abrir direto (ver INTEGRACAO.md): '' | arcano | online | espectador */
  function gameUrl(mode){
    let u = GAME;
    if (apiParam) u += (u.includes('?') ? '&' : '?') + 'api=' + encodeURIComponent(apiParam);
    return u + (mode ? '#modo=' + mode : '');
  }
  // links internos do site carregam o ?api= de teste
  function siteUrl(page){ return apiParam ? page + (page.includes('?') ? '&' : '?') + 'api=' + encodeURIComponent(apiParam) : page; }

  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sessão (localStorage, igual ao jogo) ---------- */
  const session = {
    load(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e){ return {}; } },
    save(token, name){ try { localStorage.setItem(KEY, JSON.stringify({ token, name })); } catch (e){} },
    clear(){ const s = session.load(); try { localStorage.setItem(KEY, JSON.stringify({ token:null, name:s.name || null })); } catch (e){} },
    token(){ return session.load().token || null; },
  };

  /* ---------- API (o mesmo contrato do netFetch do jogo) ---------- */
  async function fetchApi(path, o = {}){
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, o.timeout || 8000);
    const token = o.token !== undefined ? o.token : session.token();
    try {
      const r = await fetch(API + path, { method:o.body ? 'POST' : 'GET', cache:'no-store', signal:ctl ? ctl.signal : undefined,
        headers:Object.assign({ 'content-type':'application/json' }, token ? { Authorization:'Bearer ' + token } : {}),
        body:o.body ? JSON.stringify(o.body) : undefined });
      const txt = await r.text();
      let j = {}; try { j = JSON.parse(txt || '{}'); } catch (e){}
      return { ok:r.ok, status:r.status, j };
    } finally { clearTimeout(t); }
  }

  // /api/me uma vez por página; ficha inválida (401) é descartada, como no jogo
  let meP = null;
  function me(force){
    if (meP && !force) return meP;
    const tok = session.token();
    if (!tok) return (meP = Promise.resolve(null));
    meP = fetchApi('/api/me').then(r => {
      if (r.ok) return r.j;
      if (r.status === 401) session.clear();
      return null;
    }).catch(() => undefined); // undefined = servidor fora (mantém o nome salvo)
    return meP;
  }

  /* ---------- ligas (o servidor manda em /api/config; estas são a reserva) ---------- */
  const LEAGUES_FALLBACK = {
    leagues:[ { id:'aprendiz', name:'Aprendiz', min:0 }, { id:'alquimista', name:'Alquimista', min:1200 }, { id:'mestre', name:'Mestre Arcano', min:1500 }, { id:'inquisidor', name:'Inquisidor da Aurora', min:1800 } ],
    grandmaster:{ id:'grao-mestre', name:'Grão-Mestre Arcano', top:500 }, provisionalRd:110,
  };
  let cfgP = null;
  function config(){
    if (!cfgP) cfgP = fetchApi('/api/config', { token:null }).then(r => r.ok && Array.isArray(r.j.leagues) ? r.j : LEAGUES_FALLBACK).catch(() => LEAGUES_FALLBACK);
    return cfgP;
  }
  // mesma regra do servidor (glicko2.js league): no topo do ranking, conta com nota firme é Grão-Mestre
  function leagueOf(cfg, r, rank){
    const gm = cfg.grandmaster;
    if (gm && rank != null && rank <= gm.top) return gm;
    let L = cfg.leagues[0];
    for (const x of cfg.leagues) if (r >= x.min) L = x;
    return L;
  }

  const LOGIN_ERR = { estado:'O login expirou ou já foi usado. Tente de novo.', cancelado:'Login cancelado.', pkce:'Falha de segurança no login (PKCE). Tente de novo.', provedor:'O provedor recusou o login. Tente de novo.' };

  /* ---------- aviso ---------- */
  function toast(msg){
    let el = $('#ac-toast');
    if (!el){ el = document.createElement('div'); el.id = 'ac-toast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4200);
  }

  /* ---------- links do jogo e do site ---------- */
  function wireLinks(){
    for (const a of $$('[data-game]')) a.href = gameUrl(a.dataset.game);
    if (apiParam) for (const a of $$('a[href$=".html"], a[href*=".html#"], a[href*=".html?"]')){
      if (a.hasAttribute('data-game') || a.dataset.wired) continue;
      a.dataset.wired = '1';
      const h = a.getAttribute('href');
      if (/^(https?:)?\/\//.test(h) || /[?&]api=/.test(h)) continue;
      const [base, hash] = h.split('#');
      a.setAttribute('href', siteUrl(base) + (hash ? '#' + hash : ''));
    }
  }

  /* ---------- menu ---------- */
  function initNav(){
    const nav = $('.nav'); if (!nav) return;
    const btn = $('.nav__toggle', nav), panel = $('.nav__panel', nav);
    const page = document.body.dataset.page;
    for (const a of $$('.nav__links a', nav)) if (a.dataset.page && a.dataset.page === page) a.setAttribute('aria-current', 'page');
    if (btn && panel){
      const set = open => {
        btn.setAttribute('aria-expanded', String(open)); panel.classList.toggle('is-open', open);
        btn.setAttribute('aria-label', open ? 'Fechar o menu' : 'Abrir o menu');
        if (open){ const f = $('a, button', panel); if (f) f.focus(); }
      };
      btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
      panel.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true'){ set(false); btn.focus(); } });
      matchMedia('(min-width: 921px)').addEventListener('change', e => { if (e.matches) set(false); });
    }
    renderAccount();
  }
  // à direita: "Entrar" ou o nome e a nota do jogador
  function renderAccount(){
    const box = $('.nav__account'); if (!box) return;
    const s = session.load();
    const paint = (name, r, kind) => {
      if (!name){ box.innerHTML = `<a class="btn btn--sm btn--primary" href="${esc(siteUrl('login.html'))}">Entrar</a>`; return; }
      box.innerHTML = `<a class="nav__me" href="${esc(siteUrl('login.html'))}" aria-label="Sua conta: ${esc(name)}${r ? `, nota ${esc(r)}` : ''}">
        <span class="nav__me-sigil" aria-hidden="true">${esc(name.trim().charAt(0).toUpperCase() || '?')}</span>
        <span class="nav__me-txt"><span class="nav__me-name">${esc(name)}</span><span class="nav__me-r">${r ? `Nota <b>${esc(r)}</b>` : kind === 'guest' ? 'Convidado' : 'Conectado'}</span></span></a>`;
    };
    paint(s.token ? s.name : null);
    if (!s.token) return;
    me().then(d => {
      if (d === undefined) return;               // servidor fora: fica o nome salvo
      if (!d){ paint(null); return; }
      const R = d.ratings || {}, best = [R.xadrez, R.arcano].filter(Boolean).sort((a, b) => (b.games || 0) - (a.games || 0))[0];
      paint(d.user.name, best ? best.r + (best.provisional ? '?' : '') : '', d.user.kind);
    });
  }

  /* ---------- contadores animados ---------- */
  function initCounters(){
    const els = $$('[data-count]'); if (!els.length) return;
    const run = el => {
      const to = +el.dataset.count, t0 = performance.now(), dur = 1600;
      if (reduceMotion()){ el.textContent = to; return; }
      const tick = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    if (!('IntersectionObserver' in window)){ els.forEach(el => el.textContent = el.dataset.count); return; }
    const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting){ io.unobserve(e.target); run(e.target); } }, { threshold:.5 });
    els.forEach(el => { el.textContent = '0'; io.observe(el); });
  }

  /* ---------- surgimento ao rolar ---------- */
  function initReveal(){
    const els = $$('.reveal'); if (!els.length) return;
    if (reduceMotion() || !('IntersectionObserver' in window)){ els.forEach(el => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting){ io.unobserve(e.target); e.target.classList.add('is-in'); } }, { threshold:.12, rootMargin:'0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
  }

  /* ---------- carrossel horizontal (cartas) ---------- */
  function initCarousels(){
    for (const c of $$('[data-carousel]')){
      const track = $('.carousel__track', c);
      const step = () => { const it = track.firstElementChild; return it ? it.getBoundingClientRect().width + 22 : 240; };
      $$('[data-dir]', c).forEach(b => b.addEventListener('click', () => track.scrollBy({ left:step() * (+b.dataset.dir) * 2, behavior:reduceMotion() ? 'auto' : 'smooth' })));
    }
  }

  /* ---------- vitrine das cartas (data/cartas.json + assets/cards/web) ---------- */
  async function initCards(){
    const box = $('[data-cards]'); if (!box) return;
    const track = $('.carousel__track', box);
    let cat = null;
    try { const r = await fetch(DATA + 'cartas.json'); if (r.ok) cat = await r.json(); } catch (e){}
    if (!cat || !Array.isArray(cat.cartas)){ track.innerHTML = '<p class="note">O catálogo das cartas não carregou.</p>'; return; }
    const tipoNome = id => (cat.tipos && cat.tipos[id] ? cat.tipos[id].split('—')[0].trim() : id);
    // as que existem uma vez só no catálogo; a ordem do catálogo segue os grimórios
    track.innerHTML = cat.cartas.map(c => `<figure class="card-tile">
        <div class="card-tile__art"><img src="${ASSETS}cards/web/${esc(c.id)}.jpg" alt="Arte da carta ${esc(c.nome)}" loading="lazy" decoding="async" width="382" height="512"></div>
        <span class="card-tile__cost" title="Custo em essência"><b>${esc(c.custo)}</b><span class="sr-only"> de essência</span></span>
        <figcaption><b>${esc(c.nome)}</b><span>${esc(tipoNome(c.tipo))}</span><p>${esc(c.efeito)}</p></figcaption></figure>`).join('');
    const n = $('[data-cards-count]'); if (n) n.textContent = cat.cartas.length;
  }

  /* ---------- prévia do ranking (top 5) ---------- */
  async function initRankPreview(){
    const box = $('[data-rank-preview]'); if (!box) return;
    const pool = box.dataset.pool || 'xadrez';
    box.innerHTML = `<div class="state" aria-busy="true"><div class="spinner" aria-hidden="true"></div><p>Consultando o grimório dos campeões…</p></div>`;
    let r = null;
    try { r = await fetchApi('/api/leaderboard?pool=' + pool, { token:null }); } catch (e){}
    if (!r || !r.ok){
      box.innerHTML = `<div class="state state--error"><h3>Servidor fora do ar</h3><p>O ranking volta assim que o servidor responder.</p><a class="link-arrow" href="${esc(siteUrl('ranking.html'))}">Abrir o ranking</a></div>`;
      return;
    }
    const top = (r.j.top || []).slice(0, 5);
    if (!top.length){ box.innerHTML = emptyRankHTML(true); wireLinks(); return; }
    const cfg = await config();
    box.innerHTML = `<ol class="rank-list">${top.map(x => { const L = leagueOf(cfg, x.r, x.rank); return `<li><span class="pos">${x.rank}</span>
      <span class="who"><b>${esc(x.name)}</b><small>${x.games} partida${x.games === 1 ? '' : 's'} ranqueada${x.games === 1 ? '' : 's'}</small></span>
      <span><span class="badge badge--${esc(L.id)}">${esc(L.name)}</span> <span class="r">${x.r}</span></span></li>`; }).join('')}</ol>`;
  }
  // estado vazio comum (prévia e página do ranking)
  function emptyRankHTML(compact){
    return `<div class="empty">
      <svg class="empty__art" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M30 92h60M36 92l-4-36 16 12 12-24 12 24 16-12-4 36" stroke-linejoin="round"/>
        <circle cx="32" cy="54" r="3"/><circle cx="60" cy="42" r="3"/><circle cx="88" cy="54" r="3"/>
        <path d="M24 100h72" opacity=".5"/><path d="M60 14v10M45 19l4 8M75 19l-4 8" opacity=".55"/>
      </svg>
      <h3>O trono ainda está vazio</h3>
      <p>Nenhum campeão firmou o nome no grimório. ${compact ? 'O primeiro lugar espera por você.' : 'Só entram contas com a nota já firme: o primeiro nome desta lista pode ser o seu.'}</p>
      ${compact ? '' : `<ol class="empty__steps">
        <li>Crie uma conta<small>Jogue como convidado agora; com Google ou Discord (em breve) a nota fica sua em qualquer aparelho.</small></li>
        <li>Jogue partidas ranqueadas<small>Na fila ranqueada do Xadrez Puro ou do Arcano, contra rivais de nota parecida.</small></li>
        <li>Firme a sua nota<small>Depois de algumas partidas a incerteza cai (Glicko-2) e o seu nome aparece aqui.</small></li>
      </ol>`}
      <div class="empty__actions"><a class="btn btn--primary" data-game="online" href="#">Jogar ranqueada</a><a class="btn" href="${esc(siteUrl('login.html'))}">Entrar</a></div>
    </div>`;
  }

  /* ---------- vozes do tabuleiro ---------- */
  function initQuotes(){
    const q = $('[data-quotes]'); if (!q) return;
    const track = $('.quotes__track', q), items = $$('.quote', q), dots = $('.quotes__dots', q);
    let i = 0, timer = 0, paused = false;
    dots.innerHTML = items.map((_, k) => `<button type="button" class="quotes__dot" aria-label="Citação ${k + 1} de ${items.length}"></button>`).join('');
    const ds = $$('.quotes__dot', dots);
    const go = k => {
      i = (k + items.length) % items.length;
      track.style.transform = `translateX(${-100 * i}%)`;
      ds.forEach((d, n) => d.setAttribute('aria-current', String(n === i)));
      items.forEach((it, n) => it.setAttribute('aria-hidden', String(n !== i)));
    };
    ds.forEach((d, n) => d.addEventListener('click', () => { go(n); restart(); }));
    const restart = () => { clearInterval(timer); if (!reduceMotion() && !paused) timer = setInterval(() => go(i + 1), 6500); };
    q.addEventListener('mouseenter', () => { paused = true; clearInterval(timer); });
    q.addEventListener('mouseleave', () => { paused = false; restart(); });
    q.addEventListener('focusin', () => { paused = true; clearInterval(timer); });
    q.addEventListener('focusout', () => { paused = false; restart(); });
    go(0); restart();
  }

  /* ---------- brasas 2D (faixa de chamada) ---------- */
  function initEmbers(){
    for (const cv of $$('canvas[data-embers]')){
      if (reduceMotion()) continue;
      const g = cv.getContext('2d'); if (!g) continue;
      const N = matchMedia('(pointer: coarse)').matches ? 40 : 90;
      let W = 0, H = 0, dpr = 1, ps = [], vis = false, raf = 0, last = 0;
      const reset = (p, born) => { p.x = Math.random() * W; p.y = born ? Math.random() * H : H + 10; p.vy = 18 + Math.random() * 50; p.vx = (Math.random() - .5) * 14; p.r = .6 + Math.random() * 1.8; p.life = 0; p.max = 3 + Math.random() * 5; p.w = Math.random() * 6.28; return p; };
      const size = () => { dpr = Math.min(1.5, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
      size(); ps = Array.from({ length:N }, () => reset({}, true));
      addEventListener('resize', size);
      const frame = t => {
        raf = 0; if (!vis) return;
        const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
        g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        for (const p of ps){
          p.life += dt; p.w += dt * 2; p.y -= p.vy * dt; p.x += (p.vx + Math.sin(p.w) * 10) * dt;
          if (p.y < -10 || p.life > p.max) reset(p);
          const a = Math.max(0, Math.min(1, p.life * 2) * (1 - p.life / p.max));
          g.fillStyle = `rgba(255,${150 + (p.r * 30 | 0)},70,${a * .9})`;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
        }
        raf = requestAnimationFrame(frame);
      };
      new IntersectionObserver(es => { vis = es[0].isIntersecting && !document.hidden; if (vis && !raf){ last = 0; raf = requestAnimationFrame(frame); } }).observe(cv);
      document.addEventListener('visibilitychange', () => { if (document.hidden) vis = false; });
    }
  }

  window.AC = { GAME, ASSETS, DATA, API, API_PROD, KEY, gameUrl, siteUrl, esc, $, $$, session, fetchApi, me, config, leagueOf, LOGIN_ERR, LEAGUES_FALLBACK, toast, emptyRankHTML, reduceMotion, wireLinks };

  // links antigos do jogo na raiz (#sala=, #login=, #login-erro=) caem aqui: repassa para o jogo
  if (document.body && document.body.dataset.page === 'home' && /^#(sala|login|login-erro)=/.test(location.hash)){ location.replace(gameUrl('') + location.hash); return; }
  function boot(){
    wireLinks(); initNav(); initCounters(); initReveal(); initCarousels(); initCards(); initRankPreview(); initQuotes(); initEmbers();
    const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
