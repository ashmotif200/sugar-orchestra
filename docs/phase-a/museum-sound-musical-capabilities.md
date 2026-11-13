# Phase A4 — capacités musicales des sons du musée

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
| Sons avec hauteur crédible (périodicité ≥ 0,75) | **5** | 40 |
| Sons utilisables comme **basse** | **0** | 40 |
| Sons « tonals » au sens spectral strict | 6 | 40 |
| Sons avec énergie dominante sous 250 Hz | 1 | 40 |

Les cinq sons à hauteur crédible sont **tous dans le médium-aigu** :

- `03_02` 03_02_Forgeron — 844.5 Hz, périodicité 0.953, bande basse 2.5 %
- `04_04` 04_04_Pioche — 522.9 Hz, périodicité 0.926, bande basse 2.8 %
- `04_09` 04_09_Cuillere_sur_fer_blanc — 722.5 Hz, périodicité 0.86, bande basse 2.2 %
- `04_08` 04_08_Fers_ouverture_fermeture — 937.0 Hz, périodicité 0.84, bande basse 9.6 %
- `07_02` 07_02_Electricite — 100.2 Hz, périodicité 0.786, bande basse 17.1 %

Le seul son dont l'énergie est massivement grave (`01_01`, volcan, 96 % sous
250 Hz) a une périodicité de **-0.052** :
c'est un grondement non périodique. Un grondement n'est pas une basse. C'est
exactement le piège que le brief signale — « un enregistrement contenant de
l'énergie basse n'est pas automatiquement une basse ».

## 3. Rôles : ce que les mesures proposent

| Rôle proposé | Nombre de sons | Règle |
|---|---|---|
| percussion | 16 | rythmique et non tonal |
| atmosphere | 18 | platitude ≥ 0,10, ou aigus ≥ 35 % avec platitude ≥ 0,1 |
| rhythmic_texture | 4 | rythmique et transitoire |
| melodic | 4 | hauteur crédible au-dessus de 220 Hz |
| transition | 2 | transitoire sans autre rôle |
| narrative_sound_event | 4 | aucun critère rempli |
| **bass** | **0** | bande basse ≥ 45 % **et** hauteur crédible ≤ 220 Hz **et** périodicité ≥ 0,85 |

Un son peut cumuler plusieurs rôles : 8 sons en cumulent au moins deux.

## 4. Faisabilité des transformations

Classification par forme mesurée (attaque 10–90 %, décroissance à −20 dB,
périodicité, platitude) :

| Forme | Sons |
|---|---|
| texture étendue | 19 |
| transient net | 14 |
| semi-périodique | 6 |
| bruit large bande | 1 |

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
| faible | 22 |
| moyen | 9 |
| élevé | 9 |

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
| `01_01` | 01_01_Volcan_eruption | 96.1 | -0.052 | 0.0 | 7.9 | 36.4 | transient net | narrative_sound_event | découpe, filtrage, enveloppe | moyen |
| `01_02` | 01_02_Foret_tropicale | 6.2 | 0.48 | 0.00014 | 834.7 | 0.2 | texture étendue | narrative_sound_event | découpe, filtrage, enveloppe | faible |
| `01_03` | 01_03_Bateau_fendant_eau | 1.3 | 0.229 | 0.09454 | 841.1 | 0.6 | texture étendue | percussion | découpe, filtrage, enveloppe | faible |
| `01_04` | 01_04_Voiles_qui_claquent | 5.5 | 0.057 | 0.17677 | 869.7 | 1.3 | texture étendue | atmosphere | découpe, filtrage, enveloppe | faible |
| `01_05` | 01_05_Pas_sur_sable | 9.8 | 0.031 | 0.04827 | 325.7 | 0.1 | texture étendue | percussion | découpe, filtrage, enveloppe | faible |
| `02_01` | 02_01_Cuillere_tasse_sucre | 0.7 | 0.659 | 0.10893 | 874.4 | 0.2 | semi-périodique | atmosphere | découpe, granulation, filtrage, enveloppe | faible |
| `02_02` | 02_02_Degustation | 12.8 | 0.879 | 0.27987 | 3.0 | 0.1 | transient net | percussion, atmosphere | découpe, transposition, granulation, filtrage, enveloppe, boucle | élevé |
| `02_03` | 02_03_Couvercle_boite_sucre | 2.7 | 0.046 | 0.41201 | 3.4 | 0.3 | transient net | atmosphere | découpe, enveloppe | élevé |
| `02_04` | 02_04_Commercants_etals | 10.9 | 0.818 | 0.01025 | 96.9 | 1.0 | semi-périodique | rhythmic_texture | découpe, transposition, granulation, filtrage, enveloppe | moyen |
| `02_05` | 02_05_Bal_causeries | 5.0 | 0.466 | 0.00206 | 633.2 | 0.2 | texture étendue | rhythmic_texture | découpe, filtrage, enveloppe | faible |
| `03_01` | 03_01_Cordonnier | 2.9 | 0.272 | 0.19032 | 0.1 | 0.8 | transient net | percussion, atmosphere | découpe, filtrage, enveloppe | moyen |
| `03_02` | 03_02_Forgeron | 2.5 | 0.953 | 0.01119 | 0.7 | 0.4 | transient net | melodic | découpe, transposition, granulation, filtrage, enveloppe | élevé |
| `03_03` | 03_03_Fondeur | 0.1 | 0.029 | 0.26173 | 935.0 | 0.2 | texture étendue | atmosphere | découpe, filtrage, enveloppe | faible |
| `03_04` | 03_04_Charpentier | 4.6 | 0.119 | 0.04313 | 725.1 | 0.2 | texture étendue | percussion | découpe, filtrage, enveloppe | faible |
| `04_01` ⚠ | 04_01_Fouet | 9.1 | 0.0 | 0.87779 | 10.6 | 0.5 | transient net | atmosphere | découpe, enveloppe | élevé |
| `04_02` ⚠ | 04_02_Fers_chaines | 1.1 | 0.593 | 0.19651 | 0.4 | 0.3 | transient net | percussion, atmosphere | découpe, granulation, filtrage, enveloppe | moyen |
| `04_03` | 04_03_Coupe_coupe_champ | 3.6 | 0.535 | 0.1505 | 2.8 | 0.2 | transient net | percussion, atmosphere | découpe, granulation, filtrage, enveloppe | moyen |
| `04_04` | 04_04_Pioche | 2.8 | 0.926 | 0.00831 | 1.5 | 0.6 | transient net | melodic | découpe, transposition, granulation, filtrage, enveloppe | élevé |
| `04_05` ⚠ | 04_05_Ayo_MAQUETTE_A_VALIDER | 38.0 | 0.891 | 0.85874 | 216.5 | 0.8 | bruit large bande | atmosphere | transposition, granulation, enveloppe | élevé |
| `04_06` | 04_06_Vent_dans_champs | 3.6 | 0.042 | 0.20914 | 108.6 | 0.0 | texture étendue | atmosphere | découpe, filtrage, enveloppe | faible |
| `04_07` | 04_07_Sucre_sibilance_SSS | 0.0 | 0.038 | 0.03064 | 717.1 | 0.2 | texture étendue | narrative_sound_event | filtrage, enveloppe | faible |
| `04_08` | 04_08_Fers_ouverture_fermeture | 9.6 | 0.84 | 0.01213 | 5.4 | 0.1 | transient net | percussion, melodic | découpe, transposition, granulation, filtrage, enveloppe | élevé |
| `04_09` | 04_09_Cuillere_sur_fer_blanc | 2.2 | 0.86 | 0.00088 | 0.1 | 0.1 | transient net | percussion, melodic | découpe, transposition, granulation, filtrage, enveloppe, boucle | élevé |
| `04_10` | 04_10_Redaction_contrat | 2.9 | 0.323 | 0.10626 | 5.9 | 0.8 | transient net | percussion, atmosphere | découpe, filtrage, enveloppe | moyen |
| `04_11` | 04_11_Doigt_encre_empreinte | 8.2 | 0.307 | 0.09724 | 1.1 | 1.4 | transient net | percussion | découpe, filtrage, enveloppe | moyen |
| `04_12` | 04_12_Drapeau_au_vent | 12.4 | 0.051 | 0.09641 | 1008.3 | 0.7 | texture étendue | percussion | découpe, filtrage, enveloppe | faible |
| `04_13` | 04_13_Canon | 21.2 | 0.0 | 0.68609 | 10.4 | 1.4 | transient net | atmosphere | découpe, enveloppe | élevé |
| `05_01` | 05_01_Canne_pousse_accelere | 4.0 | 0.772 | 0.19763 | 1000.9 | 0.3 | semi-périodique | atmosphere | découpe, transposition, granulation, filtrage, enveloppe | moyen |
| `05_02` | 05_02_Eprouvette_remuee | 2.7 | 0.594 | 0.0903 | 310.8 | 0.7 | semi-périodique | percussion | découpe, granulation, filtrage, enveloppe | faible |
| `06_01` | 06_01_Moulin_eau | 4.8 | 0.0 | 0.16481 | 286.8 | 0.6 | texture étendue | atmosphere | découpe, filtrage, enveloppe | faible |
| `06_02` | 06_02_Moulin_vent | 39.5 | 0.0 | 0.00179 | 340.7 | 0.1 | texture étendue | rhythmic_texture | découpe, filtrage, enveloppe | faible |
| `06_03` | 06_03_Moulin_vapeur | 12.2 | 0.124 | 0.14876 | 559.6 | 0.9 | texture étendue | atmosphere | filtrage, enveloppe | faible |
| `06_04` | 06_04_Charrette_boeufs | 35.6 | 0.319 | 0.00053 | 62.9 | 1.4 | texture étendue | percussion | découpe, filtrage, enveloppe | faible |
| `06_05` | 06_05_Camion | 20.9 | 0.292 | 0.00691 | 410.8 | 2.2 | texture étendue | rhythmic_texture | découpe, filtrage, enveloppe, boucle | faible |
| `06_06` | 06_06_Engrenages | 12.2 | 0.045 | 0.04437 | 201.8 | 0.8 | texture étendue | transition | découpe, filtrage, enveloppe | faible |
| `07_01` | 07_01_Bagasse_ecrasee | 11.1 | 0.125 | 0.07309 | 666.1 | 0.2 | texture étendue | transition | découpe, filtrage, enveloppe | faible |
| `07_02` | 07_02_Electricite | 17.1 | 0.786 | 0.00214 | 22.0 | 1.0 | semi-périodique | narrative_sound_event | découpe, transposition, granulation, filtrage, enveloppe, boucle | moyen |
| `08_01` | 08_01_Melasse | 30.5 | 0.422 | 3e-05 | 80.5 | 0.4 | texture étendue | percussion | découpe, filtrage, enveloppe | faible |
| `08_02` | 08_02_Jus_de_canne | 1.5 | 0.574 | 0.11496 | 310.8 | 0.9 | semi-périodique | percussion, atmosphere | découpe, granulation, filtrage, enveloppe | faible |
| `08_03` | 08_03_Chaudiere | 0.3 | 0.028 | 0.28481 | 93.2 | 0.2 | texture étendue | atmosphere | découpe, filtrage, enveloppe | faible |

## 7. Ce que le corpus ne peut pas faire

1. **Aucune ligne de basse.** Zéro son sur 40 réunit les conditions. Toute basse
   produite aujourd'hui est une transposition d'un son qui n'a pas de hauteur
   stable, ou un grondement filtré — ni l'un ni l'autre n'est une basse.
2. **Pas de matériau mélodique grave.** Les 5 sons à hauteur crédible sont entre
   100 Hz et 940 Hz. Une mélodie écrite dans ce registre sonne comme des cloches
   ou du métal frappé, pas comme un chant.
3. **Peu de matière tenue.** 0 sons seulement sont à la fois tenus et périodiques :
   les nappes devront venir de textures étirées, pas de notes tenues.
4. **Le rythme est là.** 20 sons sont percussifs ou rythmiques : c'est la ressource la plus
   solide du fonds, et elle est cohérente avec un projet Electro Sega.

## 8. Sons sensibles — état inchangé

| code | nom | drapeau |
|---|---|---|
| `04_01` | 04_01_Fouet | sensitive, availability = not_musical |
| `04_02` | 04_02_Fers_chaines | sensitive, availability = not_musical |
| `04_05` | 04_05_Ayo_MAQUETTE_A_VALIDER | sensitive, availability = not_musical |

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
