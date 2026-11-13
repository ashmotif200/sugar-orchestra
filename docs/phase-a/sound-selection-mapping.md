# Phase A1 — synchronisation du catalogue sonore

**Statut de cette phase : partielle, et volontairement bloquée sur un point.**

Le document de référence annoncé — `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf` —
**n'est pas présent sur Hermes**. Recherche exhaustive effectuée le 13 novembre 2026 :
nom exact, variantes (`*choisi*`, `*museomix*`, `*sons*`), tous les systèmes de
fichiers montés, contenu des archives ZIP, et PDF récents. Aucun résultat.

Conséquence assumée : la colonne `selected_in_source_document` vaut **UNVERIFIED**
pour les 40 sons. Aucune correspondance n'a été inventée. Ce document établit
tout ce qui *peut* être vérifié sans la source : l'identité des fichiers, la
provenance, les licences, la sensibilité, et le rattachement aux sept étapes.

---

## 1. Les trois ensembles à ne pas confondre

| Ensemble | Dénominateur | État |
|---|---|---|
| Enregistrements sources existants | **40 / 40** | tous présents dans `assets/originals/`, sha256 vérifiable |
| Sons sélectionnés par le musée (nouvelle sélection) | **0 / 40 vérifiés** | **bloqué** : document source absent |
| Sons actuellement autorisés à la composition | **37 / 40** | `availability == "available"` et non `sensitive` |

Les 3 sons non autorisés sont les sons `sensitive` de l'étape 4 — voir §4.

## 2. Correspondance étapes ↔ séquences : deux variantes concurrentes

Le parcours visiteur compte **7 étapes** ; l'inventaire compte **8 séquences**.
Une fusion est donc nécessaire, et **deux fusions différentes existent aujourd'hui** :

| Variante | Étape 6 « De la canne au sucre » | Étape 7 « De la bagasse à l'électricité » | Source |
|---|---|---|---|
| **A** (implémentée) | séquence 6 (6 sons) | séquences 7 + 8 (5 sons) | `config/steps.json`, `catalog.json` |
| **B** (cohérente avec le brief) | séquences 6 + 8 (9 sons) | séquence 7 (2 sons) | Phase A, §3.2 : « grouping involving the former sections 6 and 8 » |

**C'est un conflit réel, pas une nuance de rédaction.** Il déplace trois sons
(`08_01` Mélasse, `08_02` Jus de canne, `08_03` Chaudière) d'une étape à l'autre :

- `08_01` 08_01_Melasse — A: étape 7, B: étape 6
- `08_02` 08_02_Jus_de_canne — A: étape 7, B: étape 6
- `08_03` 08_03_Chaudiere — A: étape 7, B: étape 6

Argument de contenu, sans trancher : la mélasse et le jus de canne sont des
produits du sucre, pas de la bagasse ; la chaudière peut brûler de la bagasse.
Cela plaide pour **B**. Mais seul le document source peut arbitrer, et il est absent.
**Décision requise : équipe projet.**

Autre écart mineur : l'étape 5 s'intitule « La canne à sucre » dans le brief et
« La canne » avec un badge « À confirmer » dans l'application.

## 3. Tableau de correspondance (variante B, l'ordre du brief)

### Étape 1 — Les origines (5 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `01_01` | 01_01_Volcan_eruption | 1 | 1 · Les origines | Effet créé par la source | Licence à confirmer | MATCHED_REVIEW | rhythm,texture |
| `01_02` | 01_02_Foret_tropicale | 1 | 1 · Les origines | Enregistrement monté | Licence à confirmer | MATCHED_REVIEW | earcandy |
| `01_03` | 01_03_Bateau_fendant_eau | 1 | 1 · Les origines | Création composite | Licence à confirmer | MATCHED_EXACT | texture,rhythm |
| `01_04` | 01_04_Voiles_qui_claquent | 1 | 1 · Les origines | Création composite | Licence à confirmer | MATCHED_EXACT | texture |
| `01_05` | 01_05_Pas_sur_sable | 1 | 1 · Les origines | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | rhythm,earcandy |
### Étape 2 — Le sucre traverse les âges (5 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `02_01` | 02_01_Cuillere_tasse_sucre | 2 | 2 · Le sucre traverse les âges | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
| `02_02` | 02_02_Degustation | 2 | 2 · Le sucre traverse les âges | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
| `02_03` | 02_03_Couvercle_boite_sucre | 2 | 2 · Le sucre traverse les âges | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | melody,earcandy |
| `02_04` | 02_04_Commercants_etals | 2 | 2 · Le sucre traverse les âges | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture |
| `02_05` | 02_05_Bal_causeries | 2 | 2 · Le sucre traverse les âges | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture |
### Étape 3 — Les métiers du sucre (4 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `03_01` | 03_01_Cordonnier | 3 | 3 · Les métiers du sucre | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy |
| `03_02` | 03_02_Forgeron | 3 | 3 · Les métiers du sucre | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | melody,earcandy |
| `03_03` | 03_03_Fondeur | 3 | 3 · Les métiers du sucre | Création composite | Licence à confirmer | MATCHED_EXACT | texture,earcandy |
| `03_04` | 03_04_Charpentier | 3 | 3 · Les métiers du sucre | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy |
### Étape 4 — La mémoire des plantations (13 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `04_01` | 04_01_Fouet | 4 | 4 · La mémoire des plantations | Enregistrement monté | Licence à confirmer | RESTRICTED | earcandy |
| `04_02` | 04_02_Fers_chaines | 4 | 4 · La mémoire des plantations | Enregistrement monté | Licence à confirmer | RESTRICTED | earcandy,rhythm |
| `04_03` | 04_03_Coupe_coupe_champ | 4 | 4 · La mémoire des plantations | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
| `04_04` | 04_04_Pioche | 4 | 4 · La mémoire des plantations | Création composite | Licence à confirmer | MATCHED_EXACT | melody,earcandy |
| `04_05` | 04_05_Ayo_MAQUETTE_A_VALIDER | 4 | 4 · La mémoire des plantations | Maquette vocale synthétique à valider | Licence à confirmer | RESTRICTED | melody,bass |
| `04_06` | 04_06_Vent_dans_champs | 4 | 4 · La mémoire des plantations | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture,earcandy |
| `04_07` | 04_07_Sucre_sibilance_SSS | 4 | 4 · La mémoire des plantations | Synthèse sonore | Licence à confirmer | MATCHED_EXACT | texture,earcandy |
| `04_08` | 04_08_Fers_ouverture_fermeture | 4 | 4 · La mémoire des plantations | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
| `04_09` | 04_09_Cuillere_sur_fer_blanc | 4 | 4 · La mémoire des plantations | Synthèse sonore | Licence à confirmer | MATCHED_EXACT | melody,rhythm,earcandy |
| `04_10` | 04_10_Redaction_contrat | 4 | 4 · La mémoire des plantations | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | earcandy,texture,rhythm |
| `04_11` | 04_11_Doigt_encre_empreinte | 4 | 4 · La mémoire des plantations | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy,bass,melody |
| `04_12` | 04_12_Drapeau_au_vent | 4 | 4 · La mémoire des plantations | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
| `04_13` | 04_13_Canon | 4 | 4 · La mémoire des plantations | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | earcandy |
### Étape 5 — La canne à sucre (2 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `05_01` | 05_01_Canne_pousse_accelere | 5 | 5 · La canne à sucre | Création composite | Licence à confirmer | MATCHED_EXACT | texture,rhythm,earcandy |
| `05_02` | 05_02_Eprouvette_remuee | 5 | 5 · La canne à sucre | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
### Étape 6 — De la canne au sucre (9 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `06_01` | 06_01_Moulin_eau | 6 | 6 · De la canne au sucre | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture,earcandy |
| `06_02` | 06_02_Moulin_vent | 6 | 6 · De la canne au sucre | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | rhythm,texture |
| `06_03` | 06_03_Moulin_vapeur | 6 | 6 · De la canne au sucre | Création composite | Licence à confirmer | MATCHED_EXACT | bass,texture |
| `06_04` | 06_04_Charrette_boeufs | 6 | 6 · De la canne au sucre | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | rhythm |
| `06_05` | 06_05_Camion | 6 | 6 · De la canne au sucre | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture |
| `06_06` | 06_06_Engrenages | 6 | 6 · De la canne au sucre | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture,earcandy |
| `08_01` | 08_01_Melasse | 8 | A:7 / B:6 | Création composite | Licence à confirmer | MATCHED_EXACT | rhythm,bass |
| `08_02` | 08_02_Jus_de_canne | 8 | A:7 / B:6 | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy,rhythm |
| `08_03` | 08_03_Chaudiere | 8 | A:7 / B:6 | Création composite | Licence à confirmer | MATCHED_EXACT | earcandy,texture |
### Étape 7 — De la bagasse à l'électricité (2 sons)

| code | name | seq | stage | nature | licence | status | roles |
|---|---|---|---|---|---|---|---|
| `07_01` | 07_01_Bagasse_ecrasee | 7 | 7 · De la bagasse à l'électricité | Création composite | Licence à confirmer | MATCHED_EXACT | bass,texture |
| `07_02` | 07_02_Electricite | 7 | 7 · De la bagasse à l'électricité | Enregistrement monté | Licence à confirmer | MATCHED_EXACT | texture,earcandy |

## 4. Matériel sensible — restrictions préservées

| code | nom | drapeau | statut | note d'inventaire |
|---|---|---|---|---|
| `04_01` | 04_01_Fouet | sensitive=True, validation=False | RESTRICTED | Quatre claquements espacés, sans cri. Crédit obligatoire : Mike Koenig, CC BY 3.0, SoundBible ; montage en 20  |
| `04_02` | 04_02_Fers_chaines | sensitive=True, validation=False | RESTRICTED | Lecture « fer » retenue ; chaînes génériques, non objets historiques attestés. |
| `04_05` | 04_05_Ayo_MAQUETTE_A_VALIDER | sensitive=True, validation=True | RESTRICTED | « Ayo » interprété provisoirement comme une interjection. Voix Flite « Ah yo », non chant traditionnel ; prono |


Ces trois sons restent `not_musical` : ils documentent une histoire douloureuse
(fouet, fers et chaînes) ou sont une maquette vocale non validée (`Ayo`). **La
sélection du musée ne vaut pas autorisation d'usage musical** : elle devra être
demandée explicitement, son par son, à la curation.

## 5. Décompte des statuts

- **MATCHED_EXACT** : 35
- **MATCHED_REVIEW** : 2
- **RESTRICTED** : 3

- Total : **40** sons

`MATCHED_REVIEW` regroupe les entrées dont l'identité de fichier est certaine mais
dont la **provenance** doit être revue : effets stock fournis par la source
(volcan, forêt tropicale) et non enregistrements du musée, ou notes d'inventaire
qui signalent elles-mêmes une incertitude (« espèces et lieu non certifiés »).

## 6. Ce que la synchronisation a réellement changé

Rien n'a été modifié. Constats sur l'état existant :

1. **Toutes les entrées portent `"license": "Licence à confirmer"`** — 40/40. Les
   crédits nomment CC0 / domaine public / BigSoundBank / Freesound, mais le champ
   lisible par machine est vide de sens. Blocage pour toute publication.
2. **La curation de démonstration a divergé.** `config/demo-set.json` contient
   encore la sélection de 12 sons, alors que `catalog.json` n'a plus ni `demoSet`
   ni `inDemoSet` (0 son marqué) : les 37 sons disponibles sont tous rattachés aux
   étapes et donc tous collectables. Les deux artefacts coexistent sans lien.
3. **Aucune configuration versionnée de la nouvelle sélection n'existe.** La
   produire exigerait de connaître la sélection ; c'est impossible ici (§1).

## 7. Questions bloquantes pour l'équipe projet

1. Fournir `Museomix_Sugar Orchestra_ Les Sons Choisis.pdf`.
2. Arbitrer variante A ou B pour la fusion des séquences 6/7/8.
3. Confirmer que « La canne à sucre » remplace « La canne ».
4. Trancher le sort de `config/demo-set.json` : sélection de 12 conservée comme
   curation, ou remplacée par la nouvelle sélection ?
5. Autoriser — ou non — l'usage musical des 3 sons sensibles, individuellement.

---

*Généré par `scripts/phase-a/build-selection-mapping.py` à partir de
`src/data/catalog.json` et `/workspace/Inventaire.csv`. Aucune de ces deux
sources n'est modifiée par ce script.*
