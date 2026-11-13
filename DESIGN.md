# Sugar Orchestra — DESIGN.md

Direction **C · Tronçons** (référence : `sugar-orchestra-directions.html`).
Ce fichier fige les tokens réellement implémentés. En cas de doute : le dossier de
transmission fait foi pour le comportement, les maquettes pour l'apparence.

## 1. Intention

Un fragment d'histoire devient un tronçon de canne, puis un morceau de la musique du
visiteur. Papier chaud + vert canne + encre, **un accent par univers**. La gravure est
réservée aux fiches d'histoire ; l'interface reste claire et moderne.

## 2. Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--paper` | `#F4ECD8` | fond |
| `--paper-2` | `#EEE4CB` | surfaces secondaires, onglet actif au repos |
| `--card` | `#FFFAF0` | cartes, fiches, barres |
| `--ink` | `#1E2B22` | texte, contours, icônes |
| `--mut` | `#55604F` | texte secondaire |
| `--line` | `#D9CFB6` | filets, séparateurs |
| `--cane` | `#2F6B4F` | action principale, progression, découvert |
| `--coral` | `#E5533D` | accent Electro Sega, marqueurs de forme d'onde |
| `--coral-fill` | `#C63E2A` | **surfaces pleines corail portant du texte** |
| `--amber` | `#E9A23B` | Sega traditionnel, étape en cours (texte encre) |
| `--lagoon` | `#2A9D9B` | Ambient créole (bientôt) |
| `--indigo` | `#3F4A9E` | Segazz (bientôt) |

Contrastes vérifiés à l'outil (WCAG 2.1) :
- encre sur papier **12,5:1**, `--mut` sur papier **5,6:1**, canne sur papier **5,4:1**
- blanc sur corail `#E5533D` = **3,58:1 → insuffisant** pour du texte courant : les
  surfaces pleines utilisent `--coral-fill` (blanc dessus = **4,89:1**). L'accent
  `#E5533D` reste pour les traits, barres et marqueurs (éléments non textuels).
- encre sur ambre = **6,8:1** (l'ambre porte toujours du texte encre, jamais du blanc).

Jamais de couleur seule : chaque état porte une icône, un libellé ou une coche.

## 3. Typographie

Auto-hébergée (aucun CDN — la démo doit tourner hors ligne) :
- **Fraunces** 600 / 800 (woff2) pour les titres ;
- **DM Sans** 400 / 500 / 700 (ttf) pour l'interface ;
- repli : `Georgia, serif` et `system-ui, sans-serif`.

| Token | Valeur | Usage |
|---|---|---|
| `.display` | `clamp(2rem, 7vw, 2.9rem)` Fraunces 800 | titre d'accueil |
| `.h1` | `clamp(1.6rem, 4.6vw, 2.2rem)` Fraunces 600 | titre d'écran |
| `.h2` | `1.25rem` Fraunces 600 | sous-titre, nom de son |
| corps | `1rem / 1.5` DM Sans 400 | texte courant |
| `.micro` | `.76rem` | mentions, aides |
| `.label` | `.68rem` majuscules, interlettrage `.1em` | « Note d'enregistrement », « Crédit » |

## 4. Espace, rayons, cibles

- Rayons : `16px` (cartes, boutons), `12px` (champs secondaires), `999px` (pastilles).
- Cibles tactiles : **≥ 48 px** (boutons `.btn`, disques de lecture 56 px, pastilles 42 px).
- Corps de texte ≥ 14 px sur mobile ; aucun texte sous `.68rem` en information utile.
- Filets `1px --line` plutôt que des ombres ; une seule ombre douce au survol des cartes.

## 5. Mouvement

- `120ms` pressions, `180ms` changements d'état, `420ms` changements d'écran.
- Génération : tronçons de canne qui respirent (`trunk`, 1,6 s), phases cochées.
- `prefers-reduced-motion: reduce` → toutes les animations à `1ms`, itération unique.
- Aucune lecture audio automatique, aucune animation qui masque un état.

## 6. Composants

- **`.uni-card`** — carte univers pleine (corail/ambre), ou pointillés « Bientôt »
  non cliquable mais lisible. Sélection = anneau encre.
- **`.cane-node`** — nœud numéroté de la canne : à découvrir (contour), en cours
  (ambre), découvert (canne + coche). Badges d'étape : « Écoute contextualisée »,
  « À confirmer ».
- **`.row`** — rangée de son : titre, badges (dans ma musique, verrou), bouton +/✓ 42 px.
- **`.fiche`** — fiche son : forme d'onde, disque de lecture, état « Son découvert »,
  note d'enregistrement, crédit, action `+ Ajouter à ma musique`.
- **`.wave`** — barres issues des pics RMS réels du buffer ; bandes colorées par son
  d'origine sur l'écran de résultat.
- **`.badge`** — états : découvert (canne), à confirmer (ambre), verrou (pointillés).
- **`.bottom-bar`** — action principale fixée en bas sur mobile seulement.

## 7. Responsive

| Format | Largeur | Disposition |
|---|---|---|
| Mobile | `< 640 px` | une colonne, action en bas, rail et carnet masqués |
| Tablette | `640–1100 px` | rail horizontal compact, contenu centré |
| PC | `> 1100 px` | trois zones : canne (232 px) · contenu · carnet (268 px) |

Accueil, génération et résultat occupent le cadre entier. Clavier sur PC :
`Espace` = lecture/pause du résultat, `←/→` = étape précédente/suivante.

## 8. Accessibilité

- Contraste AA (voir §2), focus visible 3 px canne.
- `aria-label` sur tous les boutons d'écoute et d'ajout, `aria-pressed` sur les
  bascules, `aria-current` sur l'étape active, `aria-live` sur les phases de génération.
- Lien d'évitement « Aller au contenu ».
- Les sons sensibles affichent « Histoire seulement » avec icône verrou, jamais
  seulement une couleur.
