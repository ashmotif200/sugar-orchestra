#!/usr/bin/env bash
# =============================================================================
# Publie la démonstration statique sur GitHub Pages.
#
# Le build n'est PAS fait dans l'atelier : on clone le dépôt dans un répertoire
# temporaire, on y installe les dépendances et on y construit. La démonstration
# publiée est donc, par construction, reproductible depuis le dépôt seul — c'est
# aussi le test de restauration.
#
# Usage :
#   GITHUB_TOKEN=… bash scripts/deploy/publish-pages.sh [--keep]
#
# Variables :
#   REPO    dépôt cible   (défaut : https://github.com/ashmotif200/sugar-orchestra.git)
#   BRANCH  branche Pages (défaut : gh-pages)
#   WORK    répertoire de travail temporaire (défaut : /tmp/sugar-pages)
# =============================================================================
set -euo pipefail

REPO="${REPO:-https://github.com/ashmotif200/sugar-orchestra.git}"
BRANCH="${BRANCH:-gh-pages}"
WORK="${WORK:-/tmp/sugar-pages}"
KEEP=0
for a in "$@"; do [ "$a" = "--keep" ] && KEEP=1; done

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN absent : la publication demande un jeton (scope repo)." >&2
  echo "Sur cette machine :  export GITHUB_TOKEN=\$(sed -n 's/.*oauth_token: *//p' ~/.config/gh/hosts.yml | head -1)" >&2
  exit 1
fi

AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/ashmotif200/sugar-orchestra.git"

echo "[pages] 1/5 clone propre dans $WORK"
rm -rf "$WORK"
git clone --quiet "$AUTH_URL" "$WORK"
cd "$WORK"
echo "[pages]    commit : $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

echo "[pages] 2/5 dépendances (npm ci)"
npm ci --silent

echo "[pages] 3/5 build statique (VITE_STATIC_HOSTING=1)"
npm run build:pages

echo "[pages] 4/5 contrôles de sûreté du bundle"
[ -f dist/index.html ] || { echo "dist/index.html manquant" >&2; exit 1; }
[ -f dist/demo/energetique-v1.m4a ] || { echo "morceau final absent du bundle" >&2; exit 1; }
[ "$(ls dist/audio/demo/*.wav | wc -l)" -eq 8 ] || { echo "les 8 samples ne sont pas dans le bundle" >&2; exit 1; }
if ls dist/audio/*.m4a >/dev/null 2>&1; then
  echo "des fichiers audio non publiés sont dans le bundle — arrêt" >&2; exit 1
fi
# Un appel /api résiduel en mode statique signalerait une régression du drapeau.
if grep -rql "api/v2/public/catalog-state" dist/assets/*.js 2>/dev/null; then
  echo "ATTENTION : la route /api est encore référencée dans le bundle." >&2
fi
touch dist/.nojekyll
# GitHub Pages sert les .m4a en application/octet-stream sur certains chemins ;
# on ne peut pas changer les types MIME, mais on documente le risque (docs/DEPLOYMENT.md).
echo "[pages]    bundle : $(du -sh dist | cut -f1)"

echo "[pages] 5/5 publication sur la branche $BRANCH"
cd dist
git init --quiet -b "$BRANCH"
git config user.name "ashmotif200"
git config user.email "65541608+ashmotif200@users.noreply.github.com"
git add -A
git commit --quiet -m "Démonstration statique — build depuis $(cd .. && git rev-parse --short HEAD)"
git push --quiet --force "$AUTH_URL" "$BRANCH"
echo "[pages] publié : https://ashmotif200.github.io/sugar-orchestra/"

cd /
if [ "$KEEP" = "0" ]; then rm -rf "$WORK"; else echo "[pages] arbre conservé : $WORK"; fi
