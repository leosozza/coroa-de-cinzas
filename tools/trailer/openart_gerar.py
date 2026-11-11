#!/usr/bin/env python3
"""Gera os clipes do trailer pelo OpenArt (programa `openart`, login feito com `openart login`).

Uso: python3 tools/trailer/openart_gerar.py [--roteiro mundos.json] [--modelo veo3-1] [--so c1_coroa,c2_queda] [--refazer c3_grimorio]
Lê tools/trailer/roteiro.json e grava tools/trailer/saida/<id>.mp4, 3 por vez (--paralelo N; o plano Starter recusa a 5ª e demora a liberar as que terminaram).
Clipes já gerados são pulados (não gasta crédito duas vezes). O preço de cada modelo sai em
`openart model cost --model <id> --mode text2video` (não gasta nada).
"""
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

DIR = Path(__file__).resolve().parent
OUT = DIR / "saida"
OA = shutil.which("openart") or str(Path.home() / ".local/bin/openart")
FF = str(Path.home() / "ArcaneChessReels/node_modules/ffmpeg-static/ffmpeg")


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def inteiro(v):
    """O vídeo abre e tem duração (o ffmpeg acha o índice)."""
    r = subprocess.run([FF, "-i", str(v)], capture_output=True, text=True).stderr
    return "Duration:" in r and "moov atom not found" not in r and "Invalid data" not in r


def gerar(c, modelo):
    pasta = OUT / f"_{c['id']}"
    pasta.mkdir(parents=True, exist_ok=True)
    prompt = c["prompt"] + (" Avoid: " + c["negativo"] + "." if c.get("negativo") else "")
    r = subprocess.run([OA, "generate", "video", prompt, "--model", modelo, "--duration", str(c.get("segundos", 8)),
                        "--aspect-ratio", "9:16", "--resolution", "1080p", "--timeout", "20m", "-o", str(pasta), "--yes"],
                       capture_output=True, text=True)
    vids = [v for v in sorted(pasta.glob("*.mp4")) if inteiro(v)]  # um download cortado deixa um .mp4 sem o índice (moov)
    if not vids:  # gerou (e cobrou) mas o download caiu: baixa de novo pelo endereço do CDN, sem gerar outra vez
        m = re.search(r"https://cdn\.openart\.ai/\S+?\.mp4", r.stderr + r.stdout)
        if m and subprocess.run(["curl", "-fsSL", "--retry", "4", "--max-time", "300", "-o", str(pasta / "v.mp4"), m.group(0)]).returncode == 0 and inteiro(pasta / "v.mp4"):
            vids = [pasta / "v.mp4"]
    if not vids:
        shutil.rmtree(pasta, ignore_errors=True)
        return f"{c['id']}: FALHOU ({(r.stderr or r.stdout).strip()[-400:]}) — se foi cobrado, o vídeo está em `openart creation list`"
    vids[0].rename(OUT / f"{c['id']}.mp4")
    shutil.rmtree(pasta, ignore_errors=True)
    return f"{c['id']}: ok"


def main():
    clipes = json.loads((DIR / arg("--roteiro", "roteiro.json")).read_text())["clipes"]
    if arg("--so"):
        clipes = [c for c in clipes if c["id"] in arg("--so").split(",")]
    refazer = (arg("--refazer") or "").split(",")
    OUT.mkdir(exist_ok=True)
    faltam = [c for c in clipes if c["id"] in refazer or not (OUT / f"{c['id']}.mp4").exists()]
    modelo = arg("--modelo", "veo3-1")
    print(f"gerando {len(faltam)} clipes com {modelo}...", flush=True)
    with ThreadPoolExecutor(max_workers=int(arg('--paralelo', '3'))) as ex:
        for res in ex.map(lambda c: gerar(c, modelo), faltam):
            print(res, flush=True)


if __name__ == "__main__":
    main()
