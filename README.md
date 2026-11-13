# Sugar Orchestra

Prototype Muséomix pour **L'Aventure du Sucre** (Maurice). Le visiteur écoute les sons
du musée, en garde quelques-uns, choisit un univers musical, et reçoit à la fin une
pièce composée **exclusivement à partir de ses propres sons**.

Démo prévue : samedi 14 novembre 2026, 10–15 min de présentation.

---

## 1. Démarrage

```bash
cd /workspace/sugar-orchestra
npm install          # déjà fait
npm run dev          # http://127.0.0.1:5180
```

Pour la présentation, préférer le build statique (plus rapide, aucun HMR) :

```bash
npm run build
npm run preview      # http://127.0.0.1:5181
```

Les 12 sons de la démo sont préchargés au démarrage (~15 Mo). Une fois la page
ouverte, **plus aucun accès réseau n'est nécessaire** : la composition se fait dans
le navigateur. Vérifié serveur coupé : la pièce se rend toujours.

## 2. Scénario de présentation (2–3 minutes)

1. **Accueil** — « Les sons du musée deviennent ta musique. » Choisir ⚡ Énergétique.
   Les deux autres univers sont affichés désactivés : ils ne sont pas implémentés, on
   ne prétend pas le contraire.
2. **Écoute** — descendre dans 2–3 salles, appuyer sur ▶ pour écouter (le son
   s'arrête tout seul au bout de 4,5 s), garder 4 à 6 sons avec « + garder ».
   Insister : *il y a 12 sons pour 6 places*.
3. **Révélation** — « Créer ma pièce ». Le rendu prend ~6 s (écran « on assemble tes
   sons »). La pièce n'a jamais été préécoutée : c'est la surprise.
4. **Écoute de la pièce** (35 s) — puis montrer la liste « Les sons que tu as gardés »
   avec l'instant où chacun apparaît à l'état brut.
5. **La preuve** — ouvrir « Preuve technique » : aucune source étrangère, chaque son
   reconnaissable, aucun sample externe.
6. **La démonstration qui convainc** — revenir, changer d'univers (🌊 Rêveur), refaire
   une pièce avec les **mêmes** sons : même matière, résultat radicalement différent
   (pas de batterie, nappes granulaires, 72 BPM).
7. Si on vous demande « et si je choisis d'autres sons ? » — changer un son et
   recomposer : la pièce change, l'ossature reste cohérente.

**Plan B** : `assets/backup/demo-electro-sega.wav` et `demo-ambient-creole.wav` sont
deux pièces déjà rendues avec les vrais sons. Si le navigateur ou le son lâche, on les
lit dans n'importe quel lecteur. Ce sont des pièces réelles du moteur, pas des maquettes.

```bash
# lecture du plan B
ffplay -autoexit assets/backup/demo-electro-sega.wav
```

**Réinitialisation** entre deux passants : bouton « Recommencer » sur l'écran final, ou
« réinitialiser » dans la barre de collection, ou vider le stockage local.

## 3. Le moteur de composition

Tout se passe dans le navigateur, sans serveur.

- **Analyse** (`scripts/lib/analyze.mjs`) : à l'import, chaque WAV est mesuré — FFT,
  centroïde spectral, aplaticité, taux de passages par zéro, hauteur fondamentale par
  NSDF/McLeod, attaques par flux d'énergie robuste (médiane + MAD). Ces mesures
  proposent des rôles ; **ce ne sont pas des verdicts artistiques**.
- **Rôles** (`src/engine/roles.ts`) : Basse, Mélodie, Rythmique, Ear candy, Texture.
  Les rôles validés priment ; sinon le moteur promeut un son par mesure (le plus grave
  devient la basse, etc.) et **l'affiche comme adaptation** sur l'écran final.
- **Deux univers réels** (`src/engine/plan.ts`) :
  - **Electro Sega**, 112 BPM, 16 mesures, 35,9 s : grosse caisse / caisse claire /
    shaker taillés dans les sons du visiteur, basse en croches, motif pentatonique,
    éclats filtrés.
  - **Ambient créole**, 72 BPM, 12 mesures, 41,6 s : deux nappes granulaires, bourdon
    de basse, cloches espacées, grains inversés, aucun tambour.
- **Rendu** (`src/engine/render.ts`) : `OfflineAudioContext`, graphe construit
  événement par événement (découpe, transposition, filtres balayés, granulation,
  inversion, envoi d'écho procédural), bus par rôle, compresseur, puis normalisation
  loudness (≈ −16 dBFS RMS, crête plafonnée à −1 dBFS).
- **Déterminisme** : la graine dérive de l'univers + des identifiants triés. Une même
  collection donne toujours la même pièce, quel que soit l'ordre des clics
  (écart mesuré entre deux rendus : 7 × 10⁻⁷, donc du bruit de virgule flottante).

### Les trois invariants, et comment ils sont tenus

1. `usedSourceIds ⊆ selectedSourceIds` — le rendu ne reçoit que les buffers de la
   sélection ; le rapport liste les identifiants utilisés et vérifie l'inclusion.
2. `selectedSourceIds ⊆ recognizableSourceIds` — **passe de signature** : chaque son
   gardé reçoit exactement un passage *brut* (rate 1,0, aucun filtre, aucune inversion,
   aucune granulation), placé sur une attaque réelle de l'enregistrement, réparti dans
   la pièce, et **toute la musique est duckée à 0,38 sous ce passage** pour qu'il soit
   réellement audible. Sans ce ducking, la mesure a montré que les sons du visiteur
   étaient noyés sous le groove — c'était un vrai défaut, corrigé.
3. Aucun sample externe — aucun buffer n'existe en dehors des fichiers du catalogue.

### Vérifier soi-même

```
http://127.0.0.1:5180/?selftest=1
```

Rend 8 pièces (deux univers, sélections tonales, tout-texture, 4 et 6 sons, sans basse)
et vérifie : sources étrangères, signatures, durée 30–45 s, aucune saturation,
déterminisme, **et la reconnaissabilité mesurée** par corrélation croisée entre chaque
passage brut et son enregistrement source (maximum sur ±60 ms). Compte ~90 s.

Dernier passage sur les vrais sons : **8/8 cas OK**, corrélations 0,71 → 0,99,
crête −1,0 dBFS, durées 35,9 s et 41,6 s.

## 4. Les assets

| Élément | État |
|---|---|
| `Inventaire.csv` | reçu, 40 lignes, 40 correspondances code → fichier, 0 manquant, 0 doublon |
| `Sons_sucre_40_pistes_20s.zip` | reçu, 40 WAV 20 s |
| WAV originaux | conservés dans `assets/originals/` (hors build, 49 Mo) |
| Copies web | `public/audio/*.m4a` (AAC mono 112 kbit/s, 25 Mo) |
| Catalogue | `src/data/catalog.json` — codes, noms, sections, crédits, licences, mesures |
| Rapport d'import | `assets/import-report.json` |
| Crédits | repris tels quels de l'inventaire (CC0, domaine public, BigSoundBank, Freesound) |

**Sélection de démonstration : 12 sons sur 40** (`config/demo-set.json`). Les 40 restent
au catalogue avec leurs crédits ; seuls les 12 sont proposés au visiteur. Curation :
un représentant par rôle, réparti sur 7 sections, choisi sur les mesures (le forgeron
pour la mélodie, la bagasse pour la basse, la charrette pour le rythme…).

**Séquence 4 « Une histoire façonnée par le sucre » écartée** : elle contient le fouet,
les fers, les chaînes et la maquette vocale « Ayo » signalée *à valider*. Ces trois sons
sont marqués `sensitive` et exclus automatiquement de toute sélection ; ils exigent une
contextualisation et une validation muséales avant tout usage musical. Le reste de la
séquence est simplement absent de la démo.

Les anecdotes historiques ne sont **pas** inventées : le champ existe dans le modèle et
dans l'import, mais aucun texte validé n'a été fourni, donc aucun n'est affiché.

### Réimporter quand l'inventaire change

```bash
npm run import-assets -- --zip /workspace/Sons_sucre_40_pistes_20s.zip \
                         --inventory /workspace/Inventaire.csv
npm run import-assets -- ... --dry-run    # vérifie sans rien écrire
```

Le script lit le ZIP sans dépendance externe, convertit, mesure, réécrit le catalogue,
et **n'écrase rien** si trop de fichiers manquent. Il signale les doublons, les
fichiers non référencés et les sections inconnues.

## 5. État de la publication

**Non publié.** `gh auth status` : aucun compte GitHub authentifié sur cette machine, et
aucune variable `GITHUB_TOKEN`. Les droits de diffusion des sons n'ont pas non plus été
confirmés pour un hébergement public (les licences du catalogue sont CC0 / domaine
public / BigSoundBank, ce qui est favorable, mais la validation muséale reste à faire).

Le build est prêt pour Pages (`base: './'`, sortie statique) :

```bash
npm run build                     # -> dist/ (15 Mo, tout relatif)
npx gh-pages -d dist              # une fois `gh auth login` fait
```

Le QR code n'a pas été généré : il n'a de sens qu'une fois l'URL publique vérifiée.

## 6. Ce qui n'est pas fait

- Les deux autres univers (Sega traditionnel, Segazz) : affichés « bientôt », non
  implémentés.
- L'audition par station NFC/QR physique : hors périmètre, aucune simulation trompeuse.
- Les anecdotes et crédits à l'écran : le modèle les porte, l'inventaire ne fournit pas
  de texte historique validé.
- L'écoute critique par un musicien : la grille technique est vérifiée, le goût reste à
  valider à l'oreille — c'est le seul vrai risque pour samedi.

## 7. Carte du dépôt

```
config/demo-set.json        curation des 12 sons (+ rôles et libellés)
src/audio/                  types, service audio (décodage, audition, export)
src/engine/                 plan.ts (compositeurs), render.ts (graphe + invariants)
                            roles.ts, universes.ts, rng.ts
src/ui/SelfTest.tsx         vérification des invariants (?selftest=1)
scripts/import-assets.mjs   import Inventaire + ZIP -> catalogue
scripts/gen-placeholders.mjs  jeu de substitution (si les assets manquent)
scripts/lib/                analyse acoustique, lecture WAV, lecture ZIP
assets/originals/           WAV du musée, intacts
assets/backup/              deux pièces de secours déjà rendues
DESIGN.md                   tokens et intentions visuelles
```
