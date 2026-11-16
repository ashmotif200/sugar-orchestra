# Développement

Conventions, cartographie du code, tests et pièges connus.

## 1. Conventions

- **Langue** : contenu, commentaires et messages de commit en français.
- **Textes d'interface** : jamais en dur dans un écran. `src/i18n/fr.json` et
  `en.json` sont des miroirs ; ajouter une clé dans les deux.
- **Trois notions à ne pas confondre** : un *son* (catalogue), un *poste* (lieu
  physique doté d'un QR) et l'*état de collecte* (session du visiteur). Un poste
  référence un code de son ; il ne possède pas le son.
- **Une seule règle de disponibilité** : `src/data/publication.ts`. Ne pas écrire
  `status === 'published'` ailleurs.
- **Une seule règle d'usage musical** : `src/engine/policy.ts`. Ne pas dupliquer.
- **Commentaires utiles** : expliquer *pourquoi*, en particulier quand le code
  corrige un défaut constaté. Les commentaires du dépôt qui racontent un bug passé
  sont volontaires — ils empêchent de le réintroduire.

## 2. Carte du code

| Chemin | Rôle | Points d'entrée |
|---|---|---|
| `src/App.tsx` | enchaînement des écrans, session, publication, composition | composant unique, ~470 lignes |
| `src/router.ts` | routes par hash | `parseHash`, `useRoute` |
| `src/session.ts` | session visiteur persistée | `loadSession`, `saveSession` |
| `src/audio/service.ts` | contexte audio, décodage, préécoute, export | singleton `audio` |
| `src/audio/useSamplePlayer.ts` | lecteur partagé du carnet | hook |
| `src/data/*.ts` | données embarquées + état de publication | modules purs |
| `src/engine/*` | moteur V1 | `buildScore`, `render` |
| `src/engine-v2/**` | moteurs V2.0 / V2.1 | `plan`, `browser`, `v21/*` |
| `src/ui/screens/*` | un fichier par écran | composants |
| `src/ui/kit.tsx` | boutons, badges, forme d'onde… | composants |
| `src/admin/*` | Super Admin, chargé à la demande | `AdminApp` |
| `server/*.mjs` | serveur d'administration | `admin-server.mjs` |
| `scripts/**` | outillage (Node et Python) | voir `scripts/README` implicite dans chaque en-tête |

## 3. Boucle de travail

```bash
npm run dev                    # frontend, HMR
npm run admin:serve            # dans un autre terminal, pour l'API
npm run typecheck              # avant chaque commit
```

Avant de livrer une modification d'interface, vérifier **dans un navigateur** que la
navigation ne recharge pas le document. Le critère mesurable :

```js
performance.getEntriesByType('navigation').length === 1
```

après avoir traversé tous les écrans. Un `2` signifie qu'un rechargement a eu lieu —
souvent un serveur de développement laissé tourner, parfois un `<a href>` qui aurait
dû être un bouton.

## 4. Tests

| Suite | Commande | Ce qu'elle couvre | Résultat au 16/11/2026 |
|---|---|---|---|
| Types | `npm run typecheck` | tout le TypeScript | OK |
| API admin | `npm run admin:test` | 56 contrôles : auth, permissions, publication, audit, en-têtes | **56/56** |
| Moteur V2.0 | `npm run v2:test` | 18 contrôles : déterminisme, invariants de hauteur, rendu, crête | **18/18** |
| Moteur V2.1 | `node tests/v2/v21.test.mjs` | 22 contrôles : modes, basse, durée, rendu identique | **22/22** |
| Moteur V1 (navigateur) | `?selftest=1&batch=1` puis `&batch=2` | 8 cas, reconnaissabilité mesurée | à relancer manuellement |

La suite V1 se lance **en deux lots** : un seul onglet sature en mémoire sur huit
rendus. C'est une contrainte réelle, pas une précaution.

### Harnais Python

```bash
PY=/chemin/renv/analysis/bin/python
$PY scripts/phase-a/verify.py       # 17 contrôles, toolchain + vérité synthétique
$PY scripts/phase-a/verify-a2.py    # 35 contrôles, sélection et cohérence de config
$PY scripts/phase-a/verify-a3.py    # 16 contrôles, intégrité et reproductibilité
$PY scripts/phase-a/verify-v2.py    # 21 contrôles, artefacts et moteur intact
$PY scripts/v2/build-style-models.py --check   # bornes, chronologie, pistes de clic
```

Ces scripts ont besoin de fichiers absents du dépôt (masters, références). Ils
s'arrêtent en nommant le fichier manquant.

**`npm run build` ne couvre aucune ligne de Python.** Un build vert ne dit rien de
ces scripts : il faut lancer leur harnais.

## 5. Un test réparé : `visitor_catalog_unchanged_by_publish`

Ce contrôle a échoué du 13 au 16 novembre 2026, puis a été corrigé. Garder la trace
évite de « re-corriger » dans l'autre sens.

**Le symptôme.** `npm run admin:test` renvoyait 55/56. Le contrôle lisait
`src/data/catalog.json` et refusait que son champ `source` contienne
`admin publication`. Or ce champ valait
`"admin publication by admin@sugarorchestra.local"` depuis le commit `b59166d`
(13 novembre), où une publication avait été appliquée volontairement au bundle pour
rendre le contenu éditorial visible.

**Pourquoi c'était un faux négatif.** Ce n'était ni une régression ni un problème de
données : les 40 sons et les 7 étapes étaient conformes, seul le libellé `source`
déclenchait le test. Le contrôle voulait prouver que *publier ne modifie pas le
bundle du visiteur*, mais il le déduisait d'un champ global, tributaire d'une action
passée sans rapport avec l'appel testé.

**Le correctif** (commit « Tests: le contrôle d'immobilité du bundle mesure une
empreinte ») : le test calcule le SHA-256 de `src/data/catalog.json` **avant**
`POST /api/publication/publish`, le recalcule **après**, et compare. C'est la preuve
directe, et elle ne dépend plus d'un champ historique.

```js
const bundleHashBefore = sha256File(bundlePath)
// … POST /api/publication/publish { confirm: 'PUBLIER' } …
const bundleHashAfter = sha256File(bundlePath)
check('visitor_catalog_unchanged_by_publish',
  bundleAfter.sounds?.length === 40 && bundleHashAfter === bundleHashBefore, …)
```

**Résultat mesuré** : `56/56 contrôles OK`, avec
`empreinte c9d2382a → c9d2382a` — le fichier est identique à l'octet près, ce qui est
exactement la propriété annoncée.

**Leçon** : un test qui échoue pour une raison étrangère à ce qu'il mesure finit par
être ignoré. Le corriger ne consiste pas à changer sa valeur attendue, mais à mesurer
directement la propriété visée.

## 6. Pièges connus

### Redémarrer le serveur d'administration

`npm run admin:serve` lance `node server/admin-server.mjs`. Tuer le *shell* qui l'a
lancé laisse le processus `node` vivant et lié au port : la relance échoue en
`EADDRINUSE`, l'ancien code continue de répondre, et toutes les « vérifications »
portent sur du code périmé.

```bash
ps -eo pid,lstart,cmd | grep admin-server     # repérer le PID de node
stat -c '%y' server/api.mjs                   # date de la dernière modification
```

Si le processus est plus ancien que le fichier, vous parlez à l'ancien code.
`kill $(pgrep -f "node server/admin-server.mjs")` tue aussi votre propre shell : il
faut des PID explicites.

### La promesse rejetée qui tue le serveur

`job.finally(...)` crée une promesse dérivée qui **rejette** quand la tâche échoue.
Node 22 la traite comme un rejet non géré et termine le processus : un seul plan
malformé suffisait à arrêter le serveur audio. La chaîne porte un `.catch(() => {})`
et un filet `process.on('unhandledRejection')`. Ne pas retirer l'un ou l'autre.

### `dist/` appartenant à un autre utilisateur

`vite build` échoue alors en `EACCES … unlink dist/assets/…`, et `chmod` est refusé.
Renommer le dossier entier puis reconstruire dans un `dist/` neuf. Ne rien supprimer.

### Base de données

`data/admin/` est hors dépôt. Un `git clean -xdf` le détruit, avec les comptes et
l'historique éditorial. Sauvegarder avant :

```bash
npm run admin:backup
```

### Caches du laboratoire V2.1

Les rendus du laboratoire sont écrits sous `data/admin/renders/<id-hex>.wav`. Ne
jamais élaguer ce cache en triant par **nom** : les identifiants sont aléatoires, et
le tri par nom a déjà supprimé le rendu qui venait d'être écrit. Trier par date de
modification.

## 7. Ajouter une fonctionnalité : ordre de travail

1. Données d'abord : le catalogue, `config/postes.json` ou la base d'administration.
2. Règle de disponibilité ensuite (`src/data/publication.ts`), jamais dans l'écran.
3. Écran ensuite, avec les textes dans `i18n`.
4. Test : au minimum `typecheck` + le contrôle qui prouve le comportement ajouté.
5. Vérification navigateur, avec le critère de non-rechargement.
6. Documentation : le document `docs/` concerné, pas seulement le README.

## 8. Ce qu'il ne faut pas faire

- Réintroduire un filtre musical sur les sons dits « sensibles » : la politique a
  changé sur décision du propriétaire, et `policy.ts` est le seul endroit qui décide.
- Ajouter un endpoint qui lève une restriction éditoriale : il n'en existe aucun, par
  choix, et ce n'est pas un oubli.
- « Améliorer » le moteur sans mesure : l'historique montre que les intuitions non
  mesurées ont coûté plusieurs passes.
- Publier un fichier audio dont la licence n'est pas établie : voir
  `docs/ASSET-LICENSES.md`.
- Supprimer un fichier audio du disque pour « nettoyer » : les masters ne sont pas
  dans le dépôt, une suppression est définitive.
