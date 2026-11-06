#!/usr/bin/env python3
"""Artes-conceito de um reino (equipe com visual próprio) no Gemini Nano Banana, em alta resolução, para virar 3D no Meshy.

Uso: python3 tools/gemini_reino.py ferro_negro [peao cavaleiro bispo torre dama rei] [--tam 4K]
Chave: Keychain do macOS (serviço "gemini-api-key"), nunca impressa. Arquivos já gerados são pulados.
O Peão sai primeiro e serve de referência de estilo para as outras peças.
Pose pensada para o rig do Meshy: pose A, arma na mão DIREITA longe do corpo, escudo no antebraço ESQUERDO.
Saída: assets/concepts/reinos/<reino>/<peça>.jpg
"""
import base64, json, subprocess, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = "gemini-nano-banana-2.1"
URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

REINOS = {
    "ferro_negro": {
        "nome": "Legião do Ferro Negro",
        "posicao": {
            "peao": "The character is the leftmost warrior (spiked halo helmet, round black shield); give him a short sword instead of the spear.",
            "bispo": "The character is the second figure from the left (halo helmet, glowing golden cross staff).",
            "cavaleiro": "The character is the armored rider on the warhorse with the horse-skull mask.",
            "rei": "The character is the crowned figure in the center (golden crown, dark mask, crimson hooded cloak, glowing golden war hammer).",
            "dama": "The character is the skeletal dark warrior to the right of the center (spiked crown, long white hair, black cloak, jagged sword).",
            "torre": "The character is the stone watchtower on the far right with the archer on top.",
        },
        "estilo": ("Ultra detailed, high resolution dark fantasy character concept art, gritty painterly realism, "
                   "desaturated palette of blackened steel, charcoal, ash gray and dried-blood crimson accents, "
                   "worn battle-scarred armor with spikes and rivets, tattered dark cloth, subtle rim light, "
                   "intricate textures on metal, leather and skin. Full body from head to feet, front view, "
                   "standing in an A-pose with arms held out and down about 40 degrees away from the body, "
                   "legs slightly apart, clear gaps between arms, weapons and torso. Plain light gray studio "
                   "background, soft even lighting, single character, no text, no logo, no signature, no watermark. "),
        "pecas": {
            "peao": ("A grim legionnaire foot soldier for the chess pawn: lean scarred muscular torso crossed by black "
                     "leather straps, blackened steel greaves and bracers, bronze-black helmet crowned with a halo of "
                     "radiating spikes and a face guard, short broad steel sword gripped firmly in the RIGHT fist "
                     "pointing down and outward away from the leg, round black iron shield strapped to the LEFT forearm "
                     "held away from the torso, tattered dark crimson loincloth."),
            "cavaleiro": ("A dark knight for the chess knight, riding a huge black armored warhorse with spiked barding "
                          "and a skull chanfron: the rider wears heavy blackened plate armor with a horned great helm and a "
                          "tattered black cape, holding a long cavalry lance upright in the RIGHT hand and a black kite "
                          "shield on the LEFT arm. Side three-quarter view of horse and rider, whole horse visible."),
            "bispo": ("A grim holy warrior-priest for the chess bishop: lean scarred torso with blackened steel pauldrons and a "
                      "white-gray loincloth, helmet crowned with a glowing golden halo, a tall golden cross staff blazing with "
                      "holy light gripped in the RIGHT hand and held away from the body, the LEFT hand open."),
            "torre": ("A dark watchtower for the chess rook: a squat fortress tower of black weathered stone with iron "
                      "spikes, chains and tattered crimson banners, crenellated top, a grim archer in a horned helmet "
                      "standing on the battlements with a black longbow, ember-lit arrow slits, rocky base. "
                      "Whole tower visible, front three-quarter view."),
            "dama": ("A skeletal dark warrior queen for the chess queen: grinning skull face under a spiked black iron crown, long "
                     "flowing white hair, blackened spiked plate armor with a skull medallion, tattered black cloak, a long jagged "
                     "serrated sword in the RIGHT hand pointing down and outward away from the body, the LEFT gauntlet open."),
            "rei": ("A dark sovereign for the chess king: golden spiked crown over a black featureless mask, ornate blackened "
                    "plate armor with gold trim, long deep crimson cloak with gold embroidery, a heavy golden war hammer glowing "
                    "with holy fire in the RIGHT hand held away from the body, the LEFT gauntlet open."),
        },
    },
}


def key():
    k = subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("id -un"), "-s", "gemini-api-key", "-w"],
                       capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("Chave do Gemini não encontrada no Keychain (serviço gemini-api-key).")
    return k


def achar_imagem(o):
    if isinstance(o, dict):
        out = o.get("output_image")
        if isinstance(out, dict) and out.get("data"): return out["data"]
        if o.get("type") == "image" and o.get("data"): return o["data"]
        inl = o.get("inlineData") or o.get("inline_data")
        if isinstance(inl, dict) and inl.get("data"): return inl["data"]
        for v in o.values():
            r = achar_imagem(v)
            if r: return r
    elif isinstance(o, list):
        for v in o:
            r = achar_imagem(v)
            if r: return r
    return None


def gerar(k, reino, slug, ref, tam):
    R = REINOS[reino]; out = ROOT / "assets" / "concepts" / "reinos" / reino / f"{slug}.jpg"
    if out.exists():
        print(f"  já existe {out.relative_to(ROOT)}", flush=True); return out
    txt = R["estilo"] + R["pecas"][slug]
    inputs = []
    equipe = ROOT / "assets" / "concepts" / "reinos" / reino / "referencia.png"
    if equipe.exists():
        inputs.append({"type": "image", "mime_type": "image/png", "data": base64.b64encode(equipe.read_bytes()).decode()})
        txt = ("The first reference image shows the whole team lineup; keep exactly its art style, palette, armor design "
               "language and mood. " + R["posicao"][slug] + " Isolate that single character and redraw it alone. " + txt)
    if ref is not None and ref.exists():
        inputs.append({"type": "image", "mime_type": "image/jpeg", "data": base64.b64encode(ref.read_bytes()).decode()})
        txt = "The last reference image is the already finished pawn of this team: match its rendering detail and proportions. " + txt
    inputs.append({"type": "text", "text": txt})
    aspect = "4:3" if slug in ("cavaleiro",) else "3:4"
    body = {"model": MODEL, "input": inputs,
            "response_format": {"type": "image", "mime_type": "image/jpeg", "aspect_ratio": aspect, "image_size": tam}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"x-goog-api-key": k, "Content-Type": "application/json", "Api-Revision": "2026-05-20"})
    try:
        with urllib.request.urlopen(req, timeout=400) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"Gemini HTTP {e.code} em {slug}: {e.read().decode(errors='replace')[:400]}")
    data = achar_imagem(resp)
    if not data:
        sys.exit(f"Resposta do Gemini sem imagem para {slug}: {json.dumps(resp)[:400]}")
    out.parent.mkdir(parents=True, exist_ok=True); out.write_bytes(base64.b64decode(data))
    print(f"  {slug}: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)", flush=True)
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    tam = sys.argv[sys.argv.index("--tam") + 1] if "--tam" in sys.argv else "4K"
    args = [a for a in args if a != tam]
    reino = args[0]; slugs = args[1:] or list(REINOS[reino]["pecas"])
    k = key(); ref = ROOT / "assets" / "concepts" / "reinos" / reino / "peao.jpg"
    for s in slugs:
        gerar(k, reino, s, None if s == "peao" else ref, tam)
