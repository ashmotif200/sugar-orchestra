# V2.1 — Pattern Composition & Hybrid Bass Synthesis

## Modules (séparation A/B/C)

| Module | Fichier | Rôle |
|---|---|---|
| A | `src/engine-v2/capabilities.ts` | capacités, rôles (inchangé) |
| B | `src/engine-v2/v21/patterns.ts` | motifs, variations, roulement continu |
| B | `src/engine-v2/v21/harmony.ts` | harmonie + politiques de basse |
| B | `src/engine-v2/v21/plan.ts` | arrangement, durée, plan V2.1 |
| C | `server/v2-render.mjs` | mélange + **synthèse de basse** + vérification |

## Modes
`museum_only` (aucune basse synthétique) · `museum_derived` (pas d'oscillateur
indépendant) · `hybrid_synth` (samples + basse).

## Politique de motifs
`confirmed` (≥ 3 occurrences) fonde une cellule ; `observed` sert de variante ;
densité ≥ 0,85 = **texture continue** (Tififi), jamais une cellule discrète. Les
motifs écartés sont listés dans `limits` avec leur raison.

## Durée
`bars = round(cible / barSeconds)`. Cible 36 s (40 s Dansant). Les 114 s de V2.0
venaient d'un nombre de mesures fixe : corrigé.

## Basse
1+2+3 harmoniques, ADSR, passe-bas, saturation. `sub` / `warm` / `percussive`.
Décidée par B, rendue par C. Aucune hauteur ambiguë de référence utilisée.

## Limites connues
- Pas de mastering LUFS : normalisation au plafond (−1 dBTP).
- Écart avec/sans basse (Détendu −9,8 vs −15,3 LUFS) : basse en avant.
- Aucune validation perceptive humaine.
- **Laboratoire V2.1 (mode/timbre dans le Super Admin) non implémenté.**
