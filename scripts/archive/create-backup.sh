#!/usr/bin/env bash
# =============================================================================
# Sugar Orchestra — sauvegarde indépendante du projet (avant toute modification)
#
# Crée, hors du dépôt :
#   <dest>/<stamp>/tree/        copie complète restaurable (hors node_modules/dist)
#   <dest>/<stamp>/archive.tar.gz
#   <dest>/<stamp>/manifest.json / manifest.sha256
#   <dest>/<stamp>/private/     matériel d'identification et données privées
#   <dest>/<stamp>/private/git-all.bundle   historique Git complet
#
# Le dossier de sauvegarde est INTERNE : il contient la base d'administration
# (empreintes de mots de passe) et ne doit jamais être publié.
#
# Usage :
#   bash scripts/archive/create-backup.sh [destination] [--skip-archive]
#
# Variables :
#   SRC   racine du projet (défaut : racine du dépôt)
# =============================================================================
set -euo pipefail

SRC="${SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
STAMP="${STAMP:-$(date -u +%Y-%m-%dT%H%M%SZ)}"
DEST="${1:-/workspace/download/sugar-orchestra-archive}"
SKIP_ARCHIVE=0
for a in "$@"; do [ "$a" = "--skip-archive" ] && SKIP_ARCHIVE=1; done
[ "$DEST" = "--skip-archive" ] && DEST=/workspace/download/sugar-orchestra-archive

OUT="$DEST/$STAMP"
TREE="$OUT/tree"

echo "[backup] source      : $SRC"
echo "[backup] destination : $OUT"

mkdir -p "$TREE" "$OUT/private"

# --- 1. Copie de l'arbre de travail -----------------------------------------
# node_modules et dist sont des artefacts reconstructibles : exclus.
# Les dossiers dist-root-owned-* sont des restes d'incidents de build : exclus.
# (rsync n'est pas garanti présent sur l'hôte : on copie via tar.)
tar -cf - \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./dist-root-owned-*' \
  -C "$SRC" . | tar -xf - -C "$TREE"

# --- 2. Historique Git complet (compact, indépendant du dossier .git) -------
if [ -d "$SRC/.git" ]; then
  git -C "$SRC" bundle create "$OUT/private/git-all.bundle" --all 2>/dev/null \
    && echo "[backup] bundle git  : OK" \
    || echo "[backup] bundle git  : ÉCHEC (arbre copié quand même)"
fi

# --- 3. Matériel privé, isolé du reste --------------------------------------
PRIV="$OUT/private"
if [ -f "$SRC/data/admin/first-admin.txt" ]; then
  cp -p "$SRC/data/admin/first-admin.txt" "$PRIV/first-admin.txt"
  chmod 600 "$PRIV/first-admin.txt"
fi
if [ -f "$SRC/data/admin/sugar.db" ]; then
  mkdir -p "$PRIV/data-admin"
  cp -p "$SRC/data/admin/sugar.db" "$PRIV/data-admin/sugar.db"
  chmod 600 "$PRIV/data-admin/sugar.db"
fi
for d in publications files backups; do
  if [ -d "$SRC/data/admin/$d" ]; then cp -a "$SRC/data/admin/$d" "$PRIV/data-admin/$d"; fi
done

# --- 4. Manifeste (chemin, taille, sha256) ----------------------------------
PY="${PY:-}"
if [ -z "$PY" ]; then
  if command -v python3 >/dev/null 2>&1; then PY=python3; fi
fi
"$PY" - "$TREE" "$OUT" "$STAMP" <<'PYEOF'
import hashlib, json, os, sys

tree, out, stamp = sys.argv[1], sys.argv[2], sys.argv[3]

# Catégories éditoriales / juridiques : ce qui peut être publié ou non.
def classify(rel):
    p = rel.replace(os.sep, '/')
    if p.startswith('data/admin') or p.startswith('data/archive'):
        return 'prive', 'interne'
    if p.startswith('assets/references'):
        return 'reference-fournie', 'interne'
    if p.startswith('assets/originals'):
        return 'master-audio', 'interne'
    if p.startswith('assets/demo-sources') or p.startswith('public/audio') or p.startswith('public/demo'):
        return 'audio-demonstration', 'a-verifier-droits'
    if p.startswith('assets/backup'):
        return 'sauvegarde-interne', 'interne'
    if p.startswith('.git'):
        return 'historique-git', 'interne'
    return 'code-documentation', 'publicable'

entries, total = [], 0
for root, dirs, files in os.walk(tree):
    dirs.sort()
    for name in sorted(files):
        full = os.path.join(root, name)
        rel = os.path.relpath(full, tree)
        if os.path.islink(full):
            entries.append({'path': rel, 'size': None, 'sha256': None,
                            'kind': 'symlink', 'target': os.readlink(full)})
            continue
        h = hashlib.sha256()
        size = 0
        with open(full, 'rb') as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b''):
                h.update(chunk)
                size += len(chunk)
        total += size
        cat, pub = classify(rel)
        entries.append({'path': rel, 'size': size, 'sha256': h.hexdigest(),
                        'category': cat, 'publication': pub})

manifest = {
    'project': 'sugar-orchestra',
    'kind': 'sauvegarde-independante',
    'stamp': stamp,
    'fileCount': len(entries),
    'totalBytes': total,
    'note': "Sauvegarde INTERNE. Contient data/admin (empreintes de mots de passe) "
            "et des masters audio non publiés : ne pas publier ce dossier.",
    'files': entries,
}
with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=1)
with open(os.path.join(out, 'manifest.sha256'), 'w', encoding='utf-8') as fh:
    for e in entries:
        if e['sha256']:
            fh.write(f"{e['sha256']}  {e['path']}\n")
print(f"[backup] {len(entries)} fichiers, {total/1e6:.1f} Mo, manifeste écrit")
PYEOF

# --- 5. Archive tar.gz ------------------------------------------------------
if [ "$SKIP_ARCHIVE" = "0" ]; then
  tar -czf "$OUT/archive.tar.gz" -C "$TREE" . 
  ls -lh "$OUT/archive.tar.gz"
fi

echo "[backup] terminé : $OUT"
