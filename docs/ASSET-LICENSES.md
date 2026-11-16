# Licences et droits des ressources

État au **16 novembre 2026**. Ce document couvre **uniquement** les ressources
effectivement publiées dans ce dépôt et sur la démonstration GitHub Pages.

> **Décision de publication.** Le propriétaire du projet a demandé explicitement la
> publication des huit samples de 5 s utilisés pendant Muséomix 2026, du morceau
> final `energetique v1.wav` et des quatre mascottes, et l'exclusion de tout le
> reste du catalogue audio. Ce document ne décide donc pas *ce qui est publié* : il
> documente, pour chaque ressource publiée, **d'où elle vient et à quelles
> conditions elle peut être redistribuée**. Les auteurs sont identifiés et leur
> accord est confirmé ; les conditions de la charte juridique Muséomix restent, elles,
> à vérifier (§ 5.2).

---

## 1. Samples de la démonstration (8 fichiers)

Les fichiers publiés sont dans `public/audio/demo/` (copies de service) ; les
fichiers reçus sont conservés à l'identique dans `assets/demo-sources/`.
Les huit durent **exactement 5,000 s** (mesuré sur les fichiers, pas sur la
documentation).

| # | Fichier publié | Code | Titre affiché | Origine | Auteur | Licence | Attribution | Redistribution | Vérification |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `01_02.wav` | `01_02` | Flore et faune | SoundBible #1818 « Rainforest Ambience » | GlorySunz | **Domaine public** | aucune | **autorisée** | page consultée le 16/11/2026 : « License: Public Domain » |
| 2 | `01_05.wav` | `01_05` | Pas sur le sable | Freesound #445155 « Footsteps on Sand.wav » | BrendanSound12 | **CC0 1.0** | aucune | **autorisée** | page consultée le 16/11/2026 : « copy, modify, distribute … without asking permission » |
| 3 | `02_01.wav` | `02_01` | Cuillère, tasse et sucre | BigSoundBank #411 « Spoon in a mug empty » | Joseph SARDIN | **CC0 1.0** | aucune (courtoisie appréciée) | **autorisée** | page consultée le 16/11/2026 : « CC0 (public domain) » |
| 4 | `02_04.wav` | `02_04` | Commerçants et étals | BigSoundBank #2728 « Outdoor Market #1 » | Joseph SARDIN | **CC0 1.0** | aucune (courtoisie appréciée) | **autorisée** | page consultée le 16/11/2026 : « CC0 (public domain) » |
| 5 | `04_07.wav` | `04_07` | Le sucre qui crisse | Synthèse produite pour ce projet | équipe Sugar Orchestra | **œuvre originale du projet** | aucune | **autorisée** | crédit du catalogue : « Synthèse créée pour ce dossier » |
| 6 | `04_09.wav` | `04_09` | Lota et cuillère | enregistrement du lota, fourni dans `Sons_5s.zip` | **Tanguy** | création de l'auteur — **accord confirmé**, licence non attribuée (§ 5) | mention de l'auteur dans la fiche du son | **autorisée** | accord confirmé par le propriétaire du projet le 16/11/2026 |
| 7 | `04_10.wav` | `04_10` | La signature du contrat | BigSoundBank #221 « Pencil #1 » | Joseph SARDIN | **CC0 1.0** | aucune (courtoisie appréciée) | **autorisée** | page consultée le 16/11/2026 : « CC0 (public domain) » |
| 8 | `06_04.wav` | `06_04` | Charrette à bœufs | Freesound #437078 « G52-05-Ox Cart.wav » | craigsmith | **CC0 1.0** | aucune | **autorisée** | page consultée le 16/11/2026 : « copy, modify, distribute … without asking permission » |

**Synthèse** : six samples sont en CC0 ou domaine public vérifié à la source, et les
deux autres sont des créations dont l'auteur est identifié — une synthèse du projet
(`04_07`) et un enregistrement de Tanguy (`04_09`). Aucun des huit n'est publié « sur
une licence supposée » : pour chacun, soit la licence est vérifiée, soit l'auteur est
nommé et son accord confirmé. Les conditions générales de la charte Muséomix restent à
vérifier (§ 5.2), et aucune licence n'est attribuée aux créations des auteurs.

### Précisions utiles

- **Aucun fichier d'origine n'a été modifié.** Les huit fichiers publiés sont des
  copies octet pour octet de ceux reçus (`assets/demo-sources/`). Les contrôles
  d'intégrité sont dans `docs/catalog/SHA256SUMS.txt` pour le catalogue complet et
  dans le manifeste de sauvegarde pour ces fichiers.
- **`04_09_Lota.wav` n'est pas uniforme avec les sept autres** : 48 kHz stéréo /
  PCM 16 bits, quand les sept autres sont 32 kHz mono / PCM 16 bits. C'est un
  fichier d'une autre chaîne de production, ce qui est cohérent avec l'hypothèse
  d'un enregistrement distinct (voir § 5.1).
- **Les droits du catalogue complet ne sont pas couverts ici.** Les 40 sons de
  `src/data/catalog.json` portent la mention « Licence à confirmer » dans le champ
  `license` ; les crédits, eux, nomment la licence réelle. Ces 40 sons ne sont
  **pas** publiés (`public/audio/*.m4a` est exclu du dépôt) : leur statut devra être
  revu avant toute réintégration et publication.

## 2. Morceau final — Martin, « Énergétique »

| Élément | Valeur |
|---|---|
| Fichier publié | `public/demo/energetique v1.wav` (PCM 24 bits, 48 kHz, stéréo, 48,000 s) |
| Version de diffusion | `public/demo/energetique-v1.m4a` (AAC-LC, 1,17 Mo, même mixage, même durée) |
| Auteur | **Martin** (morceau fourni pour ce projet) |
| Licence | **non applicable / tous droits réservés à l'auteur** |
| Attribution | crédit « Martin — Énergétique » affiché dans l'application |
| Redistribution | **autorisée pour cette démonstration sur décision du propriétaire du projet** |
| Vérification | fichier fourni par l'équipe projet ; voir § 5.2 pour la confirmation écrite |

**Le mixage n'a pas été modifié.** La version `.m4a` est un ré-encodage du même
mixage, produit parce que Safari iOS ne décode pas le PCM 24 bits du WAV fourni.
Aucun traitement, aucune normalisation, aucun changement de niveau : seul le
conteneur change. Le master WAV reste dans le dépôt, utilisé comme repli pour les
navigateurs qui décodent ce format.

## 3. Illustrations — mascottes

Création et illustration : **Noémie**. Les quatre personnages — Martin, Mangouste,
Dodo et Tortue — ont été créés et illustrés par elle pour ce projet.

| Fichier | Personnage | Univers | Auteur | Statut |
|---|---|---|---|---|
| `public/mascots/Martin Rouge.png` | Martin | Electro Sega (Énergétique) | **Noémie** | accord confirmé par le propriétaire du projet |
| `public/mascots/Mangouste Jaune.png` | Mangouste | Sega traditionnel (Dansant) | **Noémie** | idem |
| `public/mascots/Dodo Vert.png` | Dodo | Segazz (Détendu) | **Noémie** | idem |
| `public/mascots/Tortue bleu.png` | Tortue | Ambient créole (Rêveur) | **Noémie** | idem |

Les fichiers sont publiés **tels quels** : ni retouchés, ni recompressés — ce sont les
originaux reçus dans `mascottes.zip` le 14 novembre 2026. Aucune licence (Creative
Commons ou autre) ne leur est attribuée : l'accord de l'auteure est confirmé, les
conditions de la charte Muséomix restent à vérifier (§ 5.2). Pour toute réutilisation
hors de ce dépôt, l'accord de Noémie doit être obtenu directement.

## 4. Polices et bibliothèques

| Ressource | Version | Licence | Fichier de licence dans le dépôt |
|---|---|---|---|
| **DM Sans** | — | SIL Open Font License 1.1 | `src/assets/fonts/OFL-DMSans.txt` |
| **Fraunces** | — | SIL Open Font License 1.1 | `src/assets/fonts/OFL-Fraunces.txt` |
| React / React DOM | 18.3 | MIT | `node_modules` (non versionné) |
| Vite | 6.x | MIT | idem |
| jsQR | 1.4 | Apache-2.0 | idem |
| qrcode, pngjs | 1.5 / 7.x | MIT | idem |

L'OFL 1.1 exige que le texte de licence accompagne les fichiers de police : c'est
pourquoi les deux `OFL-*.txt` sont versionnés à côté des fontes. Les dépendances
JavaScript ne sont pas versionnées (`node_modules/`) ; leurs licences sont celles
publiées par leurs paquets respectifs.

## 5. Auteurs, accords et points en attente

### 5.1 Auteurs identifiés

Les contributions artistiques ont été confirmées par le propriétaire du projet le
**16 novembre 2026**. Seuls les prénoms sont consignés, par choix.

| Auteur | Contribution | Ressource concernée | Accord |
|---|---|---|---|
| **Tanguy** | enregistrement du son du lota | `04_09_Lota.wav` → `public/audio/demo/04_09.wav` | confirmé par le propriétaire du projet |
| **Noémie** | création et illustration des personnages | les quatre mascottes de `public/mascots/` | confirmé par le propriétaire du projet |
| **Ashley** | développement informatique et démonstration musicale | l'application dans son ensemble | — (auteur du code, voir `LICENSE`) |
| **Martin** | composition du morceau final « Énergétique » | `public/demo/energetique v1.wav` | voir § 5.3 |

**Ce que cela règle** : la provenance de `04_09_Lota.wav` n'est plus une hypothèse.
C'est un enregistrement de Tanguy, distinct de la synthèse `assets/originals/04_09.wav`
du catalogue — ce qui explique enfin l'écart de format (48 kHz stéréo contre 32 kHz
mono) relevé lors de l'inventaire. L'illustrateur des mascottes est Noémie.

**Ce que cela ne règle pas** : un accord donné n'est pas une licence écrite. Voir
§ 5.2.

### 5.2 Charte juridique Muséomix — **indisponible à ce jour**

Une charte juridique du projet Muséomix **existe**, mais elle n'est pas encore
disponible. Ses conditions exactes — cession de droits, autorisation de diffusion,
durée, territoire, mention obligatoire — **restent à vérifier** lorsqu'elle sera
communicée.

En attendant, l'état exact est le suivant, et il ne doit pas être présenté autrement :

- les auteurs sont **identifiés** (§ 5.1) ;
- leur accord pour l'utilisation de leurs créations dans ce projet a été **confirmé par
  le propriétaire du projet** ;
- une charte **existe** et **fixera** probablement les conditions ;
- ces conditions **n'ont pas été lues** et ne sont donc **pas** connues.

**Ce qui n'est pas fait, volontairement :**

- aucune licence (MIT, CC0, Creative Commons ou autre) n'est attribuée aux créations
  de Tanguy, Noémie ou Martin. Un accord verbal ou implicite n'est pas une licence, et
  en inventer une serait fabriquer un fait juridique ;
- la licence MIT du dépôt (`LICENSE`) couvre **le code source uniquement**. Elle ne
  s'étend ni aux samples, ni aux mascottes, ni au morceau final — c'est écrit en tête
  du fichier `LICENSE` ;
- les ressources déjà publiées **ne sont pas retirées** au motif que la charte manque :
  aucun problème concret de droits n'a été identifié, et les auteurs ont donné leur
  accord. Retirer des ressources sur une incertitude documentaire créerait un préjudice
  réel sans bénéfice ;
- le statut juridique de ces ressources n'est **pas** présenté comme définitivement
  vérifié, ni dans ce document, ni dans le README, ni dans l'application.

**Action attendue** : quand la charte sera disponible, relire ses conditions, puis
mettre à jour ce document et, si elle l'exige, la mention de crédit affichée par
l'application.

### 5.3 Morceau de Martin — autorisation de diffusion en ligne

Le morceau est fourni par l'équipe pour la démonstration, et sa publication a été
demandée par le propriétaire du projet. La diffusion en ligne (dépôt public, GitHub
Pages) devrait être confirmée par écrit par l'auteur lui-même. Un courriel suffit.

Tant que cette confirmation n'existe pas : le morceau reste publié sur la décision du
propriétaire, et **son statut n'est pas présenté comme une licence vérifiée**.

## 6. Ce qui n'est pas publié, et pourquoi

| Ressource | Volume | Emplacement hors dépôt | Raison |
|---|---|---|---|
| `public/audio/*.m4a` — 40 versions de diffusion 20 s | 14 Mo | sauvegarde indépendante + `data/archive/catalog-40/` | champ `license` = « Licence à confirmer » sur les 40 ; l'accord du musée pour la diffusion publique n'est pas établi |
| `assets/originals/*.wav` — 40 masters 20 s | 49 Mo | idem | masters, jamais publiés par principe |
| `assets/references/**` — 3 mix + stems de référence | 140 Mo | idem | enregistrements commerciaux fournis pour l'analyse, **jamais** redistribuables |
| `docs/v2.0.5/validation/audio/*` | 79 Mo | idem | pistes de clic régénérables + stems de référence dans `*-drums-with-click.wav` |
| `assets/backup/*.wav` — 2 pièces rendues par le moteur | 12 Mo | idem | rendus dérivés de sons dont la licence n'est pas établie pour tous |

Ces fichiers sont **conservés** : ils figurent dans la sauvegarde indépendante
(`/workspace/download/sugar-orchestra-archive/`) et dans `data/archive/` pour les
40 sons. Les réintégrer demande de traiter la question des droits, pas seulement de
copier des fichiers. Voir `docs/AUDIO.md`.
