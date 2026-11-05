# 10 — Modos, cartas e interface

## Desenhar os modos com o usuário

- **Discutir o design num documento Claude Docs** (tipo Docs do Artifact): os modos, as cartas, as regras e a interface. Feche cada ponto com uma tabela de **decisões em aberto** que tenha uma coluna Decisão com lista suspensa (Em aberto, Aprovado, Mudar).
  - O usuário marca as decisões ou diz "segue a sugestão".
  - Quando o usuário está editando o mesmo documento, um `guard_mismatch` significa que ele mudou aquele trecho. Releia, mantenha a edição dele e mude só o resto.
- **Exportar o que foi aprovado** para arquivos que o subagente consegue ler (ele não abre o documento):
  - `data/regras.md`: as regras de todos os modos (exemplo em [../exemplo/dados/regras.md](../exemplo/dados/regras.md)).
  - `data/cartas.json`: o catálogo de cartas, como fonte única para o jogo, a arte e os sons (exemplo em [../exemplo/dados/cartas.json](../exemplo/dados/cartas.json)).

## Os 4 modos do Arcane Chess

| Modo | Resumo |
|---|---|
| Padrão | contra a IA (Easy, Medium e Expert, mapeados para Recruta, Veterano e Mestre) ou dois jogadores; escolher a cor; relógio opcional (10 min ou 3 + 2); desfazer livre no Easy, 3 no Medium e desligado no Expert; partida salva para continuar |
| Espectador | IA x IA, com o nível de cada lado, a velocidade (lenta, normal ou rápida sem cenas) e séries de 1, 3 ou 5; vista Drone; pausar, voltar um lance e assumir um lado |
| Aprendiz | 7 lições, Dica (seta + porquê), avaliação de cada lance, anel de perigo, insígnias e narrador (falas em `data/falas-aprendiz.json`) |
| Arcano | xadrez + cartas: essência, mão, grimório de 20 cartas, saque de artefatos, casas de runa, Rei imune a cartas, vitória por xeque-mate |

## Sistema de cartas (Modo Arcano)

- **Turno:** lance de xadrez e depois até 1 carta. Ver o ciclo e os limites em `regras.md`.
- **7 tipos:** feitiço, relíquia, transmutação, invocação, armadilha, terreno e artefato (o espólio).
- **42 cartas no catálogo.** Destaques que vieram do usuário:
  - **Oráculo**, que prevê as jogadas do rival. Contra a IA a primeira previsão é garantida, porque a IA se compromete com o lance revelado.
  - **Sacrifício**: uma peça morre e a aura dela fortalece outra, com um poder que depende de quem foi sacrificado. A peça sacrificada não dá espólio.
  - **Transmutações** temporárias (Pegaso, Dragão das Cinzas, Golem, Centurião, Fênix…).
  - **Cartas de blefe e posição** (Troca de Sombra, Empuxo, Portal de Runa…).
- **Motor:** o chess.js não aceita movimentos modificados, então o Modo Arcano usa uma camada de regras própria sobre o motor 0x88 da IA:
  - efeitos por peça com contador de turnos;
  - legalidade = o próprio Rei nunca fica em xeque;
  - mate = mate normal com as regras de movimento do momento.
- **Ordem de construção:** dois jogadores no mesmo aparelho primeiro, com a tela "passe o aparelho" para esconder a mão; depois as cartas; depois a IA usando cartas.

## Arte das cartas

- `scripts/gemini_cards.py` lê o `cartas.json` e gera uma ilustração por carta. A primeira serve de referência de estilo para as outras.
  - Saída em 3:4, 1K: `assets/cards/<id>.jpg`, e a versão de 512 px para o jogo em `assets/cards/web/<id>.jpg` (~40 KB cada).
  - O estilo pede pintura de fantasia sombria e proíbe texto, letras e moldura. A moldura é feita no jogo.
  - Tem novas tentativas automáticas, porque a conexão às vezes cai com "Broken pipe".
- Exemplos em [../exemplo/cartas/](../exemplo/cartas/).

## Interface

- **Tela inicial** sobre a arena 3D girando ao fundo:
  - logo e subtítulo;
  - os modos em cartões com moldura de runas;
  - seletor de arena com miniaturas;
  - "Continuar partida";
  - Esc ou o botão Menu voltam a ela.
  - A IA e o relógio pausam com o menu aberto.
- **Logo:** "ARCANE CHESS" em Cinzel Decorative 900, com gradiente dourado metálico, contorno chanfrado e brilhos de runa cianos. O subtítulo "The Battle for the Grimoire" fica em Cinzel.
- **Peças paradas:** só a peça selecionada toca a animação de parado. As outras ficam congeladas no primeiro quadro desse clipe, uma pose natural.
- **Minimapa 2D** (como o mapa do GTA):
  - um tabuleiro clássico no canto da cena, sincronizado com as regras;
  - mostra o último lance, os movimentos possíveis e o xeque;
  - é jogável por clique;
  - arrastável e redimensionável, com a posição salva como fração da cena;
  - tecla M;
  - recolhido no celular;
  - ganchos `setMarks` e `setArrows` para o Modo Arcano e as lições.
- **Ficha da peça** com o personagem em 3D girando, desenhado por um segundo `WebGLRenderer` pequeno (~30 fps, só quando visível).

## Peças compostas

- **Torre = torre + arqueiro:** a torre é um modelo estático sem rig. O arqueiro é humanoide com rig e anima com "Archery Shot" (ID 224) no topo, do tamanho de um Peão. Altura total ~2,2: a base ~1,25 mais o arqueiro 0,98. Se ficar alto demais, as peças atrás desaparecem.
- **Cavalo montado + lança procedural:** gere o modelo com a mão direita **vazia** e acrescente a lança no jogo.
  - A carga "São Jorge": o cavalo empina, a lança baixa de vertical para horizontal, e o golpe crava com faíscas na ponta.
  - Modelos com a lança fundida na malha não conseguem abaixá-la.
