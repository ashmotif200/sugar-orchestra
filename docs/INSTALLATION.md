# Installation

Deux installations différentes, à ne pas confondre :

- **A. Faire tourner la démonstration** : build statique, aucune dépendance de
  service, 2 minutes.
- **B. Reprendre le développement** : application + serveur d'administration, et
  éventuellement les outils d'analyse.

La version validée lors de l'archivage : **Node 22.22.3**, npm 10.9.8, Linux x86-64.

---

## A. Démonstration statique

Prérequis : Node.js ≥ 22.5 et npm.

```bash
git clone https://github.com/ashmotif200/sugar-orchestra.git
cd sugar-orchestra
npm ci
npm run build:pages
```

Le site complet est dans `dist/`. Pour le voir :

```bash
npx vite preview --port 5181     # http://127.0.0.1:5181
```

ou, plus fidèle à GitHub Pages (aucun serveur à nous, aucun proxy `/api`) :

```bash
python3 -m http.server 5199 --directory dist
```

Le second est le vrai test : `vite preview` proxifie `/api` vers le serveur
d'administration, ce qui masque un éventuel appel réseau résiduel. Avec
`http.server`, tout appel `/api` échouerait visiblement.

**Ce qui doit fonctionner** : accueil, choix de Martin, parcours en 7 étapes, huit
postes (`#/poste/1` … `#/poste/8`), carnet, écoute des samples, résultat avec le
morceau final, « Nouvelle visite ».

## B. Développement

### B.1 Dépendances

```bash
npm ci
```

`npm ci` et non `npm install` : le `package-lock.json` est la référence.

### B.2 Lancement

```bash
npm run dev          # frontend seul, http://127.0.0.1:5180
```

L'administration demande deux processus (le serveur sert `dist/`, il doit donc
exister) :

```bash
npm run build        # une fois, puis après chaque modification du frontend
npm run admin:serve  # http://127.0.0.1:5182/#/admin
```

En développement, `npm run dev` proxifie `/api` vers `127.0.0.1:5182`, ce qui garde
le navigateur sur une seule origine et le cookie de session en `SameSite=Strict`.

### B.3 Premier compte administrateur

Aucun compte n'est créé automatiquement :

```bash
npm run admin:provision -- --email vous@exemple.org --name "Votre nom"
```

Le mot de passe est écrit **une seule fois** dans `data/admin/first-admin.txt`
(droits 600) — il n'est jamais affiché sur la sortie standard. Déplacez-le ou
supprimez-le après la première connexion.

### B.4 Variables d'environnement

Aucune n'est obligatoire. Voir `.env.example` et le tableau du
[README](../README.md#14-configuration).

### B.5 Vérifier l'installation

```bash
npm run typecheck
npm run admin:test
npm run v2:test
node tests/v2/v21.test.mjs
```

Résultats obtenus le 16 novembre 2026 sur une copie propre :

| Commande | Résultat |
|---|---|
| `npm run typecheck` | OK |
| `npm run admin:test` | **55/56** — un contrôle échoue, voir `docs/DEVELOPMENT.md` § 5 |
| `npm run v2:test` | **18/18** |
| `node tests/v2/v21.test.mjs` | **22/22** |

Le contrôle en échec est **antérieur à l'archivage** et sans effet sur le site : il
constate un état de données, pas une régression.

---

## C. Outils d'analyse musicale (facultatif)

Nécessaires seulement pour rejouer les analyses qui ont fondé les choix musicaux.
Rien dans l'application ne les appelle, sauf la route d'analyse du serveur
d'administration, qui répond honnêtement quand ils sont absents.

### C.1 Python

```bash
uv venv /chemin/renv/analysis --python 3.13
uv pip install --python /chemin/renv/analysis/bin/python \
    numpy scipy librosa soundfile
```

Versions utilisées lors des analyses : numpy 2.5.4, scipy 1.18.1, librosa 1.0.1,
soundfile 0.14.0.

### C.2 Déclarer le toolchain au serveur

```bash
export SO_ANALYSIS_HOME=/chemin/vers/sugar-audio
```

Le répertoire doit contenir `bin/so` et `renv/analysis/bin/python`. Sans cette
variable, la route d'analyse répond « toolchain d'analyse non configuré » : elle
n'invente jamais de mesures.

### C.3 ffmpeg

Requis par la mesure de niveau des rendus V2 (LUFS, true peak) :

```bash
ffmpeg -version      # version utilisée : 7.1.5
```

Sans ffmpeg, `npm run v2:test` échoue sur la mesure de crête — pas silencieusement :
le test compare le résultat de la mesure, il ne la suppose pas.

### C.4 Données d'entrée des analyses

Les analyses ont besoin de fichiers qui **ne sont pas** dans le dépôt :
`assets/originals/` (40 masters), `assets/references/` (3 mix + stems), et pour
certains harnais les archives ZIP d'origine. Ils sont dans la sauvegarde
indépendante du projet. Sans eux, les harnais `scripts/phase-a/verify*.py` s'arrêtent
en indiquant le fichier manquant.

---

## D. Dépannage

| Symptôme | Cause | Correctif |
|---|---|---|
| `EADDRINUSE` sur 5182 | un ancien serveur d'administration tourne encore | identifier le PID de `node server/admin-server.mjs` et l'arrêter ; ne pas tuer le shell qui l'a lancé |
| le port change tout seul | `strictPort` désactivé | il est activé ; si le port est pris, Vite échoue au lieu de glisser sur un autre |
| `node:sqlite` introuvable | Node < 22.5 | mettre Node à jour |
| `EACCES … unlink dist/assets/…` | `dist/` appartient à un autre utilisateur | renommer le dossier (`mv dist dist-old`) puis reconstruire ; ne rien supprimer |
| la page se recharge toute seule sur téléphone | serveur de développement (HMR) | utiliser `npm run build` + serveur statique |
| le morceau final ne joue pas sur iPhone | WAV 24 bits | le lecteur utilise déjà la version AAC ; vérifier que `public/demo/energetique-v1.m4a` a bien été déployé |
| `npm run admin:serve` sert une ancienne version | `dist/` pas reconstruit | `npm run build` avant de relancer |
