# Super Admin — guide d’exploitation

Interface d’administration de Sugar Orchestra. Elle sert à préparer, versionner et
publier les contenus du musée **sans toucher** au moteur musical ni aux fichiers
originaux.

## Démarrage

```bash
npm run build            # construit le parcours visiteur + le module admin
npm run admin:serve      # API + application sur http://127.0.0.1:5182
```

Ouvrir **http://127.0.0.1:5182/#/admin**.

Le serveur écoute uniquement sur la boucle locale par défaut. C’est volontaire : une
administration ne doit pas être joignable depuis le réseau du musée sans décision
explicite et sans TLS devant. Pour l’exposer sciemment :

```bash
SO_HOST=0.0.0.0 SO_PORT=5200 SO_HTTPS=1 node server/admin-server.mjs
```

`SO_HTTPS=1` ajoute l’attribut `Secure` au cookie de session — à n’activer que derrière
un reverse-proxy TLS.

## Premier compte administrateur

Il n’existe **aucun compte par défaut** et aucun mot de passe dans le code.

```bash
npm run admin:provision -- --email vous@exemple.org --name "Votre nom"
```

Le mot de passe est généré (24 caractères, classes garanties), **jamais affiché**, et
écrit une seule fois dans `data/admin/first-admin.txt` (mode `0600`). Déplacez-le dans
un gestionnaire de mots de passe, puis supprimez le fichier.

Pour fournir votre propre mot de passe sans qu’il apparaisse dans l’historique du
shell :

```bash
printf '%s\n' "$MON_MOT_DE_PASSE" | npm run admin:provision -- --email … --password-stdin
```

Un second `super_admin` est refusé sans `--force` ; les autres comptes se créent depuis
**/admin/users** une fois connecté.

## Modules

| Section | Rôle | Ce qu’elle fait réellement |
|---|---|---|
| Tableau de bord | `sounds.read` | indicateurs calculés depuis la base (jamais de valeurs fictives) |
| Bibliothèque sonore | `sounds.read` / `sounds.replace` | 40 sons, recherche, filtres, fiche, lecteur authentifié, remplacement versionné, restauration |
| Contenus & histoires | `content.*` | circuit brouillon → relecture → approuvé → publié, versions, retour arrière |
| Étapes du musée | `steps.*` | 7 étapes, édition des textes, ordre des sons |
| Studio musical | `music.*` | 4 univers, statut et paramètres réellement lus par le moteur |
| Outils développeur | `dev.use` | simulation du parcours, test de composition avec le moteur existant, diagnostics |
| Comptes & rôles | `users.*` | création, rôle, activation |
| Système | `system.read` | diagnostics, publications, journal d’audit |

## Remplacer un sample

Bibliothèque sonore → ouvrir un son → **Remplacer le fichier audio**.

Le serveur vérifie le type MIME, les octets d’en-tête (RIFF/WAVE, MP3, M4A, FLAC),
calcule l’empreinte SHA-256, refuse un fichier déjà présent, écrit un **nouveau**
fichier `data/admin/files/<son>/v<N>-<sha8>.<ext>`, sonde la durée au moyen de
`ffprobe`, crée la version et marque les analyses existantes comme **invalidées**
(`analysis_version = 'stale'`). L’original reste en version 1 et n’est jamais écrasé.

Restaurer une version crée une **nouvelle** version à partir de l’ancienne : rien n’est
réécrit, l’historique reste linéaire et lisible.

## Publication

Deux étapes distinctes, volontairement :

1. **Publier** (dans l’interface ou `POST /api/publication/publish` avec
   `{"confirm":"PUBLIER"}`) écrit un instantané dans
   `data/admin/publications/pub-<n>/` — catalogue, étapes, manifeste. **Le parcours
   visiteur n’est pas modifié.**
2. **Appliquer** au bundle que lit l’application :

```bash
npm run admin:apply -- --from 3 --yes --note "muséomix 14/11"
```

Cette commande sauvegarde l’état précédent dans `data/admin/applied-backups/`, copie
les fichiers, journalise l’opération, et rappelle qu’il faut relancer `npm run build`.

> N’appliquez jamais une publication sur l’environnement de production sans
> autorisation du propriétaire du projet. La commande refuse de s’exécuter sans `--yes`.

## Sauvegarde et restauration

```bash
npm run admin:backup                 # -> data/admin/backups/<horodatage>/
npm run admin:backup -- --keep 5     # ne conserver que 5 sauvegardes
```

La base est copiée avec `VACUUM INTO` (cohérente même avec le WAL actif), avec les
fichiers audio versionnés et les publications.

Restauration (manuelle, jamais automatique) :

```bash
node server/admin-server.mjs &        # arrêter d'abord : s6-svc -r /run/service/<slot>
mv data/admin data/admin.broken
mkdir -p data/admin && cp -a data/admin/backups/<horodatage>/. data/admin/
# le fichier sugar.db de la sauvegarde devient data/admin/sugar.db
npm run admin:serve
```

## API

Toutes les routes sont sous `/api`, exigent une session sauf `login` et `health`, et
exigent l’en-tête `x-so-admin: 1` sur toute requête mutante (anti-CSRF).

```
POST   /api/auth/login | /api/auth/logout        GET /api/auth/me
GET    /api/dashboard
GET    /api/sounds[?q=&step=&status=&sensitive=]
GET    /api/sounds/:id           GET  /api/sounds/:id/audio[?range]
POST   /api/sounds/:id/replacement     (corps = fichier audio brut)
POST   /api/sounds/:id/restore/:v      POST /api/sounds/:id/reanalyse
GET    /api/content[?status=]    GET/PATCH /api/content/:soundId:locale
POST   /api/content/:id/transition     POST /api/content/:id/revert/:v
GET    /api/steps                GET/PATCH /api/steps/:id   PUT /api/steps/:id/sounds
GET    /api/music                PATCH /api/music/:id
GET    /api/users                POST /api/users            PATCH /api/users/:id
GET    /api/audit?limit=         GET /api/system/diagnostics
GET    /api/publication/preview  POST /api/publication/publish   GET /api/publications
POST   /api/dev/selection
```

## Tests

```bash
npm run admin:test      # 56 contrôles d'intégration sur une base temporaire
```

Le test démarre un vrai serveur, provisionne un vrai compte via la CLI réelle, puis
vérifie l’authentification, les refus de permission, l’anti-CSRF, le remplacement
audio, le circuit éditorial, l’immuabilité des restrictions, la publication, l’audit et
la déconnexion. Il n’écrit jamais dans `data/admin` ni dans le bundle visiteur.

## Navigation et persistance — à revérifier après toute modification

L'administration est une SPA à routage par hash. Deux régressions y ont déjà eu lieu ;
voici comment les détecter en une minute, dans un vrai navigateur, sans outillage.

**1. Navigation sans rechargement.** Sur `#/admin`, dans la console :

```js
window.__m = Date.now()
```

Cliquer les huit sections de la barre latérale, puis vérifier :

```js
performance.getEntriesByType('navigation').length   // doit valoir 1
window.__m !== undefined                            // doit être true
```

Une valeur ≥ 2 signifie qu'un chargement de document a eu lieu : ce n'est plus une
navigation SPA. Un `window.__m` à `undefined` le confirme (le rechargement détruit les
variables globales).

**2. Persistance de la composition.** Composer une pièce, arriver sur `#/resultat`,
puis rafraîchir (F5). L'écran doit afficher « Votre création » avec la forme d'onde et
le bouton Écouter — jamais « Aucune création retrouvée ». Contrôle direct du stockage :

```js
window.indexedDB.open('sugar-orchestra.compositions')
```

Les compositions vivent dans IndexedDB, en deux contextes séparés : `visitor` (parcours
public) et `admin-test` (outils développeur). Rétention : 3 par contexte, 48 Mo au total.

> **Attention au serveur de développement.** `npm run dev` (Vite, port 5180) recharge le
> document à chaque modification de fichier (HMR). Une composition en mémoire y disparaît
> à chaque édition : ce n'est pas un bug de l'application, mais cela ressemble exactement
> à un rechargement. Pour démontrer ou tester, servir le build de production avec
> `npm run admin:serve` (port 5182).

## Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| « API indisponible » sur l’écran de connexion | serveur admin non lancé | `npm run admin:serve` |
| `dist/ absent` en 503 | build manquant | `npm run build` |
| `EADDRINUSE 5182` | port déjà pris | `SO_PORT=5200 npm run admin:serve` |
| avertissement `SQLite is an experimental feature` | `node:sqlite` de Node 22 | sans conséquence ; masquable avec `NODE_NO_WARNINGS=1` |
| connexion refusée après 5 essais | limitation de débit | attendre 15 min |
| rechargement complet à chaque clic | serveur de développement Vite (HMR, port 5180) | servir le build : `npm run admin:serve` (5182) |
| « Aucune création retrouvée » après F5 | IndexedDB vidée (navigation privée) ou contexte effacé | composer à nouveau ; vérifier que le stockage local est autorisé |
| analyse « indisponible » | chaîne librosa absente de l’hôte | installer `/opt/data/tools/sugar-audio` ou ignorer : l’analyse reste marquée invalidée |

## Ce qui n’est pas implémenté

- Aperçu de forme d’onde dans la fiche sonore (l’analyse existe, pas le rendu).
- Comptes visiteurs et profils persistés : le modèle de données est en place, aucun
  endpoint ne l’expose encore.
- Réglage des paramètres d’arrangement par univers : le moteur ne les lit pas, donc
  aucun contrôle n’est affiché (voir `architecture.md`).
- Réinitialisation de mot de passe en libre-service.
