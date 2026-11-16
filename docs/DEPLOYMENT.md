# Déploiement

Trois cibles, très différentes.

| Cible | Ce que c'est | Serveur nécessaire |
|---|---|---|
| **GitHub Pages** | la démonstration publique, statique | aucun |
| **Poste local** | présentation sur un téléphone du même réseau | un serveur de fichiers statique |
| **Serveur complet** | site + administration | Node ≥ 22.5 |

---

## 1. GitHub Pages — la démonstration publique

### 1.1 Adresse

<https://ashmotif200.github.io/sugar-orchestra/>

Le dépôt est `ashmotif200/sugar-orchestra`. Le chemin du site est le nom du dépôt :
c'est pourquoi le build utilise `base: './'` (voir § 1.5).

### 1.2 Prérequis côté GitHub

- Pages doit être activé sur le dépôt, source **« Deploy from a branch »**, branche
  `gh-pages`, dossier `/ (root)`.
- Sur un compte gratuit, GitHub Pages n'est disponible que pour un dépôt **public**.
  Le dépôt a donc été basculé en public au moment de la publication de la
  démonstration.

### 1.3 Publier

```bash
export GITHUB_TOKEN=$(sed -n 's/.*oauth_token: *//p' ~/.config/gh/hosts.yml | head -1)
bash scripts/deploy/publish-pages.sh
```

Le script :

1. clone le dépôt dans `/tmp/sugar-pages` (état poussé, pas l'atelier) ;
2. `npm ci` puis `npm run build:pages` ;
3. vérifie le bundle : `index.html`, le morceau final, exactement 8 samples, et
   **aucun** `dist/audio/*.m4a` ;
4. ajoute `.nojekyll` ;
5. pousse `dist/` en force sur la branche `gh-pages`.

**Pourquoi un clone propre** : le build publié ne peut pas dépendre d'un fichier
présent seulement dans l'atelier. Si le clone ne construit pas, le site ne doit pas
être publié — c'est exactement ce que fait le script.

### 1.4 Vérifier après publication

```bash
curl -sI https://ashmotif200.github.io/sugar-orchestra/ | head -3
curl -s  https://ashmotif200.github.io/sugar-orchestra/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
```

Le second doit renvoyer le même nom de fichier que le `dist/assets/index-*.js` local.
Un `200` ne prouve rien : une page d'erreur GitHub renvoie aussi `200` dans certains
cas. **Comparer l'empreinte du bundle est la preuve.**

Vérifier aussi que l'audio est bien servi avec un type correct :

```bash
curl -sI https://ashmotif200.github.io/sugar-orchestra/demo/energetique-v1.m4a | grep -i 'content-type\|content-length'
```

Attendu : `audio/mp4`, 1 175 743 octets. Si le type revient en
`application/octet-stream`, Safari peut refuser la lecture : c'est le premier point à
contrôler si le morceau ne démarre pas sur iPhone.

### 1.5 Pourquoi le même bundle marche à la racine et en sous-chemin

`vite.config.ts` fixe `base: './'`. Toutes les URL de ressources sont donc relatives
au document, et le routeur travaille par **fragment** (`#/poste/3`), que le serveur ne
voit jamais. Conséquence : aucune règle de réécriture n'est nécessaire, ni sur GitHub
Pages, ni ailleurs.

Le corollaire : ne jamais remplacer un chemin relatif par un chemin absolu dans le
code du visiteur (par exemple `fetch('/demo/...')` au lieu de
`fetch(import.meta.env.BASE_URL + 'demo/...')`). Sous `/sugar-orchestra/`, un chemin
absolu pointe à la racine du domaine et renvoie 404.

### 1.6 Ce que la démonstration ne fait pas

- Pas d'administration : le bundle d'administration existe mais `#/admin` renvoie à
  l'accueil, et le serveur n'existe pas.
- Pas de contenu éditorial : les titres et crédits viennent du catalogue.
- Pas d'appels `/api` : le drapeau `VITE_STATIC_HOSTING=1` les supprime.

---

## 2. Présentation sur un poste local

Pour présenter sans réseau, ou tester une version de travail :

```bash
npm run build
python3 -m http.server 5199 --directory dist
```

Puis, depuis un téléphone du même réseau, ouvrir `http://<ip-du-poste>:5199/`.

**Ne pas utiliser `npm run dev` pour une présentation.** Le serveur de développement
renvoie des rechargements de page à chaque modification de fichier : c'est la cause
du « rechargement intempestif » constaté sur téléphone. Le build statique n'embarque
aucun client HMR, il ne peut pas recharger tout seul.

Attention : `http.server` sert en clair. La caméra du navigateur (`getUserMedia`) est
réservée aux origines **sûres** (`https://` ou `http://localhost`) sur Safari iOS :
le scan par caméra ne fonctionnera **pas** depuis `http://192.168.x.x`. C'est
précisément la raison d'être de la démonstration GitHub Pages, qui est en HTTPS.

---

## 3. Serveur complet (site + administration)

```bash
npm ci
npm run build
npm run admin:serve          # 127.0.0.1:5182 par défaut
```

Ce serveur sert à la fois l'API et `dist/`. Il écoute sur la boucle locale : pour y
accéder depuis une autre machine, passez par un tunnel ou un reverse proxy
authentifié, jamais par une exposition directe (voir `docs/SECURITY.md`).

Variables utiles :

```bash
SO_HOST=127.0.0.1 SO_PORT=5182 SO_DATA_DIR=/var/lib/sugar-orchestra npm run admin:serve
```

Derrière HTTPS, ajouter `SO_HTTPS=1` pour que le cookie de session porte `Secure`.

### 3.1 Mise à jour du site

`npm run build` puis redémarrer le serveur (il lit `dist/` à chaque requête, mais un
redémarrage garantit qu'aucun ancien processus ne répond — voir
`docs/DEVELOPMENT.md` § 6).

### 3.2 Sauvegarde

```bash
npm run admin:backup          # VACUUM INTO + fichiers audio versionnés + publications
```

`data/admin/` n'est pas versionné : c'est la seule copie de la base, des comptes et
de l'historique éditorial.

---

## 4. Régénérer les QR après un changement d'adresse

Les QR encodent l'adresse de la démonstration. Changer d'hébergement impose de les
régénérer — aucun code source n'encode d'adresse, tout part de `config/qr.json`.

```bash
# 1. mettre à jour la base d'URL
#    config/qr.json → "baseUrl": "https://ashmotif200.github.io/sugar-orchestra/"

# 2. régénérer et vérifier (le script relit chaque PNG produit)
node scripts/qr/make-posters.mjs
```

Voir `docs/QR-CODES.md`.

---

## 5. Ce qui n'est pas automatisé

- Pas d'intégration continue : les tests se lancent à la main. Le projet est un
  prototype archivé, une CI ajouterait une dépendance de service.
- Pas de versionnement sémantique des publications : la branche `gh-pages` est
  réécrite à chaque déploiement (force). L'historique des versions publiées n'est pas
  conservé ; il faudrait pousser sur une branche par version si le besoin apparaît.
- Pas de rollback automatisé : revenir à une version antérieure = reconstruire depuis
  une étiquette (`git checkout museomix-2026 && bash scripts/deploy/publish-pages.sh`).
