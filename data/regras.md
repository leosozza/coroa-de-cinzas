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
