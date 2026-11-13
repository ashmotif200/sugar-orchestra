# Changement de politique musicale — 13 novembre 2026

**Décision du propriétaire du projet.** Ce document enregistre ce qui a changé, ce qui
a été préservé, et ce qui reste un contrôle actif.

## Ce qui change

L'ancienne politique excluait de la composition les enregistrements jugés
historiquement sensibles (`sensitive`) ou sans matériau musical exploitable
(`availability: not_musical`). Cette exclusion est supprimée : ces sons peuvent
désormais être sélectionnés par le visiteur et utilisés dans une composition.

## Où le changement est appliqué

| Endroit | Avant | Après |
|---|---|---|
| `src/engine/policy.ts` (nouveau) | — | `isMusicallyUsable()` : seule l'absence de fichier audio bloque |
| `src/engine/plan.ts` (V1) | filtrait `sensitive` / `not_musical` | appelle la politique ; **une seule ligne changée**, algorithme intact |
| `src/App.tsx` | refusait la sélection | appelle la politique |
| `src/ui/screens/Step.tsx` | cadenas + « histoire seulement » | sélection possible, note informative affichée |
| `src/ui/screens/Carnet.tsx`, `SelfTest.tsx` | filtre | politique |
| `server/api.mjs` (`/api/dev/selection`) | rejetait `sensitive` | n'accepte que les sons avec fichier |
| `src/i18n/*` | « histoire seulement — non utilisé en musique » | « fichier audio indisponible » |

## Ce qui est préservé

- `sensitive: true` reste dans le catalogue, dans la base (`restrictions`) et dans
  l'interface, avec sa provenance (« catalogue.json — import Inventaire »).
- Les crédits, licences, natures et liens Freesound sont inchangés.
- L'historique éditorial n'est pas réécrit : `validation_status` conserve la trace de
  la restriction d'origine.
- Les compositions passées ne sont pas modifiées.

## Ce qui reste un contrôle actif

- **Fichier manquant ou illisible** : refusé (contrôle technique).
- **Licences incertaines** : toujours signalées « Licence à confirmer » ; la levée de
  l'exclusion musicale **ne vaut pas autorisation de publication**. La publication
  reste une opération explicite et manuelle (`admin:apply --yes`), et aucun bundle
  public n'a été modifié par ce changement.
- **Droits d'utilisation** : non traités par cette décision. Si un enregistrement
  pose une question de droits, elle doit être tranchée séparément — je ne la présume
  pas acquise.

## Ce qu'il faut savoir en lisant une composition

Un son peut être à la fois **historiquement sensible** et **musicalement utilisé**.
Les plans V2 enregistrent cette information dans `adaptations`
(« sons historiquement sensibles utilisés musicalement (politique v2…) »), pour que
la décision reste visible dans chaque résultat produit.
