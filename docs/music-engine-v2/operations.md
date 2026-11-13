# Moteur V2 — exploitation

## Démarrage

```bash
npm run admin:serve     # API + rendu audio V2 sur http://127.0.0.1:5182
npm run v2:demo         # 4 WAV de démonstration -> /workspace/download/sugar-audio/v2-demos/
npm run v2:test         # 18 contrôles : déterminisme, hauteur, couverture, validation, rendu
```

Le laboratoire V1/V2 est dans le Super Admin : **#/admin/lab** (permission `dev.use`).
Il faut être connecté ; le serveur audio doit tourner pour V2, V1 fonctionne sans lui.

## Où sont les choses

| Élément | Chemin |
|---|---|
| Contrats et modules A/B | `src/engine-v2/` (`types`, `capabilities`, `profiles`, `plan`, `browser`) |
| Rendu serveur (module C) | `server/v2-render.mjs` |
| Profils versionnés | `src/engine-v2/profiles.ts` (4 profils, `version` incrémentale) |
| Capacités mesurées | `src/data/capability-matrix.json` (copie de `docs/phase-a/data/`) |
| Rendu WAV produits | `data/admin/renders/` (24 derniers conservés) |
| Démonstrations | `/workspace/download/sugar-audio/v2-demos/` |

## Contrat navigateur → serveur

`POST /api/v2/render` avec `{ plan }`. Le plan est **entièrement spécifié** : le
serveur ne décide de rien, il valide, résout les identifiants de sons en fichiers
(côté serveur, jamais un chemin fourni par le client), mélange et vérifie.

Refus explicites : `schema ≠ 2`, `beatsPerBar ∉ {3,4,6}`, `subdivision ∉ {2,3}`,
`bars > 512`, `notes > 20000`, `playbackRate ∉ [0.25,4]`, `gainDb ∉ [-60,6]`,
`sourceId` qui n'est pas au format `NN_NN`, durée > 300 s.
En-tête `x-so-admin: 1` obligatoire (anti-CSRF), 10 rendus/minute par IP.

`GET /api/v2/render/:id` renvoie le WAV, `GET /api/v2/render/:id/meta` les mesures.

## Ce que le serveur mesure réellement

Chaque rendu est vérifié par ffmpeg sur le fichier produit : durée, fréquence,
canaux, LUFS intégrés, true peak. Le true peak est corrigé sur la **mesure** (pas sur
l'estimation locale), avec au plus deux passes correctives. Un rendu qui dépasse
−1,0 dBTP après correction est marqué `ok: false` et signalé.

## Limites connues (V2.0)

- **Pas de mastering** : normalisation au plafond de crête, pas de cible LUFS. Un
  morceau percussif creux sort autour de −21 LUFS, un morceau dense autour de −14.
  La chaîne de mastering est prévue en V2.3.
- **Pas de resynthèse** : seulement découpe, gain, panoramique, enveloppes, taux de
  lecture et filtre une pente. Pas de vocodeur de phase ni de granulation serveur.
- **Une seule file de rendu** (2 jobs simultanés max). Pas de file distribuée.
- **V1 n'expose pas de seed comparable** : la comparaison A/B porte sur l'écoute,
  pas sur une équivalence d'arrangement.

## Politique musicale v2

Les restrictions musicales liées à la sensibilité historique sont levées (décision du
propriétaire). `sensitive` reste une métadonnée affichée ; `availability:
not_musical` n'exclut plus, elle oriente vers la texture. Seule l'absence de fichier
audio bloque encore. Détail : `src/engine/policy.ts` et `docs/music-engine-v2/policy-change.md`.
