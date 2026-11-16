# Reprendre le projet — guide de transmission

**Si vous lisez un seul document, lisez celui-ci.** Il dit où vous mettez les pieds,
ce qui marche, ce qui ne marche pas, et par quoi commencer.

Temps de lecture : 15 minutes. Temps de mise en route : 5 minutes.

---

## 1. En trois phrases

Sugar Orchestra est une installation musicale pour le musée **L'Aventure du Sucre**
(Maurice) : le visiteur scanne des QR codes aux postes du parcours, chaque scan lui
donne un son, il choisit ceux qu'il garde, et il repart avec un morceau.

C'est un **prototype présenté à Muséomix 2026**, pas un produit fini.

**La version présentée ne compose pas** : elle joue un morceau précomposé par Martin,
et l'écran de résultat le dit explicitement. Le moteur de composition existe dans le
dépôt, il fonctionne, mais le résultat qu'il produit n'a pas convaincu à l'écoute.

## 2. Par où commencer

### Voir la démonstration (5 min)

<https://ashmotif200.github.io/sugar-orchestra/>

1. Choisir **Martin**.
2. Parcourir les sept étapes, ou ouvrir `#/poste/1` à `#/poste/8`.
3. Ouvrir le carnet, écouter des sons.
4. « Découvrir le résultat » → le morceau final.
5. « Nouvelle visite » pour recommencer.

### Faire tourner le projet en local (5 min)

```bash
git clone https://github.com/ashmotif200/sugar-orchestra.git
cd sugar-orchestra
npm ci
npm run build:pages
python3 -m http.server 5199 --directory dist     # http://127.0.0.1:5199
```

### Comprendre le code (30 min)

Lire, dans cet ordre :

1. `src/router.ts` — six routes, tout est là.
2. `src/session.ts` — l'état d'un visiteur, très simple.
3. `src/App.tsx` — l'enchaînement des écrans (un seul fichier, ~470 lignes).
4. `src/data/postes.ts` + `config/postes.json` — le lien QR → son.
5. `src/data/publication.ts` — la règle unique de disponibilité.
6. `src/ui/screens/` — un fichier par écran.

`docs/ARCHITECTURE.md` donne la vue d'ensemble et les flux complets.

---

## 3. Ce qui fonctionne

Vérifié le 16 novembre 2026 sur la démonstration publiée et en local.

| Fonction | État | Où |
|---|---|---|
| Choix de la mascotte | ✅ | `src/ui/screens/Home.tsx` |
| Parcours en 7 étapes | ✅ | `Parcours.tsx` |
| Fiche d'un son, écoute | ✅ | `Step.tsx` |
| 8 postes QR, collecte automatique | ✅ | `Poste.tsx`, `src/data/postes.ts` |
| Carnet, ajout/retrait, lecteur partagé | ✅ | `Carnet.tsx`, `audio/useSamplePlayer.ts` |
| Session persistée au rechargement | ✅ | `src/session.ts` |
| Résultat : morceau final (AAC sur Safari iOS) | ✅ | `DemoResult.tsx` |
| Nouvelle visite | ✅ | `App.tsx` (`restart`) |
| Build statique sans serveur | ✅ | `npm run build:pages` |
| Administration : 8 modules, permissions, audit | ✅ | `src/admin/`, `server/` |
| Génération du 8 QR avec auto-vérification | ✅ | `scripts/qr/make-posters.mjs` |
| Moteur V1 (composition dans le navigateur) | ✅ mais hors parcours | `src/engine/` |
| Moteurs V2.0 / V2.1 (planification, basse, rendu serveur) | ✅ mais hors parcours | `src/engine-v2/` |

## 4. Ce qui est expérimental

Fonctionne, mais n'est pas au niveau d'un produit et ne fait pas partie de la
démonstration.

| Élément | Ce que ça fait | Pourquoi ce n'est pas dans la démo |
|---|---|---|
| **Moteur V1** | compose une pièce à partir des sons retenus, dans le navigateur, de façon déterministe | le résultat n'a pas convaincu à l'écoute ; sur 40 sons, aucun n'est utilisable comme basse et 5 seulement ont une hauteur crédible |
| **Moteur V2.0** | introduit des capacités mesurées, des profils musicaux versionnés, un modèle temporel ternaire | même limite de matière ; pas de mastering |
| **Moteur V2.1** | composition par motifs, variations, basse synthétique hybride, rendu serveur | idem ; 14 dB d'écart de niveau entre univers |
| **Laboratoires** (`#/admin/lab`, `#/admin/lab21`) | écouter et comparer les rendus avec paramètres et métriques | outil de développement, permission `dev.use` |
| **Analyses musicales Python** | mesurent tempo, métrique, harmonie, motifs sur les références | nécessitent des fichiers absents du dépôt |

Ce que ces moteurs ne font **pas** : produire un morceau jugé musical. C'est un
constat documenté, pas un préjugé — voir `docs/strategie/reevaluation-musicale.md` et
`docs/music-engine-v2/`.

## 5. Ce qui a été désactivé pour la démonstration

| Élément | Comment c'est désactivé | Comment le réactiver |
|---|---|---|
| Génération musicale | `src/data/demo.ts` → `demoMode.enabled = true` | passer à `false` — le parcours de composition réel reprend, sans autre changement |
| 32 sons du catalogue | statut `draft` en base → verrouillés « Bientôt », non écoutables | `node scripts/admin/demo-samples.mjs --restore`, puis exporter et redéployer |
| 3 univers sur 4 | `published` + `engine_implemented` en base | changer les statuts ; mais aucun n'est implémenté, donc cela n'afficherait qu'une promesse |
| Administration en ligne | `VITE_STATIC_HOSTING=1` → `#/admin` renvoie à l'accueil | servir le site derrière le serveur d'administration (`npm run admin:serve`) |
| Contenu éditorial | instantané vide en mode statique | publier, appliquer, réexporter |

**Le code de tout cela est intact.** Rien n'a été supprimé pour faire la démonstration.

## 6. Ce qui reste à développer

Par ordre de valeur décroissante, avec la raison.

1. **Trancher la question du moteur.** La matière sonore ne porte pas d'harmonie
   (0/40 sons utilisables en basse). Trois issues : assumer un accompagnement
   précomposé et l'écrire (décision déjà prise par le propriétaire le 13/11/2026),
   enregistrer 2–3 sons graves au musée, ou renoncer à la composition en direct.
   Rien ne doit être automatisé avant qu'un morceau produit **à la main** convainque.
2. **Faire valider les textes par le musée.** Les fiches affichent « Description à
   venir. » plutôt qu'une histoire inventée. C'est un manque de contenu, pas un bug.
3. **Décider du sort des trois univers restants.** Les afficher « Bientôt » est
   honnête ; les promettre sans les implémenter ne le serait pas.
4. **Tester le scanner sur un iPhone physique.** Le décodage a été validé en
   navigateur de bureau uniquement.
5. **Compléter la chaîne de droits** : les conditions de la charte juridique
   Muséomix, encore indisponible, et l'autorisation écrite de diffusion du morceau de
   Martin. Auteurs et accords sont identifiés — voir `docs/ASSET-LICENSES.md` § 5.
6. **Attendre la validation iPhone** du parcours et du scan caméra.
7. **Mode hors-ligne complet** (service worker) si l'usage en musée l'exige : la
   session survit déjà à un rechargement, pas le téléchargement des sons.

## 7. Les cinq choses à ne pas casser

1. **Le morceau n'est pas généré.** Ne jamais présenter le morceau de Martin comme
   produit à partir des sons collectés. L'écran de résultat le dit ; le dire aussi.
2. **La règle de disponibilité est unique.** `src/data/publication.ts`. Un univers est
   proposé s'il est publié *et* si son moteur existe. Ne pas écrire
   `status === 'published'` ailleurs.
3. **Publier n'est pas appliquer.** `POST /api/publication/publish` ne change pas ce
   que voit le visiteur. Seul `npm run admin:apply` le fait, et il demande l'accord du
   propriétaire.
4. **Aucune route ne lève une restriction éditoriale.** Ce n'est pas un oubli :
   c'est la protection.
5. **Ne pas publier un audio dont la licence n'est pas établie.** Voir
   `docs/ASSET-LICENSES.md`.

## 8. Comprendre les données

### Le catalogue (`src/data/catalog.json`)

40 sons. Pour chacun : `code` (`01_02`), `name`, `stepId`, `credits`, `license`,
`file` (chemin relatif à `public/`), `originalFile`, `sensitive`, `availability`, et
un bloc `analysis` de mesures.

- 8 sons pointent vers `audio/demo/NN_NN.wav` (les samples de 5 s publiés) ;
- les 32 autres pointent vers `audio/NN_NN.m4a`, **absent du dépôt** (droits non
  établis). Ils restent visibles, verrouillés « Bientôt ».

### L'état de publication (`src/data/publication.json`)

Instantané exporté depuis la base : `universes[]` et `sounds[]` avec leur statut.
C'est la source en hébergement statique.

### Les postes (`config/postes.json`)

8 postes : `id`, `qr` (`poste-3`), `sampleCode` (`02_01`), `title`, `description`.
La description est `null` : l'écran affiche « Description à venir. »

### Les étapes (`config/steps.json`)

Les 7 étapes et les codes de sons rattachés. Peut être réécrit par `admin:apply`.

**Trois notions distinctes** : un *son* (catalogue), un *poste* (lieu + QR), l'*état
de collecte* (session du visiteur). Ne pas les confondre.

## 9. Tâches courantes

| Je veux… | Faire |
|---|---|
| changer le titre d'un poste | `config/postes.json`, champ `title` |
| changer la description d'un poste | `config/postes.json`, champ `description` |
| changer le son d'un poste | `config/postes.json`, champ `sampleCode` |
| ajouter un sample | `docs/AUDIO.md` § 5 — fichier, catalogue, publication, droits |
| changer les textes d'un son | via l'administration (contenu éditorial), pas à la main |
| changer l'ordre des étapes | `config/steps.json` ou la base |
| changer l'adresse de la démo | `config/qr.json` puis régénérer les QR |
| changer le morceau final | remplacer `public/demo/energetique v1.wav`, régénérer l'AAC |
| relancer les services | `docs/INSTALLATION.md` |
| publier une nouvelle version | `docs/DEPLOYMENT.md` |
| administrer | `docs/ADMINISTRATION.md` + `docs/admin/README.md` |

## 10. Administration en trois lignes

```bash
npm run build
npm run admin:serve                                                   # 127.0.0.1:5182/#/admin
npm run admin:provision -- --email vous@exemple.org --name "…"        # premier compte
```

Le mot de passe arrive dans `data/admin/first-admin.txt` (droits 600), jamais à
l'écran.

## 11. Comprendre le moteur musical (si vous y allez)

Ce que le projet a appris, en une page :

- **Le tempo n'est pas un entier.** Une mesure ternaire ne s'exprime pas en BPM. Le
  modèle est `(barSeconds, beatsPerBar, subdivision)`. Un champ `bpm: number` ne peut
  pas représenter une mesure 6/8 — c'est ainsi que le premier moteur a écrit du 4/4
  sur de la musique ternaire.
- **Les rôles viennent de mesures, pas d'intuitions.** Attribuer une basse parce
  qu'un fichier a une fréquence dominante produit des lignes de notes écrites à partir
  de bruit.
- **Mesurer n'est pas autoriser.** Un son peut porter des mesures dans un tableau de
  capacités sans jamais porter de rôle de composition.
- **Un test vert ne prouve pas qu'il y a de la musique.** 22 tests passaient alors que
  le moteur ne produisait aucune note avec une hauteur. Compter le contenu musical
  dans l'artefact, pas seulement les invariants.
- **Le morceau produit à la main est l'étalon.** Rien ne s'automatise avant qu'il
  convainque.

Documents : `docs/music-engine-v2/` (architecture, profils, stratégie de
transformation), `docs/phase-a/` (mesures des références, capacités du corpus),
`docs/v2.0.5/`, `docs/v2.1/`, `docs/strategie/`.

## 12. Déployer une nouvelle version

```bash
export GITHUB_TOKEN=$(sed -n 's/.*oauth_token: *//p' ~/.config/gh/hosts.yml | head -1)
bash scripts/deploy/publish-pages.sh
```

Le script clone le dépôt dans `/tmp`, construit, contrôle le bundle (8 samples
exactement, aucun `*.m4a` non publié) et pousse sur `gh-pages`. Voir
`docs/DEPLOYMENT.md`.

## 13. État de l'archive

| | |
|---|---|
| Dépôt | <https://github.com/ashmotif200/sugar-orchestra> (public) |
| Démonstration | <https://ashmotif200.github.io/sugar-orchestra/> |
| Branche principale | `main` |
| Version historique | étiquette `museomix-2026` → commit `38f8490` (14/11/2026 10:54 UTC) |
| Tests | types OK · admin 56/56 · V2.0 18/18 · V2.1 22/22 |
| Sauvegarde indépendante | hors dépôt, manifeste SHA-256 de 1 215 fichiers |

## 14. Questions fréquentes

**Pourquoi le morceau ne change-t-il pas quand je change ma sélection ?**
Parce qu'il est précomposé. C'est le choix de démonstration. `demoMode.enabled = false`
réactive la génération réelle.

**Pourquoi seulement huit sons sont-ils écoutables ?**
Huit seulement sont publiés, et huit seulement sont publiés parce que les droits de
redistribution des 32 autres ne sont pas établis. Voir `docs/ASSET-LICENSES.md`.

**Pourquoi un QR scanné seul ne démarre-t-il pas la visite ?**
Parce que la mascotte (donc l'univers musical) doit être choisie d'abord. C'est
volontaire, mais c'est une limite d'usage réelle.

**Pourquoi `npm run admin:test` échouait-il sur un contrôle ?**
Il est réparé : 56/56. Le contrôle d'immobilité du bundle mesurait un champ interne au
lieu de comparer l'empreinte avant/après publication. Détail dans
`docs/DEVELOPMENT.md` § 5.

**Où sont les 40 sons du catalogue ?**
Hors dépôt, dans la sauvegarde indépendante et `data/archive/catalog-40/`. Aucun n'a
été supprimé. `docs/AUDIO.md` § 4 explique comment les réintégrer.
