/* Arcane Chess — mapa da Conquista dos Mundos.
   Só leitura: usa window.ACCampanha (campanha.js) para ler o progresso deste navegador e,
   com sessão aberta, o da conta. O Guardião anda pela rota (SVG) entre os mundos abertos;
   o painel mostra o mundo onde ele está. O jogo só aceita #modo=campanha, então toda
   entrada abre a campanha (o mapa de fases do jogo escolhe a fase). */
(() => {
  'use strict';
  const AC = window.AC, C = window.ACCampanha;
  const q = (s, r) => (r || document).querySelector(s);
  const qq = (s, r) => Array.from((r || document).querySelectorAll(s));
  const world = q('[data-mapa-world]'), viewport = q('[data-mapa-viewport]');
  if (!AC || !C || !world || !viewport) return;

  /* Textos dos mundos e das fases: os mesmos do jogo (CAMP_MUNDOS e CAMP_FASES). */
  const MUNDOS = [
    { nome: 'Reino da Aurora', chefe: 'O Arcanjo', regra: 'Xadrez puro, sem cartas: o Arcanjo testa o Guardião.',
      selo: 'As primeiras páginas do Livro da Vida', hist: 'O Arcanjo desce num pilar de luz para testar o último Guardião acordado.' },
    { nome: 'Clã dos Primatas', chefe: 'O ídolo gorila', regra: 'O rival esconde Armadilhas de Espinhos.',
      selo: 'Selo da Selva Primal', hist: 'O Selo caiu no alto do templo e despertou o ídolo gorila de pedra.' },
    { nome: 'Clã do Mar Profundo', chefe: 'O Kraken', regra: 'O rival abre Portais de Runa: a correnteza.',
      selo: 'Selo das Marés Abissais', hist: 'A onda da Queda trouxe o Kraken, que guarda o Selo na Cidade Afundada.' },
    { nome: 'Império do Deserto Subterrâneo', chefe: 'O Verme-Colosso', regra: 'O rival abre Fossos de Lava: a areia movediça.',
      selo: 'Selo das Dunas Ancestrais', hist: 'O Verme-Colosso engoliu o Selo e o carrega sob as dunas.' },
    { nome: 'Alpha da Lua Nova', chefe: 'O Lobisomem', regra: 'A Névoa Fria cai sobre o tabuleiro.',
      selo: 'Selo da Lua Partida', hist: 'O Selo caiu com o pedaço da lua; sob a lua partida, o Alpha vira lobisomem e não volta.' },
    { nome: 'Legião do Ferro Negro', chefe: 'O Deus da Morte', regra: 'O rival ergue Recrutas do Cemitério.',
      selo: 'Selo da Necrópole', hist: 'A Legião usou o Selo para erguer o Dragão de Ossos, os restos do ancestral dos dragões.' },
    { nome: 'Reino dos Dragões', chefe: 'O Dragão Gigante', regra: 'Repercussão de Impacto em toda captura do rival.',
      selo: 'Selo do Fogo Dracônico', hist: 'O Dragão Gigante só entrega o fogo a quem o vencer.' },
    { nome: 'Abismo Estelar', chefe: 'A Rainha-Mãe', regra: 'As regras dos seis mundos anteriores, misturadas.',
      selo: 'O Último Selo: o Livro da Vida inteiro', hist: 'A Rainha-Mãe guarda o último Selo no coração da câmara de ovos.' }
  ];
  const FASES = [
    { nome: 'Batalha', desc: 'Partida contra o exército do mundo.' },
    { nome: 'Problema', desc: 'Dê o xeque-mate a partir de uma posição pronta.' },
    { nome: 'A regra do mundo', desc: 'Partida com a regra deste mundo ativa.' },
    { nome: 'Sobrevivência', desc: 'Aguente 20 lances com menos peças (ou vença antes).' },
    { nome: 'Batalha difícil', desc: 'A regra do mundo e o grimório do rival completo.' },
    { nome: 'Chefão', desc: 'O soberano do mundo, com o Selo escondido numa peça maior.' }
  ];
  const N = MUNDOS.length, POR_MUNDO = FASES.length * 3;
  const ROTULO = { atual: 'Mundo atual', aberto: 'Aberto', concluido: 'Selo conquistado', bloqueado: 'Bloqueado' };
  const CHAVE = 'arcane-chess:mapa', VB_W = 1800, VB_H = 900;

  const quadro = q('.mapa-quadro'), guardiao = q('[data-guardiao]'), painel = q('[data-painel]');
  const aviso = q('[data-mapa-aviso]'), alternar = q('[data-p-alternar]');
  const nos = qq('.no', world).sort((a, b) => a.dataset.mundo - b.dataset.mundo);
  const pontos = nos.map(b => { const li = b.closest('.mapa-nos__item'); return { x: +li.dataset.x, y: +li.dataset.y }; });
  const segs = []; for (let i = 1; i < N; i++) segs.push(document.getElementById('rota-seg-' + i));
  if (nos.length !== N || !quadro || !guardiao || !painel || segs.some(s => !s)) return;
  // barra numerada e etiqueta de destino são opcionais: sem elas o mapa segue funcionando
  const barraNav = q('.mapa-barra'), barraLista = q('[data-barra-lista]');
  const barra = qq('[data-barra]').sort((a, b) => a.dataset.barra - b.dataset.barra);
  const etiqueta = q('[data-destino]'), agulha = q('[data-destino-agulha]');
  const estreito = window.matchMedia('(max-width: 920px)');
  const semMovimento = () => (AC.reduceMotion ? AC.reduceMotion() : window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const txt = (el, v) => { if (el) el.textContent = v; };
  const esc = AC.esc || (s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'));
  const urlJogo = () => AC.gameUrl('campanha');

  let fases = {}, R = null, naConta = false;   // progresso pintado
  let pos = 0, alvo = 0;                       // mundo onde o Guardião está / para onde vai
  let andando = false, pendente = 0, interagiu = false, arrastou = false;
  let rotasVistas = -1;                        // trechos acesos já vistos (-1: ainda não conferido nesta visita)
  let giro = 0;                                // ângulo acumulado da agulha da bússola
  let rodaAc = 0, rodaT = 0, rodaLivre = 0, rodaAviso = 0;   // rolagem que vira viagem

  /* ---------- posição guardada ---------- */
  function lerPos(){
    try { const o = JSON.parse(localStorage.getItem(CHAVE)); if (o && o.mundo >= 1 && o.mundo <= N) return o; } catch (e){}
    return null;
  }
  // o mesmo objeto guarda { mundo, atual, rotas }: cada gravação preserva os outros campos
  function lerMapa(){
    try { const o = JSON.parse(localStorage.getItem(CHAVE)); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (e){}
    return {};
  }
  function gravarMapa(campos){
    try { localStorage.setItem(CHAVE, JSON.stringify(Object.assign(lerMapa(), campos))); } catch (e){}
  }
  function salvarPos(){ gravarMapa({ mundo: pos, atual: R.atual || N }); }

  /* ---------- pintura: placar, nós, ilhas, rotas ---------- */
  function rotuloNo(m){
    const estado = m.estado === 'concluido' ? 'concluído' : m.estado === 'bloqueado' ? 'bloqueado'
      : m.estado === 'atual' ? 'aberto, mundo atual' : 'aberto';
    return 'Mundo ' + m.n + ': ' + MUNDOS[m.n - 1].nome + ', ' + m.estrelas + ' de ' + POR_MUNDO + ' estrelas, ' + estado;
  }

  function pintar(f, conta){
    fases = f || {}; naConta = !!conta; R = C.resumo(fases);
    txt(q('[data-mapa-total]'), R.total + '/' + R.max);
    txt(q('[data-mapa-selos]'), R.selos + '/' + N);
    txt(q('[data-mapa-fonte]'), naConta ? 'Progresso salvo na sua conta.'
      : R.temProgresso ? 'Progresso salvo neste navegador.'
      : 'Sua conquista ainda não começou. O progresso fica salvo neste navegador.');
    for (const m of R.mundos){
      const b = nos[m.n - 1];
      b.dataset.estado = m.estado;
      b.setAttribute('aria-label', rotuloNo(m));
      if (m.aberto) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
      txt(q('[data-no-estrelas]', b), m.estrelas + '/' + POR_MUNDO);
      const ilha = document.getElementById('ilha-' + m.n), nevoa = document.getElementById('nevoa-' + m.n);
      if (ilha) ilha.dataset.estado = m.estado;
      if (nevoa) nevoa.dataset.ativa = m.aberto ? 'false' : 'true';
    }
    // o trecho i liga o mundo i ao i+1: fica aceso quando o mundo de chegada está aberto
    // estado: conquistada (origem concluída, chegada já aberta), frente (chegada é o mundo atual) ou fechada
    segs.forEach((s, i) => {
      const o = R.mundos[i], d = R.mundos[i + 1];
      s.dataset.aberta = d.aberto ? 'true' : 'false';
      s.dataset.estado = !o.concluido ? 'fechada' : d.estado === 'atual' ? 'frente' : d.aberto ? 'conquistada' : 'fechada';
    });
    pintarBarra();
    conferirRotas();
    pintarDestino();
    if (pos) pintarPainel();
  }

  /* ---------- rota que se acende a cada Selo ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // traço cheio por cima do trecho, desenhado da origem à chegada; some ao terminar e deixa o pontilhado aceso
  function acender(seg, atraso){
    const luz = document.createElementNS(SVG_NS, 'path');
    luz.setAttribute('d', seg.getAttribute('d'));
    luz.setAttribute('pathLength', '1');
    luz.setAttribute('class', 'rota-acende');
    luz.style.animationDelay = atraso + 'ms';
    seg.classList.add('rota-seg--acendendo');
    seg.after(luz);
    let feito = false;
    const fim = () => {
      if (feito) return; feito = true;
      seg.classList.remove('rota-seg--acendendo');
      luz.classList.add('rota-acende--some');
      setTimeout(() => luz.remove(), 500);
    };
    luz.addEventListener('animationend', fim);
    setTimeout(fim, atraso + 1600);   // garantia, caso a animação não dispare
  }
  // uma vez por Selo novo: compara os trechos acesos com os que a pessoa já viu
  function conferirRotas(){
    const acesos = [];
    segs.forEach((s, i) => { if (s.dataset.estado !== 'fechada') acesos.push(i); });
    const agora = acesos.length, salvo = lerMapa().rotas;
    const vistas = (Number.isInteger(salvo) && salvo >= 0) ? salvo : Math.max(0, rotasVistas);
    if (agora === vistas && rotasVistas === agora) return;
    if (agora > vistas){
      const novos = acesos.slice(vistas);
      if (!semMovimento()) novos.forEach((i, k) => acender(segs[i], k * 350));
      const msg = 'Rota aberta até ' + MUNDOS[novos[novos.length - 1] + 1].nome + '.';
      setTimeout(() => txt(aviso, msg), 300);
    }
    rotasVistas = agora;
    if (salvo !== agora) gravarMapa({ rotas: agora });
  }

  /* ---------- barra numerada 01–08 ---------- */
  function pintarBarra(){
    barra.forEach((b, i) => {
      const m = R.mundos[i]; if (!m) return;
      b.dataset.estado = m.estado;
      if (m.aberto) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
    });
  }

  /* ---------- etiqueta de destino: a agulha aponta para o próximo mundo aberto (ou para onde o Guardião vai) ---------- */
  function pintarDestino(){
    if (!etiqueta || !R) return;
    const indo = andando ? (pendente || alvo) : 0, d = indo || R.atual, completa = !d, de = pos || 1;
    const aqui = completa || (d === de && !andando);
    etiqueta.dataset.completa = completa ? 'true' : 'false';
    etiqueta.dataset.aqui = aqui ? 'true' : 'false';
    txt(q('[data-destino-rotulo]', etiqueta), completa ? 'Jornada completa' : 'Destino');
    txt(q('[data-destino-nome]', etiqueta), completa ? '' : MUNDOS[d - 1].nome);
    if (!agulha) return;
    let ang = 0;   // já no destino (ou jornada completa): agulha em repouso, para cima
    if (!aqui && d !== de){ const a = pontos[de - 1], b = pontos[d - 1]; ang = Math.atan2(b.x - a.x, a.y - b.y) * 180 / Math.PI; }
    giro += ((ang - giro) % 360 + 540) % 360 - 180;   // gira pelo caminho mais curto
    agulha.style.setProperty('--giro', giro.toFixed(1) + 'deg');
  }

  /* ---------- painel do mundo onde o Guardião está ---------- */
  function estrelasHTML(st){
    const n = st.filter(Boolean).length;
    let h = '<span class="fase__estrelas" role="img" aria-label="' + n + ' de 3 estrelas">';
    for (let i = 0; i < 3; i++) h += '<svg' + (st[i] ? ' class="is-cheia"' : '') + ' aria-hidden="true" focusable="false"><use href="#i-estrela"/></svg>';
    return h + '</span>';
  }

  function pintarPainel(){
    const m = R.mundos[pos - 1], d = MUNDOS[pos - 1];
    painel.dataset.estado = m.estado;
    txt(q('[data-p-num]', painel), 'Mundo ' + pos + ' de ' + N);
    txt(q('[data-p-nome]', painel), d.nome);
    txt(q('[data-p-estado]', painel), ROTULO[m.estado] || '');
    txt(q('[data-p-estrelas]', painel), m.estrelas + '/' + POR_MUNDO);
    const barra = q('[data-p-barra]', painel); if (barra) barra.style.width = (m.estrelas / POR_MUNDO * 100).toFixed(1) + '%';
    txt(q('[data-p-hist]', painel), d.hist);
    txt(q('[data-p-regra]', painel), d.regra);
    txt(q('[data-p-chefe]', painel), d.chefe);
    txt(q('[data-p-selo]', painel), d.selo);

    const cta = q('[data-p-cta]', painel);
    if (cta){
      cta.href = urlJogo();
      cta.textContent = m.concluido ? 'Rejogar' : (m.estado === 'atual' && R.temProgresso) ? 'Continuar' : 'Entrar no mundo';
    }

    // fases: vencidas mostram as estrelas; a primeira não vencida é a próxima; as seguintes ficam trancadas
    const lista = q('[data-p-fases]', painel);
    if (lista){
      let h = '', achouProxima = false;
      FASES.forEach((fase, i) => {
        const st = fases[pos + '-' + (i + 1)] || [0, 0, 0], vencida = !!st[0];
        let estado = 'bloqueada';
        if (vencida) estado = 'vencida';
        else if (m.aberto && !achouProxima){ estado = 'proxima'; achouProxima = true; }
        h += '<li class="fase" data-estado="' + estado + '"><span class="fase__n" aria-hidden="true">' + (i + 1) + '</span>'
          + '<span class="fase__nome"><span class="sr-only">Fase ' + (i + 1) + ': </span>' + esc(fase.nome)
          + (estado === 'proxima' ? '<span class="sr-only"> (próxima)</span>' : '') + '</span>'
          + (estado === 'bloqueada'
            ? '<span class="fase__trava"><svg aria-hidden="true" focusable="false"><use href="#i-cadeado"/></svg>Bloqueada</span>'
            : estrelasHTML(st))
          + '<p class="fase__desc">' + esc(fase.desc) + '</p></li>';
      });
      lista.innerHTML = h;
    }
    medirFolha();
  }

  /* folha de baixo (telas estreitas): a altura fechada vira --folha-h para o rodapé e o aviso não ficarem cobertos */
  function medirFolha(){
    const s = document.body.style;
    if (!estreito.matches){ s.removeProperty('--folha-h'); return; }
    if (!painel.classList.contains('is-aberto')) s.setProperty('--folha-h', painel.offsetHeight + 'px');
  }
  function alternarFolha(abrir){
    const aberto = painel.classList.toggle('is-aberto', abrir);
    if (alternar){ alternar.setAttribute('aria-expanded', aberto ? 'true' : 'false'); alternar.textContent = aberto ? 'Ocultar fases' : 'Ver fases'; }
    if (!aberto) medirFolha();
  }

  /* ---------- Guardião: posição e caminhada ---------- */
  const escala = () => ({ sx: world.offsetWidth / VB_W, sy: world.offsetHeight / VB_H });
  // em repouso o pino fica de pé na borda de cima do medalhão
  const repouso = () => { const d = q('.no__disco', nos[0]); return Math.max(0, (d ? d.offsetWidth : 96) / 2 - 6); };
  const suave = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function por(x, y){ guardiao.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-100%)'; }
  function centrar(x, comAnimacao){
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const left = Math.min(max, Math.max(0, x - viewport.clientWidth / 2));
    if (comAnimacao && !semMovimento() && viewport.scrollTo) viewport.scrollTo({ left, behavior: 'smooth' });
    else viewport.scrollLeft = left;
  }
  function colocar(n, centrarMapa){
    const p = pontos[n - 1], e = escala(), x = p.x * e.sx;
    por(x, p.y * e.sy - repouso());
    guardiao.hidden = false;
    if (centrarMapa) centrar(x, false);
  }
  function marcarAtual(){
    const marca = (b, i) => { if (i === pos - 1) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); };
    nos.forEach(marca); barra.forEach(marca);
    // a barra rola sozinha (nunca a página) até mostrar o mundo do Guardião
    const b = barra[pos - 1];
    if (b && barraLista && barraLista.scrollWidth > barraLista.clientWidth){
      const left = Math.max(0, b.offsetLeft - (barraLista.clientWidth - b.offsetWidth) / 2);
      if (barraLista.scrollTo) barraLista.scrollTo({ left, behavior: semMovimento() ? 'auto' : 'smooth' });
      else barraLista.scrollLeft = left;
    }
  }
  function chegou(anunciar){
    alvo = pos; marcarAtual(); pintarPainel(); salvarPos();
    rodaLivre = performance.now() + 500;   // a rolagem só volta a mover depois de um respiro
    pintarDestino();
    if (anunciar) txt(aviso, 'Guardião em Mundo ' + pos + ': ' + MUNDOS[pos - 1].nome + '.');
  }

  let arrasto = null;   // arrasto do mapa com o mouse (toque usa a rolagem nativa)

  /* anda trecho a trecho pela rota, passando pelos mundos do caminho */
  function andar(destino){
    if (!(destino >= 1 && destino <= N)) return;
    if (andando){ pendente = destino; pintarDestino(); return; }
    if (destino === pos) return;
    if (semMovimento()){ pos = destino; colocar(pos, true); chegou(true); return; }
    andando = true; alvo = destino; guardiao.classList.add('is-andando');
    pintarDestino();
    const saltos = Math.abs(destino - pos);
    const dur = saltos >= 4 ? 500 : saltos === 3 ? 540 : saltos === 2 ? 590 : 640;
    const alto = repouso();
    let de = pos;
    const trecho = () => {
      const dir = alvo > de ? 1 : -1, para = de + dir;
      const seg = segs[Math.min(de, para) - 1], L = seg.getTotalLength(), volta = dir < 0;
      let t0 = 0;
      const passo = agora => {
        if (!t0) t0 = agora;
        const t = Math.min(1, (agora - t0) / dur), e = suave(t);
        const pt = seg.getPointAtLength(volta ? L * (1 - e) : L * e), es = escala();
        const c = Math.cos(Math.PI * e);
        const sobe = alto * c * c;                                                   // desce do medalhão para a trilha e sobe no próximo
        const pisada = Math.abs(Math.sin(e * Math.PI * 5)) * 4 * Math.sin(Math.PI * e); // balanço de passos
        const x = pt.x * es.sx;
        por(x, pt.y * es.sy - sobe - pisada);
        if (!arrasto) centrar(x, false);
        if (t < 1){ requestAnimationFrame(passo); return; }
        de = para; pos = de;
        if (pendente){ alvo = pendente; pendente = 0; }
        if (de !== alvo){ pintarDestino(); trecho(); return; }
        andando = false; guardiao.classList.remove('is-andando');
        colocar(pos, false); chegou(true);
      };
      requestAnimationFrame(passo);
    };
    trecho();
  }

  function bloqueado(n){
    const b = nos[n - 1];
    b.classList.remove('no--tremor'); void b.offsetWidth; b.classList.add('no--tremor');
    clearTimeout(b._tremor); b._tremor = setTimeout(() => b.classList.remove('no--tremor'), 500);
    const msg = 'Conquiste ' + MUNDOS[n - 2].nome + ' para abrir este caminho.';
    if (AC.toast) AC.toast(msg); else txt(aviso, msg);
  }
  const aberto = n => !!(R && R.mundos[n - 1] && R.mundos[n - 1].aberto);

  /* ---------- clique / toque ---------- */
  world.addEventListener('click', ev => {
    const b = ev.target.closest('.no');
    if (!b || arrastou) return;
    const n = +b.dataset.mundo;
    interagiu = true;
    if (!aberto(n)){ bloqueado(n); return; }
    if (n === pos && !andando){ window.location.href = urlJogo(); return; }
    andar(n);
  });

  /* ---------- barra numerada: clicar leva o Guardião até o mundo, trecho a trecho ---------- */
  if (barraNav) barraNav.addEventListener('click', ev => {
    const b = ev.target.closest('[data-barra]');
    if (!b) return;
    const n = +b.dataset.barra;
    if (!(n >= 1 && n <= N)) return;
    interagiu = true;
    if (!aberto(n)){ bloqueado(n); return; }
    if (n === pos && !andando){ centrar(pontos[n - 1].x * escala().sx, true); return; }   // já está lá: só recentra o mapa
    andar(n);
  });

  /* ---------- rolagem vira viagem: um mundo por gesto ---------- */
  quadro.addEventListener('wheel', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;        // zoom do navegador e rolagem lateral ficam como são
    if (Math.abs(ev.deltaX) >= Math.abs(ev.deltaY)) return;     // gesto horizontal: rolagem nativa do mapa
    const agora = performance.now();
    if (andando || agora < rodaLivre){ ev.preventDefault(); rodaAc = 0; return; }   // trava enquanto anda e ~500 ms depois
    const dy = ev.deltaY * (ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 400 : 1);
    if (!dy || !pos) return;
    const n = pos + (dy > 0 ? 1 : -1);
    if (n < 1 || n > N){ rodaAc = 0; return; }                  // pontas do mapa: a página rola normalmente
    if (agora - rodaT > 250 || (rodaAc && (rodaAc > 0) !== (dy > 0))) rodaAc = 0;
    rodaT = agora; rodaAc += dy;
    const cheio = Math.abs(rodaAc) >= 50;                       // limiar: trackpads mandam muitos deltas pequenos
    if (!aberto(n)){
      // mundo bloqueado: mesmo aviso do clique (sem repetir a cada giro) e a página segue rolando
      if (cheio){ rodaAc = 0; if (agora > rodaAviso){ rodaAviso = agora + 4000; bloqueado(n); } }
      return;
    }
    ev.preventDefault();
    if (!cheio) return;
    rodaAc = 0; interagiu = true;
    andar(n);
  }, { passive: false });

  /* ---------- teclado: setas andam um mundo; Enter/Espaço entra ---------- */
  quadro.addEventListener('keydown', ev => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const k = ev.key;
    const d = (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : 0;
    if (d){
      const n = (andando ? (pendente || alvo) : pos) + d;
      if (n < 1 || n > N) return;
      ev.preventDefault(); interagiu = true;
      if (!aberto(n)){ bloqueado(n); return; }
      andar(n);
      nos[n - 1].focus({ preventScroll: true });
      return;
    }
    if ((k === 'Enter' || k === ' ') && !ev.target.closest('button, a')){
      ev.preventDefault(); if (!andando) window.location.href = urlJogo();
    }
  });

  /* ---------- arrastar o mapa com o mouse ---------- */
  viewport.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    arrasto = { x: ev.clientX, s: viewport.scrollLeft, on: false };
  });
  window.addEventListener('pointermove', ev => {
    if (!arrasto) return;
    const dx = ev.clientX - arrasto.x;
    if (!arrasto.on){ if (Math.abs(dx) < 5) return; arrasto.on = true; viewport.classList.add('is-arrastando'); }
    viewport.scrollLeft = arrasto.s - dx;
  });
  const soltar = () => {
    if (!arrasto) return;
    if (arrasto.on){ arrastou = true; viewport.classList.remove('is-arrastando'); setTimeout(() => { arrastou = false; }, 0); }
    arrasto = null;
  };
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
  viewport.addEventListener('click', ev => { if (arrastou){ ev.preventDefault(); ev.stopPropagation(); } }, true);
  viewport.addEventListener('dragstart', ev => ev.preventDefault());

  /* ---------- folha de fases (telas estreitas) ---------- */
  if (alternar) alternar.addEventListener('click', () => alternarFolha());
  const aoMudarLargura = () => { if (!estreito.matches) alternarFolha(false); medirFolha(); };
  if (estreito.addEventListener) estreito.addEventListener('change', aoMudarLargura); else if (estreito.addListener) estreito.addListener(aoMudarLargura);

  /* ---------- início ---------- */
  pintar(C.lerLocal(), false);
  const atualInicial = R.atual || N, salvo = lerPos();
  const ini = (salvo && aberto(salvo.mundo)) ? salvo.mundo : atualInicial;
  pos = alvo = ini;
  colocar(pos, true); chegou(false);
  // o progresso avançou desde a última visita: o Guardião caminha até o novo mundo atual
  if (salvo && ini !== atualInicial && salvo.atual !== atualInicial) setTimeout(() => { if (!interagiu) andar(R.atual || N); }, 600);

  if ('ResizeObserver' in window) new ResizeObserver(() => { if (!andando && pos) colocar(pos, false); medirFolha(); }).observe(world);
  else window.addEventListener('resize', () => { if (!andando && pos) colocar(pos, false); medirFolha(); });

  /* progresso da conta (com sessão aberta): funde com o deste navegador, como faz o mapa do jogo */
  try {
    Promise.resolve(C.lerConta()).then(conta => {
      if (!conta) return;
      const antes = R.atual || N;
      pintar(C.fundir(C.lerLocal(), conta), true);
      const agora = R.atual || N;
      if (!aberto(pos)){ pos = alvo = agora; colocar(pos, true); chegou(false); }
      else if (agora !== antes && !interagiu) andar(agora);
    }).catch(() => {});
  } catch (e){}

  /* voltou do jogo (outra aba, histórico): repinta com o que estiver salvo */
  function repintar(){
    const local = C.lerLocal(), antes = R.atual || N;
    pintar(naConta ? C.fundir(fases, local) : local, naConta);
    const agora = R.atual || N;
    if (!aberto(pos) && !andando){ pos = alvo = agora; colocar(pos, true); chegou(false); }
    else if (agora !== antes && pos === antes && !andando) andar(agora);
  }
  window.addEventListener('storage', ev => { if (!ev.key || ev.key === C.KEY) repintar(); });
  window.addEventListener('pageshow', ev => { if (ev.persisted) repintar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') repintar(); });
})();
