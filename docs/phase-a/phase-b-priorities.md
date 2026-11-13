# Phase B — priorités de développement

Document d'exécution : ce qu'il faut faire, dans quel ordre, avec quoi comme
preuve d'acceptation. **Rien n'a été implémenté.** Le moteur actuel est intact.

État de départ vérifié le 13/11 : `npm run typecheck` 0 erreur, `npm run build`
OK (49 modules, `dist/` 11 Mo), auto-test invariants **8/8**, déterminisme
4,17 × 10⁻⁷, 40 masters intacts.

---

## 1. Défauts techniques constatés (mesurés, pas supposés)

Ce sont des bugs, pas des choix artistiques. Ils se corrigent indépendamment de
toute décision musicale.

| # | Défaut | Preuve | Effet audible |
|---|---|---|---|
| **D1** | `rateFor()` replie la transposition par octaves et **replace la note 2 à 3 octaves plus haut** que la note écrite | cible ré2 73,42 Hz, source `03_02` 844,5 Hz → taux 0,696 → **587,4 Hz joués** (+36 demi-tons). Idem `04_08`, `04_09`, `04_04`. `04_05` et `08_01` (rôle `bass`) sonnent +12 | la « basse » n'est pas dans le grave ; il n'y a pas de vrai ré2 dans la pièce |
| **D2** | Les rôles `bass`/`melody` sont admis sur `analysis.f0Hz !== null`, alors que seule une minorité de sons a une hauteur crédible | 31/40 ont un `f0Hz`, **5/40** ont une hauteur crédible (périodicité ≥ 0,75), **0/40** peut tenir une basse | des métaux et des bruits sont traités comme des notes |
| **D3** | Les adaptations de rôle ne sont pas annoncées | sélection `[01_01, 01_03, 01_04, 02_04]` → **3 adaptations, `limits: []`** | le visiteur ne sait pas pourquoi sa pièce est bizarre |
| **D4** | Les tempos d'univers sont faux par rapport aux références | 112 (electro) vs **135** mesuré ; 126 (sega) vs **150** mesuré ; segazz absent vs **134** | tout sonne plus lent que les références |
| **D5** | L'équilibre de mixage est identique partout, avec la percussion devant | Énergétique : percussion +8 dB sur la basse ✔ ; Détendu : basse **+5,8 dB** sur la percussion ; Dansant : harmonie 16 dB dessous | « Détendu » ne peut pas sonner détendu |
| **D6** | Durée fixe ~36 s | références : 51 s, 205 s, 54 s | pas le temps d'installer une forme |
| **D7** | `segazz` n'a aucun compositeur et est `available: false` | `plan.ts` : 3 compositeurs ; `universes.ts` : `segazz.available = false` | un univers annoncé n'existe pas |

**D1 et D2 sont liés** : corriger D1 sans D2 laisse le moteur transposer des sons
qui n'ont pas de hauteur ; corriger D2 sans D1 laisse des notes fausses sur les
5 sons valides. **Les deux ensemble.**

---

## 2. Backlog ordonné

| Priorité | Tâche | Impact | Complexité | Risque | Dépend de | Preuve d'acceptation |
|---|---|---|---|---|---|---|
| **P1** | Borner la transposition et vérifier la hauteur réalisée (D1) | **élevé** | faible | faible | — | pour chaque événement `bass`/`melody`, `|12·log2(réalisé/cible)| ≤ 0,5 demi-ton` — sinon l'événement n'est pas émis |
| **P2** | Filtrer `bass`/`melody` par périodicité ≥ 0,75 et prevalence ≥ 0,45 (D2) | **élevé** | faible | faible | données `periodicity` dans le catalogue | aucun rôle de hauteur sur un son de périodicité < 0,75 ; un test unitaire par cas |
| **P3** | Annoncer toute adaptation (D3) | moyen-élevé | faible | très faible | — | le cas `[01_01,01_03,01_04,02_04]` produit `limits.length ≥ 1` |
| **P4** | Tempos 135 / 150 / 134 (D4) | **élevé** | faible | faible | — | BPM du score = valeur de l'univers ; test sur les 3 univers |
| **P5** | Basse optionnelle par univers (D5, C2) | **élevé** | moyenne | artistique | P2 | un univers peut déclarer `bass: 'none'` ; la pièce reste valide et le dit |
| **P6** | Hiérarchie de mixage par univers (D5) | **élevé** | moyenne | moyen | P4 | gains de bus conformes au tableau §3 ; LUFS par bus mesurés |
| **P7** | Forme déclarative + durée 50–60 s (D6) | **élevé** | moyenne | moyen | P4 | sections et durées vérifiables dans le score ; écart < 1 s |
| **P8** | Budget de transformation par son | moyen | moyenne | faible | données de forme | zéro violation : pas d'étirement sur `transient net`, pas de filtrage sur `bruit large bande` |
| **P9** | Motifs avec retour (exposition / variation / reprise) | moyen | moyenne | faible | P7 | un même motif apparaît ≥ 2 fois avec variation bornée |
| **P10** | Compositeur Segazz | moyen | élevée | élevé | P5, P4, décision basse | univers `available: true`, 134 BPM binaire, forme avec stop-time |

### Ordre recommandé

**Vague 1 — corrections (½ journée, risque quasi nul)**
P1, P2, P3, P4. Ce sont quatre changements petits et vérifiables qui suppriment
les défauts prouvés. **Ils peuvent être livrés sans aucune décision artistique.**

**Vague 2 — arrangement (1–2 jours)**
P5, P6, P7. C'est ici que se gagne la qualité perçue : bon tempo, bon équilibre,
une forme qui existe.

**Vague 3 — finition**
P8, P9. Puis **P10** seulement quand la question de la basse est tranchée.

---

## 3. Paramètres cibles par univers (à coder en données, pas en dur)

| Paramètre | Énergétique | Dansant | Détendu |
|---|---|---|---|
| BPM | 135 | 150 | 134 |
| Subdivision | 3 | 3 | 2 |
| Pulsations / mesure | 4 | 2 | 4 |
| Durée cible | 52–60 s | 60–90 s | 54–60 s |
| Basse | sparse, entre à ~50 % | **aucune** | motrice, 100 % |
| Gain percussion / basse | **+8 dB** | n/a | **−5,8 dB** |
| Harmonie | pédale | bourdon | diatonique, change à la mesure |
| Forme | 2 blocs | intro → plateau → arrêt | A · creux · A' · stop · B · stop · outro |
| LUFS cible | −12…−11 | −13…−12 | −15…−14 |

Ces valeurs viennent d'**une référence par univers** : les coder comme des
**plages**, pas comme des constantes, pour ne pas cloner trois morceaux.

---

## 4. Risques et compromis

| Risque | Probabilité | Effet | Mitigation |
|---|---|---|---|
| P5/P10 : aucune basse disponible → univers « creux » | **certaine** | Détendu et Segazz sans grave | assumer (option A), ou enregistrer des sons graves (option C) — **jamais** un sub silencieux |
| P6 : l'équilibre cible sonne mal avec les sons réels | moyenne | régression perçue | écoute A/B avant généralisation ; garder l'ancien équilibre en option |
| P7 : forme plus longue = pièce plus ennuyeuse | moyenne | perte d'attention | densité variable, pas un plateau de 60 s |
| P1 : refuser des notes rend certaines pièces plus pauvres | moyenne | moins de matière | c'est préférable à des notes fausses ; annoncer l'adaptation |
| P2 : un bon son écarté par un seuil | faible | perte de matière | prévoir un « forcer le rôle » côté curation |
| Régression de l'invariant 2 (reconnaissabilité) | faible | la démo perd sa preuve | `?selftest=1` en garde à chaque étape |

---

## 5. Ce qu'il ne faut pas faire

1. **Ne pas** copier les trois références : trois morceaux ≠ trois genres.
2. **Ne pas** ajouter d'instrument externe, de voix de synthèse ou d'accompagnement
   génératif (contrainte artistique du projet).
3. **Ne pas** utiliser les stems de référence comme accompagnement caché.
4. **Ne pas** fabriquer une progression d'accords là où la référence n'en a pas
   (Dansant, Énergétique).
5. **Ne pas** toucher aux sons sensibles ni à leurs restrictions.
6. **Ne pas** coder un tempo en dur dans un compositeur : c'est un paramètre
   d'univers (c'est précisément ce qui a produit D4).

---

## 6. Vérification de la Phase B (à mettre en place avant de coder)

Chaque tâche doit être vérifiable sans écoute, sauf celles qui portent
explicitement sur le goût :

| Test | Ce qu'il prouve |
|---|---|
| hauteur réalisée vs cible (cents) | D1/P1 corrigé |
| rôles de hauteur interdits sous le seuil | D2/P2 corrigé |
| `limits` non vide sur sélection uniquement texturale | D3/P3 corrigé |
| BPM du score = BPM de l'univers, 3 univers | D4/P4 corrigé |
| gains de bus vs tableau §3 | D5/P6 corrigé |
| durée dans la plage, sections contiguës, aucune zone non couverte | D6/P7 corrigé |
| `?selftest=1` 8/8 (ou plus, avec les nouveaux cas) | invariants préservés |
| écart entre deux rendus identiques < 1e-6 | déterminisme préservé |

**Et une écoute humaine.** Aucun de ces tests ne dit si la pièce est belle.
C'est le seul critère qui compte pour la démonstration, et il reste le dernier.
