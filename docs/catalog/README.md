# Catalogue — archivage, import des 8 sons, restauration

État au 14 novembre 2026. **Rien n'a été basculé** : le catalogue publié reste celui des 40 sons.

## 1. Ce qui existe et n'a pas été reconstruit

| Mécanisme | Où | Usage |
|---|---|---|
| Catalogue actif | `src/data/catalog.json` (bundle) | ce que lit le visiteur |
| Source de vérité | base SQLite `data/admin/` | sons, étapes, contenus, restrictions |
| Publication | `POST /api/publication/publish` → `data/admin/publications/pub-N/` | écrit un instantané, **sans toucher** au bundle |
| Application | `npm run admin:apply -- --yes --from N` | copie l'instantané dans le bundle, avec sauvegarde |
| Archivage (nouveau) | `scripts/catalog/archive.mjs` | archive non destructive + empreintes |
| Import 8 sons (nouveau) | `scripts/catalog/import-samples.mjs` | originaux + diffusion + métadonnées |

## 2. Archive historique — faite

```bash
node scripts/catalog/archive.mjs archive     # crée l'archive
node scripts/catalog/archive.mjs verify      # vérifie les 82 empreintes
node scripts/catalog/archive.mjs restore --yes  # réécrit les fichiers manquants
```

Résultat : `data/archive/catalog-40/` — **82 fichiers, 59,1 Mo**, 82/82 empreintes conformes.

| Contenu | Nombre |
|---|---|
| `originals/*.wav` | 40 |
| `diffusion/*.m4a` | 40 |
| `data/catalog.json`, `data/steps.json` | 2 |
| `data/db-export.json` | sons, associations d'étape, versions, contenus, restrictions, étapes |
| `MANIFESTE.json` + `SHA256SUMS.txt` | inventaire vérifiable |

L'archivage **copie**, il ne déplace ni ne supprime. Les 40 originaux restent dans
`assets/originals/`, les 40 versions de diffusion dans `public/audio/`.

## 3. Import des 8 nouveaux sons — préparé, non exécuté

```bash
node scripts/catalog/import-samples.mjs --template
# remplir scripts/catalog/import-8-samples.template.json (8 entrées)
node scripts/catalog/import-samples.mjs --manifest scripts/catalog/import-8-samples.template.json --dry-run
node scripts/catalog/import-samples.mjs --manifest … --yes
```

Champs par fichier : `id`, `file`, `name`, `stepId`, `description`, `source`, `author`, `license`, `sensitive`.

Garde-fous vérifiés :

- refus si le manifeste ne contient pas exactement 8 entrées ;
- refus d'un identifiant déjà utilisé — **les identifiants historiques ne sont jamais réattribués** ;
- refus si le fichier est absent, si le nom ou la licence manquent ;
- refus si le même fichier (même SHA-256) est déjà importé ;
- refus d'écraser un original existant.

Identifiants réservés à la démo : **`90_01` à `90_08`** (aucun conflit avec `01_01`…`08_03`).

Trois niveaux conservés séparément : original brut (`assets/originals/`), version de diffusion
(`public/audio/`, AAC 96 kbps mono, même traitement que les 40 sons), métadonnées (base).

Les sons importés entrent en **statut `draft`** : invisibles pour le visiteur tant qu'aucune
publication n'est appliquée.

## 4. Bascule vers le catalogue de démonstration — non exécutée

Elle utilise le mécanisme existant, sans nouveau code :

1. Importer les 8 fichiers (`--yes`), vérifier visuellement les 8 entrées.
2. Attribuer les étapes (répartition libre : 8 sons pour 7 étapes, une étape peut rester vide).
3. Publier : `POST /api/publication/publish` avec `{"confirm":"PUBLIER"}`.
4. Appliquer : `npm run admin:apply -- --yes --from <N> --note "…"`.

L'étape 4 **modifie le parcours visiteur** : elle demande votre validation explicite, conformément à
la consigne. Tant qu'elle n'est pas faite, les visiteurs voient toujours les 40 sons.

## 5. `config/steps.json` — deux représentations, à ne pas confondre

| Représentation | Où | Format |
|---|---|---|
| **Source** (éditoriale) | git, commit antérieur | `_doc` explicatif, `sequences` (rattachement à l'inventaire) |
| **Publiée** (appliquée) | fichier courant | `version: 2`, `sounds: [...]`, sans `_doc` |

L'application de la publication 2 a **écrasé la source** par la représentation publiée. Les deux
formats coexistent désormais dans l'historique git, mais le fichier de travail ne contient plus que le
format publié. Ce n'est pas corrigé ici : la consigne demande de ne pas restaurer ni remplacer
silencieusement.

Conséquences à trancher plus tard :

- le champ `_doc` (note de cadrage sur les 7 étapes) n'est plus dans le fichier de travail ;
- `npm run admin:apply` écrit dans `config/`, donc **confond source et publication** : c'est un défaut
  de conception, pas un accident de manipulation ;
- la restauration de la source est possible (`git show <commit>:config/steps.json`) mais doit être une
  décision explicite, pas un réflexe.

Sauvegarde : l'archive contient `data/steps.json` tel qu'il était au moment de l'archivage.

## 6. Parcours visiteur à 8 sons — ce qui est déjà compatible

Vérifié dans le code, sans modification :

| Hypothèse | État |
|---|---|
| Étape sans son | gérée : `Step.tsx` affiche un état vide (`EmptyState`), pas d'erreur |
| Nombre max de sons sélectionnés | lu dans `catalog.limits.maxSelected` (repli 8), pas codé en dur dans l'interface |
| Nombre de sons par étape | aucune contrainte : 5, 5, 4, 13, 2, 6, 5 aujourd'hui, répartition libre demain |
| Identifiants | aucune liste figée ; les moteurs filtrent sur la sélection du visiteur |
| Progression / QR | liée à l'étape (`#/etape/N`), pas au nombre de sons |

Point d'attention : `catalog.limits.minSelected = 1` — avec 8 sons, un visiteur peut n'en choisir
qu'un. C'est cohérent, mais la démo gagnerait à en exiger 3 ou 4. Décision à prendre, non appliquée ici.

## 7. Analyse musicale des 8 nouveaux sons

**Non faite**, et volontairement : les fichiers n'existent pas. Elle viendra après l'import
(caractéristiques rythmiques, contenu tonal, transitoires, découpage, transformations possibles).

## 8. Moteur

V2.1 reste gelé. Aucune ligne de `src/engine/` ni de `src/engine-v2/` modifiée. Aucune nouvelle
démonstration musicale produite.
