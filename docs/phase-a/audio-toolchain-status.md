# Phase A2 — état opérationnel de la chaîne audio

Vérification datée du 13 novembre 2026, sur Hermes (Debian 13, i7-8700, 14 Gio,
**aucun GPU**). Méthode : réutilisation des auto-tests existants pour ce qui était
déjà couvert, vérification ciblée pour le reste — pas de ré-exécution des suites
complètes.

**Aucune installation n'a été faite pendant cette phase.** Aucune version n'a
changé. Aucun modèle GPU n'a été approché.

## 1. Tableau de synthèse

| Outil | Version | Emplacement | Test fonctionnel minimal | Verdict | Nécessaire en Phase B ? |
|---|---|---|---|---|---|
| **FFmpeg / ffprobe** | 7.1.5-0+deb13u1 | `/usr/bin` (système) | `so probe 07_01.wav` → `pcm_s16le, 32000 Hz, 1 ch, 20.0 s` | **OK** | **Oui** — sondage, conversions, loudness EBU R128 |
| **librosa** | 0.11.0 | `renv/analysis` (Python 3.13.5) | mesure complète des 40 masters (voir A4) | **OK** | **Oui** — cœur de l'analyse |
| **soundfile** | 0.13.1 | idem | lecture/écriture WAV utilisée par les tests | **OK** | Oui |
| **NumPy / SciPy** | 2.2.6 / 1.18.1 | idem | import + opérations utilisées partout | **OK** | Oui |
| **numba** | 0.68.1 | idem | JIT de librosa (pyin, onsets) | **OK** | Oui (transparent) |
| **Essentia** | 2.1b6.dev1438 | `renv/essentia` (Python 3.14.4) | `RhythmExtractor2013`, `KeyExtractor` présents + 7/7 en Phase 1 | **OK avec réserves** | Optionnel — contre-vérification tempo/tonalité |
| **Rubber Band** | librubberband 3.3.0 | via filtre FFmpeg | `ffmpeg -filters` → filtre `rubberband` présent | **Partiel** | Non pour A1–A5 ; oui si transformations |
| **`rubberband` CLI** | — | absent | `which rubberband` → rien | **ABSENT** | Non (contournable) |
| **Wrappers projet** | `bin/so`, `bin/so-selftest` | `/opt/data/tools/sugar-audio` | `make verify` 21/21, `make engines` 40/41 | **OK** | Oui |
| **Craft Anything** | 0.6.1 (MCP) | `/opt/data/tools/craft-anything/0.6.1` | `capabilities` → 323 outils, 18 toolsets, Chromium présent | **OK, hors sujet audio** | Uniquement pour vérifier l'UI |

## 2. Détail par outil

### FFmpeg / ffprobe — 7.1.5
- Compilé avec `--enable-librubberband --enable-libmp3lame --enable-libsoxr
  --enable-libvorbis --enable-libopus` et `--enable-gpl`.
- Capacités vérifiées : sondage JSON, décodage, rééchantillonnage 32 → 44,1 kHz,
  encodage AAC mono 112 kbit/s, mesure **EBU R128** (`ebur128`), filtre
  `rubberband` (tempo/pitch/formant), `silencedetect`, `astats`.
- Test réel : probe du master `07_01` → `pcm_s16le 32000 Hz 1 ch 20.0 s`.
- Limite : build **GPL** (Debian). Ne pas embarquer dans un livrable distribué
  sans relire `docs/LICENCES.md` du toolchain. Utilisé ici uniquement en local.

### librosa — 0.11.0
- Capacités réellement exercées pendant A4 : `pyin`, `hpss`, `onset_detect`,
  `onset_strength`, `feature.rhythm.tempo`, `spectral_centroid/rolloff/flatness`,
  `zero_crossing_rate`, `piptrack` non utilisé.
- **Piège mesuré le 13/11** : `librosa.feature.rhythm` n'est pas exposé par le
  lazy-loader tant que le sous-module n'est pas importé explicitement
  (`AttributeError: No librosa.feature attribute rhythm`). Corrigé dans le code
  par `import librosa.feature.rhythm`.
- **Coût mesuré** : pyin sur 20 s à 32 kHz coûte ~8 s par son (40 sons = 5 min 44).
  Réduit à ~2,5 s/son en travaillant sur les 8 s les plus forts à 16 kHz — même
  réponse musicale. C'est le réglage retenu dans `analyze-corpus.py`.
- **Limite basse fréquence** : à 32 kHz, une fenêtre de 2048 échantillons contient
  moins de 2 cycles d'un bourdon à 50 Hz. yin renvoie alors n'importe quoi
  (mesuré : 506 Hz sur un la 440 en Phase 1 avec Essentia, et des f0 aberrants ici).
  pyin en fenêtre 4096 et rééchantillonnage 16 kHz est la seule lecture honnête.

### Essentia — 2.1b6.dev1438
- `RhythmExtractor2013(method="multifeature")` et `KeyExtractor` opérationnels.
- Réserve 1 : c'est un **build de développement**, unique wheel Linux disponible
  (cp314). Il vit dans son propre venv et ne partage rien avec librosa.
- Réserve 2 : `PitchYinFFT` est **faux** dans ce build — 506,6 Hz pour un la 440
  (confiance 0,17). Ne pas l'utiliser ; `PitchYin` (439,6 Hz) et
  `PredominantPitchMelodia` (440,0 Hz) sont corrects.
- Réserve 3 : `KeyExtractor` est entraîné sur de la musique tonale occidentale.
  Sur un effet sonore, la « tonalité » obtenue est un artefact de ses a priori —
  à ne pas présenter comme un fait musical.

### Rubber Band — moteur 3.3.0, CLI absent
- Le moteur est présent (`librubberband2`, dépendance d'FFmpeg) et le filtre
  `rubberband` fonctionne. Mesures Phase 1 : tempo ×1,25 → durée exacte, pitch
  préservé à 440,6 Hz ; +2 demi-tons → 494,48 Hz contre 493,88 attendu (0,12 %
  d'erreur).
- Le binaire `rubberband` **n'est pas installable** : pas de root, pas de sudo,
  `apt-get` refusé sur `/var/lib/dpkg/lock-frontend`. Ce n'est pas bloquant :
  `so stretch` passe par le filtre FFmpeg et fait la même chose.
- Phase A ne transforme aucun son : cet outil n'a pas servi ici.

### Craft Anything — 0.6.1
- Intégré comme serveur MCP : `/opt/data/tools/craft-anything/0.6.1/bin/craft-anything-cli mcp
  --all-tools --restricted --allow-web --allow-capture --project /opt/data/craft-anything/projects/hermes.cany`.
- `capabilities` : **323 outils, 18 toolsets** (core, native, apple, formats,
  managed, android, java, adb, browser, javascript, runtime, frida, application,
  database, projects, setup, build). Chromium détecté à
  `/opt/data/tools/craft-anything/browser-chrome`.
- **Aucun outil audio, aucun outil DSP.** Ce n'est pas un moteur d'analyse
  sonore et il serait malhonnête de le présenter comme tel.
- Ce qu'il apporte réellement au projet :
  - `web_site_open` / `web_page_states_capture` / `web_walkthrough_record` —
    capture déterministe des écrans du parcours, utile en Phase B pour prouver
    qu'une modification d'arrangement n'a pas cassé l'UI ;
  - `build_file_*`, `build_command_run` — exécution de `npm run build`,
    `tsc --noEmit`, `so analyze` dans un projet suivi ;
  - `core_finding_record` / `core_evidence_export` — journal d'évidence daté,
    si l'équipe veut un dossier d'audit de la démo.
- Décision : **ne pas router l'analyse audio à travers Craft Anything.** Le
  toolchain local (`bin/so`) est plus direct et reproductible.

## 3. Modèles GPU-intensifs — non installés

Confirmé par vérification : **ACE-Step 1.5, HeartMuLa, FunMusic ne sont pas
installés**, aucun poids n'est présent, aucun runtime CUDA/PyTorch/MPS n'existe
sur Hermes. Le projet reste **CPU-first**. Le plan Mac Studio reste un document
de conception (`docs/PHASE2-MAC-STUDIO-PLAN.md` du toolchain), sans autorisation.

## 4. Ce qui manque à la chaîne, et ce que ça coûte

| Manque | Impact Phase A | Contournement retenu |
|---|---|---|
| `rubberband` CLI | aucun (pas de transformation en A) | filtre FFmpeg |
| Détection de hauteur robuste sur bruit | moyen (rôles musicaux) | mesure d'harmonicité + seuils explicites, hypothèses assumées |
| Séparation de sources (stems) | **bloquant pour A3** | aucun — Demucs reste différé |
| Loudness LUFS par son | faible | `ebur128` via FFmpeg, déjà en place |
| Modèle de transcription (audio→MIDI) | faible | non nécessaire : A3 est bloqué faute de fichiers |

## 5. Verdict

La chaîne est **opérationnelle pour l'analyse** et suffisante pour A1, A2, A4 et
A5. Elle est **insuffisante pour A3** non par défaut d'outil mais par **absence
des fichiers de référence** (voir `reference-analysis-summary.md`) : aucun outil
au monde n'analyse un fichier qui n'est pas là.
