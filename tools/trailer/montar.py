#!/usr/bin/env python3
"""Monta o trailer vertical (1080x1920) com os clipes live action, a partida do jogo, a narração e os textos.

Uso: python3 tools/trailer/montar.py --partida <gravacao.mp4> [--saida tools/trailer/saida/trailer.mp4]
A partida é a gravação inteira do robô dos Reels (~/ArcaneChessReels/saida/<id>/*-gravacao-01.mp4);
os trechos usados estão em PARTIDA abaixo (segundos dessa gravação).
"""
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent.parent
S = DIR / "saida"
FF = str(Path.home() / "ArcaneChessReels/node_modules/ffmpeg-static/ffmpeg")
FONTE = "/System/Library/Fonts/Supplemental/Copperplate.ttc"
W, H, FPS = 1080, 1920, 24

# (arquivo, início, fim) dos clipes live action, na ordem do trailer
VEO = [("c1_coroa", 0.0, 5.0), ("c2_queda", 1.0, 7.0), ("c3_grimorio", 0.5, 7.5),
       ("c4_lobo", 1.0, 7.0), ("c5_guardiao", 0.0, 6.0), ("c6_ovos", 0.0, 8.0)]
# trechos da partida: abertura, duas capturas, xeque-mate
PARTIDA = [(1.0, 4.0), (26.6, 29.1), (65.0, 67.5), (428.5, 430.5), (442.5, 445.0)]
CTA = 7.5
# narração: (fala, segundo em que começa). n7 termina no corte para a arena ("agora").
CORTE = sum(b - a for _, a, b in VEO)  # 38 s
NARR = [("n1", 1.6), ("n2", 5.3), ("n3", 11.4), ("n4", 18.3), ("n5", 24.5), ("n6", 30.5),
        ("n7", None), ("n8", CORTE + 3.3), ("n9", CORTE + 8.4), ("n10", CORTE + 13.0)]
# textos na tela: (texto, de, até, estilo) — 'filme' sobre o live action, 'jogo' sobre a partida
TEXTOS = [("O REI CAIU", 1.3, 4.7, "filme"), ("O CÉU CAIU JUNTO", 5.4, 9.6, "filme"),
          ("8 SELOS. 8 REINOS.", 12.0, 16.5, "filme"), ("CADA REI|ENLOUQUECEU", 19.0, 23.0, "filme"),
          ("SÓ VOCÊ ACORDOU", 27.0, 29.9, "filme"), ("LIBERTE A|HUMANIDADE", 31.0, 34.8, "filme"),
          ("A BATALHA|COMEÇA AGORA", 35.6, CORTE, "filme"),
          ("8 MUNDOS. 48 FASES.", CORTE + 0.3, CORTE + 3.0, "jogo"),
          ("O EXÉRCITO DELE VIRA SEU", CORTE + 3.4, CORTE + 7.6, "jogo")]


def dur(p):
    out = subprocess.run([FF, "-i", str(p)], capture_output=True, text=True).stderr
    h, m, s = out.split("Duration: ")[1].split(",")[0].split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def alfa(a, b, f=0.25):
    return f"if(lt(t,{a}),0,if(lt(t,{a + f}),(t-{a})/{f},if(lt(t,{b - f}),1,if(lt(t,{b}),({b}-t)/{f},0))))"


def texto(rot, nome, txt, a, b, tam, y, caixa=False):
    (S / "txt").mkdir(exist_ok=True)
    f = S / "txt" / f"{nome}.txt"
    f.write_text(txt)
    extra = ":box=1:boxcolor=black@0.45:boxborderw=24" if caixa else ""
    return (f"drawtext=fontfile='{FONTE}':textfile='{f}':fontsize={tam}:fontcolor=white:borderw=4:bordercolor=black@0.7"
            f":shadowcolor=black@0.6:shadowx=0:shadowy=6:x=(w-tw)/2:y={y}:alpha='{alfa(a, b)}'{extra}")


def main():
    partida = arg("--partida")
    saida = Path(arg("--saida", S / "trailer.mp4"))
    ins, fg = [], []
    norm = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,format=yuv420p"
    seg = []
    for i, (nome, a, b) in enumerate(VEO):
        ins += ["-i", str(S / f"{nome}.mp4")]
        fg.append(f"[{i}:v]trim={a}:{b},setpts=PTS-STARTPTS,{norm}[v{i}];"
                  f"[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.32[a{i}]")
        seg.append(i)
    k = len(VEO)
    ins += ["-i", partida]
    n = len(PARTIDA)
    fg.append(f"[{k}:v]split={n}" + "".join(f"[pv{j}]" for j in range(n)) + f";[{k}:a]asplit={n}" + "".join(f"[pa{j}]" for j in range(n)))
    for j, (a, b) in enumerate(PARTIDA):
        fg.append(f"[pv{j}]trim={a}:{b},setpts=PTS-STARTPTS,{norm}[v{k + 1 + j}];"
                  f"[pa{j}]atrim={a}:{b},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.55[a{k + 1 + j}]")
        seg.append(k + 1 + j)
    # cartela final: arena desfocada (último quadro da partida) com o convite
    c = k + 1 + n
    ins += ["-ss", str(PARTIDA[0][0] + 1), "-i", partida]
    cta = [f"[{k + 1}:v]trim=end_frame=1,loop=loop=-1:size=1:start=0,setpts=N/{FPS}/TB,{norm},trim=0:{CTA},"
           f"setpts=PTS-STARTPTS,gblur=sigma=28,eq=brightness=-0.18:saturation=0.8"]
    t0 = 0.0
    for nome, txt, y, tam, d in [("cta1", "ARCANE CHESS", 640, 118, 0.2), ("cta2", "A BATALHA PELO GRIMÓRIO", 790, 52, 0.6),
                                 ("cta3", "JOGUE GRÁTIS AGORA", 1040, 82, 1.2), ("cta4", "arcanechess.pages.dev", 1170, 58, 1.6),
                                 ("cta5", "link na bio  ·  @arcanechess_oficial", 1260, 42, 2.0)]:
        cta.append(texto(None, nome, txt, t0 + d, CTA + 1, tam, y))
    fg.append(",".join(cta) + f"[v{c}];anullsrc=r=48000:cl=stereo,atrim=0:{CTA}[a{c}]")
    seg.append(c)
    fg.append("".join(f"[v{s}][a{s}]" for s in seg) + f"concat=n={len(seg)}:v=1:a=1[vb][ab]")
    # textos sobre o vídeo
    over = []
    for i, (txt, a, b, est) in enumerate(TEXTOS):
        for j, linha in enumerate(txt.split("|")):
            if est == "filme":
                over.append(texto(None, f"t{i}_{j}", linha, a, b, 84, 1230 + j * 104))
            else:
                over.append(texto(None, f"t{i}_{j}", linha, a, b, 64, 1520 + j * 90, caixa=True))
    fg.append("[vb]" + ",".join(over) + "[vout]")
    # narração, trilha e o impacto do corte
    mix = ["[ab]"]
    base = k + 2
    for j, (nome, t) in enumerate(NARR):
        p = S / f"narr_{nome}.mp3"
        if t is None:
            t = CORTE - dur(p) + 0.12
        ins += ["-i", str(p)]
        ms = int(t * 1000)
        fg.append(f"[{base + j}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.6,adelay={ms}|{ms}[n{j}]")
        mix.append(f"[n{j}]")
    total = CORTE + sum(b - a for a, b in PARTIDA) + CTA
    m = base + len(NARR)
    ins += ["-i", str(ROOT / "assets/audio/musica_tema.mp3"), "-i", str(ROOT / "assets/audio/impacto.mp3")]
    fg.append(f"[{m}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{total},volume=0.22,"
              f"afade=t=in:d=3,afade=t=out:st={total - 2.5}:d=2.5[mus]")
    ms = int((CORTE - 0.05) * 1000)
    fg.append(f"[{m + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.2,adelay={ms}|{ms}[imp]")
    mix += ["[mus]", "[imp]"]
    fg.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0:duration=first,alimiter=limit=0.95[aout]")
    script = S / "montagem.ffscript"
    script.write_text(";\n".join(fg))
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", *ins, "-filter_complex_script", str(script),
           "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "3M",
           "-bufsize", "6M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
           "-t", f"{total:.2f}", str(saida)]
    subprocess.run(cmd, check=True)
    print(f"ok: {saida} ({total:.1f} s, {saida.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
