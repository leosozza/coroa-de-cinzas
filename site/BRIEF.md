# Site do Arcane Chess: página inicial com hero ao vivo, ranking e login

Pedido do usuário (06/11/2026). Ele disse, nas palavras dele:
- "a pagina hero deve ser extraordinaria com silulacoes do jogo em segundo plano, pecas em trasmutacao, guerreiros lutando"
- "essa sessao aqui é excluvida para pagina inicial e hero, pagina do rankin e login"
- Como referência, ele indicou o tema Godlike: https://wp.nkdev.info/godlike/main/ e /game-promo/

## Regras de trabalho

**Só dentro de `site/`:**
- Não editar `coroa-de-cinzas.html`, `engine/`, `server/` nem `assets/`. Pode ler tudo.
- Outra sessão está mexendo no jogo e é ela que publica.
- Nada de publicar: sem Artifact, sem `tools/deploy_pages.sh`, sem wrangler, sem git commit ou push.
- Não rodar scripts que gastam créditos (Meshy, Tripo, ElevenLabs, Gemini).

**Bibliotecas e CDNs:**
- Three.js r128: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`.
- Exemplos da r128: `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/...` (GLTFLoader e, se precisar, meshopt/DRACO).
- chess.js 0.10.3, do cdnjs, como no jogo.
- Fontes: Google Fonts, as mesmas do jogo.
- Nada de React nem bundler. HTML, CSS e JS puros.

**Caminhos:**
- Assets: referenciar sempre como `../assets/...`. No Pages, se as páginas forem para a raiz, `../assets` vira `/assets` sozinho.
- Link do jogo: centralizar em `site/assets/site.js`. Usar `../coroa-de-cinzas.html` quando a página estiver numa pasta `/site/`, e `/jogar.html` no Pages.
- Quem integrar escolhe o caminho final. Deixar isso fácil de mudar.

**Testes locais:**
- Servir a pasta do projeto em `http://127.0.0.1:8767/`. É a única porta local que o CORS da API aceita (ALLOWED_ORIGINS tem localhost:8767 e 127.0.0.1:8767).
- API: `https://arcane-chess-api.leonardo-zogbi.workers.dev`.
- Aceitar `?api=http://localhost:NNNN`, como o jogo já faz (`netApi()`).

## Identidade visual: a do jogo, com a estrutura do Godlike

**Cores e fontes:** tokens do jogo (`:root` em `coroa-de-cinzas.html`):
- Cores: `--basalt #0e0d0b`, `--crypt #171510`, `--stone #221f19`, `--seam #3b342a`, `--ash #a59c8b`, `--bone #ede3cc`, `--ember #e3a548`, `--ember-deep #8f5c1d`, `--blood #d24a58`, `--void #a985ff`.
- Fontes: `--f-logo` Cinzel Decorative, `--f-engrave` Cinzel, `--f-display` Grenze Gotisch, `--f-body` Alegreya, `--f-ui` Alegreya Sans SC.
- Logo: "Arcane Chess", subtítulo "The Battle for the Grimoire".

**O que tirar do Godlike:**
- Fundo escuro, com brasas e faíscas subindo em partículas.
- Moldura com bordas rasgadas, como pergaminho queimado, e vinheta.
- Títulos em versalete serifado (Cinzel).
- Botões finos com contorno: o principal em âmbar, o secundário em contorno claro.
- Menu superior escuro e translúcido.
- Blocos com ícone em grade, números grandes (contadores), faixa de chamada ("Compre agora…" vira "Entre na batalha"), carrossel de depoimentos e rodapé.

**Requisitos de qualidade:**
- Acessível: contraste AA, foco visível, `prefers-reduced-motion` e navegação por teclado.
- Responsivo, com margem lateral de 16 px no celular e sem rolagem horizontal.

## 1. `site/index.html`: página inicial

**Menu superior (fixo):**
- Logo à esquerda.
- Itens: Jogar, Arcano, Online, Espectador, Ranking, Como jogar (âncora).
- À direita, "Entrar". Com sessão, mostra o nome e a nota do jogador.
- No celular, os itens vão para um menu.

**Hero (tela inteira) com simulação ao vivo em Three.js:**

*Tabuleiro:*
- Tabuleiro 3D com as peças reais do Meshy:
  - Arquivos: `../assets/meshy/<slug>/animated.opt.gltf.json` (peao, bispo, dama, rei, arqueiro) e `model.opt.gltf.json` (torre_base, cavalo_montado, torre, cavalo).
  - Lanceiro: `peao_lanca/animated.opt.gltf.json`.
  - Golpes e mortes: `golpes.gltf.json` de cada peça.
  - Comemoração: `cheer.gltf.json` (bispo, dama, rei).
  - Antes de carregar, conferir no `../assets/meshy/manifest.json` (campo `files`) se o arquivo existe.
- Ver como o jogo carrega e posiciona os modelos: `coroa-de-cinzas.html`, por volta das linhas 6600–6990 (`MESHY_FILES`, `loadGltf`). O jogo também mostra a escala (o rig do Meshy tem armadura com escala 0,01), a altura e a rotação.

*A partida:*
- Uma partida de verdade: a "Partida da Ópera" (Morphy, 1858), que termina em mate em 17 lances.
- Tocada em loop e acelerada (cerca de 1,5 s por lance). Converter os lances com chess.js.
- Depois de cada ciclo, recomeça com uma transição.

*Lances e capturas:*
- Lance comum: a peça desliza, com a animação Idle ou walk.
- Captura:
  - A câmera corta para um close do duelo.
  - O atacante usa o clipe certo:
    - lâmina: `Thrust_Slash` ou o ataque padrão do personagem;
    - arremesso: `Over_Shoulder_Throw`;
    - frasco, granada ou veneno: `Crouch_Charge_and_Throw`;
    - mago: `Charged_Spell_Cast` ou `mage_soell_cast`.
  - A vítima cai com a morte do tipo do golpe: `Electrocuted_Fall` (magia), `Shot_and_Blown_Back` (explosão), `Shot_and_Fall_Forward` (arremesso), `Strangled_and_Fall_Forward` (veneno), `dying_backwards` (lâmina).
  - Efeitos procedurais: frasco em arco com clarão e fumaça, espada girando, orbe colorido, nuvem verde.
  - A tabela de pares atacante × vítima está em `data/plano-golpes.md`. O cavaleiro é um guerreiro montado: quem luta é o cavaleiro, o cavalo não atropela.

*Transmutações e duelos:*
- Pausas teatrais entre os lances.
- Um peão vira Lanceiro (modelo `peao_lanca`), com círculo de runas, partículas e flash.
- Depois, de tempos em tempos, uma peça vira Dama, com o mesmo efeito.
- Se existir `../assets/meshy/dragao/...gltf.json`, um cavalo vira o Dragão das Cinzas. Outra sessão está preparando esse modelo. Sem ele, pular a transformação.

*Câmera:*
- De transmissão de TV: órbita lenta e suave, com amortecimento, sem ir e voltar.
- Close só nas capturas, nas transmutações e no mate.

*Mate final:*
- O rei se ajoelha (se o clipe existir) e o vencedor comemora (`cheer`).

*Legenda ao vivo, estilo transmissão:*
- Exemplo: "O bispo captura o cavaleiro em éfe seis".
- Narração opcional com os pedaços de `../assets/audio/narr/*.mp3`. Regras em `data/narracao.json`.
- Montagem: tocar em sequência com Web Audio, cortando o silêncio nas pontas, porque cada mp3 tem cabeçalho ID3 e não dá para emendar os arquivos.
- Som desligado por padrão, com um botão de som. A música pode ser `../assets/audio/musica_tema.mp3`.

*Por cima da cena:*
- Logo grande, uma frase de efeito curta e os botões "Jogar agora" (principal) e "Assistir ao vivo" (espectador).
- Links menores para Arcano e Online.
- Tudo legível sobre a ação: gradiente ou vinheta atrás do texto.

*Desempenho:*
- 60 fps no computador.
- No celular, qualidade reduzida: pixel ratio no máximo 1,5, sem sombras ou com sombras simples, menos partículas.
- Pausar quando a aba ficar escondida ou o hero sair da tela.
- Começar a renderizar só quando os modelos principais carregarem. Até lá, mostrar um pôster: imagem de arena em `../assets/concepts/arena_*_ref.webp`.
- Sem WebGL, ou se der erro: ficar no pôster.
- Com `prefers-reduced-motion`: cena parada, ou só o pôster.

**Seções abaixo do hero (estrutura do Godlike, conteúdo nosso):**
- **Quatro blocos com ícone:**
  - Xadrez com personagens de RPG.
  - Modo Arcano, com 41 cartas e 3 grimórios.
  - Online ranqueado, com Glicko-2 e 4 ligas mais Grão-Mestre.
  - 9 arenas.
- **Vitrine das cartas:** carrossel com `../assets/cards/web/*.jpg` (41 cartas). Nome, tipo e custo vêm do catálogo em `data/cartas.json`.
- **Galeria das arenas:** usar `../assets/concepts/arena_*_ref.webp`.
- **Contadores animados:** 41 cartas, 9 arenas, 6 personagens (ou o número certo), 5 ligas.
- **Prévia do ranking:** top 5 da API, com o link "Ver ranking completo".
- **"Como jogar":** três passos curtos.
- **Faixa de chamada** "Entre na batalha" e **rodapé**.

## 2. `site/ranking.html`

**Dados da API:**
- `GET /api/leaderboard?pool=xadrez|arcano` devolve `{ top:[{ rank, name, r, games }] }`. São até 50 nomes, e só contas com nota já firme (RD ≤ 110).
- `GET /api/config` devolve `leagues` e `grandmaster`, para calcular a liga pela nota.

**Página:**
- Abas Xadrez e Arcano.
- Pódio dos 3 primeiros e tabela com posição, nome, nota, partidas e selo da liga.
- Se houver sessão, mostrar "Sua nota", com os dados de `/api/me`.
- Estado vazio caprichado. Hoje o ranking está vazio; o texto deve explicar como entrar nele: criar conta e jogar partidas ranqueadas.
- Explicação das ligas com as notas mínimas.
- Estados de carregando e de erro: servidor fora do ar.
- O `/api/leaderboard` não manda o id do jogador, então ainda não dá para abrir o perfil a partir do ranking. Deixar anotado para a integração.

## 3. `site/login.html`

**Sessão:**
- Guardar no localStorage `coroa-de-cinzas:online`, como `{ token, name }`. É a mesma chave do jogo, então a sessão vale nos dois.

**Sem sessão:**
- "Jogar como convidado": `POST /api/guest { name }`, nome de 3 a 20 letras ou números.
- Botões "Entrar com Google" e "Entrar com Discord", vindos de `GET /api/auth/providers`. Hoje essa lista vem vazia; nesse caso, mostrar "em breve".
- Iniciar o login: `POST /api/auth/start { provider, return:<esta página> }`, com o token do convidado quando houver, para juntar a conta, e depois ir para a `url` que voltar.
- Na volta, tratar `#login=<código>` com `POST /api/auth/exchange { code }`, que devolve token e user.
- Tratar `#login-erro=<estado|cancelado|pkce|provedor>` com as mesmas mensagens do jogo.

**Com sessão:**
- Cartão da conta: nome, tipo (convidado ou conta), notas e ligas de `/api/me`.
- Trocar o nome: `POST /api/name`, que devolve um token novo.
- Pedir a data de nascimento quando a conta não tiver (`POST /api/me/birth`).
- Botão "Sair".

## Arquivos

- `site/index.html`, `site/ranking.html`, `site/login.html`.
- Arquivos comuns: `site/assets/site.css`, `site/assets/site.js` (API, sessão, menu, link do jogo) e `site/assets/hero.js`.
- `site/INTEGRACAO.md`, com:
  - como publicar no Pages;
  - os caminhos;
  - o que o jogo precisa ganhar: os atalhos `#modo=arcano|online|espectador`, para os botões abrirem direto no modo certo;
  - o que o servidor precisa ganhar: o id no leaderboard;
  - os testes feitos.

## Teste antes de entregar

- Abrir as três páginas em `http://127.0.0.1:8767/site/` no navegador, no computador e no celular (375 px).
- Medir o fps do hero.
- Conferir que não há erros no console.
- Testar o login de convidado contra a API real (cria um convidado de teste; é aceitável).
- Mandar capturas de tela.
