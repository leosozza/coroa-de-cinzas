#!/usr/bin/env python3
"""Falas da Conquista dos Mundos: a abertura de cada fase (toca com a cartela) e a fala de vitória (tela de fim).

Uso: python3 tools/elevenlabs_campanha.py [--so-lista] [--refazer]
Lê data/falas-campanha.json (id -> texto, antes, depois), gerado de CAMP_ROTEIRO no coroa-de-cinzas.html.
Saída: assets/audio/camp/<id>.mp3 (fonte) e um pacote por mundo, assets/audio/camp/m<n>/pack.json (id -> mp3 em
base64), que é o que o jogo baixa ao entrar numa fase daquele mundo (no Artifact e no Pages).
Voz do jogo (EA.NARRATOR, Eliel), ajustes épicos do trailer. Arquivos já gravados são pulados;
--refazer grava todos de novo (para trocar a voz).
"""
import base64
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "camp"
EPICA = {"stability": 0.45, "similarity_boost": 0.8, "style": 0.5, "use_speaker_boost": True}


def main():
    falas = json.loads((ROOT / "data" / "falas-campanha.json").read_text())
    novos = [i for i in falas if "--refazer" in sys.argv or not (OUT / f"{i}.mp3").exists()]
    chars = sum(len(falas[i]["texto"]) for i in novos)
    print(f"{len(falas)} falas; faltam {len(novos)} ({chars} caracteres)", flush=True)
    if "--so-lista" in sys.argv:
        return
    import elevenlabs_audio as EA
    OUT.mkdir(parents=True, exist_ok=True)
    for i in novos:
        f = falas[i]
        body = {"text": f["texto"], "model_id": "eleven_multilingual_v2", "language_code": "pt", "voice_settings": EPICA}
        if f.get("antes"): body["previous_text"] = f["antes"]
        if f.get("depois"): body["next_text"] = f["depois"]
        EA.post(f"/v1/text-to-speech/{EA.NARRATOR}?output_format=mp3_44100_96", body, OUT / f"{i}.mp3",
                sobrescrever="--refazer" in sys.argv)
    feitas = [i for i in falas if (OUT / f"{i}.mp3").exists()]
    for w in sorted({i.split("_")[0][1:] for i in feitas}):
        pack = {i: base64.b64encode((OUT / f"{i}.mp3").read_bytes()).decode() for i in feitas if i.startswith(f"c{w}_")}
        (OUT / f"m{w}").mkdir(exist_ok=True)
        (OUT / f"m{w}" / "pack.json").write_text(json.dumps(pack))
    print(f"gravadas: {len(feitas)}/{len(falas)}", flush=True)


if __name__ == "__main__":
    main()
