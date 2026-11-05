# 09 — Arenas temáticas

O Arcane Chess tem 10 arenas, trocadas no meio da partida sem perder a posição, em três grupos:
- **Clássicas:** Fortaleza Medieval (padrão), Ruínas Medievais, Covil dos Dragões, Fogo x Gelo.
- **Místicas:** Zodíaco, Multiverso, Mistério Infernal.
- **Divinas:** Celestial, Monte Olimpo, Pedra Filosofal.

## Como uma arena é construída

- **Um grupo por arena.** Tudo o que a arena cria fica num `THREE.Group`. Na troca, o código descarta geometrias, materiais, texturas, mapa de ambiente e malhas instanciadas, e reconstrói céu, névoa, exposição, luzes e ambiente a partir dos **dados do tema**.
- **Dados do tema:** paleta, cor das chamas, materiais de parede e de acabamento, estandarte, escudo, céu, música, ambiente e o gancho de captura.
- **Construtores reaproveitados:**
  - `buildCourtyard(estilo)` monta o pátio de castelo: muralha, portão com grade, tochas, torres, acampamento ao fundo e canhão. Recebe a paleta como objeto. Usado pela Fortaleza, pelo Zodíaco e pelo Multiverso.
  - O construtor de "santuário" monta o chão de placas com linhas brilhantes (pulsando devagar), ~14 selos no chão, portal no arco, estátuas com orbes e globo armilar. Usado pelo Mistério Infernal, pelo Celestial e pelo Monte Olimpo.
  - Estátuas de cristal, céu noturno e chamas com paleta (laranja, violeta, azul ou dourada) também são compartilhados.
- **Orçamento fixo:**
  - 13 luzes em toda arena. Mudar o número de luzes força a recompilação dos shaders dos personagens.
  - Objetos estáticos mesclados por material (poucas chamadas de desenho), ~285–300 mil triângulos por arena.
  - Sombra em 1024 no celular.
- **Céu como cartão pintado** em canvas (montanhas, castelos, vulcões, aurora, galáxias), voltado para a câmera, com o horizonte logo acima da última fileira.
- **Câmera por arena:** cada arena pode ajustar o enquadramento da vista Padrão. Por exemplo, a Fortaleza usa uma vista mais baixa e frontal, que mostra mais do pátio.
- **Gancho de captura por arena** (o toque especial):
  - Zodíaco: a constelação do signo acende.
  - Multiverso: o caco de portal mais próximo brilha.
  - Infernal e Celestial: o selo mais próximo acende.
  - Olimpo: raio de Zeus do céu.
  - Pedra Filosofal: círculo de transmutação, e a vítima vira pó dourado.
  - Covil: rugido de dragão.
- **Áudio por arena:** música e ambiente em loop, com troca suave (~2,5 s). As faixas longas das outras arenas só carregam quando são usadas.
- **Movimento reduzido** (`prefers-reduced-motion`): relâmpagos, rasantes, anéis girando e partículas param ou ficam lentos.

## Referências do usuário

- O usuário manda imagens geradas para **ilustrar a ideia**. Use-as para clima, paleta, objetos-chave e composição, e faça uma versão melhor: o tabuleiro legível acima de tudo, menos objetos e mais bem feitos.
- **Propriedade intelectual:** se a referência lembra uma franquia (castelo de escola de bruxos, brasões de casas), faça uma versão original no mesmo clima.
- **Conflito de temas** (Olimpo com elementos egípcios): pergunte. Neste projeto, o Olimpo ficou só grego.
- **O que deu errado e virou regra** (a primeira versão do Fogo x Gelo):
  - Metade do tabuleiro branca estourada.
  - Peças tingidas a ponto de perder a textura.
  - Blocos cinza como cenário.
  - Correção: brilho controlado (exposição ~1,05), peças sempre com a textura e as cores normais da facção, elemento só nas bordas e no entorno, e nada de caixas sem textura. Se um objeto não fica bom, sai.
- **Fogo x Gelo** é dividido em esquerda e direita (colunas a–d e e–h), para os dois exércitos ficarem sobre os dois elementos. Os ataques continuam elementais por exército.

## Dragões voando (Covil)

- **Três dragões procedurais** de poucos polígonos: corpo segmentado, cabeça com chifres, cauda em 4 partes e asas de membrana batendo.
- **Leves:** malha mesclada, sem luz própria e sem sombra.
- **Órbita acompanha o lado da câmera**, na faixa alta da tela, além do tabuleiro: dragão sobre o tabuleiro cobre as peças.
- **Eventos:** rasante a cada 15–30 s. Rugido com sopro de fogo de partículas a cada 20–40 s. Nas capturas, 60% de chance de um rugido.
