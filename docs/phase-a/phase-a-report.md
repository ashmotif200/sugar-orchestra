# Phase A — rapport d'exécution

**Projet :** Sugar Orchestra · Muséomix · L'Aventure du Sucre
**Date :** 13 novembre 2026 · **Environnement :** Hermes (Debian 13, i7-8700, 14 Gio, **aucun GPU**)
**Mode :** autonome, non destructif, piloté par la preuve
**Livrables :** `docs/phase-a/` (7 documents + données machine)

---

## COMPLETED

### A1 — Synchronisation du catalogue sonore
| Élément | Résultat |
|---|---|
| Sons existants inventoriés | **40 / 40** — fichier WAV présent, code ↔ inventaire ↔ crédits cohérents |
| Statuts d'identité | **35** `MATCHED_EXACT`, **2** `MATCHED_REVIEW`, **3** `RESTRICTED`, **0** `MISSING` |
| Sons actuellement autorisés à la composition | **37 / 40** (`availability = available`, non sensibles) |
| Correspondance 7 étapes ↔ 8 séquences | établie, **deux variantes concurrentes identifiées** (3 sons concernés) |
| Matériel sensible | **3 sons** préservés et exclus ; restrictions intactes |
| Sélection muséale (document source) | **0 / 40 vérifié — document absent** |

Livrables : `sound-selection-mapping.md`, `sound-selection-mapping.csv` (21 colonnes),
générés par `scripts/phase-a/build-selection-mapping.py`.

### A2 — Vérification opérationnelle de la chaîne audio
| Outil | Version | Test fonctionnel | Verdict |
|---|---|---|---|
| FFmpeg / ffprobe | 7.1.5 | probe réel : `pcm_s16le 32000 Hz 1 ch 20.0 s` | OK |
| librosa | 0.11.0 | mesure complète des 40 masters | OK |
| NumPy / SciPy | 2.2.6 / 1.18.1 | utilisés partout | OK |
| Essentia | 2.1b6.dev1438 | algorithmes présents | OK avec réserves |
| Rubber Band | 3.3.0 (via FFmpeg) | filtre disponible | partiel (CLI absent) |
| Craft Anything | 0.6.1 | 323 outils, 18 toolsets, Chromium | OK, **aucun outil audio** |
| Wrappers projet | — | `make verify` 21/21, `make engines` 40/41 | OK |

Livrable : `audio-toolchain-status.md`. **Aucune installation.** Modèles GPU : absents, confirmé.

### A4 — Capacités musicales des 40 sons
Mesure de bout en bout des 40 masters (152 s), avec **métrique calibrée** sur du
matériau de vérité connue avant toute conclusion.

| Mesure | Résultat |
|---|---|
| Sons à hauteur crédible (périodicité ≥ 0,75) | **5 / 40** |
| Sons utilisables comme **basse** | **0 / 40** |
| Percussion / texture rythmique | 16 / 4 |
| Atmosphère | 18 |
| Formes : transitoire net / texture étendue / semi-périodique / bruit | 14 / 19 / 6 / 1 |

Livrable : `museum-sound-musical-capabilities.md` (+ `data/corpus-analysis.json`,
`data/corpus-table.txt`).

### A5 — Proposition pour la Phase B
7 propositions priorisées (P0–P6), avec bénéfice, complexité, risque et critère
d'acceptation. Diagnostic chiffré de deux défauts prouvés. **Aucune modification
du moteur.** Livrable : `phase-b-engine-proposal.md`.

### Validation de l'existant
- `npx tsc -b --noEmit` → **0 erreur**
- `npm run build` → **49 modules, 995 ms, `dist/` 11 Mo**
- Auto-test de l'application (`?selftest=1`) → **8 / 8 cas OK**, `allOk: true`,
  déterminisme 4,17 × 10⁻⁷, reconnaissabilité 0,68–0,98
- Parcours rendu avec **7 étapes**, 4 univers (2 actifs, 2 « Bientôt »)
- 40 masters intacts (sha256 inchangé)

---

## REMAINING

| Tâche | Blocage |
|---|---|
| A1 — mapping de la sélection muséale | `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf` absent de l'hôte |
| A1 — configuration versionnée de la nouvelle sélection | dépend de la ligne ci-dessus : impossible sans connaître la sélection |
| A1 — arbitrage variante A / B (séquences 6-7-8) | décision d'équipe, pas technique |
| A3 — analyse de « Détendue » | **0 / 4 fichiers** présents (`Zistwar-drums/bass/other.wav`, `zistoire mix v0.wav`) |
| A3 — analyse des 3 autres univers | aucune référence fournie pour Énergétique, Dansant, Rêveur |
| A5 — identité Segazz | aucun compositeur dans le moteur **et** aucune référence |

---

## PROGRESS

Depuis le début de la Phase A, avec dénominateurs explicites :

| Avancement | Mesure |
|---|---|
| Sons du catalogue mesurés | **40 / 40** |
| Sons mappés à une étape du parcours | **40 / 40** (variante A) — 3 divergent selon la variante |
| Outils de la chaîne vérifiés fonctionnellement | **7 / 7** |
| Documents de livraison produits | **7 / 7** demandés au brief |
| Fichiers de référence analysés | **0 / 4** — blocage d'entrée, pas de méthode |
| Univers disposant d'une référence analysable | **0 / 4** |
| Propositions Phase B documentées | **7** (P0–P6) |
| Métriques d'analyse calibrées puis validées | **2** (périodicité, alignement de stems) |
| Métriques rejetées après calibration | **2** (yin 2048, « part harmonique ») |

Aucun pourcentage global n'est avancé : le dénominateur du travail restant dépend
de fichiers qui n'existent pas sur cet hôte.

---

## FINDINGS

### 1. Le corpus n'a pas de basse — et le moteur en fabrique une quand même
**0 son sur 40** ne remplit les conditions d'une basse. Le seul son réellement
grave (`01_01`, volcan, 96 % d'énergie sous 250 Hz) a une périodicité de **−0,05** :
c'est un grondement, pas une note. Or `roles.ts` admet un son en basse ou en
mélodie sur le seul critère `analysis.f0Hz !== null` — renseigné pour **31 sons
sur 40**, dont **5 seulement** ont une hauteur crédible. Le moteur recrute donc
26 sons pour des rôles de hauteur sur la foi d'un pic spectral.

### 2. La transposition replace les notes 2 à 3 octaves plus haut, sans le dire
`rateFor()` replie le taux dans `[0,45 ; 2,1]` par doublements. Avec une cible de
basse à 73,42 Hz : `03_02` (844,5 Hz) → taux 0,696 → **587,4 Hz joués**, soit
**+36 demi-tons** de la note écrite. `04_08` et `04_09` : idem. `04_05` et `08_01`
(marqués `bass`) sonnent une octave au-dessus. La partition demande un ré2,
l'audio joue un ré5.

### 3. Le moteur ne signale pas ses adaptations
Cas reproductible dans l'auto-test : sélection `[01_01, 01_03, 01_04, 02_04]`
(que des textures) → **3 adaptations** de rôle et **`limits: []`** — aucune
limitation annoncée. La mécanique honnête existe (`limits.push(...)`) mais ne se
déclenche pas dans ce cas.

### 4. Les 40 « sons du musée » sont une bibliothèque de sons de banques
Les crédits sont explicites : **34 CC0, 2 domaine public, 1 CC BY 3.0** (Mike
Koenig, fouet), **3 créations internes**. Tous viennent de BigSoundBank,
Freesound ou SoundBible — aucun n'est un enregistrement réalisé à L'Aventure du
Sucre. Le champ `license` du catalogue vaut pourtant « Licence à confirmer »
**40 fois sur 40** : les droits réels sont lisibles dans les crédits, mais le
champ exploitable par machine est vide.

### 5. Deux regroupements d'étapes différents coexistent
`config/steps.json` fusionne **[7, 8]** dans « De la bagasse à l'électricité ».
Le brief décrit une fusion impliquant **les anciennes sections 6 et 8**. Cela
déplace trois sons (`08_01` Mélasse, `08_02` Jus de canne, `08_03` Chaudière).
Sur le contenu, la mélasse et le jus sont des produits du sucre : la logique
plaide pour la variante du brief. Seul le document source peut arbitrer.

### 6. Deux métriques d'analyse ont dû être jetées
`librosa.yin` en fenêtre 2048 à 32 kHz ne résout pas un bourdon à 50 Hz ; une
mesure « part de magnitude sur la série harmonique » donnait **0,444 pour un
sinus pur** (somme dominée par le plancher de bruit) et aurait déclaré le corpus
entier non tonal. La périodicité par autocorrélation, calibrée (sinus 0,98 /
bruit 0,02), a remplacé les deux.

### 7. L'univers de la référence est celui qui n'existe pas
`segazz` — « Détendu », l'univers de « Détendue » — n'a **aucun compositeur** et
est marqué `available: false`. `ambient-creole` a un compositeur complet mais est
également marqué indisponible : du code écrit, inatteignable par le visiteur.

### 8. Le dépôt a été modifié pendant la Phase A
Une autre session a modifié `catalog.json`, `plan.ts`, `i18n/*`, `Step.tsx`
entre 09:21 et 09:47. Toutes les affirmations de code de ce rapport ont été
**re-vérifiées après** ces modifications (`rateFor`, `roles.ts:37`, les trois
compositeurs, les disponibilités). Les masters audio, eux, n'ont pas bougé.

---

## PHASE B RECOMMENDATIONS

Ordre de mise en œuvre proposé, du meilleur gain/coût au plus discutable :

| # | Proposition | Pourquoi | Complexité |
|---|---|---|---|
| **P0** | Filtrer `bass`/`melody` par périodicité ≥ 0,75 au lieu de `f0Hz !== null` | supprime les fausses mélodies (26 sons mal recrutés) | faible |
| **P1** | Borner le repli d'octave à ±12 demi-tons et exposer l'écart en cents | supprime les notes fausses de 2–3 octaves | faible |
| **P2** | Compositeur « groove-led » (couches rythmiques, densité, timbre en mouvement) | **le plus gros gain musical** : c'est ce que le corpus sait faire | moyenne |
| **P3** | Choisir les tranches par la région mesurée la plus tonale/tenue | moins de boue, sons plus présents | faible |
| **P4** | Politique de transformation par forme mesurée (interdire étirement sur transitoire net, filtrage sur bruit large bande) | protège la reconnaissabilité | moyenne |
| **P5** | Quatre identités d'arrangement réelles (dont Segazz) | cohérence produit | moyenne |
| **P6** | Variation bornée d'un motif plutôt que tirage uniforme | variété musicale au lieu de variété statistique | faible |

**Sur la basse, quatre options honnêtes** (le document les détaille) :
A. assumer l'absence de basse (recommandé pour la démo) ;
B. fabriquer un sub par filtrage résonant — mais le son n'est alors plus
reconnaissable, à assumer à l'écran ;
C. **enregistrer 2–3 sons graves au musée** (broyeur, chaudière, moteur) — seule
voie qui donne du grave *et* respecte l'invariant de reconnaissabilité ;
D. instrument externe — **viole la contrainte artistique**, exclu.

---

## BLOCKERS

### Fichiers manquants
1. `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf` — bloque A1 (sélection) et
   toute configuration versionnée de la nouvelle sélection.
2. `Zistwar-drums.wav`, `Zistwar-bass.wav`, `Zistwar-other.wav`,
   `zistoire mix v0.wav` — bloquent A3 intégralement.
3. Aucune référence pour Énergétique, Dansant, Rêveur.

Recherche effectuée : nom exact et variantes sur tous les systèmes de fichiers
montés, inventaire de **tous** les fichiers audio de la machine, contenu de
**8 archives ZIP**, historique de conversation. Aucun de ces fichiers n'a jamais
été déposé sur cet hôte.

### Décisions requises (non techniques)
1. Variante A ou B pour la fusion des séquences 6 / 7 / 8.
2. « La canne à sucre » remplace-t-elle « La canne » (étape 5) ?
3. `config/demo-set.json` (12 sons) : conservé comme curation, ou remplacé ?
4. Usage musical des 3 sons sensibles : autorisation individuelle, ou maintien
   de l'exclusion ?
5. Option A / B / C pour la question de la basse.

### Limites techniques assumées
- `rubberband` CLI non installable (pas de root) — contourné par le filtre FFmpeg.
- Essentia : build de développement, `PitchYinFFT` faux, `KeyExtractor` non
  pertinent sur des effets sonores.
- Métrique de tempo : hypothèses multiples, jamais un verdict unique.
- **Aucune qualité musicale n'est validée par ce rapport.** L'écoute humaine
  reste obligatoire, et c'est le seul critère qui compte pour le 14 novembre.

---

## Ce que la Phase A change concrètement

Avant : « le résultat musical ne satisfait pas » — constat d'opinion.
Après : la cause est mesurée et chiffrée. Le moteur écrit des notes de basse à
73 Hz et joue 587 Hz, sur un fonds sonore qui ne contient aucune hauteur grave.
Ce n'est pas un réglage à ajuster, c'est une stratégie d'arrangement à changer —
et le corpus dit précisément laquelle est possible : percussion, texture, densité.
