#!/usr/bin/env python3
"""Gera os sons de Coroa de Cinzas no ElevenLabs: efeitos, narrador e música.

Uso: python3 tools/elevenlabs_audio.py [sfx] [voz] [musica]   (sem argumentos: tudo)
A chave vem do Keychain do macOS (serviço "elevenlabs-api-key") e nunca é impressa.
Arquivos já gerados são pulados, então rodar de novo só completa o que falta.
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio"
API = "https://api.elevenlabs.io"
NARRATOR = "Qrdut83w0Cr152Yb4Xn3"  # "Paulo", voz profissional brasileira da biblioteca do ElevenLabs

# nome: (descrição, duração em segundos, loop)
SFX = {
    "passo":           ("single heavy armored footstep on a stone floor", 0.6, False),
    "galope":          ("armored warhorse galloping a few strides on stone, then a short fierce neigh", 2.0, False),
    "cavalo_pouso":    ("heavy armored warhorse landing after a big jump on stone, metal clank and deep thud", 1.0, False),
    "terra_afunda":    ("stone tower sinking into the ground, deep rumble, grinding rock, dirt pouring", 2.0, False),
    "terra_brota":     ("stone tower erupting out of the ground, explosive rock burst, debris falling, deep rumble", 2.0, False),
    "flechas":         ("volley of three arrows released from a longbow in quick succession, sharp whooshes", 1.5, False),
    "flecha_impacto":  ("arrows thudding into armor and wood", 1.0, False),
    "espinhos":        ("sharp stone spikes bursting out of the ground, crack and crunch", 1.2, False),
    "raio_dash":       ("fast electric zap streak, crackling lightning whoosh at light speed", 1.0, False),
    "raio_golpe":      ("massive lightning strike with a thunder crack and electric explosion", 2.0, False),
    "arcano_carga":    ("arcane magic spell charging up, shimmering chimes and a rising hum", 1.5, False),
    "misseis":         ("four magic missiles fired in rapid succession, sparkling whooshes and arcane impacts", 1.8, False),
    "teleporte":       ("magical teleport blink, soft whoosh with sparkle", 0.8, False),
    "espada":          ("heavy longsword slash hitting plate armor", 1.0, False),
    "lanca":           ("spear thrust piercing armor, metal scrape and thud", 1.0, False),
    "carga_lanca":     ("knight's lance charge impact, splintering wood and a heavy armor crash", 1.5, False),
    "queda":           ("armored warrior collapsing onto a stone floor, metal clatter", 1.5, False),
    "cemiterio":       ("soil and dirt shifting in a graveyard, faint ghostly whisper, small rumble", 1.5, False),
    "xeque":           ("short ominous war horn blast", 1.5, False),
    "xeque_mate":      ("deep dramatic gong hit with a long dark reverb", 3.0, False),
    "vitoria":         ("short triumphant medieval brass fanfare with drums", 4.0, False),
    "derrota":         ("somber low strings and a slow drum, defeat stinger", 4.0, False),
    "selecao":         ("subtle short stone click, interface select sound", 0.5, False),
    "camera_lenta":    ("cinematic slow motion whoosh into a heavy boom impact", 1.5, False),
    "ambiente":        ("stormy wind over ancient ruins, distant rolling thunder, crackling braziers, dark ambience", 22.0, True),
    # Arena "Covil dos Dragões"
    "ambiente_dragoes": ("volcanic dragon lair ambience: bubbling lava, deep cave rumble, hissing steam, distant dragon growls", 22.0, True),
    "rugido_dragao":   ("massive dragon roar echoing in a volcanic cavern", 3.0, False),
    "sopro_fogo":      ("dragon breathing a long gout of fire, roaring flames whoosh", 2.5, False),
    # Arena "Fogo x Gelo"
    "ambiente_fogo_gelo": ("ambience split between howling icy wind with crackling frost and roaring fire with crackling embers", 22.0, True),
    "gelo_estalo":     ("ice crystals cracking and shattering, sharp frosty crunch", 1.2, False),
    "gelo_golpe":      ("frost magic impact, ice shards exploding with a cold whoosh", 1.5, False),
}

# nome: fala do narrador
VOZ = {
    "v_inicio": "A batalha começa!",
    "v_xeque": "Xeque!",
    "v_xeque_mate": "Xeque-mate!",
    "v_golpe_fatal": "Golpe fatal!",
    "v_lanca_fiel": "Lança fiel!",
    "v_carga": "Carga implacável!",
    "v_arcano": "Arcano supremo!",
    "v_furia_terra": "Fúria da terra!",
    "v_raio": "Julgamento do raio!",
    "v_lamina": "Lâmina real!",
    "v_vitoria": "Vitória!",
    "v_derrota": "Derrota...",
    "v_empate": "Empate.",
}

MUSICA = {
    "musica_tema": ("Dark fantasy orchestral theme for a medieval chess battle in ancient ruins: slow tense tempo, "
                    "low strings, distant war drums, deep choir pads, ominous and majestic, steady loopable groove, "
                    "no vocals", 90000),
    "musica_dragoes": ("Epic dark fantasy orchestral theme for a battle inside a dragon's volcanic lair: heavy taiko and war drums, "
                       "brass stabs, low choir, tense and fiery, steady loopable groove, no vocals", 90000),
    "musica_fogo_gelo": ("Dark fantasy orchestral battle theme of fire against ice: cold shimmering celesta and strings answered by "
                         "fiery brass and drums, tense duel, steady loopable groove, no vocals", 90000),
}


def key():
    k = subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("id -un"),
                        "-s", "elevenlabs-api-key", "-w"], capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("Chave do ElevenLabs não encontrada no Keychain (serviço elevenlabs-api-key).")
    return k


KEY = key()


def post(path, body, dest):
    if dest.exists():
        print(f"  já existe {dest.name}", flush=True)
        return
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(8 * (attempt + 1))
                continue
            print(f"  ERRO {dest.name}: HTTP {e.code} {msg}", flush=True)
            return
    OUT.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print(f"  {dest.name} ({len(data) // 1024} KB)", flush=True)


def sfx():
    for name, (text, dur, loop) in SFX.items():
        post("/v1/sound-generation?output_format=mp3_44100_128",
             {"text": text, "duration_seconds": dur, "loop": loop, "prompt_influence": 0.5,
              "model_id": "eleven_text_to_sound_v2"}, OUT / f"{name}.mp3")


def voz():
    for name, text in VOZ.items():
        post(f"/v1/text-to-speech/{NARRATOR}?output_format=mp3_44100_128",
             {"text": text, "model_id": "eleven_multilingual_v2", "language_code": "pt",
              "voice_settings": {"stability": 0.35, "similarity_boost": 0.8, "style": 0.6, "use_speaker_boost": True}},
             OUT / f"{name}.mp3")


def musica():
    for name, (prompt, ms) in MUSICA.items():
        post("/v1/music?output_format=mp3_44100_128",
             {"prompt": prompt, "music_length_ms": ms, "force_instrumental": True}, OUT / f"{name}.mp3")


if __name__ == "__main__":
    parts = sys.argv[1:] or ["sfx", "voz", "musica"]
    for p in parts:
        print(f"== {p}", flush=True)
        {"sfx": sfx, "voz": voz, "musica": musica}[p]()
