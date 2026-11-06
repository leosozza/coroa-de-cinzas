#!/usr/bin/env python3
"""Peças 3D de um reino a partir das artes em assets/concepts/reinos/<reino>/<peça>.png (Meshy).

Uso: python3 tools/meshy_reino.py ferro_negro [peao bispo dama rei cavaleiro torre]
Humanoides: modelo completo (latest, textura + PBR) em pose A -> rig -> 3 clipes (parado, golpe, morte).
Cavaleiro e torre: modelo completo sem rig (o jogo anima por código).
Os clipes de golpe/morte extras vêm dos golpes.glb já existentes (mesmo esqueleto do Meshy).
Progresso em assets/meshy/state/reino_<reino>_<peça>.json (rodar de novo não paga duas vezes).
Para antes de passar do limite aprovado (LIMITE créditos).
Saída: assets/meshy/reinos/<reino>/<peça>/ (model.glb ou rigged.glb + animated.glb, thumbnail.png)
"""
import base64, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import meshy_gen as M

LIMITE = 250
IDLE, MORTE = 0, 189
PECAS = {
    "peao":      dict(rig=True, altura=1.6, golpe=240, poly=15000),   # Thrust_Slash
    "bispo":     dict(rig=True, altura=1.8, golpe=125, poly=15000),   # Charged_Spell_Cast
    "dama":      dict(rig=True, altura=1.8, golpe=242, poly=15000),   # Charged_Slash
    "rei":       dict(rig=True, altura=1.9, golpe=128, poly=15000),   # Heavy_Hammer_Swing
    "cavaleiro": dict(rig=False, poly=20000),
    "torre":     dict(rig=False, poly=15000),
}
CUSTO = lambda p: 30 + (5 + 9 if PECAS[p]["rig"] else 0)


def run(reino, slug):
    spec = PECAS[slug]
    s = M.State(f"reino_{reino}_{slug}")
    img = M.ROOT / "assets" / "concepts" / "reinos" / reino / f"{slug}.png"
    out = M.ROOT / "assets" / "meshy" / "reinos" / reino / slug
    print(f"== {slug}", flush=True)
    if "modelo" not in s:
        uri = "data:image/png;base64," + base64.b64encode(img.read_bytes()).decode()
        body = {"image_url": uri, "ai_model": "latest", "should_texture": True, "enable_pbr": True,
                "should_remesh": True, "topology": "triangle", "target_polycount": spec["poly"], "target_formats": ["glb"]}
        if spec["rig"] and "--sem-pose" not in sys.argv: body["pose_mode"] = "a-pose"  # a conversão de pose pode apagar armas: --sem-pose quando a arte já está em pose A
        s["modelo"] = M.call("POST", "/openapi/v1/image-to-3d", body)["result"]; s.save()
    ref = M.wait(f"/openapi/v1/image-to-3d/{s['modelo']}", f"{slug} modelo")
    if ref.get("thumbnail_url"): M.download(ref["thumbnail_url"], out / "thumbnail.png")
    if not spec["rig"]:
        M.download(ref["model_urls"]["glb"], out / "model.glb"); s["done"] = True; s.save(); return
    if "rig" not in s:
        s["rig"] = M.call("POST", "/openapi/v1/rigging", {"input_task_id": s["modelo"], "height_meters": spec["altura"]})["result"]; s.save()
    rig = M.wait(f"/openapi/v1/rigging/{s['rig']}", f"{slug} rig")
    M.download(rig["result"]["rigged_character_glb_url"], out / "rigged.glb")
    basic = rig["result"].get("basic_animations") or {}
    walk = basic.get("walking_armature_glb_url") or basic.get("walking_glb_url")
    if walk: M.download(walk, out / "walk.glb")
    if "anim" not in s:
        s["anim"] = M.call("POST", "/openapi/v1/animations", {"rig_task_id": s["rig"], "action_ids": [IDLE, spec["golpe"], MORTE]})["result"]; s.save()
    an = M.wait(f"/openapi/v1/animations/{s['anim']}", f"{slug} animações")
    M.download(an["result"]["animation_glb_url"], out / "animated.glb")
    s["done"] = True; s.save()


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    reino = args[0]; slugs = args[1:] or list(PECAS)
    novos = [p for p in slugs if not M.State(f"reino_{reino}_{p}").get("modelo")]
    need = sum(CUSTO(p) for p in novos)
    bal = M.call("GET", "/openapi/v1/balance").get("balance", 0)
    print(f"saldo {bal}; custo previsto {need} créditos ({', '.join(novos) or 'nada novo'})", flush=True)
    if need > LIMITE: sys.exit(f"Passaria do limite aprovado ({LIMITE}); nada foi gerado.")
    if bal < need: sys.exit("Saldo insuficiente; nada foi gerado.")
    for p in slugs: run(reino, p)
    print(f"saldo restante: {M.call('GET', '/openapi/v1/balance').get('balance')} créditos", flush=True)
