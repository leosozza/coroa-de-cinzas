#!/usr/bin/env python3
"""Chefões das arenas (figuras gigantes do cenário, não são peças) a partir das artes em assets/concepts/reinos/<reino>/chefe/.

Uso: python3 tools/meshy_chefe.py [deus_morte discipulo]
deus_morte: modelo completo (latest, textura + PBR) -> rig -> 3 clipes (postura de combate, golpe de foice, invocação).
discipulo: modelo completo sem rig (o jogo faz a aparição flutuar por código).
A arte já está em pose A: sem pose_mode (a conversão de pose pode apagar a arma).
Progresso em assets/meshy/state/chefe_<nome>.json (rodar de novo não paga duas vezes). Para antes de passar do LIMITE.
Saída: assets/meshy/chefes/<nome>/ (model.glb ou rigged.glb + animated.glb, thumbnail.png)
"""
import base64, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import meshy_gen as M

LIMITE = 135
CHEFES = {
    "deus_morte": dict(reino="ferro_negro", arte="deus_morte_v1.png", rig=True, altura=3.0, poly=20000,
                       acoes=[89, 237, 125]),   # Combat_Stance, Charged_Axe_Chop, Charged_Spell_Cast
    "discipulo":  dict(reino="ferro_negro", arte="discipulo_v1.png", rig=False, poly=12000),
    # avatar da Aurora (xeque-mate): desce do céu, aponta a espada (Sword_Judgment) e fica em guarda
    "arcanjo":    dict(arte="reinos/aurora/avatar/arcanjo_v1.png", rig=True, altura=3.0, poly=20000,
                       acoes=[89, 102, 125]),   # Combat_Stance, Sword_Judgment, Charged_Spell_Cast
    # evoluções do Arcano por reino (o Cavaleiro transformado; estáticas, o jogo anima por código)
    "pesadelo":     dict(arte="evolucoes/pesadelo_v2.png", rig=False, poly=20000),
    "dragao_ossos": dict(arte="evolucoes/dragao_ossos_v1.png", rig=False, poly=20000),
    "serpe":        dict(arte="evolucoes/serpe_v1.png", rig=False, poly=20000),
    # mascote do reino Alpha da Lua Nova: o lobo gigante (estático, anda por código) que vira o lobisomem
    "lobo_gigante": dict(arte="reinos/lua_nova/lobo_gigante.png", rig=False, poly=20000),
    "lobisomem":    dict(arte="reinos/lua_nova/lobisomem.png", rig=True, altura=3.5, poly=20000,
                         acoes=[0, 214, 198]),   # Idle, Punch_Forward_with_Both_Fists, Punch_Combo (o 464 saiu da biblioteca)
    # evoluções do Arcano da Aurora (estáticas): o Pégaso (cavaleiro no cavalo alado) e o Golem de Pedra (a torre que vira colosso)
    "pegaso":       dict(arte="evolucoes/pegaso_v1.png", rig=False, poly=20000),
    "golem":        dict(arte="torre_golem.jpg", rig=False, poly=16000, modelo="meshy-6-lite"),   # lite: 15 créditos
    # mascote do Clã dos Primatas: o ídolo gorila de pedra que acorda, bate no peito e arremessa o Rei
    "idolo":        dict(arte="reinos/primatas/idolo.png", rig=True, altura=3.6, poly=20000,
                         acoes=[0, 214, 198]),   # Idle, Punch_Forward_with_Both_Fists (soco no chão), Punch_Combo (bate no peito/golpeia)
    # mascote do Abismo Estelar: a Rainha-Mãe colossal (estática: quatro patas e cauda, o jogo anima por código)
    "rainha_mae":   dict(arte="reinos/abismo/rainha_mae.png", rig=False, poly=24000),
}
CUSTO = lambda n: (15 if CHEFES[n].get("modelo") == "meshy-6-lite" else 30) + ((5 + 3 * len(CHEFES[n]["acoes"])) if CHEFES[n]["rig"] else 0)


def run(nome):
    spec = CHEFES[nome]
    s = M.State(f"chefe_{nome}")
    img = M.ROOT / "assets" / "concepts" / (f"reinos/{spec['reino']}/chefe/{spec['arte']}" if "reino" in spec else spec["arte"])
    out = M.ROOT / "assets" / "meshy" / "chefes" / nome
    print(f"== {nome}", flush=True)
    if "modelo" not in s:
        mime = "image/jpeg" if img.suffix.lower() in (".jpg", ".jpeg") else "image/png"
        uri = f"data:{mime};base64," + base64.b64encode(img.read_bytes()).decode()
        body = {"image_url": uri, "ai_model": spec.get("modelo", "latest"), "should_texture": True, "enable_pbr": True,
                "should_remesh": True, "topology": "triangle", "target_polycount": spec["poly"], "target_formats": ["glb"]}
        s["modelo"] = M.call("POST", "/openapi/v1/image-to-3d", body)["result"]; s.save()
    ref = M.wait(f"/openapi/v1/image-to-3d/{s['modelo']}", f"{nome} modelo")
    if ref.get("thumbnail_url"): M.download(ref["thumbnail_url"], out / "thumbnail.png")
    M.download(ref["model_urls"]["glb"], out / "model.glb")
    if not spec["rig"]:
        s["done"] = True; s.save(); return
    if "rig" not in s:
        s["rig"] = M.call("POST", "/openapi/v1/rigging", {"input_task_id": s["modelo"], "height_meters": spec["altura"]})["result"]; s.save()
    rig = M.wait(f"/openapi/v1/rigging/{s['rig']}", f"{nome} rig")
    M.download(rig["result"]["rigged_character_glb_url"], out / "rigged.glb")
    if "anim" not in s:
        s["anim"] = M.call("POST", "/openapi/v1/animations", {"rig_task_id": s["rig"], "action_ids": spec["acoes"]})["result"]; s.save()
    an = M.wait(f"/openapi/v1/animations/{s['anim']}", f"{nome} animações")
    M.download(an["result"]["animation_glb_url"], out / "animated.glb")
    s["done"] = True; s.save()


if __name__ == "__main__":
    nomes = [a for a in sys.argv[1:] if not a.startswith("--")] or list(CHEFES)
    novos = [n for n in nomes if not M.State(f"chefe_{n}").get("modelo")]
    need = sum(CUSTO(n) for n in novos)
    bal = M.call("GET", "/openapi/v1/balance").get("balance", 0)
    print(f"saldo {bal}; custo previsto {need} créditos ({', '.join(novos) or 'nada novo'})", flush=True)
    if need > LIMITE: sys.exit(f"Passaria do limite aprovado ({LIMITE}); nada foi gerado.")
    if bal < need: sys.exit("Saldo insuficiente; nada foi gerado.")
    for n in nomes: run(n)
    print(f"saldo restante: {M.call('GET', '/openapi/v1/balance').get('balance')} créditos", flush=True)
