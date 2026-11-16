# QR codes et postes

Huit postes physiques, huit QR codes. Un poste est un **lieu** ; il référence un son
du catalogue. Ce sont deux choses distinctes dans le code (`config/postes.json` contre
`src/data/catalog.json`) et il faut le rester : un poste peut changer de son sans
changer de QR.

## 1. Correspondance

| Poste | QR encodé | Sample | Titre du poste |
|---|---|---|---|
| 1 | `…/#/poste/1` | `01_02` | Flore et faune |
| 2 | `…/#/poste/2` | `01_05` | Pas sur le sable |
| 3 | `…/#/poste/3` | `02_01` | Cuillère, tasse et sucre |
| 4 | `…/#/poste/4` | `02_04` | Commerçants et étals |
| 5 | `…/#/poste/5` | `04_07` | Le sucre qui crisse |
| 6 | `…/#/poste/6` | `04_09` | Lota et cuillère |
| 7 | `…/#/poste/7` | `04_10` | La signature du contrat |
| 8 | `…/#/poste/8` | `06_04` | Charrette à bœufs |

Adresse complète actuelle :
`https://ashmotif200.github.io/sugar-orchestra/#/poste/N`

Fichiers générés :

| Fichier | Usage |
|---|---|
| `docs/qr/poste-N.svg` | **impression** — vectoriel, redimensionnable sans perte |
| `docs/qr/poste-N.png` | secours — messagerie, insertion dans un document |
| `docs/qr/planche-postes.html` | planche A4 imprimable regroupant les huit |
| `docs/qr/correspondance-postes.csv` | tableau poste → QR → sample → URL → fichier |

## 2. Ce que le QR encode, et ce qu'il n'encode pas

**Encodé** : l'adresse de l'application et un identifiant de poste (`#/poste/3`).

**Jamais encodé** : un nom de fichier audio, un code de sample, un titre, une adresse
d'hébergement écrite en dur dans le code source. L'URL ne vit que dans
`config/qr.json` — c'est ce qui permet de changer d'hébergement sans toucher au code.

L'identifiant de poste est stable. `resolveQr()` accepte trois formes, ce qui rend les
QR anciens tolérants :

```
poste-3   → par identifiant de QR
3         → par identifiant numérique
02_01     → par code de sample
```

## 3. Comportement à l'ouverture

1. Le routeur reconnaît `#/poste/N` (ou `#/qr/<charge>`).
2. `src/data/postes.ts` résout le poste, puis son code de sample.
3. Si ce sample est **publié**, il est ajouté au carnet — une seule fois, jamais de
   doublon.
4. Le poste s'affiche : titre, description, écoute, « Continuer la visite ».
5. QR inconnu → écran dédié, **rien n'est ajouté**, aucun contenu inventé.

### Limite connue

Si aucune mascotte n'a encore été choisie, `#/poste/N` affiche d'abord l'écran de
choix de la mascotte. C'est volontaire : l'univers musical doit être choisi une fois.
Conséquence pratique — **un scan isolé ne démarre pas la visite**. Le parcours
réellement présenté était : choisir Martin, puis scanner aux postes. Si vous voulez
qu'un scan démarre tout, il faut décider d'un univers par défaut et le documenter ;
ce n'est pas fait.

### Description des postes

`config/postes.json` porte un champ `description`, actuellement `null` pour les huit.
L'écran affiche alors « Description à venir. » — **aucun texte historique n'a été
inventé**. Les descriptions relèvent du musée et peuvent être ajoutées sans
regénérer les QR : le carnet rouvre la fiche via `posteBySample`.

## 4. Régénérer après un changement d'adresse

```bash
# 1. l'URL, et rien d'autre
#    config/qr.json  →  { "baseUrl": "https://…/", "path": "#/poste/{id}" }

# 2. générer, puis relire chaque PNG produit
node scripts/qr/make-posters.mjs
```

Ou sans toucher au fichier de configuration :

```bash
node scripts/qr/make-posters.mjs --base https://exemple.org/sugar-orchestra/
```

Le script **vérifie son propre travail** : il décode chaque PNG produit avec `jsQR`
et échoue si la charge lue diffère de l'URL attendue. Un QR illisible ne peut donc pas
être publié silencieusement. Dernier passage (16/11/2026) : `8/8 QR décodés et
conformes`.

## 5. Impression

- Préférer les **SVG** : redimensionnables, nets à toute taille.
- Taille minimale pratique : 3 cm de côté pour un scan confortable à 20–30 cm.
- Conserver une marge blanche (zone de silence) autour du code : les QR de ce dépôt
  en comportent une, ne pas la rogner à l'impression.
- La planche A4 (`planche-postes.html`) s'ouvre dans un navigateur et s'imprime
  directement.

## 6. Scanner depuis l'application

Un bouton « Scanner un QR code » ouvre la caméra dans le navigateur
(`src/ui/Scanner.tsx`), avec `jsQR`.

- `getUserMedia` est demandé en arrière-plan (`facingMode: 'ideal'`) avec repli sur
  `{ video: true }` ;
- échantillonnage d'un canvas de 640 px toutes les 180 ms ;
- verrou après la première détection ; flux arrêté à la détection, à la fermeture et
  au démontage — pas de caméra qui reste allumée ;
- un seul chemin de décodage (`jsQR`). `BarcodeDetector` n'est **pas** utilisé : il
  est absent de Safari, et sa détection conditionnelle produisait un écran
  « lecture non prise en charge » sans même demander la permission caméra.

**La caméra exige une origine sûre** : `https://` ou `http://localhost`. Depuis
`http://192.168.x.x` en présentation locale, le scan par caméra **ne fonctionnera
pas** sur Safari iOS. C'est une contrainte du navigateur, pas un défaut de
l'application.

**Validation réelle** : le scanner a été vérifié dans un navigateur de bureau
(Chromium) — overlay, absence de `BarcodeDetector` sans blocage, appel effectif à
`getUserMedia`, erreur `NotFoundError` affichée proprement. **Aucune caméra d'iPhone
physique n'a été exercée.** Si le scan échoue sur l'appareil, le nom exact de
l'erreur Safari (`NotAllowedError`, `NotFoundError`, `NotReadableError`) est la
première information à relever.

## 7. Changer le contenu d'un poste

| Ce que vous voulez changer | Où | Régénérer les QR ? |
|---|---|---|
| le titre d'un poste | `config/postes.json` | non |
| sa description | `config/postes.json` (ou contenu éditorial) | non |
| le son associé | `config/postes.json` → `sampleCode` | non |
| l'ordre ou le nombre de postes | `config/postes.json` | **oui** |
| l'adresse de l'application | `config/qr.json` | **oui** |
