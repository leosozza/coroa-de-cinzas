# 04 — Cena e personagens em Three.js

Tudo está em [../exemplo/coroa-de-cinzas.html](../exemplo/coroa-de-cinzas.html). As seções do script são marcadas por comentários `/* ---------- Nome ---------- */`. Procure por elas.

## Mapa do código do exemplo

| Seção | O que tem | Funções-chave |
|---|---|---|
| Regras e dados | tipos de peça, nomes, falas da crônica | `TYPES`, `FLAVOR`, `VERB`, `KILL` |
| IA da Legião | motor 0x88 + busca, roda num Worker | `aiEngine()` |
| Cena | renderer, luzes, tabuleiro pintado em canvas, ruínas, cemitérios, céu | `initGL`, `buildBoard`, `buildEnvironment`, `graveyard`, `buildBackdrop` |
| Personagens procedurais | rigs de pivôs feitos com primitivas | `BUILD.p/n/b/r/q/k`, `makeProcCharacter` |
| Modelos GLB | carregar, medir, mapear clipes, impacto, adereços, tingir | `loadModels`, `prepAsset`, `mapClips`, `findImpact`, `PROP_DEF`, `applySideTint`, `makeGlbCharacter` |
| Efeitos | partículas por shader, raios, anéis, decalques, luzes | `makePS`, `lightningFx`, `spawnRing`, `flashLight`, `groundDecal` |
| Animação | tween, coreografias de movimento e captura | `tween`, `walkTo`, `gallopLeap`, `earthMove`, `lightningDash`, `arcaneBlink`, `animCapture` |
| Câmera de combate | close, câmera lenta, legenda | `cineShot`, `cineBegin`, `cineImpact`, `cineFinish` |
| Desenho | câmera (Padrão/Drone/Aérea), destaques, HUD | `fitFor`, `desiredRig`, `updateCamera`, `syncHighlights` |
| Som | Web Audio | `audio`, `snd`, `applyAudio`, `audioTick` |
| Interface | painel, lances, desfazer, promoção, entrada | `doMove`, `eventsFor`, `handleTile`, `pick` |

## Princípio 1 — lógica gera eventos, a animação toca os eventos

```js
const ev = eventsFor(resultadoDaJogada, peça);   // [{k:'move'}, {k:'capture'}, {k:'check'}...]
busy = true;
await play(ev);                                   // cada evento tem sua coreografia (await)
busy = false; afterTurn();                        // só então a IA pensa
```
O estado lógico muda na hora; os campos de exibição (`dx`, `dz`, `lift`, `alpha`, `flash`, `hidden`, `sink`) acompanham a animação. O desenho lê só os campos de exibição.

## Princípio 2 — adaptador de personagem

`makeCharacter(type, side)` devolve sempre a mesma interface, seja modelo procedural ou GLB:
- `root`, `headHeight`, `update(dt, now)`, `dispose()`
- `play(nome, {dur, key})` → Promise que **resolve no quadro de impacto** (`attack`, `cast`, `hit`, `death`, `stomp`, `raise`, `jump`; laços `idle` e `walk`)
- `faceTowards(x, z, velocidade)`, `setFlash(v, cor)`, `setSelected(b)`, `setAlert(b)`, `setOpacity(a)`
- `anchor('tip')`: ponta da arma ou cajado, de onde saem flechas, mísseis e raios

A coreografia só fala com essa interface. Trocar procedural por GLB não muda nada nela.

## Carregar os GLB sem travar o jogo

1. A cena aparece com os bonecos procedurais.
2. `loadModels()` carrega `GLTFLoader` e `SkeletonUtils` sob demanda, aplica o patch de CSP ([03](03-otimizacao-e-publicacao.md)) e baixa os 6 modelos em paralelo.
3. Cada modelo pronto vira um "asset" (`prepAsset`) e as peças daquele tipo trocam de modelo (`swapModel`) no próximo quadro.
4. Erro 404 ou de decodificação: a peça fica com o procedural.

## `prepAsset`: medir, orientar e escalar

- **Medir pelos vértices deformados** (`skinnedMesh.boneTransform`), porque a armadura Meshy tem escala 0,01 e o bounding box comum erra por 60×.
- **Frente**: compare as posições dos ossos `Head` e `HeadFront`/nariz para achar o giro (`yawFix`).
- **Escala por tipo**: altura-alvo (Rei 1,46, Dama 1,42, Bispo 1,28, Peão 0,98, Cavalo 1,22, Torre 1,14 unidades; uma casa = 1) e largura máxima (~0,8 casa).
- **Clipes**: mapeie por nome (`idle|stand`, `walk|run`, `dy|death|fall`, o resto é ataque), com a ordem de `action_ids` como reserva. A caminhada vem do `walk.glb` do rig. Tire o deslocamento da raiz (`stripRootMotion`) para o personagem andar no lugar e o jogo mover a posição.
- **Quadro de impacto automático** (`findImpact`): amostre o clipe de ataque e pegue o instante em que a mão direita está mais à frente do quadril. Foi 0,92 s no Peão, 0,55 s no Rei, 0,98 s no Bispo e 0,56 s na Dama.
- Compartilhe materiais e texturas entre cópias; clone com `SkeletonUtils.clone`; `frustumCulled = false` em malhas com esqueleto.

## Adereços presos aos ossos da mão

O A-pose tira as armas. Para cada tipo, defina o adereço, o osso e a direção:
```js
const PROP_DEF = {
  p:[{ kind:'spear', bone:'RightHand', parent:'RightForeArm', dir:[0, 1, 0.25], off:0.05 },
     { kind:'shield', bone:'LeftForeArm', parent:'LeftArm', dir:'out', off:0.13 }],
  k:[{ kind:'sword', bone:'RightHand', parent:'RightForeArm', dir:[0, -0.3, 1], off:0.05 }],
  b:[{ kind:'crozier', bone:'RightHand', parent:'RightForeArm', dir:[0, 1, 0.12], off:0.05 }],
  q:[{ kind:'zap', bone:'RightHand', parent:'RightForeArm', dir:[0, 1, 0], off:0.07 }],
};
```
O adereço é filho do osso. Como os clipes mexem na escala dos ossos, **recalcule a compensação de escala a cada quadro**, ou a arma encolhe e cresce durante o golpe.

## Um modelo para os dois exércitos

`applySideTint(obj, 'b')` clona os materiais uma vez (em cache), multiplica a cor por um cinza-carmesim (`#5a3a3a × 2,3`) e põe um emissivo carmesim fraco. Nos procedurais, o tingimento é aplicado nas cores de vértice. Anéis no chão em dourado ou carmesim reforçam o lado.

## Modelos procedurais (reserva e protótipo)

Cada tipo é montado com caixas, cilindros, cones e esferas em grupos-pivô (quadril, tronco, cabeça, braços, mãos, pernas, capa, fx). Animações por senos e poses-chave (`attackPose`, `CLIPS`). São o protótipo enquanto os GLB não existem e a reserva se falharem. Cavalo = cavalo + cavaleiro; Torre = torre com arqueiro no topo.

## Cena

- Câmera perspectiva inclinada ~50°, ajustada por busca para caber em qualquer largura (inclusive 375 px).
- Uma luz direcional com sombra (2048 no desktop, 1024 em toque), luz ambiente/hemisférica, luzes pontuais tremulando nos braseiros.
- Tabuleiro e laterais pintados em canvas (`paintBoard`) com runas emissivas; cenário procedural (pilares, muros, bunker, destroço em chamas) gerado com semente fixa (`seeded`).
- Céu como "cartão" de fundo pintado em canvas (tempestade, castelo, janelas acesas), névoa, brasas, cinzas caindo e relâmpagos ocasionais (desligados com `prefers-reduced-motion`).
- `devicePixelRatio` limitado a 2; `ResizeObserver` no container.
