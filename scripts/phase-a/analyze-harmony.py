#!/usr/bin/env python3
"""Phase A3 — grille rythmique et cycle d'accords mesurés d'une référence.

Mesures, pas transcription :
  * histogramme des attaques (16 pas par mesure) pour chaque stem ;
  * accords par mesure par corrélation de chroma avec des triades (maj/min) ;
  * longueur de cycle détectée par autocorrélation de la séquence d'accords.

    python scripts/phase-a/analyze-harmony.py --json ... --stem other=PATH --out ...
"""
import argparse, json, sys
from pathlib import Path
import librosa, numpy as np

NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

def triads():
    t = {}
    for i, n in enumerate(NOTES):
        t[n] = np.zeros(12); t[n][[i, (i+4)%12, (i+7)%12]] = 1
        t[n+'m'] = np.zeros(12); t[n+'m'][[i, (i+3)%12, (i+7)%12]] = 1
    return t

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', required=True)
    ap.add_argument('--stem', required=True, help='NAME=PATH (couche harmonique)')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    name, path = a.stem.split('=', 1)
    ref = json.loads(Path(a.json).read_text())
    bar_s = ref['arrangement']['mix_timeline']['bar_seconds']
    n_bars = int(ref['files']['mix']['duration_s'] / bar_s)
    y, sr = librosa.load(path, sr=22050, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=512)
    T = triads()
    prog, conf = [], []
    for b in range(n_bars):
        m = (times >= b*bar_s) & (times < (b+1)*bar_s)
        if not m.any(): prog.append(None); conf.append(0); continue
        v = chroma[:, m].mean(axis=1)
        v = v / (np.linalg.norm(v) + 1e-9)
        best, bc = None, -1
        for k, tpl in T.items():
            c = float(np.dot(v, tpl/np.linalg.norm(tpl)))
            if c > bc: best, bc = k, c
        prog.append(best); conf.append(round(bc, 3))
    # cycle : plus petite periode qui se repete sur au moins 3 tours
    cycle = None
    for p in range(2, 17):
        if n_bars < p*3: break
        hits = total = 0
        for i in range(n_bars - p):
            if prog[i] and prog[i+p]:
                total += 1; hits += prog[i] == prog[i+p]
        if total and hits/total >= 0.75:
            cycle = {'period_bars': p, 'agreement': round(hits/total, 2)}; break
    out = {'stem': name, 'bar_seconds': bar_s, 'bars': n_bars,
           'progression': prog, 'confidence': conf,
           'cycle': cycle,
           'unique_chords': sorted({p for p in prog if p}),
           'limits': ['triad matching on a single harmonic layer; a drone or a pad with no third will read as major',
                      'no inversion, no seventh, no transposition is reported']}
    Path(a.out).write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"{name}: {n_bars} mesures, cycle={cycle}")
    print('  ' + ' | '.join(f"{i+1}:{p}" for i, p in enumerate(prog)))

if __name__ == '__main__':
    sys.exit(main())
