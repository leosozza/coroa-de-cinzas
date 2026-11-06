#!/usr/bin/env python3
"""Gera os personagens de Coroa de Cinzas no Meshy: texto -> modelo -> textura -> rig -> animações.

Uso: python3 tools/meshy_gen.py [--from-image] peao [torre bispo ...]
A chave vem do Keychain do macOS (serviço "meshy-api-key") e nunca é impressa.
O progresso fica em assets/meshy/state/<peça>.json, então rodar de novo retoma de onde parou.
Cada peça pode rodar num processo próprio, em paralelo.
"""
import base64
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

API = "https://api.meshy.ai"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "meshy"
STATES = OUT / "state"

STYLE = ("dark fantasy game character, full body, A-pose, facing forward, chunky readable silhouette, "
         "hand-painted PBR textures, no base, ")
AURORA = "ivory, polished gold, steel and warm red cloth, "

# Animações (IDs da biblioteca do Meshy): parado, andar, atacar, morrer.
IDLE, DEAD = 0, 189
CHARS = {
    # Os dois exércitos usam os mesmos modelos; o lado preto é tingido no jogo.
    # rig=False: não é humanoide (Cavalo com cavaleiro, Torre com atirador); o jogo anima o modelo inteiro.
    "peao":      dict(height=1.6, walk=560, attack=240, prompt=AURORA + "young squire soldier, kettle helmet, gambeson with gold trim, round wooden shield on left arm, short steel arming sword held in right hand, no spear, no polearm"),
    "torre":     dict(height=2.6, rig=False, prompt=AURORA + "stone watchtower with battlements and an archer on top"),
    "bispo":     dict(height=1.9, walk=30,  attack=125, prompt=AURORA + "warrior bishop priest, tall pointed mitre, ornate ivory and gold vestments, golden crozier staff topped with a glowing holy flame"),
    "dama":      dict(height=1.9, walk=30,  attack=129, prompt=AURORA + "regal warrior queen, tall golden crown, elegant armored gown with flowing cape, crackling lightning around her raised hand"),
    "cavalo":    dict(height=2.4, rig=False, prompt=AURORA + "armored knight riding an armored warhorse"),
    "rei":       dict(height=2.0, walk=30,  attack=219, prompt=AURORA + "noble bearded king, tall jeweled crown topped with a cross, ornate golden plate armor, long crimson and gold cape, longsword"),
    "torre_base":     dict(height=2.6, rig=False, prompt=AURORA + "stone watchtower with battlements, empty top"),
    "arqueiro":       dict(height=1.6, walk=228, attack=224, prompt=AURORA + "young archer soldier with a longbow"),
    "cavalo_montado": dict(height=2.4, rig=False, prompt=AURORA + "armored knight riding an armored warhorse, right hand empty"),
}


def key():
    k = subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("id -un"),
                        "-s", "meshy-api-key", "-w"], capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("Chave do Meshy não encontrada no Keychain (serviço meshy-api-key).")
    return k


KEY = key()


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code == 429 and attempt < 4:
                time.sleep(10 * (attempt + 1))
                continue
            raise SystemExit(f"Meshy {method} {path} -> HTTP {e.code}: {msg}")
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(5)
                continue
            raise


def wait(path, label):
    last = -1
    while True:
        t = call("GET", path)
        st, pr = t.get("status"), t.get("progress", 0)
        if pr != last:
            print(f"  {label}: {st} {pr}%", flush=True)
            last = pr
        if st == "SUCCEEDED":
            return t
        if st in ("FAILED", "CANCELED", "EXPIRED"):
            raise SystemExit(f"  {label} falhou: {json.dumps(t.get('task_error'))}")
        time.sleep(8)


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    print(f"  baixado {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)", flush=True)


class State(dict):
    """Progresso de uma peça, salvo a cada etapa para poder retomar sem gastar de novo."""
    def __init__(self, name):
        self.path = STATES / f"{name}.json"
        super().__init__(json.loads(self.path.read_text()) if self.path.exists() else {})

    def save(self):
        STATES.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self, indent=2, ensure_ascii=False))


def model_from_image(slug, s, spec):
    """Arte-conceito (assets/concepts/<slug>.png) -> modelo texturizado, numa tarefa só."""
    img = ROOT / "assets" / "concepts" / f"{slug}.jpg"
    if "i23d" not in s:
        uri = "data:image/jpeg;base64," + base64.b64encode(img.read_bytes()).decode()
        s["i23d"] = call("POST", "/openapi/v1/image-to-3d", {
            "image_url": uri, "ai_model": "meshy-6-lite", "should_texture": True, "enable_pbr": False,
            "should_remesh": True, "topology": "triangle", "target_polycount": 8000,
            "pose_mode": "a-pose" if spec.get("rig", True) else "", "target_formats": ["glb"]})["result"]
        s.save()
    return s["i23d"], wait(f"/openapi/v1/image-to-3d/{s['i23d']}", "modelo da imagem")


def run(slug, from_image=False):
    spec = CHARS[slug]
    s = State(slug + ("@img" if from_image else ""))
    print(f"== {slug}" + (" (da imagem)" if from_image else ""), flush=True)
    if from_image:
        model_id, ref = model_from_image(slug, s, spec)
    else:
        model_id, ref = text_model(spec, s)
    if spec.get("rig", True):
        finish(slug, spec, s, model_id, ref, from_image)
    else:
        d = OUT / slug
        if ref.get("thumbnail_url"):
            download(ref["thumbnail_url"], d / "thumbnail.png")
        download(ref["model_urls"]["glb"], d / "model.glb")
        s["done"] = True
        s.save()


def text_model(spec, s):
    if "preview" not in s:
        s["preview"] = call("POST", "/openapi/v2/text-to-3d", {
            "mode": "preview", "prompt": STYLE + spec["prompt"], "ai_model": "meshy-6-lite",
            "should_remesh": True, "topology": "triangle", "target_polycount": 8000,
            "pose_mode": "a-pose", "target_formats": ["glb"]})["result"]
        s.save()
    wait(f"/openapi/v2/text-to-3d/{s['preview']}", "modelo")
    if "refine" not in s:
        s["refine"] = call("POST", "/openapi/v2/text-to-3d", {
            "mode": "refine", "preview_task_id": s["preview"], "enable_pbr": False,
            "texture_resolution": "2k", "target_formats": ["glb"]})["result"]
        s.save()
    return s["refine"], wait(f"/openapi/v2/text-to-3d/{s['refine']}", "textura")


def finish(slug, spec, s, model_id, ref, from_image):
    if "rig" not in s:
        s["rig"] = call("POST", "/openapi/v1/rigging", {
            "input_task_id": model_id, "height_meters": spec["height"]})["result"]
        s.save()
    rig = wait(f"/openapi/v1/rigging/{s['rig']}", "rig")
    # Da imagem: a caminhada vem grátis com o rig, então só pagamos parado, ataque e morte.
    actions = [IDLE, spec["attack"], DEAD] if from_image else [IDLE, spec["walk"], spec["attack"], DEAD]
    if "anim" not in s:
        s["anim"] = call("POST", "/openapi/v1/animations", {
            "rig_task_id": s["rig"], "action_ids": actions})["result"]
        s["actions"] = actions
        s.save()
    anim = wait(f"/openapi/v1/animations/{s['anim']}", "animações")
    d = OUT / slug
    if from_image and d.exists() and not (d / "walk.glb").exists() and not (OUT / f"{slug}_texto").exists():
        d.rename(OUT / f"{slug}_texto")  # guarda a versão gerada por texto
    if ref.get("thumbnail_url"):
        download(ref["thumbnail_url"], d / "thumbnail.png")
    download(rig["result"]["rigged_character_glb_url"], d / "rigged.glb")
    download(anim["result"]["animation_glb_url"], d / "animated.glb")
    basic = rig["result"].get("basic_animations") or {}
    walk = basic.get("walking_armature_glb_url") or basic.get("walking_glb_url")
    if from_image and walk:
        download(walk, d / "walk.glb")
    s["done"] = True
    s.save()


if __name__ == "__main__":
    args = sys.argv[1:]
    from_image = "--from-image" in args
    slugs = [a for a in args if a != "--from-image"] or list(CHARS)
    for slug in slugs:
        if slug not in CHARS:
            sys.exit(f"Personagem desconhecido: {slug}. Opções: {', '.join(CHARS)}")
        if from_image and not (ROOT / "assets" / "concepts" / f"{slug}.jpg").exists():
            sys.exit(f"Falta a arte-conceito assets/concepts/{slug}.jpg")
    for slug in slugs:
        run(slug, from_image)
    bal = call("GET", "/openapi/v1/balance")
    print(f"saldo restante: {bal.get('balance')} créditos", flush=True)
