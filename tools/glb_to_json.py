#!/usr/bin/env python3
"""Converte .glb em glTF JSON com o buffer embutido (data URI), salvo como .gltf.json.

Os Artifacts não servem .glb, mas servem .json; o GLTFLoader do three.js lê os dois formatos.
Uso: python3 tools/glb_to_json.py arquivo.glb [outro.glb ...]
"""
import base64
import json
import struct
import sys
from pathlib import Path


def convert(src: Path) -> Path:
    data = src.read_bytes()
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF" or version != 2:
        raise SystemExit(f"{src}: não é um GLB 2.0")
    off, doc, binary = 12, None, b""
    while off < length:
        clen, ctype = struct.unpack("<I4s", data[off:off + 8])
        chunk = data[off + 8:off + 8 + clen]
        if ctype == b"JSON":
            doc = json.loads(chunk.decode("utf-8"))
        elif ctype == b"BIN\x00":
            binary = chunk
        off += 8 + clen
    if doc is None:
        raise SystemExit(f"{src}: sem bloco JSON")
    if doc.get("buffers"):
        doc["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binary).decode()
    dest = src.with_name(src.name[:-4] + ".gltf.json")
    dest.write_text(json.dumps(doc, separators=(",", ":")))
    return dest


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        d = convert(Path(arg))
        print(f"{d} ({d.stat().st_size // 1024} KB)")
