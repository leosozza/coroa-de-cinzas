# Site do Arcane Chess: integração

Páginas: `index.html` (início com o hero ao vivo), `ranking.html` e `login.html`.
Arquivos comuns: `assets/site.css`, `assets/site.js`, `assets/hero.js` e `assets/torn.svg` (a borda rasgada).
HTML, CSS e JS puros, sem bundler. Bibliotecas por CDN, carregadas só pelo hero: Three.js r128 (cdnjs), GLTFLoader, DRACOLoader e SkeletonUtils da r128 (jsdelivr) e chess.js 0.10.3 (cdnjs).

## 1. Caminhos

Tudo o que muda de lugar está no começo de `assets/site.js`:

| O quê | Em `/site/` (teste local) | Com as páginas na raiz do Pages | Como trocar |
|---|---|---|---|
| Jogo | `../coroa-de-cinzas.html` | `/jogar.html` | detecção automática pela pasta `/site/`; ou `<meta name="ac-game" content="...">` |
| Assets do jogo | `../assets/` | `../assets/` vira `/assets/` sozinho | `<meta name="ac-assets">` |
| Dados | `../data/` | `/data/` | `<meta name="ac-data">` |
| API | `https://arcane-chess-api.leonardo-zogbi.workers.dev` | igual | `API_PROD`; teste: `?api=http://127.0.0.1:8787` (só endereços locais, como o `netApi()` do jogo) |

- Os links do jogo têm `data-game="" | "arcano" | "online" | "espectador"` e o `site.js` monta `JOGO#modo=<modo>`.
- O `href` escrito no HTML (`../coroa-de-cinzas.html`) é só a reserva sem JavaScript.
- Com `?api=` na URL, os links internos e o do jogo levam o mesmo `?api=`.
- A sessão fica em `localStorage["coroa-de-cinzas:online"] = { token, name }`, a mesma chave do jogo. Entrou no site, já entra no jogo, e o contrário também.

## 2. Publicar no Pages (quem publica é a outra sessão)

O `tools/deploy_pages.sh` de hoje põe o jogo em `index.html` e só copia mp3, cartas, `.gltf.json` e o manifesto. Para o site ir junto, com as páginas na raiz:

1. O jogo vai de `index.html` para `jogar.html`.
2. `site/index.html`, `site/ranking.html` e `site/login.html` vão para a raiz.
3. `site/assets/*` (`site.css`, `site.js`, `hero.js`, `torn.svg`) vai para `/assets/`. Não colide com nada: lá só há as pastas `audio`, `cards`, `meshy` etc.
4. Copiar também, porque o script de hoje não copia:
   - `assets/concepts/arena_*_ref.webp`: pôster do hero, galeria e fundo dos cabeçalhos;
   - `assets/meshy/{peao,bispo,dama,rei,arqueiro}/thumbnail.png`: retratos das falas;
   - `data/cartas.json` e `data/narracao.json`: vitrine das cartas e legendas do narrador.
5. Os `.c.gltf.json` (Draco) já entram pelo `find "*.gltf.json"`. O hero prefere eles, porque têm 40% do tamanho, e cai para o `.opt.gltf.json` se o Draco falhar.
6. Sem JavaScript, os links apontam para `../coroa-de-cinzas.html`. Vale um `_redirects` com `/coroa-de-cinzas.html /jogar.html 301`.
7. Links antigos `https://arcanechess.pages.dev/#sala=XXXX`, `#login=` e `#login-erro=` passam a cair na página inicial. O `site.js` já repassa esses três para o jogo, com o mesmo hash. Mesmo assim, vale o servidor gerar `PUBLIC_URL/jogar.html#sala=` (ver 4).

Se o site ficar em `/site/` no Pages, ponha `<meta name="ac-game" content="/jogar.html">` (ou o caminho real do jogo) nas três páginas.

## 3. O que o jogo precisa ganhar

**Atalhos `#modo=`.** Os botões do site abrem `jogar.html#modo=arcano|online|espectador`, e `#modo=padrao` se quiserem. Sugestão, ao lado do `onlineHash()`, chamada na carga e no `hashchange`:

```js
function modoHash(){
  const m = location.hash.match(/^#modo=(padrao|arcano|online|espectador|aprendiz)$/);
  if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e){}
  if (!TITLE.open) openTitle();
  showSetup(m[1] === 'espectador' ? 'spec' : m[1]);
  return true;
}
```

**Volta do login.** O site trata `#login=` e `#login-erro=` em `login.html`, com as mesmas mensagens do jogo (`LOGIN_ERR`). O jogo continua tratando os dele.

**Sessão.** Nada a fazer: mesma chave e mesmo formato. O site só lê `/api/me` e nunca cria convidado sozinho. O convidado só é criado quando a pessoa clica em "Jogar como convidado".

**Ligas.** A mesma regra do servidor está em `site.js` (`leagueOf`), lida de `/api/config`.

## 4. O que o servidor precisa ganhar

1. **Id no leaderboard.** `GET /api/leaderboard` devolve `{ rank, name, r, games }` sem o id do jogador, então o ranking ainda não abre o perfil (`/api/profile/:id`). Basta pôr `users.id AS id` no SELECT e `id` em cada linha. Com o id, cada nome do ranking pode virar link para o perfil. Ainda não há página de perfil no site: o perfil hoje vive dentro do jogo.
2. **Liga no leaderboard (opcional).** Hoje a página calcula a liga com `/api/config`. Mandar `league` e `leagueName` por linha evita duplicar a regra.
3. **Regra do Grão-Mestre.** Pela regra atual (conta, nota firme, posição ≤ 500), todo o top 50 sai como Grão-Mestre enquanto houver menos de 500 contas firmes. A página mostra o que a regra diz. Se não for a intenção, a mudança é no `glicko2.js`.
4. **`PUBLIC_URL` e o link de sala.** `POST /api/rooms` monta `${PUBLIC_URL}/#sala=`. Com o jogo em `/jogar.html`, o link deve ser `${PUBLIC_URL}/jogar.html#sala=`. O cliente do jogo monta o link pelo `location`, mas o campo `link` da resposta ficaria errado.
5. **CORS.** `ALLOWED_ORIGINS` já tem `arcanechess.pages.dev`, `localhost:8767` e `127.0.0.1:8767`. Um domínio próprio, ou um ramo de prévia como `teste.arcanechess.pages.dev`, precisa entrar na lista para o ranking e o login funcionarem lá.
6. **Login.** `/api/auth/start` aceita `return` em qualquer origem permitida. O `login.html` manda o próprio endereço e trata `#login=` e `#login-erro=`. Hoje `providers` vem vazio: os botões aparecem com "em breve" e ficam desativados.

## 5. O hero

- **Partida.** A Partida da Ópera (Morphy, 1858), 33 lances em SAN convertidos com chess.js, em loop.
  - Cada ciclo: as peças sobem do chão, os lances, o mate, um escurecimento e recomeça.
- **Lances comuns.** Cada personagem anda do seu jeito, como no README do jogo:
  - o bispo se teleporta;
  - a dama vira raio;
  - a torre afunda e brota;
  - o cavaleiro salta;
  - peão e rei caminham (o rei com o `walk.gltf.json`).
- **Capturas.** Corte para o close do duelo, com faixas de cinema. O golpe sai da matriz de `data/plano-golpes.md`:
  - os clipes de golpe e morte vêm dos `golpes.gltf.json`, tocados no modelo visível (mesmo esqueleto);
  - os efeitos são procedurais: espada girando, flechas, frasco com explosão e fumaça, nuvem de veneno, orbes, raio e gelo;
  - sem o clipe certo, ficam o ataque padrão e `dying_backwards`.
- **Transmutações** (pausas teatrais):
  - no lance 6, o peão de e4 vira **Lanceiro** (`peao_lanca`);
  - no lance 11, num ciclo, um peão da Legião vira **Dama**; no outro, o cavaleiro de f6 vira o **Dragão das Cinzas**. O dragão só entra no nível alto e se `dragao/animated.opt.gltf.json` estiver no manifesto. Sem ele, fica a Dama.
- **Mate.** O rei negro se ajoelha (`Kneel_on_One_Knee_and_Stand`, pausado no meio) e é levado numa luz dourada para o campo das brancas. O rei e o bispo brancos comemoram (`cheer`). Aparece o carimbo "Xeque-mate".
- **Transmissão.**
  - Selo AO VIVO e placar com as peças capturadas.
  - Rótulo de câmera: CÂM 1 arena, CÂM 2 transmutação, CÂM 3 duelo, CÂM 4 mate.
  - Faixa inferior com a legenda: os textos vêm de `data/narracao.json`, a casa vai em notação.
  - Botões de som e de pausa.
- **Narração.** Opcional: começa desligada. O botão de som liga a narração e a `musica_tema.mp3`.
  - Os mp3 de `assets/audio/narr/` tocam em sequência com Web Audio, cortando o silêncio das pontas.
  - Enquanto o narrador fala, a música abaixa.
  - Se o narrador ainda estiver falando, o lance comum é pulado.
- **Níveis de qualidade.**

  | Nível | Pixel ratio máximo | Sombras | Brasas | Golpes, comemoração e dragão |
  |---|---|---|---|---|
  | `high` | 1,75 | PCF suave, 2048 | 560 | todos |
  | `mid` | 1,25 | PCF, 1024 | 300 | golpes e comemoração, sem dragão |
  | `low` (celular / toque) | 1,5 | nenhuma (sombra-disco sob as peças) | 140 | nenhum |

  - Se o fps ficar abaixo de 40 por 4 s, o pixel ratio desce de 0,25 em 0,25 até 1, e depois as sombras desligam.
  - Para forçar um nível: `?q=low|mid|high`.
- **Carregamento.**
  - Pôster (`arena_infernal_ref.webp`) até os 7 modelos principais chegarem: peão, bispo, dama, rei, cavaleiro montado, base da torre e arqueiro, cerca de 3,3 MB em Draco.
  - Depois, em segundo plano: Lanceiro, golpes (só as animações; o JSON é limpo de malhas e texturas antes do parse), comemoração e dragão (4,7 MB, só no nível alto).
  - Os scripts só carregam no `load` + tempo ocioso.
- **Pausa.** O hero pausa com a aba escondida, fora da tela ou pelo botão.
  - Sem WebGL ou com erro, fica no pôster com um link para o modo espectador.
  - Com `prefers-reduced-motion`, fica no pôster e mostra "Iniciar a transmissão".
- **Parâmetros de teste.** `?lance=N` pula para o lance N no primeiro ciclo; `?ciclo=2` começa no ciclo do dragão.
- **Diagnóstico.** `window.__heroStats` (nível, pixel ratio, fps, arquivos carregados, erros, lance, fase) e `window.__hero`.

## 6. Testes feitos (06/11/2026, `http://127.0.0.1:8767/site/`)

- **Modelos.** Os 7 principais em `.c.gltf.json` (Draco), o `rei/walk`, o Lanceiro, os 5 `golpes`, 2 `cheer` e o dragão: 17 arquivos, sem erro de carga.
- **fps** (requestAnimationFrame, de 5 a 6 s):

  | Tela | Nível | Pixel ratio | fps | Pior quadro |
  |---|---|---|---|---|
  | Computador, 1440×900 | high | 1 | 59,8, durante um duelo | 34,8 ms |
  | Computador, 1440×900 | mid | 1 | 57,6 | — |
  | Celular emulado, 375×812 (toque) | low | 1,5 | 59,9 | — |

- **Console.** Nenhum erro nem aviso no uso normal das três páginas. Os únicos erros registrados vieram dos testes de falha de propósito:
  - API apontada para uma porta sem servidor;
  - código `#login=` inválido, com resposta 400.
- **Login de convidado contra a API real.** Funcionou de ponta a ponta:
  - nome inválido recusado no próprio formulário;
  - `POST /api/guest` com "Teste Site 01", que criou um convidado de teste;
  - `/api/me` com as duas notas: 1500 provisória, Mestre Arcano;
  - menu com o nome e a nota;
  - troca de nome para "Teste Site 02" (`/api/name`, ficha nova salva).
- **Outros estados do login.**
  - `#login=` inválido: "O login expirou".
  - `#login-erro=cancelado` e `#login-erro=pkce`: as mensagens do jogo, e a URL é limpa.
  - Provedores vazios: Google e Discord aparecem "em breve".
- **Ranking.**
  - Real e vazio: estado vazio com os três passos.
  - Cheio, com uma API falsa local (`?api=http://127.0.0.1:8788`): pódio, tabela, ligas e "Sua nota".
  - Servidor fora: aviso e "Tentar de novo".
- **Celular, 375 px.** Sem rolagem horizontal nas três páginas. Menu recolhido em painel, com fechamento pelo Esc.
- **Capturas.** Estão em `site/capturas/`.
