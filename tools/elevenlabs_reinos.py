#!/usr/bin/env python3
"""Pacote de efeitos sonoros por reino (ElevenLabs Sound Effects) para o Arcane Chess.

Para cada reino, 12 clipes curtos em assets/audio/reinos/<reino>/<clipe>.mp3:
  passo_leve (peão/bispo), passo_pesado (rei/dama/torre), montaria (cavaleiro),
  golpe_p/n/b/r/q/k (o golpe de cada peça, coerente com data/reinos.json), morte (a vítima
  desse reino), mascote (rugido/uivo/sibilo do chefe da arena) e vinheta (assinatura ao começar).

Uso: python3 tools/elevenlabs_reinos.py [reino ...] [--dry]   (sem reinos: todos; --dry só conta caracteres)
A chave vem do Keychain do macOS (serviço "elevenlabs-api-key") e nunca é impressa nem gravada.
Cada clipe é gerado UMA vez: o progresso fica em assets/audio/reinos/state.json (ok / erro) e o arquivo
existente é pulado; rodar de novo só completa o que falta.
"""
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "reinos"
STATE = OUT / "state.json"
API = "https://api.elevenlabs.io"
MODEL = "eleven_text_to_sound_v2"
INFLUENCE = 0.8  # prompts curtos e concretos: segue o texto de perto

# reino -> clipe -> (prompt em inglês, duração em segundos)
PLANO = {
    "aurora": {
        "passo_leve":   ("light armored footstep of a holy knight on marble floor, soft gold clink", 0.6),
        "passo_pesado": ("loud heavy footstep of a king in full plate armor on a marble floor, deep thud and metal clank", 0.7),
        "montaria":     ("armored warhorse galloping on marble, hooves with a light golden chime", 1.2),
        "golpe_p":      ("golden blade slash into armor with a bright holy chime", 1.0),
        "golpe_n":      ("lance charge impact on armor with a burst of holy light, ringing chime", 1.3),
        "golpe_b":      ("beam of sacred light piercing through, bright shimmering choir blast", 1.3),
        "golpe_r":      ("volley of arrows thudding into armor with a soft golden ring", 1.0),
        "golpe_q":      ("blades of light raining down from the sky, slicing whooshes and crystalline impacts", 1.5),
        "golpe_k":      ("royal sword strike opening a pillar of holy light, deep boom with an angelic chord", 1.5),
        "morte":        ("defeated warrior dissolving into golden dust, soft sparkling shimmer fading", 1.5),
        "mascote":      ("archangel descending, majestic golden choir swell with great wings beating", 2.5),
        "vinheta":      ("golden fanfare of a holy kingdom: short bright choir swell with trumpets and a soft bell", 3.0),
    },
    "ferro_negro": {
        "passo_leve":   ("footstep of a dark armored soldier on volcanic rock, metal clank with chains rattling", 0.7),
        "passo_pesado": ("heavy black iron plate armor footstep on stone, deep thud with dragging chains", 0.8),
        "montaria":     ("nightmare warhorse galloping on stone with crackling dark fire, hooves and embers", 1.2),
        "golpe_p":      ("smoking dark blade slash into armor, hiss of black smoke", 1.0),
        "golpe_n":      ("lance charge impact with a burst of dark fire, embers crackling and a heavy crash", 1.3),
        "golpe_b":      ("wave of trapped souls released, ghostly moan with a dark whoosh and golden shimmer", 1.4),
        "golpe_r":      ("smoking black arrows thudding into armor with hissing embers", 1.0),
        "golpe_q":      ("soul ripped out of a body, eerie rising wail and a crimson energy pull", 1.5),
        "golpe_k":      ("flaming war hammer smashing the ground, huge impact with shockwave and smoke whoosh", 1.5),
        "morte":        ("body crumbling into ashes and black smoke, crackling embers and a soft collapse", 1.5),
        "mascote":      ("god of death emerging from black smoke, deep demonic breath and a scythe scrape", 2.5),
        "vinheta":      ("war drums and heavy chains of a dark legion, ominous brass hit and crackling embers", 3.0),
    },
    "dragoes": {
        "passo_leve":   ("footstep of a dragon-scale armored warrior on volcanic rock, light crackle of embers", 0.7),
        "passo_pesado": ("heavy armored dragon king footstep on hot volcanic rock, deep thud and ember crackle", 0.8),
        "montaria":     ("dragon-headed warhorse galloping on volcanic rock with flaming hooves, fire whooshes", 1.2),
        "golpe_p":      ("ember blade slash into armor with a fiery sizzle", 1.0),
        "golpe_n":      ("dragon horse breathing fire then a lance impact, flame burst and crash", 1.4),
        "golpe_b":      ("fireball exploding on impact, roaring flame burst", 1.3),
        "golpe_r":      ("crossbow bolt of blue fire striking with a crystalline crackle and whoosh", 1.0),
        "golpe_q":      ("frost freezing a body then shattering into embers, ice crack and fire burst", 1.5),
        "golpe_k":      ("whirlwind of flames and a long sword slash, roaring fire vortex", 1.5),
        "morte":        ("warrior burning down to embers and ash, crackling flames fading", 1.5),
        "mascote":      ("giant dragon roar with a gout of flames in a volcanic cavern", 2.5),
        "vinheta":      ("dragon kingdom signature: a fierce dragon roar with a fire burst and heavy drums", 3.0),
    },
    "lua_nova": {
        "passo_leve":   ("soft footstep of a wolf warrior on rocky moonlit ground, light claw scrape", 0.6),
        "passo_pesado": ("heavy footstep of a wolf king in silver armor on rock, deep thud with a claw scrape", 0.7),
        "montaria":     ("giant wolf running on rocky ground, fast heavy paws and panting", 1.2),
        "golpe_p":      ("three fast silver claw slashes tearing through armor", 1.0),
        "golpe_n":      ("giant wolf leaping and crushing with its paw, heavy ground thump and a snarl", 1.3),
        "golpe_b":      ("moonlit rift opening in the ground and spectral wolves biting, magical whoosh with snarling bites", 1.5),
        "golpe_r":      ("spinning claw boomerang whooshing out and back with a slashing hit", 1.2),
        "golpe_q":      ("blood moon orb fired and striking, dark magical pulse and impact", 1.3),
        "golpe_k":      ("claw driven into a chest like a sword, deep piercing stab with a growl", 1.2),
        "morte":        ("body torn by claws dissolving into silver mist, tearing rip then a soft airy shimmer", 1.5),
        "mascote":      ("lone wolf howling at the moon with cold wind", 2.5),
        "vinheta":      ("wolf howl over cold night wind with a distant silver chime", 3.0),
    },
    "primatas": {
        "passo_leve":   ("bare footstep of a monkey warrior on mossy stone, soft slap and rustling leaves", 0.6),
        "passo_pesado": ("heavy gorilla king footstep on mossy stone, deep thump with rustling leaves", 0.7),
        "montaria":     ("saber-tooth tiger running on jungle ground, fast heavy paws and a low growl", 1.2),
        "golpe_p":      ("spinning staff strike in a whirlwind of leaves, wooden crack impact", 1.0),
        "golpe_n":      ("saber-tooth tiger bite then a bone spear thrust, snarling bite and stab", 1.3),
        "golpe_b":      ("thick jungle vines whipping out of the ground and wrapping around a body, loud creaking plants and snapping branches", 1.4),
        "golpe_r":      ("stone sling shot then living roots tearing through the ground, whoosh and cracking earth", 1.3),
        "golpe_q":      ("golden staff growing and smashing down, stretching wood and a massive thump", 1.3),
        "golpe_k":      ("gorilla beating its chest, roaring and smashing the ground, shockwave", 1.5),
        "morte":        ("body swallowed by vines and leaves turning to earth, rustling plants and crumbling soil", 1.5),
        "mascote":      ("stone gorilla idol awakening, tribal drums and a deep gorilla roar", 2.5),
        "vinheta":      ("tribal jungle drums with monkey screeches and a gorilla roar", 3.0),
    },
    "abismo": {
        "passo_leve":   ("insectoid alien footstep on metal, chitin click and a wet scrape", 0.6),
        "passo_pesado": ("heavy alien carapace footstep on metal and bone, deep clank with a wet chitin creak", 0.7),
        "montaria":     ("alien crypt beast skittering fast on metal, many clawed legs clicking and a hiss", 1.2),
        "golpe_p":      ("alien tail stinger piercing through armor with a wet crunch and acid sizzle", 1.0),
        "golpe_n":      ("alien beast biting with crunching jaws then a stinger stab, hiss", 1.3),
        "golpe_b":      ("psychic pulse wave, deep throbbing bass with a cyan energy ring and distortion", 1.4),
        "golpe_r":      ("spit of acid and swarming larvae, wet splatter with buzzing crawling", 1.3),
        "golpe_q":      ("tail blade impaling and lifting, wet piercing crunch with acid dripping", 1.3),
        "golpe_k":      ("acid roar shattering a carapace, alien scream with cracking shell", 1.5),
        "morte":        ("body corroding in acid, sizzling bubbling and crumbling to dust", 1.5),
        "mascote":      ("alien hive queen hissing and screeching with wet tentacle movement", 2.5),
        "vinheta":      ("alien hive signature: eerie hum with a throbbing psychic pulse and a distant screech", 3.0),
    },
    "mar": {
        "passo_leve":   ("footstep splashing in shallow water on rock, clear wet splash", 0.6),
        "passo_pesado": ("heavy wet footstep of a sea king on coral rock, deep splash and shell clink", 0.7),
        "montaria":     ("seahorse mount galloping through shallow water, loud rapid splashes and rushing waves", 1.2),
        "golpe_p":      ("trident thrust piercing with a sharp water splash", 1.0),
        "golpe_n":      ("seahorse rider charge, rushing water wave and a trident impact", 1.3),
        "golpe_b":      ("conch shell blast summoning a crashing wave", 1.4),
        "golpe_r":      ("harpoon shot whooshing then a wet impact with bubbles", 1.0),
        "golpe_q":      ("whirlpool of water lifting and crushing, swirling rush and a deep splash", 1.4),
        "golpe_k":      ("trident strike with a thunderclap of water, deep boom and a crashing wave", 1.5),
        "morte":        ("body dissolving into bubbles and sea foam, fizzing and gurgling fading", 1.5),
        "mascote":      ("kraken rising from the deep, massive water surge with a deep gurgling roar", 2.8),
        "vinheta":      ("ocean waves crashing with a deep conch shell horn call", 3.0),
    },
    "deserto": {
        "passo_leve":   ("soft footstep of a hooded warrior on desert sand, grainy crunch", 0.6),
        "passo_pesado": ("heavy footstep of a scorpion king in bronze armor on sand, deep thud and shifting sand", 0.7),
        "montaria":     ("giant beetle scuttling fast over sand, clicking legs and a buzzing shell", 1.2),
        "golpe_p":      ("quick double dagger slashes with a whoosh of sand", 1.0),
        "golpe_n":      ("giant beetle charge and a dagger strike, chitin crash and slash", 1.3),
        "golpe_b":      ("giant sand worm bursting out of the sand, rumbling eruption with a roar", 1.5),
        "golpe_r":      ("throwing knives whooshing and striking with a hiss of sand", 1.0),
        "golpe_q":      ("sand priestess spell, swirling sandstorm blast with a chime", 1.4),
        "golpe_k":      ("scorpion king stinger strike, sharp piercing stab with a venom hiss and a bronze clang", 1.3),
        "morte":        ("body crumbling into flowing sand, grainy pouring and a soft wind", 1.5),
        "mascote":      ("giant sand worm roaring from under the dunes with a deep rumble", 2.8),
        "vinheta":      ("desert wind over dunes with a scorpion rattle and a low bronze horn", 3.0),
    },
}

LOCK = threading.Lock()


def key():
    k = subprocess.run(["security", "find-generic-password", "-a", subprocess.getoutput("id -un"),
                        "-s", "elevenlabs-api-key", "-w"], capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("Chave do ElevenLabs não encontrada no Keychain (serviço elevenlabs-api-key).")
    return k


def load_state():
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {"clips": {}, "chars": 0}


def save_state(st):
    with LOCK:
        STATE.write_text(json.dumps(st, ensure_ascii=False, indent=1, sort_keys=True))


def gen(api_key, st, reino, clip, text, dur):
    dest = OUT / reino / f"{clip}.mp3"
    sid = f"{reino}/{clip}"
    if dest.exists() and dest.stat().st_size > 1000:
        return "pulado"
    body = {"text": text, "duration_seconds": dur, "loop": False, "prompt_influence": INFLUENCE, "model_id": MODEL}
    req = urllib.request.Request(API + "/v1/sound-generation?output_format=mp3_44100_128", data=json.dumps(body).encode(),
                                 method="POST", headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    err = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            with LOCK:
                st["clips"][sid] = {"ok": True, "dur": dur, "kb": len(data) // 1024, "chars": len(text)}
                st["chars"] = st.get("chars", 0) + len(text)
            save_state(st)
            return f"{len(data) // 1024} KB"
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:200]
            err = f"HTTP {e.code} {msg}"
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(8 * (attempt + 1))
                continue
            break
        except Exception as e:  # rede
            err = str(e)[:200]
            if attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
    with LOCK:
        st["clips"][sid] = {"ok": False, "erro": err, "chars": len(text)}
    save_state(st)
    return f"ERRO {err}"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    reinos = args or list(PLANO)
    jobs = [(r, c, t, d) for r in reinos for c, (t, d) in PLANO[r].items()]
    chars = sum(len(t) for _, _, t, _ in jobs)
    secs = sum(d for _, _, _, d in jobs)
    print(f"{len(jobs)} clipes, {chars} caracteres de prompt, {secs:.1f} s de áudio", flush=True)
    if dry:
        return
    api_key = key()
    OUT.mkdir(parents=True, exist_ok=True)
    st = load_state()

    def run(j):
        r, c, t, d = j
        res = gen(api_key, st, r, c, t, d)
        print(f"  {r}/{c}: {res}", flush=True)

    with ThreadPoolExecutor(max_workers=3) as ex:
        list(ex.map(run, jobs))
    ok = sum(1 for v in st["clips"].values() if v.get("ok"))
    bad = [k for k, v in st["clips"].items() if not v.get("ok")]
    print(f"== pronto: {ok} ok, {len(bad)} com erro {bad if bad else ''}; {st.get('chars', 0)} caracteres cobrados até agora", flush=True)


if __name__ == "__main__":
    main()
