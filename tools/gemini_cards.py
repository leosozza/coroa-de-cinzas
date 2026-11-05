#!/usr/bin/env python3
"""Gera as ilustrações das cartas do Modo Arcano no Gemini, a partir de data/cartas.json.

Uso: python3 tools/gemini_cards.py [id ...]   (sem argumentos: todas as que faltam)
Saída: assets/cards/<id>.jpg (original) e assets/cards/web/<id>.jpg (512 px, para o jogo).
A primeira carta gerada vira referência de estilo das outras. A chave vem do Keychain (gemini-api-key).
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gemini_images as g  # noqa: E402  (reaproveita chave, chamada e leitura da resposta)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "cards"
WEB = OUT / "web"
STYLE = ("Trading card illustration for a dark fantasy chess game, painterly hand-painted style, dramatic cinematic "
         "lighting, rich detail, deep shadows with glowing magical accents, centered subject, no text, no letters, "
         "no card frame, no border. Scene: ")


def make(k, card, ref):
    g.OUT = OUT  # gemini_images grava em g.OUT/<slug>.jpg
    g.PIECES[card["id"]] = card["arte"]
    g.STYLE = STYLE
    g.UNIT.discard(card["id"])
    dest = g.generate(k, card["id"], ref)
    WEB.mkdir(parents=True, exist_ok=True)
    subprocess.run(["sips", "-Z", "512", "-s", "formatOptions", "78", str(dest), "--out", str(WEB / dest.name)],
                   capture_output=True)
    return dest


if __name__ == "__main__":
    cards = json.loads((ROOT / "data" / "cartas.json").read_text())["cartas"]
    want = set(sys.argv[1:])
    k = g.key()
    ref = None
    for c in cards:
        dest = OUT / f"{c['id']}.jpg"
        if dest.exists():
            ref = ref or dest
            continue
        if want and c["id"] not in want:
            continue
        for tentativa in range(3):  # conexões longas às vezes caem ("Broken pipe")
            try:
                d = make(k, c, ref)
                ref = ref or d
                break
            except (SystemExit, OSError) as e:
                print(f"  falhou {c['id']} (tentativa {tentativa + 1}): {e}", flush=True)
