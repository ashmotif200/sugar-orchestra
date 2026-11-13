# V2.0.5 — Music Structure Intelligence

Analyse événementielle de trois références, pour alimenter le compositeur V2.1.
**Aucun moteur n'a été modifié** (V1, V2.0 intacts). Aucun stem, aucun original touché.

## Reproduire

```bash
PY=/opt/data/tools/sugar-audio/renv/analysis/bin/python

# 1. événements, cellules, motifs, interactions, transcription
$PY scripts/v2/analyze-events.py --ref energetique \
  --grid '{"barSeconds":1.778,"beatsPerBar":4,"subdivision":3}' \
  --stems '{"drums":"…/ohwalawa_Energetique_drums.mp3","bass":"…_bass.mp3","vocals":"…_vocals.mp3","percs_and_synths":"…_percs_and_synths.mp3"}' \
  --out docs/v2.0.5/data
# idem dansant (2.322 / 6 / 3, 3 stems) et detendu (1.752 / 4 / 2, 3 stems)

# 2. modèles de style + contrôles + audio de vérification
$PY scripts/v2/build-style-models.py --build
$PY scripts/v2/build-style-models.py --check
```

## Méthode, et pourquoi ces choix

| Choix | Raison |
|---|---|
| `backtrack=False` | avec backtrack, chaque attaque est décalée vers le minimum d'énergie précédent : 30–65 ms de faux microtiming mesurés en Phase A3 |
| grille fournie en argument | sur Tififi, aucun pouls discret n'est identifiable : la grille est une hypothèse de profil, pas une sortie de tracker |
| trois niveaux de confiance | `confirmed` / `musically_plausible` / `ambiguous` — rien n'est promu en « note » sans preuve |
| pyin à fenêtre 4096 pour la basse | une fondamentale à 44 Hz ne tient pas dans 2048 échantillons à 22 kHz |
| interactions = corrélations | une coïncidence mesurée n'est pas une intention musicale |

## Résultats mesurés

| | Énergétique | Dansant | Détendu |
|---|---|---|---|
| Mesures / sections | 28 / 7 | 128 / 22 | 30 / 7 |
| Événements détectés | 644 | 2 160 | 526 |
| Motifs (cellules) | 86 | 240 | 73 |
| Variations de motif | 34 | 31 | 40 |
| Densité percussive | 7,79 / mesure | **11,44 / mesure** | 6,29 / mesure |
| Motif de percussion dominant | `x.....x....x` (6×) | roulement quasi plein (69 cellules) | `xxxx.xxx` (7×) |
| Basse | 131,8 attaques/min, IOI 0,36 s | **absente** | **215,9/min, IOI 0,232 s, staccato 0,07** |
| Basse × percussions | 75 % de coïncidence (lift 2,11) | — | 67,9 % (lift 2,37) |
| Basse × couche tonale | 23,2 % (lift 0,87) | — | **50,5 % (lift 2,55)** |
| Notes tonales confirmées | 17 (voix) + 2 (basse) | 13 (voix) + 3 (other) | 4 + 4 |

### Ce que ça change pour V2.1

1. **Le motif dominant de l'Electro Sega n'est pas dense** : `x.....x....x` sur 12 pas, soit trois frappes par mesure, pas douze. La densité mesurée (7,79) vient des autres couches. Un compositeur qui remplit la grille rate la signature.
2. **La basse de Détendu est liée à l'harmonie, pas aux percussions** : lift 2,55 contre 2,37, et 50 % de coïncidence avec la couche tonale. C'est le seul profil où la basse dialogue avec l'harmonie — argument fort pour le Bass Synthesis Engine.
3. **La basse d'Electro Sega est un renfort de kick** : 75 % de coïncidence avec la batterie, lift 2,11, IOI court et staccato 0,24. Elle marque le rythme, pas l'harmonie.
4. **Dansant n'a pas de motifs discrets à extraire** : 11,44 attaques par mesure et 69 cellules distinctes, c'est un roulement. La seule « règle » transposable est la densité et la continuité.
5. **Le nombre de variations suit l'inverse de l'énergie** : 31 variations pour Dansant (le plus invariant), 40 pour Détendu (le plus varié) — cohérent avec les similarités de mesure de la Phase A3 (0,955 vs 0,577).

## Limites, et ce qui exige une oreille humaine

- **Transcriptions tonales** : 114 à 122 segments « ambigus » par stem de basse. La hauteur de basse n'est pas fiable dans ce matériau (MP3, fondamentales à 44–55 Hz) ; le profil **rythmique** l'est. Ne pas utiliser les hauteurs de basse comme vérité.
- **Tififi** : 651 + 794 segments ambigus, aucune harmonie fiable. Aucun accord ne doit être généré pour cet univers.
- **Rôles** : `drums` / `bass` / `other` sont des noms de fichiers. Aucun instrument n'est confirmé.
- **Interactions** : mesures de coïncidence, pas des intentions.
- **Validation perceptive** : je n'ai pas écouté les fichiers de vérification. Les mixes `*-drums-with-click.wav` sont là pour que **vous** jugiez l'alignement — je ne prétends pas l'avoir fait.

## Fichiers d'écoute

`docs/v2.0.5/validation/audio/` — un clic 1 kHz sur chaque temps, aligné sur la grille du profil, superposé au stem percussif (percussions à 75 %, clic à 50 %). Si le clic « flotte » par rapport aux frappes, la grille est fausse : c'est le test le plus rapide de toute l'analyse.

## Prêt pour V2.1

| Donnée | Fiabilité | Usage |
|---|---|---|
| Grille (mesure / temps / subdivision) | haute | oui, directement |
| Densité par section et par rôle | haute | oui |
| Cellules rythmiques + occurrences | haute | oui (motifs de départ) |
| Variations (ajout / retrait, distance 1–2) | moyenne | oui, comme vocabulaire |
| Comportement rythmique de basse (IOI, position, articulation) | haute | oui, pour le futur synthé |
| Sections / entrées de couches | haute | oui |
| Hauteurs de basse | **faible** | non |
| Harmonie de Dansant | **nulle** | non — ne rien générer |
| Hauteurs de voix | moyenne (17–75 plausibles) | avec prudence, phrases courtes |

Contrats TypeScript : `src/engine-v2/contracts-v205.ts` (types seuls, aucun moteur modifié).
