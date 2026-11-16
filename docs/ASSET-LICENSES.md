# Licences et droits des ressources

État au **16 novembre 2026**. Ce document couvre **uniquement** les ressources
effectivement publiées dans ce dépôt et sur la démonstration GitHub Pages.

> **Décision de publication.** Le propriétaire du projet a demandé explicitement la
> publication des huit samples de 5 s utilisés pendant Muséomix 2026, du morceau
> final `energetique v1.wav` et des quatre mascottes, et l'exclusion de tout le
> reste du catalogue audio. Ce document ne décide donc pas *ce qui est publié* : il
> documente, pour chaque ressource publiée, **d'où elle vient et à quelles
> conditions elle peut être redistribuée**. Deux points restent à confirmer par
> écrit et sont signalés comme tels (§ 5).

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
| 6 | `04_09.wav` | `04_09` | Lota et cuillère | fichier `04_09_Lota.wav` fourni dans `Sons_5s.zip` | **à confirmer** | **à confirmer** | — | **publiée sur décision du propriétaire, provenance à documenter** | voir § 5.1 |
| 7 | `04_10.wav` | `04_10` | La signature du contrat | BigSoundBank #221 « Pencil #1 » | Joseph SARDIN | **CC0 1.0** | aucune (courtoisie appréciée) | **autorisée** | page consultée le 16/11/2026 : « CC0 (public domain) » |
| 8 | `06_04.wav` | `06_04` | Charrette à bœufs | Freesound #437078 « G52-05-Ox Cart.wav » | craigsmith | **CC0 1.0** | aucune | **autorisée** | page consultée le 16/11/2026 : « copy, modify, distribute … without asking permission » |

**Synthèse** : 7 des 8 samples sont soit en CC0/domaine public vérifié (6), soit une
œuvre originale du projet (1). Le huitième est publié sur décision du propriétaire,
sa provenance restant à documenter (§ 5.1).

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

| Fichier | Personnage | Univers | Auteur | Statut |
|---|---|---|---|---|
| `public/mascots/Martin Rouge.png` | Martin | Electro Sega (Énergétique) | non documenté | fourni par l'équipe projet (`mascottes.zip`, 14/11/2026) |
| `public/mascots/Mangouste Jaune.png` | Mangouste | Sega traditionnel (Dansant) | non documenté | idem |
| `public/mascots/Dodo Vert.png` | Dodo | Segazz (Détendu) | non documenté | idem |
| `public/mascots/Tortue bleu.png` | Tortue | Ambient créole (Rêveur) | non documenté | idem |

Les fichiers sont publiés **tels quels** : ni retouchés, ni recompressés. Le nom de
l'illustrateur n'est pas documenté dans le dossier du projet ; à compléter avant
toute réutilisation hors de ce dépôt (voir § 5.3).

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

## 5. Points à confirmer par écrit

Ces trois points ne bloquent pas la démonstration — le propriétaire du projet a
demandé la publication de ces ressources — mais ils doivent être tranchés pour que
la chaîne de droits soit complète.

### 5.1 `04_09_Lota.wav` — provenance

Le catalogue décrit `04_09` comme « Cuillère sur fer blanc », une **synthèse
originale** du projet. Le fichier fourni pour la démonstration s'appelle
`04_09_Lota.wav`, dure 5 s et présente des caractéristiques techniques différentes
(48 kHz stéréo contre 32 kHz mono) : il ne provient donc **pas** du même fichier
que `assets/originals/04_09.wav`.

Deux hypothèses, non tranchées :

1. enregistrement réalisé ou commandé par l'équipe projet au musée → droits
   détenus par le projet ;
2. enregistrement dont la source bibliographique n'a pas été consignée → licence à
   établir.

**Action demandée** : indiquer l'origine de `04_09_Lota.wav`. En attendant,
la ressource est publiée sur la décision du propriétaire, et non sur une licence
vérifiée.

### 5.2 Morceau de Martin — autorisation de diffusion en ligne

Le morceau est fourni par l'équipe pour la démonstration. La diffusion en ligne
(GitHub Pages, dépôt public) devrait être confirmée par écrit par l'auteur, même
si elle est demandée par le propriétaire du projet. Un courriel suffit.

### 5.3 Illustrateur des mascottes

Le nom de l'auteur des quatre illustrations n'est pas documenté. À compléter dans
le tableau § 3.

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
