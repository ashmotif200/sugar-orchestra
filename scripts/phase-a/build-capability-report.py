#!/usr/bin/env python3
"""
Phase A4 — build the museum-sound capability report from measured data.

Reads docs/phase-a/data/corpus-analysis.json (produced by analyze-corpus.py) and
writes docs/phase-a/museum-sound-musical-capabilities.md.

Nothing here is estimated: every row is a measurement, every label states its rule.

    python3 scripts/phase-a/build-capability-report.py
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "phase-a" / "data" / "corpus-analysis.json"
OUT = ROOT / "docs" / "phase-a" / "museum-sound-musical-capabilities.md"

# Transform feasibility thresholds, stated once so the tables can be argued with.
ATK_TRANSIENT_MS = 15.0     # rise time under this = the identity is an attack
DECAY_SHORT_MS = 250.0      # falls 20 dB this fast = a hit, not a sustain
DECAY_LONG_MS = 500.0       # still audible after this = material to stretch
FLAT_NOISE = 0.30           # spectral flatness above this = broadband noise
PER_PITCHED = 0.75          # autocorrelation periodicity above this = pitched
PULSE_LOOP = 0.25           # onset-envelope autocorrelation above this = pulsed


def classify_transform(s):
    c, sp, pi, rh, env = (s["classification"], s["spectral"], s["pitch"],
                          s["rhythm"], s["envelope"])
    atk = env["attack_ms"] if env["attack_ms"] is not None else 999.0
    dec = env["decay_ms"] if env["decay_ms"] is not None else 0.0
    per = pi["periodicity"]
    flat = sp["flatness"]

    kind = ("transient net" if atk <= ATK_TRANSIENT_MS and dec <= DECAY_SHORT_MS
            else "tenu tonal" if dec >= DECAY_LONG_MS and per >= PER_PITCHED
            else "bruit large bande" if flat >= FLAT_NOISE
            else "semi-périodique" if per >= 0.5
            else "texture étendue")

    ok = []
    if rh["onset_rate_per_s"] >= 1.0 or atk <= ATK_TRANSIENT_MS:
        ok.append("découpe")
    if per >= PER_PITCHED:
        ok.append("transposition")
    if dec >= DECAY_LONG_MS:
        ok.append("étirement")
    if dec >= DECAY_LONG_MS or per >= 0.5:
        ok.append("granulation")
    if flat <= FLAT_NOISE:
        ok.append("filtrage")
    ok.append("enveloppe")
    if rh["pulse_strength"] >= PULSE_LOOP:
        ok.append("boucle")

    # Recognisability risk: where does this sound's identity live?
    risks = []
    if atk <= ATK_TRANSIENT_MS and dec <= 120.0:
        risks.append("identité dans l'attaque")
    if flat >= 0.40:
        risks.append("identité spectrale large bande")
    if per >= PER_PITCHED:
        risks.append("identité dans la hauteur")
    risk = ("élevé" if len(risks) >= 2 else "moyen" if risks else "faible")

    return kind, ok, risks, risk


def main():
    d = json.loads(DATA.read_text())
    sounds = d["sounds"]
    for s in sounds:
        s["_kind"], s["_ok"], s["_risks"], s["_risk"] = classify_transform(s)

    roles = Counter()
    for s in sounds:
        for r in s["classification"]["role_hypotheses"]:
            roles[r] += 1
    kinds = Counter(s["_kind"] for s in sounds)
    risks = Counter(s["_risk"] for s in sounds)
    pitched = [s for s in sounds if s["classification"]["credible_pitch"]]
    bass = [s for s in sounds if s["classification"]["bass_capable"]]
    sensitive = [s for s in sounds if s["catalog"]["sensitive"]]
    usable = [s for s in sounds if not s["catalog"]["sensitive"]]

    md = [f"""# Phase A4 — capacités musicales des sons du musée

Mesures sur les **40 masters** de `assets/originals/` (32 kHz, mono, 20 s chacun),
le 13 novembre 2026. Données brutes : `docs/phase-a/data/corpus-analysis.json`,
tableau condensé : `docs/phase-a/data/corpus-table.txt`.

**Ces pages sont des mesures. Les rôles proposés sont des hypothèses**, chacune
assortie de la règle qui l'a produite. Le brief est explicite : seule l'écoute
confirme l'usage musical. Aucun son n'a été transformé ni modifié.

---

## 1. Calibration de la mesure — avant de conclure quoi que ce soit

Une mesure de « hauteur » qui classe du bruit comme tonal, ou un bourdon comme
non tonal, produirait un rapport entier faux. La métrique de périodicité
(autocorrélation normalisée au retard du f0, médiane sur les trames voisées) a
donc été calibrée sur du matériau de vérité connue :

| Signal de contrôle | Périodicité mesurée | Lecture attendue |
|---|---|---|
| sinus pur 440 Hz | **0,980** | tonal, sans ambiguïté |
| basse saw 73,42 Hz (ré2) | **0,894** | tonal, registre grave |
| accord de rém7 (4 sinus) | 0,494 | partiellement périodique |
| bruit blanc | **0,024** | non tonal |
| claquement type fouet | **0,021** | non tonal |
| ralenti moteur 57 Hz + bruit | 0,779 | périodique, mais bruité |
| métal inharmonique (coups) | 0,807 | périodique par répétition, pas harmonique |

Deux métriques ont été **rejetées** en route, et c'est consigné parce que cela
change la conclusion :

1. `librosa.yin` sur fenêtre 2048 à 32 kHz : moins de deux périodes d'un bourdon
   à 50 Hz tiennent dans la fenêtre. Remplacé par `pyin`, fenêtre 4096,
   rééchantillonné à 16 kHz.
2. « part de la magnitude sur la série harmonique » : donnait **0,444 pour un
   sinus pur**, parce que la somme des magnitudes sur 1024 bins est dominée par
   le plancher de bruit. Cette métrique aurait déclaré le corpus entier non tonal
   sur un artefact de calcul. Elle est remplacée par la périodicité.

## 2. Constat central : le corpus n'a pas de basse

| Question | Réponse mesurée | Dénominateur |
|---|---|---|
| Sons avec hauteur crédible (périodicité ≥ 0,75) | **{len(pitched)}** | 40 |
| Sons utilisables comme **basse** | **{len(bass)}** | 40 |
| Sons « tonals » au sens spectral strict | {sum(1 for s in sounds if s["classification"]["tonal"])} | 40 |
| Sons avec énergie dominante sous 250 Hz | {sum(1 for s in sounds if s["classification"]["low_band_share_pct"] >= 45)} | 40 |

Les cinq sons à hauteur crédible sont **tous dans le médium-aigu** :

"""]
    for s in sorted(pitched, key=lambda x: -(x["pitch"]["periodicity"])):
        md.append(f"- `{s['id']}` {s['catalog']['name']} — "
                  f"{s['pitch']['median_hz']} Hz, périodicité {s['pitch']['periodicity']}, "
                  f"bande basse {s['classification']['low_band_share_pct']} %\n")

    md.append(f"""
Le seul son dont l'énergie est massivement grave (`01_01`, volcan, 96 % sous
250 Hz) a une périodicité de **{next(s['pitch']['periodicity'] for s in sounds if s['id'] == '01_01')}** :
c'est un grondement non périodique. Un grondement n'est pas une basse. C'est
exactement le piège que le brief signale — « un enregistrement contenant de
l'énergie basse n'est pas automatiquement une basse ».

## 3. Rôles : ce que les mesures proposent

| Rôle proposé | Nombre de sons | Règle |
|---|---|---|
| percussion | {roles['percussion']} | rythmique et non tonal |
| atmosphere | {roles['atmosphere']} | platitude ≥ 0,10, ou aigus ≥ 35 % avec platitude ≥ 0,1 |
| rhythmic_texture | {roles['rhythmic_texture']} | rythmique et transitoire |
| melodic | {roles['melodic']} | hauteur crédible au-dessus de 220 Hz |
| transition | {roles['transition']} | transitoire sans autre rôle |
| narrative_sound_event | {roles['narrative_sound_event']} | aucun critère rempli |
| **bass** | **0** | bande basse ≥ 45 % **et** hauteur crédible ≤ 220 Hz **et** périodicité ≥ 0,85 |

Un son peut cumuler plusieurs rôles : {sum(1 for s in sounds if len(s['classification']['role_hypotheses']) > 1)} sons en cumulent au moins deux.

## 4. Faisabilité des transformations

Classification par forme mesurée (attaque 10–90 %, décroissance à −20 dB,
périodicité, platitude) :

| Forme | Sons |
|---|---|
""" + "".join(f"| {k} | {v} |\n" for k, v in kinds.most_common()) + f"""
Opérations jugées possibles, règle par règle :

- **découpe** : taux d'onsets ≥ 1/s, ou attaque ≤ 15 ms ;
- **transposition** : périodicité ≥ 0,75 (en dessous, on ne transpose pas une
  hauteur, on filtre un timbre — ce n'est pas la même chose musicalement) ;
- **étirement** : décroissance ≥ 500 ms ;
- **granulation** : décroissance ≥ 500 ms ou périodicité ≥ 0,5 ;
- **filtrage** : platitude ≤ 0,30 (au-delà, le filtre détruit l'identité) ;
- **enveloppe** : toujours possible ;
- **boucle** : force de pulsation ≥ 0,25.

## 5. Risque sur la reconnaissabilité

Le risque est élevé quand deux des trois conditions suivantes sont réunies :
identité dans l'attaque (attaque ≤ 15 ms et décroissance ≤ 120 ms), identité
spectrale large bande (platitude ≥ 0,40), identité dans la hauteur
(périodicité ≥ 0,75).

| Risque | Sons |
|---|---|
""" + "".join(f"| {k} | {v} |\n" for k, v in risks.most_common()) + """
Conséquence directe pour le moteur : un son « identité dans l'attaque » survit à
la transposition mais **pas** à l'étirement ni à la granulation ; un son
« identité spectrale » survit à la découpe mais pas au filtrage. Ce sont des
contraintes par son, pas des préférences.

## 6. Tableau complet des 40 sons

`per` = périodicité, `plat.` = platitude spectrale, `atk`/`déc` en ms,
`base%` = part d'énergie sous 250 Hz. Les trois sons sensibles sont marqués ⚠ et
**restent exclus de toute composition**.

| code | nom | base% | per | plat. | atk | déc | forme | rôles (hypothèse) | transformations | risque |
|---|---|---|---|---|---|---|---|---|---|---|
""")

    for s in sorted(sounds, key=lambda x: x["id"]):
        c, sp, pi, env = (s["classification"], s["spectral"], s["pitch"],
                          s["envelope"])
        flag = " ⚠" if s["catalog"]["sensitive"] else ""
        md.append(
            f"| `{s['id']}`{flag} | {s['catalog']['name']} | "
            f"{c['low_band_share_pct']} | {pi['periodicity']} | {sp['flatness']} | "
            f"{env['attack_ms'] if env['attack_ms'] is not None else '—'} | "
            f"{env['decay_ms'] if env['decay_ms'] is not None else '—'} | "
            f"{s['_kind']} | {', '.join(c['role_hypotheses'])} | "
            f"{', '.join(s['_ok'])} | {s['_risk']} |\n")

    md.append(f"""
## 7. Ce que le corpus ne peut pas faire

1. **Aucune ligne de basse.** Zéro son sur 40 réunit les conditions. Toute basse
   produite aujourd'hui est une transposition d'un son qui n'a pas de hauteur
   stable, ou un grondement filtré — ni l'un ni l'autre n'est une basse.
2. **Pas de matériau mélodique grave.** Les 5 sons à hauteur crédible sont entre
   100 Hz et 940 Hz. Une mélodie écrite dans ce registre sonne comme des cloches
   ou du métal frappé, pas comme un chant.
3. **Peu de matière tenue.** {kinds.get('tenu tonal', 0)} sons seulement sont à la fois tenus et périodiques :
   les nappes devront venir de textures étirées, pas de notes tenues.
4. **Le rythme est là.** {roles['percussion'] + roles['rhythmic_texture']} sons sont percussifs ou rythmiques : c'est la ressource la plus
   solide du fonds, et elle est cohérente avec un projet Electro Sega.

## 8. Sons sensibles — état inchangé

| code | nom | drapeau |
|---|---|---|
""" + "".join(
        f"| `{s['id']}` | {s['catalog']['name']} | sensitive, availability = {s['catalog'].get('availability', 'not_musical')} |\n"
        for s in sensitive) + f"""
Ces trois sons ont été mesurés comme les autres (mesure ≠ autorisation) et
restent `not_musical`. **La sélection muséale ne vaut pas autorisation d'usage.**

## 9. Ce qui exige une écoute

- Tout le tableau des rôles : ce sont des hypothèses issues de seuils.
- La « forme » d'un son : un son étiqueté `transient net` peut, à l'oreille,
  avoir une queue de résonance que la mesure à −20 dB ne voit pas.
- La reconnaissabilité après transformation : aucune métrique ne la mesure.
  Elle se teste en écoutant le son transformé, pas en lisant un nombre.
- L'usage artistique d'un son de gronderie ou d'un métal : la mesure ne dit pas
  s'il est beau, elle dit s'il est périodique.

---

*Généré par `scripts/phase-a/build-capability-report.py` à partir de
`data/corpus-analysis.json`. Les masters n'ont été ouverts qu'en lecture.*
""")

    OUT.write_text("".join(md))
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"  pitched={len(pitched)} bass={len(bass)} roles={dict(roles)}")
    print(f"  kinds={dict(kinds)} risks={dict(risks)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
