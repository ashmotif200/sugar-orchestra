#!/usr/bin/env python3
"""
Groove and dynamics measurement on a known pulse.

Why this exists: the earlier reference analysis reused librosa's beat tracker,
which locked onto 103.36 BPM for Tififi against a true pulse near 150. Every
downstream number built on that grid (swing 0.314, "slightly early/late") is
therefore invalid. This script takes the pulse as an INPUT and measures the
performance against it, so the grid is a stated hypothesis rather than a hidden
assumption.

Measures, per file:
  * onset phase histogram inside the beat  -> ternary vs binary subdivision
  * swing ratio (0.5 = straight, 0.667 = hard triplet)
  * microtiming: distance of each onset to the nearest subdivision grid line
  * syncopation: share of onsets that fall off the pulse
  * bar pattern: onsets folded into the bar as a readable string, plus how much
    consecutive bars resemble each other (motif repetition vs through-composed)
  * optional: integrated loudness + true peak per section (ffmpeg ebur128)

Usage:
  python analyze-groove.py --name dansant \
      --drums assets/references/tififi/tififi_Dansant_drums.mp3 \
      --bpm 149.8 --subdiv 3 --bar-s 2.322 \
      --sections docs/phase-a/data/arrangement-dansant.json \
      --out docs/phase-a/data/groove-dansant.json
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np

HOP = 256


def load_mono(path, sr=22050, band=None):
    """Load mono, optionally band-limited.

    Broadband onsets are useless on a continuous percussion roll (a ravanne
    tremolo fires the detector on every grain): the phase histogram goes flat.
    Restricting to the low band isolates the drum's pulse-carrying hits.
    """
    import librosa
    y, _ = librosa.load(path, sr=sr, mono=True)
    if band:
        from scipy.signal import butter, sosfiltfilt
        lo, hi = band
        nyq = sr / 2
        sos = butter(4, [max(lo / nyq, 1e-4), min(hi / nyq, 0.999)], btype='band', output='sos')
        y = sosfiltfilt(sos, y).astype('float32')
    return y, sr


def onsets_of(y, sr):
    import librosa
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    # backtrack=False: timing analysis needs the detector's own estimate. With
    # backtrack=True every onset is moved to the preceding energy minimum, which
    # showed up as 30-65 ms of fake 'microtiming' in the first run of this script.
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP,
                                        backtrack=False, units='frames')
    return librosa.frames_to_time(frames, sr=sr, hop_length=HOP), env


def best_phase(onsets, beat, env, sr):
    """Choose the grid offset (0..beat) that puts the most onset strength on beats."""
    best, best_score = 0.0, -1.0
    for off in np.linspace(0, beat, 96, endpoint=False):
        grid = np.arange(off, onsets[-1], beat) if len(onsets) else np.array([])
        if not len(grid):
            continue
        idx = np.clip((grid * sr / HOP).astype(int), 0, len(env) - 1)
        score = env[idx].sum()
        if score > best_score:
            best, best_score = float(off), float(score)
    return best


def phase_histogram(onsets, beat, phase):
    """Where do onsets sit inside the beat? 12 bins of 1/12 beat."""
    if not len(onsets):
        return [0.0] * 12, 0
    rel = ((onsets - phase) % beat) / beat
    hist = np.zeros(12)
    for r in rel:
        hist[int(r * 12) % 12] += 1
    n = int(hist.sum())
    return [round(float(x) / max(n, 1) * 100, 1) for x in hist], n


def swing_ratio(onsets, beat, phase):
    """
    Position of the first off-beat, as a fraction of the beat.
    0.50 = straight eighths, 0.667 = triplet swing, 0.75 = hard dotted feel.
    Uses the modal position of onsets landing strictly between 0.25 and 0.80.
    """
    if not len(onsets):
        return None, 0
    rel = ((onsets - phase) % beat) / beat
    mid = rel[(rel > 0.25) & (rel < 0.80)]
    if len(mid) < 8:
        return None, int(len(mid))
    bins = np.linspace(0.25, 0.80, 23)
    h, edges = np.histogram(mid, bins=bins)
    k = int(np.argmax(h))
    return round(float((edges[k] + edges[k + 1]) / 2), 3), int(len(mid))


def microtiming(onsets, beat, phase, subdiv):
    """Distance of each onset to the nearest subdivision line, in ms."""
    if not len(onsets):
        return None
    step = beat / subdiv
    dev_ms = []
    for t in onsets:
        rel = (t - phase) % step
        d = min(rel, step - rel)
        dev_ms.append(d * 1000)
    dev = np.array(dev_ms)
    return {
        'median_ms': round(float(np.median(dev)), 1),
        'mean_ms': round(float(dev.mean()), 1),
        'p90_ms': round(float(np.percentile(dev, 90)), 1),
        'within_20ms_pct': round(float((dev <= 20).mean() * 100), 1),
        'note': 'distance to the nearest line of a grid built from the assumed pulse; '
                'a large median means either loose playing or a wrong pulse',
    }


def syncopation(onsets, beat, phase):
    """Share of onsets that do not land on a beat (within 25 ms)."""
    if not len(onsets):
        return None
    on = 0
    for t in onsets:
        rel = (t - phase) % beat
        d = min(rel, beat - rel)
        if d * 1000 <= 25:
            on += 1
    return {
        'onsets': int(len(onsets)),
        'on_beat_pct': round(on / len(onsets) * 100, 1),
        'off_beat_pct': round((1 - on / len(onsets)) * 100, 1),
        'note': 'off-beat share is a coarse syncopation proxy: it counts position, not accent',
    }


def bar_patterns(onsets, beat, phase, subdiv, bar_s, steps_per_bar=0):
    """Fold onsets into the bar; describe the pattern and how repetitive it is."""
    if not len(onsets) or bar_s <= 0:
        return None
    steps = steps_per_bar if steps_per_bar else subdiv * 4
    step = bar_s / steps
    if steps < 4 or steps > 64:
        steps, step = 12, bar_s / 12
    start = phase
    bars = {}
    for t in onsets:
        if t < start:
            continue
        b = int((t - start) // bar_s)
        pos = ((t - start) % bar_s) / step
        k = int(pos) % steps
        bars.setdefault(b, set()).add(k)
    if not bars:
        return None
    vectors = []
    for b in sorted(bars):
        v = np.zeros(steps)
        for k in bars[b]:
            v[k] = 1
        vectors.append(v)
    # consecutive similarity
    sims = []
    for a, b in zip(vectors, vectors[1:]):
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        if na and nb:
            sims.append(float(a @ b / (na * nb)))
    # most common pattern
    keys = {}
    for v in vectors:
        k = ''.join('x' if x else '.' for x in v)
        keys[k] = keys.get(k, 0) + 1
    top = sorted(keys.items(), key=lambda kv: -kv[1])[:3]
    return {
        'steps_per_bar': steps,
        'step_ms': round(step * 1000, 1),
        'bars_analysed': len(vectors),
        'distinct_patterns': len(keys),
        'most_common': [{'pattern': k, 'bars': c} for k, c in top],
        'consecutive_similarity_mean': round(float(np.mean(sims)), 3) if sims else None,
        'note': 'pattern is onset presence only (no accent); similarity is cosine between '
                'adjacent bars, so a high value means a looping groove, a low one means variation',
    }


def section_loudness(path, sections, bar_s=0.0):
    """Integrated LUFS and true peak per section, measured by ffmpeg ebur128."""
    out = []
    for s in sections:
        t0 = s.get('t_s', s.get('start_s'))
        dur = s.get('seconds', s.get('duration_s'))
        if t0 is None and s.get('bar0') is not None and bar_s:
            t0 = (s['bar0'] - 1) * bar_s
        if t0 is None or not dur or dur < 0.4:
            continue
        cmd = ['ffmpeg', '-hide_banner', '-nostats', '-ss', f'{t0:.3f}', '-t', f'{dur:.3f}',
               '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-']
        p = subprocess.run(cmd, capture_output=True, text=True)
        txt = p.stderr
        i_lufs = re.findall(r'I:\s*(-?\d+\.\d+)\s*LUFS', txt)
        tpk = re.findall(r'True peak:\s*Peak:\s*(-?\d+\.\d+)\s*dBFS', txt)
        out.append({
            'label': s.get('label') or f"{s.get('bar0')}-{s.get('bar1')}",
            't_s': round(float(t0), 2),
            'seconds': round(float(dur), 2),
            'lufs': float(i_lufs[-1]) if i_lufs else None,
            'true_peak_dbfs': float(tpk[-1]) if tpk else None,
        })
    vals = [x['lufs'] for x in out if x['lufs'] is not None]
    peaks = [x['true_peak_dbfs'] for x in out if x['true_peak_dbfs'] is not None]
    return {
        'sections': out,
        'lufs_range': {'min': min(vals), 'max': max(vals), 'spread_lu': round(max(vals) - min(vals), 1)} if vals else None,
        'true_peak_max_dbfs': max(peaks) if peaks else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', required=True)
    ap.add_argument('--drums', required=True)
    ap.add_argument('--bpm', type=float, required=True)
    ap.add_argument('--subdiv', type=int, default=3, choices=[2, 3, 4])
    ap.add_argument('--bar-s', type=float, default=0.0)
    ap.add_argument('--steps-per-bar', type=int, default=0,
                    help='grid steps per bar; default subdiv*4 (4/4). Use 6 for a 6/8 bar.')
    ap.add_argument('--band', default='', help='low|mid|<lo>-<hi> Hz for onset detection')
    ap.add_argument('--sections', default=None, help='arrangement JSON for per-section loudness')
    ap.add_argument('--mix', default=None, help='mix file: section loudness measured on the mix too')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    band = None
    if a.band == 'low':
        band = (35.0, 160.0)
    elif a.band == 'mid':
        band = (200.0, 2000.0)
    elif '-' in a.band:
        lo, hi = a.band.split('-')
        band = (float(lo), float(hi))
    y, sr = load_mono(a.drums, band=band)
    onsets, env = onsets_of(y, sr)
    beat = 60.0 / a.bpm
    phase = best_phase(onsets, beat, env, sr)

    result = {
        'target': a.name,
        'file': a.drums.split('/')[-1],
        'assumed_pulse': {'bpm': a.bpm, 'beat_s': round(beat, 4),
                          'subdivision': a.subdiv,
                          'onset_band_hz': band,
                          'grid_phase_s': round(phase, 4),
                          'note': 'the pulse is an input hypothesis from analyze-meter.py, not a tracker output'},
        'onset_count': int(len(onsets)),
        'beat': {'phase_histogram_pct': phase_histogram(onsets, beat, phase)[0],
                 'bins': '12 bins per beat: 0 = on the beat, 4 = 1/3, 6 = 1/2, 8 = 2/3'},
        'swing': None,
        'syncopation': syncopation(onsets, beat, phase),
        'microtiming': microtiming(onsets, beat, phase, a.subdiv),
    }
    sw, n = swing_ratio(onsets, beat, phase)
    result['swing'] = {
        'first_offbeat_position': sw,
        'sample_onsets': n,
        'straight_is': 0.5, 'triplet_is': 0.667,
        'reading': None if sw is None else (
            'straight' if abs(sw - 0.5) < 0.05 else
            'triplet swing' if abs(sw - 0.667) < 0.05 else
            'between straight and triplet' if 0.5 < sw < 0.667 else 'other'),
    }
    if a.bar_s > 0:
        result['bars'] = bar_patterns(onsets, beat, phase, a.subdiv, a.bar_s, a.steps_per_bar)
    if a.sections:
        arr = json.load(open(a.sections))
        secs = arr.get('sections', [])
        bar_s = arr.get('bar_seconds', a.bar_s)
        # Two readings on purpose: the stem shows arrangement decisions (this layer
        # comes and goes), the mix shows what the listener actually hears.
        result['loudness_by_section_stem'] = section_loudness(a.drums, secs, bar_s)
        if a.mix:
            result['loudness_by_section_mix'] = section_loudness(a.mix, secs, bar_s)

    with open(a.out, 'w') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"wrote {a.out}")
    print(f"  pulse {a.bpm} BPM · onsets {len(onsets)} · swing {sw} · "
          f"off-beat {result['syncopation']['off_beat_pct']}% · "
          f"microtiming median {result['microtiming']['median_ms']} ms")


if __name__ == '__main__':
    sys.exit(main())
