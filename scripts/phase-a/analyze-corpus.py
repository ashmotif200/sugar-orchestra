#!/usr/bin/env python3
"""
Phase A4 corpus measurement — Sugar Orchestra museum sounds.

Measures every master in assets/originals/ and writes machine-readable JSON.
Read-only on the masters; output goes to docs/phase-a/data/.

Run with the toolchain interpreter (librosa lives there, not in the project):

    /opt/data/tools/sugar-audio/renv/analysis/bin/python scripts/phase-a/analyze-corpus.py

Every number here is measured. The `role_hypotheses` block is explicitly a
hypothesis layer with its rule stated, not a musical verdict — the brief for
Phase A is clear that only listening confirms usability.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ORIGINALS = ROOT / "assets" / "originals"
OUT_DIR = ROOT / "docs" / "phase-a" / "data"
CATALOG = ROOT / "src" / "data" / "catalog.json"

BANDS = [(0, 80), (80, 250), (250, 2000), (2000, 8000), (8000, 16000)]


def _clean(o):
    """numpy scalars are not JSON-serialisable; convert recursively."""
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
    """EBU R128 integrated loudness via ffmpeg; None if the filter is unavailable."""
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
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


def band_energies(S, freqs, total):
    out = {}
    for lo, hi in BANDS:
        idx = np.where((freqs >= lo) & (freqs < hi))[0]
        share = float(np.sum(S[idx])) / total if total > 0 else 0.0
        out[f"{lo}-{hi}Hz"] = round(share * 100, 1)
    return out


def pulse_strength(onset_env, sr, hop):
    """Normalised autocorrelation peak in the 60–180 BPM lag range.

    High value = the sound has a repeating pulse at some musical tempo.
    Low value = onsets are irregular or there are too few of them.
    """
    if onset_env.size < 32 or np.max(onset_env) <= 0:
        return 0.0, None
    env = onset_env - np.mean(onset_env)
    ac = np.correlate(env, env, mode="full")[env.size - 1:]
    if ac[0] <= 0:
        return 0.0, None
    ac = ac / ac[0]
    lags = (60.0 / np.array([180.0, 60.0])) * sr / hop  # lag range for 180..60 BPM
    lo, hi = int(min(lags)), int(max(lags))
    if hi >= ac.size:
        return 0.0, None
    seg = ac[lo:hi]
    if seg.size == 0:
        return 0.0, None
    k = int(np.argmax(seg))
    lag = lo + k
    bpm = 60.0 * sr / (hop * lag)
    return float(seg[k]), float(bpm)


def pitch_block(y, sr):
    """Dominant pitch, and how much of the voiced time actually agrees with it.

    pyin rather than yin: at 32 kHz a 2048-sample frame holds <2 cycles of a
    50 Hz rumble, so yin reports nonsense down there. A 4096-sample frame plus
    pyin's probability output is the honest option, and `prevalence` answers the
    only question that matters here — is there ONE pitch, or many?
    """
    # pyin over the loudest 8 s at 16 kHz: same musical question, ~4x cheaper
    # than 20 s at 32 kHz, and 2048 samples still holds 5 cycles of 40 Hz.
    if len(y) > 8 * sr:
        e = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
        win = max(1, int(8 * sr / 512))
        cs = np.convolve(e, np.ones(win), mode="valid")
        start = int(np.argmax(cs)) * 512 if cs.size else 0
        y = y[start:start + 8 * sr]
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y16, fmin=40, fmax=1000, sr=16000, frame_length=2048, hop_length=256,
        fill_na=np.nan)
    f0v = f0[np.isfinite(f0)]
    if f0v.size < 4:
        return {"median_hz": None, "prevalence": 0.0, "voiced_ratio": 0.0,
                "mean_voiced_prob": 0.0, "voiced_frames": int(f0v.size),
                "periodicity": 0.0}
    med = float(np.median(f0v))
    cents = 1200 * np.log2(np.maximum(f0v, 1e-9) / med)
    prevalence = float(np.mean(np.abs(cents) <= 50))

    # Periodicity = normalised autocorrelation at the f0 lag, per frame, median
    # over voiced frames. Calibrated on known material: pure 440 Hz sine 0.98,
    # saw bass 0.89, white noise 0.02, whip burst 0.02.
    #
    # A first attempt measured "share of magnitude on the harmonic series" and
    # reported 0.44 for a PURE SINE — because summing magnitudes across 1024 bins
    # is dominated by the noise floor. It would have declared the whole corpus
    # unpitched on a broken metric. Autocorrelation does not have that failure mode.
    win, hop = 2048, 256
    n = min(len(f0), 1 + max(0, (len(y16) - win) // hop))
    per = []
    for i in range(n):
        f = f0[i]
        if not np.isfinite(f) or f <= 0:
            continue
        lag = int(round(16000.0 / f))
        if lag < 3 or lag >= win // 2:
            continue
        fr = y16[i * hop:i * hop + win]
        if len(fr) < win:
            break
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, mode="full")[win - 1:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        lo, hi = max(1, lag - 1), min(len(ac), lag + 2)
        per.append(float(np.max(ac[lo:hi])))
    periodicity = float(np.median(per)) if per else 0.0
    return {
        "median_hz": round(med, 1),
        "prevalence": round(prevalence, 3),
        "voiced_ratio": round(float(np.mean(voiced_flag.astype(float))), 3),
        "mean_voiced_prob": round(float(np.nanmean(voiced_prob)), 3),
        "voiced_frames": int(f0v.size),
        "cents_p10_p90": [round(float(np.percentile(cents, 10)), 1),
                          round(float(np.percentile(cents, 90)), 1)],
        "periodicity": round(periodicity, 3),
    }


def attack_decay(y, sr, onset_env):
    """10–90 % rise time and decay to −20 dB, measured on the strongest onset.

    Cheap proxy for "is this sound's identity in its attack?" — which decides
    whether slicing and pitch-shifting will keep it recognisable.
    """
    if onset_env.size < 4 or np.max(onset_env) <= 0:
        return {"attack_ms": None, "decay_ms": None}
    frame = int(np.argmax(onset_env))
    centre = frame * 512
    lo, hi = max(0, centre - 1024), min(len(y), centre + int(1.0 * sr))
    seg = np.abs(y[lo:hi])
    if seg.size < 32 or np.max(seg) <= 0:
        return {"attack_ms": None, "decay_ms": None}
    pk = int(np.argmax(seg))
    peak_val = seg[pk]
    pre = seg[:pk + 1]
    above10 = np.where(pre >= 0.1 * peak_val)[0]
    above90 = np.where(pre >= 0.9 * peak_val)[0]
    attack_ms = (float(above90[0] - above10[0]) / sr * 1000
                 if above10.size and above90.size else None)
    post = seg[pk:]
    below = np.where(post <= 0.1 * peak_val)[0]  # −20 dB amplitude
    decay_ms = float(below[0]) / sr * 1000 if below.size else float(len(post)) / sr * 1000
    return {"attack_ms": round(attack_ms, 1) if attack_ms is not None else None,
            "decay_ms": round(decay_ms, 1)}


def best_region(y, sr, harmonic, percussive, flatness):
    """The 2 s window that is most tonal and most sustained.

    Score = harmonic share of the window, penalised by its flatness. This is a
    "where is there actually material to grab" measure, not a taste judgement.
    """
    win, hop = int(2.0 * sr), int(0.5 * sr)
    if len(y) < win:
        return None
    best = None
    for start in range(0, len(y) - win + 1, hop):
        sl = slice(start, start + win)
        e = float(np.sum(harmonic[sl] ** 2)) + float(np.sum(percussive[sl] ** 2))
        if e <= 0:
            continue
        h_share = float(np.sum(harmonic[sl] ** 2)) / e
        fl = float(np.mean(flatness[sl]))
        score = h_share * (1.0 - min(fl, 1.0))
        if best is None or score > best["score"]:
            best = {"start_s": round(start / sr, 2),
                    "end_s": round((start + win) / sr, 2),
                    "harmonic_share": round(h_share, 3),
                    "flatness": round(fl, 4),
                    "score": round(score, 3)}
    return best


def analyse(path):
    y, sr = librosa.load(str(path), sr=None, mono=True)
    dur = len(y) / sr
    rms = float(np.sqrt(np.mean(y ** 2)))
    peak = float(np.max(np.abs(y)))

    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    total = float(np.sum(S))
    centroid = float(np.mean(librosa.feature.spectral_centroid(S=S, sr=sr)))
    rolloff = float(np.mean(librosa.feature.spectral_rolloff(S=S, sr=sr, roll_percent=0.95)))
    flatness_f = librosa.feature.spectral_flatness(S=S)
    flatness = float(np.mean(flatness_f))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))

    H, P = librosa.decompose.hpss(S)
    h_e, p_e = float(np.sum(H)), float(np.sum(P))
    h_ratio = h_e / (h_e + p_e) if (h_e + p_e) > 0 else 0.0

    onset_env = librosa.onset.onset_strength(S=librosa.power_to_db(S ** 2), sr=sr)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="time")
    pulse, pulse_bpm = pulse_strength(onset_env, sr, 512)

    pitch = pitch_block(y, sr)

    return {
        "file": Path(path).name,
        "duration_s": round(dur, 3),
        "sample_rate": int(sr),
        "channels": 1,
        "rms_db": round(20 * np.log10(max(rms, 1e-12)), 2),
        "peak_db": round(20 * np.log10(max(peak, 1e-12)), 2),
        "crest_factor_db": round(20 * np.log10(max(peak, 1e-12) / max(rms, 1e-12)), 2),
        "lufs_integrated": lufs(path),
        "spectral": {
            "centroid_hz": round(centroid, 1),
            "rolloff95_hz": round(rolloff, 1),
            "flatness": round(flatness, 5),
            "zcr": round(zcr, 5),
            "band_share_pct": band_energies(S, freqs, total),
        },
        "hpss": {"harmonic_share": round(h_ratio, 3),
                 "percussive_share": round(1 - h_ratio, 3)},
        "rhythm": {
            "onset_count": int(len(onsets)),
            "onset_rate_per_s": round(len(onsets) / dur, 2) if dur else 0,
            "onset_strength_mean": round(float(np.mean(onset_env)), 3),
            "onset_strength_std": round(float(np.std(onset_env)), 3),
            "pulse_strength": round(pulse, 3),
            "pulse_bpm": round(pulse_bpm, 1) if pulse_bpm else None,
        },
        "pitch": pitch,
        "envelope": attack_decay(y, sr, onset_env),
        "best_region": best_region(y, sr, H, P, flatness_f.T if flatness_f.shape[0] == 1 else flatness_f),
    }


def classify(m):
    """Rule-based descriptors. Each label states its rule so it can be argued with."""
    sp, hp, rh, pi = m["spectral"], m["hpss"], m["rhythm"], m["pitch"]
    bands = sp["band_share_pct"]
    low = bands["0-80Hz"] + bands["80-250Hz"]
    high = bands["2000-8000Hz"] + bands["8000-16000Hz"]

    # Thresholds are set from the measured distribution of this corpus
    # (see docs/phase-a/data/corpus-table.txt), not from generic textbook values.
    tonal = bool(hp["harmonic_share"] >= 0.50 and sp["flatness"] <= 0.02)
    noisy = bool(sp["flatness"] >= 0.10)
    transient = bool(rh["onset_rate_per_s"] >= 3.0 and m["crest_factor_db"] >= 12)
    sustained = bool(rh["onset_rate_per_s"] <= 1.0)
    pitched = bool(pi["prevalence"] >= 0.45 and pi["median_hz"] is not None)
    # Credible pitch needs PERIODICITY, not just agreement between few frames:
    # a whip crack gave pyin a 42 Hz "pitch" with 100 % of its 28 voiced frames
    # agreeing, and its periodicity is 0.02.
    credible = bool(pitched and pi["voiced_ratio"] >= 0.30 and pi["periodicity"] >= 0.75)
    # A usable bass needs a STABLE, CREDIBLE PITCH in the bass register — never
    # low-frequency energy alone (a whip crack has plenty of low rumble).
    bass_capable = bool(low >= 45 and credible and pi["median_hz"] <= 220
                        and pi["periodicity"] >= 0.85)
    rhythmic = bool(rh["pulse_strength"] >= 0.25 or rh["onset_rate_per_s"] >= 4)

    roles = []
    if bass_capable:
        roles.append("bass")
    if rhythmic and not tonal:
        roles.append("percussion")
    elif rhythmic and transient:
        roles.append("rhythmic_texture")
    if credible and pi["median_hz"] and pi["median_hz"] > 220 and not bass_capable:
        roles.append("melodic")
    if tonal and sustained:
        roles.append("harmonic_texture")
    if noisy or (high >= 35 and sp["flatness"] >= 0.1):
        roles.append("atmosphere")
    if transient and not roles:
        roles.append("transition")
    if not roles:
        roles.append("narrative_sound_event")

    return {
        "tonal": bool(tonal), "pitched": pitched, "credible_pitch": credible,
        "noisy": bool(noisy),
        "transient_heavy": bool(transient),
        "sustained": bool(sustained), "bass_capable": bool(bass_capable), "rhythmic": bool(rhythmic),
        "low_band_share_pct": round(low, 1), "high_band_share_pct": round(high, 1),
        "role_hypotheses": roles,
        "rules": ("tonal: harmonic_share>=0.50 and flatness<=0.02 | "
                  "pitched: >=45% of voiced frames within +/-50 cents of the dominant pitch | "
                  "credible_pitch: pitched and voiced_ratio>=0.30 and periodicity>=0.75 | "
                  "noisy: flatness>=0.10 | transient: onset_rate>=3/s and crest>=12dB | "
                  "sustained: onset_rate<=1/s | "
                  "bass_capable: low_band>=45% and credible_pitch and pitch<=220Hz and "
                  "periodicity>=0.85 | "
                  "rhythmic: pulse_strength>=0.25 or onset_rate>=4/s | "
                  "no rule fired -> narrative_sound_event"),
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cat = json.loads(CATALOG.read_text())
    meta = {s["id"]: s for s in cat["sounds"]}
    files = sorted(ORIGINALS.glob("*.wav"))
    if not files:
        sys.exit(f"no masters in {ORIGINALS}")

    results, t0 = [], time.time()
    for i, f in enumerate(files, 1):
        m = analyse(f)
        sid = f.stem.split("_")[0] + "_" + f.stem.split("_")[1]
        m["id"] = sid
        m["catalog"] = {
            "name": meta.get(sid, {}).get("name"),
            "section": meta.get(sid, {}).get("section"),
            "license": meta.get(sid, {}).get("license"),
            "sensitive": meta.get(sid, {}).get("sensitive", False),
        }
        m["classification"] = classify(m)
        results.append(m)
        print(f"[{i:2d}/{len(files)}] {f.name:34s} tonal={m['classification']['tonal']!s:5s} "
              f"roles={','.join(m['classification']['role_hypotheses']) or '-'}")

    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tool": {"librosa": librosa.__version__, "numpy": np.__version__, "python": sys.version.split()[0]},
        "method": ("native sample rate, mono, STFT 2048/512; HPSS for harmonic/percussive split; "
                   "yin 40-2000 Hz; EBU R128 via ffmpeg; role labels are rule-based hypotheses"),
        "count": len(results),
        "sounds": results,
        "elapsed_s": round(time.time() - t0, 1),
    }
    dest = OUT_DIR / "corpus-analysis.json"
    dest.write_text(json.dumps(_clean(out), indent=2))

    # Compact human-readable table, used to justify the classification thresholds.
    hdr = (f"{'id':6s} {'harm%':>6s} {'flat':>7s} {'low%':>5s} {'hi%':>5s} "
           f"{'on/s':>5s} {'crest':>5s} {'pitch':>6s} {'prev':>5s} {'per':>5s} {'pulse':>5s} "
           f"{'atk':>6s} {'dec':>6s} roles")
    rows = [hdr, "-" * len(hdr)]
    for m in results:
        c, sp, hp, rh, pi = (m["classification"], m["spectral"], m["hpss"],
                             m["rhythm"], m["pitch"])
        env = m["envelope"]
        rows.append(
            f"{m['id']:6s} {hp['harmonic_share'] * 100:6.1f} {sp['flatness']:7.4f} "
            f"{c['low_band_share_pct']:5.1f} {c['high_band_share_pct']:5.1f} "
            f"{rh['onset_rate_per_s']:5.1f} {m['crest_factor_db']:5.1f} "
            f"{(pi['median_hz'] or 0):6.0f} {pi['prevalence']:5.2f} {pi['periodicity']:5.2f} "
            f"{rh['pulse_strength']:5.2f} "
            f"{(env['attack_ms'] if env['attack_ms'] is not None else -1):6.1f} "
            f"{(env['decay_ms'] if env['decay_ms'] is not None else -1):6.0f} "
            f"{','.join(c['role_hypotheses']) or '-'}")
    (OUT_DIR / "corpus-table.txt").write_text("\n".join(rows) + "\n")
    print(f"\n{len(results)} sounds in {out['elapsed_s']}s -> {dest.relative_to(ROOT)}")
    print(f"table -> {(OUT_DIR / 'corpus-table.txt').relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
