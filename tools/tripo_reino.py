#!/usr/bin/env python3
"""Reino feito inteiro na Tripo: artes (image-to-image, Nano Banana Pro) a partir da referência da equipe.

Uso: python3 tools/tripo_reino.py dragoes arte [peao bispo ...]
Progresso em assets/tripo/reino_<reino>.json (não paga duas vezes). Limite de gasto do reino: LIMITE créditos.
Saída: assets/concepts/reinos/<reino>/<peça>.png
"""
import json, sys, uuid, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tripo_test as T

LIMITE = 550
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
    "cavaleiro": "Redraw ONLY the armored rider on the dragon-masked warhorse of [image 1] as the chess knight: a huge black "
                 "warhorse in spiked dragon-scale barding with a horned dragon-skull chanfron, the rider in heavy dark "
                 "dragon-scale plate with a horned helm, a long lance upright in the RIGHT hand and a shield on the LEFT arm. "
                 "Side three-quarter view, whole horse visible from ears to hooves, standing still on four legs.",
    "rei": "Redraw ONLY the crowned winged figure in the center of [image 1] as the chess king: golden spiked crown over a dark "
           "mask, crimson and gold dragon-scale armor, huge crimson dragon wings folded behind the shoulders, a round shield "
           "swirling with fire and arcane light on the LEFT forearm held away from the body, a gold-hilted longsword in the "
           "RIGHT fist pointing down and outward.",
    "dama": "Redraw ONLY the horned dark winged figure right of center in [image 1] as the chess queen: dark dragon sorceress "
            "warrior with curved horns and a skull-like mask, black spiked dragon-scale armor, large bat-like dragon wings "
            "behind, tattered black cloak, a long blade glowing with icy blue runes in the RIGHT hand pointing down and "
            "outward away from the body, LEFT gauntlet open.",
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


if __name__ == "__main__":
    main()
