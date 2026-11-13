# Référence Détendu — « Zistoire » (mix + 3 stems)

> Ce document remplace l'analyse bloquée du 13/11 09:38 (0/4 fichier présent).
> Les quatre fichiers ont été fournis et mesurés.

**Fichiers :** `zistoire mix v0.wav` (48 kHz / 24 bits / stéréo, 54,47 s) et trois
stems WAV 48 kHz (`drums`, `bass`, `other`).
**Analyse :** mêmes scripts, données dans `data/reference-detendu.json`,
`data/arrangement-detendu.json`, `data/harmony-detendu.json`.

## Ce qui est mesuré

| Élément | Mix | drums | bass | other |
|---|---|---|---|---|
| Durée | 54,47 s | 54,47 s | 54,47 s | 54,47 s |
| LUFS intégré | **−14,5** | −23,0 | **−19,2** | **−17,0** |
| Crête | −1,42 dBFS | −1,85 | −6,26 | −3,59 |
| Centroïde | — | 3 348 Hz | 236 Hz | 1 238 Hz |
| Attaques / min | — | 218 | **210** | 150 |
| Présence | — | 100 % | 100 % | 87 % |

Reconstruction : **corrélation 1,0000**, gain 1,0000, écarts d'échantillons nuls,
décalages 0,0 ms sur les trois stems. Multipiste exact, sample-aligned.

## Tempo et mètre

drums : **133,93 BPM** (support 1,00 ; candidats 140,6 / 148,0 / 127,8).
mix : 135,54 (1,00) / 142,41 (0,96) / 216,35 (0,96).
Suivi de pulsation : 133,93 BPM, 125 battements, mesure de **1,792 s** (4/4),
**30 mesures**. Micro-timing du tracker : écart-type 37 ms (régularité, pas le jeu).
Swing mesuré : première contretemps à 0,475 (0,5 = binaire) → **binaire**, pas ternaire.

## Forme mesurée

| Mesures | Durée | Couches | other (LUFS) | drums (LUFS) |
|---|---|---|---|---|
| 1–8 | 14,3 s | drums, bass, other | −22,5 | −27,7 |
| 9–10 | 3,6 s | drums, bass | **−28,9** | −27,5 |
| 11–13 | 5,4 s | + other | −24,5 | −27,2 |
| 14 | 1,8 s | drums, bass | **−32,3** | −23,7 |
| 15–20 | 10,8 s | + other | −20,9 | −26,9 |
| 21 | 1,8 s | drums, bass | −27,9 | −25,1 |
| 22–30 | 16,1 s | toutes, drums plus fort | −20,9 | **−22,4** |

Forme : **A (8) · creux (2) · A' (3) · stop (1) · B (6) · stop (1) · outro (9)**.
Les creux ne sont pas des silences : la couche harmonique tombe d'environ 6 dB et
laisse basse + batterie. Ce sont des **stop-time d'une ou deux mesures**, pas des
breaks de 8.

## Harmonie

Tonalité : **si mineur** (corrélation 0,762 ; si majeur 0,564 ; mi mineur 0,562).
Le matcher de triades par mesure produit une suite bruitée — aucune période stable
n'est détectée — mais tous les accords récurrents (Bm, Em, G, D, A, F#m) appartiennent
au jeu diatonique de **si mineur**. Les valeurs aberrantes (B, G#m, Dm, C) sont des
erreurs de gabarit sur une texture dense, pas des modulations.

## Basse

La1 (~55 Hz, médiane MIDI 32–33), 207 attaques dont 201 avec hauteur, prévalence
voisée 0,775. Densité **210 attaques/min ≈ 3,5/s** : la basse est **motrice**, elle
porte le morceau (contrairement à Énergétique).

## Équilibre des couches

`other` −17,0 et `bass` −19,2 sont **au-dessus** de `drums` −23,0 : la batterie est
**5,8 dB sous la basse**. C'est la signature du « détendu » : ce n'est pas un tempo
lent (134 BPM), c'est une **batterie discrète et une basse chantante**. Le centroïde
de la batterie à 3 348 Hz indique des charleys fins, très aigus, qui occupent l'air
sans occuper le grave.

## Ce que cette référence dit pour Phase B

1. **134 BPM binaire** — le moteur « Segazz » n'existe pas ; s'il est construit, c'est
   ce tempo-là, pas un slow.
2. **Basse devant, batterie derrière.** L'inverse du moteur actuel, où la batterie
   domine de plusieurs dB.
3. **Forme avec stop-time** de 1–2 mesures : un accord qui tombe, pas un filtre.
4. **Harmonie diatonique réelle** (si mineur) : la couche `other` bouge, contrairement
   à Énergétique qui tient une pédale.
5. **Durée 54 s, 30 mesures** : nos 36 s sont courtes pour installer une forme.
