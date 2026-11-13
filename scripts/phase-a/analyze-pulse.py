#!/usr/bin/env python3
"""
Find the pulse by grid fit, not by a beat tracker.

Method: sweep every tempo between --lo and --hi in fine steps. For each, choose
the grid phase that maximises onset strength, then measure how many onsets fall
within a tolerance of a grid line. The musical pulse is the tempo that explains
the onsets — a peak, not a guess. Octave errors are made visible by also
reporting the score at 2x, 3/2x and 2/3x the peak tempo: a real pulse has a
narrow maximum; a tracker's ambiguity shows up as near-equal scores an octave
or a third apart.

Usage:
  python analyze-pulse.py --name dansant --file <drums> [--band low] [--out x.json]
"""
import argparse
import json
import sys

import numpy as np

HOP = 256
TOL_MS = 25.0


def onsets_and_env(path, sr, band):
    import librosa
    y, _ = librosa.load(path, sr=sr, mono=True)
    if band:
        from scipy.signal import butter, sosfiltfilt
        nyq = sr / 2
        sos = butter(4, [max(band[0] / nyq, 1e-4), min(band[1] / nyq, 0.999)], btype='band', output='sos')
        y = sosfiltfilt(sos, y).astype('float32')
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP,
                                        backtrack=False, units='frames')
    times = librosa.frames_to_time(frames, sr=sr, hop_length=HOP)
    return times, env, sr


def score_tempo(times, env, sr, bpm, tol_s):
    """Best phase + share of onsets landing on the grid at this tempo."""
    period = 60.0 / bpm
    if period <= tol_s * 2 or len(times) < 8:
        return 0.0, 0.0, 0.0
    best = (0.0, 0.0, 0.0)  # (concentration, phase, strength)
    for off in np.linspace(0, period, 48, endpoint=False):
        rel = (times - off) % period
        d = np.minimum(rel, period - rel)
        conc = float((d * 1000 <= TOL_MS).mean())
        if conc > best[0]:
            grid = np.arange(off, times[-1], period)
            idx = np.clip((grid * sr / HOP).astype(int), 0, len(env) - 1)
            best = (conc, float(off), float(env[idx].mean()))
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', required=True)
    ap.add_argument('--file', required=True)
    ap.add_argument('--band', default='low', help="low|mid|''|lo-hi")
    ap.add_argument('--lo', type=float, default=60.0)
    ap.add_argument('--hi', type=float, default=200.0)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    band = {'low': (35.0, 160.0), 'mid': (200.0, 2000.0), '': None}.get(a.band)
    if band is None and '-' in a.band:
        lo, hi = a.band.split('-')
        band = (float(lo), float(hi))

    times, env, sr = onsets_and_env(a.file, 22050, band)
    tol = TOL_MS / 1000.0

    sweep = []
    bpm = a.lo
    while bpm <= a.hi:
        conc, phase, strength = score_tempo(times, env, sr, bpm, tol)
        sweep.append({'bpm': round(bpm, 2), 'concentration': round(conc, 4),
                      'phase_s': round(phase, 4), 'grid_strength': round(strength, 4)})
        bpm += 0.25

    sweep.sort(key=lambda x: (-x['concentration'], -x['grid_strength']))
    top = sweep[:12]
    peak = top[0]

    def at(bpm_target):
        cand = min(sweep, key=lambda x: abs(x['bpm'] - bpm_target))
        return cand

    ratios = {
        'peak': peak,
        'x2': at(peak['bpm'] * 2),
        'x3_2': at(peak['bpm'] * 1.5),
        'x2_3': at(peak['bpm'] * 2 / 3),
        'x3': at(peak['bpm'] * 3),
    }

    # Second estimator, independent of onset detection: the tempogram of the
    # onset envelope. On continuously rolled percussion the discrete grid fit
    # degrades, while the tempogram still integrates the periodic energy.
    import librosa
    tg = librosa.feature.tempogram(onset_envelope=env, sr=sr, hop_length=HOP, win_length=384)
    freqs = librosa.tempo_frequencies(tg.shape[0], sr=sr, hop_length=HOP)
    prof = tg.mean(axis=1)
    order = np.argsort(-prof)
    seen, tempogram_top = [], []
    for i in order:
        f = float(freqs[i])
        if not (55.0 <= f <= 210.0):
            continue
        if any(abs(f - s) / s < 0.03 for s in seen):
            continue
        seen.append(f)
        tempogram_top.append({'bpm': round(f, 2), 'relative_strength': round(float(prof[i] / prof[order[0]]), 3)})
        if len(tempogram_top) >= 6:
            break

    result = {
        'target': a.name,
        'tempogram': {
            'top_candidates': tempogram_top,
            'method': 'mean tempogram of the onset envelope, 55-210 BPM, near-duplicates merged at 3%',
            'note': 'independent of onset times: useful when percussion is continuous and the '
                    'discrete grid fit has no clear peak',
        },
        'file': a.file.split('/')[-1],
        'band_hz': band,
        'onset_count': int(len(times)),
        'onset_rate_per_s': round(len(times) / max(times[-1], 1e-9), 2),
        'tolerance_ms': TOL_MS,
        'method': 'grid fit: share of onsets within tolerance of a beat line, best phase per tempo',
        'peak': peak,
        'top_candidates': top,
        'octave_check': ratios,
        'octave_reading': None,
    }
    # A genuine pulse stands clearly above its octave/third relatives.
    others = [r for k, r in ratios.items() if k != 'peak']
    runner_up = max(o['concentration'] for o in others) if others else 0
    result['octave_reading'] = {
        'runner_up_concentration': runner_up,
        'peak_minus_runner_up': round(peak['concentration'] - runner_up, 3),
        'verdict': ('clear peak' if peak['concentration'] - runner_up > 0.15 else
                    'weak peak — tempo family ambiguous'),
    }

    with open(a.out, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"{a.name}: {len(times)} onsets ({result['onset_rate_per_s']}/s) in band {band}")
    print(f"  peak {peak['bpm']} BPM, concentration {peak['concentration']*100:.1f}% "
          f"@ phase {peak['phase_s']}s — {result['octave_reading']['verdict']}")
    print("  tempogram:", [(c['bpm'], c['relative_strength']) for c in tempogram_top[:4]])
    for c in top[:5]:
        print(f"    {c['bpm']:7.2f} BPM  conc {c['concentration']*100:5.1f}%  strength {c['grid_strength']:.3f}")


if __name__ == '__main__':
    sys.exit(main())
