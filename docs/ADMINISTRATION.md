# Administration

Le Super Admin est une application web servie par le même bundle que le site
visiteur, sous `#/admin`, plus une API REST locale. Il est **absent** de la
démonstration GitHub Pages : `#/admin` y renvoie à l'accueil.

Guides détaillés existants, à consulter pour l'exploitation et la conception :

- [`docs/admin/README.md`](admin/README.md) — exploitation : démarrage, premier
  compte, modules, remplacement d'un sample, publication, sauvegarde, dépannage.
- [`docs/admin/architecture.md`](admin/architecture.md) — conception, modèle de
  données, permissions, compromis et limites.

Ce document-ci ajoute ce qui manquait : la vue d'ensemble et l'articulation avec le
reste du dépôt.

## 1. Démarrage

```bash
npm ci
npm run build          # le serveur sert dist/
npm run admin:serve    # http://127.0.0.1:5182/#/admin
```

Aucun compte par défaut :

```bash
npm run admin:provision -- --email vous@exemple.org --name "Votre nom"
```

Le mot de passe est écrit **une fois** dans `data/admin/first-admin.txt` (droits 600),
jamais sur la sortie standard. Il n'existe pas de changement de mot de passe en
libre-service : supprimer l'utilisateur, supprimer le fichier, reprovisionner — ou
créer le compte via `POST /api/users`.

## 2. Rôles

| Rôle | Ce qu'il peut |
|---|---|
| `super_admin` | tout (`*`) |
| `technical_admin` | sons (lecture/remplacement), outils dev, système, audit, lecture du reste |
| `museum_manager` | contenus (édition, relecture), étapes, publication, audit |
| `content_editor` | contenus (édition), étapes (lecture) |
| `music_editor` | univers musicaux, outils dev |
| `viewer` | lecture seule |

La matrice est dans `server/auth.mjs` (`PERMISSIONS`) et fait foi : l'interface ne fait
que la refléter. Toute route mutante revérifie la permission côté serveur.

## 3. Modules

| Section | Ce qu'elle fait réellement |
|---|---|
| Tableau de bord | indicateurs calculés depuis la base, jamais de valeurs fictives |
| Bibliothèque sonore | 40 sons, recherche, fiche, lecteur authentifié, remplacement versionné, restauration |
| Contenus & histoires | circuit brouillon → relecture → approuvé → publié, versions, retour arrière |
| Étapes du musée | 7 étapes, textes, ordre des sons |
| Studio musical | 4 univers, statut et paramètres lus par le moteur |
| Outils développeur | simulation du parcours, essai de composition, diagnostics |
| Comptes & rôles | création, rôle, activation |
| Système | diagnostics, publications, journal d'audit |

## 4. Publier ≠ appliquer — la distinction centrale

C'est la source des malentendus les plus coûteux du projet, et elle est maintenant
visible dans l'interface plutôt qu'implicite.

```
brouillon ──▶ relecture ──▶ approuvé ──▶ PUBLIÉ ──▶ APPLIQUÉ ──▶ servi au visiteur
                                          (1)         (2)
```

1. **Publier** — `POST /api/publication/publish` avec `{"confirm":"PUBLIER"}` écrit un
   instantané dans `data/admin/publications/pub-N/`. **Le site visiteur ne change
   pas.**
2. **Appliquer** — la seule commande qui écrit dans le bundle du visiteur :

   ```bash
   npm run admin:apply -- --from N --yes --note "…"
   ```

   Elle sauvegarde `src/data/catalog.json` avant de le réécrire. **Ne jamais la lancer
   sans l'accord du propriétaire du projet.**

`GET /api/publication/status` rend l'écart visible :

```json
{ "latestPublication": 2, "appliedPublication": 1, "inSync": false }
```

Un `inSync: false` signifie « publié mais pas encore appliqué ». En mode statique
(GitHub Pages), il n'y a pas d'API : la source est `src/data/publication.json`, qu'il
faut régénérer après tout changement de statut.

```bash
node scripts/admin/export-publication.mjs
```

## 5. Ce que l'administration ne peut pas faire, par choix

- **Lever une restriction éditoriale.** Il n'existe aucun endpoint qui modifie
  `sensitive` ou `availability` : la protection tient à l'**absence de route**, pas à
  une vérification qu'on pourrait désactiver. Ajouter un son « sensible » à une étape
  reste possible (l'étape 4 en contient légitimement).
- **Réimplémenter le moteur.** Les outils développeur **importent** le moteur existant
  (`buildScore`, `audio.render`) ; ils ne le dupliquent pas.
- **Écrire directement dans le bundle visiteur.** Seul `admin:apply` le fait.

## 6. Sécurité — l'essentiel

Le serveur écoute sur `127.0.0.1` par défaut. Il ne doit **pas** être exposé
directement : il sert aussi les fichiers audio versionnés.

- session par cookie `so_admin`, `HttpOnly`, `SameSite=Strict`, `Secure` si
  `SO_HTTPS=1` ;
- mot de passe : scrypt, 8 caractères minimum (la politique de l'API et celle de
  l'interface doivent rester alignées — elles ont divergé une fois, à 12 contre 16,
  et un mot de passe conforme était refusé par un bouton grisé) ;
- en-tête `x-so-admin: 1` exigé sur toute requête mutante (anti-CSRF) ;
- limitation de débit sur le rendu public : 10 par minute et par IP ;
- journal d'audit qui ne contient **jamais** de mot de passe (vérifié par un test).

Voir [`docs/SECURITY.md`](SECURITY.md).

## 7. Sauvegarde

`data/admin/` est hors dépôt : c'est la **seule** copie de la base, des comptes et de
l'historique éditorial.

```bash
npm run admin:backup     # VACUUM INTO + fichiers audio versionnés + publications
```

Restaurer = replacer `sugar.db` dans `data/admin/sugar.db` et redémarrer le serveur.

La sauvegarde indépendante du projet (`scripts/archive/create-backup.sh`) inclut la
base, mais elle ne remplace pas une sauvegarde régulière : elle a été prise une fois,
le 16 novembre 2026.

## 8. Tests

```bash
npm run admin:test       # 56 contrôles d'intégration
```

Le test démarre un vrai serveur sur une base temporaire, provisionne un vrai compte
via la CLI réelle, puis vérifie l'authentification, les refus de permission,
l'anti-CSRF, le remplacement audio, le circuit éditorial, l'immuabilité des
restrictions, la publication, l'audit et la déconnexion. Il n'écrit ni dans
`data/admin` ni dans le bundle du visiteur.

**État au 16 novembre 2026 : 56/56.** Le contrôle `visitor_catalog_unchanged_by_publish`,
longtemps rouge pour une raison étrangère à ce qu'il mesurait, a été réparé — il
compare désormais l'empreinte du bundle avant et après la publication. Détail dans
`docs/DEVELOPMENT.md` § 5.

## 9. Après un changement dans l'administration

Trois gestes, dans cet ordre, sinon le site publié ne suit pas :

1. `npm run admin:apply -- --from N --yes --note "…"` (écrit le bundle visiteur) ;
2. `node scripts/admin/export-publication.mjs` (met à jour l'instantané embarqué,
   utilisé par l'hébergement statique) ;
3. reconstruire et republier (`bash scripts/deploy/publish-pages.sh`).
