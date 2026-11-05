#!/usr/bin/env python3
"""Imagem -> modelo 3D texturizado DE GRAÇA, pelo TRELLIS.2 (Microsoft) no Hugging Face Spaces.

Uso: <venv>/bin/python tools/trellis_gen.py torre_base [cavalo_montado ...]
Precisa do pacote gradio_client (instale num venv próprio). A cota gratuita do ZeroGPU é diária.
Lê assets/concepts/<slug>.jpg e grava assets/free3d/<slug>/model.glb (modelo provisório; o Meshy
pode substituí-lo depois pelo mesmo caminho do jogo).
"""
import shutil
import sys
from pathlib import Path

from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parent.parent
SPACE = "microsoft/TRELLIS.2"
RES = "512"  # a cota grátis do ZeroGPU não cobre 1024


def gen(slug, faces=20000, tex=1024, seed=7):
    img = ROOT / "assets" / "concepts" / f"{slug}.jpg"
    out = ROOT / "assets" / "free3d" / slug
    out.mkdir(parents=True, exist_ok=True)
    c = Client(SPACE, verbose=False)
    c.predict(api_name="/start_session")
    pre = c.predict(handle_file(str(img)), api_name="/preprocess_image")
    pre_path = pre["path"] if isinstance(pre, dict) else pre
    shutil.copy(pre_path, out / "entrada.png")
    print(f"{slug}: gerando o modelo...", flush=True)
    c.predict(handle_file(pre_path), seed, RES, api_name="/image_to_3d")
    print(f"{slug}: extraindo o GLB ({faces} faces, textura {tex})...", flush=True)
    glb, _ = c.predict(faces, tex, api_name="/extract_glb")
    glb_path = glb["path"] if isinstance(glb, dict) else glb
    shutil.copy(glb_path, out / "model.glb")
    print(f"{slug}: {out / 'model.glb'} ({(out / 'model.glb').stat().st_size // 1024} KB)", flush=True)


if __name__ == "__main__":
    for s in sys.argv[1:] or ["torre_base", "cavalo_montado"]:
        gen(s)
