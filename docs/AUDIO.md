# Audio

Tout ce qui concerne les sons : ce qui est publié, ce qui ne l'est pas, comment en
ajouter, et comment le moteur les utilise.

## 1. Trois catégories de fichiers

| Catégorie | Emplacement | Versionné | Publié | Droits |
|---|---|---|---|---|
| **Samples de démonstration** (8 × 5 s) | `public/audio/demo/`, sources dans `assets/demo-sources/` | oui | **oui** | établis, voir `ASSET-LICENSES.md` |
| **Morceau final** (WAV + AAC) | `public/demo/` | oui | **oui** | fourni par l'auteur |
| **Catalogue complet** (40 × 20 s) | `assets/originals/` (masters), `public/audio/*.m4a` (diffusion) | **non** | **non** | à établir |
| Références d'analyse | `assets/references/` | non | non | non redistribuables |

Les masters ne sont **jamais** modifiés. Toute transformation écrit ailleurs.

## 2. Les huit samples de la démonstration

| Fichier publié | Code | Durée mesurée | Format | Source d'origine |
|---|---|---|---|---|
| `01_02.wav` | `01_02` | 5,000 s | 32 kHz mono PCM 16 | `01_02_Foret_tropicale_5s.wav` |
| `01_05.wav` | `01_05` | 5,000 s | 32 kHz mono PCM 16 | `01_05_Pas_sur_sable_5s.wav` |
| `02_01.wav` | `02_01` | 5,000 s | 32 kHz mono PCM 16 | `02_01_Cuillere_tasse_sucre_5s.wav` |
| `02_04.wav` | `02_04` | 5,000 s | 32 kHz mono PCM 16 | `02_04_Commercants_etals_5s.wav` |
| `04_07.wav` | `04_07` | 5,000 s | 32 kHz mono PCM 16 | `04_07_Sucre_sibilance_SSS_5s.wav` |
| `04_09.wav` | `04_09` | 5,000 s | **48 kHz stéréo** PCM 16 | `04_09_Lota.wav` |
| `04_10.wav` | `04_10` | 5,000 s | 32 kHz mono PCM 16 | `04_10_Redaction_contrat_5s.wav` |
| `06_04.wav` | `06_04` | 5,000 s | 32 kHz mono PCM 16 | `06_04_Charrette_boeufs_5s.wav` |

**Contrôlé le 16 novembre 2026** : les huit durent exactement 5,000 s — aucun
raccourcissement n'était nécessaire, y compris pour `04_09_Lota.wav`.

**Le lot n'est pas homogène.** `04_09_Lota.wav` est en 48 kHz stéréo quand les sept
autres sont en 32 kHz mono. C'est un fichier passé par une autre chaîne de
production ; sa provenance est à documenter (`docs/ASSET-LICENSES.md` § 5.1). Le code
n'a jamais supposé l'uniformité du format : les buffers du catalogue portent leurs
propres caractéristiques.

Les fichiers publiés sont des **copies octet pour octet** des fichiers reçus. Ils
n'ont été ni normalisés, ni égalisés, ni découpés.

## 3. Le morceau final

`energetique v1.wav` — PCM 24 bits, 48 kHz, stéréo, 48,000 s.

- **Master** : conservé tel quel dans `public/demo/` (nom exact, espace compris).
- **Version de lecture** : `energetique-v1.m4a`, AAC-LC, 1,17 Mo, même mixage, même
  durée. Produite parce que **Safari iOS ne décode pas le PCM 24 bits** du WAV.
- **Aucun traitement** : pas de normalisation, pas de limiteur, pas de changement de
  niveau. Seul le conteneur change.
- **Lecture** : élément `<audio controls playsInline>` natif, sans passer par
  `AudioContext`. Le repli sur le WAV existe pour les navigateurs qui le décodent.

Pour régénérer la version AAC (si le master était remplacé) :

```bash
ffmpeg -i "public/demo/energetique v1.wav" -c:a aac -b:a 192k -movflags +faststart \
       "public/demo/energetique-v1.m4a"
```

Vérifier ensuite la durée (48,000 s) et le type servi (`audio/mp4`).

## 4. Le catalogue complet (40 sons) — non publié

Chaque son du catalogue porte :

- `code` (`01_02`), `name`, `stepId`, `credits`, `license`, `file`, `analysis` ;
- `sensitive` (étiquette éditoriale et historique) et `availability` ;
- des mesures : fréquence dominante, périodicité, centroïde, attaques, etc.

**Rien n'a été supprimé.** Les 40 masters et les 40 versions de diffusion existent,
hors dépôt, dans la sauvegarde indépendante et dans `data/archive/catalog-40/`.

### 4.1 Pourquoi ne pas les publier

Le champ `license` vaut « Licence à confirmer » pour les 40, alors que le champ
`credits` nomme la licence réelle. L'accord du musée pour une diffusion publique
n'est pas établi pour l'ensemble. Publier 40 fichiers dont on ne peut pas prouver la
licence exposerait le projet — et le musée — sans nécessité : la démonstration n'en
utilise que huit.

### 4.2 Les réintégrer

```bash
# 1. restaurer masters et versions de diffusion depuis l'archive du catalogue
node scripts/catalog/archive.mjs restore --yes

# 2. vérifier l'intégrité (82 empreintes)
node scripts/catalog/archive.mjs verify

# 3. réimporter depuis le ZIP d'origine et l'inventaire
npm run import-assets -- --zip /chemin/Sons_sucre_40_pistes_20s.zip \
                         --inventory /chemin/Inventaire.csv
```

`import-assets` convertit en AAC, mesure chaque fichier, réécrit
`src/data/catalog.json` et **n'écrase rien** si trop de fichiers manquent. Il signale
les doublons, les fichiers non référencés et les séquences sans étape.

**Réintégrer n'autorise pas à publier.** La question des droits reste entière.

## 5. Ajouter un sample à la démonstration

Trois étapes, dans cet ordre.

1. **Le fichier** — déposer la source dans `assets/demo-sources/` et la copie de
   service dans `public/audio/demo/<code>.wav`. Format : WAV PCM, 5 s, peu importe le
   taux d'échantillonnage (le moteur lit les caractéristiques réelles).
2. **Le catalogue** — `src/data/catalog.json`, entrée du son : `file` doit pointer
   sur `audio/demo/<code>.wav`, et `originalFile` mémoriser l'ancien chemin.
   Le script prévu pour cela est réversible :

   ```bash
   node scripts/catalog/use-demo-audio.mjs            # bascule les 8 codes de démo
   node scripts/catalog/use-demo-audio.mjs --restore  # revient aux chemins d'origine
   ```

   Pour un neuvième son, éditer l'entrée à la main en suivant le même schéma.
3. **La publication** — un son n'est jouable que s'il est `published` :

   ```bash
   node scripts/admin/demo-samples.mjs --dry-run   # aperçu
   node scripts/admin/demo-samples.mjs             # 8 publiés, les autres verrouillés
   node scripts/admin/demo-samples.mjs --restore   # tout remettre en 'active'
   node scripts/admin/export-publication.mjs        # met à jour l'instantané embarqué
   ```

   **Ne pas oublier la dernière ligne** : sans elle, le site statique continue
   d'afficher l'ancien état, et l'on croit à un bug d'affichage.

4. **Les droits** — compléter `docs/ASSET-LICENSES.md` avant de pousser.

## 6. Modifier les fiches et les associations

- **Titre, description, histoire d'un poste** : `config/postes.json`, champ
  `description` (`null` affiche « Description à venir. » — aucun texte inventé).
- **Titre et histoire d'un son** : passe par l'administration (contenu éditorial) ;
  ne pas éditer `catalog.json` à la main pour du texte, il serait écrasé à la
  prochaine publication appliquée.
- **Association son ↔ poste** : `config/postes.json`, champ `sampleCode`.
- **Association son ↔ étape** : `config/steps.json` (ou la base, puis `admin:apply`).

## 7. Ce que fait le moteur, et ce qu'il ne fait pas

- **V1** découpe, transpose, filtre, granule et boucle les sons **retenus par le
  visiteur**, dans le navigateur, avec un rendu déterministe (même sélection = même
  pièce).
- **V2.0 / V2.1** ajoutent la planification par motifs, une basse synthétique et un
  rendu serveur.

Limite mesurée, à ne pas oublier : sur le catalogue, **aucun son n'est utilisable
comme basse** et cinq seulement ont une hauteur crédible. La matière ne peut pas
porter une harmonie. Les documents de conception le disent en détail
(`docs/phase-a/`, `docs/music-engine-v2/`).

**La démonstration n'utilise aucun des deux moteurs** : elle joue le morceau de
Martin. Voir `docs/MUSEOMIX-2026.md`.

## 8. Contrôles d'intégrité

| Quoi | Où |
|---|---|
| Catalogue complet (82 fichiers) | `docs/catalog/MANIFESTE.json`, `docs/catalog/SHA256SUMS.txt` |
| Huit samples + morceau final | manifeste de la sauvegarde indépendante |
| Fichiers publiés après déploiement | `scripts/deploy/publish-pages.sh` (compte et refuse les `*.m4a`) |

```bash
node scripts/catalog/archive.mjs verify   # 82 empreintes du catalogue
```
