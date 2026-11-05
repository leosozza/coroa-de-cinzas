# 07 — Regras, IA, interface e testes

## Regras

- Jogo com regras conhecidas: use uma biblioteca testada. Xadrez: `chess.js 0.10.3` (lances legais, xeque, mate, afogamento, roque, en passant, promoção, empates por repetição, 50 lances e material insuficiente).
- Regras próprias: escreva a lógica pura, sem DOM, num bloco do script delimitado por comentários, para poder extrair e testar em Node.

## IA

- O chess.js é lento para busca (~0,45 ms por lance feito). Por isso a IA tem **seu próprio gerador de lances 0x88**. Cada lance escolhido é conferido na lista legal do chess.js antes de ser jogado; se não bater, joga um lance legal aleatório.
- Busca: negamax com alfa-beta, ordenação MVV-LVA, material + tabelas peça-casa, quiescência nas capturas, extensão de xeque e aprofundamento iterativo com orçamento de tempo.
- Níveis: Recruta (profundidade 1 com aleatoriedade), Veterano (profundidade 3), Mestre (até ~1,2 s, profundidade 6–8).
- Roda num **Web Worker criado de um Blob**, então a cena segue a 60 fps enquanto a IA pensa. Se o Worker falhar ou passar de 6 s, roda na thread principal.
- Mostre o estado "pensando" (faixa "TURNO DA LEGIÃO" e sigilo pulsando).

## Interface

- Cabeçalho: modo (contra a IA / dois jogadores), dificuldade, câmera de combate, nova partida, desfazer e áudio.
- Faixa de turno e HUD dentro da cena: SUA VEZ, TURNO DA LEGIÃO, XEQUE!.
- Painel lateral: forças em campo (material e peças capturadas), ficha da peça (nome, exército, frase de sabor, como se move), lances em notação portuguesa (R, D, T, B, C) e a Crônica com frases como "Cavaleiro abate Peão em e5.".
- Seletor de promoção na própria página (nunca `prompt()`; o Artifact não mostra diálogos).
- Tela final com título (Xeque-mate, Afogamento, Empate por repetição…), estatísticas, nova partida e desfazer.
- Teclado: setas, Enter, Esc, H, V, I. Toque: dois toques em alvo de captura no celular.
- Tokens de cor no `:root` (tema escuro único com `color-scheme: dark`), `[hidden]{display:none!important}` e sem rolagem lateral a 375 px.
- Snapshot para recarga a quente: `window.claude?.hot?.snapshot(() => ({fen, histórico, cfg, log}))` e inicialização por `hot.ready(start)`. O `start()` precisa funcionar no meio de uma animação.

## Testes

1. **Lógica em Node**: extraia o bloco de regras e IA do HTML e rode um arnês ([../scripts/chess_ai_harness.js](../scripts/chess_ai_harness.js) é o do xadrez: perft contra o chess.js em 5 posições e partidas IA contra IA com tempos por nível).
2. **Navegador local**: página embrulhada com doctype, assets ao lado, desktop (~1280 px) e celular (375 px). Selecione, mova, capture com cada peça, teste os lances especiais, desfazer, mate e as vistas. Olhe o console.
3. **CSP**: rode [../scripts/servidor_csp.py](../scripts/servidor_csp.py) e veja se algo é bloqueado.
4. **Publicado**: abra o link num navegador logado e jogue um lance.
5. Sons: confira no log de chamadas que cada evento toca o arquivo certo (`AUD.log`).

## Trabalhar com subagentes (design-squad)

O jogo foi construído por um subagente `design-squad-ui-engineer`, retomado várias vezes com `SendMessage`. O que funcionou:
- Briefing com caminho do arquivo, o que não pode mudar, contrato de eventos, restrições do Artifact, como testar e o que relatar.
- Pedidos novos do usuário repassados na hora, mesmo com o agente trabalhando.
- **Depois de cada rodada, confira se ele não desfez correções suas**: numa delas, o carregador voltou a procurar `.glb` e os modelos sumiram do Artifact publicado.
