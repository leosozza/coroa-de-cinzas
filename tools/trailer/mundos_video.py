#!/usr/bin/env python3
"""Monta as aberturas dos 8 mundos da Conquista dos Mundos para o jogo.

Uso: python3 tools/trailer/mundos_video.py [--so 1,3]
Para cada mundo N: o clipe live action (tools/trailer/saida/wN_*.mp4, gerado por openart_gerar.py --roteiro mundos.json)
com o som do Veo baixo, a narração do mundo (saida/narr_mN.mp3, de narrar.py --roteiro mundos.json) por cima,
fade de entrada e de saída, em 720x1280 a 24 fps, H.264 + AAC com faststart. Grava assets/video/mundo_N.mp4.
"""
import json
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent.parent
OUT = ROOT / "assets" / "video"
SAI = DIR / "saida"
FF = str(Path.home() / "ArcaneChessReels/node_modules/ffmpeg-static/ffmpeg")
NARR_EM = 0.7    # a narração entra aos 0,7 s
VEO_VOL, NARR_VOL = 0.35, 1.7
# remendos por mundo (no quadro 1080x1920 original): letras soltas que o Veo deixou
REMENDO = {2: "delogo=x=490:y=1745:w=160:h=110:enable='lt(t,1.3)',"}


def dur(f):
    r = subprocess.run([FF, "-i", str(f)], capture_output=True, text=True).stderr
    h, m, s = r.split("Duration: ")[1].split(",")[0].split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def main():
    clipes = json.loads((DIR / "mundos.json").read_text())["clipes"]
    so = sys.argv[sys.argv.index("--so") + 1].split(",") if "--so" in sys.argv else None
    OUT.mkdir(parents=True, exist_ok=True)
    for i, c in enumerate(clipes, 1):
        if so and str(i) not in so:
            continue
        vid, narr = SAI / f"{c['id']}.mp4", SAI / f"narr_m{i}.mp3"
        if not vid.exists():
            print(f"mundo {i}: falta {vid.name}"); continue
        d = dur(vid)
        fo = max(0.0, d - 0.6)
        fc = (f"[0:v]{REMENDO.get(i, '')}scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24,"
              f"fade=t=in:st=0:d=0.5,fade=t=out:st={fo:.2f}:d=0.6[v];"
              f"[0:a]volume={VEO_VOL}[a0];"
              f"[1:a]adelay={int(NARR_EM * 1000)}|{int(NARR_EM * 1000)},volume={NARR_VOL}[a1];"
              f"[a0][a1]amix=inputs=2:duration=first:normalize=0,afade=t=in:st=0:d=0.3,afade=t=out:st={fo:.2f}:d=0.6,alimiter=limit=0.95[a]")
        dest = OUT / f"mundo_{i}.mp4"
        cmd = [FF, "-y", "-v", "error", "-i", str(vid), "-i", str(narr), "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
               "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-profile:v", "high",
               "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-movflags", "+faststart", "-t", f"{d:.2f}", str(dest)]
        subprocess.run(cmd, check=True)
        print(f"mundo {i}: {dest.relative_to(ROOT)} ({dest.stat().st_size / 1e6:.1f} MB, {d:.1f} s)", flush=True)


if __name__ == "__main__":
    main()
