# Super Admin — architecture

## Vue d’ensemble

```
┌──────────────────────────── navigateur ────────────────────────────┐
│  SPA React (hash router)                                           │
│    #/…            parcours visiteur   (bundle index-*.js)          │
│    #/admin/…      administration      (chunk AdminApp-*.js, lazy)  │
└───────────────┬────────────────────────────────────────────────────┘
                │  même origine : cookie HttpOnly + SameSite=Strict
┌───────────────▼────────────────────────────────────────────────────┐
│  server/admin-server.mjs   (node:http, 127.0.0.1:5182)             │
│    /api/*  → server/api.mjs   (auth, RBAC, versionnement, audit)   │
│    reste   → dist/            (statique + CSP, SPA fallback)       │
└───────────────┬───────────────────────────────┬────────────────────┘
                │                               │
┌───────────────▼──────────────┐  ┌─────────────▼────────────────────┐
│ data/admin/sugar.db          │  │ data/admin/files/<son>/v<N>-…    │
│  (SQLite, node:sqlite, WAL)  │  │ data/admin/publications/pub-<n>/ │
└──────────────────────────────┘  └──────────────────────────────────┘
                │
                │  src/data/catalog.json — lu par l’app visiteur (immuable ici)
```

Le bundle visiteur n’est **jamais** modifié par l’administration. Seule la commande
`admin:apply`, explicite et manuelle, écrit dans `src/data/catalog.json`.

## Séparation des domaines

| Domaine | Tables | Qui écrit |
|---|---|---|
| Muséographique | `sounds`, `restrictions`, `steps`, `step_sounds`, `content`, `content_versions` | `content.*`, `steps.*` |
| Musical | `universes`, `sound_versions` (provenance audio) | `music.*`, `sounds.replace` |
| Utilisateurs | `users`, `sessions`, `visitor_profiles`, `visit_sessions`, `compositions` | `users.manage`, plus tard le parcours |
| Système | `audit_log`, `publications`, `settings` | tous, en écriture journalisée |

Les métadonnées muséographiques (`name`, `credits`, `license`, `nature`) viennent de
l’inventaire du musée et sont **en lecture seule** dans l’interface : les modifier
depuis un formulaire reviendrait à inventer une information de provenance.

## Authentification

- **Mots de passe** : `scrypt(N=16384, r=8, p=1, keylen=64)`, sel aléatoire de 32 octets
  par compte, comparaison via `timingSafeEqual`. Jamais de mot de passe en clair, jamais
  journalisé, jamais renvoyé par l’API.
- **Sessions** : 32 octets aléatoires dans le cookie `so_admin`
  (`HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`), stockées en base sous forme de
  SHA-256 : une fuite de la base ne donne pas de sessions utilisables. Expiration 8 h,
  vérifiée à chaque requête, ligne supprimée à l’expiration.
- **Anti-CSRF** : `SameSite=Strict` + en-tête obligatoire `x-so-admin: 1` sur toute
  méthode non-lecture. Un formulaire HTML tiers ne peut pas le reproduire.
- **Anti-force brute** : 5 échecs par couple (email, IP) → blocage 15 min, en mémoire.
- **Provisionnement** : uniquement par CLI, mot de passe généré, écrit dans un fichier
  `0600`, jamais affiché. Aucun compte par défaut.
- **En-têtes** : CSP `default-src 'self'` (pas de script tiers, pas d’`eval`),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `COOP`.

## Permissions

Matrice explicite dans `server/auth.mjs`, vérifiée côté serveur à chaque appel
(`require('content.edit')`). L’interface ne fait que refléter la liste renvoyée par
`/api/auth/me`.

| Rôle | Permissions |
|---|---|
| `super_admin` | `*` |
| `technical_admin` | sons (lecture/remplacement), dev, système, audit, lecture des autres modules |
| `museum_manager` | contenus (édition, relecture), étapes, publication, lecture des sons et de l’audit |
| `content_editor` | contenus (édition), lecture des sons et des étapes |
| `music_editor` | studio musical, outils dev, lecture des sons |
| `viewer` | lecture seule (sons, contenus, étapes, musique) |

Un compte ne peut pas changer son propre rôle (refus serveur), et un `viewer` reçoit 403
sur toute écriture, y compris via un appel direct à l’API — c’est testé.

## Versionnement

- **Audio** : `sound_versions` conserve chaque fichier écrit (`v1` = master original dans
  `assets/originals`, référencé en place avec son SHA-256 ; `v2+` = fichiers de
  `data/admin/files`). Restaurer crée une nouvelle version : l’historique n’est jamais
  réécrit. Remplacer un fichier passe `sounds.analysis_version` à `'stale'` — les mesures
  de l’ancien fichier ne sont **jamais** réutilisées silencieusement.
- **Contenus** : `content_versions` archive chaque état, avec auteur, date, statut et
  note. Le retour arrière crée un nouveau brouillon à partir de la version choisie.
- **Publications** : `publications` + instantané sur disque. Revenir en arrière =
  republier un instantané antérieur.

## Restrictions éditoriales

`restrictions` porte `sensitive`, `availability`, la provenance et le statut de
validation. **Aucune route de l’API ne permet de modifier ces valeurs** : ce n’est pas
un contrôle d’interface, c’est une absence de surface d’attaque (vérifié par le test
`no_route_can_lift_a_restriction`).

Le garde-fou du moteur (`buildScore` filtre les sons `sensitive` / `not_musical`) est
**inchangé**. Ajouter un son sensible à une étape reste possible — l’étape 4 en contient
légitimement — mais il ne devient pas composable pour autant. Le filtre serveur de
`/api/dev/selection` refuse les mêmes sons, indépendamment de l’interface.

Lever une restriction exigera un circuit de validation éditoriale explicite, hors de
cette interface.

## Modèle de publication

Brouillon (base) → publication (instantané sur disque) → application au bundle (commande
manuelle). Trois raisons :

1. une faute de frappe éditoriale ne peut pas atteindre un visiteur par accident ;
2. l’instantané est un artefact daté, inspectable et comparable ;
3. l’application au bundle est une opération de déploiement, pas une sauvegarde de
   formulaire — elle exige `--yes` et une note, et laisse une sauvegarde de l’état
   précédent.

## Modèles préparés (aucun endpoint)

`visitor_profiles` (trois modes : `anonymous`, `local`, `account`), `visit_sessions`
(étapes découvertes, sons sélectionnés, univers, version de configuration) et
`compositions` (seed, durée, **versions exactes des sons utilisés** avec leur SHA-256).
Ce dernier point est la raison d’être des tables : une composition doit rester
reproductible même après remplacement d’un sample.

`universes` prépare le studio musical : identifiant stable, nom, description, statut,
version, paramètres. `engine_implemented` dit la vérité sur ce que le moteur sait faire —
les deux univers sans compositeur sont marqués comme tels et ne sont pas sélectionnables
pour un test de composition.

## Décisions et compromis

| Décision | Raison | Compromis assumé |
|---|---|---|
| `node:sqlite` plutôt que `better-sqlite3` | zéro dépendance, zéro compilation native pour un prototype | API marquée expérimentale par Node ; encapsulée dans `server/db.mjs`, remplaçable en un fichier |
| SQLite plutôt qu’un magasin JSON | transactions, versions, audit, restauration crédibles | un fichier à sauvegarder, migration vers PostgreSQL à prévoir pour une installation permanente |
| Même origine (proxy Vite en dev) | cookie `SameSite=Strict` sans relâcher CORS | le dev server doit tourner pour l’admin en mode `vite dev` |
| Admin en chunk `lazy` | un visiteur ne télécharge jamais le code d’administration | un aller-retour réseau au premier accès admin |
| Publication en deux temps | aucune modification visiteur non décidée | une commande supplémentaire à retenir |
| Métadonnées en lecture seule | ne pas inventer de provenance | correction = réimport de l’inventaire |
| Pas de contrôle sur les paramètres d’arrangement | le moteur ne les lit pas | l’interface l’explique au lieu de faire semblant |

## Limites connues

- Pas d’aperçu de forme d’onde dans la fiche sonore (les pics existent côté audio, pas le
  rendu admin).
- Pas de réinitialisation de mot de passe en libre-service : un `super_admin` recrée le
  compte (`POST /api/users`) ou la CLI reprovisionne.
- Pas de pagination sur `/api/sounds` : 40 sons, chargés d’un bloc. À revoir au-delà de
  quelques centaines.
- L’analyse acoustique relancée depuis l’admin dépend de la chaîne externe
  `/opt/data/tools/sugar-audio` ; si elle est absente, la route répond 503 avec la raison
  au lieu de fabriquer un résultat.
