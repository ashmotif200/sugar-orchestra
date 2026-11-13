#!/usr/bin/env python3
"""Phase A1 (2e passe) — correspondance PDF « Les Sons Choisis » ↔ catalogue.

Produit, de façon idempotente :
  docs/phase-a/sound-selection-v2.csv      toutes les lignes du catalogue + statut
  docs/phase-a/sound-selection-v2.md       la même chose, lisible
  config/steps.v2.json                     configuration versionnée des 7 étapes

Règles :
  * aucune invention : chaque son retenu est justifié par le libellé du PDF et
    par le nom/la note de l'Inventaire ;
  * les ambiguïtés sont DÉCLARÉES (confidence medium) et un alternatif est nommé ;
  * les restrictions éditoriales sont recopiées telles quelles depuis le catalogue
    (sensitive / not_musical) et ne peuvent pas être levées par cette config.
"""
import csv, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((ROOT / 'src/data/catalog.json').read_text())
SOUNDS = {s['code']: s for s in CATALOG['sounds']}

# PDF « Les Sons Choisis », page par page. `label` = libellé exact du document.
STEPS = [
    {"id": 1, "title": "Les origines : quand Maurice surgit de l'océan", "short": "Origines",
     "page": 2, "sounds": [
        {"code": "01_01", "label": "Volcan", "confidence": "high",
         "why": "« Son 1 : Volcan » ; le catalogue contient 01_01_Volcan_eruption"},
        {"code": "01_02", "label": "Flora et Fauna", "confidence": "high",
         "why": "« Son 2 : Flora et Fauna » ; 01_02_Foret_tropicale est la seule ambiance végétale"},
        {"code": "01_03", "label": "L’arrivée des premiers hommes", "confidence": "medium",
         "why": "débarquement de 1598 : 01_03_Bateau_fendant_eau ; alternative 01_04_Voiles_qui_claquent (voiles)",
         "alternative": "01_04"},
     ]},
    {"id": 2, "title": "Le sucre traverse les âges : du commerce à la dégustation", "short": "Âges du sucre",
     "page": 3, "sounds": [
        {"code": "02_04", "label": "les étales, les marchés", "confidence": "high",
         "why": "01_02 : « Son 1 : les étales, les marchés » ; 02_04_Commercants_etals"},
        {"code": "02_01", "label": "Cuillères qui remuent le sucre dans le thé", "confidence": "high",
         "why": "« Cuillères qui remuent le sucre dans le thé » ; 02_01_Cuillere_tasse_sucre"},
     ]},
    {"id": 3, "title": "Les métiers du sucre : les artisans qui construisent l’industrie", "short": "Métiers",
     "page": 4, "sounds": [
        {"code": "03_04", "label": "Charpentier", "confidence": "high",
         "why": "« Son : Charpentier » ; le texte cite aussi fondeurs et forgerons, mais nomme un seul son"},
     ]},
    {"id": 4, "title": "La mémoire des plantations : esclavage, engagisme et travail agricole", "short": "Mémoire",
     "page": 5, "restricted": True,
     "sounds": [
        {"code": "04_02", "label": "Sons de chaînes", "confidence": "high",
         "why": "« Sons de chaînes » ; 04_02_Fers_chaines"},
        {"code": "04_09", "label": "Lota et cuillère", "confidence": "low",
         "why": "« Lota » (marmite) n’existe pas au catalogue ; 04_09_Cuillere_sur_fer_blanc couvre la cuillère sur métal. À trancher par l’équipe.",
         "alternative": "04_08"},
     ]},
    {"id": 5, "title": "La canne à sucre : une plante qui transforme le paysage", "short": "Canne",
     "page": 6, "sounds": [
        {"code": "05_01", "label": "Sons qui évoluent progressivement", "confidence": "medium",
         "why": "« Sons qui évoluent progressivement » ; 05_01_Canne_pousse_accelere est littéralement une croissance accélérée",
         "alternative": "05_02"},
     ]},
    {"id": 6, "title": "De la canne au sucre : le travail de transformation", "short": "Canne → sucre",
     "page": 7, "sounds": [
        {"code": "04_03", "label": "1. La coupe : machettes et cannes qui tombent", "confidence": "medium",
         "why": "la coupe est au catalogue dans la séquence 4 (04_03_Coupe_coupe_champ) ; le PDF la place à l’étape 6"},
        {"code": "06_04", "label": "2. Le transport : bœufs, charrettes", "confidence": "high",
         "why": "06_04_Charrette_boeufs"},
        {"code": "06_06", "label": "3. Le moulin : engrenages et broyage", "confidence": "high",
         "why": "06_06_Engrenages ; alternatives 06_01_Moulin_eau / 06_03_Moulin_vapeur",
         "alternative": "06_01"},
        {"code": "08_02", "label": "4. L’extraction : écoulement du jus", "confidence": "high",
         "why": "08_02_Jus_de_canne"},
        {"code": "08_03", "label": "5. La cuisson : feu, bulles, vapeur", "confidence": "high",
         "why": "08_03_Chaudiere"},
        {"code": "04_07", "label": "6. La cristallisation : sucre qui se forme", "confidence": "medium",
         "why": "04_07_Sucre_sibilance_SSS est la seule prise de sucre cristallin ; classée séquence 4 dans l’inventaire"},
     ]},
    {"id": 7, "title": "De la bagasse à l’électricité : une nouvelle énergie pour l’île", "short": "Bagasse",
     "page": 8, "sounds": [
        {"code": "07_01", "label": "Bagasse sèche manipulée et déposée", "confidence": "high",
         "why": "07_01_Bagasse_ecrasee"},
        {"code": "07_02", "label": "Alternateur et vibrations électriques", "confidence": "high",
         "why": "07_02_Electricite"},
     ]},
]

RESTRICTED = ('not_musical', 'tbc')

def main():
    rows = []
    selected = {}
    for st in STEPS:
        for s in st['sounds']:
            if s['code'] not in SOUNDS:
                sys.exit(f"code absent du catalogue : {s['code']}")
            selected[s['code']] = (st, s)

    for code, snd in sorted(SOUNDS.items()):
        hit = selected.get(code)
        st, sel = hit if hit else (None, None)
        restricted = snd.get('availability') in ('not_musical',) or snd.get('sensitive', False)
        rows.append({
            'code': code,
            'title_catalogue': snd.get('title') or snd.get('name'),
            'etape_pdf': st['id'] if st else '',
            'etape_titre': st['title'] if st else '',
            'libelle_pdf': sel['label'] if sel else '',
            'confiance': sel['confidence'] if sel else '',
            'justification': sel['why'] if sel else 'non retenu par le PDF',
            'alternative': (sel.get('alternative') or '') if sel else '',
            'statut': 'RETENU' if sel else 'HORS_SELECTION',
            'availability': snd.get('availability', 'available'),
            'sensible': 'oui' if snd.get('sensitive') else 'non',
            'restriction_editoriale': 'usage musical interdit' if restricted else 'usage musical autorisé',
            'credits': snd.get('credits', ''),
            'license': snd.get('license', ''),
        })

    out_csv = ROOT / 'docs/phase-a/sound-selection-v2.csv'
    with out_csv.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), delimiter=';')
        w.writeheader(); w.writerows(rows)

    retenus = [r for r in rows if r['statut'] == 'RETENU']
    high = [r for r in retenus if r['confiance'] == 'high']
    medium = [r for r in retenus if r['confiance'] == 'medium']
    low = [r for r in retenus if r['confiance'] == 'low']

    md = ["# Sélection muséographique v2 — correspondance PDF ↔ catalogue", "",
          "Source : `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf` (8 pages, Tejsree Beharee, 13/11/2026).",
          "Généré par `scripts/phase-a/build-selection-v2.py` ; toute modification se fait dans le script.", "",
          "## Résultat", "",
          f"- Sons du catalogue : **{len(SOUNDS)}**",
          f"- Sons retenus par le PDF : **{len(retenus)}**",
          f"  - correspondance forte : **{len(high)}**",
          f"  - à confirmer : **{len(medium)}**",
          f"  - ambiguë : **{len(low)}**",
          f"- Sons hors sélection : **{len(rows) - len(retenus)}** (conservés au catalogue, non proposés)",
          f"- Sons à restriction éditoriale dans la sélection : **{sum(1 for r in retenus if r['sensible'] == 'oui')}**",
          "", "## Par étape", "", "| Étape | Titre | Sons retenus | Codes |", "|---|---|---|---|"]
    for st in STEPS:
        codes = ', '.join(f"`{s['code']}`" for s in st['sounds'])
        md.append(f"| {st['id']} | {st['title']} | {len(st['sounds'])} | {codes} |")
    md += ["", "## Ambiguïtés à trancher", ""]
    for r in rows:
        if r['statut'] == 'RETENU' and r['confiance'] != 'high':
            md.append(f"- **{r['code']} — {r['libelle_pdf']}** ({r['confiance']}) : {r['justification']}"
                      + (f" — alternative `{r['alternative']}`." if r['alternative'] else "."))
    md += ["", "## Sons du catalogue non retenus", ""]
    missing = [r for r in rows if r['statut'] == 'HORS_SELECTION']
    md.append(', '.join(f"`{r['code']}`" for r in missing))
    md += ["", "Ces sons restent dans le catalogue et dans `assets/originals/` avec leurs crédits ;",
           "la version 2 du parcours ne les propose simplement pas.", ""]
    (ROOT / 'docs/phase-a/sound-selection-v2.md').write_text('\n'.join(md), encoding='utf-8')

    cfg = {
        "version": 2,
        "supersedes": 1,
        "generatedBy": "scripts/phase-a/build-selection-v2.py",
        "source": "Museomix_Sugar Orchestra_ Les Sons Choisis.pdf",
        "sourceDate": "2026-11-13",
        "status": "ready-for-phase-b",
        "notes": [
            "Les 7 étapes et leurs titres sont ceux du PDF : il n'y a pas de 8e étape.",
            "Les sons de l'étape 6 proviennent des séquences 4 (coupe, cristallisation), 6 (transport, moulin) et 8 (jus, chaudière) de l'Inventaire : le découpage du PDF est narratif, pas séquentiel.",
            "Les restrictions éditoriales du catalogue sont recopiées telles quelles et ne peuvent pas être levées ici.",
            "Activation dans l'application : Phase B, après validation de l'équipe.",
        ],
        "limits": {"minSelected": 1, "maxSelected": 8},
        "steps": [
            {
                "id": st['id'],
                "title": st['title'],
                "short": st['short'],
                "page": st['page'],
                "restricted": bool(st.get('restricted')),
                "sounds": [
                    {
                        "code": s['code'],
                        "label": s['label'],
                        "confidence": s['confidence'],
                        "alternative": s.get('alternative'),
                        "availability": SOUNDS[s['code']].get('availability', 'available'),
                        "sensitive": bool(SOUNDS[s['code']].get('sensitive')),
                    } for s in st['sounds']
                ],
            } for st in STEPS
        ],
    }
    (ROOT / 'config/steps.v2.json').write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    print(f"retenus {len(retenus)}/{len(SOUNDS)} (fort {len(high)}, à confirmer {len(medium)}, ambigu {len(low)})")
    print(f"écrit {out_csv.relative_to(ROOT)}, docs/phase-a/sound-selection-v2.md, config/steps.v2.json")

if __name__ == '__main__':
    main()
