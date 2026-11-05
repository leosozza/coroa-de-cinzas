---
name: jogo-3d-com-ia
description: Receita completa para criar um jogo 3D no navegador (Three.js, publicado como Artifact) com personagens, arte e som gerados por IA — arte-conceito no Gemini, modelos 3D com rig e animações no Meshy, efeitos sonoros, narrador e música no ElevenLabs — e com animações de ataque, efeitos, câmera cinematográfica estilo fatality, cemitério, vistas de câmera e IA. Baseada no jogo "Coroa de Cinzas" (xadrez com personagens de RPG). Use quando o usuário quiser criar outro jogo 3D, um jogo de tabuleiro com personagens, um RPG/tático no navegador, gerar personagens 3D com IA, usar Meshy, Gemini ou ElevenLabs num jogo, ou reaproveitar o pipeline do Coroa de Cinzas.
---

# Jogo 3D com IA (pipeline do Coroa de Cinzas)

Esta skill registra como o jogo **Coroa de Cinzas** foi feito do zero: xadrez clássico em 3D, cada peça um personagem com poderes, capturas em câmera cinematográfica, cemitério ao lado da arena, narrador e trilha sonora. Use-a como roteiro para o próximo jogo.

O jogo completo está em [exemplo/coroa-de-cinzas.html](exemplo/coroa-de-cinzas.html) (~4.500 linhas, um arquivo só). Os scripts que geraram todos os assets estão em [scripts/](scripts/).

## O pipeline em 7 etapas

| # | Etapa | Ferramenta | Referência |
|---|-------|------------|------------|
| 1 | Conceito, regras e identidade de cada personagem | conversa com o usuário | abaixo |
| 2 | Arte-conceito de cada personagem (estilo coerente) | Gemini (API de imagem) | [01-arte-gemini.md](references/01-arte-gemini.md) |
| 3 | Modelo 3D + textura + rig + animações | Meshy (API ou MCP) | [02-modelos-meshy.md](references/02-modelos-meshy.md) |
| 4 | Otimizar e preparar para publicar | gltf-transform + glb→json | [03-otimizacao-e-publicacao.md](references/03-otimizacao-e-publicacao.md) |
| 5 | Cena, personagens, ataques, efeitos e câmera | Three.js r128 | [04-threejs-personagens.md](references/04-threejs-personagens.md), [05-ataques-efeitos-camera.md](references/05-ataques-efeitos-camera.md) |
| 6 | Efeitos sonoros, narrador e música | ElevenLabs | [06-audio-elevenlabs.md](references/06-audio-elevenlabs.md) |
| 7 | Regras, IA, interface, testes e publicação | chess.js, Worker, Artifact | [07-regras-ia-interface.md](references/07-regras-ia-interface.md) |

Antes de começar, leia [08-licoes-aprendidas.md](references/08-licoes-aprendidas.md): ela evita os erros que custaram tempo e créditos.

## Etapa 1 — Conceito (decidir antes de gastar créditos)

Feche com o usuário, por escrito:
- **Regras**: o jogo usa regras conhecidas (ex.: xadrez padrão) ou mecânicas próprias? No Coroa de Cinzas o usuário quis "regras iguais ao xadrez, só os gráficos de RPG" — a primeira versão com PV/dano/níveis foi descartada.
- **Elenco**: quais personagens, se os dois lados usam os mesmos modelos (mais barato: 1 modelo, tingido por lado) ou modelos diferentes.
- **Identidade de cada personagem**: aparência, elemento/poder, como se move e como ataca. Exemplo do Coroa de Cinzas:
  - Peão: soldado com elmo, escudo e lança — estocada.
  - Cavalo: cavalo de guerra com cavaleiro montado — galopa, salta em arco, carga de lança.
  - Torre: torre de pedra com arqueiro no topo, domina a terra — afunda e brota na casa de destino; ataca com flechas e espinhos de terra.
  - Bispo: mestre da magia — círculo de runas, teleporte, mísseis arcanos.
  - Dama: eletricidade, rápida como a luz — vira um raio e cruza o tabuleiro.
  - Rei: rei de armadura com espada.
- **Humanoide ou não?** Personagem humanoide bípede → Meshy com rig e animações. Não humanoide (cavalo montado, torre, veículo, criatura) → só o modelo estático, animado pelo jogo inteiro (salto, afundar, inclinar). Isso economiza créditos.
- **Estilo visual** e paleta (ex.: fantasia sombria; marfim/ouro/aço/vermelho para um lado, ferro enegrecido/osso/carmesim para o outro).

## Etapa 2 a 4 — Assets (resumo)

1. Gere **um** personagem no Gemini, aprove com o usuário e use essa imagem como **referência de estilo** para os demais (`scripts/gemini_images.py`).
2. Mande cada imagem ao Meshy com `image-to-3d` (meshy-6-lite, ~8 mil polígonos, `pose_mode: a-pose` só para humanoides), depois rig e animações (`scripts/meshy_gen.py --from-image`). Rode as peças em paralelo.
3. O A-pose remove o que o personagem segura: espadas, cajados e escudos voltam como **adereços procedurais presos aos ossos da mão**.
4. Otimize (texturas 1024 WebP) e converta cada `.glb` para `.gltf.json` (`scripts/glb_to_json.py`), porque Artifacts não servem `.glb`.

Custos de referência (Meshy, novembro/2026): humanoide da imagem ≈ 29 créditos (15 modelo+textura, 5 rig, 3×3 animações; a caminhada vem grátis no rig); estático ≈ 15. Confirme o saldo antes e mostre o custo ao usuário.

## Etapa 5 — Arquitetura do jogo (um arquivo HTML)

- **Lógica separada da animação**: a lógica aplica a jogada e gera uma lista de eventos (`move`, `capture`, `castle`, `promo`, `check`, `mate`); `play(ev)` anima cada evento com `await`. A IA só pensa depois que a animação termina.
- **Adaptador de personagem** `makeCharacter(type, side)` com `play(nome)` (Promise que resolve no quadro de impacto), `faceTowards`, `setFlash`, `setSelected`, `anchor('tip')`, `headHeight`. Primeiro um modelo procedural; os GLB substituem cada peça quando terminam de carregar — o jogo nunca espera o download.
- **Coreografia por tipo de peça** (movimento e captura), câmera de combate, partículas, decalques e luzes de efeito: ver [05-ataques-efeitos-camera.md](references/05-ataques-efeitos-camera.md).

## Etapa 6 — Som

ElevenLabs gera ~25 efeitos sob medida para cada poder, 1 ambiente em loop, 1 música tema e as falas do narrador (`scripts/elevenlabs_audio.py`). No jogo: Web Audio com 4 barramentos (música, ambiente, efeitos, voz), carregamento só no primeiro gesto, música abaixando durante cenas e falas, e fallback sintetizado.

## Etapa 7 — Publicar como Artifact

- Página sem `<html>/<head>/<body>`; scripts só de cdnjs/jsDelivr com versão fixa; assets publicados em `files` com caminhos relativos.
- Tipos servidos: `.mp3`, `.json`, `.webp`, `.png`… **não `.glb`**.
- A CSP bloqueia `fetch()` de `blob:` → troque o `ImageBitmapLoader` para carregar texturas por `<img>` (trecho em [03](references/03-otimizacao-e-publicacao.md)).
- Teste localmente com um servidor que imita a CSP (`scripts/servidor_csp.py`) e depois abra o link publicado.

## Chaves e segurança

- Guarde as chaves no Keychain do macOS e leia nos scripts sem imprimir:
  `security add-generic-password -a "$USER" -s meshy-api-key -w` (idem `gemini-api-key`, `elevenlabs-api-key`). Cole a chave **só quando o terminal pedir**; digitada solta, ela vai para o histórico do shell.
- O MCP do Meshy está instalado (`~/.config/meshy/meshy-mcp.sh`, lê a chave do Keychain); em sessões novas as ferramentas `mcp__meshy__*` também servem.
- Nunca use vozes clonadas de pessoas reais; use vozes profissionais ou premade da biblioteca.

## Arquivos da skill

| Arquivo | Para quê |
|---|---|
| `scripts/gemini_images.py` | artes-conceito (lê `gemini-api-key` do Keychain; saída em `assets/concepts/<slug>.jpg`) |
| `scripts/meshy_gen.py` | imagem → modelo → rig → animações (`--from-image <slug>`; saída em `assets/meshy/<slug>/`) |
| `scripts/glb_to_json.py` | `.glb` → `.gltf.json` para o Artifact |
| `scripts/elevenlabs_audio.py` | efeitos, narrador e música (saída em `assets/audio/`) |
| `scripts/servidor_csp.py` | servidor local com a CSP do Artifact |
| `scripts/chess_ai_harness.js` | teste da lógica e IA do xadrez em Node (perft + partidas IA×IA) |
| `exemplo/coroa-de-cinzas.html` | o jogo completo, para copiar cena, efeitos, câmera e áudio |
| `exemplo/arte/` | as 6 artes-conceito, como referência de estilo |

Os scripts Python usam a pasta-mãe de `tools/` como raiz do projeto: copie-os para `<projeto>/tools/`.

## Como usar esta skill num jogo novo

1. Leia a etapa 1 e feche o conceito com o usuário.
2. Copie os scripts para a pasta do projeto (`tools/`) e ajuste os dicionários de personagens, prompts e sons.
3. Gere a arte, aprove, gere os modelos, otimize e converta.
4. Construa o jogo partindo do exemplo: reaproveite cena, adaptador de personagem, sistema de efeitos, câmera de combate, áudio e vistas; troque regras, personagens e coreografias.
5. Teste (lógica em Node, navegador desktop e 375 px, CSP simulada) e publique com todos os assets em `files`.
