---
name: jogo-3d-com-ia
description: Receita completa para criar um jogo 3D no navegador (Three.js, publicado como Artifact) com personagens, arte e som gerados por IA — arte-conceito e ilustrações de cartas no Gemini, modelos 3D com rig e animações no Meshy, efeitos, narrador e músicas no ElevenLabs — com animações de ataque, efeitos, câmera de combate estilo fatality, arenas temáticas, tela inicial, modos de jogo (padrão, espectador IA x IA, aprendiz, cartas estilo TCG), minimapa, cemitério e IA. Baseada no Arcane Chess (antes Coroa de Cinzas), xadrez com personagens de RPG. Use quando o usuário quiser criar outro jogo 3D, um jogo de tabuleiro ou de cartas com personagens, um RPG/tático no navegador, gerar personagens, cartas ou arenas com IA, usar Meshy, Gemini ou ElevenLabs num jogo, ou reaproveitar o pipeline do Arcane Chess.
---

# Jogo 3D com IA (pipeline do Arcane Chess)

Esta skill registra como o **Arcane Chess** foi feito do zero: xadrez clássico em 3D em que cada peça é um personagem com poderes, as capturas viram cenas de combate, há 10 arenas temáticas, tela inicial com modos de jogo, minimapa 2D, narrador e trilha sonora, além de um modo de cartas no estilo Yu-Gi-Oh ou Magic. Use-a como roteiro para o próximo jogo.

- **O jogo completo:** [exemplo/arcane-chess.html](exemplo/arcane-chess.html), um arquivo só, com ~520 KB.
- **Os dados de design:** [exemplo/dados/](exemplo/dados/) (`regras.md` e `cartas.json`).
- **Os scripts que geraram todos os assets:** [scripts/](scripts/).
- **Publicado em:** https://claude.ai/artifact/21JC5PUcNBUKDAEPDuqCf6
- **Repositório:** github.com/leosozza/coroa-de-cinzas (privado).

## O pipeline

| # | Etapa | Ferramenta | Referência |
|---|-------|------------|------------|
| 1 | Conceito, regras e identidade de cada personagem | conversa + documento Claude Docs | abaixo, [10](references/10-modos-cartas-interface.md) |
| 2 | Arte-conceito dos personagens e das cartas (estilo coerente) | Gemini | [01](references/01-arte-gemini.md), [10](references/10-modos-cartas-interface.md) |
| 3 | Modelo 3D + textura + rig + animações | Meshy (API ou MCP) | [02](references/02-modelos-meshy.md) |
| 4 | Otimizar e preparar para publicar | gltf-transform + glb→json | [03](references/03-otimizacao-e-publicacao.md) |
| 5 | Cena, personagens, ataques, efeitos e câmera | Three.js r128 | [04](references/04-threejs-personagens.md), [05](references/05-ataques-efeitos-camera.md) |
| 6 | Arenas temáticas | construtores compartilhados | [09](references/09-arenas-tematicas.md) |
| 7 | Efeitos, narrador e músicas | ElevenLabs | [06](references/06-audio-elevenlabs.md) |
| 8 | Regras, IA, modos, cartas e interface | chess.js, motor 0x88, Worker | [07](references/07-regras-ia-interface.md), [10](references/10-modos-cartas-interface.md) |
| 9 | Subagente, publicação e GitHub | Artifact, git | [11](references/11-fluxo-de-trabalho.md) |

Antes de começar, leia [08-licoes-aprendidas.md](references/08-licoes-aprendidas.md): ela evita os erros que custaram tempo e créditos.

## Etapa 1 — Conceito (antes de gastar créditos)

Feche com o usuário, por escrito, num documento Claude Docs com uma tabela de decisões:
- **Regras:** as do jogo original ou mecânicas próprias? O usuário do Arcane Chess quis "regras iguais ao xadrez, só os gráficos de RPG", e as mecânicas de cartas ficaram num modo separado (Arcano).
- **Modos:** Padrão (níveis, cor, relógio), Espectador (IA x IA), Aprendiz (lições guiadas) e Arcano (cartas).
- **Elenco:** os dois lados usam os mesmos modelos, tingidos por lado? Fica mais barato.
- **Identidade de cada personagem:** aparência, elemento ou poder, como se move e como ataca. No Arcane Chess:
  - Torre: torre com arqueiro, que domina a terra.
  - Cavalo: cavaleiro montado, com carga de lança estilo São Jorge.
  - Dama: o relâmpago.
  - Bispo: a magia.
- **Humanoide ou não?** Humanoide recebe rig e animações no Meshy. Não humanoide é um modelo estático animado inteiro, e composições como torre + arqueiro ou cavalo + lança procedural cobrem o resto.
- **Arenas:** cada uma com clima, paleta, objetos, céu, música e um gancho de captura próprio.

## Etapas 2 a 4 — Assets

1. **Gemini:** gere 1 personagem, aprove e use-o como referência de estilo dos demais (`scripts/gemini_images.py`). As cartas saem de `cartas.json` com `scripts/gemini_cards.py`.
2. **Meshy:** image-to-3D com meshy-6-lite (~8 mil polígonos).
   - `pose_mode: "a-pose"` só para humanoides.
   - Rig e animações para humanoides.
   - `scripts/meshy_gen.py --from-image <slug>`, com as peças em paralelo.
3. **O A-pose remove o que o personagem segura:** espadas, cajados, escudos e lanças voltam como adereços procedurais presos aos ossos da mão.
4. **Otimize e converta para o Artifact:** texturas em 1024 WebP e `.glb` → `.gltf.json` (`scripts/glb_to_json.py`).

**Custos de referência (Meshy):** humanoide ≈ 29 créditos e estático ≈ 15. Confirme o saldo e mostre o custo antes de gastar.

## Etapa 5 — Arquitetura do jogo (um arquivo HTML)

- **A lógica gera eventos e `play(ev)` os anima com `await`.** A IA pensa num Web Worker e só depois que a animação termina.
- **Adaptador `makeCharacter(type, side)`:** o modelo procedural vem primeiro, e os GLB substituem cada peça quando terminam de carregar.
- **Só a peça selecionada fica animada;** as outras ficam em pose de descanso.
- **Coreografia por tipo de peça** (movimento e captura), mais a câmera de combate (close, câmera lenta, faixas de cinema, legenda e voz), o cemitério, as vistas Padrão, Drone e Aérea, o minimapa 2D arrastável e a ficha da peça com o personagem em 3D girando.

## Etapa 6 — Arenas

Construtores compartilhados: pátio de castelo, santuário com selos, estátuas de cristal e céu noturno. Também valem dados de tema, 13 luzes fixas, descarte na troca e câmera, áudio e gancho de captura por arena. Detalhes em [09](references/09-arenas-tematicas.md).

## Etapa 7 — Som

- **ElevenLabs** gera os efeitos de cada poder e de cada arena, o ambiente e a música de cada arena, as falas do narrador (voz brasileira profissional) e as falas das lições (`scripts/elevenlabs_audio.py aprendiz`).
- **No jogo:** Web Audio com 4 barramentos, carregamento só no primeiro gesto, música abaixando nas cenas de combate e reserva sintetizada.

## Etapa 8 — Publicar

- **Snapshot + teste com a CSP + publicação com `url`** e só os assets novos em `files`.
- Tipos servidos: `.mp3`, `.json`, `.jpg`, `.webp`… **não `.glb`**.
- Patch do `ImageBitmapLoader` para as texturas embutidas.
- Push automático para o GitHub com varredura de chaves ([11](references/11-fluxo-de-trabalho.md)).

## Chaves e segurança

- **Keychain do macOS:** `security add-generic-password -a "$USER" -s <meshy-api-key|gemini-api-key|elevenlabs-api-key> -w`. Cole a chave **só quando o terminal pedir**.
- **Os scripts leem a chave do Keychain** e nunca a imprimem. Antes de cada push, procure chaves nos arquivos.
- **MCP do Meshy:** `~/.config/meshy/meshy-mcp.sh`, com o servidor instalado localmente e a chave lida do Keychain.
- **Vozes:** nunca use vozes clonadas de pessoas reais. **Arte:** nada de identidade de franquia (brasões, castelos reconhecíveis).

## Como usar esta skill num jogo novo

1. Feche o conceito e as decisões num documento. Exporte para `data/regras.md` e, se houver cartas, `data/cartas.json`.
2. Copie `scripts/` para `<projeto>/tools/`. A raiz do projeto é a pasta acima de `tools/`. Ajuste os dicionários de personagens, peças, sons e arenas.
3. Gere a arte e aprove; gere os modelos, otimize e converte; gere os sons.
4. Construa partindo do exemplo. Reaproveite cena, adaptador de personagem, efeitos, câmera de combate, arenas, áudio, vistas, minimapa e tela inicial, e troque regras, personagens, coreografias e cartas.
5. Teste (lógica em Node; navegador a 1280 e 375 px; CSP simulada), publique e envie ao GitHub.
