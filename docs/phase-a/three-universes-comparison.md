# Comparaison des trois univers musicaux

Trois références mesurées avec le même pipeline. Les valeurs déjà établies lors de
la passe précédente sont **conservées avec leur provenance** ; les nouvelles
mesures sont marquées ⓝ.

| Référence | Univers | Fichiers | Analyse |
|---|---|---|---|
| **Ohwalawa** | Énergétique / Electro Sega | mix.wav + 4 stems | `reference-analysis-ohwalawa.md`, `data/reference-energetique.json` |
| **Tififi** ⓝ | Dansant / Sega traditionnel | mix.wav + 3 stems | `reference-analysis-dansant.md`, `data/reference-dansant.json` |
| **Zistoire** | Détendu / Segazz | mix.wav + 3 stems | `reference-analysis-detendue.md`, `data/reference-detendu.json` |

Degré de confiance : **A** = mesuré et corroboré par deux méthodes ; **B** =
mesuré, une seule méthode ; **C** = hypothèse argumentée, non tranchée.

---

## 1. Tableau comparatif

| Dimension | **Énergétique** (Ohwalawa) | **Dansant** (Tififi) ⓝ | **Détendu** (Zistoire) |
|---|---|---|---|
| **Tempo (pulsation)** | 135,5 / 134,2 BPM **A** | **149,8–152 BPM** **A** | 133,9 / 137,2 BPM **A** |
| Pulsation retenue pour le moteur | 135 | **150** | 134 |
| **Métrique** | 4/4, **subdivision ternaire** — 33,6 % des onsets à 1/3–2/3 contre 0,3 % à 1/2 **A** | **ternaire** — 44,7 % à 1/3–2/3 contre 8,8 % à 1/2 ; 6/8 ou 12/8 probable, 4/4 ternaire possible **B** | 4/4 **binaire**, swing 0,475 **A** |
| **Groove** | shuffle électro, percussif, dense (268 attaques/min) | cycle de sega continu, tambour + voix, 150 rapide | binaire tranquille, basse motrice, batterie effacée |
| **Basse** | **oui, sparse** : fa1 44 Hz, 95 attaques/min, entre à la mesure 14/28 | **aucune** : pas de stem, 21 % de 40–250 Hz dans le tambour | **oui, motrice** : la1 55 Hz, 210 attaques/min, 100 % du morceau |
| **Harmonie** | **pédale de fa** (fa majeur 0,743), cycle de 2 mesures à 0,96 d'accord — pas de progression **A** | **aucun centre tonal détecté** (max 0,368 = bruit), pas de cycle **B** | **si mineur diatonique** (0,762), Bm–Em–G–D–A–F#m, accords qui changent **B** |
| **Percussions** | présentes 96 %, **devant** (−13,2 LUFS, 8 dB au-dessus de la basse) | continues (médiane −20,3 dB), **à égalité avec la voix** (−14,1 vs −14,3) | présentes 100 % mais **derrière** (−23,0, 5,8 dB sous la basse), charleys aigus (centroïde 3 348 Hz) |
| **Voix** | oui (96 % du temps, −24,3 LUFS) | **oui, première** (dès 0 s, −14,3 LUFS) | non |
| **Structure** | **2 blocs** : 13 mesures sans basse puis entrée de basse à 14/28 (build & drop) | **intro voix 14 s → montée → plateau continu 110 s → arrêt → silence** | **A · creux · A' · stop · B · stop · outro**, stop-time de 1–2 mesures |
| **Dynamique (LUFS mix)** | −11,7 | **−10,1** (le plus fort) | −14,5 (le plus doux) |
| **Crête** | −2,07 dBFS | −0,32 dBFS | −1,42 dBFS |
| **Durée** | 51,1 s / 28 mesures | **205,6 s** / 128 mesures (lecture 4/4) | 54,5 s / 30 mesures |
| **Stems exacts** | 4 stems, corr 0,9999 | 3 stems, corr **0,9969** (MP3) | 3 stems, corr 1,0000 |
| **Ordre des couches** (du plus fort au plus faible) | drums **≫** percs/synths > bass > voix | voix ≈ drums **≫** other | other > bass **≫** drums |

---

## 2. Réponses aux huit questions

### Q1 — Quelles caractéristiques sont **communes** aux trois morceaux ?

1. **Pulsation entre 134 et 152 BPM.** Aucun n'est lent. La fourchette est étroite
   (facteur 1,13). Le « détendu » n'est pas un tempo lent.
2. **Percussion présente quasiment tout le temps** (96–100 %), avec des onsets
   denses (150–268 par minute selon les couches).
3. **Aucun des trois n'a de grille d'accords pop de 4 ou 8 mesures répétée à
   l'identique.** Énergétique est une pédale, Détendu varie sur un jeu diatonique,
   Dansant n'a pas de grille détectable.
4. **La forme repose sur des entrées/sorties de couches**, pas sur un enchaînement
   d'accords. Les trois font entendre un changement en ajoutant ou retirant quelque
   chose.
5. **Les trois durent 50 s ou plus** — dont un de 3 min 26. Aucun n'est une boucle
   de 36 s.

### Q2 — Ce qui différencie **Sega traditionnel** d'**Electro Sega**

| | Dansant (Tififi) | Énergétique (Ohwalawa) |
|---|---|---|
| Pulsation | **150** | 134–135 (−11 %) |
| Subdivision | ternaire, **44,7 %** aux 1/3 | ternaire aussi, **33,6 %** aux 1/3 |
| Basse | **absente** | présente mais sparse (95/min) |
| Voix | **au premier plan** (−14,3, dès 0 s) | présente mais en retrait (−24,3) |
| Couche tonale | discrète (−30,5) | percs_and_synths très présente (−19,5) |
| Harmonie | pas de centre détecté | pédale de fa |
| Forme | montée puis long plateau | build & drop en 2 blocs |

**Le discriminant n'est pas la subdivision — les deux sont ternaires.** Ce sont
**la basse** (présente/absente), **le rôle de la voix** (premier plan / second
plan) et **le tempo** (150 / 135). Un sega traditionnel se reconnaît à un tambour
qui porte tout, sans basse, avec un chant devant.

### Q3 — Ce qui différencie **Sega traditionnel** de **Sega Jazz**

| | Dansant (Tififi) | Détendu (Zistoire) |
|---|---|---|
| Pulsation | 150 | 134–137 |
| Subdivision | **ternaire** (44,7 % aux 1/3) | **binaire** (swing 0,475) |
| Basse | **absente** | **motrice, devant** (210 attaques/min) |
| Harmonie | aucune grille | **si mineur diatonique, accords qui changent** |
| Percussion | à égalité avec la voix, médiane −20,3 | **derrière**, 5,8 dB sous la basse |
| Mix | voix + drums devant | harmonie et basse devant |

**Deux différences structurelles :** le Segazz est **binaire et harmonique** (une
grille d'accords réelle, une basse qui conduit), le sega traditionnel est
**ternaire et percussif** (pas de basse, pas de grille, un tambour). Ce sont deux
esthétiques opposées, pas deux vitesses d'un même genre.

### Q4 — Qu'est-ce qui produit la **sensation d'énergie** ?

Mesures associées à l'univers le plus énergétique, par ordre de plausibilité :

1. **La percussion devant tout** : batteries à −13,2 LUFS, 8 dB au-dessus de la
   basse, 268 attaques/min. C'est la mesure la plus discriminante.
2. **La densité d'attaques par minute** (268 contre 218 pour Détendu et ~200 pour
   Dansant sur les couches rythmiques).
3. **Un master plus fort** : −11,7 LUFS contre −14,5.
4. **Le contraste dynamique en deux blocs** (13 mesures sans basse puis tout) —
   l'énergie naît du changement, pas du niveau absolu.
5. Le tempo n'est **pas** le facteur décisif : 135 (Énergétique) est plus lent que
   150 (Dansant), qui est perçu comme dansant plutôt qu'énergétique.

### Q5 — Qu'est-ce qui produit la **sensation de détente** ?

1. **Une basse devant et une batterie derrière** — l'inverse exact d'Énergétique :
   basse −19,2, batterie −23,0 (5,8 dB sous la basse).
2. **Une percussion aiguë et fine** (centroïde 3 348 Hz) : elle occupe l'air sans
   occuper le grave. Pas de grosse caisse en avant.
3. **Un master plus doux** : −14,5 LUFS, 4,4 dB sous Dansant.
4. **Une harmonie qui change** : le mouvement harmonique retient l'attention sans
   la presser.
5. **Des stop-time d'une à deux mesures** qui retirent l'harmonie sans arrêter le
   rythme.

### Q6 — Qu'est-ce qui donne **envie de danser** ?

1. **Une pulsation rapide et ternaire** (150, 44,7 % aux 1/3) : le balancement.
2. **Une percussion ininterrompue** : aucun trou pendant 110 s.
3. **Pas de basse** : rien ne stabilise le grave, donc rien ne « pose » le corps —
   le mouvement est porté par la frappe, pas par une note tenue.
4. **Une voix au premier plan** qui porte la phrase.
5. **Une entrée progressive** : 14 s de voix seule avant la percussion, ce qui
   installe l'attente.

### Q7 — Rôle des percussions, de la basse et des variations d'arrangement

| Élément | Énergétique | Dansant | Détendu |
|---|---|---|---|
| Percussions | **pilote** (devant, dense) | **pilote** (continue, à égalité avec la voix) | **accompagne** (derrière, aiguë) |
| Basse | **marque les temps**, entre tard | **absente** | **conduit** le morceau |
| Variations | entrée de basse = bascule | ajout de couches | baisses de 6–10 dB sur l'harmonie |

La conclusion transversale : **c'est la hiérarchie des couches, plus que les
motifs, qui caractérise chacun des trois univers.** Deux morceaux au même tempo
(134–135) sonnent opposés parce que la batterie est 8 dB devant dans l'un et 5,8
dB derrière dans l'autre.

### Q8 — Ce qui relève du **style** et ce qui relève de **ces morceaux**

**Probablement stylistique** (à confirmer sur d'autres titres) :
- le balancement ternaire du sega (présent dans 2 références sur 2 de sega) ;
- l'absence de basse dans le sega traditionnel ;
- la présence d'une voix au premier plan dans le sega.

**Probablement propre à ces compositions** (ne pas ériger en règle) :
- la durée de 3 min 26 de Tififi — c'est une version longue, pas une constante ;
- la pédale de fa d'Ohwalawa — une seule référence, un seul morceau ;
- le si mineur de Zistoire — un morceau, une tonalité ;
- l'intro a cappella de 14 s — un choix d'arrangement, pas un trait de genre ;
- les 12,8 s de silence final de Tififi — artefact d'export probable.

> **Avertissement explicite :** trois morceaux ne définissent pas trois genres.
> Une seule référence par univers. Tout ce qui précède est une **description de
> ces trois morceaux**, extrapolée prudemment en principes réutilisables, jamais
> en « règles du sega ».

---

## 3. Ce que la comparaison change pour le moteur

| Constat | Conséquence |
|---|---|
| Les trois tournent à 134–152, le moteur à 112 et 126 | les tempos des univers doivent être révisés (135 / 150 / 134) |
| Deux références sur trois sont ternaires, une est binaire | la grille est un paramètre d'univers, pas une constante |
| Une référence n'a pas de basse du tout | la basse doit être **facultative**, pas obligatoire |
| L'ordre des couches s'inverse entre Énergétique et Détendu | la hiérarchie de mixage est un paramètre d'univers |
| Les trois durent 50 s à 3 min 26 | 36 s est trop court pour installer une forme |
| Aucune ne répète une grille d'accords à l'identique | ne pas fabriquer de progression là où il n'y en a pas |
