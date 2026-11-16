# Sugar Orchestra

**Une installation musicale pour L'Aventure du Sucre, île Maurice.**
Le visiteur collecte les sons du musée en scannant des QR codes, choisit ceux qu'il
garde, et repart avec une pièce musicale.

Prototype conçu et présenté à **Muséomix 2026**. Ce dépôt est la version archivée et
transmissible du projet : code complet, documentation, échantillons de démonstration
et une démonstration statique publiée sur GitHub Pages.

| | |
|---|---|
| **Démonstration en ligne** | <https://ashmotif200.github.io/sugar-orchestra/> |
| **Version historique** | étiquette Git `museomix-2026` (voir [`docs/MUSEOMIX-2026.md`](docs/MUSEOMIX-2026.md)) |
| **Reprendre le projet** | [`docs/HANDOVER.md`](docs/HANDOVER.md) — à lire en premier si vous arrivez |
| **Licences des ressources** | [`docs/ASSET-LICENSES.md`](docs/ASSET-LICENSES.md) |

---

## 1. Présentation

Sugar Orchestra transforme une visite de musée en composition musicale. À chaque
poste du parcours, un QR code ouvre un son : la forêt tropicale, des pas sur le
sable, une cuillère dans une tasse, un marché, du sucre qui crisse, une charrette à
bœufs. Le visiteur écoute, découvre, puis décide d'**ajouter ou non** chaque son à
sa collection. Au bout du parcours, il écoute une pièce.

Le geste central est la distinction entre **écouter** et **garder**. Découvrir un son
ne l'ajoute pas ; c'est le visiteur qui compose sa sélection, et le résultat dépend
de cette sélection.

## 2. Origine du projet et contexte Muséomix 2026

Muséomix est un marathon de création numérique qui réunit un musée, une équipe de
médiation et des concepteurs pendant quelques jours, avec une présentation publique
à la fin. L'édition 2026 s'est tenue à **L'Aventure du Sucre**, aux Pamplemousses :
un ancien domaine sucrier devenu musée, qui raconte l'histoire de la canne, du sucre,
de l'esclavage et de l'engagisme à Maurice.

Le prototype a été développé et présenté dans ce cadre. Il n'a pas été commandé comme
produit final : c'est une **démonstration fonctionnelle**, avec des choix assumés et
des parties volontairement inachevées (§ 21).

## 3. Objectifs de l'installation

1. Faire écouter le musée autrement : un son par poste, court, identifiable.
2. Donner au visiteur un rôle actif — collecter, trier, décider.
3. Produire un objet personnel à la fin de la visite, pas un quiz.
4. Rester utilisable sur le téléphone du visiteur, sans installation d'application.
5. Ne jamais trahir le musée : les sons sont ceux du lieu, les textes historiques ne
   sont affichés que s'ils sont validés par le musée.

## 4. Concept du parcours visiteur

Le parcours comporte **sept étapes**, de l'origine volcanique de l'île à la bagasse
devenue électricité :

| # | Étape |
|---|---|
| 1 | Les origines : quand Maurice surgit de l'océan |
| 2 | Le sucre traverse les âges : du commerce à la dégustation |
| 3 | Les métiers du sucre : les artisans qui construisent l'industrie |
| 4 | La mémoire des plantations : esclavage, engagisme et travail agricole |
| 5 | La canne à sucre : une plante qui transforme le paysage |
| 6 | De la canne au sucre : le travail de transformation |
| 7 | De la bagasse à l'électricité : une nouvelle vie pour les résidus |

Le visiteur commence par choisir une **mascotte**, qui détermine l'univers musical
du résultat :

| Mascotte | Univers | Ambiance | État dans ce dépôt |
|---|---|---|---|
| **Martin** | Electro Sega | Énergétique | **disponible** |
| Mangouste | Sega traditionnel | Dansant | « Bientôt » |
| Dodo | Segazz | Détendu | « Bientôt » |
| Tortue | Ambient créole | Rêveur | « Bientôt » |

Seul Martin est ouvert. Les trois autres sont affichés, désactivés et marqués
« Bientôt » : ils ne sont jamais présentés comme disponibles.

Les écrans sont adressés par le fragment d'URL (routeur par hash) : `#/`, `#/parcours`,
`#/etape/N`, `#/poste/N`, `#/carnet`, `#/composer`, `#/resultat`. Aucune route n'est
rechargée depuis le serveur : c'est ce qui rend le déploiement statique et les QR
codes possibles.

## 5. Fonctionnement des QR codes

Huit **postes physiques** existent, un par sample. Chaque QR encode une adresse de la
forme `…/#/poste/3` — un **identifiant de poste**, jamais un nom de fichier.

1. Le visiteur scanne avec l'appareil photo de son téléphone (aucune application).
2. Le navigateur ouvre l'application à `#/poste/N`.
3. Si le sample du poste est publié, il est **ajouté automatiquement** au carnet —
   une seule fois, jamais de doublon.
4. Un QR inconnu ouvre un écran dédié qui n'ajoute rien et n'invente aucun contenu.
5. La fiche du poste propose d'écouter le son et de continuer la visite.

Depuis l'application, un bouton **« Scanner un QR code »** ouvre la caméra en
interne ; il n'est pas nécessaire pour la démonstration en ligne.

Les huit QR sont versionnés en PNG et en SVG, avec une planche A4 imprimable et un
tableau de correspondance : voir [`docs/QR-CODES.md`](docs/QR-CODES.md).

**Limite connue** : arriver par un QR **avant** d'avoir choisi une mascotte affiche
l'écran de choix. C'est le comportement voulu (l'univers doit être choisi une fois),
mais cela signifie qu'un scan isolé ne suffit pas à démarrer — le visiteur doit
d'abord choisir Martin.

## 6. Collecte des samples

- Un son **découvert** (écouté ou ouvert) est marqué d'un ✓ mais n'entre pas dans la
  musique.
- Un son **ajouté** entre dans la sélection, plafonnée par le catalogue.
- Le carnet présente les deux listes séparément et permet de retirer un son.
- La session est enregistrée dans le navigateur : elle survit à un rechargement.
- **« Nouvelle visite »** (écran de résultat) ou l'icône ↺ remet tout à zéro pour le
  visiteur suivant.

Les sons **non publiés** apparaissent dans les étapes, verrouillés « Bientôt », non
ouvrables et non écoutables. Ils existent pour montrer l'étendue du catalogue sans
promettre ce qui n'est pas disponible.

## 7. Carnet musical

Le carnet est l'écran de synthèse de la visite. Il liste les sons découverts et les
sons retenus, avec un lecteur partagé : play, pause, reprise réelle, forme d'onde
synchronisée sur la position du moteur audio. Le bouton « Découvrir le résultat »
mène à la pièce.

## 8. Personnages et univers musicaux

Chaque mascotte porte un univers sonore distinct, défini par des mesures sur des
enregistrements de référence (tempo, métrique, hiérarchie des couches, tonalité) et
non par une intuition :

| Univers | Caractère | Ce que la mesure impose |
|---|---|---|
| Electro Sega (Martin) | Énergétique | ~135 BPM, 4/4, subdivision ternaire, tonalité de fa ; construction en montée puis chute, la batterie devant la basse |
| Sega traditionnel (Mangouste) | Dansant | métrique ternaire, pas de basse nécessaire : le grave est porté par la grosse caisse |
| Segazz (Dodo) | Détendu | tempo proche du premier, mais **mixage** opposé : basse devant la batterie |
| Ambient créole (Tortue) | Rêveur | hypothèse, aucune référence mesurée — d'où le statut « Bientôt » |

Ces mesures sont documentées dans [`docs/music-engine-v2/`](docs/music-engine-v2/) et
[`docs/phase-a/`](docs/phase-a/). Elles ont servi à construire le moteur
expérimental, et à constater ses limites (§ 12 et § 21).

## 9. Démonstration Martin — Énergétique

La version présentée à Muséomix **ne compose pas** : à la fin du parcours, elle joue
un morceau précomposé par **Martin**, intitulé « Énergétique », et l'annonce comme
tel. L'écran de résultat précise explicitement que le morceau n'est pas généré à
partir des sons collectés.

Ce choix est un choix de démonstration, pas une capacité du produit :

- le morceau est un **enregistrement**, transmis par son auteur ;
- il est **indépendant** de la sélection du visiteur : deux visiteurs qui gardent des
  sons différents entendent le même morceau ;
- le moteur de composition existe, il fonctionne, mais le résultat qu'il produit n'a
  pas été jugé convaincant à l'écoute — voir § 12 et § 21.

Le mode démonstration est commandé par un drapeau, `src/data/demo.ts` →
`demoMode.enabled`. Le passer à `false` réactive le parcours de génération réel, qui
est intact.

## 10. Lecture du morceau final

Le morceau est publié en deux formats, dans `public/demo/` :

| Fichier | Format | Rôle |
|---|---|---|
| `energetique-v1.m4a` | AAC-LC dans un conteneur MP4, 1,17 Mo | **lecture** : c'est la source utilisée par le lecteur |
| `energetique v1.wav` | PCM 24 bits / 48 kHz / stéréo, 13,8 Mo | fichier d'origine et repli |

Le WAV 24 bits **n'est pas décodé par Safari sur iOS** : c'est la raison d'être de la
version AAC. Le mixage est identique dans les deux fichiers ; seul le conteneur
change. Le lecteur utilise un élément `<audio controls playsInline>` natif, sans
passer par le moteur audio : rien ne dépend de `AudioContext` pour écouter le
morceau.

## 11. Architecture technique

```
                    ┌─────────────────────────────────────────┐
   téléphone ──────▶│  Application visiteur (React + Vite)    │
   (QR, Safari)     │  routes par hash, session localStorage  │
                    └───────────────┬─────────────────────────┘
                                    │  audio : Web Audio API, décodage à la demande
                    ┌───────────────▼─────────────────────────┐
                    │  Moteur de composition (dans le browser)│
                    │  V1 (historique) · V2.0 · V2.1 (essais) │
                    └─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────────┐
                    │  Serveur Super Admin (Node, sans cadre) │
                    │  SQLite · API REST · rendu V2 serveur   │
                    │  127.0.0.1:5182                         │
                    └─────────────────────────────────────────┘
```

Trois ensembles indépendants :

1. **Le site visiteur** : une application statique. Tout le parcours fonctionne sans
   serveur, y compris l'écoute et (en mode réel) la composition, qui se fait dans le
   navigateur via `OfflineAudioContext`.
2. **Le serveur d'administration** : Node sans dépendance de framework, SQLite, API
   REST authentifiée, et rendu audio côté serveur pour les essais du moteur V2. Il
   n'est **pas** nécessaire au visiteur.
3. **Les outils hors application** : scripts d'import et d'archivage du catalogue,
   génération des QR, analyses musicales en Python (hors périmètre Node).

Détail complet, contrats de données et décisions : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 12. Technologies et dépendances

| Couche | Technologie | Version |
|---|---|---|
| Frontend | React + React DOM | 18.3 |
| Build | Vite | 6.x |
| Langage | TypeScript | 5.7 |
| Audio navigateur | Web Audio API (`AudioContext`, `OfflineAudioContext`) | native |
| Lecture de QR | jsQR | 1.4 |
| Génération de QR (outil) | qrcode + pngjs | 1.5 / 7.x |
| Administration | Node.js (ESM, sans framework HTTP) | **≥ 22.5** (`node:sqlite`) |
| Base de données | SQLite via `node:sqlite` | intégré à Node, aucune compilation |
| Analyses musicales (outil) | Python 3 + numpy, scipy, librosa, soundfile | voir `docs/INSTALLATION.md` |

**Dépendances de production** : React, React DOM, jsQR. Tout le reste est outillage.
Aucun service externe, aucune API tierce, aucune police servie depuis un CDN.

## 13. Installation locale

Prérequis : **Node.js ≥ 22.5** (22 LTS ou 24) et npm. La version est imposée par
`node:sqlite`, utilisé par le serveur d'administration sans dépendance externe. Le
site visiteur seul se construit avec Node ≥ 20.

**Version vérifiée lors de l'archivage** : Node 22.22.3, npm 10.9.8.

```bash
git clone https://github.com/ashmotif200/sugar-orchestra.git
cd sugar-orchestra
npm ci
```

`npm ci` installe exactement les versions du `package-lock.json`. Aucune variable
d'environnement n'est nécessaire pour lancer le site visiteur.

## 14. Configuration

Tout est facultatif ; le projet démarre sans configuration.

```bash
cp .env.example .env      # puis ajuster si besoin
```

| Variable | Défaut | Usage |
|---|---|---|
| `SO_HOST` | `127.0.0.1` | interface d'écoute du serveur d'administration |
| `SO_PORT` | `5182` | port du serveur d'administration |
| `SO_DATA_DIR` | `data/admin` | base SQLite, fichiers versionnés, publications |
| `SO_HTTPS` | `0` | `1` ajoute `Secure` au cookie de session (derrière HTTPS) |
| `SO_ALLOWED_HOSTS` | vide | hôtes supplémentaires pour le serveur de dev / preview |
| `SO_ANALYSIS_HOME` | vide | racine du toolchain d'analyse Python (facultatif) |

Les variables `SO_*` ne concernent **que** le développement et l'administration.
Le site publié sur GitHub Pages est un build statique : il n'en lit aucune.

## 15. Démarrage du frontend

```bash
npm run dev        # http://127.0.0.1:5180  (rechargement à chaud)
```

Pour présenter la démonstration, préférer le build statique : le serveur de
développement renvoie des rechargements de page à chaque modification de fichier,
ce qui est la cause du « rechargement intempestif » constaté sur téléphone.

```bash
npm run build && npm run preview    # http://127.0.0.1:5181
```

## 16. Démarrage du backend

Le serveur d'administration sert l'API **et** le build (`dist/`), sur la boucle
locale uniquement :

```bash
npm run build          # le serveur sert dist/ : il doit exister
npm run admin:serve    # http://127.0.0.1:5182/#/admin
```

Aucun compte n'existe par défaut. Le premier compte se crée explicitement :

```bash
npm run admin:provision -- --email vous@exemple.org --name "Votre nom"
```

Le mot de passe n'est **jamais** affiché à l'écran : il est écrit une fois dans
`data/admin/first-admin.txt` (droits 600). Voir
[`docs/admin/README.md`](docs/admin/README.md).

## 17. Build

```bash
npm run build          # build servi par l'API d'administration (dist/)
npm run build:pages     # build statique pour GitHub Pages (aucun appel /api)
```

Les deux utilisent `base: './'`, donc le même bundle fonctionne à la racine d'un
domaine **et** dans un sous-chemin (`/sugar-orchestra/`). Le second pose
`VITE_STATIC_HOSTING=1`, ce qui : lit l'état de publication et le contenu éditorial
dans les instantanés embarqués, n'émet aucune requête `/api`, et ramène `#/admin` à
l'accueil visiteur.

## 18. Tests

```bash
npm run typecheck      # types TypeScript
npm run build          # requis avant admin:test : le serveur sert dist/
npm run admin:test     # API d'administration : base jetable, vrai serveur, vraie CLI
npm run v2:test        # moteur V2.0 : déterminisme, invariants, rendu
node tests/v2/v21.test.mjs   # moteur V2.1 : 22 contrôles
```

Dans l'atelier (masters audio présents) : **56/56**. Sur un clone du dépôt, deux
contrôles sont **ignorés** — ils dépendent des masters de `assets/originals/`, non
publiés — et le harnais l'affiche (`54/54 · 2 ignorés`). Un contrôle qui ne peut pas
tourner est nommé, jamais compté comme un succès.

Et dans le navigateur, la suite d'invariants du moteur V1 — **en deux lots**, un seul
onglet sature en mémoire sur huit rendus :

```
http://127.0.0.1:5181/?selftest=1&batch=1
http://127.0.0.1:5181/?selftest=1&batch=2
```

Les analyses musicales ont leurs propres harnais Python (`scripts/phase-a/verify*.py`,
`scripts/v2/build-style-models.py --check`) qui ne sont couverts par **aucun** test
JavaScript : voir [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## 19. Déploiement

La démonstration publique est un **build statique** publié sur GitHub Pages :

```bash
npm run build:pages
npx gh-pages -d dist       # ou la méthode décrite dans docs/DEPLOYMENT.md
```

Aucun serveur, aucune base de données, aucun secret n'est nécessaire. Le parcours a
été conçu pour cela : les données dont il a besoin (catalogue, état de publication,
postes, audio) sont des fichiers versionnés.

Procédure complète, y compris la régénération des QR codes pour une nouvelle adresse :
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## 20. Gestion des ressources audio

| Dossier | Contenu | Publié ? |
|---|---|---|
| `public/audio/demo/*.wav` | les 8 samples de 5 s de la démonstration | **oui** |
| `public/demo/` | le morceau final (WAV + AAC) | **oui** |
| `assets/demo-sources/` | les fichiers reçus, intacts | oui |
| `public/audio/*.m4a` | 40 versions de diffusion 20 s | **non** (droits non établis) |
| `assets/originals/` | 40 masters 20 s | **non** |
| `assets/references/` | mix et stems de référence | **non** |

Les fichiers non publiés sont conservés hors dépôt et restaurables ; leur
réintégration est décrite dans [`docs/AUDIO.md`](docs/AUDIO.md). **Aucun son du
catalogue n'a été supprimé.**

## 21. Limitations actuelles

Elles sont assumées et documentées, pas dissimulées.

**Le produit**

1. Le morceau final est **précomposé**, pas généré : la sélection du visiteur ne
   change pas la musique. C'est le point le plus important à ne pas surinterpréter.
2. Trois univers sur quatre sont « Bientôt ». Aucun n'est implémenté.
3. Les textes historiques validés par le musée n'ont pas été fournis : les fiches
   affichent « Description à venir » plutôt que d'inventer une histoire.
4. Pas de partage, pas de compte, pas de bracelet NFC : hors périmètre.

**Le moteur expérimental**

5. Sur les 40 sons du catalogue, **aucun n'est utilisable comme basse** et cinq
   seulement ont une hauteur crédible : la matière ne permet pas de porter une
   harmonie. Le premier moteur écrivait des lignes de notes à partir de bruit.
6. Les essais V2 produisaient, à l'écoute, un résultat jugé non musical par le
   propriétaire — constat mesuré et documenté, pas une impression.
7. Le moteur V1 et les moteurs V2 restent dans le dépôt, fonctionnels mais **hors du
   parcours de démonstration**.

**La technique**

8. Le scanner de QR n'a été validé qu'en navigateur de bureau (Chromium). **Aucun
   test sur caméra d'iPhone physique** n'a été réalisé.
9. Un scan de QR avant le choix de la mascotte renvoie à l'écran de choix.
10. Pas d'application hors-ligne complète (service worker) : la session survit, pas
    le téléchargement des sons déjà écoutés.

## 22. Roadmap

Voir [`docs/ROADMAP.md`](docs/ROADMAP.md). En résumé : valider les textes avec le
musée, décider du statut des trois univers restants, puis reprendre la question du
moteur — avec un morceau de référence produit à la main comme étalon, avant toute
automatisation.

## 23. Crédits

| | |
|---|---|
| **Équipe Sugar Orchestra — Muséomix 2026** | |
| Personnages et illustrations | **Noémie** |
| Développement et démonstration musicale | **Ashley** |
| Gestion et coordination | **Tanguy** |
| Contexte historique | **Tejsree** |
| Bornes de mapping | **Keisa** |
| Crédits rattachés à une ressource | |
| Enregistrement du Lota (`04_09_Lota.wav`) | **Tanguy** |
| Composition du morceau final « Énergétique » | **Martin** |
| Sons de bibliothèque | SoundBible, Freesound, BigSoundBank — détail fichier par fichier dans [`docs/ASSET-LICENSES.md`](docs/ASSET-LICENSES.md) |
| Lieu | L'Aventure du Sucre, Pamplemousses, Maurice |

Seuls les prénoms sont consignés, par choix. La liste de référence est
`src/data/credits.ts` : l'interface, ce README et la documentation y renvoient.

Les crédits complets, son par son, sont dans `src/data/catalog.json` (champ
`credits`) et affichés dans l'application.

## 24. Licences

- **Code** : voir [`LICENSE`](LICENSE) (MIT).
- **Ressources audio et illustrations** : licences distinctes, détaillées dans
  [`docs/ASSET-LICENSES.md`](docs/ASSET-LICENSES.md). La licence du code ne couvre
  **pas** les ressources : c'est écrit en tête du fichier `LICENSE`.
- **Créations des auteurs** (enregistrement de Tanguy, personnages de Noémie, morceau
  de Martin) : les auteurs sont identifiés et leur accord pour ce projet est confirmé.
  **Aucune licence** — MIT, CC0, Creative Commons ou autre — ne leur est attribuée.
  Les conditions d'une charte juridique Muséomix existent mais ne sont pas encore
  disponibles ; elles resteront à vérifier. Rien n'est présenté comme définitivement
  vérifié, et aucune ressource n'a été retirée au motif que cette charte manque.
- **Samples de bibliothèque** : CC0 ou domaine public vérifié à la source pour six des
  huit samples (SoundBible, Freesound, BigSoundBank) ; les crédits sont affichés dans
  l'application, son par son.
- **Polices** : DM Sans et Fraunces, SIL Open Font License 1.1 — textes de licence
  versionnés dans `src/assets/fonts/`.

## 25. Contribution et reprise du développement

Si vous reprenez ce projet, commencez par
[`docs/HANDOVER.md`](docs/HANDOVER.md) : il indique ce qui fonctionne, ce qui est
expérimental, ce qui a été désactivé pour la démonstration et ce qui reste à faire,
composant par composant.

Conventions utiles :

- le français est la langue du contenu et des commentaires ;
- les textes d'interface ne sont jamais écrits en dur dans les écrans
  (`src/i18n/fr.json` et `en.json`) ;
- un son, un poste et un état de collecte sont trois choses distinctes : ne pas les
  confondre dans le code ;
- ne pas « améliorer » le moteur sans une mesure à l'appui — l'historique du projet
  montre que les intuitions non mesurées ont coûté plusieurs passes.

## Carte du dépôt

```
src/
  App.tsx                     routes, session, enchaînement des écrans
  router.ts                   routeur par hash (#/poste/3, #/etape/2…)
  session.ts                  session visiteur (localStorage, versionnée)
  audio/                      décodage à la demande, préécoute, lecteur partagé
  data/                       catalogue, publication, postes, éditorial, démo
  engine/                     moteur V1 (historique) + politique musicale
  engine-v2/                  moteurs V2.0 et V2.1 (expérimental)
  ui/screens/                 Accueil, Parcours, Étape, Poste, Carnet, Résultat
  i18n/                       fr.json, en.json
  admin/                      Super Admin (chargé à la demande, jamais pour un visiteur)
server/                       serveur d'administration (Node, SQLite, API REST)
scripts/                      import/archivage, QR, analyses, sauvegarde
config/                       étapes du parcours, postes, base des QR
public/audio/demo/            les 8 samples de 5 s (publiés)
public/demo/                  le morceau final (publié)
public/mascots/               les 4 mascottes
docs/                         documentation (voir docs/README.md)
```

## Historique

L'historique Git est celui du développement réel, du 13 au 16 novembre 2026. Il
contient plusieurs passes de diagnostic, y compris celles qui ont abouti à constater
que le moteur expérimental ne produisait pas un résultat musical satisfaisant. Ces
passes sont conservées : elles expliquent les décisions du projet mieux qu'un résumé
a posteriori. Voir [`docs/MUSEOMIX-2026.md`](docs/MUSEOMIX-2026.md).
