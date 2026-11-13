#!/usr/bin/env python3
"""
Synthetic "Segazz" reference with KNOWN ground truth, used only to prove that
`analyze-reference.py` measures correctly before any real reference exists.

Ground truth: 88 BPM, 4/4, 8 bars, D minor, 44.1 kHz, stems sample-aligned at
offset 0, mix = drums + bass + other (no processing).

    python3 scripts/phase-a/make-synthetic-reference.py --out /tmp/phase-a-synthetic
"""
import argparse
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
BPM = 88.0
BARS = 8
BEAT = 60.0 / BPM
BAR = 4 * BEAT
TOTAL = BARS * BAR


def env(n, attack=0.005, decay=None):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    d = np.exp(-t / (decay if decay else 0.15))
    return (a * d).astype(np.float32)


def kick(dur=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 28) + 48
    return (0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.06)).astype(np.float32)


def snare(dur=0.14):
    n = int(dur * SR)
    noise = np.random.default_rng(7).normal(0, 1, n)
    noise = np.convolve(noise, np.ones(6) / 6, mode="same")
    tone = 0.4 * np.sin(2 * np.pi * 190 * np.arange(n) / SR)
    return ((0.6 * noise + tone) * env(n, 0.001, 0.04)).astype(np.float32)


def hat(dur=0.05):
    n = int(dur * SR)
    noise = np.random.default_rng(11).normal(0, 1, n)
    noise = np.diff(np.concatenate([[0], noise]))  # crude high-pass
    return (0.25 * noise * env(n, 0.001, 0.012)).astype(np.float32)


def bass_note(f0, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f0 * t) + 0.35 * np.sin(4 * np.pi * f0 * t)
           + 0.12 * np.sin(6 * np.pi * f0 * t))
    return (0.55 * sig * env(n, 0.012, dur * 0.55)).astype(np.float32)


def pad_note(f0, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = sum(np.sin(2 * np.pi * f0 * k * t) / k for k in (1, 2, 3, 4))
    e = np.clip(t / 0.4, 0, 1) * np.clip((dur - t) / 0.4, 0, 1)
    return (0.12 * sig * e).astype(np.float32)


def add(buf, sig, at):
    i = int(at * SR)
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/phase-a-synthetic")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    n = int(TOTAL * SR)
    drums = np.zeros(n, np.float32)
    bass = np.zeros(n, np.float32)
    other = np.zeros(n, np.float32)

    # D minor: D2=73.42, F2=87.31, A2=110.00, C3=130.81
    roots = [73.42, 73.42, 87.31, 98.00]  # D, D, F, G (i - i - III - iv colour)
    for bar in range(BARS):
        b0 = bar * BAR
        for beat in range(4):
            t = b0 + beat * BEAT
            if beat in (0, 2):
                add(drums, kick(), t)
            else:
                add(drums, snare(), t)
            # swung 8ths: offbeat sits at 0.62 of the beat, not 0.5
            add(drums, hat(), t)
            add(drums, hat(), t + 0.62 * BEAT)
        # bass: root on beat 1, fifth-ish push on the "and" of 2, octave on 3.5
        r = roots[bar % len(roots)]
        add(bass, bass_note(r, 0.55), b0)
        add(bass, bass_note(r, 0.30), b0 + 1.62 * BEAT)
        add(bass, bass_note(r * 2, 0.40), b0 + 2.5 * BEAT)
        add(bass, bass_note(r, 0.35), b0 + 3.5 * BEAT)
        # pad: Dm7-ish voicing, one chord per bar
        for f in (146.83, 174.61, 220.00, 261.63):  # D3 F3 A3 C4
            add(other, pad_note(f, BAR * 0.98), b0)

    for name, buf in (("Zistwar-drums", drums), ("Zistwar-bass", bass), ("Zistwar-other", other)):
        sf.write(out / f"{name}.wav", buf, SR, subtype="PCM_24")
    mix = drums + bass + other
    mix = mix / max(np.max(np.abs(mix)), 1e-9) * 0.89  # peak -1 dBFS, no clipping
    sf.write(out / "zistoire mix v0.wav", mix, SR, subtype="PCM_24")

    print(f"synthetic reference in {out}")
    print(f"  ground truth: {BPM:.0f} BPM, 4/4, {BARS} bars, D minor, {TOTAL:.3f}s, "
          f"stems aligned at 0, mix = drums+bass+other")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
