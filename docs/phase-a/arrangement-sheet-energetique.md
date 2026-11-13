# Fiche d'arrangement — Énergétique / Electro Sega

**Destinataire :** Phase B. **Référence mesurée :** « Ohwalawa » (voir
`reference-analysis-ohwalawa.md`). **Aucune modification du moteur n'est faite ici.**

## 1. Carte d'identité

| Paramètre | Valeur cible | Mesuré sur la référence | Moteur actuel | Écart |
|---|---|---|---|---|
| Tempo | **135 BPM** | 135,54 | 112 | **−23 BPM (−17 %)** |
| Mètre | 4/4, sensation double-croche | 4/4, 1,771 s/mesure | 4/4 | ok |
| Durée | **50 s / 28 mesures** | 51,06 s / 28 mes. | 35,9 s / 16 mes. | **−15 s, −12 mesures** |
| Tonalité | **fa** (pédale, pas de progression) | F maj/min, cycle 2 mes. à 0,96 | ré mineur + grille 4 accords | à changer |
| LUFS intégré | **−12 à −10** (référence −11,7) | −11,7 | −17 | **−5 LUFS** |
| Crête | ≤ −1 dBFS | −2,07 | −1,0 | ok |

## 2. Forme à produire (28 mesures)

| Section | Mesures | Durée | Couches | Intention |
|---|---|---|---|---|
| **Amorce** | 1 | 1,8 s | percs + nappe, **pas de batterie** | entrer sans groove |
| **Montée** | 2–3 | 3,5 s | batterie qui rentre, basse effleurée | annoncer le pouls |
| **Bloc A** | 4–13 | 17,7 s | batterie + percs + voix (chez nous : percs) — **sans basse** | 10 mesures de tension |
| **Drop** | 14–28 | 26,6 s | **toutes les couches, basse comprise** | résolution |

Le point non négociable de cette référence : **la basse n'entre qu'à la mesure 14**.
C'est ce qui produit l'effet de drop. Le moteur actuel fait l'inverse (basse dès la
mesure 2, continue).

## 3. Rôles et densités cibles

| Rôle | Source catalogue (sélection v2) | Densité cible | Niveau cible |
|---|---|---|---|
| Rythmique / kick | `04_03` ou `07_01` découpé (≤ 120 ms) | **7,6 frappes/mesure** | −13 LUFS |
| Caisse / contretemps | `02_01`, `03_04` (attaques métalliques) | 8/mesure | −16 LUFS |
| Charbon percussif | `06_04`, `06_06`, `07_02` en 16e | 268 attaques/min | −19,5 LUFS |
| Basse | **aucune source grave au catalogue** — voir §5 | 1,6 attaque/s, sparse | −21 LUFS |
| Nappe / pédale | `01_02`, `01_04`, `05_01` (granulaire) | continue, 2 couches | −22 LUFS |
| Voix | **indisponible** (aucun son autorisé) | — | — |

## 4. Traitement

- **Harmonie statique** : une seule pédale de fa. Pas de grille d'accords, pas de
  transposition harmonique d'un son d'une mesure à l'autre.
- Filtrage passe-bas sur la basse et le kick (300–500 Hz), passe-haut sur les
  charleys et percs (3 kHz et plus) pour retrouver le centroïde mesuré (1 750 Hz sur
  la batterie, 1 113 Hz sur percs+synth).
- Ducking sous chaque son du visiteur : conservé (invariant de reconnaissabilité),
  mais la musique ne doit pas descendre sous −24 dB pendant ces passages, sinon la
  forme disparaît.

## 5. Décision requise — la basse

Le corpus ne contient **aucune source de basse** (0/40, mesuré en Phase A). Trois
options, à arbitrer par l'équipe :

| Option | Conséquence musicale | Conséquence éditoriale |
|---|---|---|
| **A. Pas de basse** | le drop existe quand même (densité + nappe grave `01_02`) mais moins physique | respecte totalement l'invariant |
| **B. Sub fabriqué** à partir de `07_01` (bagasse, 51 Hz) transposé à 44 Hz, passe-bas 120 Hz, **uniquement dans le drop** | drop crédible | le son n'est plus reconnaissable **dans ce passage** ; il reste cité brut ailleurs — à écrire à l'écran |
| C. Enregistrer 2–3 sons graves au musée (broyeur, chaudière, moteur) | la seule voie qui donne du grave **et** la reconnaissabilité | hors délai pour le 14/11 |

Recommandation : **B pour la démo** (le drop est la signature de l'univers), avec la
mention « adaptation » déjà prévue par le moteur, et C pour la suite.

## 6. Ce que la Phase B doit changer (propositions, pas implémentation)

1. Tempo de l'univers `electro-sega` : 112 → **135**.
2. Longueur : 16 → **28 mesures** (~50 s).
3. Tonalité : ré mineur → **fa** (les sources sont transposées de toute façon).
4. Basse : entrée **mesure 14**, sparse (1,6/s), pas de ligne continue.
5. Remplacer la grille de 4 accords par une **pédale** unique.
6. Relever le niveau cible de −17 à **−12 LUFS** (la référence est un master, pas une
   maquette) — ou assumer une démo plus douce et le documenter.
7. Conserver le ducking mais borner sa profondeur pour ne pas effacer la forme.

## 7. Contrat d'écoute (acceptation)

- [ ] Le pouls perçu est celui d'un morceau à ~135 BPM, pas à 112.
- [ ] Il y a un moment identifiable où la pièce « s'ouvre » (entrée de la basse).
- [ ] La pièce ne module pas d'accord : elle tient une pédale.
- [ ] Les percussions sont devant, la basse discrète.
- [ ] Aucun son du visiteur n'est noyé au point de devenir inaudible.
