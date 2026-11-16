# Déroulé de présentation

Fiche pratique pour faire visiter la démonstration. Le fond est décrit dans
[`README.md`](README.md) § 4 à 10 et [`docs/MUSEOMIX-2026.md`](docs/MUSEOMIX-2026.md).

## 1. Deux façons de présenter

### En ligne (recommandé)

<https://ashmotif200.github.io/sugar-orchestra/>

Aucune installation, fonctionne sur le téléphone du visiteur, en HTTPS — donc le scan
par caméra est disponible. Rien à préparer.

### Sur un poste local

```bash
npm ci
npm run build
python3 -m http.server 5199 --directory dist
```

Puis ouvrir `http://localhost:5199/` sur le poste, ou `http://<ip>:5199/` depuis un
téléphone du même réseau.

**Ne pas utiliser `npm run dev`** pour présenter : le serveur de développement renvoie
des rechargements de page à chaque modification de fichier. C'est la cause du
« rechargement intempestif » constaté sur téléphone.

Limite du mode local : Safari iOS réserve la caméra aux origines sûres (`https://` ou
`localhost`). Depuis `http://192.168.x.x`, **le scan par caméra ne fonctionnera pas** —
utiliser alors les liens directs ci-dessous.

## 2. Déroulé (2–3 minutes)

1. **Accueil** — « Collectez les sons. Créez votre musique. »
   Martin est le seul univers disponible ; les trois autres sont grisés, marqués
   « Bientôt ». Ne pas les présenter comme disponibles.
2. **Martin** → le parcours en sept étapes.
3. **Un son** — écouter n'ajoute pas à la musique : c'est le geste central.
   Le son passe à « découvert », puis « + Ajouter à ma musique ».
4. **Un poste QR** — ouvrir `#/poste/3` : le son est déjà dans le carnet. C'est ce qui
   se passe quand un visiteur scanne une affiche au musée.
5. **Carnet** — les deux listes, le retrait, le compteur dans la barre du haut, le
   lecteur partagé (play, pause, reprise, forme d'onde).
6. **Découvrir le résultat** — le morceau de Martin, 48 s.
7. **Nouvelle visite** — remet tout à zéro pour le visiteur suivant.

## 3. Liens directs (si le scan n'est pas possible)

| Poste | Lien |
|---|---|
| 1 — Flore et faune | `https://ashmotif200.github.io/sugar-orchestra/#/poste/1` |
| 2 — Pas sur le sable | `…/#/poste/2` |
| 3 — Cuillère, tasse et sucre | `…/#/poste/3` |
| 4 — Commerçants et étals | `…/#/poste/4` |
| 5 — Le sucre qui crisse | `…/#/poste/5` |
| 6 — Lota et cuillère | `…/#/poste/6` |
| 7 — La signature du contrat | `…/#/poste/7` |
| 8 — Charrette à bœufs | `…/#/poste/8` |

Les QR imprimables sont dans [`docs/qr/`](docs/qr/) (SVG pour l'impression, PNG en
secours, planche A4).

## 4. Ce qu'il faut dire, et ce qu'il ne faut pas dire

**À dire**

- Le morceau final est **précomposé par Martin**. Il ne dépend pas des sons choisis
  par le visiteur. L'écran de résultat l'indique.
- Huit sons sont disponibles ; les autres sont visibles mais verrouillés « Bientôt ».
- Les textes historiques ne sont pas encore écrits par le musée : les fiches disent
  « Description à venir » plutôt que d'inventer.

**À ne pas dire**

- « La musique est générée à partir de vos sons » — c'est faux dans cette version.
- « Les quatre univers fonctionnent » — un seul fonctionne.
- « Le son de Lota est un enregistrement du musée » — c'est un enregistrement de
  Tanguy, et sa licence n'est pas attribuée (`docs/ASSET-LICENSES.md` § 5.1)
- « Testé sur iPhone » — le parcours et la lecture l'ont été, **le scanner caméra non**.

## 5. Avant d'ouvrir au public

- [ ] Vérifier que la démonstration répond : `curl -sI https://ashmotif200.github.io/sugar-orchestra/ | head -1`
- [ ] Vérifier le morceau : `curl -sI https://ashmotif200.github.io/sugar-orchestra/demo/energetique-v1.m4a | grep -i content-type` → `audio/mp4`
- [ ] Tester un scan réel avec un téléphone
- [ ] Prévoir les liens directs si la caméra refuse
- [ ] Faire « Nouvelle visite » entre deux visiteurs

## 6. Si quelque chose ne marche pas

| Symptôme | Cause probable | Geste |
|---|---|---|
| le morceau ne démarre pas sur iPhone | format non décodé | vérifier que la version `.m4a` est bien déployée (`docs/DEPLOYMENT.md` § 1.4) |
| le scan caméra refuse | origine non sûre, ou permission refusée | utiliser les liens directs ; relever le nom exact de l'erreur Safari |
| un QR ouvre l'écran de choix de mascotte | aucune mascotte choisie | choisir Martin, puis rescanner — c'est le comportement voulu |
| la page se recharge seule | serveur de développement | présenter depuis le build statique |
| le carnet est vide alors qu'on a scanné | la visite a été réinitialisée | « Nouvelle visite » efface tout, y compris la collecte |
