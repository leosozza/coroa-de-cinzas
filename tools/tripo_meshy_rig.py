#!/usr/bin/env python3
"""Combinação: modelo da Tripo (olhando para +Z) -> rig do Meshy -> animações da biblioteca do Meshy.
Uso: python3 tools/tripo_meshy_rig.py [peao]
Custo no Meshy: rig 5 + 3 por ação. Progresso em assets/tripo/<slug>_meshy.json (não paga duas vezes).
Saída: assets/tripo/<slug>/combo_rigged.glb e combo_animated.glb
"""
import base64, json, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
import meshy_gen as M

slug = (sys.argv[1:] or ["peao"])[0]
ACOES = [0, 240, 189]  # Idle, Thrust_Slash, dying_backwards (as mesmas do peão do Meshy, para comparar)
d = M.ROOT / "assets" / "tripo" / slug
st = d.parent / f"{slug}_meshy.json"
s = json.loads(st.read_text()) if st.exists() else {}
save = lambda: st.write_text(json.dumps(s, indent=2))
bal = M.call("GET", "/openapi/v1/balance").get("balance", 0)
print(f"saldo Meshy {bal}; custo previsto {5 * ('rig' not in s) + 3 * len(ACOES) * ('anim' not in s)} créditos", flush=True)
if "rig" not in s:
    uri = "data:application/octet-stream;base64," + base64.b64encode((d / "model_z.glb").read_bytes()).decode()
    s["rig"] = M.call("POST", "/openapi/v1/rigging", {"model_url": uri, "height_meters": 1.6})["result"]; save()
rig = M.wait(f"/openapi/v1/rigging/{s['rig']}", "rig Meshy")
M.download(rig["result"]["rigged_character_glb_url"], d / "combo_rigged.glb")
if "anim" not in s:
    s["anim"] = M.call("POST", "/openapi/v1/animations", {"rig_task_id": s["rig"], "action_ids": ACOES})["result"]; save()
an = M.wait(f"/openapi/v1/animations/{s['anim']}", "animações Meshy")
M.download(an["result"]["animation_glb_url"], d / "combo_animated.glb")
s["done"] = True; save()
print(f"saldo restante: {M.call('GET', '/openapi/v1/balance').get('balance')} créditos", flush=True)
