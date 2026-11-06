#!/usr/bin/env python3
"""Gera as artes-conceito das 6 peças no Gemini, para depois virarem 3D no Meshy.

Uso: python3 tools/gemini_images.py [peao torre ...]
A chave vem do Keychain do macOS (serviço "gemini-api-key") e nunca é impressa.
O Peão é gerado primeiro e serve de referência de estilo para as outras peças.
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "concepts"
MODEL = "gemini-nano-banana-2.1"
URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

STYLE = ("Full-body character concept art, dark fantasy game style, hand-painted look, palette of ivory, "
         "polished gold, steel and warm red cloth. Standing in A-pose with arms slightly away from the body, "
         "facing the camera, front view, whole figure visible from head to feet, plain white background, "
         "soft even lighting, single character, no text. ")
# Para unidades que não são uma figura em pé (cavalo montado, torre com atirador).
STYLE_UNIT = ("Full-body concept art of a game unit, dark fantasy game style, hand-painted look, palette of ivory, "
              "polished gold, steel and warm red cloth. Three-quarter front view, the whole subject visible, "
              "plain white background, soft even lighting, single subject, no text. ")
UNIT = {"cavalo", "torre", "torre_base", "cavalo_montado"}
PIECES = {
    "peao": "A young foot soldier representing the chess pawn: round steel kettle helmet, padded gambeson with gold trim, small round shield strapped to the left forearm, short steel arming sword held in the right hand, blade pointing down and close to the body. No spear, no polearm.",
    "torre": "A chess rook unit, master of the earth element: a squat round stone watchtower with crenellated battlements and glowing amber earth runes carved into its stones, broken rocks and roots at its base as if it had just risen out of the ground; on top, standing behind the battlements, an archer in ivory and gold armor with a red hood aiming a longbow.",
    "bispo": "A warrior bishop representing the chess bishop: tall pointed mitre, ornate ivory and gold vestments, golden crozier staff topped with a holy flame, held upright at his side.",
    "dama": "A regal warrior queen representing the chess queen, master of lightning and fast as light: tall golden crown, sleek armored gown with a flowing cape, crackling blue-white electric arcs around her raised right hand and swirling around her feet.",
    "cavaleiro": "A heavy plate-armored knight representing the chess knight: great helm with a horse-head crest and plume, red cape, kite shield on the left arm, longsword pointing down in the right hand.",
    "cavalo": "A mounted knight representing the chess knight: a heavy armored warhorse with ornate gold-trimmed barding and a red caparison, standing still on all four legs, ridden by a plate-armored knight wearing a great helm with a horse-head crest and plume, holding a lance upright and a kite shield.",
    "torre_base": "A chess rook unit, master of the earth element: a tall round stone watchtower with crenellated battlements and an empty flat rooftop platform, glowing amber earth runes carved into its stones, broken rocks and roots at its base as if it had just risen out of the ground. No people on the tower.",
    "arqueiro": "A young archer soldier of the same army: red hood, ivory and gold padded armor with steel pauldrons, quiver of arrows on the back, a longbow held in the left hand pointing down, no arrow nocked.",
    "cavalo_montado": "A mounted knight representing the chess knight: a heavy armored warhorse with ornate gold-trimmed barding and a red caparison, standing still on all four legs, ridden by a plate-armored knight wearing a great helm with a horse-head crest and plume, kite shield on the left arm, right hand resting empty on his thigh, no lance, no spear and no weapon in the right hand.",
    "rei": "A noble bearded king representing the chess king: tall jeweled crown topped with a cross, ornate golden plate armor, long crimson and gold cape, longsword pointing down in the right hand.",
}


def key():
    k = subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("id -un"),
                        "-s", "gemini-api-key", "-w"], capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("Chave do Gemini não encontrada no Keychain (serviço gemini-api-key).")
    return k


def find_image(obj):
    """Procura o primeiro bloco de imagem em base64 na resposta."""
    if isinstance(obj, dict):
        out = obj.get("output_image")
        if isinstance(out, dict) and out.get("data"):
            return out["data"]
        if obj.get("type") == "image" and obj.get("data"):
            return obj["data"]
        inline = obj.get("inlineData") or obj.get("inline_data")
        if isinstance(inline, dict) and inline.get("data"):
            return inline["data"]
        for v in obj.values():
            r = find_image(v)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = find_image(v)
            if r:
                return r
    return None


def generate(k, slug, ref=None):
    text = (STYLE_UNIT if slug in UNIT else STYLE) + PIECES[slug]
    inputs = []
    if ref is not None:
        inputs.append({"type": "image", "mime_type": "image/jpeg", "data": base64.b64encode(ref.read_bytes()).decode()})
        text = "Same art style, palette, rendering and proportions as the reference image. " + text
    inputs.append({"type": "text", "text": text})
    body = {"model": MODEL, "input": inputs,
            "response_format": {"type": "image", "mime_type": "image/jpeg", "aspect_ratio": "3:4", "image_size": "1K"}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST", headers={
        "x-goog-api-key": k, "Content-Type": "application/json", "Api-Revision": "2026-05-20"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"Gemini HTTP {e.code} em {slug}: {e.read().decode(errors='replace')[:400]}")
    data = find_image(resp)
    if not data:
        sys.exit(f"Resposta do Gemini sem imagem para {slug}: {json.dumps(resp)[:400]}")
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{slug}.jpg"
    dest.write_bytes(base64.b64decode(data))
    print(f"  {slug}: {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)", flush=True)
    return dest


if __name__ == "__main__":
    slugs = sys.argv[1:] or list(PIECES)
    for s in slugs:
        if s not in PIECES:
            sys.exit(f"Peça desconhecida: {s}. Opções: {', '.join(PIECES)}")
    k = key()
    ref = OUT / "peao.jpg"
    for s in slugs:
        generate(k, s, None if s == "peao" or not ref.exists() else ref)
