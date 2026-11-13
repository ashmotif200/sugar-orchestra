# Transformations sonores — niveau C

**Autorisation du propriétaire :** transformations avancées, jusqu'à la resynthèse.
**Contrainte non négociable :** tout matériau vient exclusivement des enregistrements
sélectionnés par le visiteur. Aucun instrument externe, aucun stem de référence en
bande-son, et chaque son sélectionné doit être entendu au moins une fois sous une forme
reconnaissable.

## 1. Ce qui est réellement disponible sur Hermes

Inventaire vérifié le 13/11/2026 (versions relevées sur l'hôte) :

| Outil | Version | Ce qu'il permet | Ce qu'il ne permet pas |
|---|---|---|---|
| FFmpeg | 7.1.5 | `rubberband`, `atempo`, `asetrate`, `afftfilt`, `equalizer`, `acompressor`, `aecho`, `aphaser`, `loudnorm`, `ebur128`, `silenceremove` | granulation, resynthèse neuronale |
| Rubber Band (via FFmpeg) | librubberband 3.3.0 | time-stretch et pitch-shift **avec préservation de formant** | — |
| librosa | 0.11.0 | `effects.time_stretch` (vocodeur de phase), `effects.pitch_shift`, STFT/ISTFT, `onset`, `pyin` | temps réel |
| Essentia | 2.1-beta6-dev | descripteurs, tonalité, rythme | transformations |
| soundfile / scipy | 0.13.1 / 1.18.1 | E/S, filtres, analyse | — |
| `so stretch` (wrapper local) | — | interface unique vers rubberband | — |

**Absents, et donc hors périmètre :** PyTorch, Demucs, Basic Pitch, madmom, audioflux,
pyloudnorm, aubio. Aucune resynthèse neuronale n'est possible aujourd'hui — « niveau C »
signifie ici **DSP avancé**, pas modèle génératif. Les modèles lourds restent différés
sur Mac Studio et ne sont pas requis par cette conception.

## 2. Coûts mesurés

Banc d'essai : `03_04.wav`, 20,0 s, 44,1 kHz mono, sur le CPU de l'hôte (i7-8700).

| Opération | Temps mesuré | Rapport au temps réel |
|---|---|---|
| Rubber Band (tempo 1,25 + pitch +2 demi-tons) | **503 ms** | ~40× plus rapide que réel |
| `atempo` seul (sans formant) | 120 ms | ~165× |
| `afftfilt` (resynthèse spectrale) | 258 ms | ~78× |
| librosa vocodeur de phase + pitch_shift | **7 680 ms** | ~2,6× plus rapide que réel |

Conclusion opérationnelle : **hors navigateur**, tout est confortable. **Dans le
navigateur**, le rendu passe par `OfflineAudioContext` : `playbackRate`, découpe,
filtres, granulation et enveloppes sont quasi gratuits ; un vocodeur de phase écrit en
JS serait 1 à 2 ordres de grandeur plus lent et n'est pas retenu pour le rendu visiteur.

## 3. Catalogue des techniques

Notation : qualité = rendu musical, risque = artefacts probables, reconnaissabilité =
ce qu'il reste du son d'origine.

| Technique | Disponible en navigateur | Qualité | Coût | Risque | Reconnaissabilité | Usage recommandé |
|---|---|---|---|---|---|---|
| Lecture transposée (`playbackRate`) | oui | moyenne | ~0 | pitch et durée couplés | forte si \|ratio−1\| ≤ 1,2 | signature, doublures |
| Découpe / re-déclenchement | oui | bonne | ~0 | clics si mal placé | très forte | motifs rythmiques |
| Filtrage (passe-bande, balayage) | oui (BiquadFilter) | bonne | ~0 | résonance | forte | texture, transitions |
| Enveloppe (attaque/relâchement) | oui | bonne | ~0 | pompage | forte | nappes, respiration |
| Granulation (grains courts + fenêtre) | oui | variable | faible | duplication de transitoires | moyenne | nappes, « rêveur » |
| Inversion (reverse) | oui | bonne | ~0 | — | moyenne | montées, transitions |
| Time-stretch à formants (Rubber Band) | **non** | très bonne | 503 ms/20 s hors navigateur | — | forte | préparation hors ligne |
| Vocodeur de phase (librosa) | non | moyenne | 7,7 s/20 s | « phasey », pré-écho | moyenne | expérimentation hors ligne |
| Resynthèse spectrale (`afftfilt`, ISTFT) | non | variable | 258 ms/20 s | spectres figés | faible à moyenne | textures tenues uniquement |
| Dérivation de grave (sous-octave, filtre) | oui (limité) | faible à moyenne | ~0 | boue, déphasage | **faible** | voir §5 — rarement |

## 4. Règles d'application dans le moteur V2

1. **La reconnaissance passe d'abord.** Chaque son reçoit au moins une apparition dont
   le taux de lecture est dans `[0,9 ; 1,15]` et le traitement se limite à gain,
   panoramique et fondu. Le moteur planifie ces apparitions avant toute transformation.
2. **Budget de transformation par son.** Au plus deux notes transformées pour une note
   reconnaissable ; au-delà, le son cesse d'être identifiable comme celui du musée.
3. **Bornes par matériau**, issues de `capability-matrix.json` :
   - `timeStretch: risky` (13 des 17 sons sélectionnés) → étirement maximal 1,15× et
     jamais sur les frappes marquées « signature » ;
   - `pitchShift: not-applicable` (15 des 17) → le pitch-shift n'est qu'une couleur,
     jamais une tentative d'accord ;
   - `granular: poor` (15 des 17) → granulation réservée aux textures tenues.
4. **Aucune transformation ne peut créer un rôle.** Une transformation ne transforme pas
   un son non mélodique en mélodie : elle change son timbre, pas la présence d'une
   fondamentale stable dans le temps.
5. **Détection d'artefacts** avant export : crêtes > −1 dBTP, discontinuités
   d'enveloppe (clic), énergie DC, dépassement de la bande utile. Un dépassement
   n'annule pas la note : il la re-signale dans `RenderReport` pour écoute humaine.

## 5. Le cas de la basse — la tentation à refuser

Mesure : **0 des 17 sons sélectionnés n'est `bass_capable`** (exige ≥ 45 % d'énergie sous
250 Hz, hauteur crédible, f0 ≤ 220 Hz, périodicité ≥ 0,85). Deux sons seulement ont une
hauteur crédible, aucun dans le grave.

Trois stratégies existent, et deux sont malhonnêtes :

| Stratégie | Ce que ça donne | Verdict |
|---|---|---|
| Transposer un son grave existant (ex. 01_01, 86,7 % sous 80 Hz) | masse sans hauteur définie : un grondement, pas une basse | acceptable **comme texture**, jamais comme ligne harmonique |
| Sous-octave d'un son percussif | boue, déphasage, perte de l'attaque | à éviter |
| Synthétiser une basse à partir du spectre d'un son | son nouveau, non reconnaissable : viole la contrainte de provenance | **interdit** |

Décision de conception : quand aucun son n'est `bass_capable`, le profil déclare
`bass: 'none'` et le moteur **joue sans basse**. C'est exactement ce que fait la
référence Dansant, qui n'a aucun instrument de basse et fonctionne. Une composition sans
basse mais juste vaut mieux qu'une fausse basse.

## 6. Reproductibilité

Chaque transformation doit être décrite par des paramètres sérialisables et un
algorithme nommé (`rubberband@3.3.0`, `playbackRate`, `granular/grains=24ms`). Un rendu
doit pouvoir être rejoué à l'identique sur une autre machine à version d'algorithme
égale ; les différences de version sont enregistrées dans la composition.

Commandes de référence (rejouables) :

```bash
so stretch in.wav out.wav --tempo 1.25 --pitch-semitones 2      # rubberband
ffmpeg -i in.wav -af atempo=1.25 out.wav                        # baseline
ffmpeg -i in.wav -af afftfilt=real='hypot(re,im)':imag='0' out.wav   # expérimental
```
