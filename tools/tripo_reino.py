#!/usr/bin/env python3
"""Reino feito inteiro na Tripo: artes (image-to-image, Nano Banana Pro) a partir da referência da equipe.

Uso: python3 tools/tripo_reino.py dragoes arte [peao bispo ...]   |   python3 tools/tripo_reino.py dragoes modelo [peao ...]
Progresso em assets/tripo/reino_<reino>.json (não paga duas vezes). Limite de gasto do reino: LIMITE créditos.
Saída: assets/concepts/reinos/<reino>/<peça>.png
"""
import json, sys, uuid, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tripo_test as T

LIMITE = 710  # arte (105) + 3D (400) + 2 versões da rainha (~200), pedidas pelo usuário
ESTILO = ("Ultra detailed, high resolution dark fantasy character concept art matching the team reference exactly: same "
          "painterly realism, palette of obsidian black, deep crimson, molten gold and glowing ember orange with icy blue "
          "magic accents, dragon-scale armor, dragon horns, wing motifs and dragon-skull details. Full body from head to feet, "
          "front view, A-pose with both arms held out and down about 40 degrees away from the body, legs slightly apart, clear "
          "gaps between arms, weapons and torso, the weapon held firmly in the character's RIGHT fist and NOT touching the legs. "
          "Plain light gray studio background, no pedestal, no ground, single character, no text, no signature, no watermark. ")
PECAS = {
    "peao": "Redraw ONLY the leftmost soldier of [image 1] as the chess pawn: dragon-scale armored foot soldier with a horned "
            "dragon helm, a short broad sword in the RIGHT fist pointing down and outward (no spear), a round shield with a "
            "dragon emblem strapped to the LEFT forearm held away from the torso.",
    "bispo": "Redraw ONLY the second figure from the left of [image 1] as the chess bishop: dragon priest with a winged "
             "dragon-crest helm and gold circlet, ornate scale robes, a tall dragon-headed staff holding a glowing ember orb "
             "gripped in the RIGHT hand and held away from the body, LEFT hand open with faint embers.",
    "cavaleiro": "Redraw ONLY the armored rider on the warhorse of [image 1] as the chess knight: a real, natural black warhorse "
                 "(correct horse anatomy and horse head shape) wearing a full DRAGON-HEAD armored chanfron: a sculpted dark metal "
                 "dragon face plate with a dragon snout, fangs along the edge, glowing ember eyes and long swept-back dragon horns "
                 "and spines, matching the dragon helm of [image 2]. NOT a skull, NOT a ram or goat, NO curled horns. Spiked "
                 "dragon-scale barding and a crimson caparison. The rider in dark dragon-scale plate with a horned dragon helm, "
                 "a long lance upright in the RIGHT hand and a dragon-emblem shield on the LEFT arm. Side three-quarter view, "
                 "whole horse visible from ears to hooves, standing still on four legs.",
    "rei": "Redraw ONLY the crowned winged figure in the center of [image 1] as the chess king: golden spiked crown over a dark "
           "mask, crimson and gold dragon-scale armor, huge crimson dragon wings folded behind the shoulders, a round shield "
           "swirling with fire and arcane light on the LEFT forearm held away from the body, a gold-hilted longsword in the "
           "RIGHT fist pointing down and outward.",
    "dama": "Redraw the dark winged queen of [image 1] as the chess queen, a beautiful dragon sorceress queen: a beautiful HUMAN "
            "woman's face (no mask, no skull), elegant features, glowing amber eyes, small dark curved dragon horns and a dark "
            "gold tiara, VERY LONG flowing silver-white hair with ember-red streaks reaching down to her KNEES behind her back, "
            "black spiked dragon-scale armor with gold trim and ember veins, large bat-like dragon wings with glowing ember veins "
            "behind. NO sword, NO weapon: a blazing SPHERE OF FIRE floats just above her open RIGHT palm, held out away from "
            "the body; LEFT hand open with faint embers. Hair stays behind the back and shoulders, not covering the arms.",
    "torre": "Redraw ONLY the dark tower on the far right of [image 1] as the chess rook: tall obsidian fortress tower with "
             "glowing icy blue windows and runes, iron spikes, a small dragon perched on the battlements and an archer with "
             "a glowing blue crossbow on top. Whole tower visible, front three-quarter view, plain background.",
}


def upload(p):
    b = "----tripo" + uuid.uuid4().hex
    mime = "image/png" if p.suffix == ".png" else "image/jpeg"
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{p.name}\"\r\nContent-Type: {mime}\r\n\r\n").encode() \
        + p.read_bytes() + f"\r\n--{b}--\r\n".encode()
    return T.req("POST", "/files", raw=body, ctype=f"multipart/form-data; boundary={b}")["file_token"]


def main():
    reino, etapa = sys.argv[1], sys.argv[2]; slugs = sys.argv[3:] or list(PECAS)
    st = T.ROOT / "assets" / "tripo" / f"reino_{reino}.json"
    s = json.loads(st.read_text()) if st.exists() else {}
    save = lambda: (st.parent.mkdir(parents=True, exist_ok=True), st.write_text(json.dumps(s, indent=2)))
    s.setdefault("saldo_inicial", T.balance()); save()
    pasta = T.ROOT / "assets" / "concepts" / "reinos" / reino
    if "ref" not in s: s["ref"] = upload(pasta / "referencia.jpg"); save()
    for slug in slugs:
        gasto = s["saldo_inicial"] - T.balance()
        if gasto > LIMITE: sys.exit(f"Limite do reino atingido ({gasto})")
        k = f"arte_{slug}"; out = pasta / f"{slug}.png"
        if k not in s:
            inputs = [s["ref"]]; txt = ESTILO + PECAS[slug]
            if slug != "peao" and (pasta / "peao.png").exists():
                if "ref_peao" not in s: s["ref_peao"] = upload(pasta / "peao.png"); save()
                inputs.append(s["ref_peao"]); txt += " Match the rendering detail, lighting and plain background of [image 2]."
            s[k] = T.req("POST", "/generation/image-to-image", {"inputs": inputs, "prompt": txt, "model": "banana_pro"})["task_id"]; save()
        t = T.wait(s[k], f"arte {slug}")
        s[f"custo_{k}"] = t.get("credits_consumed"); save()
        u = T.urls(t)
        url = next((v for kk, v in u.items() if "image" in kk or kk.endswith("url")), None)
        if not url: sys.exit(f"sem imagem na resposta: {json.dumps(t)[:300]}")
        urllib.request.urlretrieve(url, out)
        print(f"  {slug}: {out.relative_to(T.ROOT)} custo {t.get('credits_consumed')}", flush=True)
    print(f"gasto do reino até agora: {s['saldo_inicial'] - T.balance()} créditos; saldo {T.balance()}", flush=True)


# 3D: modelo (image-to-model) -> rig biped v1.0 (presets de combate) -> 3 animações; cavaleiro e torre sem rig
PECAS3D = {
    "peao": dict(rig=True, golpe="preset:biped:slash"),
    "bispo": dict(rig=True, golpe="preset:biped:cast_a_spell"),
    "dama": dict(rig=True, golpe="preset:biped:cast_a_spell"),
    "rei": dict(rig=True, golpe="preset:biped:slash"),
    "cavaleiro": dict(rig=False),
    "torre": dict(rig=False),
}


def modelo(reino, slugs):
    st = T.ROOT / "assets" / "tripo" / f"reino_{reino}.json"
    s = json.loads(st.read_text())
    save = lambda: st.write_text(json.dumps(s, indent=2))
    pasta = T.ROOT / "assets" / "concepts" / "reinos" / reino
    for slug in slugs:
        spec = PECAS3D[slug]; out = T.ROOT / "assets" / "meshy" / "reinos" / reino / slug
        gasto = s["saldo_inicial"] - T.balance()
        if gasto > LIMITE: sys.exit(f"Limite do reino atingido ({gasto}) antes de {slug}")
        if f"img3d_{slug}" not in s: s[f"img3d_{slug}"] = upload(pasta / f"{slug}.png"); save()
        if f"m3d_{slug}" not in s:
            s[f"m3d_{slug}"] = T.req("POST", "/generation/image-to-model", {
                "input": s[f"img3d_{slug}"], "model": "v3.1-20260211", "texture": True, "pbr": True,
                "face_limit": 16000, "texture_quality": "standard", "orientation": "align_image"})["task_id"]; save()
        t = T.wait(s[f"m3d_{slug}"], f"{slug} modelo"); s[f"custo_m3d_{slug}"] = t.get("credits_consumed"); save()
        for k, v in T.urls(t).items():
            T.dl(v, out / ("preview.png" if "image" in k else "model.glb"))
        if not spec["rig"]:
            continue
        if f"rig_{slug}" not in s:
            s[f"rig_{slug}"] = T.req("POST", "/animations/rig", {"input": s[f"m3d_{slug}"], "model": "v1.0-20240301",
                                                                 "rig_type": "biped", "out_format": "glb"})["task_id"]; save()
        r = T.wait(s[f"rig_{slug}"], f"{slug} rig"); s[f"custo_rig_{slug}"] = r.get("credits_consumed"); save()
        for k, v in T.urls(r).items():
            if "image" not in k: T.dl(v, out / "rigged.glb")
        if f"anim_{slug}" not in s:
            s[f"anim_{slug}"] = T.req("POST", "/animations/retarget", {"input": s[f"rig_{slug}"], "out_format": "glb",
                "animations": ["preset:biped:idle", spec["golpe"], "preset:biped:fall"],
                "export_with_geometry": True, "animate_in_place": True})["task_id"]; save()
        a = T.wait(s[f"anim_{slug}"], f"{slug} animações"); s[f"custo_anim_{slug}"] = a.get("credits_consumed"); save()
        for k, v in T.urls(a).items():
            if "image" not in k: T.dl(v, out / "animated.glb")
    print(f"gasto do reino: {s['saldo_inicial'] - T.balance()} créditos; saldo {T.balance()}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "modelo":
        modelo(sys.argv[1], sys.argv[3:] or list(PECAS3D))
    else:
        main()
