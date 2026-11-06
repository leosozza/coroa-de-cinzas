#!/usr/bin/env python3
"""Clipes de golpe e de morte por tipo de golpe (data/plano-golpes.md) sobre os rigs já gerados.

Uso: python3 tools/meshy_golpes.py [peao bispo dama rei arqueiro]
Custo: 3 créditos por ação (uma tarefa de animação por personagem, com todas as ações juntas).
Progresso em "golpes" em assets/meshy/state/<slug>@img.json: rodar de novo não paga duas vezes.
Saída: assets/meshy/<slug>/golpes.glb (clipes com texturas mínimas) e golpes.gltf.json (para o Artifact).
Os nomes dos clipes no GLB são as chaves do Meshy (ex.: Electrocuted_Fall); veja CLIPES abaixo.
"""
import json
import subprocess
import sys

import meshy_gen as M

# ação do Meshy -> uso no jogo
USO = {
    398: "arremesso de frasco/granada (explosao, magia em frasco, veneno)",
    421: "arremesso da espada/lança por cima do ombro (arremesso)",
    365: "rei se ajoelha no xeque-mate",
    551: "captor carrega/conduz o rei preso",
    181: "morte por magia (Electrocuted_Fall)",
    182: "morte por explosao (Shot_and_Blown_Back)",
    184: "morte por arremesso (Shot_and_Fall_Forward)",
    185: "morte por flecha (Shot_and_Slow_Fall_Backward)",
    186: "morte por veneno (Strangled_and_Fall_Forward)",
}
MORTES = [181, 182, 184, 186]
CLIPES = {
    "peao":     [398, 421, *MORTES, 551],
    "bispo":    [*MORTES, 551],
    "dama":     [398, *MORTES, 551],
    "rei":      [365, 398],
    "arqueiro": [*MORTES, 185],
}
COST = 3


def golpes(slug):
    s = M.State(f"{slug}@img")
    if not s.get("rig"):
        print(f"{slug}: sem rig, pulando", flush=True)
        return
    acts = CLIPES[slug]
    if "golpes" not in s:
        s["golpes"] = M.call("POST", "/openapi/v1/animations", {
            "rig_task_id": s["rig"], "action_ids": acts})["result"]
        s["golpes_actions"] = acts
        s.save()
    t = M.wait(f"/openapi/v1/animations/{s['golpes']}", f"{slug} golpes")
    d = M.OUT / slug
    full = d / "golpes.full.glb"
    M.download(t["result"]["animation_glb_url"], full)
    small = d / "golpes.glb"
    subprocess.run(["npx", "-y", "@gltf-transform/cli@4.5.1", "resize", str(full), str(small),
                    "--width", "16", "--height", "16"], check=True, capture_output=True)
    subprocess.run([sys.executable, str(M.ROOT / "tools" / "glb_to_json.py"), str(small)], check=True)
    s["golpes_done"] = True
    s.save()


if __name__ == "__main__":
    slugs = sys.argv[1:] or list(CLIPES)
    todo = [x for x in slugs if not M.State(f"{x}@img").get("golpes_done")]
    novos = [x for x in todo if "golpes" not in M.State(f"{x}@img")]
    need = COST * sum(len(CLIPES[x]) for x in novos)
    bal = M.call("GET", "/openapi/v1/balance").get("balance", 0)
    print(f"saldo {bal}, custo previsto {need} créditos ({', '.join(novos) or 'nada novo'})", flush=True)
    if need > 120:
        sys.exit("Passaria do limite aprovado (120 créditos); nada foi gerado.")
    if bal < need:
        sys.exit("Saldo insuficiente; nada foi gerado.")
    for slug in todo:
        golpes(slug)
    (M.ROOT / "assets" / "meshy" / "golpes.json").write_text(json.dumps(
        {"acoes": {str(k): v for k, v in USO.items()}, "clipes": CLIPES}, indent=2, ensure_ascii=False))
    subprocess.run(["node", str(M.ROOT / "tools" / "meshy-manifest.js")], check=False)
    print(f"saldo restante: {M.call('GET', '/openapi/v1/balance').get('balance')} créditos", flush=True)
