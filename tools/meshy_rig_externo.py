#!/usr/bin/env python3
"""Esqueleto e animações do Meshy num modelo feito fora dele (ex.: peças do Reino dos Dragões da Tripo).

Uso: python3 tools/meshy_rig_externo.py <modelo_z.glb> <pasta_saida> <altura_m> <ação,ação,...>
O modelo precisa olhar para +Z (glTF) e já estar na altura certa (tools/blender/orientar.py).
Custo no Meshy: rig 5 + 3 por ação. Progresso em <pasta_saida>/meshy_rig.json (não paga duas vezes).
Saída: <pasta_saida>/meshy_rigged.glb, meshy_animated.glb, meshy_walk.glb
"""
import base64, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import meshy_gen as M

src, out, alt, acoes = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), float(sys.argv[3]), [int(x) for x in sys.argv[4].split(",")]
st = out / "meshy_rig.json"; s = json.loads(st.read_text()) if st.exists() else {}
save = lambda: st.write_text(json.dumps(s, indent=2))
if "rig" not in s:
    uri = "data:application/octet-stream;base64," + base64.b64encode(src.read_bytes()).decode()
    s["rig"] = M.call("POST", "/openapi/v1/rigging", {"model_url": uri, "height_meters": alt})["result"]; save()
rig = M.wait(f"/openapi/v1/rigging/{s['rig']}", f"{out.name} rig")
M.download(rig["result"]["rigged_character_glb_url"], out / "meshy_rigged.glb")
b = rig["result"].get("basic_animations") or {}
w = b.get("walking_armature_glb_url") or b.get("walking_glb_url")
if w: M.download(w, out / "meshy_walk.glb")
if "anim" not in s:
    s["anim"] = M.call("POST", "/openapi/v1/animations", {"rig_task_id": s["rig"], "action_ids": acoes})["result"]; s["acoes"] = acoes; save()
an = M.wait(f"/openapi/v1/animations/{s['anim']}", f"{out.name} animações")
M.download(an["result"]["animation_glb_url"], out / "meshy_animated.glb")
s["done"] = True; save()
print(f"{out.name}: ok; saldo Meshy {M.call('GET', '/openapi/v1/balance').get('balance')}", flush=True)
