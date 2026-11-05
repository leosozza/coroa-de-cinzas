# Coroa de Cinzas

Xadrez clássico em 3D com alma de RPG sombrio. Cada peça é um personagem com poderes próprios, as capturas viram cenas de combate em câmera cinematográfica, as peças abatidas vão para um cemitério ao lado da arena, e há narrador, trilha sonora e uma IA em três níveis.

O jogo é um único arquivo HTML ([coroa-de-cinzas.html](coroa-de-cinzas.html)) feito com Three.js r128 e chess.js. Ele foi publicado como Artifact do Claude.

## Personagens

| Peça | Personagem | Movimento | Captura |
|---|---|---|---|
| Peão | soldado com elmo, escudo e lança | caminha | estocada de lança |
| Cavalo | cavaleiro montado em cavalo de guerra | galopa e salta em arco | carga de lança |
| Bispo | bispo guerreiro, mestre da magia | teleporte arcano | mísseis arcanos |
| Torre | torre de pedra com arqueiro, mestra da terra | afunda e brota na casa | flechas e espinhos de terra |
| Dama | rainha do relâmpago, rápida como a luz | vira um raio | relâmpago do céu |
| Rei | rei de armadura | caminha | espada |

Os dois exércitos (Ordem da Aurora e Legião Cinzenta) usam os mesmos modelos, tingidos por lado.

## Recursos

- Regras completas do xadrez: xeque, xeque-mate, roque, en passant, promoção e empates.
- IA própria (negamax com alfa-beta e quiescência) num Web Worker: Recruta, Veterano e Mestre.
- Câmera de combate estilo fatality: close, câmera lenta, faixas de cinema e título do golpe.
- Vistas Padrão, Drone (360°) e Aérea, além de inverter o campo.
- Ficha da peça com o personagem em 3D girando.
- Áudio: 25 efeitos, ambiente, música tema e narrador em português.
- Modo contra a IA ou dois jogadores, desfazer jogada, teclado e toque.

## Como os assets foram feitos

| Asset | Ferramenta | Script |
|---|---|---|
| Arte-conceito dos personagens | Gemini (API de imagem) | [tools/gemini_images.py](tools/gemini_images.py) |
| Modelos 3D, rig e animações | Meshy (image-to-3D, rigging, animation) | [tools/meshy_gen.py](tools/meshy_gen.py) |
| Conversão para o Artifact (`.glb` → `.gltf.json`) | Python | [tools/glb_to_json.py](tools/glb_to_json.py) |
| Efeitos sonoros, narrador e música | ElevenLabs | [tools/elevenlabs_audio.py](tools/elevenlabs_audio.py) |

As chaves das APIs nunca ficam no código. Os scripts leem do Keychain do macOS:

```bash
security add-generic-password -a "$USER" -s meshy-api-key -w
security add-generic-password -a "$USER" -s gemini-api-key -w
security add-generic-password -a "$USER" -s elevenlabs-api-key -w
```

O passo a passo completo (prompts, custos, animações, efeitos, câmera, áudio e lições aprendidas) está em [skill/](skill/SKILL.md).

## Estrutura

```
coroa-de-cinzas.html      o jogo
assets/concepts/          artes-conceito do Gemini (.jpg)
assets/meshy/<peça>/      modelos do Meshy: originais (.glb), otimizados (.opt.glb) e para o Artifact (.gltf.json)
assets/audio/             efeitos, ambientes, músicas e narrador (.mp3)
tools/                    scripts de geração
skill/                    documentação do pipeline
```

## Rodar localmente

O arquivo não tem `<!doctype>` nem `<html>` porque o Artifact acrescenta isso na publicação. Para testar:

```bash
mkdir -p /tmp/coroa && { echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'; cat coroa-de-cinzas.html; echo '</body></html>'; } > /tmp/coroa/index.html
cp -R assets /tmp/coroa/ && cd /tmp/coroa && python3 -m http.server 8765
```

Depois abra http://localhost:8765/. Sem os assets, o jogo usa personagens geométricos e sons sintetizados.
