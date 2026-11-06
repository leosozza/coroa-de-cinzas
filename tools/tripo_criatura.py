#!/usr/bin/env python3
"""Rig e animações de criatura (não humanoide) na Tripo, a partir de um GLB pronto (ex.: o dragão do Meshy).

Uso: python3 tools/tripo_criatura.py assets/meshy/dragao/model.glb dragao [--checar]
Progresso em assets/tripo/<slug>_rig.json (não paga duas vezes). Para se o gasto passar de 70 créditos.
Saída: assets/meshy/<slug>/rigged.glb e animated.glb
"""
import json, sys, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tripo_test as T

src, slug = Path(sys.argv[1]), sys.argv[2]
LIMITE = 70
st = T.ROOT / "assets" / "tripo" / f"{slug}_rig.json"
s = json.loads(st.read_text()) if st.exists() else {}
save = lambda: (st.parent.mkdir(parents=True, exist_ok=True), st.write_text(json.dumps(s, indent=2)))
b0 = s.setdefault("saldo_inicial", T.balance()); save()
gasto = lambda: b0 - T.balance()

def upload_glb(p):
    b = "----tripo" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{p.name}\"\r\n"
            f"Content-Type: model/gltf-binary\r\n\r\n").encode() + p.read_bytes() + f"\r\n--{b}--\r\n".encode()
    return T.req("POST", "/files", raw=body, ctype=f"multipart/form-data; boundary={b}")["file_token"]

if "file" not in s:
    s["file"] = upload_glb(src); save()
if "check" not in s:
    s["check"] = T.req("POST", "/animations/rig-check", {"input": s["file"]})["task_id"]; save()
c = T.wait(s["check"], "rig-check")
print("CHECK", json.dumps(c.get("output"), ensure_ascii=False)[:400], "custo", c.get("credits_consumed"), flush=True)
if "--checar" in sys.argv:
    sys.exit(0)
tipo = (c.get("output") or {}).get("rig_type") or "quadruped"
if "rig" not in s:
    s["rig"] = T.req("POST", "/animations/rig", {"input": s["file"], "model": "v2.5-20260210",
                                                  "rig_type": tipo, "out_format": "glb"})["task_id"]; s["tipo"] = tipo; save()
r = T.wait(s["rig"], "rig"); s["custo_rig"] = r.get("credits_consumed"); save()
out = T.ROOT / "assets" / "meshy" / slug
for k, v in T.urls(r).items():
    if "image" not in k: T.dl(v, out / "rigged.glb")
if gasto() > LIMITE: sys.exit(f"Passou do limite ({gasto()}); parei antes das animações.")
anims = ["preset:idle", "preset:quadruped:walk" if tipo == "quadruped" else "preset:walk", "preset:slash", "preset:fall", "preset:hurt"]
cabem = int((LIMITE - gasto()) // 10); anims = anims[:max(0, cabem)]
if "anim" not in s and anims:
    s["anim"] = T.req("POST", "/animations/retarget", {"input": s["rig"], "animations": anims, "out_format": "glb",
                                                       "export_with_geometry": True, "animate_in_place": True})["task_id"]
    s["anims"] = anims; save()
a = T.wait(s["anim"], "animações"); s["custo_anim"] = a.get("credits_consumed")
for k, v in T.urls(a).items():
    if "image" not in k: T.dl(v, out / "animated.glb")
s["gasto"] = gasto(); save()
print(f"tipo {tipo}; animações {s.get('anims')}; gasto {s['gasto']} créditos; saldo {T.balance()}", flush=True)
