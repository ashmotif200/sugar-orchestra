#!/usr/bin/env python3
"""
Meter test: binary (2/4, 4/4) or ternary (6/8, 12/8)?

Why this exists, and what failed before
---------------------------------------
No tempo estimate can answer this. Two grids share a bar period and differ only
in subdivision — exactly the 6/8-vs-3/4-vs-4/4-ternary confusion the brief warns
about. Three earlier attempts are documented so nobody repeats them:

  v1  strongest onset-envelope autocorrelation peak taken as "the bar". That peak
      is often a hypermetric cycle (6 beats), so 4/4 music got labelled ternary.
  v2  walked up from a detected tatum, but the detected pulse level was arbitrary
      (16th here, 8th there), so multiples were not comparable across tracks.
  v3  inter-onset-interval histogram. Dense percussion puts an onset on nearly
      every fast pulse (50–65 % of intervals were 1 unit), which hides grouping.

v4 asks the question the way a musician does: WHERE inside the beat do the
onsets fall? Ternary music subdivides the beat in three (onsets near 1/3 and 2/3);
binary music subdivides in two (onsets near 1/2). That is a phase histogram, it is
insensitive to the tatum level, and it is comparable across tracks.

    python3 scripts/phase-a/analyze-meter.py --name dansant --mix M --drums D --out O.json
"""
import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np

HOP = 256
BPM_LO, BPM_HI = 55.0, 190.0     # musical beat range; keeps the tatum out
PHASE_BINS = 12


def onset_data(path):
    y, sr = librosa.load(str(path), sr=None, mono=True)
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    return y, sr, env


def tempo_from_ac(env, sr, top=3):
    """Beat tempo from onset-envelope autocorrelation, restricted to a musical range."""
    e = env - env.mean()
    if e.size < 32 or not np.any(e):
        return None, []
    ac = np.correlate(e, e, mode="full")[e.size - 1:]
    ac = ac / ac[0]
    lags = np.arange(ac.size)
    with np.errstate(divide="ignore"):
        bpm_of_lag = 60.0 * sr / (HOP * np.maximum(lags, 1))
    band = (bpm_of_lag >= BPM_LO) & (bpm_of_lag <= BPM_HI)
    idx = np.where(band)[0]
    if idx.size < 3:
        return None, []
    order = idx[np.argsort(ac[idx])[::-1]]
    picked = []
    for i in order:
        bpm = float(bpm_of_lag[i])
        if any(abs(bpm - p["bpm"]) / p["bpm"] < 0.04 for p in picked):
            continue
        picked.append({"bpm": round(bpm, 2), "ac": round(float(ac[i]), 4)})
        if len(picked) >= top:
            break
    return picked[0]["bpm"] if picked else None, picked


def phase_histogram(onsets, beats):
    """Onset phase inside each beat, 12 bins. 0 = on the beat."""
    phases = []
    for b0, b1 in zip(beats[:-1], beats[1:]):
        span = b1 - b0
        if span <= 0.05:
            continue
        inside = onsets[(onsets > b0) & (onsets < b1)]
        phases.extend(list((inside - b0) / span))
    if not phases:
        return None, 0
    ph = np.array(phases)
    hist, _ = np.histogram(ph, bins=PHASE_BINS, range=(0, 1))
    total = hist.sum()
    return [round(float(h) / total * 100, 1) for h in hist], int(len(ph))


def folded_bar_pattern(onsets, sr, env):
    """Fold drum onsets into the strongest bar period and print the pattern.

    This is the measurement a musician reads instantly: which 24ths of the bar
    carry hits. It also settles the meter question better than any derived index,
    because 6/8 shows hits on 4-step groups and 4/4 on 3- or 6-step groups.
    """
    e = env - env.mean()
    ac = np.correlate(e, e, mode="full")[e.size - 1:]
    ac = ac / ac[0]
    lo, hi = int(1.2 * sr / HOP), min(int(4.6 * sr / HOP), ac.size - 1)
    if hi <= lo:
        return None
    P = (lo + int(np.argmax(ac[lo:hi]))) * HOP / sr
    bins = np.zeros(24)
    for t in onsets:
        bins[int((t % P) / P * 24) % 24] += 1
    total = bins.sum()
    pct = [round(float(b) / total * 100, 1) for b in bins] if total else [0.0] * 24
    # where do the hits concentrate, in 24ths of the bar?
    top = sorted(range(24), key=lambda i: pct[i], reverse=True)[:8]
    return {"bar_period_s": round(P, 4), "pattern_24ths_pct": pct,
            "strongest_24ths": sorted(top),
            "strongest_24ths_pct": [pct[i] for i in sorted(top)]}


def bpm_grid_search(env, sr, onsets, candidates):
    """Score explicit BPM hypotheses. The true beat gives the steadiest grid.

    A tempo picker that chooses by autocorrelation strength alone keeps landing on
    3:2 relatives of the real pulse (measured here: 91.5 for a 134 BPM track,
    103.4 for a ~155 one). Forcing each candidate and measuring how regular the
    resulting grid is separates them: a wrong tempo produces a wobbly grid, a
    right one produces an even one.
    """
    rows = []
    for bpm in candidates:
        tempo, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=HOP,
                                               bpm=bpm, trim=False)
        bt = librosa.frames_to_time(beats, sr=sr, hop_length=HOP)
        if len(bt) < 8:
            continue
        ibi = np.diff(bt)
        hist, _ = phase_histogram(onsets, bt)
        concentration = max(hist) if hist else 0.0
        rows.append({
            "bpm": round(float(bpm), 2),
            "ibi_std_ms": round(float(np.std(ibi)) * 1000, 1),
            "phase_concentration_pct": round(concentration, 1),
            "onsets_at_downbeat_pct": round(hist[0], 1) if hist else None,
        })
    if not rows:
        return {}
    best = min(rows, key=lambda r: (r["ibi_std_ms"], -r["phase_concentration_pct"]))
    return {"candidates": rows, "steadiest": best["bpm"],
            "rule": "steadiest grid = lowest inter-beat-interval standard deviation"}


def analyse(path, label):
    y, sr, env = onset_data(path)
    bpm, cands = tempo_from_ac(env, sr)
    if not bpm:
        return {"source": label, "error": "no tempo in the 55–190 BPM range"}
    tempo, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=HOP,
                                           bpm=bpm, trim=False)
    beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=HOP)
    onsets = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP,
                                        units="time", backtrack=False)
    hist, n = phase_histogram(onsets, beat_times)
    if hist is None:
        return {"source": label, "error": "no onsets between beats"}

    # bins: 0 = downbeat, 3 = 1/4 beat, 4 = 1/3 beat, 6 = 1/2 beat, 8 = 2/3 beat
    on_beat = hist[0] + hist[11]
    binary_sub = hist[6]            # 1/2
    ternary_sub = hist[4] + hist[8]  # 1/3 and 2/3
    ratio = round(ternary_sub / binary_sub, 2) if binary_sub > 0 else None

    if ternary_sub >= 8.0 and (ratio is None or ratio >= 1.3):
        verdict = "ternary"
    elif binary_sub >= 8.0 and ratio is not None and ratio <= 0.77:
        verdict = "binary"
    else:
        verdict = "ambiguous"

    # bar hypothesis: 3 beats per bar vs 4 beats per bar, via envelope autocorrelation
    e = env - env.mean()
    ac = np.correlate(e, e, mode="full")[e.size - 1:]
    ac = ac / ac[0]
    beat_frames = HOP and (60.0 / bpm) * sr / HOP
    def at(mult):
        i = int(round(beat_frames * mult))
        return round(float(np.max(ac[max(1, i - 1):i + 2])), 3) if 0 < i < ac.size else 0.0
    ac_3, ac_4, ac_6, ac_8 = at(3), at(4), at(6), at(8)

    ibi = np.diff(beat_times)
    folded = folded_bar_pattern(onsets, sr, env)
    raw = [c["bpm"] for c in cands]
    expanded = set()
    for b in raw:
        for f in (1.0, 1.5, 2 / 3, 2.0, 0.5, 3.0, 1 / 3):
            v = round(b * f, 2)
            if BPM_LO <= v <= BPM_HI:
                expanded.add(v)
    grid = bpm_grid_search(env, sr, onsets, sorted(expanded))
    return {
        "source": label,
        "beat_bpm": round(float(np.atleast_1d(tempo)[0]), 2),
        "tempo_candidates": cands,
        "beat_count": int(len(beat_times)),
        "beat_interval_ms": {"mean": round(float(np.mean(ibi)) * 1000, 1) if ibi.size else None,
                             "std": round(float(np.std(ibi)) * 1000, 1) if ibi.size else None},
        "onset_phase_histogram_pct": hist,
        "onsets_in_histogram": n,
        "on_beat_pct": round(on_beat, 1),
        "binary_subdivision_pct": round(binary_sub, 1),
        "ternary_subdivision_pct": round(ternary_sub, 1),
        "ternary_over_binary": ratio,
        "ac_3_beats": ac_3, "ac_4_beats": ac_4, "ac_6_beats": ac_6, "ac_8_beats": ac_8,
        "bar_hypothesis": ("3 beats per bar (ac 3 > ac 4)" if ac_3 > ac_4
                           else "4 beats per bar (ac 4 >= ac 3)"),
        "verdict": verdict,
        "rule": ("ternary if onsets at 1/3 and 2/3 of the beat >= 8% AND >= 1.3x those at "
                 "1/2; binary if the 1/2 share >= 8% AND <= 0.77x; else ambiguous"),
        "phase_bin_meaning": "12 bins per beat: 0=downbeat, 4=1/3, 6=1/2, 8=2/3",
        "folded_bar_pattern": folded,
        "bpm_grid_search": grid,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--mix", required=True)
    ap.add_argument("--drums")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    for p in (a.mix, a.drums):
        if p and not Path(p).exists():
            sys.exit(f"missing: {p}")

    targets = []
    if a.drums:
        targets.append(analyse(a.drums, "drums"))
    targets.append(analyse(a.mix, "mix"))
    res = {"universe": a.name, "beat_range_bpm": [BPM_LO, BPM_HI], "targets": targets}
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=2))
    for t in res["targets"]:
        if "error" in t:
            print(f"{t['source']:6s} {t['error']}")
            continue
        h = t["onset_phase_histogram_pct"]
        print(f"{t['source']:6s} {t['beat_bpm']:.2f} BPM  bar={t['bar_hypothesis'].split('(')[0].strip()}  "
              f"phase[0,4,6,8]={h[0]},{h[4]},{h[6]},{h[8]}  "
              f"on={t['on_beat_pct']}% bin={t['binary_subdivision_pct']}% "
              f"tern={t['ternary_subdivision_pct']}% ratio={t['ternary_over_binary']} "
              f"-> {t['verdict']}")
        fb = t.get("folded_bar_pattern")
        if fb:
            print(f"       bar {fb['bar_period_s']}s  24ths% = "
                  + " ".join(f"{v:4.1f}" for v in fb["pattern_24ths_pct"]))
            print(f"       strongest 24ths: {fb['strongest_24ths']}")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
