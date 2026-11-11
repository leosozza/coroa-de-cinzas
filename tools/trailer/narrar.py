#!/usr/bin/env python3
"""Grava a narração do trailer com a voz do narrador do jogo (ElevenLabs, voz de catálogo, nunca clonada).

Uso: python3 tools/trailer/narrar.py [--roteiro mundos.json] [--refazer]
Lê tools/trailer/roteiro.json (ou o --roteiro) ("falas": id, texto) e grava tools/trailer/saida/narr_<id>.mp3.
Cada fala leva a anterior e a seguinte como contexto para a entonação casar na montagem.
"""
import json
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(DIR.parent))
import elevenlabs_audio as EA  # noqa: E402

OUT = DIR / "saida"
EPICA = {"stability": 0.4, "similarity_boost": 0.8, "style": 0.55, "use_speaker_boost": True}


def main():
    nome = sys.argv[sys.argv.index("--roteiro") + 1] if "--roteiro" in sys.argv else "roteiro.json"
    falas = json.loads((DIR / nome).read_text())["falas"]
    OUT.mkdir(exist_ok=True)
    print(f"{len(falas)} falas, {sum(len(f['texto']) for f in falas)} caracteres", flush=True)
    for i, f in enumerate(falas):
        dest = OUT / f"narr_{f['id']}.mp3"
        if dest.exists() and "--refazer" not in sys.argv:
            continue
        body = {"text": f["texto"], "model_id": "eleven_multilingual_v2", "language_code": "pt", "voice_settings": EPICA}
        if i > 0:
            body["previous_text"] = falas[i - 1]["texto"]
        if i + 1 < len(falas):
            body["next_text"] = falas[i + 1]["texto"]
        EA.post(f"/v1/text-to-speech/{EA.NARRATOR}?output_format=mp3_44100_128", body, dest)
        print(f"  ok: {dest.name}", flush=True)


if __name__ == "__main__":
    main()
