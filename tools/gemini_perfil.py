#!/usr/bin/env python3
"""Gera opções de foto de perfil (1:1) do Arcane Chess no Gemini, para o Instagram.

Uso: python3 tools/gemini_perfil.py [emblema dragao grimorio]
A chave vem do Keychain do macOS (serviço "gemini-api-key") e nunca é impressa.
As imagens vão para assets/social/perfil_<nome>.jpg.
"""
import base64
import json
import sys
import urllib.error
import urllib.request

from gemini_images import ROOT, URL, MODEL, key, find_image

OUT = ROOT / "assets" / "social"
STYLE = ("Square game icon for a social media profile picture, dark fantasy game style, hand-painted look, "
         "single bold centered subject that stays readable when cropped to a small circle, generous margin around it, "
         "deep near-black background with a soft ember glow behind the subject, palette of polished gold, ivory and "
         "warm ember orange, dramatic rim light, no text, no letters, no watermark. ")
OPTS = {
    "emblema": "A golden chess king piece standing on top of an open ancient glowing grimoire, arcane runes floating "
               "upward from the pages, the king piece ornate with a cross on its crown.",
    "dragao": "A coiled dragon of dark bronze scales with glowing ember eyes wrapped around a tall golden chess king "
              "piece, wings half folded, the dragon's head beside the crown looking at the viewer.",
    "grimorio": "A heraldic crest: a golden crown above a crossed sword and wizard staff in front of a round "
                "chessboard shield of ivory and black squares, ornate gold filigree border.",
}


def generate(k, slug):
    body = {"model": MODEL, "input": [{"type": "text", "text": STYLE + OPTS[slug]}],
            "response_format": {"type": "image", "mime_type": "image/jpeg", "aspect_ratio": "1:1", "image_size": "1K"}}
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
    dest = OUT / f"perfil_{slug}.jpg"
    dest.write_bytes(base64.b64decode(data))
    print(f"  {slug}: {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)", flush=True)


if __name__ == "__main__":
    k = key()
    for s in sys.argv[1:] or list(OPTS):
        generate(k, s)
