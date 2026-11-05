# Arcane Chess — regras dos modos (decisões aprovadas)

Fonte: documento "Modos de Jogo do Arcane Chess" (https://claude.ai/artifact/HFVhHjWVadkxZCecT8Dcbz). As cartas estão em `data/cartas.json`.

## Modos
1. **Modo Aprendiz** — xadrez padrão guiado. 7 lições em ordem: conheça o exército; movimentos por peça (mini tabuleiro); capturas; xeque e as 3 saídas; roque, en passant e promoção; mates em 1 e em 2; partida guiada contra o Easy. Durante a partida: anel vermelho em peças suas atacadas e desprotegidas; botão "Dica" (seta + uma frase de porquê, vinda do motor); avaliação depois de cada lance (ótimo, bom, impreciso, erro; mostra o melhor lance quando houver um muito melhor); desfazer ilimitado; dicas em texto e narradas (narrador desligável); uma insígnia por lição concluída.
2. **Modo Padrão** — xadrez padrão contra a IA. Níveis Easy (Recruta), Medium (Veterano), Expert (Mestre). Escolher cor (Aurora, Legião ou sortear). Relógio opcional: sem, 10 min, 3 min + 2 s. Desfazer: livre no Easy, 3 por partida no Medium, desligado no Expert. Dois jogadores no mesmo aparelho continua.
3. **Modo Espectador (IA x IA)** — nível de cada lado, regras Padrão ou Arcano, velocidade (lenta, normal, rápida que pula as cenas), câmera Drone circulando e cortando para o close nas capturas, narrador nos lances importantes, pausar, voltar um lance, assumir um dos lados, placar de série (melhor de 3 ou 5).
4. **Modo Arcano** — xadrez + cartas (abaixo).

## Modo Arcano
- **Turno:** início (+1 essência) → lance de xadrez → se capturou: saque (+2 essência e a carta do artefato da peça capturada) → fase de cartas (até 1 carta) → fim (compra 1 carta a cada 2 turnos) → vez do rival.
- **Essência:** máximo 10. **Mão:** começa com 3, limite 5. **Grimório:** 20 cartas; baralhos prontos por tema primeiro, montagem pelo jogador depois.
- **Casas de runa:** 4 casas centrais brilham; terminar o turno numa delas dá 1 carta (uma vez por casa por partida). Promover um Peão dá uma carta rara.
- **Espólio:** cada peça carrega um artefato (Peão: Lança Fiel; Cavalo: Ferradura do Salto; Bispo: Grimório Arcano; Torre: Pedra da Terra; Dama: Coroa do Raio). Quem captura ganha a carta.
- **Vitória:** xeque-mate. O Rei é imune a cartas (nenhuma carta move, troca, prende, captura, sacrifica ou dá aura a um Rei). Nenhuma carta pode deixar o próprio Rei em xeque; com o Rei em xeque, só cartas que tiram o xeque. Uma carta pode dar xeque.
- **Limites:** 1 carta por turno; 1 relíquia por peça (outra substitui); no máximo 2 invocações por partida e a Dama nunca volta (exceção: Fênix, 1 vez por partida); no máximo 2 armadilhas armadas; peça invocada não captura no turno em que chega; no máximo 2 sacrifícios por partida. Empates seguem o xadrez; os 50 lances zeram quando uma carta captura ou invoca.
- **Transmutações:** comuns duram 3 turnos, lendárias 2 (contador sobre a peça). Lendárias (Dragão das Cinzas) custam 8 e valem 1 por partida. Visual: efeitos sobre o modelo atual (asas, chamas, armadura) primeiro; modelos novos depois.
- **Armadilhas:** escondidas; o rival vê só um brilho suspeito na casa. Proibidas no Rei.
- **Oráculo:** contra a IA a primeira previsão é garantida (a IA se compromete com o lance revelado); contra pessoas são só prováveis.
- **Sacrifício (Rito do Sacrifício):** a peça sacrificada (não o Rei) vai ao cemitério sem dar espólio; a aura vai para outra peça sua conforme a sacrificada: Peão → Escudo do Mártir (sobrevive à 1ª captura, 3 turnos); Cavalo → Salto Herdado (também salta em L, 3); Bispo → Visão Arcana (diagonais + vê a melhor resposta do rival, 2); Torre → Muralha Viva (anda como Torre e imune a cartas do rival, 3); Dama → Coroa Herdada (move como Dama, 3). Não pode deixar o Rei em xeque.
- **Ponto de Ancoragem:** se a volta deixar o Rei em xeque ou a casa estiver ocupada, a peça fica. **Empuxo** não empurra o Rei. **Berserker** para antes do Rei.

## Interface do Arcano
Mão em leque na base da cena (faixa rolável no celular); barra de cristais de essência; ao pegar uma carta, alvos válidos brilham na cor da carta; cemitério clicável para invocações; armadilha = carta virada na casa; relíquia equipada = ícone flutuando sobre a peça + linha na Ficha; contador de turnos; cena curta por carta com nome em destaque e voz do narrador; setas fantasma violeta para o Oráculo; casa de fuga roxa para Troca de Sombra; casas de alcance extra com aura de runa; portal com círculo rúnico girando. Arte das cartas em `assets/cards/web/<id>.jpg` (512 px).

## Esclarecimentos das cartas (aprovados em 05/11/2026, Fase D)
- **Habilidades vindas de cartas valem para xeque e mate.** Uma peça com Herança, Coroa, Canhão, Pégaso, Dragão, Alcance etc. dá xeque com o movimento extra e pode participar do mate.
- **Peça protegida** (Escudo Arcano, Escudo do Mártir, Golem de Pedra, Troca de Sombra com a casa de fuga livre): a captura não muda a posição (o atacante fica ou volta à origem). Por isso esse ataque só é lance legal quando o atacante não está em xeque.
- **Nenhuma armadilha nem retorno pode deixar um Rei em xeque.** Se a volta (Espinhos, Ancoragem), a fuga (Troca de Sombra) ou o reaparecimento (Duplo de Corpo, Fênix) deixaria algum Rei em xeque, o efeito não acontece naquela casa (o Duplo e a Fênix procuram a próxima casa livre da fileira).
- **Carta e o próprio Rei:** a carta só é oferecida quando o resultado deixa o seu Rei a salvo. Com o Rei em xeque, só aparecem cartas que tiram o xeque.
- **Duração "N turnos"** conta os turnos do dono da peça. Uma carta jogada na sua fase de cartas começa a contar a partir do seu próximo turno (o fim do turno em que ela foi jogada não conta). Efeitos do tabuleiro (muralha, lava, portal, rastro, âncora) contam todos os fins de turno: "2 turnos" = 4 fins de turno.
- **Capturas feitas por cartas** (Berserker) também dão espólio (+2 essência e o artefato).
- **Ponto de Ancoragem:** como a fase de cartas vem depois do lance, a peça fica ancorada na casa onde está agora; ela pode agir no seu próximo turno e volta à casa marcada no fim do turno seguinte do rival (se a casa estiver livre e nenhum Rei ficar em xeque).
- **Repercussão de Impacto:** pelo mesmo motivo, vale para a sua próxima captura (no próximo turno), e não para a do turno em que foi jogada.
- **Ferradura do Salto e Coroa do Raio** valem para o próximo lance (a fase de cartas vem depois do lance do turno). A Lança Fiel vale uma vez, sem prazo.
- **Aura do Cavaleiro:** vale para Torre, Bispo ou Dama, que atravessam uma peça no caminho por 1 turno.
- **Empuxo Gravitacional e Névoa Fria** não afetam o Rei nem uma peça com Muralha Viva (imune a cartas do rival). Um Peão não é empurrado para a última fileira.
- **Espelho de Posição:** um Peão não pode cair na primeira nem na última fileira.
- **Profecia Selada:** o jogador crava a peça e a casa de destino do próximo lance do rival; vale uma única tentativa. Se o rival estiver em xeque, a profecia não anula o lance.
- **Contrafeitiço:** anula a próxima carta do rival; a essência dela é gasta e a carta vai para o descarte.
- **Berserker:** conta como sacrifício (no máximo 2 por partida, junto com o Rito do Sacrifício).
- **Ressurreição das Cinzas:** o tipo da peça é escolhido entre os que estão no seu cemitério (nunca a Dama nem o Rei).
- **Promoção por lance extra:** um Peão que chega à última fileira por um movimento de carta (por exemplo a Herança do Cavaleiro) é promovido a Dama.
