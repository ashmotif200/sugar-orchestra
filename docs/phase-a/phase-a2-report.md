# Phase A — 2e passe : rapport d'exécution

**Date :** 13 novembre 2026 · **Déclencheur :** réception des trois éléments bloquants
(2 références musicales avec stems, sélection muséographique `Les Sons Choisis`).
**Périmètre :** analyses, correspondance document ↔ catalogue, fiches d'arrangement,
configuration versionnée. **Le moteur musical n'est pas modifié.**

---

## COMPLETED

### A1 — Correspondance PDF ↔ catalogue (était bloqué)

| Élément | Résultat |
|---|---|
| Document source | `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf` — 8 pages lues, 0 page sans texte |
| Lignes du catalogue traitées | **40 / 40** |
| Sons retenus par le PDF | **17** — 12 correspondances fortes, 4 à confirmer, 1 ambiguë |
| Sons hors sélection | **23**, conservés au catalogue avec leurs crédits |
| Étapes | **7** — le PDF tranche : pas de 8ᵉ étape, « Bagasse » reste l'étape 7 |
| Restrictions éditoriales | 3 sons sensibles recopiés tels quels, **aucune levée** |
| Configuration versionnée | `config/steps.v2.json` (version 2, supersedes 1, statut `ready-for-phase-b`) |

Livrables : `sound-selection-v2.csv` (13 colonnes), `sound-selection-v2.md`,
`config/steps.v2.json`, générés par `scripts/phase-a/build-selection-v2.py`.

**Le PDF résout deux questions ouvertes de la 1ʳᵉ passe :**
1. **Sept étapes, pas huit** — la fusion des séquences 7 et 8 est confirmée, mais le
   découpage est **narratif, pas séquentiel** : l'étape 6 puise dans les séquences 4
   (coupe, cristallisation), 6 (transport, moulin) et 8 (jus, chaudière).
2. **La sélection est un sous-ensemble** (17 sons sur 40), pas un remaniement du
   catalogue. Cinq sons de l'étape 2 de l'inventaire ne sont pas retenus, dont
   `02_02_Degustation` et `02_05_Bal_causeries`.

### A3 — Analyse des deux références (était bloqué à 0/4 fichiers)

**9 fichiers mesurés** : 2 mixes + 7 stems.

| | Énergétique « Ohwalawa » | Détendu « Zistoire » |
|---|---|---|
| Durée | 51,06 s | 54,47 s |
| Tempo mesuré | **135,5 BPM** | **133,9 BPM** |
| Mesure | 1,771 s (4/4) | 1,792 s (4/4) |
| Mesures | 28 | 30 |
| Tonalité | **fa**, pédale statique (cycle 2 mes. à 0,96) | **si mineur** (0,76), jeu diatonique |
| LUFS mix | **−11,7** | **−14,5** |
| Stems | drums −13,2 · bass −21,4 · vocals −24,3 · percs −19,5 | drums −23,0 · bass −19,2 · other −17,0 |
| Reconstruction stems → mix | **0,9999** (gain 0,9999) | **1,0000** (gain 1,0000) |
| Forme mesurée | 13 mesures **sans basse** puis drop | A 8 · creux 2 · A' 3 · stop 1 · B 6 · stop 1 · outro 9 |

Livrables : `reference-analysis-ohwalawa.md`, `reference-analysis-detendue.md`
(remplace l'analyse bloquée), `data/reference-{energetique,detendu}.json`,
`data/arrangement-*.json`, `data/harmony-*.json`.

### A5 — Deux fiches d'arrangement exploitables

`arrangement-sheet-energetique.md` et `arrangement-sheet-detendu.md` : tempo, mètre,
durée, tonalité, forme mesure par mesure, densités et niveaux par rôle, traitement,
décisions requises et **contrat d'écoute** (critères d'acceptation vérifiables à
l'oreille en Phase B).

### Vérification

`scripts/phase-a/verify-a2.py` → **35 / 35 contrôles**, dont :
- CSV : 40 lignes, codes uniques, couverture complète du catalogue ;
- config v2 : 7 étapes, codes existants, aucun doublon, cohérence avec le CSV ;
- restrictions : aucun son sensible déclaré utilisable, disponibilités recopiées ;
- mesures : `mesure = 240/BPM` à moins de 2 %, reconstruction des stems ≥ 0,98,
  sections couvrant toutes les mesures sans trou ni recouvrement ;
- **originaux : 40 / 40 WAV identiques bit-à-bit au ZIP fourni** (sha256) ;
- documents : présents et contenant les sections exigées.

`npm run build` reste vert — le moteur et l'application sont inchangés.

---

## REMAINING

| Tâche | Nature du blocage |
|---|---|
| Références « Dansant » et « Rêveur » | **aucun fichier fourni** — 2 univers sur 4 restent sans référence |
| Arbitrage de la basse (options A / B / C) | décision d'équipe, pas technique |
| Les 5 correspondances non certaines (1 ambiguë, 4 à confirmer) | validation muséale |
| Sons `04_09` « Lota » et le choix coupe/cristallisation à l'étape 6 | le catalogue n'a pas de « lota » ; proposition faite, à trancher |
| Activation de `steps.v2.json` dans l'application | **Phase B**, volontairement non faite ici |
| Toutes les propositions d'arrangement | Phase B : le moteur n'a pas été touché |
| Écoute humaine des deux références | seul jugement qui compte pour le 14/11 |

---

## PROGRESS (dénominateurs explicites)

| Avancement | 1ʳᵉ passe | 2ᵉ passe |
|---|---|---|
| Fichiers de référence analysés | 0 / 4 | **9 / 9 fournis** |
| Univers dotés d'une référence mesurée | 0 / 4 | **2 / 4** |
| Lignes de sélection vérifiées | 0 / 40 | **40 / 40** |
| Sons retenus et justifiés | — | **17** (12 forts, 4 à confirmer, 1 ambigu) |
| Configuration d'étapes versionnée | absente | **v2 prête** |
| Fiches d'arrangement | 0 | **2** |
| Contrôles de vérification | 17 / 17 (1ʳᵉ passe) | **35 / 35** |
| Originaux vérifiés intacts | non vérifié | **40 / 40 sha256** |
| Moteur modifié | non | **non** (conforme à la consigne) |

---

## FINDINGS

### 1. Les deux références sont au même tempo — et ce n'est pas celui du moteur
135,5 et 133,9 BPM. Le moteur tourne à **112** (electro) et **126** (sega). Écart de
**−23 BPM** sur l'univers Énergétique : c'est le premier écart audible, avant tout
problème de timbre ou de mixage.

### 2. « Énergétique » n'est pas une boucle, c'est un montage
13 mesures sur 28 (46 % du morceau) **sans basse** : percussions + voix, puis entrée
de la basse à la mesure 14 qui ouvre le drop. Un moteur qui joue toutes les couches du
début à la fin ne peut pas produire cette impression, quel que soit le réglage.

### 3. « Détendu » n'est pas lent — il est discret
134 BPM (plus rapide que notre « Énergétique »), mais la **batterie est 5,8 dB sous la
basse** et son centroïde est à 3 348 Hz : charleys fins, pas de grosse caisse en avant.
« Détendu » est un équilibre de mixage, pas un tempo.

### 4. L'absence de basse du corpus est un problème de produit, pas de réglage
La référence Détendu est portée par une basse à 3,5 attaques/s, présente 100 % du
temps. Le catalogue n'a **aucune** source de basse (0/40, mesuré en 1ʳᵉ passe). Aucun
paramétrage ne compense cela : c'est l'option C de la 1ʳᵉ passe (enregistrer 2–3 sons
graves au musée) qui débloque l'univers, ou une fabrication assumée à l'écran.

### 5. La voix est présente dans la référence Énergétique, et restera absente
Stem de voix à 96 % de présence, 175 attaques/min. Le seul son vocal du catalogue
(`04_05_Ayo`) est une maquette à valider : il ne peut pas servir. **La démo sera
instrumentale** — il faut le dire, et compenser par la densité percussive (268
attaques/min dans la référence) plutôt que par une mélodie chantée.

### 6. Les deux références durent ~50 s, la nôtre 36 s
28 et 30 mesures contre 16. Une forme avec creux, stop et drop ne tient pas en 16
mesures : la durée est une condition de la forme, pas un détail.

### 7. Les stems sont de vrais multipistes — et une mesure de la 1ʳᵉ passe est à jeter
Somme des stems = mix à 0,9999 sur les deux morceaux. En revanche, le décalage estimé
par enveloppe d'attaques (368 ms sur les voix) est un **artefact de méthode**, pas une
mesure : la reconstruction sans décalage prouve l'alignement. Cette métrique ne doit
pas être réutilisée telle quelle.

### 8. Le découpage du PDF ne suit pas l'Inventaire
L'étape 6 « De la canne au sucre » réunit des sons des séquences 4, 6 et 8. Toute
implémentation qui suppose une correspondance séquence → étape est fausse, y compris
`config/steps.json` (v1) actuellement branchée sur l'application.

---

## RECOMMANDATIONS PRIORITAIRES (qualité des compositions)

Classées par gain perceptible / coût. Aucune n'est implémentée ici.

| # | Action | Gain attendu | Coût | Preuve |
|---|---|---|---|---|
| **P0** | Passer l'Énergétique à **135 BPM** | immédiat : la pièce « avance » enfin | 1 constante | 135,54 mesuré |
| **P1** | Écrire une **forme** : 28–30 mesures, basse qui entre tard, creux et stop | c'est ce qui distingue un morceau d'une boucle | moyen | 13 mes. sans basse ; 3 creux |
| **P2** | **Profils de mixage par univers** : Énergétique drums −13 / bass −21 ; Détendu harmonie −17 / bass −19 / drums −23 | corrige l'uniformité actuelle | faible | écarts LUFS mesurés |
| **P3** | **Stratégie harmonique par univers** : pédale (Énergétique) vs diatonique qui bouge (Détendu) | évite les progressions inventées | moyen | cycle 2 mes. à 0,96 vs jeu Bm |
| **P4** | Trancher la **basse** : enregistrer 2–3 sons graves (C) ou sub fabriqué assumé (B) | débloque Détendu, crédibilise le drop | décision + terrain | 0/40 source grave |
| **P5** | Cible de niveau **−12 / −14,5 LUFS** au lieu de −17 | la démo sonnera comme un master | faible | −11,7 et −14,5 mesurés |
| **P6** | Assumer l'**absence de voix** et densifier les percussions | évite une mélodie faible qui singe un chant | faible | vocals 96 % dans la réf. |

**Ce qui ne sert à rien d'essayer avant P0–P2** : ajouter des transformations, des
effets ou des motifs. Tant que le tempo, la forme et l'équilibre des couches ne sont
pas ceux des références, le résultat restera perçu comme « pas fini », quel que soit
le travail sur le détail.

---

## Risques

| Risque | Impact | Mitigation |
|---|---|---|
| Les 5 correspondances incertaines sont fausses | crédibilité muséale | validation d'équipe avant activation |
| La basse n'est pas tranchée | Détendu infaisable | décision avant Phase B |
| Tester les arrangements demande d'écouter | subjectivité | contrats d'écoute écrits, critères binaires |
| Le moteur est modifié pendant la Phase B sans ces fiches | retour au tâtonnement | ce document est la spécification |

## Ce que cette passe change concrètement

Avant : « la référence est bloquée, on ne sait pas à quoi ressemble un morceau
réussi ». Après : deux morceaux mesurés au stem près, une forme chiffrée, des cibles
de tempo, de niveau et de densité, et une sélection muséographique de 17 sons
rattachée ligne par ligne au catalogue — avec 35 contrôles automatiques qui
interdisent de se raconter d'histoires.
