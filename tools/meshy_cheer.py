#!/usr/bin/env python3
"""Acrescenta a comemoração da vitória (um clipe só) aos personagens que já têm rig no Meshy.

Uso: python3 tools/meshy_cheer.py [peao bispo dama rei]
Custo: 3 créditos por personagem (uma ação de animação sobre o rig existente).
Lê o rig de assets/meshy/state/<slug>@img.json e salva o progresso em "cheer" no mesmo arquivo,
então rodar de novo não paga duas vezes.
Saída: assets/meshy/<slug>/cheer.glb (modelo + clipe) e cheer.gltf.json (para o Artifact).
"""
import subprocess
import sys

import meshy_gen as M

CHEER = 298  # "Cheer with Both Hands Up" (alternativa: 59 Victory Cheer)
COST = 3


def cheer(slug):
    s = M.State(f"{slug}@img")
    if not s.get("rig"):
        print(f"{slug}: sem rig gerado a partir da imagem, pulando", flush=True)
        return False
    if "cheer" not in s:
        s["cheer"] = M.call("POST", "/openapi/v1/animations", {
            "rig_task_id": s["rig"], "action_ids": [CHEER]})["result"]
        s["cheer_action"] = CHEER
        s.save()
    t = M.wait(f"/openapi/v1/animations/{s['cheer']}", f"{slug} comemoração")
    d = M.OUT / slug
    full = d / "cheer.full.glb"
    M.download(t["result"]["animation_glb_url"], full)
    # o jogo só usa o clipe: texturas mínimas para o arquivo ficar leve (cheer.glb -> cheer.gltf.json)
    small = d / "cheer.glb"
    subprocess.run(["npx", "-y", "@gltf-transform/cli", "resize", str(full), str(small),
                    "--width", "16", "--height", "16"], check=True, capture_output=True)
    subprocess.run([sys.executable, str(M.ROOT / "tools" / "glb_to_json.py"), str(small)], check=True)
    s["cheer_done"] = True
    s.save()
    return True


if __name__ == "__main__":
    slugs = sys.argv[1:] or ["peao", "bispo", "dama", "rei"]
    todo = [x for x in slugs if not M.State(f"{x}@img").get("cheer_done")]
    novos = [x for x in todo if "cheer" not in M.State(f"{x}@img")]
    bal = M.call("GET", "/openapi/v1/balance").get("balance", 0)
    need = COST * len(novos)
    print(f"saldo {bal}, custo previsto {need} créditos ({', '.join(novos) or 'nada novo'})", flush=True)
    if bal < need:
        sys.exit("Saldo insuficiente para a comemoração; nada foi gerado.")
    for slug in todo:
        cheer(slug)
    # o jogo só tenta carregar o que está no manifesto (evita 404): atualize-o com os arquivos novos
    subprocess.run(["node", str(M.ROOT / "tools" / "meshy-manifest.js")], check=False)
    print(f"saldo restante: {M.call('GET', '/openapi/v1/balance').get('balance')} créditos", flush=True)
