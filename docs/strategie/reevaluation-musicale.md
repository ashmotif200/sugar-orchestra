# Sugar Orchestra — réévaluation musicale et changement de stratégie

**Version 2 — révisée après réception du document de cadrage**
`Sugar_Orchestra_Etat_des_lieux_et_problematiques.md` (13 novembre 2026).

Ce qui change par rapport à ma première note : le cadrage confirme le diagnostic, mais **corrige la
méthode**. Je proposais d'écrire un squelette MIDI puis un adaptateur ; le cadrage impose une étape
antérieure, plus juste : **produire d'abord une pièce réellement musicale à la main**, avec les sons du
musée, comme étalon artistique. C'est meilleur, et je m'y range. Le reste de mon apport — les preuves
tirées du code — reste valable et complète le document sur son point le plus faible : le cadrage dit
« ce n'est pas musical », il ne dit pas *pourquoi le code ne peut pas l'être*. C'est l'objet de la
section A.

Aucun code de moteur n'a été modifié. Rien n'a été déployé.

---

## A. Diagnostic

### A.1 Le code démontre l'absence de musique, indépendamment de l'écoute

J'ai instrumenté les six plans V2.1 (commit `9390397`). Résultat :

| Démo V2.1 | Événements | **Notes tonales** | Hauteurs distinctes | Durée médiane d'une note |
|---|---|---|---|---|
| Énergétique + basse | 135 | **0** | 0 | 0,12 s |
| Énergétique sans basse | 163 | **0** | 0 | 0,12 s |
| Détendu + basse | 93 | **0** | 0 | 0,15 s |
| Détendu sans basse | 95 | **0** | 0 | 0,15 s |
| Dansant | 220 | **0** | 0 | 0,11 s |
| Rêveur | 15 | **0** | 0 | 4,00 s (nappes) |

**Zéro note de hauteur, sur six démonstrations, dans quatre univers.** Le moteur n'a jamais produit une
seule note de mélodie ni un seul accord. Ce n'est pas un jugement esthétique : c'est un comptage.
Une partition sans hauteurs ne peut pas contenir de phrase, d'harmonie, de tension ni de résolution —
les propriétés mêmes que P1 et P5 décrivent comme manquantes. Le jugement du porteur du projet n'est
pas une impression subjective : il constate une absence structurelle.

### A.2 Trois défauts de code, précis, chacun corrigeable

**D1 — La mélodie est supprimée en silence.** Les deux seuls sons à hauteur crédible du catalogue,
`04_09` (722,5 Hz) et `07_02` (100,2 Hz), sont bien affectés au rôle `melody`. Mais le planificateur
vise une racine à MIDI 65 (Fa4, héritée du profil) quand l'ancre réelle de `07_02` est MIDI ≈ 43 :
22 à 31 demi-tons d'écart, très au-delà du budget de ±7. Chaque tentative est rejetée **sans limite
émise, sans fallback, sans trace**. Les deux notes étiquetées « mélodie » dans les plans sont des notes
de couverture à `writtenMidi: null`. Le rôle existe dans le type ; il est vide à l'exécution.

**D2 — La basse est une pédale d'une seule note.** La démo Énergétique contient **MIDI 45, quarante-neuf
fois**. Le registre est borné à `[33, 45]` et toutes les fondamentales calculées (53, 60, 65) sont
écrêtées au plafond. Ce n'est pas une ligne de basse. Le contrôleur harmonique annonce « pédale du
profil » : il n'a jamais l'occasion de faire entendre un mouvement.

**D3 — La répétition est littérale.** Deux motifs, dont un couvre **12 mesures sur 20** ; sur 15
variations, **13 sont de type `keep`**. Courbe d'énergie plate (0,43–0,49) dès la quatrième mesure.
Le moteur sait placer ; il ne sait pas développer.

À quoi s'ajoute un point de méthode : D1 et D2 sont des **échecs silencieux**. Le moteur savait qu'il
ne produisait pas de mélodie — il ne l'a jamais dit. C'est exactement ce qui a permis à 22 tests verts
de coexister avec des morceaux vides.

### A.3 Le matériau ne peut pas porter l'harmonie (P3, P4)

Mesures Phase A3 : **0 son sur 40** est `bass_capable`, **5 sur 40** ont une hauteur crédible. Les
enregistrements sont des ambiances de terrain de 20 s. Ce sont des bruits, pas des instruments. Aucun
moteur ne construira une progression harmonique à partir de cela. C'est la contrainte structurante du
projet, et elle n'a jamais été traitée : la basse synthétique est un pansement sur une lacune qui
touche aussi la mélodie et l'accompagnement.

### A.4 Ce que le code ne peut pas trancher (nécessite l'écoute)

Je n'ai pas écouté les fichiers et je ne prétends pas savoir comment ils sonnent. Restent ouverts :
qualité du groove malgré un motif unique ; masquage éventuel des percussions par les nappes ;
acceptabilité du timbre de basse ; reconnaissance des samples sous transformation ; et le fait que les
versions avec et sans basse soient **réellement distinguables à l'oreille** (les fichiers diffèrent —
empreintes et LUFS différentes — mais l'écart mesuré après correction est de 0,3 dB sur Énergétique,
ce qui peut être inaudible).

### A.5 Correspondance avec les problématiques du cadrage

| Cadrage | Ce que le code ajoute |
|---|---|
| P1 séquenceur ≠ compositeur | **prouvé** : 0 note tonale, 90 % d'attaques de percussion |
| P2 statistiques ≠ intention | corroboré : les 399 motifs encodent *quand* frapper, jamais *quoi* jouer |
| P3 sons non interchangeables | corroboré : 0/40 basse, 5/40 hauteur crédible |
| P4 fondation harmonique insuffisante | **prouvé** : basse monotone (D2), mélodie vide (D1) |
| P5 structure formelle insuffisante | prouvé : énergie plate, sections étiquetées mais non ressenties |
| P6 langages musicaux différents | partiellement traité : Dansant en roulement continu, les trois autres non |
| P7 contrat créatif contradictoire | **non tranché** — voir F, décision 1 |
| P8 reconnaissabilité vs personnalisation | non mesuré — aucune écoute comparative n'existe encore |
| P9 validation dans le mauvais ordre | **c'est l'explication de tout le reste** |
| P10 inertie | risque réel : les outils sont bons, la stratégie musicale est mauvaise |

---

## B. Inventaire

Aligné sur le tableau §7 du cadrage, avec mon avis technique :

| Composant | Décision | Précision |
|---|---|---|
| Parcours visiteur, QR, catalogue, fiches éditoriales | **conserver** | indépendant du compositeur ; vérifié fonctionnel (fiche « Volcan ») |
| Originaux WAV, licences, provenance | **conserver impérativement** | jamais touchés depuis le début |
| Super Admin, laboratoires, A/B, loudness matching | **conserver** | outil d'écoute — c'est là que se jouera la validation |
| Rendu serveur, plans, métadonnées, stockage, file bornée | **réutiliser** | ingénierie saine, à garder quel que soit le compositeur retenu |
| Analyses V2.0.5 (tempo, mètre, sections, densité, dynamique) | **conserver comme contraintes** | utiles pour borner un arrangement ; sans valeur de composition |
| Synthétiseur de basse | **optionnel** | bon outil, à condition qu'on lui donne une ligne écrite |
| Planificateur V2.1 par motifs | **geler** | ne pas étendre ; D1–D3 montrent qu'il ne peut pas produire de musique |
| 399 motifs, courbe d'énergie, rôle `melody` | **réduire ou retirer** | décoration statistique, rôle vide |

**Ce qui manque et qu'aucun module existant ne peut fournir :** un modèle de hauteurs (mélodie,
harmonie, conduite de voix) et une forme musicale *écrite*. Il faut l'apporter de l'extérieur.

---

## C. Comparaison des quatre approches

| | **A. Algorithmique** | **B. Arrangements préparés** | **C. Hybride** | **D. IA générative** |
|---|---|---|---|---|
| Plafond musical | moyen, seulement avec une vraie théorie écrite | **élevé** | **élevé** | élevé en apparence, imprévisible |
| Délai vers un résultat écoutable | 3–6 mois, issue incertaine | **jours** | 1–2 semaines | 2–4 semaines + matériel |
| Personnalisation | élevée en théorie | moyenne | **élevée et contrôlable** | faible, non garantie |
| Intégration des sons du visiteur | native | à construire | **native** | faible |
| Matériel | CPU | aucun | léger | GPU (absent) |
| Droits | aucun | **à clarifier (P7)** | à clarifier sur la partie préparée | variable |
| Reproductibilité | parfaite | parfaite | parfaite | faible |
| Risque principal | refaire ce qui vient d'échouer, en plus gros | morceaux interchangeables | complexité de l'adaptateur | aucune preuve d'intégration des samples |

**Ce que le cadrage apporte et que je sous-estimais :** l'approche B n'est pas seulement la plus
rapide, elle est **la seule qui produise un étalon**. Une pièce faite à la main révèle quels rôles les
sons du musée peuvent réellement tenir (P3) — information qu'aucune analyse ne donnera. C'est un
argument décisif en sa faveur, au-delà de la vitesse.

**Ce que je maintiens :** A est la voie que nous avons suivie ; elle a échoué faute de compétence de
compositeur dans l'équipe, pas faute d'effort. D ne peut pas garantir qu'un sample imposé soit respecté,
et le matériel n'existe pas.

---

## D. Recommandation

**Adopter la méthode du cadrage (§9), qui est un hybride C dont l'étalon est produit à la main.**

L'ordre importe plus que le contenu :

1. **Une pièce de référence, à la main, avec les sons du musée.** Pas un squelette MIDI théorique :
   une vraie pièce de 30–60 s, Electro Sega, faite avec 8 à 12 sons de la collection. Elle sert de
   plafond artistique et de révélateur de rôles. **Rien n'est codé avant qu'elle convainque.**
2. **La même pièce, avec une autre collection.** Si la musicalité s'effondre, l'approche est morte —
   et on l'aura appris pour le prix de deux morceaux, pas d'un moteur.
3. **Seulement ensuite, l'automatisation** de ce qui a été fait à la main : c'est un problème
   d'affectation et de transformation, donc d'ingénierie, donc soluble.

Cette recommandation a une conséquence que je veux explicite : **elle déplace la valeur du code vers la
partition.** Le moteur n'aura plus à *composer* — il aura à *adapter*. C'est la seule répartition que
notre équipe peut tenir, et c'est aussi celle qui rend la personnalisation crédible : le visiteur
choisit un trajet dans un matériau écrit, au lieu de tirer des nombres.

**Coût :** un musicien ou un producteur pour une pièce (quelques jours), plus l'adaptateur. Aucune
nouvelle infrastructure : rendu, API, laboratoire et chaîne éditoriale restent en place.

**Ce qu'elle abandonne :** l'idée que l'analyse produirait de la musique. Les 3 330 événements et les
399 motifs restent des données descriptives utiles ; ils ne composeront jamais.

---

## E. Prototype minimal

**Périmètre : Énergétique / Electro Sega uniquement, 30–60 s.**

### Étape 0 — Choisir les sons (½ journée)

Huit à douze sons, en respectant la consigne du cadrage : au moins un percussif, un long/textural, un
difficile à intégrer (le son narratif). À partir de la matrice de capacités, on sait déjà que **seuls
`04_09` et `07_02` peuvent porter une hauteur** : la pièce doit être écrite en sachant que la mélodie
sera portée par la basse synthétique ou par un instrument ajouté, pas par les samples.

### Étape 1 — Écrire la pièce à la main (le seul vrai test)

- Outil : un DAW, ou un assemblage manuel que je peux produire si vous préférez que je le fasse ici.
- Matériau : les sons choisis, la basse synthétique existante si elle convient.
- Contenu attendu : un groove identifiable, une phrase qui revient modifiée, une montée, une
  conclusion qui conclut.
- **Critère d'arrêt : si cette pièce ne convainc pas, on arrête avant d'écrire une ligne d'adaptateur.**

### Étape 2 — La même pièce, autre collection (½ journée)

Remplacer les sons par une autre sélection et vérifier que ça tient. C'est le test de
personnalisation du cadrage (P8), et il est plus dur que le premier.

### Étape 3 — Automatiser ce qui a été fait à la main (1–2 semaines)

Adaptateur : mapping piste → son, transposition dans les bornes mesurées, gestion des non-tonals
(percussion, texture), hiérarchie des couches d'après les mesures A3, blocs de variation choisis par le
visiteur.

### Grille d'écoute (identique au cadrage)

1. Musicalité · 2. Groove · 3. Cohérence · 4. Arrangement · 5. Intégration des sons du musée ·
6. Reconnaissance des samples · 7. Identité stylistique · 8. Personnalisation audible ·
9. Envie de réécouter — échelle 1–5, **au moins une personne ayant une pratique musicale**.

### Métriques de sanité (nécessaires, jamais suffisantes)

Contenu tonal > 0, au moins 3 accords distincts, mélodie d'au moins 5 hauteurs, blocs de variation
discernables, true peak ≤ −1 dBTP. Ces chiffres disent que le morceau *contient* de la musique ; ils ne
disent pas qu'elle est bonne. C'est précisément l'erreur qui nous a coûté trois versions.

---

## F. Décisions ouvertes

Fusion des questions du cadrage (§10) et des miennes, avec ma recommandation et la conséquence de
chaque option.

| # | Question | Ma recommandation | Si l'on choisit l'autre option |
|---|---|---|---|
| 1 | **Liberté musicale** : autorise-t-on des instruments/accompagnements précomposés en plus des sons et de la basse ? | **Oui, explicitement et par écrit** — c'est la condition de la musique. Le contrat devient : « les sons du visiteur sont la signature ; le matériau musical est écrit ». | Sans cela, il ne reste que A, qui a échoué, ou D, sans matériel. |
| 2 | Rôle de la collecte : tous les sons utilisés ? | **Tous présents, mais pas tous au même plan** : signature, ostinato, accent, texture, transition. Un son peut n'apparaître qu'une fois, à un endroit signifiant. | « Tous à chaque mesure » reproduit le bruit ; « tous obligatoires au premier plan » tue la musique. |
| 3 | Part de personnalisation essentielle | **Arrangement + instrumentation + ordre des blocs.** Audible et borné. | Une simple sélection de sons ne suffira pas à distinguer deux visiteurs (P8). |
| 4 | Qui valide la musicalité | **Vous, plus une oreille musicale.** Pas l'équipe technique seule. | Nous revivons P9 : des tests verts sur des morceaux vides. |
| 5 | Droits des références et des bases musicales | **Analyse uniquement pour les références** ; licence écrite pour toute base réutilisée. | Un prototype non documenté ne pourra pas passer en production. |
| 6 | Contraintes de restitution (casque, enceintes du musée) | **À trancher avant le mixage** : un morceau mixé au casque peut s'effondrer sur enceintes. | Mixer deux fois. |
| 7 | Ambition Muséomix V0.1 | **Expérience robuste à arrangements guidés**, pas composition autonome. | La composition autonome est un projet de recherche, pas une livraison de musée. |
| 8 | Rêveur | **Le définir ou l'assumer comme « textures + voix parlée »** ; sans référence, il restera vide. | Un univers sur quatre restera non livrable. |

---

## G. Ce que je propose d'arrêter, et ce que je propose de faire ensuite

**Arrêter :** étendre le planificateur V2.1 ; produire de nouvelles analyses ; considérer un test vert
comme une preuve de musicalité ; défendre l'architecture par son volume.

**Faire, dans cet ordre :**

1. Vous tranchez la décision 1 (liberté musicale) — tout le reste en dépend.
2. Choix des 8 à 12 sons de l'étalon (je peux le proposer sur la base des capacités mesurées).
3. Production de la pièce de référence — à la main, avec écoute critique à chaque étape.
4. Deuxième collection sur la même base.
5. Seulement là : adaptateur, puis généralisation aux autres univers.

**Ce que je peux faire immédiatement, sans attendre :** proposer la sélection de sons et un plan de
pièce (grille d'accords, forme, rôles, points d'entrée des samples) pour que la production manuelle
parte d'une intention plutôt que d'une page blanche. C'est un document, pas du code.

---

## Note factuelle

- Le fichier `v21.zip` mentionné dans le cadrage **n'est pas présent sur le disque** (recherche sur tout
  le système). En revanche les **six** WAV existent dans `/workspace/download/sugar-audio/v21-demos/`,
  y compris `v21-energetique-sans-basse-seed20261122.wav` absent de l'archive transmise. Les six
  empreintes SHA-256 sont distinctes : les versions avec et sans basse ne sont pas des doublons.
- Les mesures de la section A sont reproductibles : `node scripts/v2/analyze-layers.mjs` et lecture des
  `*.plan.json` du dossier de démonstrations.
