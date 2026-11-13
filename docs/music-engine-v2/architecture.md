# Moteur musical V2 — architecture

**Statut : conception. Aucune ligne du moteur n'est implémentée ni modifiée.**
Le moteur V1 (`src/engine/`) reste en production, intact, et sert de référence de
comparaison. Ce document décrit trois composants, leurs contrats de données, et les
défauts mesurés qu'ils doivent corriger.

## 1. Pourquoi un V2 plutôt qu'un réglage du V1

Le V1 n'est pas cassé : il rend, il est déterministe, il respecte les sources. Il est
*maladroit musicalement*, et trois mesures expliquent pourquoi :

| Défaut V1 | Mesure | Conséquence audible |
|---|---|---|
| `rateFor()` replie la transposition par octaves | anvil 844,5 Hz ramené sur D2 73,4 Hz → **587,4 Hz, +36 demi-tons** | la note écrite n'est pas la note jouée, et rien ne le signale |
| tempo et mètre constants par univers | 112 BPM / 4/4 (electro), 126 BPM / 4/4 (trad) contre **135 ternaire**, **~155 (6/8)**, **137 binaire** | le groove ne ressemble à aucune référence |
| durée fixe 36 s, grille de 4/4 | références : 51 s, 205 s, 54 s, en 4/4 ternaire, 6/8, 4/4 binaire | absence de forme, de break, de respiration |
| rôles attribués dès qu'un `f0Hz` existe | **2 sons sur 17** ont une hauteur crédible ; **0** peut servir de basse | fausses basses, fausses mélodies |

Un quatrième défaut est structurel : `bpm: number` ne peut pas représenter une mesure
ternaire. La mesure de Tififi le prouve — le même morceau se décrit comme 103,4 BPM
(noires) ou ~155 BPM (croches), pour une mesure identique de 2,32 s. **Le tempo doit
être un triplet (durée de mesure, temps par mesure, subdivision), jamais un entier.**

## 2. Vue d'ensemble

```
        sélection du visiteur (ids de sons)
                     │
        ┌────────────▼─────────────┐
        │ A. MUSIC INTELLIGENCE     │  analyse + capacités + rôles + replis
        │  (hors ligne, cacheable)  │
        └────────────┬─────────────┘
                     │  SoundCapability[]  (mesures, jamais des noms d'instruments)
        ┌────────────▼─────────────┐
        │ B. COMPOSITION ENGINE     │  profil + seed → ScorePlan
        │  (déterministe, pur)      │  aucun accès audio, aucune horloge
        └────────────┬─────────────┘
                     │  ScorePlan (événements datés, transpositions, traitements)
        ┌────────────▼─────────────┐
        │ C. AUDIO RENDERING ENGINE │  DSP + placement + mixage + export
        │  (Web Audio / OfflineAudio)│
        └────────────┬─────────────┘
                     │  AudioBuffer + RenderReport (traçabilité)
                     ▼
              lecteur / WAV / IndexedDB
```

Règle de dépendance : **B ne connaît pas l'audio, C ne décide de rien.** Toute décision
musicale est dans B ; tout ce qui touche aux échantillons est dans C. C'est ce qui rend
une composition explicable, testable, et rejouable à l'identique.

## 3. Contrats de données

### 3.1 `SoundCapability` — sortie de A, entrée de B

```ts
interface SoundCapability {
  soundId: string
  /** mesuré, pas deviné — voir capability-matrix.json */
  potential: {
    rhythmic: number; percussive: number; melodic: number; harmonic: number
    low: number; textural: number; atmospheric: number      // 0..1
  }
  pitch: {
    credible: boolean          // exige periodicity >= 0.75 ET voiced_ratio >= 0.30
    medianHz: number | null
    periodicity: number
    voicedRatio: number
    centsSpread: [number, number] | null                    // p10..p90
  }
  /** contraintes de transformation, mesurées (voir transformation-strategy.md) */
  transform: {
    timeStretch: 'safe' | 'risky'
    pitchShift: 'safe' | 'not-applicable'
    granular: 'good' | 'poor'
    lowDerivation: 'plausible' | 'unlikely'
    maxStretchRatio: number      // au-delà, les transitoires sont détruits
    maxPitchSemitones: number
  }
  sensitive: boolean             // jamais composable, filtré en amont
  availability: 'available' | 'not_musical'
}
```

**Invariant :** un son `sensitive` ou `not_musical` n'entre jamais dans le tableau que
lit le compositeur. Le filtrage a lieu une fois, au chargement, et non dans le
compositeur.

Nuance importante, validée par `verify-v2.py` : le fichier d'analyse
`capability-matrix.json` *contient* les sons restreints avec leurs mesures (l'analyse
acoustique est neutre) mais leur champ `best_roles` est **vide**, avec
`roles_withheld_reason` renseigné. Une première version de ce fichier attribuait des
rôles à 04_02 — c'est exactement le glissement qu'une matrice de capacités peut
provoquer si on la lit comme une autorisation. Mesurer n'est pas autoriser.

### 3.2 `MusicalProfile` — entrée de B, versionnée

```ts
interface MusicalProfile {
  id: string                    // 'electro-sega' — identifiant stable, jamais renommé
  version: number               // incrémenté à chaque changement de paramètre
  publicName: { fr: string; en: string }   // nom affiché, indépendant de l'id

  time: {
    barSeconds: [number, number]     // plage, pas une valeur : 1,70..1,85
    beatsPerBar: 4 | 6 | 12
    subdivision: 2 | 3               // binaire ou ternaire
    swing: [number, number]          // position du contretemps : 0.5 = droit, 0.667 = ternaire
    tempoDrift: number               // ± BPM toléré en cours de morceau
  }
  groove: {
    patterns: GroovePattern[]        // voir §5
    densityBySection: Record<SectionKind, number>
    microtimingMs: number            // dispersion appliquée aux frappes
  }
  harmony: {
    mode: 'pedal' | 'progression' | 'none'
    key: string | null               // 'F', 'B', ...
    scale: number[]                  // demi-tons depuis la tonique
    progression: number[][] | null   // degrés par section, si mode = progression
  }
  roles: RoleSpec[]                // exigences et replis par rôle
  form: SectionSpec[]              // voir §6
  mix: { roleGainDb: Record<Role, number>; masterLufs: number; truePeakDb: number }
  variability: { motifMutation: number; fillProbability: number; seedSensitivity: number }
  constraints: string[]            // ex. 'aucune basse disponible : ne pas en inventer'
}
```

### 3.3 `ScorePlan` — sortie de B, entrée de C

```ts
interface ScorePlan {
  schema: 2
  seed: number
  profileId: string
  profileVersion: number
  engineVersion: string
  time: { barSeconds: number; beatsPerBar: number; subdivision: number; bars: number }
  notes: PlannedNote[]
  sections: PlannedSection[]
  mix: { roleGainDb: Record<Role, number>; masterLufs: number }
  report: { adaptations: Adaptation[]; limits: Limit[]; coverage: Record<string, number> }
}

interface PlannedNote {
  id: string
  sourceId: string
  role: Role
  /** position musicale, pas un temps en secondes : la grille est la vérité */
  bar: number; beat: number; sub: number
  durationBeats: number
  /** pitch : la note ÉCRITE et la note RÉELLE sont toutes deux présentes */
  writtenMidi: number | null
  realizedHz: number
  playbackRate: number
  transpositionSemitones: number       // |x| <= profile.maxTransposition
  gainDb: number
  transform: TransformSpec[]           // filtres, granularité, reverse, découpe
  recognisable: boolean                // au moins une apparition non transformée par son
}
```

**Invariant vérifié au rendu** (correction du défaut V1) : pour chaque note,
`realizedHz == writtenMidiToHz(writtenMidi)` à ±10 cents, **ou** la note est marquée
`recognisable: false` et n'est pas présentée comme tenue par ce son. Un écart supérieur
à ±50 cents lève une erreur de rendu, pas un avertissement silencieux.

## 4. Composant A — Music Intelligence

**Responsabilité :** transformer un enregistrement en capacités mesurées.

- Entrées : les 40 masters WAV (analyse hors ligne, une fois, mise en cache).
- Sorties : `SoundCapability[]` + un rapport de fiabilité.
- Méthodes : celles déjà validées en Phase A (librosa pyin avec contrôle de couverture
  voisée, périodicité par autocorrélation calibrée sine 0,98 / bruit 0,02, part de bande,
  flux d'attaques, enveloppe). **Aucune méthode nouvelle n'est nécessaire.**
- Règle : une capacité n'est déclarée que si la mesure dépasse un seuil documenté. Le
  seuil de hauteur crédible (`periodicity ≥ 0.75`, `voiced_ratio ≥ 0.30`) est celui du
  corpus, déjà appliqué dans `docs/phase-a/data/capability-matrix.json`.

**Détection de limites :** si moins de deux sons ont une hauteur crédible, ou si aucun
son n'a de potentiel `low ≥ 0.45`, le composant A émet une limite explicite. Il ne
fabrique pas de substitut.

## 5. Composant B — Composition Engine

**Responsabilité :** profil + capacités + seed → `ScorePlan`.

Pipeline interne, dans cet ordre :

1. **Plan de forme** — choisit les sections du profil (durée totale dans la plage du
   profil), avec entrées/sorties de couches par section.
2. **Grille** — construit la grille `(bar, beat, sub)` du profil, avec swing.
3. **Attribution des rôles** — gloutonne sur les capacités, avec repli explicite :
   `bass ← low le plus fort` → `bass absente` (jamais volée à la mélodie) ;
   `melody ← credible_pitch` → `motif rythmique` → `absent`.
4. **Motifs** — génère un motif par rôle à partir d'un vocabulaire de cellules
   rythmiques, puis le mute (transposition, décalage, ajout/retrait d'une frappe).
5. **Harmonie** — selon le profil : pédale, progression, ou aucune.
6. **Remplissage** — placements secondaires, syncopes, fills de fin de phrase.
7. **Signature de reconnaissance** — garantit une apparition brute de chaque son.
8. **Contrôles** — couverture, transposition, densité par section, absence de son
   interdit ; échec = `Limit`, jamais un silence.

**Déterminisme :** une seule source aléatoire (`mulberry32(seed)`), consommée dans un
ordre fixe. Aucun `Math.random`, aucun `Date.now`, aucune itération sur un `Set` non
ordonné. Deux rendus de la même seed produisent des `ScorePlan` identiques au bit près —
c'est testable et doit l'être.

**Variabilité :** `seedSensitivity` contrôle combien deux seeds différentes divergent.
0 = résultat figé (utile pour les tests), 1 = forte variété (risque de perte d'identité).

## 6. Composant C — Audio Rendering Engine

**Responsabilité :** `ScorePlan` → audio. Aucune décision musicale.

- Placement : `(bar, beat, sub)` → secondes via la grille du plan. Le placement ne
  relit jamais le BPM du profil : la grille est figée dans le plan.
- Transformations : voir `transformation-strategy.md` (niveau C : découpe, filtre,
  pitch/time via Rubber Band, granulation, extraction de transitoires, dérivation de
  grave). Chaque transformation déclare son coût et son risque d'artefact.
- Mixage : gains par rôle du profil, contrôle dynamique par rôle (compression douce sur
  la basse seulement si elle existe), réverbération courte optionnelle, limiteur de
  sortie avec true peak.
- **Mastering** : cible LUFS du profil, plafond true peak **−1,0 dBTP**. La référence
  Tififi atteint +0,6 dBTP en sortie d'export : ne pas reproduire cette erreur.
- Sortie : `AudioBuffer` + `RenderReport` (durée, événements, sources utilisées,
  signatures, adaptations, limites, crêtes, LUFS, couverture).

## 7. Déterminisme, reproductibilité, provenance

Une composition est décrite par un quintuplet reproductible :
`(engineVersion, profileId, profileVersion, seed, sorted(soundIds))`.

Les versions exactes des fichiers audio utilisés sont stockées avec la composition
(table `compositions`, déjà en place dans le Super Admin : `sound_versions_json` avec
SHA-256). Remplacer un sample ne réécrit donc pas l'histoire d'une composition passée.

## 8. Laboratoire de comparaison V1/V2

Le Super Admin doit pouvoir, pour une même sélection :
- rendre la version V1 et la version V2 avec la même seed ;
- écouter les deux, télécharger les deux ;
- comparer des mesures côte à côte (durée, densité, couverture, LUFS, true peak,
  nombre de motifs distincts, respect des transpositions) ;
- conserver les deux dans IndexedDB avec un champ `engine: 'v1' | 'v2'`.

**Critères d'écoute** (jamais un score unique) : cohérence rythmique, forme perceptible,
variation sans perte d'identité, équilibre spectral, dynamique, qualité des
transformations, reconnaissabilité de chaque son, diversité entre deux seeds, absence
d'artefacts. Une note globale peut être affichée à côté, jamais à la place.

## 9. Couche IA optionnelle

Un port `ArrangementAdvisor` peut être ajouté derrière `CompositionEngine` :

```ts
interface ArrangementAdvisor {
  suggest(plan: ScorePlan, context: ProfileContext): Promise<ScorePlanPatch[]>
}
```

Par défaut, l'implémentation est **absente** et le moteur fonctionne. Une suggestion IA
doit produire un patch de `ScorePlan` validable par les mêmes contrôles (transposition,
couverture, sons autorisés). Aucun modèle n'est requis, téléchargé ou appelé par cette
conception ; les modèles lourds restent différés sur Mac Studio.

## 10. Ce que le V2 ne fera pas

- Il n'inventera pas de basse quand aucun son ne peut en tenir une ; il jouera sans
  basse et le dira (profil Détendu : voir `musical-profiles.md`).
- Il n'utilisera jamais les stems de référence comme bande-son.
- Il n'ajoutera aucun instrument externe.
- Il ne prétendra pas qu'une transformation garantit la qualité musicale.
- Il ne remplacera pas l'écoute humaine par une métrique.
