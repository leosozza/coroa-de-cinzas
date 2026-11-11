/* Arcane Chess — progresso da Conquista dos Mundos no site (home e conta).
   Só leitura: lê o save que o jogo grava neste navegador e, com sessão aberta,
   o progresso da conta (GET /api/campanha). Este arquivo nunca grava nada.
   As regras de estrela e de abertura espelham as do jogo (campStars, campWon,
   campOpenWorld, campTotal). */
(() => {
  'use strict';

  const KEY = 'arcane-chess:campanha';
  const CHAVE_FASE = /^[1-8]-[1-6]$/;
  const N_MUNDOS = 8, N_FASES = 6, POR_MUNDO = N_FASES * 3, TOTAL = N_MUNDOS * POR_MUNDO;
  const MUNDOS = ['Reino da Aurora', 'Clã dos Primatas', 'Clã do Mar Profundo', 'Império do Deserto Subterrâneo',
    'Alpha da Lua Nova', 'Legião do Ferro Negro', 'Reino dos Dragões', 'Abismo Estelar'];

  // só chaves "mundo-fase" válidas, cada uma com três estrelas 0/1
  function limpar(fases){
    const out = {};
    if (!fases || typeof fases !== 'object') return out;
    for (const k of Object.keys(fases)){
      const a = fases[k];
      if (!CHAVE_FASE.test(k) || !Array.isArray(a)) continue;
      out[k] = [a[0] ? 1 : 0, a[1] ? 1 : 0, a[2] ? 1 : 0];
    }
    return out;
  }

  // save do navegador; qualquer falha (bloqueio de armazenamento, JSON quebrado) vira "sem progresso"
  function lerLocal(){
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object' && v.fases) return limpar(v.fases);
    } catch (e){}
    return {};
  }

  // fusão como a do jogo: estrela ganha em qualquer um dos lados fica ganha
  function fundir(a, b){
    const out = limpar(a), outro = limpar(b);
    for (const k of Object.keys(outro)){
      const x = out[k] || [0, 0, 0], y = outro[k];
      out[k] = x.map((v, i) => (v || y[i]) ? 1 : 0);
    }
    return out;
  }

  function resumo(fases){
    const f = limpar(fases);
    const estrelas = (w, p) => f[w + '-' + p] || [0, 0, 0];
    const venceu = (w, p) => !!estrelas(w, p)[0];
    const mundos = [];
    let total = 0, selos = 0, atual = 0;
    for (let w = 1; w <= N_MUNDOS; w++){
      let st = 0;
      for (let p = 1; p <= N_FASES; p++) st += estrelas(w, p).filter(Boolean).length;
      const aberto = w === 1 || venceu(w - 1, N_FASES), concluido = venceu(w, N_FASES);
      total += st; if (concluido) selos++;
      if (!atual && aberto && !concluido) atual = w;
      mundos.push({ n:w, nome:MUNDOS[w - 1], estrelas:st, aberto, concluido });
    }
    for (const m of mundos) m.estado = m.concluido ? 'concluido' : !m.aberto ? 'bloqueado' : m.n === atual ? 'atual' : 'aberto';
    return { total, max:TOTAL, selos, atual, nomeAtual:atual ? MUNDOS[atual - 1] : '', mundos, temProgresso:total > 0 };
  }

  // progresso da conta: uma tentativa por sessão aberta; sem sessão ou em qualquer falha devolve null
  let contaP = null, contaDe = null;
  function lerConta(){
    let token = null;
    try { token = window.AC && window.AC.session ? window.AC.session.token() : null; } catch (e){}
    if (contaP && contaDe === token) return contaP;
    contaDe = token;
    contaP = (async () => {
      try {
        const AC = window.AC;
        if (!token || typeof AC.fetchApi !== 'function') return null;
        const r = await AC.fetchApi('/api/campanha');
        if (r && r.ok && r.j && r.j.fases && typeof r.j.fases === 'object') return limpar(r.j.fases);
      } catch (e){}
      return null;
    })();
    return contaP;
  }

  const pct = (a, b) => Math.max(0, Math.min(100, Math.round(a / b * 100))) + '%';
  const txt = (el, s) => { if (el) el.textContent = s; };

  const ROTULO = { atual:'Mundo atual', aberto:'Aberto', concluido:'Selo conquistado', bloqueado:'Bloqueado' };

  /* ---------- home: seção #campanha ---------- */
  function pintarHome(raiz, fases, naConta){
    const r = resumo(fases), q = s => raiz.querySelector(s);
    txt(q('[data-campanha-total]'), String(r.total));
    txt(q('[data-campanha-selos]'), String(r.selos));
    txt(q('[data-campanha-atual]'), r.atual ? 'Mundo ' + r.atual + ' · ' + r.nomeAtual : 'Os 8 mundos conquistados');
    const barra = q('[data-campanha-barra]'); if (barra) barra.style.width = pct(r.total, r.max);
    txt(q('[data-campanha-fonte]'), naConta ? 'Progresso salvo na sua conta.'
      : r.temProgresso ? 'Progresso salvo neste navegador.'
      : 'Sua conquista ainda não começou. O progresso fica salvo neste navegador.');
    txt(q('[data-campanha-cta]'), r.temProgresso ? 'Continuar a conquista' : 'Começar a conquista');
    raiz.dataset.progresso = r.temProgresso ? 'sim' : 'nao';

    for (const m of r.mundos){
      const li = q('[data-mundo="' + m.n + '"]'); if (!li) continue;
      li.dataset.estado = m.estado;
      txt(li.querySelector('[data-mundo-estado]'), ROTULO[m.estado]);
      txt(li.querySelector('[data-mundo-estrelas]'), m.estrelas + '/' + POR_MUNDO);
      const b = li.querySelector('[data-mundo-barra]'); if (b) b.style.width = pct(m.estrelas, POR_MUNDO);
      const dica = li.querySelector('[data-mundo-dica]'); if (dica) dica.hidden = m.estado !== 'bloqueado';
    }
  }

  function iniciarHome(){
    const raiz = document.querySelector('[data-campanha]'); if (!raiz) return;
    const local = lerLocal();
    try { pintarHome(raiz, local, false); } catch (e){ return; }
    lerConta().then(conta => { if (conta) try { pintarHome(raiz, fundir(local, conta), true); } catch (e){} });
  }

  /* ---------- conta (login.html): linha compacta ao lado do botão da campanha ---------- */
  function pintarConta(raiz){
    try {
      if (!raiz) return;
      const linha = raiz.querySelector('[data-campanha-linha]'), cta = raiz.querySelector('[data-campanha-cta]');
      if (!linha && !cta) return;
      const pintar = fases => {
        const r = resumo(fases);
        txt(linha, r.total + '/' + r.max + ' estrelas · ' + (r.atual ? 'Mundo ' + r.atual + ' · ' + r.nomeAtual : 'os 8 mundos conquistados'));
        txt(cta, r.temProgresso ? 'Continuar a Conquista dos Mundos' : 'Começar a Conquista dos Mundos');
      };
      const local = lerLocal();
      pintar(local);
      lerConta().then(conta => {
        if (!conta || !(linha || cta).isConnected) return;   // a tela pode ter sido redesenhada
        try { pintar(fundir(local, conta)); } catch (e){}
      });
    } catch (e){}
  }

  window.ACCampanha = { KEY, MUNDOS, lerLocal, lerConta, fundir, resumo, pintarConta };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarHome);
  else iniciarHome();
})();
