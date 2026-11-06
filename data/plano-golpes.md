# Golpes por par atacante × vítima, morte por tipo de golpe, xeque-mate cinematográfico

Pedido do usuário (06/11/2026): cada peça ataca de um jeito conforme quem ela ataca, cada vítima morre de um jeito condizente com o golpe, o xeque-mate é uma cena de cinema (o rei capturado e levado ao campo inimigo), e no modo Arcano o golpe muda com o tipo de carta ou magia. Veo 3 opcional para abertura e encerramento.

## 1. Tipos de golpe (o que a vítima sofre)

| Golpe | Efeito visual (procedural, Three.js) | Morte da vítima (clipe Meshy) |
|---|---|---|
| `lamina` (corte de espada / estocada) | rastro de lâmina, faísca | Fall Dead from Abdominal Injury (188) ou dying_backwards (189, já temos) |
| `arremesso` (espada ou lança arremessada) | arma girando em arco, crava na vítima | Shot and Fall Forward (184) |
| `explosao` (granada / frasco de pólvora) | frasco em arco, clarão, fumaça, estilhaços, tremor de câmera curto | Shot and Blown Back (182) |
| `magia` (elemento mágico: fogo, gelo, raio, arcano) | orbe ou feixe com a cor do elemento | Electrocuted Fall (181) |
| `veneno` | frasco verde, nuvem tóxica, vítima ganha tom esverdeado | Strangled and Fall Forward (186) |
| `investida` (o cavaleiro avança a galope e acerta com a lança de cavalaria) | poeira do galope, lança abaixada, impacto com estilhaços da lança | Knock Down (187) |
| `flecha` (arqueiro da torre) | flechas em arco | Shot and Slow Fall Backward (185) |

## 2. Matriz atacante × vítima (Xadrez Puro e Arcano sem carta)

Linhas = quem ataca; colunas = quem morre. Ideia: arma curta contra quem está perto, arremesso contra quem é grande ou montado, magia contra quem é mágico, veneno contra a realeza.

| Ataca ↓ / Morre → | Peão | Cavalo | Bispo | Torre | Dama | Rei* |
|---|---|---|---|---|---|---|
| **Peão** (espada) | lamina | arremesso (lança a espada) | magia (frasco de elemento) | explosao (granada) | veneno | — |
| **Cavaleiro** (guerreiro montado: lança de cavalaria e espada) | investida (lança) | justa: duelo de lanças, um cavaleiro derruba o outro | arremesso (crava a lança no mago) | explosao (lança incendiária arremessada contra a muralha) | lamina (golpe de espada do alto do cavalo) | — |
| **Bispo** (mago) | magia (raio) | magia (gelo) | magia (duelo arcano) | magia (fogo) | magia (arcano) | — |
| **Torre** (arqueiro) | flecha | flecha | flecha de fogo (magia) | explosao (flecha incendiária) | flecha envenenada (veneno) | — |
| **Dama** | lamina | magia | magia | explosao | veneno (duelo de venenos) | — |
| **Rei** (espada longa) | lamina | lamina | lamina | explosao | lamina | — |

\* O rei nunca é capturado no xadrez: o xeque-mate tem a cena própria (seção 4).

Lanceiro (peão promovido): golpe `arremesso`/estocada a 2 casas, usa o modelo `assets/meshy/peao_lanca/`.

## 3. Arcano: golpe conforme a carta

O tipo de golpe vem da carta usada naquele turno (campo novo `golpe` em data/cartas.json, derivado da facção/elemento quando faltar): fogo → magia vermelha/laranja; gelo → magia azul, vítima congela e quebra; raio → magia amarela; sombra/necro → veneno roxo; armas/relíquias → lamina ou arremesso; armadilhas → explosao. Sem carta, vale a matriz da seção 2.

## 4. Xeque-mate cinematográfico (6–9 s, pulável)

1. Câmera de transmissão corta para o rei em xeque-mate; tela escurece nas bordas (letterbox), câmera lenta.
2. O rei larga a espada e se ajoelha (Kneel on One Knee, 365); a coroa cai e rola.
3. A peça que deu o mate e uma vizinha se aproximam; o rei é preso (correntes/aura) e levado andando (Carry Heavy Object Walk, 551, nos captores; o rei preso entre eles) até o campo inimigo, atrás da última fileira.
4. Estandarte do vencedor sobe; música e texto "XEQUE-MATE"; depois o resumo da partida.
- Botão "Pular" sempre visível; com `prefers-reduced-motion`, versão curta sem câmera lenta nem tremor.
- Funciona igual no modo espectador, no replay e na IA contra IA.

## 5. Clipes Meshy a gerar (3 créditos por ação)

- Atacantes (Peão, Bispo, Dama, Rei, Arqueiro): Crouch Charge and Throw (398, granada/frasco), Over Shoulder Throw (421, espada arremessada), Charged Spell Cast (125) onde faltar. ~8 clipes.
- Vítimas (as mesmas 5 figuras): 181, 182, 184, 186 (+185 no arqueiro). ~20 clipes.
- Xeque-mate: 365 (rei) e 551 (captores). ~6 clipes.
- Total estimado: ~34 clipes ≈ 100–120 créditos (saldo atual ~900). Precisa do OK do usuário.
- O Cavalo do xadrez é um **guerreiro montado**: quem golpeia e quem morre é o cavaleiro, nunca o cavalo. O cavalo só o carrega. Não existe atropelamento.
  - Ao atacar, o cavaleiro galopa, abaixa a lança ou ergue a espada, e golpeia.
  - Ao morrer, o cavaleiro tomba da sela conforme o golpe. O cavalo empina, assusta-se e sai galopando do tabuleiro sem o cavaleiro.
- O modelo `cavalo_montado` é estático, então esses movimentos são procedurais (cavaleiro e cavalo como partes separadas, ou com o cavaleiro inclinando e caindo). Se ficar ruim, gerar no Meshy um cavaleiro a pé com rig, só para a queda e o duelo.

## 6. Veo 3 (opcional)

Abertura (~8 s: o grimório se abre sobre o tabuleiro, as peças despertam) e encerramento (~8 s: vitória e derrota). Precisa recarregar o Gemini (créditos zerados) e do OK do custo. Vídeo leve (≤ 4 MB cada, webm/mp4), com botão pular e fallback para a abertura atual.
