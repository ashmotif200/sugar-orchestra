#!/usr/bin/env python3
"""
Phase A1 — build the sound-selection mapping.

Reads the existing catalogue and the museum inventory; never writes to either.
Emits docs/phase-a/sound-selection-mapping.{md,csv}.

The authoritative source document for this phase
(`Museomix_Sugar Orchestra_ Les Sons Choisis.pdf`) is NOT on this host, so the
`selected_in_source_document` column is UNVERIFIED for every row and no
correspondence is invented. What this script does verify is identity: does a
catalogue entry match an inventory row and an actual WAV file, and is it usable.

    python3 scripts/phase-a/build-selection-mapping.py
"""
import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "phase-a"
CATALOG = ROOT / "src" / "data" / "catalog.json"
INVENTORY = Path("/workspace/Inventaire.csv")
ORIGINALS = ROOT / "assets" / "originals"

STEPS = {
    1: "Les origines",
    2: "Le sucre traverse les âges",
    3: "Les métiers du sucre",
    4: "La mémoire des plantations",
    5: "La canne à sucre",
    6: "De la canne au sucre",
    7: "De la bagasse à l'électricité",
}

# Variant A: what config/steps.json implements today.
VARIANT_A = {1: [1], 2: [2], 3: [3], 4: [4], 5: [5], 6: [6], 7: [7, 8]}
# Variant B: the grouping the Phase A brief describes ("former sections 6 and 8").
VARIANT_B = {1: [1], 2: [2], 3: [3], 4: [4], 5: [5], 6: [6, 8], 7: [7]}

REVIEW_NATURE = {"Effet créé par la source", "Maquette vocale synthétique à valider"}


def step_of(seq, variant):
    for step, seqs in variant.items():
        if seq in seqs:
            return step
    return None


def main():
    cat = json.loads(CATALOG.read_text())
    inv = {r["code"]: r for r in csv.DictReader(
        INVENTORY.open(encoding="utf-8-sig"), delimiter=";")}

    rows = []
    for s in sorted(cat["sounds"], key=lambda x: x["code"]):
        code = s["code"]
        seq = int(code.split("_")[0])
        wav = ORIGINALS / f"{code}.wav"
        i = inv.get(code, {})

        # --- identity status: verified against the file on disk, never assumed ---
        if s.get("sensitive") or s.get("needsValidation"):
            status = "RESTRICTED"
        elif not wav.exists():
            status = "MISSING"
        elif i.get("nature") in REVIEW_NATURE:
            status = "MATCHED_REVIEW"
        elif "non certifi" in (i.get("note") or "").lower() or "à valider" in (i.get("note") or "").lower():
            status = "MATCHED_REVIEW"
        elif code in inv and wav.exists():
            status = "MATCHED_EXACT"
        else:
            status = "MISSING"

        sa = step_of(seq, VARIANT_A) or 0
        sb = step_of(seq, VARIANT_B) or 0
        rows.append({
            "stage_a_number": sa,
            "stage_a_name": STEPS.get(sa, "UNMAPPED"),
            "stage_b_number": sb,
            "stage_b_name": STEPS.get(sb, "UNMAPPED"),
            "inventory_sequence": seq,
            "sound_code": code,
            "catalog_name": s["name"],
            "name_in_source_document": "UNVERIFIED",
            "wav_file": wav.name,
            "wav_present": wav.exists(),
            "inventory_file": i.get("fichier", ""),
            "nature": i.get("nature", ""),
            "credits": s.get("credits", ""),
            "license": s.get("license", ""),
            "availability": s.get("availability", ""),
            "sensitive": s.get("sensitive", False),
            "needs_validation": s.get("needsValidation", False),
            "catalog_roles": ",".join(s.get("roles") or []),
            "identity_status": status,
            "selected_in_source_document": "UNVERIFIED (source PDF absent)",
            "authorized_for_composition_now": bool(
                s.get("availability") == "available" and not s.get("sensitive")),
        })

    OUT.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0])
    with (OUT / "sound-selection-mapping.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        w.writeheader()
        w.writerows(rows)

    # ---------------- markdown ----------------
    counts = Counter(r["identity_status"] for r in rows)
    differ = [r for r in rows if r["stage_a_number"] != r["stage_b_number"]]
    auth = sum(1 for r in rows if r["authorized_for_composition_now"])

    def table(rs):
        out = ["| code | name | seq | stage | nature | licence | status | roles |",
               "|---|---|---|---|---|---|---|---|"]
        for r in rs:
            stage = (f"{r['stage_a_number']} · {STEPS[r['stage_a_number']]}"
                     if r["stage_a_number"] == r["stage_b_number"] else
                     f"A:{r['stage_a_number']} / B:{r['stage_b_number']}")
            out.append(f"| `{r['sound_code']}` | {r['catalog_name']} | {r['inventory_sequence']} | "
                       f"{stage} | {r['nature']} | {r['license']} | {r['identity_status']} | "
                       f"{r['catalog_roles'] or '—'} |")
        return "\n".join(out)

    by_stage = []
    for step in sorted(STEPS):
        rs = [r for r in rows if r["stage_b_number"] == step]
        by_stage.append(f"### Étape {step} — {STEPS[step]} ({len(rs)} sons)\n\n" + table(rs))

    md = f"""# Phase A1 — synchronisation du catalogue sonore

**Statut de cette phase : partielle, et volontairement bloquée sur un point.**

Le document de référence annoncé — `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf` —
**n'est pas présent sur Hermes**. Recherche exhaustive effectuée le 13 novembre 2026 :
nom exact, variantes (`*choisi*`, `*museomix*`, `*sons*`), tous les systèmes de
fichiers montés, contenu des archives ZIP, et PDF récents. Aucun résultat.

Conséquence assumée : la colonne `selected_in_source_document` vaut **UNVERIFIED**
pour les 40 sons. Aucune correspondance n'a été inventée. Ce document établit
tout ce qui *peut* être vérifié sans la source : l'identité des fichiers, la
provenance, les licences, la sensibilité, et le rattachement aux sept étapes.

---

## 1. Les trois ensembles à ne pas confondre

| Ensemble | Dénominateur | État |
|---|---|---|
| Enregistrements sources existants | **40 / 40** | tous présents dans `assets/originals/`, sha256 vérifiable |
| Sons sélectionnés par le musée (nouvelle sélection) | **0 / 40 vérifiés** | **bloqué** : document source absent |
| Sons actuellement autorisés à la composition | **{auth} / 40** | `availability == "available"` et non `sensitive` |

Les 3 sons non autorisés sont les sons `sensitive` de l'étape 4 — voir §4.

## 2. Correspondance étapes ↔ séquences : deux variantes concurrentes

Le parcours visiteur compte **7 étapes** ; l'inventaire compte **8 séquences**.
Une fusion est donc nécessaire, et **deux fusions différentes existent aujourd'hui** :

| Variante | Étape 6 « De la canne au sucre » | Étape 7 « De la bagasse à l'électricité » | Source |
|---|---|---|---|
| **A** (implémentée) | séquence 6 (6 sons) | séquences 7 + 8 (5 sons) | `config/steps.json`, `catalog.json` |
| **B** (cohérente avec le brief) | séquences 6 + 8 (9 sons) | séquence 7 (2 sons) | Phase A, §3.2 : « grouping involving the former sections 6 and 8 » |

**C'est un conflit réel, pas une nuance de rédaction.** Il déplace trois sons
(`08_01` Mélasse, `08_02` Jus de canne, `08_03` Chaudière) d'une étape à l'autre :

{"".join(f"- `{r['sound_code']}` {r['catalog_name']} — A: étape {r['stage_a_number']}, B: étape {r['stage_b_number']}{chr(10)}" for r in differ)}
Argument de contenu, sans trancher : la mélasse et le jus de canne sont des
produits du sucre, pas de la bagasse ; la chaudière peut brûler de la bagasse.
Cela plaide pour **B**. Mais seul le document source peut arbitrer, et il est absent.
**Décision requise : équipe projet.**

Autre écart mineur : l'étape 5 s'intitule « La canne à sucre » dans le brief et
« La canne » avec un badge « À confirmer » dans l'application.

## 3. Tableau de correspondance (variante B, l'ordre du brief)

{chr(10).join(by_stage)}

## 4. Matériel sensible — restrictions préservées

| code | nom | drapeau | statut | note d'inventaire |
|---|---|---|---|---|
""" + "".join(
        f"| `{r['sound_code']}` | {r['catalog_name']} | "
        f"sensitive={r['sensitive']}, validation={r['needs_validation']} | "
        f"{r['identity_status']} | {inv.get(r['sound_code'], {}).get('note', '')[:110]} |\n"
        for r in rows if r["sensitive"] or r["needs_validation"]
    ) + f"""

Ces trois sons restent `not_musical` : ils documentent une histoire douloureuse
(fouet, fers et chaînes) ou sont une maquette vocale non validée (`Ayo`). **La
sélection du musée ne vaut pas autorisation d'usage musical** : elle devra être
demandée explicitement, son par son, à la curation.

## 5. Décompte des statuts

{"".join(f"- **{k}** : {v}" + chr(10) for k, v in sorted(counts.items()))}
- Total : **{len(rows)}** sons

`MATCHED_REVIEW` regroupe les entrées dont l'identité de fichier est certaine mais
dont la **provenance** doit être revue : effets stock fournis par la source
(volcan, forêt tropicale) et non enregistrements du musée, ou notes d'inventaire
qui signalent elles-mêmes une incertitude (« espèces et lieu non certifiés »).

## 6. Ce que la synchronisation a réellement changé

Rien n'a été modifié. Constats sur l'état existant :

1. **Toutes les entrées portent `"license": "Licence à confirmer"`** — 40/40. Les
   crédits nomment CC0 / domaine public / BigSoundBank / Freesound, mais le champ
   lisible par machine est vide de sens. Blocage pour toute publication.
2. **La curation de démonstration a divergé.** `config/demo-set.json` contient
   encore la sélection de 12 sons, alors que `catalog.json` n'a plus ni `demoSet`
   ni `inDemoSet` (0 son marqué) : les 37 sons disponibles sont tous rattachés aux
   étapes et donc tous collectables. Les deux artefacts coexistent sans lien.
3. **Aucune configuration versionnée de la nouvelle sélection n'existe.** La
   produire exigerait de connaître la sélection ; c'est impossible ici (§1).

## 7. Questions bloquantes pour l'équipe projet

1. Fournir `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf`.
2. Arbitrer variante A ou B pour la fusion des séquences 6/7/8.
3. Confirmer que « La canne à sucre » remplace « La canne ».
4. Trancher le sort de `config/demo-set.json` : sélection de 12 conservée comme
   curation, ou remplacée par la nouvelle sélection ?
5. Autoriser — ou non — l'usage musical des 3 sons sensibles, individuellement.

---

*Généré par `scripts/phase-a/build-selection-mapping.py` à partir de
`src/data/catalog.json` et `/workspace/Inventaire.csv`. Aucune de ces deux
sources n'est modifiée par ce script.*
"""
    (OUT / "sound-selection-mapping.md").write_text(md)

    print(f"{len(rows)} sons -> sound-selection-mapping.{{md,csv}}")
    print("statuts:", dict(counts))
    print(f"autorisés à la composition : {auth}/40")
    print(f"lignes divergentes A/B : {len(differ)} "
          f"({', '.join(r['sound_code'] for r in differ)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
