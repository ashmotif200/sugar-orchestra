# Sugar Orchestra — prototype Muséomix

L'Aventure du Sucre (Maurice). Le visiteur écoute les sons du musée, les collecte,
choisit ceux qu'il garde, puis génère une pièce composée **uniquement** de ces sons.

Ce dépôt implémente le dossier de transmission du 13 novembre 2026 (direction C
« Tronçons ») : six écrans routés, sept étapes, deux univers réellement fonctionnels.

---

## 1. Lancer

```bash
cd /workspace/sugar-orchestra
npm install            # déjà fait
npm run dev            # http://127.0.0.1:5180
```

Pour la présentation (plus rapide, sans HMR) :

```bash
npm run build
npm run preview        # http://127.0.0.1:5181
```

Les sons sont décodés **à la demande, par étape** : ouvrir l'étape 6 ne télécharge
que ses six fichiers. Une fois une étape chargée, plus aucun accès réseau n'est
nécessaire pour l'écouter ou composer. Un bandeau signale la perte de connexion.

## 2. Routes (hash router, cibles de QR codes)

| Route | Écran |
|---|---|
| `#/` | Accueil + choix d'univers |
| `#/parcours` | Les sept étapes |
| `#/etape/:id` | Étape et fiche son (1 à 7) |
| `#/carnet` | Carnet : découverts / dans ma musique |
| `#/composer` | Génération |
| `#/resultat` | Résultat |

Arriver par `#/etape/6` sans univers choisi n'empêche pas d'écouter ; il faut choisir
un univers avant de composer.

## 3. Scénario de présentation (2–3 min)

1. **Accueil** — « Collectez les sons. Créez votre musique. » Deux univers sont actifs,
   deux annoncent « Bientôt » (jamais présentés comme disponibles).
2. **Parcours** — les sept tronçons de canne. Étape 4 « La mémoire des plantations »
   porte le badge *Écoute contextualisée* ; étape 5 « La canne » le badge *À confirmer*.
3. **Fiche son** — écouter (jamais automatique), le son passe à « Son découvert »,
   puis « + Ajouter à ma musique ». Découvrir ≠ inclure : c'est le cœur du geste.
4. **Carnet** — deux onglets, retrait possible, compteur dans la barre du haut.
5. **Composer** — trois phases réelles (décodage, écriture, rendu), annulables.
6. **Résultat** — lecture, forme d'onde colorée par son d'origine, « Les sons utilisés »
   avec l'instant de chacun, téléchargement WAV. Pas de bouton de partage : il n'existe
   pas, il n'est pas affiché.

**La démonstration qui convainc** : refaire une pièce avec **les mêmes sons** dans
l'autre univers. Electro Sega (112 BPM, 4/4, tambour filtré) et Sega traditionnel
(126, 6/8, ravanne/triangle, appel-réponse) donnent deux morceaux franchement
différents avec la même matière.

**Plan B** : `assets/backup/demo-electro-sega.wav` et `demo-sega-traditionnel.wav`
sont deux pièces déjà rendues par le moteur avec les vrais sons (35,9 s, crête −1 dB).
Si le navigateur lâche, on les lit dans n'importe quel lecteur.

**Réinitialisation** entre deux passants : « Nouvelle visite » sur le résultat, ou
vider `localStorage` (clé `sugar-orchestra.session.v1`).

## 4. Contenu : 7 étapes, 40 sons

`config/steps.json` rattache les séquences de l'inventaire aux sept étapes :
1 Origines · 2 Âges du sucre · 3 Métiers · 4 Mémoire · 5 Canne · 6 Canne → sucre ·
7 Bagasse. Les séquences 7 et 8 de l'inventaire sont réunies dans « Bagasse » : le
dossier décrit sept étapes pour huit séquences. **C'est une proposition à valider**
(le dossier liste d'ailleurs « la liste finale des sons, étape 5 notamment » comme
point ouvert).

Répartition importée : 5 / 5 / 4 / 13 / 2 / 6 / 5 sons. L'étape 5 ne contient que
deux sons : elle est affichée « À confirmer », sans prétendre à une étape complète.

**Sons sensibles** — `04_01_Fouet`, `04_02_Fers_chaines`, `04_05_Ayo_MAQUETTE_A_VALIDER`
sont marqués `sensitive` / `not_musical` dans le catalogue. Ils restent écoutables
dans l'étape 4 (écoute contextualisée) mais :
- le bouton d'ajout n'existe pas, remplacé par « Histoire seulement » ;
- le moteur les refuse explicitement (`buildScore` filtre `sensitive` et
  `not_musical`), même si l'état de session était modifié à la main.

**Anecdotes** : aucun texte historique validé n'a été fourni. La fiche affiche la
`note` de l'inventaire, libellée « Note d'enregistrement » — jamais une histoire
inventée. Le champ `history` existe pour recevoir les textes du musée.

## 5. Moteur de composition

Tout dans le navigateur (`OfflineAudioContext`), aucun serveur.

- **Analyse** (`scripts/lib/analyze.mjs`) : FFT, centroïde, aplaticité, passages par
  zéro, hauteur par NSDF/McLeod, attaques par flux d'énergie robuste, et **énergie de
  chaque attaque** (sert à choisir le passage le plus représentatif).
- **Rôles** (`src/engine/roles.ts`) : Basse, Mélodie, Rythmique, Ear candy, Texture.
  Les rôles validés priment ; sinon le moteur promeut un son par mesure et l'affiche
  comme **adaptation** sur le résultat.
- **Univers** (`src/engine/plan.ts`) : Electro Sega (112 BPM, 16 mesures) et Sega
  traditionnel (126 à la noire, 6/8, 24 mesures). Chacun découpe, transpose, filtre,
  granule et boucle **uniquement** les sons retenus.
- **Rendu** (`src/engine/render.ts`) : graphe par événement, bus par rôle, écho
  procédural, compresseur, normalisation loudness (≈ −17 dBFS RMS, crête ≤ −1 dBFS).
- **Déterminisme** : graine = univers + identifiants triés. Même collection = même
  pièce, quel que soit l'ordre des clics (écart mesuré entre deux rendus : 5 × 10⁻⁷).

### Les trois invariants

1. `usedSourceIds ⊆ selectedSourceIds` — le rendu ne reçoit que les buffers retenus.
2. `selectedSourceIds ⊆ recognizableSourceIds` — **passe de signature** : chaque son
   gardé reçoit un passage brut (rate 1,0, sans filtre, sans inversion, sans
   granulation), posé sur **son attaque la plus énergique**, et toute la musique est
   duckée à 0,18 sous ce passage. Sans ce ducking, la mesure a montré que les sons
   étaient noyés sous le groove.
3. Aucun sample externe — aucun buffer hors catalogue.

### Vérifier

```
http://127.0.0.1:5180/?selftest=1&batch=1
http://127.0.0.1:5180/?selftest=1&batch=2
```

Huit cas (deux univers, sélections riches, tout-texture, 2 sons, 1 son). Chaque lot
rend quatre pièces et vérifie sources étrangères, signature de chaque son, durée,
saturation, déterminisme et **reconnaissabilité mesurée** (corrélation croisée du
passage brut avec l'enregistrement source, ±50 ms). Deux lots parce qu'un seul onglet
sature en mémoire sur huit rendus.

Dernier passage sur les vrais sons : **8/8 cas OK**, corrélations **0,68 → 0,98**,
crête −1,0 dBFS, 35,9 s par pièce, déterminisme 5,5 × 10⁻⁷.

## 6. Assets et crédits

| Élément | État |
|---|---|
| `Inventaire.csv` (40 lignes) | 40/40 correspondances code → fichier, 0 manquant, 0 doublon |
| `Sons_sucre_40_pistes_20s.zip` | 40 WAV 20 s |
| Originaux | `assets/originals/` (49 Mo, hors dépôt git) |
| Copies web | `public/audio/*.m4a` (AAC mono 112 kbit/s, 25 Mo) |
| Catalogue | `src/data/catalog.json` — codes, titres, étape, crédits, licences, mesures |
| Rapport d'import | `assets/import-report.json` |

Crédits repris tels quels (CC0, domaine public, BigSoundBank, Freesound). Les titres
affichés sont dérivés des noms de fichiers, avec des libellés relus pour douze sons
dans `config/demo-set.json` — à confirmer par l'équipe.

Réimporter après correction de l'inventaire :

```bash
npm run import-assets -- --zip /workspace/Sons_sucre_40_pistes_20s.zip \
                         --inventory /workspace/Inventaire.csv
npm run import-assets -- ... --dry-run   # contrôle sans écrire
```

Le script lit le ZIP sans dépendance, convertit, mesure, réécrit le catalogue et
**n'écrase rien** si trop de fichiers manquent. Il signale doublons, fichiers non
référencés et séquences sans étape.

## 7. Traductions

`src/i18n/fr.json` (par défaut) et `en.json`, mirroir complet. Aucun texte d'interface
n'est écrit en dur dans les écrans. Ajouter une langue = un fichier + une entrée dans
`src/i18n/index.ts`.

## 8. Publication

**Non publiée.** `gh auth status` ne renvoie aucun compte GitHub authentifié sur cette
machine ; aucun `GITHUB_TOKEN` n'est disponible. Les droits de diffusion publique des
sons restent à confirmer par le musée.

Le build est prêt (`base: './'`, hash router, tout en relatif) :

```bash
npm run build          # -> dist/ (≈ 11 Mo)
npx gh-pages -d dist   # après `gh auth login`
```

Le QR code n'a pas été généré : il n'a de sens qu'avec une URL publique vérifiée.

## 9. Ce qui n'est pas fait

- Ambient créole et Segazz : affichés « Bientôt », non implémentés.
- Partage par lien, comptes, NFC/bracelet : hors périmètre, non affichés.
- Textes historiques validés : non fournis, donc non affichés.
- Écoute critique par un musicien : la grille technique est vérifiée, le goût reste à
  valider à l'oreille — c'est le principal risque pour la démonstration.

## 10. Carte du dépôt

```
config/steps.json          7 étapes + rattachement des séquences
config/demo-set.json       libellés et rôles relus pour 12 sons
src/router.ts              routeur par hash (6 routes)
src/session.ts             session localStorage versionnée (découverts / sélection)
src/i18n/                  fr.json, en.json, t()
src/audio/service.ts       décodage à la demande, écoute, rendu, export
src/engine/plan.ts         compositeurs Electro Sega et Sega traditionnel
src/engine/render.ts       graphe audio + rapport d'invariants
src/engine/roles.ts        affectation des rôles et adaptations
src/ui/screens/            Accueil, Parcours, Étape, Carnet, Génération, Résultat
src/ui/SelfTest.tsx        vérification des invariants (?selftest=1&batch=1|2)
scripts/import-assets.mjs  Inventaire + ZIP -> catalogue
assets/backup/             deux pièces de secours déjà rendues
DESIGN.md                  tokens de la direction C
```
