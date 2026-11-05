# 05 — Ataques, efeitos e câmera

## Ferramentas básicas

- `tween(ms, k => {...}, ease)`: Promise; anima de 0 a 1 respeitando a escala de tempo global (`GT.ts`, usada na câmera lenta).
- `wait(ms)` e `realWait(ms)` (a segunda ignora a câmera lenta).
- `shake(força)`, `flashLight(pos, cor, pico, ms)`, `spawnRing(x, z, cor, raio, ms)`, `spawnPillar`, `dustAt`, `debris`, `groundDecal(textura, x, z, tamanho)`.
- Partículas: `makePS(n, blending)` é um sistema de pontos com shader próprio (tamanho, cor e alfa por partícula). Há pools separados para faíscas (aditivo), poeira e brasas.
- Raio: `lightningFx(a, b, corNúcleo, corBrilho, faíscas)` monta segmentos irregulares com ramificações e devolve `{setEnds, update(rejitter), k, dispose}`.
- Cores por exército em `FXC[side]` (amber ou carmesim para luz, faíscas, mísseis e raio).

## Movimento por tipo (`animMove`)

| Peça | Movimento | Como foi feito |
|---|---|---|
| Peão, Rei | caminha | `walkTo`: vira, clipe `walk`, posição por tween, passos com som a cada ~0,35 s |
| Cavalo | galope + salto em arco | `gallopLeap`: corrida curta, `lift = sin(πk)·0,9`, poeira e som no pouso |
| Torre | afunda e brota (terra) | `earthMove`: `sink` de 0→1 com rachadura e poeira, some, troca a posição, reaparece com detritos, anel e luz laranja, `sink` de 1→0 |
| Dama | vira um raio | `lightningDash`: esconde a peça, um raio "cabeça e cauda" cruza o caminho em ~200 ms com faíscas e luz, depois `reform` (clarão e anel) |
| Bispo | teleporte arcano | `arcaneBlink`: círculo de runas, `cast`, some em faíscas, círculo no destino, reaparece |

Trecho real da Torre:
```js
async function earthMove(p, tx, tz){
  snd('terra_afunda'); shake(0.06);
  const c0 = groundDecal(crackTex(), p.dx, p.dz, 1.25, 0xffffff, false);
  dustAt(p.dx, p.dz, 16, 0.9);
  await tween(460, k => { p.sink = easeIO(k); c0.material.opacity = Math.min(1, k * 2.5); }, linE);
  p.hidden = true; p.dx = tx; p.dz = tz;
  await wait(150);
  p.hidden = false; snd('terra_brota'); shake(0.1);
  debris(tx, tz, 10); dustAt(tx, tz, 24, 1.4);
  flashLight(new THREE.Vector3(tx, 0.5, tz), 0xffa040, 3, 520); spawnRing(tx, tz, 0xe3a548, 1.2, 480);
  await tween(420, k => { p.sink = 1 - easeOut(k); }, linE);
}
```

## Capturas (`animCapture`)

Fluxo: a vítima vira para o atacante → `cineBegin` → coreografia da peça → `slay(vítima)` → atacante ocupa a casa → `cineFinish`.

| Peça | Captura | Legenda e voz |
|---|---|---|
| Peão | aproxima, `attack` (estocada), impacto no quadro detectado | LANÇA FIEL |
| Cavalo | `lanceCharge`: galope atravessando a vítima, empurrão | CARGA IMPLACÁVEL |
| Torre | `towerVolley`: o arqueiro solta 3 flechas (`arrowFx` com 90 ms entre elas), espinhos de terra sob a vítima, depois afunda e brota na casa | FÚRIA DA TERRA |
| Dama | `lightningStrike`: `cast`, dash de raio, raio do céu sobre a vítima (`lightningFx` de y=4,5 até o peito), luz forte, anel | JULGAMENTO DO RAIO |
| Bispo | `arcaneMissiles`: círculo rúnico maior, `cast`, 4 mísseis com curva (`missileFx`), depois teleporte para a casa | ARCANO SUPREMO |
| Rei | `meleeCapture`: espada | LÂMINA REAL |

`slay(v)` toca `hit` (clarão e recuo), depois `death`, dissolve em brasas e manda a peça ao cemitério.

## Câmera de combate (estilo fatality)

1. `cineShot(a, v)` testa 4 posições de câmera (dois lados × recuo), em 3/4 de perfil, baixa (~62% da altura) e enviesada para a vítima. Pontua cada uma pelas peças no caminho e fica com a melhor; as que ainda atrapalham ficam translúcidas.
2. `cineBegin`: faixas de cinema (CSS), vinheta, luzes do tabuleiro abaixadas, spot e contraluz na cor de quem ataca, legenda preparada. Aproximação de ~0,35 s.
3. `cineImpact(v)` no quadro de impacto: câmera lenta (`ts` 0,25 por 0,52 s; 0,9 s no mate), clarão branco, tremor forte, som `camera_lenta`, legenda e voz do narrador.
4. `cineRelease` e `cineFinish`: a câmera volta em ~0,6 s para a vista ativa.
5. Clique, toque ou Esc pulam a cena (`cineSkip`), indo direto ao estado final.
6. Modos: Cinematográfica, Rápida e Desligada (salvo no localStorage; Desligada por padrão com `prefers-reduced-motion`).
7. Xeque-mate: close extra do rei caindo em câmera lenta com "XEQUE-MATE", depois a tela final.

## Cemitério

- Dois canteiros nas laterais (terra escura, cerca de ferro torta, lápides, velas, lanterna e névoa), um por exército.
- A peça abatida ressurge da terra no canteiro do seu lado, a ~72% do tamanho, acinzentada e com tom fantasma, de frente para o tabuleiro, em fileiras por valor (`GRAVE_ORDER = 'qrbnpk'`).
- É reconstruído a partir do histórico de lances, então desfazer devolve a peça e a promoção funciona.

## Vistas de câmera

Um só "rig" de câmera (yaw, pitch, distância, pan, offset) que desliza até o alvo de cada vista:
- **Padrão**: inclinada, com arrasto de ±25°.
- **Drone**: órbita de 360°, pitch entre 0,35 e 1,45 rad, zoom 7–30 (roda ou pinça), pan com botão direito ou dois dedos, e órbita automática lenta depois de 6 s parado. `touch-action: none` só nesta vista.
- **Aérea**: ~85° de cima, enquadrando as 64 casas (e os cemitérios em tela larga).
- **Inverter campo**: gira 180° em qualquer vista. Em dois jogadores, "girar a cada turno" é opcional.
- As setas do teclado seguem a orientação (cima = para longe de quem olha). Atalhos: V troca a vista, I inverte.

## Destaques no tabuleiro

Decalques por casa (pool reaproveitado): âmbar para mover, vermelho para capturar, contorno na peça selecionada, tom no último lance e vermelho no rei em xeque. A escolha de casas usa raycast nas malhas das peças e do tabuleiro; se o raio pega o alto de uma peça na frente e a casa sob o ponteiro tem outra peça, vale a casa.
