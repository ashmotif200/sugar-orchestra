# Profils musicaux — version 1

Quatre profils, un par univers. Les trois premiers sont **dérivés de références
mesurées** ; le quatrième est une **hypothèse artistique explicite**, sans référence
audio fournie.

Chaque profil est versionné (`version: 1`) et destiné à être édité depuis le Super Admin
**quand le moteur V2 saura lire ces paramètres** — pas avant. Tant que le moteur ne les
lit pas, le studio musical affiche les paramètres et refuse de les présenter comme
actifs.

Rappel de conception : le tempo n'est pas un entier mais un triplet
`(durée de mesure, temps par mesure, subdivision)`. Le même morceau se décrit en 103 BPM
ou 155 BPM selon l'unité choisie — c'est précisément l'ambiguïté qui a égaré la V1.

---

## 1. Énergétique — Electro Sega

**id :** `electro-sega` · **nom public :** Énergétique · **version :** 1
**Référence :** Ohwalawa, 51,06 s, mix −11,7 LUFS, crête −2,07 dBFS.

| Paramètre | Valeur | Provenance |
|---|---|---|
| Tempo | 135 BPM (mesuré 134,2–136,0, deux méthodes concordantes) | `pulse-energetique.json` |
| Métrique | 4/4 à subdivision **ternaire** | histogramme de phase : 43 % et 29 % sur les 2/3 et 1/3 |
| Swing | 0,688 (proche du triolet 0,667) | `groove-energetique.json` |
| Microtiming | 17,8 ms de dispersion médiane (jeu serré, 57 % des frappes à ±20 ms) | idem |
| Syncopes | 60,6 % des attaques hors temps | idem |
| Motifs | 22 motifs distincts sur 29 mesures, similarité de mesure adjacente 0,78 | idem |
| Harmonie | **pédale de fa** (F major, corrélation 0,743), cycle de 2 mesures | `reference-energetique.json` |
| Basse | présente mais **rare** : F1 44,2 Hz (MIDI 29), 199 attaques, entre à la mesure 14/28 | idem |
| Hiérarchie | percussions **8,2 dB au-dessus** de la basse (−13,2 vs −21,4 LUFS) | idem |
| Dynamique | 4,9 LU entre sections (introduction −16,3 → plateau −11,4) | `groove-energetique.json` |
| Structure | intro courte, montée par ajout de couches, plateau long, **13 mesures sans basse** | `arrangement-energetique.json` |

**Ce qui produit l'énergie** (mesuré, pas supposé) : percussion devant, basse rare donc
chaque apparition de basse est un événement, subdivision ternaire qui pousse, pédale
harmonique stable qui laisse l'énergie au rythme.

**Contraintes :** la basse est un *événement*, pas un accompagnement continu. Un profil
qui joue la basse sur toutes les mesures sonnera « rock », pas « electro sega ».

**Replis :** sans son `low` → pas de basse, et la densité percussive monte de 15 % pour
compenser le vide. Sans son à hauteur crédible → motif rythmique à la place de la
mélodie ; la pédale harmonique est alors portée par un son tenu filtré.

---

## 2. Dansant — Sega traditionnel

**id :** `sega-trad` · **nom public :** Dansant · **version :** 1
**Référence :** Tififi, 205,59 s, mix −10,1 LUFS, **true peak +0,6 dBTP**.

| Paramètre | Valeur | Provenance |
|---|---|---|
| Mesure | **2,32 s** (mesurée sur la periodicité d'enveloppe) | `reference-dansant.json`, `arrangement-dansant.json` |
| Tempo | ~155 à l'unité croche (≡ 103,4 à l'unité noire, même mesure) — **confiance moyenne** | `pulse-dansant.json` |
| Métrique | **6/8** (deux temps pointés par mesure), hypothèse étayée par la préférence 1/3–2/3 | `meter-dansant.json` |
| Percussion | **roulement continu** : 4,03 attaques/s, histogramme de phase plat | `groove-dansant.json` |
| Motifs | 10 motifs seulement sur 83 mesures, similarité adjacente **0,955** → groove quasi invariant | idem |
| Harmonie | **aucun centre tonal défendable** (meilleure corrélation 0,368 = bruit) | `reference-dansant.json` |
| Basse | **aucune** — l'archive ne contient pas de stem de basse, et le grave vient de la peau de tambour | `reference-dansant.md` |
| Hiérarchie | voix −14,3 et percussions −14,1 à égalité ; couche tonale **16,4 dB en dessous** (−30,5) | idem |
| Dynamique | 18,6 LU entre sections, mais ≈ 0 à l'intérieur du plateau | `groove-dansant.json` |
| Structure | **introduction a cappella 14 s**, entrée percussions ~11,6 s, plateau ininterrompu de 110 s, 12,8 s de silence final | `arrangement-dansant.json` |

**Ce qui rend dansant** : le roulement continu, la mesure à deux temps pointés, et
l'absence de progression harmonique — rien à anticiper, donc le corps suit. Ce n'est pas
une question de tempo : Détendu est presque au même tempo et ne danse pas.

**Contraintes :** la continuité est la signature. Un profil qui découpe la percussion en
motifs nets de 4 temps perd l'identité — il faut programmer des roulements (granulation
de frappes courtes, densité élevée), pas un kick-snare.

**Replis :** sans son percussif dense → le profil refuse de produire du Dansant et le
signale (c'est un univers qui repose entièrement sur la percussion). Sans voix → le
profil fonctionne, la couche tonale monte de 6 dB.

---

## 3. Détendu — Sega Jazz

**id :** `segazz` · **nom public :** Détendu · **version :** 1
**Référence :** Zistoire, 54,47 s, mix −14,5 LUFS, crête −1,42 dBFS.

| Paramètre | Valeur | Provenance |
|---|---|---|
| Tempo | 137 BPM (famille 132,5–137,2 ; méthode de grille et tempogramme concordants à ±3 %) | `pulse-detendu.json` |
| Métrique | 4/4 **binaire** | swing mesuré 0,463 (droit), histogramme sur les temps |
| Swing | 0,463 — très légèrement en avance, pas de shuffle | `groove-detendu.json` |
| Microtiming | 28,3 ms (jeu plus souple que l'Electro Sega : 36 % à ±20 ms) | idem |
| Syncopes | 76,4 % hors temps (le plus syncopé des trois) | idem |
| Motifs | 22 motifs sur 31 mesures, similarité adjacente **0,577** — le plus varié des trois | idem |
| Harmonie | **si mineur** (corrélation 0,762), mouvement réel d'accords | `reference-detendu.json` |
| Basse | **motrice** : A1 55,4 Hz (MIDI 33), 207 attaques, mouvements A1→D2 (quinte) | idem |
| Hiérarchie | **basse 3,8 dB au-dessus** des percussions (−19,2 vs −23,0 LUFS) ; couche « other » −17,0 devant tout | idem |
| Dynamique | 5,4 LU, avec un **creux à −18,3 LUFS** (mesures 9–10) = respiration réelle | `groove-detendu.json` |
| Structure | 30 mesures, entrées/sorties fréquentes, creux central, fin plus dense | `arrangement-detendu.json` |

**Ce qui rend détendu** : basse devant, percussions en retrait, harmonie qui bouge, et
surtout une **variation d'arrangement** (0,58 de similarité entre mesures) qui empêche
la mécanique. Le tempo n'y est pour rien : 137 BPM est plus rapide que les 135 de
l'Electro Sega.

**Contraintes :** ce profil **exige une basse**. C'est le seul des trois qui ne peut pas
exister sans elle. Or aucun son du catalogue n'est `bass_capable`.

**Replis — décision explicite :** sans basse, le profil bascule en `segazz-sans-basse` :
il conserve l'harmonie, la variation et le retrait percussif, et **déclare la limite**
dans le rapport. Il ne fabrique pas de basse synthétique. Si le propriétaire veut du
Détendu avec basse, il faut soit un son de basse dans le catalogue, soit accepter une
basse dérivée assumée comme telle (voir `transformation-strategy.md` §5).

---

## 4. Rêveur — Ambient créole

**id :** `ambient-creole` · **nom public :** Rêveur · **version :** 1
**Statut : HYPOTHÈSE ARTISTIQUE — aucune référence audio fournie.** Tous les paramètres
ci-dessous sont des propositions, pas des mesures. À valider ou remplacer dès qu'une
référence sera fournie.

| Paramètre | Valeur proposée | Justification |
|---|---|---|
| Mesure | 4,0 s (lente) | laisse respirer les textures, évite toute pulsation dansante |
| Métrique | 4/4 binaire, sans accent | rien à compter |
| Tempo perçu | ~60 BPM | sous le seuil de marche |
| Groove | aucun motif rythmique ; événements isolés | l'univers ne doit pas danser |
| Harmonie | pédale + deux hauteurs dérivées d'un même son (quinte, octave) | tenable avec 2 sons à hauteur crédible |
| Rôles | texture (dominant), atmosphère, événement rare ; **pas** de basse, **pas** de motif rythmique | le catalogue fournit 9 sons atmosphériques sur 17 |
| Densité | 0,3 événement/mesure au début, 1,2 au maximum | croissance lente |
| Structure | 3 sections : émergence, tenue, dissolution ; pas de reprise | forme ouverte |
| Dynamique | 6 LU de marge, montée lente | contraste avec les deux profils rapides |
| Mixage | réverbération longue (4–6 s), pas de compression | espace plutôt que impact |
| Variabilité | forte (0,8) : deux seeds doivent donner deux ambiances différentes | c'est l'univers de la diversité |

**Replis :** si la sélection ne contient que des sons percussifs, le profil refuse
l'univers Rêveur et propose Détendu — une ambiance ne se fabrique pas avec des frappes.

---

## 5. Matrice de décision entre profils

| | Énergétique | Dansant | Détendu | Rêveur |
|---|---|---|---|---|
| Mesure | 4/4 ternaire, 1,78 s | 6/8, 2,32 s | 4/4 binaire, 1,75 s | 4/4 très lent, 4,0 s |
| Tempo (unité noire) | 135 | ~103 (≡ ~155 croches) | 137 | ~60 |
| Basse requise | non (événement) | **non** | **oui** | non |
| Hauteur crédible requise | non | non | oui | non |
| Percussion requise | oui, dense | **oui, continue** | oui, discrète | non |
| Harmonie | pédale | aucune | progression | pédale + quinte |
| Variation | moyenne (0,78) | très faible (0,955) | **forte (0,577)** | très forte |
| Plage dynamique | 5 LU | 19 LU (sections) | 5 LU | 6 LU |

## 6. Versionnement

Chaque profil porte `version`. Un changement de paramètre incrémente la version et
s'enregistre dans la composition produite (`profileVersion`). Une composition reste
donc interprétable même si le profil évolue : on sait avec quels paramètres elle a été
écrite.
