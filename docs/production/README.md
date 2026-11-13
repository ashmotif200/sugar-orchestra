# Production musicale — Énergétique / Electro Sega

Trois rendus de 42,67 s (24 mesures à 135 BPM, 4/4 ternaire, Fa majeur).
Produits par `scripts/production/electro_sega.py` — script reproductible, graine fixe.

## Fichiers

| Version | WAV | Rôle |
|---|---|---|
| **A** | `A-fondation.wav` | fondation instrumentale, aucun son du musée |
| **B** | `B-visiteur1.wav` | collection 1, thème porté par une cloche métallique |
| **C** | `C-visiteur2.wav` | collection 2, thème annoncé d'abord, lead synthé aigu |

Chaque version : `*.score.json` (partition lisible), `*.mid` (ligne mélodique), `stems/<version>/` (pupitres isolés).

## Structure (identique en A et B ; C inverse A et B)

| Mesures | Section | Contenu |
|---|---|---|
| 1–2 | Intro | nappe + balai croissant, aucune percussion |
| 3–10 | A | groove complet : grosse caisse, rim, charley, accords pincés, basse |
| 11–16 | B | thème (hook), basse en marche, accords Fa–Rém–Sib–Do |
| 17–18 | Break | percussions retirées, accord tenu, silence au dernier temps |
| 19–22 | A' | retour du groove avec le thème |
| 23–24 | Outro | basse + nappe, accent final |

Dynamique mesurée : intro −28 dB · A −16,5 · B −15,5 · **break −20,7** · A' −15,7 · outro −19,2.

## Sons du musée

**Version B (collection 1)**

| Son | Rôle | Apparitions |
|---|---|---|
| `04_03` Coupe-coupe dans le champ | ostinato principal | toutes les mesures de A et A' |
| `08_02` Jus de canne | couche de croches | A et A' |
| `06_04` Charrette à bœufs | grave percussif (rôle du kick), filtré 220 Hz | temps 1 de chaque mesure |
| `04_02` Fers et chaînes | accent de signature | mesures 10, 16, 24 |
| `04_09` Cuillère sur fer blanc | **hook mélodique**, transposé depuis 722 Hz | 4 phrases, sections B et A' |
| `04_07` Sucre — sibilance | texture | intro, break |
| `01_03` Bateau fendant l'eau | transition | mesures 2, 16 |

**Version C (collection 2)**

| Son | Rôle | Apparitions |
|---|---|---|
| `03_04` Charpentier | ostinato principal | A et A' |
| `02_04` Commerçants étals | couche rythmique | A, A' |
| `01_01` Volcan | sub / grave filtré 160 Hz | temps 1 et 3 |
| `07_02` Électricité | accent (résonance basse) | mesures 10, 24 |
| `05_01` Canne qui pousse | texture d'intro | intro, break |
| `08_03` Chaudière | transition | mesure 16 |

Le hook de C est joué par un lead synthétique une octave au-dessus : la collection 2 n'a pas de son à
hauteur crédible utilisable en mélodie (seul `07_02` l'est, à 100 Hz, trop grave pour porter une phrase).

## Différences B / C

| | B | C |
|---|---|---|
| Ordre des sections | intro · **A** · **B** · break · A' · outro | intro · **B** · **A** · break · A' · outro |
| Hook | cloche métallique (`04_09`), timbre de percussion | lead synthé carré, une octave au-dessus |
| Basse | timbre percussif, notes courtes | timbre plus riche (harmoniques +35 %), plus de sustain |
| Ostinato | `04_03` aux pas 2-5-8-11 | `03_04` aux pas 1-4-7-10 |
| Grave | `06_04` charrette filtrée | `01_01` volcan filtré |
| Accents | 3 × `04_02` (métal) | 2 × `07_02` (résonance) |

Ce ne sont pas des bruitages échangés : l'ordre, le timbre du thème, la couleur de basse et la grille
d'ostinato changent. Le thème arrive à la mesure 3 en C, à la mesure 11 en B.

## Niveaux

| | LUFS | True peak |
|---|---|---|
| A | −14,7 | −1,8 dBTP |
| B | −14,9 | −1,5 dBTP |
| C | −14,2 | −1,2 dBTP |

Écart de 0,7 LU entre versions : comparables à l'écoute.

## Limites

- **Aucune écoute humaine n'a été faite.** Je ne peux pas écouter ; ce document décrit ce qui a été
  produit, pas un jugement de goût. Les trois WAV sont là pour ça.
- Toute la musique est **synthétisée** (batterie, basse, accords, lead) : c'est une maquette de
  composition, pas une production mixée par un ingénieur du son.
- Pas de reverb, pas de compression par bus, pas de mastering : seul un `tanh` doux et une
  normalisation de crête.
- Le MIDI ne contient que la ligne mélodique ; la partition complète est dans `*.score.json` et dans le
  script.
- Les sons du musée sont utilisés en **tranches d'attaque** (0,35 s à 1,6 s), avec transposition par
  taux de lecture : cela change aussi leur durée. Sur une cloche, c'est naturel ; sur une texture,
  c'est moins fidèle.
- `04_02` (fers et chaînes) et `01_01` (volcan) sont des sons historiquement sensibles : utilisés ici
  comme accents, avec leur signification éditoriale inchangée.
- Aucun enregistrement de référence n'a servi d'accompagnement.
