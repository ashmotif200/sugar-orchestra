#!/usr/bin/env python3
"""
Phase A3 — reference composition analysis (stems + mix).

Ready to run the moment the reference files exist. It was validated on the
synthetic stems from `make-synthetic-reference.py`, which have known ground
truth (88 BPM, D minor, 8 bars, stems aligned at offset 0, mix = sum of stems).

    /opt/data/tools/sugar-audio/renv/analysis/bin/python scripts/phase-a/analyze-reference.py \
        --mix "/path/zistoire mix v0.wav" \
        --drums "/path/Zistwar-drums.wav" \
        --bass "/path/Zistwar-bass.wav" \
        --other "/path/Zistwar-other.wav" \
        --out docs/phase-a/data/reference-detendue.json

Design rules that matter for honesty:
  * tempo is reported as MULTIPLE hypotheses with the evidence for each, never
    as one authoritative BPM;
  * every limit is stated in the output itself;
  * pitch is reported with its prevalence, and notes are not invented where the
    estimator is not confident.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import librosa
import numpy as np


def _clean(o):
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    return o


def lufs(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                        "-filter_complex", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    tail = p.stderr[p.stderr.rfind("Summary:"):] if "Summary:" in p.stderr else ""
    for line in tail.splitlines():
        if "I:" in line and "LUFS" in line:
            try:
                return float(line.split("I:")[1].split("LUFS")[0].strip())
            except ValueError:
                return None
    return None


def basic(path):
    y, sr = librosa.load(str(path), sr=None, mono=False)
    mono = librosa.to_mono(y) if y.ndim > 1 else y
    rms = float(np.sqrt(np.mean(mono ** 2)))
    peak = float(np.max(np.abs(mono)))
    return {
        "file": Path(path).name,
        "duration_s": round(mono.size / sr, 4),
        "sample_rate": int(sr),
        "channels": 1 if y.ndim == 1 else int(y.shape[0]),
        "peak_db": round(20 * np.log10(max(peak, 1e-12)), 2),
        "rms_db": round(20 * np.log10(max(rms, 1e-12)), 2),
        "lufs_integrated": lufs(path),
        "_y": mono, "_sr": sr,
    }


def onset_env(y, sr):
    return librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)


def tempo_hypotheses(y, sr, top=4):
    """Multiple candidates from the tempogram, with their relative support."""
    env = onset_env(y, sr)
    tg = librosa.feature.tempogram(onset_envelope=env, sr=sr, hop_length=256)
    freqs = librosa.tempo_frequencies(tg.shape[0], sr=sr, hop_length=256)
    profile = np.mean(tg, axis=1)
    mask = (freqs >= 40) & (freqs <= 220)
    idx = np.where(mask)[0]
    order = idx[np.argsort(profile[idx])[::-1]]
    picked, out = [], []
    for i in order:
        bpm = float(freqs[i])
        if any(abs(bpm - p) / p < 0.04 for p in picked):  # merge near-duplicates
            continue
        picked.append(bpm)
        out.append({"bpm": round(bpm, 2), "support": round(float(profile[i] / profile[idx].max()), 3)})
        if len(out) >= top:
            break
    env_bpm = float(np.atleast_1d(librosa.feature.rhythm.tempo(
        onset_envelope=env, sr=sr, hop_length=256))[0])
    return {"tempogram_candidates": out, "librosa_global_bpm": round(env_bpm, 2),
            "note": "candidates within 4% are merged; the strongest candidate is not "
                    "automatically the musical tempo"}


def beat_grid(y, sr):
    env = onset_env(y, sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=256,
                                           trim=False)
    times = librosa.frames_to_time(beats, sr=sr, hop_length=256)
    ibi = np.diff(times) * 1000 if len(times) > 1 else np.array([])
    return {
        "bpm": round(float(np.atleast_1d(tempo)[0]), 2),
        "beat_count": int(len(times)),
        "beat_times_s": [round(float(t), 3) for t in times[:64]],
        "interbeat_interval_ms": {"mean": round(float(np.mean(ibi)), 1) if ibi.size else None,
                                  "std": round(float(np.std(ibi)), 1) if ibi.size else None},
        "microtiming_note": "std above is beat-tracker regularity, not performed microtiming",
    }


def swing_and_syncopation(y, sr):
    """Swing from the ratio of successive off-beat gaps; syncopation from onset/beat phase."""
    env = onset_env(y, sr)
    onsets = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=256, units="time")
    _, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=256, trim=False)
    bt = librosa.frames_to_time(beats, sr=sr, hop_length=256)
    if len(bt) < 5 or len(onsets) < 8:
        return {"swing_ratio": None, "syncopation": None,
                "note": "too few beats/onsets for a stable estimate"}
    pairs, sync = [], 0
    for b0, b1 in zip(bt[:-1], bt[1:]):
        inside = onsets[(onsets > b0) & (onsets < b1)]
        if len(inside) >= 2:
            pairs.append((inside[0] - b0) / (b1 - b0))
        if len(inside) >= 1:
            sync += 1
    frac = float(np.median(pairs)) if pairs else None
    return {
        "first_offbeat_position": round(frac, 3) if frac is not None else None,
        "straight_would_be": 0.5,
        "swing_reading": ("straight" if frac and abs(frac - 0.5) < 0.04
                          else "notably swung" if frac and frac > 0.56
                          else "slightly early/late" if frac else None),
        "beats_with_onsets_between": f"{sync}/{len(bt) - 1}",
        "note": "ratio is measured against a tracker's grid, so it inherits grid error",
    }


def bass_analysis(path, sr_ref):
    y, sr = librosa.load(str(path), sr=sr_ref, mono=True)
    env = onset_env(y, sr)
    onsets = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=256, units="time")
    # 4096 samples: at 44.1 kHz a 2048 frame holds <2 periods of a 40 Hz bass note.
    f0, vf, vp = librosa.pyin(y, fmin=32, fmax=400, sr=sr, frame_length=4096,
                              hop_length=256, fill_na=np.nan)
    times = librosa.times_like(f0, sr=sr, hop_length=256)
    notes = []
    for t_on in onsets:
        near = (times >= t_on) & (times < t_on + 0.25)
        vals = f0[near]
        vals = vals[np.isfinite(vals)]
        if vals.size == 0:
            notes.append({"time_s": round(float(t_on), 3), "pitch_hz": None, "midi": None})
            continue
        hz = float(np.median(vals))
        notes.append({"time_s": round(float(t_on), 3), "pitch_hz": round(hz, 1),
                      "midi": int(round(librosa.hz_to_midi(hz)))})
    pitched = [n for n in notes if n["midi"] is not None]
    intervals = [b["midi"] - a["midi"] for a, b in zip(pitched[:-1], pitched[1:])]
    return {
        "onset_count": int(len(onsets)),
        "notes": notes[:48],
        "notes_pitched": len(pitched),
        "interval_sequence_semitones": intervals[:48],
        "motif_note": ("repeated interval subsequences would indicate a motif; "
                       "this list is the raw material, not a transcription"),
        "voiced_prevalence": round(float(np.mean(vf.astype(float))), 3),
        "limitation": "pyin on a bass stem is reliable when the line is monophonic; "
                      "with octave doubling or distortion read the cents spread before trusting midi",
    }


def harmony_analysis(path, sr_ref):
    y, sr = librosa.load(str(path), sr=sr_ref, mono=True)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    prof = np.mean(chroma, axis=1)
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    order = np.argsort(prof)[::-1]
    # Krumhansl-Schmuckler correlation for major and minor profiles
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    best = []
    for mode, ref in (("major", major), ("minor", minor)):
        for root in range(12):
            r = np.corrcoef(np.roll(ref, root), prof)[0, 1]
            best.append({"key": f"{names[root]} {mode}", "correlation": round(float(r), 3)})
    best.sort(key=lambda d: -d["correlation"])
    novelty = librosa.onset.onset_strength(S=librosa.power_to_db(
        librosa.feature.melspectrogram(y=y, sr=sr) ** 2), sr=sr)
    changes = librosa.frames_to_time(
        librosa.onset.onset_detect(onset_envelope=novelty, sr=sr, units="frames"),
        sr=sr).tolist()
    return {
        "top_key_candidates": best[:3],
        "chroma_profile": [round(float(x), 3) for x in prof],
        "chroma_novelty_times_s": [round(float(t), 2) for t in changes[:40]],
        "limitation": "key correlation on a drone or a single chord is not a key; "
                      "read the top-3 with their correlations, not just the winner",
    }


def arrangement_timeline(path, sr_ref, bpm):
    y, sr = librosa.load(str(path), sr=sr_ref, mono=True)
    bar = 4 * 60.0 / bpm
    n_bars = int(np.floor(len(y) / sr / bar))
    rows = []
    for b in range(n_bars):
        seg = y[int(b * bar * sr):int((b + 1) * bar * sr)]
        if seg.size == 0:
            continue
        env = onset_env(seg, sr)
        rms = float(np.sqrt(np.mean(seg ** 2)))
        rows.append({"bar": b + 1,
                     "t_s": round(b * bar, 2),
                     "rms_db": round(20 * np.log10(max(rms, 1e-12)), 1),
                     "onset_rate_per_s": round(len(librosa.onset.onset_detect(
                         onset_envelope=env, sr=sr, hop_length=256)) / bar, 2)})
    return {"bar_seconds": round(bar, 3), "bars": rows}


def align_and_reconstruct(stems, mix):
    """Stem alignment (onset cross-correlation) and whether mix == sum(stems)."""
    sr = mix["_sr"]
    mix_y = mix["_y"]
    out = {}
    for name, s in stems.items():
        y = librosa.resample(s["_y"], orig_sr=s["_sr"], target_sr=sr) if s["_sr"] != sr else s["_y"]
        n = min(len(y), len(mix_y))
        e_stem = onset_env(y[:n], sr)
        e_mix = onset_env(mix_y[:n], sr)
        m = min(len(e_stem), len(e_mix))
        a = e_stem[:m] - e_stem[:m].mean()
        b = e_mix[:m] - e_mix[:m].mean()
        # Search only +/-0.5 s. On a periodic signal the unrestricted argmax lands
        # on any beat-period multiple and reports a fake offset (measured: 1422 ms
        # for perfectly aligned synthetic stems).
        max_lag = int(0.5 * sr / 256)
        best_lag, best_score = 0, -np.inf
        ref = b
        for lag in range(-max_lag, max_lag + 1):
            shifted = np.roll(a, lag)
            score = float(np.dot(shifted, ref))
            if score > best_score + 1e-9:
                best_score, best_lag = score, lag
        lag = best_lag
        out[f"{name}_offset_ms"] = round(lag * 256 / sr * 1000, 1)
        out[f"{name}_sample_count_delta"] = int(len(y) - len(mix_y))
    total = np.zeros(len(mix_y))
    for name, s in stems.items():
        y = librosa.resample(s["_y"], orig_sr=s["_sr"], target_sr=sr) if s["_sr"] != sr else s["_y"]
        total[:min(len(y), len(total))] += y[:min(len(y), len(total))]
    n = min(len(total), len(mix_y))
    if n > 0 and np.std(total[:n]) > 0 and np.std(mix_y[:n]) > 0:
        c = float(np.corrcoef(total[:n], mix_y[:n])[0, 1])
        gain = float(np.std(mix_y[:n]) / max(np.std(total[:n]), 1e-12))
    else:
        c, gain = 0.0, 0.0
    out["sum_vs_mix_correlation"] = round(c, 4)
    out["mix_over_sum_gain"] = round(gain, 4)
    # Reconstruction means the mix has the same SHAPE as the sum of stems. A
    # constant gain is normal (mixes are gain-staged); a gain of exactly 1 is not
    # required and insisting on it produced a false negative on the synthetic set.
    out["reconstructs"] = bool(c >= 0.98)
    out["note"] = ("offset search limited to +/-0.5 s; a non-zero offset means the "
                   "stems are not sample-aligned. Gain is mix/sum level ratio: any "
                   "constant value means the mix is the sum, scaled.")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mix", required=True)
    ap.add_argument("--drums")
    ap.add_argument("--bass")
    ap.add_argument("--other")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    t0 = time.time()
    for p in [a.mix, a.drums, a.bass, a.other]:
        if p and not Path(p).exists():
            sys.exit(f"missing file: {p}")

    files = {"mix": basic(a.mix)}
    stems = {}
    for name in ("drums", "bass", "other"):
        p = getattr(a, name)
        if p:
            stems[name] = basic(p)

    sr = files["mix"]["_sr"]
    result = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tool": {"librosa": librosa.__version__, "numpy": np.__version__},
        "files": {name: {k: v for k, v in d.items() if not k.startswith("_")}
                  for name, d in {**files, **stems}.items()},
        "technical": {},
        "rhythm": {},
        "bass": {},
        "harmony": {},
        "arrangement": {},
        "limits": [
            "tempo is a set of hypotheses, not a verdict",
            "key correlation is meaningless on unpitched/drone material",
            "beat grid is an estimate; swing and syncopation inherit its error",
            "no transcription is produced: pitch lists are measurements",
        ],
    }
    if stems:
        result["technical"]["stem_alignment_and_reconstruction"] = align_and_reconstruct(stems, files["mix"])

    result["rhythm"] = {"mix": tempo_hypotheses(files["mix"]["_y"], sr),
                        "beat": beat_grid(files["mix"]["_y"], sr),
                        "swing_syncopation": swing_and_syncopation(files["mix"]["_y"], sr)}
    if "drums" in stems:
        result["rhythm"]["drums_only"] = tempo_hypotheses(stems["drums"]["_y"], stems["drums"]["_sr"])
    if "bass" in stems:
        result["bass"]["stem"] = bass_analysis(a.bass, sr)
    if "other" in stems:
        result["harmony"]["other_stem"] = harmony_analysis(a.other, sr)

    bpm = result["rhythm"]["beat"]["bpm"]
    result["arrangement"]["mix_timeline"] = arrangement_timeline(a.mix, sr, bpm)
    if "drums" in stems:
        result["arrangement"]["drums_timeline"] = arrangement_timeline(a.drums, sr, bpm)
    if "bass" in stems:
        result["arrangement"]["bass_timeline"] = arrangement_timeline(a.bass, sr, bpm)

    result["elapsed_s"] = round(time.time() - t0, 1)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(_clean(result), indent=2, ensure_ascii=False))
    print(f"wrote {out} in {result['elapsed_s']}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
