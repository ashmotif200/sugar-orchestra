#!/usr/bin/env python3
"""
Assemble l'archive de livraison de la pièce étalon Electro Sega.

Ne modifie aucun fichier produit : copie, vérifie les empreintes, écrit un
manifeste, puis compresse. Refuse de produire l'archive si une empreinte
attendue ne correspond pas.
"""
import hashlib
import json
import os
import shutil
import zipfile

SRC = "/workspace/download/sugar-audio/production"
SCRIPTS = "/workspace/sugar-orchestra/scripts/production"
STAGE = "/tmp/so_delivery/Sugar_Orchestra_Electro_Sega_Piece_Etalon"
ZIP_PATH = "/workspace/download/Sugar_Orchestra_Electro_Sega_Piece_Etalon.zip"

EXPECTED = {
    "A-fondation.wav": "a66c902989ca1a6237fdb8ad2e97fa6862b2d4dd97e20fd8e1c3c37f0bacbf77",
    "B-visiteur1.wav": "906e1c6bd16f248bbf5970c462e05de00a59cbdc23669ee7632d8225a042072f",
    "C-visiteur2.wav": "0a6a67a91822457cd3d21c521e6f16ab3929ccaeddaa36d0f1abc2423d6702f1",
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    # 1. intégrité AVANT toute copie
    for name, expected in EXPECTED.items():
        path = os.path.join(SRC, name)
        if not os.path.exists(path):
            raise SystemExit(f"fichier manquant : {path}")
        actual = sha256(path)
        if actual != expected:
            raise SystemExit(f"EMPREINTE DIFFÉRENTE pour {name}\n  attendu {expected}\n  obtenu  {actual}")
    print("empreintes des trois WAV : conformes")

    if os.path.exists(STAGE):
        shutil.rmtree(STAGE)
    for sub in ("audio", "stems", "midi", "partitions", "production"):
        os.makedirs(os.path.join(STAGE, sub), exist_ok=True)

    # 2. audio
    for name in EXPECTED:
        shutil.copy2(os.path.join(SRC, name), os.path.join(STAGE, "audio", name))

    # 3. stems
    for version in ("A-fondation", "B-visiteur1", "C-visiteur2"):
        d = os.path.join(SRC, "stems", version)
        if os.path.isdir(d):
            shutil.copytree(d, os.path.join(STAGE, "stems", version))

    # 4. midi + partitions + rapport de production
    for f in sorted(os.listdir(SRC)):
        if f.endswith(".mid"):
            shutil.copy2(os.path.join(SRC, f), os.path.join(STAGE, "midi", f))
        elif f.endswith(".score.json"):
            shutil.copy2(os.path.join(SRC, f), os.path.join(STAGE, "partitions", f))
        elif f == "production.json":
            shutil.copy2(os.path.join(SRC, f), os.path.join(STAGE, "production", f))

    # 5. scripts de production
    for f in ("electro_sega.py", "verifier.py"):
        src = os.path.join(SCRIPTS, f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(STAGE, "production", f))

    shutil.copy2(os.path.join(SRC, "README.md"), os.path.join(STAGE, "README.md"))

    # 6. manifeste
    lines = ["Sugar Orchestra — pièce étalon Electro Sega", "=" * 46, "",
             "Empreintes SHA-256 des rendus (vérifiées à l'assemblage) :", ""]
    for name, expected in EXPECTED.items():
        lines.append(f"  {name}")
        lines.append(f"    {expected}")
    lines += ["", "Contenu de l'archive :", ""]
    total = 0
    for root, _dirs, files in os.walk(STAGE):
        for f in sorted(files):
            p = os.path.join(root, f)
            rel = os.path.relpath(p, STAGE)
            size = os.path.getsize(p)
            total += size
            lines.append(f"  {rel:62s} {size / 1048576:7.2f} Mo")
    lines += ["", f"Total : {total / 1048576:.1f} Mo", "",
              "Reproduction : python3 scripts/production/electro_sega.py",
              "Les rendus sont déterministes (graine fixe) : deux exécutions donnent",
              "des fichiers identiques au bit près."]
    with open(os.path.join(STAGE, "MANIFESTE.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")

    # 7. archive
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for root, _dirs, files in os.walk(STAGE):
            for f in sorted(files):
                p = os.path.join(root, f)
                z.write(p, os.path.relpath(p, "/tmp/so_delivery"))
    print(f"archive : {ZIP_PATH} ({os.path.getsize(ZIP_PATH) / 1048576:.1f} Mo)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
