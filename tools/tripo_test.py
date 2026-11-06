#!/usr/bin/env python3
"""Teste do Tripo3D: 1 peão (mesma arte-conceito do Meshy) -> modelo -> rig -> animações, para comparar.

Uso: python3 tools/tripo_test.py
Chave: Keychain do macOS, serviço "tripo-api-key" (nunca impressa).
Limite: para se o gasto do teste passar de 100 créditos (US$ 1,00).
Progresso em assets/tripo/state.json: rodar de novo não paga duas vezes.
Saída: assets/tripo/peao/ (model.glb, rigged.glb, animated.glb, preview.png, custos.json).
"""
import json
import subprocess
import time
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://openapi.tripo3d.ai/v3"
OUT = ROOT / "assets" / "tripo" / "peao"
STATE = ROOT / "assets" / "tripo" / "state.json"
IMG = ROOT / "assets" / "concepts" / "peao.jpg"
LIMITE = 100
ANIMS = ["preset:biped:idle", "preset:biped:slash", "preset:biped:hit_to_body_01",
         "preset:biped:fall", "preset:biped:victory_celebration"]


def key():
    k = subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("id -un"),
                        "-s", "tripo-api-key", "-w"], capture_output=True, text=True).stdout.strip()
    if not k:
        raise SystemExit("Falta a chave no Keychain (serviço tripo-api-key).")
    return k


K = key()


def req(method, path, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={"Authorization": f"Bearer {K}", "Content-Type": ctype})
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            j = json.load(resp)
    except urllib.error.HTTPError as e:
        j = json.loads(e.read() or b"{}")
    if j.get("code") != 0:
        raise SystemExit(f"Erro da API em {path}: {j.get('code')} {j.get('message')} {j.get('suggestion', '')}")
    return j["data"]


def balance():
    return req("GET", "/account/balance").get("balance")


def upload(p):
    b = "----tripo" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{p.name}\"\r\n"
            f"Content-Type: image/jpeg\r\n\r\n").encode() + p.read_bytes() + f"\r\n--{b}--\r\n".encode()
    return req("POST", "/files", raw=body, ctype=f"multipart/form-data; boundary={b}")["file_token"]


def wait(tid, label):
    last = None
    while True:
        t = req("GET", f"/tasks/{tid}")
        st, pr = t.get("status"), t.get("progress")
        if (st, pr) != last:
            print(f"  {label}: {st} {pr}%", flush=True)
            last = (st, pr)
        if st == "success":
            return t
        if st in ("failed", "cancelled"):
            raise SystemExit(f"{label} terminou com {st}: {json.dumps(t)[:300]}")
        time.sleep(5)


def dl(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"  baixado {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)", flush=True)


def urls(t):
    o = t.get("output") or {}
    return {k: v for k, v in o.items() if isinstance(v, str) and v.startswith("http")}


def main():
    s = json.loads(STATE.read_text()) if STATE.exists() else {}
    save = lambda: (STATE.parent.mkdir(parents=True, exist_ok=True), STATE.write_text(json.dumps(s, indent=2)))
    b0 = s.setdefault("saldo_inicial", balance())
    save()
    print(f"saldo inicial do teste: {b0} créditos (limite do teste: {LIMITE})", flush=True)
    gasto = lambda: b0 - balance()

    if "modelo" not in s:
        tok = upload(IMG)
        s["modelo"] = req("POST", "/generation/image-to-model", {
            "input": tok, "model": "v3.1-20260211", "texture": True, "pbr": False,
            "face_limit": 8000, "texture_quality": "standard", "orientation": "default"})["task_id"]
        save()
    t = wait(s["modelo"], "modelo")
    s["custo_modelo"] = t.get("credits_consumed")
    save()
    u = urls(t)
    print("  saídas:", list(u), flush=True)
    for k, v in u.items():
        dl(v, OUT / ("preview.png" if "image" in k else f"{k}.glb"))
    if gasto() > LIMITE:
        raise SystemExit(f"Passou do limite ({gasto()} créditos); parei antes do rig.")

    if "rig" not in s:
        s["rig"] = req("POST", "/animations/rig", {
            "input": s["modelo"], "model": "v1.0-20240301", "rig_type": "biped", "out_format": "glb"})["task_id"]
        save()
    t = wait(s["rig"], "rig")
    s["custo_rig"] = t.get("credits_consumed")
    save()
    for k, v in urls(t).items():
        if "image" not in k:
            dl(v, OUT / "rigged.glb")
    if gasto() > LIMITE:
        raise SystemExit(f"Passou do limite ({gasto()} créditos); parei antes das animações.")

    if "anim" not in s:
        cabem = int((LIMITE - gasto()) // 10)  # 10 créditos por animação
        if cabem < 1:
            raise SystemExit("Sem espaço no limite para animações.")
        anims = ANIMS[:min(5, cabem)]
        print(f"  animações dentro do limite: {anims}", flush=True)
        s["anims"] = anims
        s["anim"] = req("POST", "/animations/retarget", {
            "input": s["rig"], "animations": anims, "out_format": "glb",
            "export_with_geometry": True, "animate_in_place": True})["task_id"]
        save()
    t = wait(s["anim"], "animações")
    s["custo_anim"] = t.get("credits_consumed")
    save()
    for k, v in urls(t).items():
        if "image" not in k:
            dl(v, OUT / ("animated.glb" if k == "model_url" else f"{k}.glb"))
    s["gasto_total"] = gasto()
    save()
    (OUT / "custos.json").write_text(json.dumps({k: s.get(k) for k in
        ("custo_modelo", "custo_rig", "custo_anim", "gasto_total")}, indent=2))
    print(f"gasto do teste: {s['gasto_total']} créditos; saldo agora: {balance()}", flush=True)


if __name__ == "__main__":
    main()
