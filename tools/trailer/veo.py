#!/usr/bin/env python3
"""Gera os clipes live action do trailer com o Veo (API do Gemini).

Uso:
  python3 tools/trailer/veo.py --orcamento            # só mostra o custo estimado, não gasta nada
  python3 tools/trailer/veo.py --modelos              # lista os modelos de vídeo que a chave enxerga
  python3 tools/trailer/veo.py [--modelo veo-3.1-fast-generate-preview] [--so c1,c2] [--refazer c3]

Lê tools/trailer/roteiro.json (lista "clipes": id, prompt, negativo, segundos, imagem opcional)
e grava tools/trailer/saida/<id>.mp4. Clipes já gerados são pulados (não paga duas vezes).
A chave vem do Keychain (gemini-api-key) e nunca é impressa.
"""
import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent.parent
OUT = DIR / "saida"
API = "https://generativelanguage.googleapis.com/v1beta"
# US$ por segundo de vídeo com áudio, 1080p (preço público do Gemini, confira antes de gastar)
PRECO = {"veo-3.1-generate-preview": 0.40, "veo-3.1-fast-generate-preview": 0.12, "veo-3.1-lite-generate-preview": 0.08}
PADRAO = "veo-3.1-fast-generate-preview"


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def chave():
    return subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("whoami"),
                           "-s", "gemini-api-key", "-w"], capture_output=True, text=True, check=True).stdout.strip()


def req(metodo, url, corpo=None):
    r = urllib.request.Request(url, method=metodo, headers={"x-goog-api-key": chave(), "Content-Type": "application/json"},
                               data=json.dumps(corpo).encode() if corpo is not None else None)
    try:
        with urllib.request.urlopen(r, timeout=120) as f:
            return json.loads(f.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"erro {e.code} em {url.split('?')[0]}: {e.read().decode()[:600]}")


def baixar(uri, destino):
    r = urllib.request.Request(uri, headers={"x-goog-api-key": chave()})
    with urllib.request.urlopen(r, timeout=300) as f:
        destino.write_bytes(f.read())


def modelos():
    vistos, tok = [], ""
    while True:
        d = req("GET", f"{API}/models?pageSize=1000" + (f"&pageToken={tok}" if tok else ""))
        vistos += [m["name"].split("/")[-1] for m in d.get("models", []) if "predictLongRunning" in m.get("supportedGenerationMethods", [])]
        tok = d.get("nextPageToken")
        if not tok:
            return vistos


def gerar(c, modelo):
    inst = {"prompt": c["prompt"]}
    if c.get("imagem"):
        p = ROOT / c["imagem"]
        inst["image"] = {"bytesBase64Encoded": base64.b64encode(p.read_bytes()).decode(),
                         "mimeType": "image/png" if p.suffix == ".png" else "image/jpeg"}
    par = {"aspectRatio": "9:16", "durationSeconds": c.get("segundos", 8), "resolution": "1080p"}
    if c.get("negativo"):
        par["negativePrompt"] = c["negativo"]
    op = req("POST", f"{API}/models/{modelo}:predictLongRunning", {"instances": [inst], "parameters": par})
    t0 = time.time()
    while not op.get("done"):
        time.sleep(10)
        op = req("GET", f"{API}/{op['name']}")
        print(f"  {c['id']}: {int(time.time() - t0)} s...", flush=True)
    if "error" in op:
        raise SystemExit(f"{c['id']}: {op['error']}")
    amostras = op["response"]["generateVideoResponse"].get("generatedSamples") or []
    if not amostras:
        raise SystemExit(f"{c['id']}: o Veo não devolveu vídeo (filtro de conteúdo?): {json.dumps(op['response'])[:400]}")
    baixar(amostras[0]["video"]["uri"], OUT / f"{c['id']}.mp4")


def main():
    rot = json.loads((DIR / "roteiro.json").read_text())
    clipes = rot["clipes"]
    so = arg("--so")
    if so:
        clipes = [c for c in clipes if c["id"] in so.split(",")]
    refazer = (arg("--refazer") or "").split(",")
    modelo = arg("--modelo", PADRAO)
    OUT.mkdir(exist_ok=True)
    faltam = [c for c in clipes if c["id"] in refazer or not (OUT / f"{c['id']}.mp4").exists()]
    seg = sum(c.get("segundos", 8) for c in faltam)
    print(f"{len(faltam)} clipes, {seg} s com {modelo}: cerca de US$ {seg * PRECO.get(modelo, 0.40):.2f}")
    if "--orcamento" in sys.argv:
        for m, p in PRECO.items():
            print(f"  {m}: US$ {seg * p:.2f}")
        return
    if "--modelos" in sys.argv:
        print("\n".join(modelos()) or "nenhum modelo de vídeo nesta chave (o Veo exige o faturamento ativo no Google AI Studio)")
        return
    for c in faltam:
        print(f"gerando {c['id']}...", flush=True)
        gerar(c, modelo)
        print(f"  ok: saida/{c['id']}.mp4", flush=True)


if __name__ == "__main__":
    main()
