# Démo Muséomix v0.1 — un seul téléphone

## Lancer

```bash
cd /workspace/sugar-orchestra
npm run demo      # build + serveur statique sur http://0.0.0.0:5181
```

Sur le téléphone, ouvrir `http://192.168.100.140:5181` (même Wi-Fi que la machine).

**Ne pas utiliser `npm run dev` pour la démo.** Le serveur de développement envoie des
rechargements de page à chaque modification de fichier (HMR) : c'est la cause du
« rechargement intempestif ». `npm run demo` sert le build statique, qui n'embarque
aucun client HMR — il ne peut pas recharger tout seul.

## Parcours

1. Accueil : Martin est le seul univers disponible (les trois autres sont « Bientôt »).
2. « Commencer avec Martin » → parcours en 7 étapes.
3. 8 sons sont écoutables et collectables : `01_02`, `01_05`, `02_01`, `02_04`,
   `04_07`, `04_09`, `04_10`, `06_04`. Tous les autres restent visibles, verrouillés
   « Bientôt », non écoutables et non collectables.
4. Carnet → « Découvrir le résultat » → écran de résultat.
5. « Nouvelle visite » remet tout à zéro pour le visiteur suivant.

## Mode démonstration

`src/data/demo.ts` → `demoMode.enabled = true`. Aucune génération musicale n'est
lancée : l'écran de résultat joue le morceau précomposé `public/demo/energetique v1.wav`.
Passer `enabled` à `false` réactive le parcours de génération réel, intact.

**Fichier attendu :** `public/demo/energetique v1.wav` (nom exact). Tant qu'il est
absent, l'écran l'indique explicitement — aucun substitut n'est utilisé.

## Publication (source unique)

La disponibilité des univers et des sons vient de `data/admin/sugar.db` :

- univers disponible = `status = 'published'` **et** `engine_implemented = 1` ;
- son disponible = `status = 'published'`.

Après un changement dans l'administration :

```bash
node scripts/admin/export-publication.mjs   # met à jour l'instantané hors ligne
```

L'application interroge d'abord l'API (`/api/v2/public/catalog-state`), puis retombe
sur `src/data/publication.json`.

## Activer / désactiver les huit samples

```bash
node scripts/admin/demo-samples.mjs --dry-run   # aperçu
node scripts/admin/demo-samples.mjs             # 8 publiés, les autres verrouillés
node scripts/admin/demo-samples.mjs --restore   # tout remettre en 'active'
```

## Réinitialiser pour le visiteur suivant

- Bouton **Nouvelle visite** sur l'écran de résultat (sans confirmation) ;
- ou l'icône ↺ de la barre du haut (avec confirmation).
