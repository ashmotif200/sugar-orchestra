#!/usr/bin/env python3
"""Phase A3 — structure d'arrangement d'une référence (mix + stems).

Ne produit aucune notation : uniquement des mesures reproductibles.
  * présence par mesure de chaque stem (RMS par mesure, seuil relatif) ;
  * découpage en sections par signature de présence ;
  * grille rythmique : positions d'attaques modulo la mesure, kick (bande basse)
    et caisse (bande médium) mesurés séparément ;
  * équilibre des couches en LUFS et centroïde spectral par stem.

    /opt/data/renv/analysis/bin/python scripts/phase-a/analyze-arrangement.py \
        --json docs/phase-a/data/reference-energetique.json \
        --stems drums=PATH bass=PATH vocals=PATH percs_and_synths=PATH \
        --out docs/phase-a/data/arrangement-energetique.json
"""
import argparse, json, subprocess, sys
from pathlib import Path

import librosa
import numpy as np


def load(path, sr=22050):
    y, _ = librosa.load(str(path), sr=sr, mono=True)
    return y, sr


def onset_times(y, sr, fmin=None, fmax=None):
    if fmin or fmax:
        y = librosa.effects.preemphasis(y)
        S = np.abs(librosa.stft(y, n_fft=2048))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
        mask = np.ones_like(freqs, dtype=bool)
        if fmin: mask &= freqs >= fmin
        if fmax: mask &= freqs <= fmax
        S = S * mask[:, None]
        env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S), sr=sr)
    else:
        env = librosa.onset.onset_strength(y=y, sr=sr)
    return librosa.onset.onset_detect(onset_envelope=env, sr=sr, units='time', backtrack=False)


def band_onsets(y, sr, fmin, fmax):
    return onset_times(y, sr, fmin, fmax)


def bar_rms(y, sr, bar_s, n_bars):
    out = []
    for b in range(n_bars):
        i0 = int(b * bar_s * sr); i1 = int((b + 1) * bar_s * sr)
        seg = y[i0:i1]
        out.append(float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12)) if seg.size else -120.0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', required=True, help='sortie de analyze-reference.py')
    ap.add_argument('--stems', action='append', default=[], help='NAME=PATH')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    ref = json.loads(Path(a.json).read_text())
    bpm = ref['rhythm']['beat']['bpm']
    bar_s = ref['arrangement']['mix_timeline']['bar_seconds']
    duration = ref['files']['mix']['duration_s']
    n_bars = int(duration / bar_s)

    paths = {'mix': None}
    for item in a.stems:
        name, p = item.split('=', 1)
        paths[name.strip()] = p.strip()

    sr = 22050
    data = {}
    for name, p in paths.items():
        if not p: continue
        y, _ = load(p, sr)
        bars = bar_rms(y, sr, bar_s, n_bars)
        med = float(np.median(bars))
        # présence : une mesure est "active" si elle est à moins de 6 dB de la médiane
        active = [v > med - 6 for v in bars]
        on = onset_times(y, sr)
        grid = [float((t % bar_s) / bar_s) for t in on]
        hist16 = np.histogram(grid, bins=16, range=(0, 1))[0].tolist()
        data[name] = {
            'bar_rms_db': [round(v, 1) for v in bars],
            'median_bar_rms_db': round(med, 1),
            'active_bars': [i + 1 for i, v in enumerate(active) if v],
            'active_ratio': round(sum(active) / max(1, len(active)), 2),
            'onsets': round(len(on) / (duration / 60), 1),  # par minute
            'onset_histogram_16ths': hist16,
            'centroid_hz': int(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))),
        }
        if name in ('drums', 'mix'):
            kick = band_onsets(y, sr, 30, 130)
            snare = band_onsets(y, sr, 1000, 5000)
            data[name]['kick_grid_16ths'] = np.histogram([(t % bar_s) / bar_s for t in kick], bins=16, range=(0, 1))[0].tolist()
            data[name]['snare_grid_16ths'] = np.histogram([(t % bar_s) / bar_s for t in snare], bins=16, range=(0, 1))[0].tolist()
            data[name]['kick_per_bar'] = round(len(kick) / n_bars, 2)
            data[name]['snare_per_bar'] = round(len(snare) / n_bars, 2)

    # sections : signature de présence (drums, bass, harmonie, voix)
    names = [n for n in ('drums', 'bass', 'other', 'percs_and_synths', 'vocals') if n in data]
    sections = []
    for b in range(n_bars):
        sig = ''.join('1' if b + 1 in data[n]['active_bars'] else '0' for n in names)
        if sections and sections[-1]['sig'] == sig:
            sections[-1]['bar1'] = b + 1
        else:
            sections.append({'bar0': b + 1, 'bar1': b + 1, 'sig': sig})
    for s in sections:
        s['bars'] = s['bar1'] - s['bar0'] + 1
        s['seconds'] = round(s['bars'] * bar_s, 2)
        s['playing'] = [n for n, c in zip(names, s['sig']) if c == '1']

    out = {
        'source': Path(a.json).name,
        'bpm': bpm,
        'bar_seconds': bar_s,
        'bars': n_bars,
        'duration_s': duration,
        'stems': data,
        'sections': sections,
        'limits': ['presence uses a relative threshold (-6 dB from each stem median)',
                   'section boundaries inherit beat-grid error',
                   'onset histograms are measured on a 16-step grid, not transcribed'],
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"wrote {a.out} — {n_bars} mesures, {len(sections)} sections, {bpm} BPM, {bar_s}s/mesure")
    for s in sections:
        print(f"  mes {s['bar0']:>2}-{s['bar1']:<2} ({s['seconds']:5.1f}s) {','.join(s['playing']) or '—'}")


if __name__ == '__main__':
    sys.exit(main())
