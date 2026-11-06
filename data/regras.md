# Arcane Chess — regras dos modos (decisões aprovadas)

Fonte: documento "Modos de Jogo do Arcane Chess" (https://claude.ai/artifact/HFVhHjWVadkxZCecT8Dcbz). As cartas estão em `data/cartas.json`.

## Modos
1. **Modo Aprendiz** — xadrez padrão guiado. 7 lições em ordem: conheça o exército; movimentos por peça (mini tabuleiro); capturas; xeque e as 3 saídas; roque, en passant e promoção; mates em 1 e em 2; partida guiada contra o Easy. Durante a partida: anel vermelho em peças suas atacadas e desprotegidas; botão "Dica" (seta + uma frase de porquê, vinda do motor); avaliação depois de cada lance (ótimo, bom, impreciso, erro; mostra o melhor lance quando houver um muito melhor); desfazer ilimitado; dicas em texto e narradas (narrador desligável); uma insígnia por lição concluída.
2. **Modo Padrão** — xadrez padrão contra a IA. Níveis Easy (Recruta), Medium (Veterano), Expert (Mestre). Escolher cor (Aurora, Legião ou sortear). Relógio opcional: sem, 10 min, 3 min + 2 s. Desfazer: livre no Easy, 3 por partida no Medium, desligado no Expert. Dois jogadores no mesmo aparelho continua.
3. **Modo Espectador (IA x IA)** — nível de cada lado, regras Padrão ou Arcano, velocidade (lenta, normal, rápida que pula as cenas), câmera Drone circulando e cortando para o close nas capturas, narrador nos lances importantes, pausar, voltar um lance, assumir um dos lados, placar de série (melhor de 3 ou 5).
4. **Modo Arcano** — xadrez + cartas (abaixo).

## Modo Arcano
- **Turno (desde 06/11/2026):** início (+1 essência) → cartas, quantas a essência permitir (antes do lance) → lance de xadrez, que encerra o turno → se capturou: saque (+2 essência e a carta do artefato da peça capturada, para usar no próximo turno) → fim (runas; compra 1 carta a cada 2 turnos) → vez do rival. Não existe fase de cartas depois do lance nem botão de encerrar turno.
- **Essência:** máximo 10. **Mão:** começa com 3, limite 5. **Grimório:** 20 cartas; baralhos prontos por tema primeiro, montagem pelo jogador depois.
- **Casas de runa:** 4 casas centrais brilham; terminar o turno numa delas dá 1 carta (uma vez por casa por partida). Promover um Peão dá uma carta rara.
- **Espólio:** cada peça carrega um artefato (Peão: Lança Fiel; Cavalo: Ferradura do Salto; Bispo: Grimório Arcano; Torre: Pedra da Terra; Dama: Coroa do Raio). Quem captura ganha a carta.
- **Vitória:** xeque-mate. O Rei é imune a cartas (nenhuma carta move, troca, prende, captura, sacrifica ou dá aura a um Rei). Nenhuma carta pode deixar o próprio Rei em xeque; com o Rei em xeque, só cartas que tiram o xeque. Uma carta pode dar xeque.
- **Limites:** cartas por turno só pela essência (o limite de 1 carta por turno acabou em 06/11/2026); 1 relíquia por peça (outra substitui); no máximo 2 invocações por partida e a Dama nunca volta (exceção: Fênix, 1 vez por partida); no máximo 2 armadilhas armadas; peça invocada não captura no turno em que chega; no máximo 2 sacrifícios por partida. Empates seguem o xadrez; os 50 lances zeram quando uma carta captura ou invoca.
- **Transmutações:** comuns duram 3 turnos (exceção: Ascensão do Pegaso, 2), lendárias 1 (contador sobre a peça; o turno em que a carta é jogada conta). Lendárias (Dragão das Cinzas) custam 8 e valem 1 por partida. Visual: efeitos sobre o modelo atual (asas, chamas, armadura) primeiro; modelos novos depois.
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
- **Duração "N turnos"** conta os turnos do dono da peça, incluindo o turno em que a carta é jogada (a carta vem antes do lance, então "por 1 turno" vale para o lance deste turno). Efeito que nasce durante um lance numa peça do próprio dono (preso por Vingança da Isca ou pelo rastro do Necromante) não conta o fim desse turno. Efeitos do tabuleiro (muralha, lava, portal, rastro, âncora) contam todos os fins de turno: "2 turnos" = 4 fins de turno.
- **Capturas feitas por cartas** (Berserker) também dão espólio (+2 essência e o artefato).
- **Ponto de Ancoragem:** jogada antes do lance, marca a casa onde a peça está; a peça pode agir (e capturar) neste turno e volta à casa marcada no fim do turno do rival (se a casa estiver livre e nenhum Rei ficar em xeque).
- **Repercussão de Impacto:** vale para a captura do lance deste turno.
- **Ferradura do Salto e Coroa do Raio** valem para o lance deste turno (a carta vem antes do lance). A Lança Fiel vale uma vez, sem prazo.
- **Aura do Cavaleiro:** vale para Torre, Bispo ou Dama, que atravessam uma peça no caminho por 1 turno.
- **Empuxo Gravitacional e Névoa Fria** não afetam o Rei nem uma peça com Muralha Viva (imune a cartas do rival). Um Peão não é empurrado para a última fileira.
- **Espelho de Posição:** um Peão não pode cair na primeira nem na última fileira.
- **Profecia Selada:** o jogador crava a peça e a casa de destino do próximo lance do rival; vale uma única tentativa. Se o rival estiver em xeque, a profecia não anula o lance.
- **Contrafeitiço:** anula a próxima carta do rival; a essência dela é gasta e a carta vai para o descarte.
- **Berserker:** conta como sacrifício (no máximo 2 por partida, junto com o Rito do Sacrifício).
- **Ressurreição das Cinzas:** o tipo da peça é escolhido entre os que estão no seu cemitério (nunca a Dama nem o Rei).
- **Promoção por lance extra:** um Peão que chega à última fileira por um movimento de carta (por exemplo a Herança do Cavaleiro) é promovido a Dama.

## Balanceamento (Fase E, 06/11/2026)

Medido com a IA no nível 3 (a mais forte), 216 partidas por rodada, todos os confrontos entre grimórios e os dois lados. Taxas ajustadas pelo lado.

| Carta | Antes | Depois | Motivo |
|---|---|---|---|
| Dragão das Cinzas | custo 8, 2 turnos | custo 8, 1 turno | 76% de vitória mesmo custando 8 |
| Ascensão do Pegaso | custo 4, 3 turnos | custo 5, 2 turnos | entre 56% e 66% em todas as rodadas; com custo 5 passa a ser carta rara (prêmio da promoção do Peão) |
| Fênix | 6 | 7 | acima de 55% |
| Rito do Sacrifício | 2 | 3 | acima de 55% |
| Aura do Cavaleiro | 3 | 4 | acima de 55% |
| Ferradura do Salto | 2 | 3 | espólio forte demais para o custo |
| Golem de Pedra | 4 | 3 | 38,8% → 54,5% |
| Fosso de Lava | 4 | 3 | 37,6% → 49,9% |
| Duplo de Corpo | 3 | 2 | ~42% (margem de ±10) |

- **IA:** no nível 3 a IA nunca jogava armadilhas nem cartas de informação (a avaliação do tabuleiro não vê o valor delas). A IA agora soma o valor da carta que vira efeito e um valor situacional por carta (Contrafeitiço só se o rival tem cartas na mão, Olho do Bispo conforme as armadilhas escondidas, Repercussão só com captura disponível). Com isso o grimório Arcano subiu de 44% para 49%.
- **Coroa do Raio:** os 74% vinham de quem já tinha capturado a Dama rival. O efeito real da carta é de +0,5 a +3 pontos; o custo continua 3.
- **Vantagem das Brancas:** os 62,5% só aparecem no nível 2. No nível 3 as Brancas ficam entre 47% e 54%, então não há compensação para a Legião.
- **Resultado (validação final, sementes novas):** grimórios entre 48,6% e 51,7%, confrontos entre 46,9% e 53,1% (antes 35%–65%), Brancas com 47,5%. A única carta claramente acima de 55% é a Coroa do Raio, por viés de seleção (efeito real +2,3 pontos). Ficam em observação, sem mudança: Pégaso (66%, provável), Dragão (61%, provável); Centurião, Névoa Fria e Rito do Sacrifício (42%–44%, prováveis abaixo).


## Turno com as cartas antes do lance (06/11/2026)

Pedido do usuário: no xadrez, mover a peça encerra a vez. Por isso:
- Na sua vez você joga as cartas que quiser, dentro da essência, e o lance da peça encerra o turno. Não há fase de cartas depois do lance nem botão de encerrar turno.
- Nenhuma carta pode deixar o jogador sem lance (o jogo recusa a carta). Assim a vez nunca fica presa e não existe "passar a vez"; sem lance só por xeque-mate ou afogamento, como no xadrez.
- Uma carta pode dar xeque (o rival responde na vez dele). O Rei continua imune a cartas.
- Peça invocada (Recruta do Cemitério, Ressurreição das Cinzas) pode se mover no turno em que chega, mas não captura.
- Visão do Oráculo: a previsão é feita depois do seu lance, na posição em que o rival vai jogar.
- Armadilhas e reações (Espinhos, Contrafeitiço, Troca de Sombra, Duplo de Corpo, Profecia Selada, Vingança da Isca) continuam disparando no turno do rival.
- A versão do estado do motor passou a 3; replays gravados antes avisam que podem divergir e param onde divergem.
- Compensação da Legião: com o lance encerrando o turno, as Brancas abriam com vantagem; a Legião começa com 1 de essência guardada.

## Peão de espada e Lanceiro (06/11/2026)

Pedido do usuário: o Peão ataca a 1 casa, então a arma dele é uma espada; com um poder ele sobe de nível e ganha a lança, que alcança 2 casas.
- O Peão usa espada curta (gládio) e escudo redondo: textos, ficha, crônica ("com a espada"), som de espada, voz "Golpe fatal!" e o adereço 3D. O modelo da Meshy atual não tem a lança na malha (a arma era um adereço procedural), então a troca já vale nele.
- **Lança Fiel** (espólio do Peão, custo 1 → 2) virou a carta do Lanceiro: o Peão escolhido vira **Lanceiro para sempre**. Ele continua andando e capturando como Peão e, além disso, captura em linha reta à frente a 1 ou 2 casas, com a casa do meio vazia (muralha ou lava no meio bloqueiam), avançando até a casa da vítima. A captura de frente também dá xeque e o Rei não pode entrar nessas casas.
- Escolhas: a estocada **move** o Lanceiro (como toda captura do xadrez; o tabuleiro mostra a casa-alvo como qualquer captura) e o alcance é **em frente**, não na diagonal, porque o Domínio Diagonal já dá a captura a 2 casas na diagonal. A antiga Lança Fiel de uso único foi absorvida: não existe mais a versão "uma vez".
- A patente é um efeito novo do tipo 'rank': nenhuma relíquia a substitui (o Lanceiro pode ter Escudo, Coroa etc.), não conta turnos e fica para trás na promoção. A mesma carta não promove de novo quem já é Lanceiro.
- Na tela: o Lanceiro troca a espada pela lança (modelo GLB e procedural), ganha a etiqueta dourada "Lanceiro" sobre a peça, e a ficha, a crônica e a linha do tempo dizem "Lanceiro"; a captura dele usa o som de lança e a voz "Lança fiel!".
- A IA dá valor 70 à patente (antes 30 para o uso único). A versão do estado do motor passou a 4 (o carimbo das regras muda e os replays antigos avisam).

## Balanceamento com o turno novo e o Lanceiro (06/11/2026)

IA no nível 3, sementes novas a cada rodada; critério: nenhum grimório nem confronto acima de 55% e as Brancas perto de 50%.

| Rodada | Mudanças | Brancas | Grimórios | Pior confronto | Cartas claramente acima de 55% |
|---|---|---|---|---|---|
| 1 (216) | turno novo, custos antigos | 55,6% | 46,5–53,5% | Tempestade × Cinzas 59,4% | Coroa do Raio 73%, Rito do Sacrifício 67% |
| 2 (216) | Rito 3→4, Pégaso 5→6, Dragão 8→7, Recruta 3→2, Ferradura 3→4, Pedra da Terra 2→3, Coroa do Raio 3→5; Legião +1 essência | 48,1% | 45,1–53,8% | Tempestade × Arcano 59,4% | Pégaso 76%, Fênix 70%, Coroa do Raio 69% |
| 3 (216) | Visão do Oráculo 3→2, Profecia Selada 4→3, Pégaso 6→7, Fênix 7→8, Coroa do Raio 5→6 | 50,5% | 47,2–52,4% | Cinzas × Arcano 58,3% | Dragão 77%, Coroa do Raio 71%, Coroa Emprestada 66% |
| 4 (216) | Lanceiro (Lança Fiel 1→2), Dragão 7→8 | 52,3% | 47,2–54,5% | Tempestade × Arcano 61,5% | Coroa do Raio 73%, Ferradura 67%, Coroa Emprestada 66% |
| 5 (432) | grimório Arcano: 1 Olho do Bispo → 2º Escudo Arcano; Ferradura 4→5 | 48,3% | 47,4–54,0% | Cinzas × Arcano 58,9% (±9,7) | Coroa do Raio 73%, Pégaso 71%, Dragão 69%, Ferradura 62% |
| 6 (432) | Dragão 8→9, Coroa do Raio 6→7, Profecia Selada 3→2 | 54,6% | 47,7–54,0% | Arcano × Cinzas 56,8% (±9,8) | Dragão 79%, Coroa do Raio 74%, Coroa Emprestada 64% |
| **7 (432, final)** | Profecia Selada 2→3 | **53,4% (±4,7)** | **47,7–52,6%** | **Tempestade × Arcano 54,2%** (todos ≤ 55%) | Dragão 86% (29 partidas), Pégaso 80% (23), Fênix 79% (34), Coroa do Raio 71% |

- **Resultado:** na rodada 7 nenhum grimório nem confronto passa de 55% e as Brancas ficam em 53,4% (o intervalo inclui 50%). A Legião começa com 1 de essência guardada.
- **Cartas acima de 55%:** Dragão, Pégaso e Fênix são caras e saem pouco (23–34 partidas), quase sempre por quem já está na frente (viés de seleção). A Coroa do Raio continua forte mesmo no controle do espólio (+15 pontos): é a candidata a mudar de efeito, não de custo.
- **Lança Fiel (Lanceiro):** 50,7%, equilibrada.

## Golpes por par, xeque-mate cinematográfico e abertura viva (06/11/2026)

Plano em data/plano-golpes.md. Só apresentação: as regras do motor não mudam.
- **Golpes:** cada captura usa o golpe da matriz atacante × vítima (lâmina, arremesso, explosão, magia com elemento, veneno, investida, flecha). A crônica, a legenda da câmera de combate e a linha do tempo dizem o golpe ("Peão lança uma granada na Torre", "Cavaleiro derruba na justa o Cavaleiro").
- **Arcano:** o golpe segue a carta que deu o lance: o efeito do lance (Coroa do Raio, Dragão, Canhão...), a carta jogada na peça no mesmo turno ou a transmutação ativa. O campo novo `golpe` de data/cartas.json guarda o tipo e o elemento (ex.: `magia:raio`, `explosao:terra`, `veneno:sombra`); sem o campo, vale o tipo da carta. Ex.: "Peão usa Coroa do Raio e fulmina com um raio a Torre".
- **Cavaleiro:** o Cavalo do xadrez é um guerreiro montado; o cavalo só o carrega. Ao morrer, o cavaleiro cai da sela conforme o golpe; o cavalo empina e foge do tabuleiro. O modelo estático é separado em cavaleiro e cavalo na carga.
- **Mortes:** a vítima cai com o clipe da Meshy do golpe (assets/meshy/<figura>/golpes.glb, carregado na primeira captura): Electrocuted_Fall (magia), Shot_and_Blown_Back (explosão e investida), Shot_and_Fall_Forward (arremesso), Strangled_and_Fall_Forward (veneno), Shot_and_Slow_Fall_Backward (flecha); lâmina usa dying_backwards. Arremessos do atacante: Over_Shoulder_Throw e Crouch_Charge_and_Throw. Figura sem o clipe pega o de outra (mesmo esqueleto); sem nenhum, o procedural.
- **Xeque-mate (6–9 s):** faixas pretas e câmera lenta; o Rei se ajoelha (Kneel_on_One_Knee_and_Stand, só a primeira metade), a coroa cai e rola, correntes o prendem; dois captores (Carry_Heavy_Object_Walk) o levam ao campo do vencedor e o estandarte sobe. Botão "Pular" sempre visível; com movimento reduzido, a versão curta. Igual no espectador, no replay e na IA.
- **Abertura viva:** fica com a outra sessão (`site/hero.html`); o jogo não tem mais a versão de fundo.

## Sair do jogo, narração, modelos e ranking (06/11/2026)

- **Sair do jogo:** botão na barra de cima durante a partida (44 px no celular) e Esc. Partida local ou contra a IA em andamento pede confirmação ("Sair" / "Salvar e sair" no Modo Padrão / "Continuar jogando"); online é desistir, ou cancelar antes do 1º lance; Espectador, replay e Aprendiz saem direto. A saída para IA, relógio, câmera, cinema, narração e conexão e volta ao menu sem recarregar.
- **Narração lance a lance:** frases da transmissão montadas de pedaços (data/narracao.json, assets/audio/narr/), em sequência pelo barramento de voz (a música abaixa), com o silêncio das pontas aparado; legenda no terço de baixo com a carta e as casas marcadas. Opção "Narrar" no painel de áudio: Tudo, Só ações importantes (padrão: capturas, cartas, xeque e especiais), Desligado. Uma frase nova corta a anterior; o narrador curto antigo não fala por cima. Sem os mp3 (Artifact), speechSynthesis em pt-BR; sem ele, só a legenda.
- **Modelos comprimidos:** cópias Draco em `.c.glb` / `.c.gltf.json` (cerca de 2,5 vezes menores; 8 modelos: ~3,5 MB em vez de ~9,5 MB). O decodificador é o de JS puro, por `<script>` (a CSP dos Artifacts barra WebAssembly e o fetch para fora); sem ele, ou com `?nodraco`, os arquivos sem compressão.
- **Clique nas peças:** um cilindro invisível por peça; quando o raio cruza vários, vale a peça cujo eixo passa mais perto do ponteiro.
- **Dragão das Cinzas realista:** a carta transforma o Cavaleiro no dragão (pilar de fogo e rugido); ele faz o lance (o golpe é o sopro de fogo) e volta a ser o Cavaleiro quando o efeito acaba. Ossos procedurais: respiração, cabeça, cauda, asas, mandíbula. Os dragões do céu da arena "dragoes" usam o mesmo modelo (2 no celular, 3 no computador).
- **Links do site:** `#modo=arcano|online|espectador` abre o menu já no modo (também na troca do hash); valores desconhecidos são ignorados.
- **Ranking:** `GET /api/leaderboard?mode=xadrez|arcano&limit=50` devolve id, nome, nota, rd e partidas (e se a nota é provisória), só de contas com partida ranqueada; o id leva a `/api/profile/:uid`.

## Reinos (07/11/2026)

Só a aparência muda: as regras e o balanceamento são os mesmos para todos os reinos.
- **Escolha:** no Modo Padrão, no Espectador e no Arcano, um cartão por reino para cada lado (Brancas e Negras), com a imagem do time, o nome e a descrição; lembrada neste navegador. Escolher um reino sugere o mundo dele como arena (dá para trocar).
- **Reinos:** Reino da Aurora (o visual de sempre), Legião do Ferro Negro e Reino dos Dragões. Só os modelos do reino escolhido são carregados (Draco, depois .opt; sem arquivo, a peça usa o modelo da Aurora). Os modelos de reino não recebem a tinta escura da Legião (só quando os dois lados escolhem o mesmo reino). O anel das peças e as barras de força seguem a paleta do reino.
- **Golpes por reino:** o tipo da matriz não muda (regras e morte); o reino do atacante troca a cor, as partículas, o som, a legenda e o texto da magia e da torre. Ferro Negro: fumaça negra e brasas carmesim (granada de fumaça, luz da cruz negra, névoa carmesim da Dama, martelo com onda de choque, flechas negras fumegantes); a vítima vira cinza e fumaça. Dragões: fogo (o cavalo cospe fogo antes da lança, bola de fogo do Bispo, onda de chamas da Dama, vórtice de chamas do Rei, virote de fogo azul da Torre); a vítima pega fogo e vira brasa.
- **Mundos:** Aurora, as arenas atuais. Ferro Negro, Mistério Infernal com o toque carmesim (névoa, brasas, estandartes rasgados, runas vermelho-sangue, clarões vermelhos). Dragões, Covil dos Dragões com aurora verde-azulada e o Dragão das Cinzas realista que pousa na borda, anda, ruge e volta a voar. O seletor de arena mostra o reino de cada mundo.
- **Dragões:** os 4 humanoides usam o esqueleto da Meshy (como a Aurora e o Ferro Negro) e recebem os golpes.glb da Aurora; o Cavaleiro e a Torre são estáticos. O jogo reconhece o esqueleto: um modelo com o da Tripo (sem o osso Hips) fica com os próprios clipes, o ataque cortado no trecho do golpe e o movimento procedural.
