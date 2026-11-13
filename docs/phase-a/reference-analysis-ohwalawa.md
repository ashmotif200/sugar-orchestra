# Référence Énergétique — « Ohwalawa » (mix + 4 stems)

**Fichiers :** `ohwalawa_Energetique_mix.wav` (48 kHz / 24 bits / stéréo, 51,06 s) et
quatre stems MP3 44,1 kHz (`drums`, `bass`, `vocals`, `percs_and_synths`).
**Analyse :** `scripts/phase-a/analyze-reference.py` + `analyze-arrangement.py` +
`analyze-harmony.py`, données dans `docs/phase-a/data/reference-energetique.json`,
`arrangement-energetique.json`, `harmony-energetique.json`.
**Outillage :** FFmpeg 7.1.5 (mesures LUFS), librosa 1.0.1, numpy 2.5.4.

## Ce qui est mesuré

| Élément | Mix | drums | bass | vocals | percs_and_synths |
|---|---|---|---|---|---|
| Durée | 51,06 s | 51,06 s | 51,06 s | 51,06 s | 51,06 s |
| LUFS intégré | **−11,7** | −13,2 | −21,4 | −24,3 | −19,5 |
| Crête | −2,07 dBFS | −1,12 | −7,05 | −2,35 | −3,37 |
| Centroïde | — | 1 750 Hz | 350 Hz | 1 173 Hz | 1 113 Hz |
| Attaques / min | — | **268** | 95 | 175 | 215 |
| Présence | — | 96 % | 57 % | 96 % | 100 % |

**Les stems sont exacts :** la somme des quatre pistes reconstruit le mix avec une
corrélation de **0,9999** et un gain de **0,9999**. Ce ne sont pas des approximations
de séparation : c'est le multipiste du morceau.

> Limite mesurée : le décalage estimé par enveloppe d'attaques donne 368 ms pour les
> voix et −491 ms pour `percs_and_synths`. Ces valeurs sont des **artefacts** — la
> reconstruction à 0,9999 sans décalage prouve que les stems sont alignés — et l'une
> tombe exactement sur la borne de recherche (±0,5 s). Ne pas les réutiliser.

## Tempo et mètre

| Source | Hypothèses | Support |
|---|---|---|
| mix | **208,33** / 135,54 / 187,5 / 197,37 | 1,00 / 0,87 / 0,87 / 0,81 |
| drums | 134,23 / 210,94 / 187,93 / 198,77 | 1,00 / 0,84 / 0,68 / 0,62 |

Le suivi de pulsation s'arrête sur **135,54 BPM** (117 battements, intervalle moyen
439,7 ms) et une mesure de **1,771 s** — soit 4/4 à 135,5. L'hypothèse 208 est le
double du même pouls : le morceau est **percussif à ~135**, avec une sensation de
double-croches. **28 mesures.**

## Forme mesurée (présence des couches)

| Mesures | Durée | Couches actives | Niveau drums | Niveau bass |
|---|---|---|---|---|
| 1 | 1,8 s | percs+synth, voix | −23,9 | **silence (−103)** |
| 2 | 1,8 s | + drums | −18,0 | −27,7 |
| 3 | 1,8 s | + basse (brève) | −14,4 | −24,0 |
| 4–5 | 3,5 s | drums, percs, voix | −13,1 | **silence (−65)** |
| 6 | 1,8 s | drums, percs | −12,7 | **silence (−99)** |
| 7–13 | 12,4 s | drums, percs, voix | −13,1 | quasi absent (−50) |
| **14–28** | **26,6 s** | **toutes** | −14,7 | **−18,9** |

**Le fait structurant : 13 mesures (46 % du morceau) sans basse.** Le morceau est un
montage en deux blocs : une base percussive + voix pendant 23 s, puis l'entrée de la
basse à la mesure 14 qui ouvre le « vrai » groove jusqu'à la fin. C'est un **build and
drop**, pas une boucle de 8 mesures répétée.

## Harmonie

La couche `percs_and_synths` lit **fa majeur** (corrélation 0,743 ; fa mineur 0,679)
avec un cycle détecté de **2 mesures à 0,96 d'accord** — c'est-à-dire **une seule
tonalité, sans progression d'accords**. Le morceau tient sur une pédale de fa.

## Basse

Fa1 (~44 Hz, médiane MIDI 29), 199 attaques, 199 hauteur détectée, prévalence
voisée 0,503. Densité 95 attaques/min ≈ 1,6/s : la basse est **sparse**, elle marque
les temps plutôt qu'elle ne court.

## Voix

Stem de voix présent 96 % du temps, 175 attaques/min, centroïde 1 173 Hz. C'est une
couche chantée réelle — **le moteur ne peut pas la produire** (aucun son de voix
autorisé dans le catalogue : `04_05_Ayo` est une maquette à valider).

## Ce que cette référence dit pour Phase B

1. **Tempo cible 135 BPM**, pas 112. L'écart actuel (112) est de 20 % : c'est audible
   immédiatement comme « plus lent que la référence ».
2. **Forme en deux blocs avec entrée de basse tardive.** Le moteur actuel fait entrer
   la basse dès la mesure 2 et la garde 100 % du temps — c'est l'inverse.
3. **Harmonie statique.** Une pédale suffit ; une progression d'accords n'est pas
   nécessaire et le moteur ne doit pas en inventer une.
4. **Drums devant, basse discrète** (−13,2 vs −21,4 LUFS, soit 8 dB d'écart).
5. **Pas de voix possible** : compenser par la densité percussive (268 attaques/min)
   et les accents de `percs_and_synths` (215/min), pas par une mélodie chantée.
