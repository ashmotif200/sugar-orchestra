# Feuille de route — moteur V2

Découpage proposé, **pas une obligation** : l'ordre suit les dépendances réelles et les
défauts mesurés, pas une numérotation décorative. Chaque étape a un critère
d'acceptation vérifiable sans oreille humaine ; l'écoute reste le juge final.

Principe directeur : **V1 reste intact et servi**. V2 est construit en parallèle derrière
un sélecteur `engine: 'v1' | 'v2'`, ce qui permet de comparer les deux sur la même
sélection et la même seed.

## V2.0 — Fondations (corrige les défauts, n'ajoute rien de musical)

| Tâche | Dépend de | Critère d'acceptation | Risque |
|---|---|---|---|
| Modèle de temps `(barSeconds, beatsPerBar, subdivision)` | — | une grille 6/8 et une grille 4/4 ternaire produisent des placements distincts et vérifiables | faible |
| Contrat de hauteur : `writtenMidi` **et** `realizedHz` | — | invariant de rendu : écart ≤ 10 cents, erreur au-delà de 50 cents | faible |
| Suppression du repli par octaves dans la transposition | contrat de hauteur | plus aucune note ne dépasse `maxSemitones` du profil (mesure : 0 sur 200 notes) | moyen — change le rendu V1 si réutilisé |
| `SoundCapability` depuis `capability-matrix.json` | composant A | 17 sons chargés, 2 `credible_pitch`, 3 `bass_capable = false` pour tous | faible |
| Attribution des rôles avec repli explicite | capacités | toute absence de rôle produit une `Limit` nommée, jamais un silence | faible |
| Sélecteur V1/V2 + même seed | — | les deux rendus coexistent, la composition stocke son `engine` | faible |

**Sortie de V2.0 :** deux moteurs comparables, plus aucune note fausse, plus aucun rôle
inventé. **Aucun gain musical audible attendu à ce stade** — c'est le socle.

## V2.1 — Composition

| Tâche | Critère d'acceptation | Risque |
|---|---|---|
| Grille + swing par profil | écart de swing mesuré ≤ 0,02 avec la référence du profil | moyen |
| Vocabulaire de motifs par univers, avec mutation | ≥ 8 motifs distincts par composition, similarité entre mesures dans la plage du profil (±0,1) | moyen |
| Forme par sections avec entrées/sorties | durée dans la plage du profil ; au moins un creux ou une montée ; rapports de couverture cohérents | moyen |
| Harmonie (pédale / progression / aucune) | pour Détendu : accord de la basse cohérent avec l'harmonie sur ≥ 90 % des mesures | élevé |
| Roulement continu (Dansant) | densité ≥ 3 attaques/s tenue sur ≥ 80 % du plateau | moyen |
| Remplissages et transitions | au moins une transition par composition, détectée par changement de densité | faible |

**Sortie de V2.1 :** une composition qui a une forme reconnaissable et un groove du bon
univers. C'est la première étape où l'écoute doit progresser sensiblement.

## V2.2 — Transformations

| Tâche | Critère d'acceptation | Risque |
|---|---|---|
| Découpe + re-déclenchement, filtres, enveloppes | aucun clic détecté (discontinuité > 6 dB en < 5 ms) sur 100 rendus | faible |
| Granulation pour les textures | artefacts mesurés en dessous du seuil ; pas de duplication de transitoire sur les sons `granular: poor` | moyen |
| Bornes par matériau appliquées | 0 dépassement de `maxStretchRatio` / `maxPitchSemitones` sur un corpus de test | faible |
| Politique de basse | aucune basse synthétique ; si `bass: none`, la limite est déclarée et visible | faible — mais décision artistique |
| Détection d'artefacts | crêtes > −1 dBTP, DC, clics signalés dans `RenderReport` | faible |

**Sortie de V2.2 :** des transformations qui enrichissent sans détruire l'identité du son.

## V2.3 — Mixage

| Tâche | Critère d'acceptation | Risque |
|---|---|---|
| Hiérarchie par univers (gains par rôle) | écart de loudness entre rôles dans ±2 dB de la cible du profil | moyen |
| Contrôle dynamique par rôle | pas de pompage détectable ; LUFS par section dans ±1,5 LU de la cible | moyen |
| Spatialisation | image stéréo stable, mono-compatible (pas d'annulation) | faible |
| Mastering | LUFS cible ±0,5 ; true peak ≤ −1,0 dBTP sur tous les rendus | faible |

**Sortie de V2.3 :** un rendu écoutable au casque et sur enceinte de musée, sans
surprise de niveau.

## V2.4 — Évaluation

| Tâche | Critère d'acceptation |
|---|---|
| Laboratoire A/B dans le Super Admin | même sélection + même seed, les deux moteurs, écoute et export depuis l'interface |
| Batterie de mesures | 10 indicateurs affichés côte à côte, aucun score unique |
| Test de diversité | 10 seeds → ≥ 6 compositions jugées distinctes à l'écoute |
| Test de reconnaissabilité | 100 % des sons sélectionnés audibles sous forme brute au moins une fois |
| Écoute humaine | grille par critère, remplie par le propriétaire du projet |

**Sortie de V2.4 :** une décision documentée de bascule V1 → V2, ou de coexistence.

## Dépendances et ordre

```
V2.0 ──► V2.1 ──► V2.2 ──► V2.3 ──► V2.4
  │                    │
  └── contrat de hauteur └── politique de basse (décision propriétaire)
```

Trois décisions appartiennent au propriétaire, pas au développement :

1. **Détendu sans basse** ou basse dérivée assumée ?
2. **Dansant** : roulement continu (fidèle, coûteux à rendre) ou motifs nets (plus
   simple, moins fidèle) ?
3. **Rêveur** : valider l'hypothèse actuelle ou fournir une référence audio.

## Critères d'évaluation (jamais un score unique)

Cohérence rythmique · forme perceptible · variation sans perte d'identité · équilibre
spectral · dynamique · qualité des transformations · reconnaissabilité de chaque son ·
diversité entre seeds · absence d'artefacts · **qualité d'écoute humaine**.

Une note globale peut accompagner ces dix lignes ; elle ne les remplace pas.
