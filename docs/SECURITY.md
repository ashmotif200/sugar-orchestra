# Sécurité

Ce document décrit le modèle de sécurité du projet, ce qui a été vérifié avant la
publication du dépôt, et les risques résiduels assumés.

## 1. Périmètre

| Surface | Exposée ? | Commentaire |
|---|---|---|
| Site visiteur (GitHub Pages) | **oui, publiquement** | aucun secret, aucune authentification, aucune donnée personnelle |
| Serveur d'administration | non, `127.0.0.1` par défaut | ne doit **jamais** être exposé directement |
| Base SQLite `data/admin/` | non, hors dépôt | comptes, empreintes de mots de passe, historique éditorial |
| Sauvegarde indépendante | non, hors dépôt | contient la base et les masters audio |

Le point à retenir : **la démonstration publique ne contient aucun secret, parce
qu'elle ne parle à aucun serveur**. C'est ce qui rend l'hébergement statique
acceptable ici.

## 2. Vérification avant publication

Recherche effectuée le **16 novembre 2026**, sur les fichiers suivis **et sur
l'historique complet**.

| Recherche | Méthode | Résultat |
|---|---|---|
| jetons GitHub (`ghp_`, `github_pat_`) | motif sur tous les fichiers suivis + `git grep` sur tous les commits | **aucun** |
| clés cloud (`AKIA…`, `AIza…`), clés OpenAI (`sk-…`) | idem | **aucun** |
| clés privées (`BEGIN … PRIVATE KEY`) | idem | **aucune** |
| jetons Slack, mots de passe en clair, `api_key = "…"` | motif élargi, faux positifs écartés | **aucun** |
| fichiers `.env` réels | `git log --diff-filter=A` sur `.env*` | **jamais versionné** (seul `.env.example` existe) |
| `data/admin/first-admin.txt` (mot de passe initial) | historique complet | **jamais versionné** |
| `data/admin/sugar.db` (comptes, empreintes) | historique complet | **jamais versionné** |
| adresses électroniques personnelles | motif e-mail sur les fichiers suivis | une seule occurrence interne : `admin@sugarorchestra.local`, **adresse locale factice**, conservée |
| adresses réseau internes | `100.88.*`, `192.168.*`, nom d'hôte du tunnel | **corrigées** (voir § 3) |

Les versions de diffusion audio exclues du dépôt n'ont jamais contenu de métadonnée
personnelle : ce sont des conversions AAC des masters.

**Conclusion** : aucun secret n'est entré dans l'historique Git. Il n'y a donc rien à
révoquer, et pas de rotation à effectuer.

## 3. Ce qui a été corrigé pour la publication

| Élément | Avant | Après |
|---|---|---|
| `config/qr.json` | `http://100.88.94.51:5181/` (adresse d'atelier) | `https://ashmotif200.github.io/sugar-orchestra/` |
| `docs/qr/*` (8 QR, planche, CSV) | encodaient l'adresse d'atelier | régénérés pour l'adresse publique, 8/8 revérifiés |
| `vite.config.ts` | nom d'hôte du tunnel écrit en dur | lu dans `SO_ALLOWED_HOSTS`, vide par défaut |
| `server/api.mjs` | chemin absolu `/opt/data/tools/sugar-audio` | lu dans `SO_ANALYSIS_HOME`, absent par défaut |
| `DEMO.md`, README | adresses IP et ports d'atelier | réécrits |
| `tsconfig.tsbuildinfo` | versionné (artefact de build) | retiré du suivi et ignoré |

Ces adresses n'étaient pas des secrets — les garder aurait seulement rendu le dépôt
incompréhensible pour un tiers et divulgué la topologie d'un poste de travail.

## 4. Modèle de sécurité du serveur d'administration

### 4.1 Authentification

- Mot de passe haché en **scrypt**, jamais stocké ni journalisé en clair.
- Session par cookie `so_admin` : `HttpOnly`, `SameSite=Strict`, `Secure` si
  `SO_HTTPS=1`, expiration côté serveur.
- Politique de mot de passe : **8 caractères minimum**, appliquée dans l'API **et**
  dans l'interface. Les deux ont déjà divergé (12 contre 16) et un mot de passe
  conforme était refusé par un bouton désactivé : toute modification doit toucher
  `server/auth.mjs` **et** `src/admin/panels2.tsx` ensemble.

### 4.2 Autorisation

Matrice de permissions explicite, vérifiée **côté serveur** à chaque route mutante
(`PERMISSIONS` dans `server/auth.mjs`). L'interface ne fait que la refléter : masquer
un bouton n'est pas une protection.

### 4.3 Anti-CSRF

Toute requête mutante exige l'en-tête `x-so-admin: 1`. Un formulaire HTML ne peut pas
le poser sans script, ce qui suffit contre le CSRF classique — d'autant que
`SameSite=Strict` bloque déjà l'envoi du cookie depuis un autre site.

### 4.4 Téléversement de fichiers

- type MIME **et** octets d'en-tête vérifiés (RIFF/WAVE, MP3, M4A, FLAC) ;
- taille limitée à 25 Mo ;
- SHA-256 calculé, fichier déjà présent refusé ;
- nouveau fichier versionné `data/admin/files/<son>/v<N>-<sha8>.<ext>` : **rien n'est
  écrasé**, et restaurer crée une nouvelle version.

### 4.5 Rendu audio

- le client envoie un **plan**, jamais un chemin de fichier ;
- le serveur valide le schéma et les limites (notes, mesures, modèle temporel) ;
- il résout lui-même les identifiants `NN_NN` en fichiers du catalogue ;
- limitation à 10 rendus par minute et par IP.

### 4.6 En-têtes

`Content-Security-Policy` et `X-Frame-Options` sont posés sur les réponses du serveur
d'administration — vérifiés par un contrôle automatisé. Le site statique, lui, ne peut
pas poser d'en-tête : GitHub Pages ne les permet pas. Sans conséquence ici, puisqu'il
ne sert que des fichiers.

## 5. Risques résiduels

| Risque | Gravité | État |
|---|---|---|
| Le serveur d'administration est exposé au réseau | **élevée** | évité par défaut (`127.0.0.1`) ; dépend de l'exploitant |
| `getUserMedia` sur une origine non sûre | faible | contrainte navigateur documentée ; la démonstration est en HTTPS |
| Contenu de `public/demo/` et `public/audio/demo/` réutilisable par un tiers | moyenne | les licences sont documentées ; le morceau de Martin est protégé par le droit d'auteur, pas par une mesure technique |
| `localStorage` non signé (session visiteur) | faible | aucune donnée sensible ; le pire cas est un carnet fantaisiste |
| Pas de CSP sur le site statique | faible | aucun contenu tiers, aucune injection de HTML utilisateur |
| Compte unique sans rotation planifiée | moyenne | pas de changement de mot de passe en libre-service ; à faire si le projet reprend |
| Dépendances non auditées | faible | 3 dépendances de production ; `npm audit` non exécuté lors de l'archivage |

## 6. Ce qu'un repreneur doit faire en premier

1. **Ne pas exposer** `npm run admin:serve` sur `0.0.0.0` sans reverse proxy
   authentifié.
2. **Créer un compte à soi**, puis supprimer `data/admin/first-admin.txt`.
3. **Sauvegarder** `data/admin/` avant toute manipulation (`npm run admin:backup`).
4. **Lire** `docs/ASSET-LICENSES.md` avant de publier un nouveau fichier audio.
5. **Ne pas ajouter** d'endpoint capable de lever une restriction éditoriale : ce
   serait ouvrir une porte que le projet a choisi de ne pas avoir.

## 7. Signaler un problème

Ce dépôt est un projet archivé, sans programme de sécurité. Si vous trouvez une
vulnérabilité, ouvrez une *issue* sur le dépôt GitHub plutôt que de publier les
détails.
