# Architecture

Ce document décrit **ce qui existe dans le dépôt** au 16 novembre 2026, pas une cible.
Les documents de conception plus détaillés sont référencés au fil du texte ; ils sont
conservés tels quels, y compris quand ils décrivent des pistes abandonnées.

## 1. Vue d'ensemble

Trois ensembles quasi indépendants, qui communiquent par des fichiers et une API HTTP
locale.

| Ensemble | Entrée | Rôle | Requis pour le visiteur ? |
|---|---|---|---|
| **Site visiteur** | `index.html`, `src/` | parcours, collecte, écoute, résultat | oui, seul |
| **Serveur d'administration** | `server/admin-server.mjs` | API REST, SQLite, rendu V2 serveur, sert `dist/` | non |
| **Outillage** | `scripts/`, `tests/` | import/archivage, QR, analyses, sauvegarde, tests | non |

Conséquence pratique : le site publié sur GitHub Pages est le **premier ensemble
seul**. C'est ce qui permet un hébergement statique sans base de données ni secret.

## 2. Le site visiteur

### 2.1 Point d'entrée et routage

`src/main.tsx` monte `App`. Tout l'état de navigation vit dans le **fragment d'URL**,
interprété par `src/router.ts` :

| Route | Écran | Vient d'un QR ? |
|---|---|---|
| `#/` | accueil, choix de la mascotte | non |
| `#/parcours` | les sept étapes | non |
| `#/etape/:id` | étape, liste des sons, fiche | non |
| `#/poste/:id` | fiche d'un poste physique | **oui** |
| `#/qr/:cle` | résolution d'un QR par identifiant | oui |
| `#/carnet` | sons découverts / retenus | non |
| `#/composer` | génération (ou lecture du morceau en mode démo) | non |
| `#/resultat` | résultat | non |
| `#/admin/:section` | Super Admin (chargé à la demande) | non |

Le routeur par hash a deux vertus : aucun serveur ne doit réécrire les URL (donc
GitHub Pages fonctionne tel quel), et un QR code peut encoder une route interne.

### 2.2 État de session

`src/session.ts` — objet versionné dans `localStorage` :
`{ v, universeId, discovered[], selected[] }`. Il est relu au chargement, filtré
contre le catalogue et l'état de publication, puis réécrit à chaque changement. Une
visite terminée se réinitialise par `clearSession()`.

### 2.3 Couche audio

`src/audio/service.ts` est un singleton qui possède l'`AudioContext`. Points
importants :

- **décodage à la demande** : `ensure(ids)` télécharge et décode, une seule fois par
  son, avec suivi de progression ;
- **préécoute** : `preview(sound, 6)` joue six secondes, jamais automatiquement —
  toujours en réponse à un geste ;
- **pause et reprise réelles** : `pausePreview()` mémorise la position ;
- **erreurs distinguées** : fichier absent (`HTTP 404`) et erreur de décodage ne
  produisent pas le même message.

Depuis la migration, `Step.tsx` ne demande que les sons **publiés** : un son
verrouillé « Bientôt » n'est pas ouvrable, son audio n'a donc personne à servir. Sans
ce filtre, une étape téléchargeait aussi les fichiers des sons en brouillon, qui ne
sont pas publiés avec le site.

`src/audio/useSamplePlayer.ts` fournit le lecteur partagé du carnet (play, pause,
reprise, forme d'onde synchronisée). Il existe parce que le bouton du carnet n'était
relié à rien : il faut charger le buffer **avant** d'afficher l'état « lecture ».

### 2.4 Données du visiteur

| Fichier | Contenu | Mis à jour par |
|---|---|---|
| `src/data/catalog.json` | 40 sons, 7 étapes, mesures par son | `npm run import-assets`, `npm run admin:apply` |
| `src/data/publication.json` | état publié/brouillon des univers et des sons | `node scripts/admin/export-publication.mjs` |
| `config/postes.json` | 8 postes : id, QR, code de sample, titre, description | à la main |
| `config/steps.json` | étapes du parcours et sons rattachés | `admin:apply` ou à la main |
| `config/qr.json` | base des URL encodées dans les QR | à la main |
| `src/data/demo.ts` | mode démonstration et nom du morceau | à la main |

**Règle unique de disponibilité** (`src/data/publication.ts`) : un univers est
proposé s'il est **publié** *et* si son moteur est implémenté ; un son est utilisable
s'il est **publié**. Rien n'est codé en dur dans les écrans.

En mode statique (`VITE_STATIC_HOSTING=1`), la même règle s'applique, mais la source
est l'instantané `publication.json` — il n'y a pas d'appel réseau. En développement,
l'application interroge d'abord `/api/v2/public/catalog-state`, puis retombe sur
l'instantané.

### 2.5 Moteur de composition

Deux générations coexistent, et **aucune n'est utilisée par la démonstration**.

| Moteur | Emplacement | État |
|---|---|---|
| V1 | `src/engine/` (`plan.ts`, `render.ts`, `roles.ts`, `policy.ts`, `rng.ts`) | fonctionnel, historique |
| V2.0 | `src/engine-v2/` (`capabilities`, `profiles`, `plan`, `browser`) | fonctionnel, expérimental |
| V2.1 | `src/engine-v2/v21/` (motifs, harmonie, plan) + rendu serveur | fonctionnel, expérimental |

Le rendu V1 se fait **dans le navigateur** (`OfflineAudioContext`) ; le rendu V2.1
passe par le serveur (`server/v2-render.mjs`) parce qu'il utilise des transformations
que le navigateur ne sait pas faire.

`src/engine/policy.ts` est le point unique de la politique musicale : il décide qu'un
son est utilisable (`isMusicallyUsable`). Tous les écrans et le planificateur passent
par lui — ne pas dupliquer cette règle ailleurs.

Design, mesures et limites : `docs/music-engine-v2/`, `docs/phase-a/`,
`docs/v2.0.5/`, `docs/v2.1/`.

### 2.6 Traductions

`src/i18n/fr.json` (défaut) et `en.json`, miroirs. Aucun texte d'interface n'est écrit
en dur dans les écrans.

## 3. Serveur d'administration

Node.js, modules ES, **aucun framework HTTP** : `node:http`, routage à la main.

| Fichier | Rôle |
|---|---|
| `server/admin-server.mjs` | démarrage, écoute sur `SO_HOST:SO_PORT` (défaut `127.0.0.1:5182`), service de `dist/` |
| `server/api.mjs` | toutes les routes `/api/*` (≈ 900 lignes) |
| `server/auth.mjs` | sessions, mots de passe (scrypt), permissions |
| `server/db.mjs` | SQLite (`node:sqlite`), schéma, audit, répertoires de données |
| `server/v2-render.mjs` | rendu audio serveur du moteur V2 |

### 3.1 Modèle de données

`data/admin/sugar.db` (SQLite, **hors dépôt**) :

- `users`, `sessions` — comptes et jetons ;
- `universes`, `sounds` — statut de publication, disponibilité ;
- `content` / versions — contenu éditorial (titre, description courte, histoire,
  pédagogie, sources) avec un cycle brouillon → relecture → approuvé → publié ;
- `audio_versions` — versions de fichiers audio téléversés ;
- `publications` — instantanés publiés ;
- `audit_log` — journal des actions, sans jamais stocker de mot de passe ;
- `settings` — dont la publication effectivement appliquée.

### 3.2 Publier ≠ appliquer

C'est la distinction la plus importante du serveur, et la source de plusieurs bugs
passés :

1. **Publier** (`POST /api/publication/publish`) écrit un instantané dans
   `data/admin/publications/pub-N/`. Le site visiteur **ne change pas**.
2. **Appliquer** (`npm run admin:apply -- --from N --yes --note "…"`) copie cet
   instantané dans `src/data/catalog.json` et `config/steps.json`, après sauvegarde.
   C'est la seule commande qui modifie le bundle du visiteur.

L'API expose `GET /api/publication/status` qui rend l'écart visible
(`latestPublication`, `appliedPublication`, `inSync`) au lieu de le laisser implicite.

### 3.3 Sécurité

- sessions par cookie `so_admin`, `HttpOnly`, `SameSite=Strict`, `Secure` si
  `SO_HTTPS=1` ;
- permissions vérifiées **côté serveur** à chaque route mutante ;
- limitation de débit sur le rendu public (`x-so-admin: 1`, 10 rendus/min/IP) ;
- en-têtes `Content-Security-Policy` et `X-Frame-Options` ;
- le serveur n'est **jamais** exposé par défaut : `127.0.0.1` uniquement.

Détail complet : `docs/admin/architecture.md` et `docs/SECURITY.md`.

## 4. Outillage

| Dossier | Contenu |
|---|---|
| `scripts/catalog/` | archivage non destructif du catalogue, import de samples, bascule vers les WAV de démo |
| `scripts/admin/` | provisioning, sauvegarde, application d'une publication, export de l'instantané, bascule des 8 sons |
| `scripts/qr/` | génération et **auto-vérification** des huit QR |
| `scripts/archive/` | sauvegarde indépendante du projet (manifeste SHA-256 + bundle Git) |
| `scripts/phase-a/`, `scripts/v2/`, `scripts/production/` | analyses musicales et production de morceaux (Python, hors périmètre Node) |
| `tests/` | trois suites Node (API admin, moteur V2.0, moteur V2.1) |

Les scripts Python ne sont couverts par **aucun** test JavaScript : ils ont leurs
propres harnais (`verify*.py`, `build-style-models.py --check`).

## 5. Flux complets

### 5.1 Un visiteur qui scanne un QR

```
QR « …/#/poste/3 »
  └▶ router.ts : route { poste, id: 3 }
      └▶ data/postes.ts : poste 3 → sample 02_01
          ├▶ si 02_01 publié → session.selected += 02_01 (une seule fois)
          └▶ écran Poste : titre, description, écoute, « Continuer la visite »
```

### 5.2 Fin de parcours, mode démonstration

```
carnet → « Découvrir le résultat »
  └▶ demoMode.enabled === true
      └▶ DemoResult : <audio controls playsInline src="demo/energetique-v1.m4a">
          └▶ mention explicite : le morceau n'est pas composé des sons collectés
```

### 5.3 Fin de parcours, moteur réel

```
carnet → « Composer »
  └▶ buildScore(univers, sélection)      src/engine/plan.ts
      └▶ render(score)                   src/engine/render.ts (OfflineAudioContext)
          └▶ encodeWav + rapport d'invariants
              └▶ IndexedDB (src/storage/compositions.ts) + écran Résultat
```

## 6. Décisions d'architecture et leurs raisons

| Décision | Raison |
|---|---|
| Routeur par hash, `base: './'` | fonctionne à la racine comme dans un sous-chemin, sans réécriture d'URL, donc sur GitHub Pages |
| Aucun framework CSS | le design est un système de jetons (`DESIGN.md`), pas une bibliothèque |
| API sans framework | zéro dépendance de production côté serveur, surface d'attaque réduite |
| SQLite | un seul opérateur, aucun service à administrer, sauvegarde par copie de fichier |
| Publier ≠ appliquer | permet de préparer une publication sans toucher ce que voit le visiteur |
| Mode démonstration derrière un drapeau | permet de présenter un morceau abouti sans supprimer le moteur |
| `publication.json` embarqué | rend l'hébergement statique possible sans base de données |

## 7. Ce que l'architecture ne fait pas

- Pas de service worker : pas de mode hors-ligne complet.
- Pas de rendu serveur : le HTML est une coquille, tout est rendu côté client.
- Pas de file d'attente ni de tâche de fond : le rendu V2 est synchrone dans une
  requête.
- Pas de multi-tenant : un seul projet, une seule base.
- Pas d'authentification visiteur : la session est locale et non signée.
