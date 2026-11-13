# Phase A3 — analyse des références musicales : état et blocage

**Verdict : BLOQUÉ. Aucun fichier de référence n'est présent sur Hermes.**
Aucune analyse musicale n'a donc été produite — et aucune n'a été inventée.

## 1. Fichiers demandés, fichiers trouvés

| Fichier attendu | Statut | Preuve |
|---|---|---|
| `Zistwar-drums.wav` | **ABSENT** | voir §2 |
| `Zistwar-bass.wav` | **ABSENT** | voir §2 |
| `Zistwar-other.wav` | **ABSENT** | voir §2 |
| `zistoire mix v0.wav` | **ABSENT** | voir §2 |

**0 / 4 fichiers disponibles.** La référence « Détendue — Sega Jazz / Segazz »
n'a fait l'objet d'aucune mesure : il n'y avait rien à mesurer.

## 2. Journal de recherche (exhaustif, daté du 13 novembre 2026)

1. **Nom exact** sur tous les systèmes de fichiers montés (`/`, `/workspace`,
   `/opt/data`, `/vaults`, `/root`, `/tmp`) : aucune correspondance.
2. **Variantes de nom** : `*choisi*`, `*museomix*`, `*muséomix*`,
   `*sugar*orchestra*.pdf`, `*zistwar*`, `*zistoire*`, `*segazz*`, `*detend*`,
   `*détend*` → aucune correspondance.
3. **Tous les fichiers audio de la machine**, tous montages confondus :
   - 40 masters du musée (`assets/originals/`) ;
   - 2 pièces de secours (`assets/backup/`) ;
   - 13 fichiers de substitution `S01…S07` dans `/tmp/imp/` (générés par le
     script `gen-placeholders.mjs` lors d'une session antérieure — ce ne sont
     **pas** des références musicales) ;
   - 1 échantillon TTS (`/opt/hermes/tools/neutts_samples`) ;
   - des données de test SciPy.
4. **Contenu des archives ZIP** présentes : `Sons_sucre_40_pistes_20s.zip`,
   `RR 396.zip`, `SEM CN.zip`, `SEM pdf.zip`, `Stables.zip`, `Horses 1.zip`,
   `FARMOS_V0.zip`, `fundkiss.zip` — aucune piste de type stem, aucun nom
   « Zistwar ».
5. **Historique de conversation** : la référence est *mentionnée* dans le brief
   Phase A et dans le dossier de transmission, mais aucune pièce jointe audio
   n'a jamais été déposée sur cet hôte.

Conclusion : ce n'est pas un problème de chemin ni de permission. **Les fichiers
n'ont pas été fournis.**

## 3. Ce qui a été fait à la place — et pourquoi ce n'est pas du remplissage

Deux livrables réutilisables ont été construits et **validés sur des stems
synthétiques dont la vérité terrain est connue**. Cela prouve que la méthode
mesure correctement, sans jamais faire passer une référence inventée pour la
vôtre.

### 3.1 `scripts/phase-a/make-synthetic-reference.py`
Génère une référence de contrôle : **88 BPM, 4/4, 8 mesures, ré mineur,
44,1 kHz, stems alignés à 0, mix = somme des stems**, avec swing délibéré
(contretemps à 0,62 du temps).

### 3.2 `scripts/phase-a/analyze-reference.py`
Pipeline complet : technique des fichiers, alignement des stems, reconstruction
du mix, tempo (hypothèses multiples), grille rythmique, swing/syncope, analyse
de la basse (onsets, hauteurs, intervalles), harmonie (chroma + corrélations
Krumhansl), timeline d'arrangement par mesure.

### 3.3 Validation : la méthode retrouve-t-elle la vérité terrain ?

| Grandeur | Vérité terrain | Mesuré | Écart |
|---|---|---|---|
| Tempo (tempogram) | 88 BPM | 88,34 | +0,4 % |
| Tempo (global librosa) | 88 BPM | 88,34 | +0,4 % |
| Tempo (stem batterie seul) | 88 BPM | 88,34 | +0,4 % |
| Intervalle inter-temps moyen | 681,8 ms | 680,5 ms | −1,3 ms |
| Swing (position du contretemps) | 0,62 | **0,61** | −0,01 |
| Nombre de mesures | 8 | 8 | 0 |
| Durée de mesure | 2,727 s | 2,717 s | −10 ms |
| Premières notes de basse (MIDI) | 38, 38, 38, 38, 50… | **38, 38, 38, 38, 50…** | 0 |
| Tonalité (1er candidat) | ré mineur | **D minor (0,838)** | correct |
| Reconstruction du mix | corr = 1,0 | **0,9999** | conforme |
| Alignement des stems | 0 ms | batterie 0 ms, other −5,8 ms, basse −58 ms | voir ci-dessous |

**Limites mesurées, à ne pas oublier sur les vrais fichiers :**
- la résolution d'alignement est d'un saut de trame (5,8 ms à 44,1 kHz) ; sur une
  basse éparse l'estimation peut dériver jusque ~60 ms — corroborer avec
  `sample_count_delta` (0 = aligné) et avec le stem batterie ;
- la recherche de décalage est bornée à ±0,5 s. Sans cette borne, une corrélation
  non restreinte renvoyait **1422 ms** sur des stems parfaitement alignés, parce
  que le maximum tombe sur un multiple de la période rythmique ;
- le « gain » mix/somme vaut 0,43 sur le jeu synthétique : c'est normal, le mix
  était normalisé. La reconstruction se juge sur la **corrélation**, pas sur le gain.

Un troisième défaut a été corrigé pendant la validation : le calcul d'harmonicité,
d'abord moyenné sur 20 s (ce qui dilue un métal qui résonne en bruit large bande),
est désormais calculé **par trame**, puis médian sur les trames voisées.

## 4. Cadre d'analyse prêt pour les cinq sections du brief

Dès que les fichiers arrivent, une commande produit tout :

```bash
/opt/data/tools/sugar-audio/renv/analysis/bin/python \
  scripts/phase-a/analyze-reference.py \
  --mix  "/chemin/zistoire mix v0.wav" \
  --drums "/chemin/Zistwar-drums.wav" \
  --bass  "/chemin/Zistwar-bass.wav" \
  --other "/chemin/Zistwar-other.wav" \
  --out  docs/phase-a/data/reference-detendue.json
```

| Section du brief | Ce que la commande produit | Ce qu'elle ne produit pas |
|---|---|---|
| 5.2 Technique | durée, sr, canaux, crête, RMS, LUFS intégré, décalage des stems, reconstruction du mix | — |
| 5.3 Rythmique | 4 candidats de tempo avec leur support, BPM global, grille de temps, IBI moyen/écart-type, position du contretemps (swing), proportion de temps avec onset intermédiaire | pas de verdict unique de BPM ; pas de métrique définitive (voir §5) |
| 5.4 Basse | onsets, hauteur par onset, MIDI, séquence d'intervalles, prévalence voisée | pas de transcription ; pas de portée |
| 5.5 Harmonique | profil de chroma, 3 candidats de tonalité avec corrélation, instants de nouveauté | pas d'accords nommés sans vérification |
| 5.6 Arrangement | timeline par mesure : RMS, densité d'onsets, pour mix/batterie/basse | sections nommées : elles demandent une écoute |

## 5. Ce qui exigera une écoute humaine même avec les fichiers

- **Métrique** : 4/4 contre 6/8 ne se déduit pas de façon fiable d'un tempogram.
  Le pipeline donne des indices (rapport de forces d'onset, position des
  contretemps) ; la décision revient à l'oreille.
- **Microtiming** : l'écart-type d'IBI mesure la régularité du *tracker*, pas le
  jeu du musicien. Distinguer un vrai retard expressif d'une erreur de grille
  demande une écoute et, idéalement, une transcription de référence.
- **Sections** : les frontières proposées par nouveauté spectrale sont des
  candidats. Nommer « intro / couplet / pont » est une décision musicale.
- **Reconnaissabilité** : aucune mesure ne dit si un timbre reste identifiable
  après transformation. C'est un test d'écoute, pas un calcul.

## 6. Les quatre univers

Le brief est explicite : **Détendue ne définit pas les trois autres univers.**
Chaque univers devra avoir sa propre identité d'arrangement, établie sur ses
propres références.

| Univers | Direction | Référence disponible | État |
|---|---|---|---|
| Énergétique | Electro Sega | aucune | rien à analyser |
| Dansant | Sega traditionnel | aucune | rien à analyser |
| Rêveur | Ambient créole | aucune | rien à analyser |
| Détendu | Sega Jazz / Segazz | « Détendue » — **fichiers absents** | bloqué |

**0 / 4 univers disposent d'une référence analysable.** Aucune conclusion
transversale n'est donc possible, et aucune n'est proposée.

## 7. Ce qu'il faut pour débloquer

Déposer sur Hermes, dans un répertoire quelconque :

1. `zistoire mix v0.wav`
2. `Zistwar-drums.wav`
3. `Zistwar-bass.wav`
4. `Zistwar-other.wav`

Format indifférent (WAV/FLAC/AIFF, n'importe quel taux d'échantillonnage) tant
que les quatre proviennent du **même export** : le pipeline vérifie l'alignement
et la reconstruction, et signalera lui-même toute incohérence.

Si les stems n'existent pas et que seul le mix est disponible, le dire : le
pipeline accepte `--mix` seul, et les sections 5.4/5.5 (basse, harmonie) seront
alors limitées au mix — ce qui change la valeur de l'analyse et doit être su.
