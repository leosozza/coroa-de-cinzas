#!/usr/bin/env python3
"""Narração lance a lance: grava em pedaços (voz "Paulo") as falas que o jogo junta na hora.

Uso: python3 tools/elevenlabs_narracao.py [--so-lista]
Saída: assets/audio/narr/<id>.mp3 e data/narracao.json (id -> texto, grupo; mais as regras de montagem).
Arquivos já gravados são pulados. Cada pedaço é gravado com o contexto antes/depois
(previous_text/next_text) para a entonação casar quando o jogo os emendar.

Montagem (o jogo escolhe pelo tipo de lance):
  lance:    s_<peça>_avanca + casa_<sq>                       "O peão avança para" "bê sete."
  captura:  s_<peça>_captura + o_<alvo> + em_<sq>             "O bispo captura" "a torre" "em dê oito."
  carta:    s_<peça>_usa + k_<carta> [+ e_elimina + o_<alvo> + em_<sq>]
  carta sem peça: lado_<w|b> + jogam_carta + k_<carta>
  especiais: e_* (roque, promoção, xeque...)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "narr"

PECAS = {"p": ("o peão", "O peão"), "n": ("o cavaleiro", "O cavaleiro"), "b": ("o bispo", "O bispo"),
         "r": ("a torre", "A torre"), "q": ("a dama", "A dama"), "k": ("o rei", "O rei"), "L": ("o lanceiro", "O Lanceiro")}
LETRA = {"a": "á", "b": "bê", "c": "cê", "d": "dê", "e": "é", "f": "éfe", "g": "gê", "h": "agá"}
NUM = {1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito"}

CALMA = {"stability": 0.55, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True}
FORTE = {"stability": 0.35, "similarity_boost": 0.8, "style": 0.6, "use_speaker_boost": True}


def lista():
    f = {}
    def add(i, texto, grupo, antes="", depois="", voz=CALMA):
        f[i] = {"texto": texto, "grupo": grupo, "antes": antes, "depois": depois, "voz": voz}
    for k, (obj, suj) in PECAS.items():
        add(f"s_{k}_avanca", f"{suj} avança para", "sujeito", depois="bê sete.")
        add(f"s_{k}_captura", f"{suj} captura", "sujeito", depois="a torre em dê oito!", voz=FORTE)
        add(f"s_{k}_usa", f"{suj} usa", "sujeito", depois="Raio Arcano, e elimina a torre!", voz=FORTE)
        if k != "k":
            add(f"o_{k}", obj, "alvo", antes="O bispo captura", depois="em dê oito!", voz=FORTE)
    for c, l in LETRA.items():
        for n in range(1, 9):
            sq = f"{c}{n}"
            add(f"casa_{sq}", f"{l} {NUM[n]}.", "casa", antes="O peão avança para")
            add(f"em_{sq}", f"em {l} {NUM[n]}!", "casa", antes="O bispo captura a torre", voz=FORTE)
    add("e_elimina", "e elimina", "ligacao", antes="O bispo usa Raio Arcano,", depois="a torre em dê oito!", voz=FORTE)
    add("lado_w", "As brancas", "lado", depois="jogam a carta Escudo Arcano.")
    add("lado_b", "As negras", "lado", depois="jogam a carta Escudo Arcano.")
    add("jogam_carta", "jogam a carta", "ligacao", antes="As brancas", depois="Escudo Arcano.")
    cartas = json.loads((ROOT / "data" / "cartas.json").read_text())
    cartas = cartas if isinstance(cartas, list) else cartas.get("cartas", cartas)
    cartas = cartas if isinstance(cartas, list) else list(cartas.values())
    for c in cartas:
        add(f"k_{c['id']}", c["nome"], "carta", antes="O bispo usa", depois="e elimina a torre!", voz=FORTE)
    esp = {
        "e_roque_pequeno": "Roque pequeno! O rei se protege.",
        "e_roque_grande": "Roque grande! O rei se protege.",
        "e_promo_q": "Promoção! O peão se torna dama!",
        "e_promo_r": "Promoção! O peão se torna torre!",
        "e_promo_b": "Promoção! O peão se torna bispo!",
        "e_promo_n": "Promoção! O peão se torna cavaleiro!",
        "e_lanceiro": "O peão evolui para Lanceiro! Agora alcança duas casas!",
        "e_en_passant": "Captura en passant!",
        "e_xeque": "Xeque no rei!",
        "e_rei_perigo": "O rei está em perigo!",
        "e_armadilha": "Uma armadilha é revelada!",
        "e_bloqueado": "O golpe é bloqueado!",
        "e_contrafeitico": "Contrafeitiço! A magia é anulada!",
        "e_ressurge": "Uma peça retorna do cemitério!",
        "e_sacrificio": "Um sacrifício ousado!",
        "e_que_lance": "Que lance!",
        "e_vez_brancas": "Vez das brancas.",
        "e_vez_negras": "Vez das negras.",
        "e_tempo": "O tempo está acabando!",
        "e_mate_brancas": "Xeque-mate! O rei negro é capturado e levado para o campo das brancas!",
        "e_mate_negras": "Xeque-mate! O rei branco é capturado e levado para o campo das negras!",
    }
    for i, t in esp.items():
        add(i, t, "especial", voz=FORTE)
    return f


def main():
    frag = lista()
    regras = {"lance": ["s_<peça>_avanca", "casa_<sq>"], "captura": ["s_<peça>_captura", "o_<alvo>", "em_<sq>"],
              "carta_alvo": ["s_<peça>_usa", "k_<carta>", "e_elimina", "o_<alvo>", "em_<sq>"],
              "carta": ["s_<peça>_usa", "k_<carta>"], "carta_lado": ["lado_<w|b>", "jogam_carta", "k_<carta>"],
              "pecas": {k: v[0] for k, v in PECAS.items()}, "pasta": "assets/audio/narr/"}
    (ROOT / "data" / "narracao.json").write_text(json.dumps(
        {"regras": regras, "falas": {i: {"texto": v["texto"], "grupo": v["grupo"]} for i, v in frag.items()}},
        indent=2, ensure_ascii=False))
    chars = sum(len(v["texto"]) for v in frag.values())
    novos = [i for i in frag if not (OUT / f"{i}.mp3").exists()]
    print(f"{len(frag)} pedaços, {chars} caracteres; faltam gravar {len(novos)}", flush=True)
    if "--so-lista" in sys.argv:
        return
    import elevenlabs_audio as EA
    OUT.mkdir(parents=True, exist_ok=True)
    for i in novos:
        v = frag[i]
        body = {"text": v["texto"], "model_id": "eleven_multilingual_v2", "language_code": "pt", "voice_settings": v["voz"]}
        if v["antes"]: body["previous_text"] = v["antes"]
        if v["depois"]: body["next_text"] = v["depois"]
        EA.post(f"/v1/text-to-speech/{EA.NARRATOR}?output_format=mp3_44100_96", body, OUT / f"{i}.mp3")
    feitos = sum(1 for i in frag if (OUT / f"{i}.mp3").exists())
    print(f"gravados: {feitos}/{len(frag)}", flush=True)


if __name__ == "__main__":
    main()
