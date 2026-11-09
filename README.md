# Arcane Chess — The Battle for the Grimoire

**Jogue:** https://arcanechess.pages.dev (o jogo fica em [/jogar](https://arcanechess.pages.dev/jogar))

Xadrez em 3D com alma de RPG sombrio (antes chamado Coroa de Cinzas). Cada peça é um personagem do seu reino, cada captura vira uma cena de combate com câmera cinematográfica, e o xeque-mate é dado pelo avatar do reino vencedor. O modo Padrão segue as regras clássicas do xadrez; o modo Arcano acrescenta cartas, essência e transformações.

Versão atual: **v33.1** (veja o [histórico de commits](https://github.com/leosozza/coroa-de-cinzas/commits/main)).

## Modos

| Modo | O que é |
|---|---|
| Padrão | Xadrez clássico contra a IA (Recruta, Veterano, Mestre) ou a dois no mesmo aparelho, com relógio opcional. |
| Espectador | IA contra IA com velocidade, séries (melhor de 3/5), pausa, voltar lance e assumir um lado. Câmera de transmissão que acompanha os lances. |
| Aprendiz | Sete lições guiadas com narração, dicas do motor e insígnias. |
| Arcano | Xadrez com 41 cartas (Magia, Ataque, Defesa, Terreno), essência, runas, armadilhas e evoluções das peças. Contra a IA, a dois ou IA × IA. |
| Online | Partida por link e filas casual e ranqueada (Xadrez Puro e Arcano), com contas, nota Glicko-2, ligas, ranking, relógio e reconexão. Servidor autoritativo em Cloudflare Workers + Durable Objects + D1 ([server/](server/LEIA.md)). |

## Reinos (equipes)

Oito reinos, escolhidos para as Brancas e as Negras na tela de partida. Cada um tem peças próprias (modelos 3D animados), golpes com nome e som próprios, morte da vítima, arena, mascote/chefão, xeque-mate cinematográfico e as suas versões das evoluções do Arcano.

| Reino | Arena | Mascote / xeque-mate |
|---|---|---|
| Reino da Aurora | arenas clássicas (Fortaleza, Ruínas, Celestial, Olimpo, Zodíaco, Multiverso, Pedra Filosofal, Fogo x Gelo) | Arcanjo dourado |
| Legião do Ferro Negro | Mistério Infernal | Deus da Morte |
| Reino dos Dragões | Covil dos Dragões | Dragão gigante |
| Alpha da Lua Nova | Vigília da Lua Cheia | Lobo gigante que vira lobisomem |
| Clã dos Primatas | Templo da Selva Perdida | Ídolo gorila de pedra |
| Abismo Estelar | Nave-Colmeia Naufragada | Rainha-Mãe |
| Clã do Mar Profundo | Cidade Afundada | Kraken |
| Império do Deserto Subterrâneo | Necrópole sob as Dunas | Verme-Colosso |

## Recursos

- Regras completas do xadrez (xeque, mate, roque, en passant, promoção, empates) por chess.js; motor de busca próprio 0x88 (negamax, alfa-beta, quiescência, aprofundamento iterativo) num Web Worker.
- Motor de regras do Arcano ([engine/arcano-rules.js](engine/arcano-rules.js)) compartilhado pelo jogo e pelo servidor online.
- Câmera de combate: close sem peças na frente, câmera lenta, legendas por golpe; encerramentos de xeque-mate em planos de cinema.
- Vistas Padrão (transmissão), Foco, Drone e Aérea; modo cinema no celular (retrato e paisagem).
- Áudio: música e ambiente por arena, efeitos, pacote de sons por reino (passos, montaria, golpes, morte, mascote, vinheta) e narração lance a lance em português.
- Minimapa, ficha da peça em 3D, cemitério, crônica e linha do tempo do Arcano.

## Testes

| Teste | O que garante |
|---|---|
| `node tools/engine-sync-check.js coroa-de-cinzas.html engine/arcano-rules.js` | o motor embutido no jogo é idêntico ao do servidor |
| testes do Arcano (perft contra chess.js, 120 partidas, ida e volta do estado) | as regras do Arcano não divergem do xadrez clássico nem entre cliente e servidor |
| auditoria das 41 cartas | cada texto de carta descreve o que o motor faz |
| [server/test/](server/test) | glicko-2, filas, contas e partidas de ponta a ponta |

## Como os assets são feitos

| Asset | Ferramenta | Script |
|---|---|---|
| Artes-conceito das peças, chefes e cenário | Gemini / Meshy (imagem) | [tools/gemini_images.py](tools/gemini_images.py), [tools/meshy_reino.py](tools/meshy_reino.py) |
| Modelos 3D, rig e animações | Meshy | [tools/meshy_reino.py](tools/meshy_reino.py), [tools/meshy_chefe.py](tools/meshy_chefe.py) |
| Correções de rig (armas rígidas, quadrúpedes) | Blender | [tools/blender/](tools/blender) |
| Otimização (`.glb` → webp → draco → `.gltf.json`) | gltf-transform + Python | [tools/glb_to_json.py](tools/glb_to_json.py), [tools/meshy-manifest.js](tools/meshy-manifest.js) |
| Efeitos, narrador, músicas e sons por reino | ElevenLabs | [tools/elevenlabs_audio.py](tools/elevenlabs_audio.py), [tools/elevenlabs_reinos.py](tools/elevenlabs_reinos.py) |

As chaves das APIs nunca ficam no código: os scripts leem do Keychain do macOS (`security add-generic-password -a "$USER" -s <servico>-api-key -w`). O passo a passo do pipeline está em [skill/](skill/SKILL.md).

## Clipes e Reels

- No jogo, a barra das vistas tem **● Gravar** (grava a cena em vídeo vertical 1080×1920 com som) e **Clipes automáticos** (um clipe por captura e por xeque-mate, com a legenda do golpe, o confronto, a marca e o mapinha do tabuleiro com a seta do lance).
- [tools/reels/](tools/reels): o Reel automático do Instagram (@arcanechess_oficial). `reel_auto.mjs` abre o jogo no Chrome, assiste uma partida IA × IA entre dois reinos sorteados, monta o vídeo (closes das capturas + o xeque-mate) com ffmpeg, hospeda o MP4 em `midia.arcanechess.pages.dev` e publica pela API da Meta. `instalar.sh` instala em `~/ArcaneChessReels` e agenda de hora em hora no launchd (`--parar` desliga). O token fica no Keychain (`instagram-api-key`).

## Estrutura

```
coroa-de-cinzas.html      o jogo (HTML único: Three.js r128 + chess.js)
engine/                   motor de regras do Arcano (também usado pelo servidor)
server/                   API online (Cloudflare Worker, Durable Objects, D1)
site/                     página inicial, ranking e login
assets/concepts/          artes-conceito
assets/meshy/             modelos (.opt.c.gltf.json servidos) e manifest.json
assets/audio/             músicas, efeitos, narração e pacotes por reino (pack.json)
assets/cards/             artes das cartas
assets/textures/          texturas das arenas
data/                     cartas, reinos e narração
tools/                    scripts de geração, otimização e publicação
```

## Rodar localmente

O arquivo do jogo não tem `<!doctype>` nem `<head>` (o Artifact e o deploy acrescentam). Para testar com os assets, sirva a pasta do projeto e embrulhe o HTML, como faz o deploy:

```bash
tools/deploy_pages.sh coroa-de-cinzas.html /tmp/arcane teste   # publica a prévia em teste.arcanechess.pages.dev
```

ou monte um `index.html` com `<meta charset="utf-8">` e `<meta name="viewport" ...>` antes do conteúdo e abra com `python3 -m http.server`. Sem os assets, o jogo usa personagens geométricos e sons sintetizados.
