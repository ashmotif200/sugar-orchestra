# Architecture musicale proposée pour Sugar Orchestra

**Aucune modification du moteur n'a été faite.** Ce document décrit la structure
que la Phase B devrait viser, à partir des trois références mesurées
(`three-universes-comparison.md`), des capacités réelles du fonds sonore
(`museum-sound-musical-capabilities.md`) et de la lecture du moteur actuel
(`src/engine/plan.ts`, `roles.ts`, `universes.ts`, `render.ts`).

Le moteur actuel n'est pas à jeter : il tient déjà trois invariants vérifiés
(sources uniquement sélectionnées, chaque son reconnaissable, aucun échantillon
externe) et il est déterministe. Ce qui manque est une **couche de décision
musicale** au-dessus de ces garanties.

---

## A. Mécanismes communs — identiques dans les trois univers

Ces mécanismes doivent être **partagés**, pas réécrits par univers.

### A1. Plan de forme proportionnel
Le moteur code aujourd'hui des sections en dur par compositeur
(`for (let bar = 2; bar < 14; bar++)`). Proposition : une **forme déclarative** —
liste de sections avec proportion, couches actives, densité relative et
événement de transition — interprétée par un seul moteur d'arrangement.

Bénéfice mesuré : les trois références ont des formes différentes mais toutes
exprimables ainsi (2 blocs / intro-plateau / A-creux-B-stop-outro).

### A2. Placement d'événements sur une grille d'univers
Un seul ordonnanceur, avec par univers : pulsation, **subdivision (2 ou 3)**,
nombre de pulsations par mesure, et positions autorisées. Aujourd'hui chaque
compositeur a son propre helper (`at`, `at8`) — trois implémentations du même
concept, donc trois endroits où corriger un bug de grille.

### A3. Gestion des motifs : énoncé, variation, retour
Une phrase doit pouvoir être **exposée, variée, puis reprise** — c'est ce que font
les trois références (A/A' chez Détendu, plateau chez Dansant, deux blocs chez
Énergétique). Le moteur actuel fait tourner trois motifs par section sans notion
de retour. Proposition : motif = suite de degrés + rythme + niveau de variation
(0 = identique, 1 = ornementé, 2 = fragmenté).

### A4. Budget de transformation par son
Chaque son reçoit, d'après sa forme mesurée, la liste de ce qu'il supporte
(`transient net` → découpe et transposition, jamais d'étirement ; `texture
étendue` → étirement et granulation ; `bruit large bande` → ni filtrage ni
transposition). Le moteur choisit la transformation dans ce budget au lieu de
l'appliquer indifféremment.

### A5. Hiérarchie de mixage par univers
Trois gains de bus relatifs (percussion / basse / harmonie) et un niveau cible.
Mesuré : Énergétique = percussion **+8 dB** sur la basse ; Détendu = basse **+5,8
dB** sur la percussion ; Dansant = percussion ≈ voix, harmonie **16 dB** dessous.
Aujourd'hui un seul équilibre sert les trois.

### A6. Vérification de la hauteur réellement produite
**Défaut technique actuel, mesuré.** `rateFor()` replie le taux de transposition
dans `[0,45 ; 2,1]` par doublements. Conséquence, pour une cible de basse à
73,42 Hz :

| Source | f0 catalogue | taux | hauteur réellement jouée | écart à la note écrite |
|---|---|---|---|---|
| `03_02` Forgeron | 844,5 Hz | 0,696 | 587,4 Hz | **+36 demi-tons** |
| `04_08` Fers | 937,0 Hz | 0,627 | 587,4 Hz | **+36 demi-tons** |
| `04_09` Cuillère | 722,5 Hz | 0,813 | 587,4 Hz | **+36 demi-tons** |
| `04_04` Pioche | 522,9 Hz | 0,562 | 293,7 Hz | +24 demi-tons |
| `04_05` / `08_01` (rôle `bass`) | 173,9 / 188,4 Hz | — | 146,8 Hz | +12 demi-tons |

La partition demande un ré2, l'audio joue un ré5. Rien ne le signale.
**Proposition :** calculer la hauteur réalisée, la comparer à la cible et
**refuser l'événement** si l'écart dépasse ±50 cents — ou, à défaut, l'exposer
dans le révélateur (« adaptation : +3 demi-tons »).

### A7. Contrôle de reconnaissabilité (déjà en place, à préserver)
La passe de signature brute + ducking des lits fonctionne : auto-test 8/8,
corrélations 0,68–0,98. Toute refonte doit la conserver comme **contrainte dure**,
pas comme effet.

### A8. Déterminisme (déjà en place, à préserver)
Graine = univers + identifiants triés ; écart mesuré 4,17 × 10⁻⁷ entre deux
rendus. À conserver : c'est ce qui rend la démo reproductible.

---

## B. Paramètres propres à chaque univers

| Paramètre | Énergétique (Electro Sega) | Dansant (Sega traditionnel) | Détendu (Segazz) |
|---|---|---|---|
| Pulsation | **135** | **150** | **134** |
| Subdivision | 3 (ternaire) | 3 (ternaire) | **2** (binaire) |
| Pulsations / mesure | 4 | 2 (6/8) ou 4 selon lecture | 4 |
| Durée cible | 50–60 s | 60–90 s (référence 3 min 26) | 54–60 s |
| Basse | **sparse, tardive** : entre à ~50 % du morceau | **aucune** | **motrice** : ~3,5 attaques/s, tout du long |
| Percussion | **devant**, dense (8 dB au-dessus de la basse) | **devant**, continue, à égalité avec la couche principale | **derrière**, aiguë (5,8 dB sous la basse) |
| Harmonie | **pédale** (une seule tonalité) | **pas de grille** (bourdon modal) | **diatonique qui change**, à la mesure |
| Densité d'onsets visée | 250–270/min | 200–260/min | 200–230/min |
| Voix | impossible → compenser par percussions + accents | impossible → compenser par la densité | non requise |
| Structure | **2 blocs** avec entrée de basse | **intro voix → montée → plateau → arrêt → fin** | **A · creux · A' · stop · B · stop · outro** |
| Transitions | entrée de couche = bascule | ajout progressif de couches | **baisses de 6–10 dB** sur l'harmonie (stop-time) |
| LUFS cible | −12 à −11 | −13 à −12 | −15 à −14 |

**Point de vigilance :** ces valeurs proviennent d'**une référence par univers**.
Elles décrivent trois morceaux, pas trois genres. Les plages (et non les valeurs
ponctuelles) sont ce qui doit être codé, pour éviter de fabriquer trois copies.

**Segazz :** aucun compositeur n'existe aujourd'hui et l'univers est
`available: false`. La référence existe désormais et donne un tempo (134), un
mètre (binaire) et une forme — l'implémentation devient possible, mais elle exige
une basse que le fonds ne contient pas (voir C2).

---

## C. Contraintes du catalogue et comportements de repli

Le fonds mesuré : **0 son sur 40** peut tenir une basse, **5** ont une hauteur
crédible (tous entre 100 et 940 Hz), **20** sont percussifs ou rythmiques,
**19** sont des textures étendues.

### C1. Tableau des replis

| Situation | Comportement attendu | État actuel |
|---|---|---|
| Aucun son de basse | l'univers fonctionne **sans basse** et le dit ; ne pas transposer un métal en basse | partiel : `limits` existe mais ne se déclenche pas toujours (voir C3) |
| Aucun son mélodique crédible | pas de ligne mélodique ; la pièce est rythmique et texturale | idem |
| Que des textures | forme par densité et filtrage, pas par notes | **défaut constaté** : 3 adaptations silencieuses, `limits: []` |
| Un seul son sélectionné | boucle courte avec variations d'enveloppe | fonctionne (auto-test « un-seul-son ») |
| Son `sensitive` | jamais dans une pièce | **en place** (`buildScore` filtre, garde-fou testé) |
| Univers à basse requise sans source grave | proposer l'univers, ou l'afficher « dégradé », jamais mentir | à construire |

### C2. La basse n'est pas un rôle disponible

Trois références, trois réponses différentes : Énergétique en a une sparse,
Dansant n'en a **aucune**, Détendu en a une motrice. Le moteur actuel en exige une
partout. Proposition : `bass` devient un rôle **optionnel par univers**, avec une
troisième valeur possible — « cet univers n'utilise pas de basse ».

C'est aussi une décision artistique : les options sont (A) assumer l'absence,
(B) fabriquer un sub par filtrage en l'affichant comme adaptation, (C) enregistrer
des sons graves au musée. **B ne doit jamais être silencieux.**

### C3. Défaut constaté : les adaptations ne sont pas annoncées

Cas reproductible dans l'auto-test, sélection `[01_01, 01_03, 01_04, 02_04]`
(que des textures) : le moteur produit **3 adaptations** de rôle et
**`limits: []`**. La mécanique honnête existe (`limits.push(...)`) mais ne se
déclenche pas quand les rôles sont remplis par les replis.

*Correction attendue :* toute adaptation silencieuse doit produire une ligne de
`limits`, et le révélateur doit l'afficher. C'est peu de code et cela change la
perception du produit : le visiteur voit pourquoi sa pièce est ce qu'elle est.

---

## D. Priorités de développement

| # | Changement | Impact musical | Complexité | Risque | Dépendance | Vérifiable ? | Compatible prototype |
|---|---|---|---|---|---|---|---|
| **1** | Refuser/annoncer les hauteurs fausses (A6) | **élevé** | faible | faible | — | oui (cents vs cible) | oui, isolé dans `rateFor` |
| **2** | Rôles de hauteur filtrés par périodicité | **élevé** | faible | faible | données d'analyse | oui (aucun rôle sur son non périodique) | oui |
| **3** | Annoncer toutes les adaptations (C3) | moyen-élevé | faible | très faible | — | oui (auto-test) | oui |
| **4** | Tempos d'univers : 135 / 150 / 134 | **élevé** | faible | faible | — | oui (BPM du score) | oui |
| **5** | Hiérarchie de mixage par univers (A5) | **élevé** | moyenne | moyen | #4 | partiellement (LUFS par bus) | oui |
| **6** | Forme déclarative (A1) + durée 50–60 s | **élevé** | moyenne | moyen | #4 | oui (sections, durées) | à faire valider par l'écoute |
| **7** | Basse optionnelle par univers (C2) | **élevé** | moyenne | artistique | #2 | oui (absence de rôle) | oui |
| **8** | Budget de transformation par son (A4) | moyen | moyenne | faible | données de forme | oui (violations = 0) | oui |
| **9** | Motifs avec retour (A3) | moyen | moyenne | faible | — | partiellement | oui |
| **10** | Compositeur Segazz | moyen | **élevée** | élevé (pas de basse) | #7, #4 | oui | nouveau code |

**Ordre recommandé : 1 → 2 → 3 → 4** (faible risque, corrige des défauts prouvés,
une journée), puis **5 → 7 → 6** (le travail d'arrangement), puis **8, 9**, et
**10** en dernier car il dépend d'une décision sur la basse.

---

## E. Ce qui ne doit pas changer

1. `usedSourceIds ⊆ selectedSourceIds`
2. `selectedSourceIds ⊆ recognizableSourceIds` (passe de signature + ducking)
3. Aucun échantillon externe — les trois références restent **analytiques**
4. Les 3 sons sensibles exclus, quelle que soit la sélection
5. Déterminisme pour une même sélection
6. Aucun instrument externe, aucune voix de synthèse, aucun modèle génératif

---

*Sources : `data/reference-{energetique,dansant,detendu}.json`, `data/meter-*.json`,
`data/arrangement-*.json`, `data/harmony-*.json`, `data/corpus-analysis.json`, et
lecture de `src/engine/`. Chaque chiffre cité est reproductible par les scripts
`scripts/phase-a/`.*
