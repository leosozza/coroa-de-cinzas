# 06 — Áudio com ElevenLabs

Script: [../scripts/elevenlabs_audio.py](../scripts/elevenlabs_audio.py) (`python3 tools/elevenlabs_audio.py [sfx] [voz] [musica]`). Pula arquivos que já existem.

## Endpoints (`https://api.elevenlabs.io`, cabeçalho `xi-api-key`)

| Tipo | Endpoint | Corpo |
|---|---|---|
| Efeito sonoro | `POST /v1/sound-generation?output_format=mp3_44100_128` | `{text, duration_seconds (0,5–30), loop, prompt_influence: 0.5, model_id: "eleven_text_to_sound_v2"}` |
| Narrador | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` | `{text, model_id: "eleven_multilingual_v2", language_code: "pt", voice_settings: {stability: 0.35, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true}}` |
| Música | `POST /v1/music?output_format=mp3_44100_128` | `{prompt, music_length_ms (3000–600000), force_instrumental: true}` |
| Plano/créditos | `GET /v1/user/subscription` | |
| Vozes | `GET /v2/voices?page_size=100` | |

Voz usada: **Paulo** (`Qrdut83w0Cr152Yb4Xn3`), profissional brasileira, grave e expressiva. **Não use vozes clonadas de pessoas reais**, mesmo que estejam na conta.

## O pacote do Coroa de Cinzas (39 arquivos, 2,7 MB)

- Efeitos (0,5–4 s): passo, galope, cavalo_pouso, terra_afunda, terra_brota, flechas, flecha_impacto, espinhos, raio_dash, raio_golpe, arcano_carga, misseis, teleporte, espada, lanca, carga_lanca, queda, cemiterio, xeque, xeque_mate, vitoria, derrota, selecao, camera_lenta.
- Ambiente em loop (22 s, `loop: true`): "stormy wind over ancient ruins, distant rolling thunder, crackling braziers, dark ambience".
- Música (90 s): "Dark fantasy orchestral theme for a medieval chess battle in ancient ruins: slow tense tempo, low strings, distant war drums, deep choir pads, ominous and majestic, steady loopable groove, no vocals".
- Narrador: "A batalha começa!", "Xeque!", "Xeque-mate!", "Golpe fatal!", um nome de golpe por peça, "Vitória!", "Derrota...", "Empate.".

Prompt de efeito bom = **objeto + ação + material + detalhe acústico**, em inglês: "stone tower erupting out of the ground, explosive rock burst, debris falling, deep rumble".

## Motor de áudio no jogo

```
música ─► duck ─┐
ambiente ► duck ┤
efeitos ────────┼─► master ─► saída
voz ────────────┘
```
- Nada carrega nem toca antes do primeiro gesto (regra dos navegadores). No primeiro clique: cria o `AudioContext`, faz `resume()`, baixa e decodifica os curtos primeiro e os dois loops por último.
- `snd(nome, {vol, rate, delay})`: toca o buffer no barramento certo. Sons repetidos ganham ±5% de `playbackRate`. Voz ainda decodificando fica na espera e toca se chegar em até 1,5 s. Se o arquivo falhar, toca um som sintetizado de reserva (osciladores e ruído).
- Música a 0,3 e ambiente a 0,25, entrando em ~3 s. Os dois **abaixam para 40%** durante a câmera de combate e enquanto o narrador fala (`audioTick` a cada 120 ms).
- Painel "Áudio": Som, Música, Narrador e Volume, salvos no localStorage (com try/catch).
- Com a câmera de combate desligada: efeitos tocam, mas as vozes de captura não (as de xeque e mate tocam). Narrador desligado silencia todas as falas.

## Mapa de eventos para sons

| Evento | Sons |
|---|---|
| Selecionar peça | selecao |
| Caminhar | passo a cada ~0,35 s |
| Cavalo move / captura | galope + cavalo_pouso / galope + carga_lanca + v_carga |
| Torre move / captura | terra_afunda + terra_brota / flechas + flecha_impacto + espinhos + v_furia_terra |
| Dama move / captura | raio_dash / raio_dash + raio_golpe + v_raio |
| Bispo move / captura | teleporte / arcano_carga + misseis + v_arcano |
| Peão / Rei captura | lanca + v_lanca_fiel / espada + v_lamina |
| Toda captura cinematográfica | camera_lenta, queda, cemiterio (baixo) |
| Xeque / mate / fim | xeque + v_xeque / xeque_mate + v_xeque_mate / vitoria ou derrota + voz |
