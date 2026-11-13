# Phase A5 — proposition d'évolution du moteur (Phase B)

**Aucune ligne de code du moteur n'a été modifiée.** Ce document propose ; il
n'implémente pas. Le moteur actuel reste la référence de travail : il compile,
il se construit, il fonctionne (vérifié le 13/11 — voir §7).

Le diagnostic ci-dessous s'appuie sur deux jeux de preuves :
les mesures des 40 sons (`museum-sound-musical-capabilities.md`) et la lecture du
moteur (`src/engine/plan.ts`, `roles.ts`, `universes.ts`, `render.ts`).

---

## 1. Constat : pourquoi le résultat musical ne convainc pas

Ce n'est pas un problème de goût. C'est un problème de **matière première
annoncée comme autre chose que ce qu'elle est**.

### 1.1 Le corpus n'a pas de basse — et le moteur en fabrique quand même une

Mesuré : **0 son sur 40** ne peut servir de basse (bande basse ≥ 45 %, hauteur
crédible, périodicité ≥ 0,85). Le seul son réellement grave (`01_01`, volcan,
96 % d'énergie sous 250 Hz) a une périodicité de **−0,05** : c'est un grondement.

Or `roles.ts` n'exige qu'une chose pour admettre un son en basse ou en mélodie :

```ts
if (role === 'bass' || role === 'melody')
  list = list.filter((s) => s.analysis.f0Hz !== null)
```

`f0Hz` est renseigné pour **31 sons sur 40** par l'analyseur embarqué. Sur ces 31,
**5 seulement** ont une hauteur crédible au sens mesuré. Le moteur recrute donc
26 sons pour des rôles de hauteur sur la foi d'un pic spectral, pas d'une hauteur.

### 1.2 La transposition par taux replace silencieusement la note 2 à 3 octaves plus haut

`rateFor()` replie le rapport de transposition dans `[0,45 ; 2,1]` par
doublements successifs :

```ts
while (rate > 2.1) rate /= 2
while (rate < 0.45) rate *= 2
```

Conséquence chiffrée, cible de basse = ré2 (73,42 Hz) :

| Source | f0 mesuré | taux calculé | hauteur réellement jouée | écart à la cible |
|---|---|---|---|---|
| `03_02` Forgeron | 844,5 Hz | 0,696 | **587,4 Hz** | **+36 demi-tons** |
| `04_08` Fers ouverture | 937,0 Hz | 0,627 | **587,4 Hz** | **+36 demi-tons** |
| `04_09` Cuillère fer blanc | 722,5 Hz | 0,813 | **587,4 Hz** | **+36 demi-tons** |
| `04_04` Pioche | 522,9 Hz | 0,562 | **293,7 Hz** | **+24 demi-tons** |
| `07_02` Électricité | 100,2 Hz | 0,733 | 73,4 Hz | 0 ✔ |

La partition demande une basse à 73 Hz ; l'audio joue 587 Hz. Les sons marqués
`bass` dans le catalogue ne sont pas mieux lotis : `04_05` et `08_01` sonnent
**une octave au-dessus** de la note écrite. Rien dans le rapport final ne le
signale.

C'est la cause mécanique la plus probable de la déception musicale : la pièce
n'a pas de grave, et les « notes » de basse sont des métaux transposés dans le
médium.

### 1.3 Ce que le corpus peut réellement faire

| Ressource | Mesure | Conséquence d'arrangement |
|---|---|---|
| Percussion franche | 16 sons percussion + 4 textures rythmiques | le rythme est **la** matière solide |
| Textures étendues | 19 sons « texture étendue », décroissance ≥ 500 ms | nappes, grain, souffles : possible |
| Hauteur crédible | 5 sons, tous entre 100 et 940 Hz | mélodie de cloches/métal, jamais de chant grave |
| Transitoires nets | 14 sons, attaque ≤ 15 ms | frappes crédibles, mais fragiles à l'étirement |
| Bruit large bande | 1 son | à garder brut ou en enveloppe |

---

## 2. Propositions, par priorité

Chaque proposition est notée : bénéfice musical, complexité, risque, critère
d'acceptation.

### P0 — Filtrer les rôles de hauteur par périodicité, pas par `f0Hz`
**Bénéfice : élevé. Complexité : faible. Risque : faible.**

Ajouter `periodicity` à l'analyse du catalogue (mesurée hors-ligne, reproductible :
`scripts/phase-a/analyze-corpus.py`) et n'admettre en `bass`/`melody` que les sons
où `periodicity ≥ 0,75` **et** `voicedRatio ≥ 0,30`.

Effet immédiat : le moteur cesse de prétendre faire de la mélodie avec du bois
qu'on scie. Quand aucun candidat n'existe, le code a **déjà** le comportement
honnête (`limits.push('Aucun son tonal dans cette sélection…')`) : il suffit de le
laisser s'exprimer.

*Acceptation* : aucune pièce ne contient de rôle `bass` ou `melody` alimenté par
un son de périodicité < 0,75 ; une sélection sans son crédible produit une pièce
sans basse ni mélodie, et l'affiche.

### P1 — Rendre l'octave repliée visible et bornée
**Bénéfice : élevé. Complexité : faible. Risque : faible (comportement change).**

Deux changements dans `rateFor()` :
1. refuser la note si l'écart à la cible dépasse **±12 demi-tons** après repliement,
   au lieu de la jouer faux ;
2. exposer l'écart résiduel dans le score (`centsOff`) pour que le révélateur
   puisse dire « adaptation : +3 demi-tons ».

*Acceptation* : pour chaque événement `bass`/`melody`, la hauteur réalisée est à
moins de 50 cents de la cible, ou l'événement n'est pas émis.

### P2 — Assumer un arrangement percussif quand il n'y a pas de hauteur
**Bénéfice : très élevé. Complexité : moyenne. Risque : artistique (à valider).**

Aujourd'hui les trois compositeurs sont bâtis autour d'une basse et d'un motif
mélodique. Avec ce corpus, la musique doit se construire sur : frappes,
interlocking rythmique, densité, textures filtrées, dynamique de couches.

Concrètement : un compositeur « groove-led » où la section est définie par
l'entrée/sortie de couches rythmiques (kick seul → kick + shaker → tout → break),
et où la mélodie est un **timbre** qui se déplace, pas une ligne de notes.

*Acceptation* : une pièce de 4 sons non hauteurés contient 0 événement mélodique,
possède au moins 3 changements de densité mesurables, et reste reconnaissable
(passe des signatures intactes).

### P3 — Choisir les tranches par mesure, pas au hasard
**Bénéfice : moyen-élevé. Complexité : faible. Risque : faible.**

`sliceOffset()` tire un offset parmi les onsets détectés. On dispose maintenant,
par son, d'une **meilleure région de 2 s** (`best_region` : la fenêtre la plus
tonale et la plus tenue, mesurée). Utiliser cette fenêtre pour les couches de
soutien, et l'attaque la plus forte pour les frappes.

*Acceptation* : aucune tranche de soutien ne démarre dans une zone dont l'énergie
est à plus de 6 dB sous le maximum du son.

### P4 — Politique de transformation par son, déduite de sa forme
**Bénéfice : moyen-élevé. Complexité : moyenne. Risque : moyen.**

Les mesures donnent, pour chaque son, ce qu'il supporte : `transient net` (14),
`texture étendue` (19), `semi-périodique` (6), `bruit large bande` (1).
Interdire explicitement :
- étirement et granulation sur un `transient net` (son identité est l'attaque) ;
- filtrage sur un `bruit large bande` (l'identité est la largeur spectrale) ;
- transposition hors d'un son à périodicité < 0,75.

*Acceptation* : aucune violation des contraintes ci-dessus dans le score produit ;
les 9 sons à risque de reconnaissabilité élevé apparaissent au moins une fois
**bruts** (invariant 2 déjà en place).

### P5 — Quatre identités d'arrangement réellement distinctes
**Bénéfice : moyen. Complexité : moyenne. Risque : faible.**

État lu dans le code : trois compositeurs existent (`composeElectroSega`,
`composeAmbient`, `composeSegaTrad`). `segazz` — l'univers « Détendu », celui de
la référence — **n'a aucun compositeur** et est marqué `available: false`.
`ambient-creole` a un compositeur mais est aussi marqué indisponible.

Deux incohérences à trancher, plus une remarque de mesure : `sega-trad` annonce
« 6/8 · 126 » : vérification faite, l'implémentation est cohérente — `barSec =
6 × 60 / (bpm × 2)` avec une grille de croches (`at8`). Les trois compositeurs
utilisent d'ailleurs trois grilles différentes (double-croches en 4/4 pour
l'electro, mesures pour l'ambient, croches en 6/8 pour le séga), ce qui est la
bonne façon de donner une identité à chaque univers. Rien à corriger ici.

Les deux vrais écarts sont : `segazz` n'a **aucun compositeur** (et c'est
l'univers de la référence manquante), et `ambient-creole` possède un compositeur
tout en étant marqué `available: false` — un univers entier est donc écrit mais
inatteignable par le visiteur.

*Acceptation* : chaque univers disponible possède un compositeur, et la métrique
annoncée dans l'interface correspond à celle du code.

### P6 — Variation contrôlée plutôt qu'aléatoire
**Bénéfice : moyen. Complexité : faible. Risque : faible.**

Le déterminisme est déjà bon (graine = univers + identifiants triés). La variation
vient de `pick(rng)` pour les offsets. Proposition : remplacer le tirage uniforme
par des **variantes bornées** d'un motif (transposition de 0/±1 degré, décalage
d'un demi-temps, omission d'une note), ce qui produit de la variété musicale au
lieu de la variété statistique.

*Acceptation* : deux sélections différentes produisent des pièces différentes ;
la même sélection rejoue à l'identique (écart < 1e-6, déjà vérifié aujourd'hui).

---

## 3. Le problème de la basse : décision artistique, pas technique

Aucune des propositions ci-dessus ne crée un grave qui n'existe pas. Quatre
options, avec leur coût et leur honnêteté :

| Option | Ce que ça donne | Coût | Risque d'honnêteté |
|---|---|---|---|
| **A. Assumer l'absence de basse** (P2) | pièce percussive/texturale, crédible | faible | aucun — et la pièce peut être très bonne |
| **B. Fabriquer un sub par filtrage résonant** d'un son grave du visiteur (grondement du volcan) | un grave tenu, mais **non reconnaissable** comme le son d'origine ; ce n'est plus « le son du visiteur », c'est un filtre | moyen | **élevé** — à faire valider, et à afficher comme adaptation |
| **C. Enregistrer 2–3 sons graves au musée** (bagasse dans un broyeur, chaudière, moteur) | une vraie basse, reconnaissable, et un vrai son du musée | terrain | aucun — c'est la seule voie qui satisfait à la fois le grave et l'invariant |
| **D. Autoriser un instrument externe** | une basse immédiate | nul | **viole la contrainte artistique fondamentale** — exclu sans autorisation explicite |

Recommandation : **A** pour la démonstration, **C** comme cible de production.
**B** seulement si l'équipe l'assume explicitement à l'écran ; **D** hors sujet.

---

## 4. Ce qui doit rester invariant

1. `usedSourceIds ⊆ selectedSourceIds` — inchangé.
2. `selectedSourceIds ⊆ recognizableSourceIds` — la passe de signature brute
   reste obligatoire, avec ducking des lits. Les propositions P4/P6 ne doivent
   jamais la contourner.
3. Aucun échantillon externe. Les références musicales restent **analytiques**.
4. Les 3 sons sensibles restent exclus, quelle que soit la sélection.
5. Le déterminisme : même sélection → même pièce.

---

## 5. Complexité et priorités

| Priorité | Proposition | Complexité | Bénéfice attendu | Quand |
|---|---|---|---|---|
| **P0** | Rôles filtrés par périodicité | faible (analyse hors-ligne + 1 condition) | supprime les fausses mélodies | avant toute autre |
| **P1** | Octave bornée et visible | faible | supprime les notes fausses | avec P0 |
| **P2** | Compositeur groove-led | moyenne | **le plus gros gain musical** | cœur de Phase B |
| **P3** | Tranches mesurées | faible | moins de boue, plus de présence | avec P2 |
| **P4** | Transformation par forme | moyenne | évite de détruire les sons | après P2 |
| **P5** | 4 identités d'univers | moyenne | cohérence produit | après références |
| **P6** | Variation bornée | faible | variété musicale | dernier |

Ordre proposé : **P0 + P1** (une journée, corrige les défauts démontrés),
puis **P2 + P3** (le vrai travail musical), puis **P4**, **P5**, **P6**.

---

## 6. Risques

| Risque | Probabilité | Effet | Mitigation |
|---|---|---|---|
| P2 change l'identité sonore du projet | moyenne | le résultat plaît moins qu'attendu | écoute A/B avec un musicien avant de généraliser |
| Aucune référence Segazz disponible | **certaine** | P5 ne peut pas être fondé sur une analyse | livrer P0–P4 d'abord, qui n'en dépendent pas |
| La mesure de périodicité se trompe sur un son | faible (calibrée) | un bon son écarté | garder un mode « forcer le rôle » pour la curation |
| Repli d'octave jugé acceptable par l'équipe | faible | on garde des notes fausses | P1 le rend au moins visible |
| Régression de l'invariant 2 | faible | la démo perd sa preuve | self-test `?selftest=1` en garde |

---

## 7. État de la base de travail (vérifié le 13/11/2026)

- `npx tsc -b --noEmit` → **0 erreur**.
- `npm run build` → **49 modules, 995 ms, `dist/` 11 Mo**.
- `vite preview` sur 5181 → HTTP 200, page d'accueil rendue avec 4 univers
  (2 actifs, 2 « Bientôt »), parcours à **7 étapes** conforme à `config/steps.json`.
- Les 40 masters sont intacts (sha256 vérifié) ; aucun son n'a été transformé.

La Phase B peut donc partir de cette base sans rien reconstruire.

---

## 8. Critères d'acceptation de la Phase B

La Phase B sera considérée comme réussie si, sur les sons réels :

1. aucune note de basse ou de mélodie n'est produite par un son de périodicité
   < 0,75 (`P0`) ;
2. la hauteur réalisée de chaque note est à ±50 cents de la cible (`P1`) ;
3. une sélection de 4 à 6 sons **non hauteurés** produit une pièce avec une forme
   audible : au moins 3 changements de densité mesurables (`P2`) ;
4. chaque son sélectionné apparaît au moins une fois **brut** et audible
   (invariant 2, vérifié par `?selftest=1`) ;
5. aucun son marqué `transient net` n'est étiré ni granulé (`P4`) ;
6. la pièce reste déterministe pour une même sélection ;
7. **et surtout** : une écoute humaine juge la pièce musicale. Aucun de ces
   critères, seul, ne prouve qu'elle sonne bien.

---

*Document de proposition. Aucune modification du moteur n'a été effectuée en
Phase A. Les chiffres cités proviennent de `data/corpus-analysis.json` et de la
lecture du code aux lignes indiquées.*
