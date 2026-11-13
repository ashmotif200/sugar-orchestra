#!/usr/bin/env python3
"""Vérifications objectives des trois rendus de production (durée, niveaux, structure)."""
import numpy as np
import soundfile as sf

SR = 44100
BAR = 4 * 60 / 135.0
BASE = "/workspace/download/sugar-audio/production"
# fenêtres en mesures 1-indexées, bornes incluses : (début, fin)
SECS = [("intro", 1, 2), ("A", 3, 10), ("B", 11, 16), ("break", 17, 18), ("A2", 19, 22), ("outro", 23, 24)]


def load(name):
    y, sr = sf.read(f"{BASE}/{name}.wav")
    return (y.mean(1) if y.ndim > 1 else y), sr


def per_bar(y):
    n = int(BAR * SR)
    return np.array([np.sqrt(np.mean(y[i * n:(i + 1) * n] ** 2)) for i in range(24)])


def main():
    for name, order in (("A-fondation", "ABA"), ("B-visiteur1", "ABA"), ("C-visiteur2", "BAA")):
        y, sr = load(name)
        lv = []
        for s, b0, b1 in SECS:
            seg = y[int((b0 - 1) * BAR * sr):min(len(y), int(b1 * BAR * sr))]
            lv.append(f"{s} {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9):5.1f}")
        print(f"{name:14s} {order} | " + "  ".join(lv))

    a, b, c = per_bar(load("A-fondation")[0]), per_bar(load("B-visiteur1")[0]), per_bar(load("C-visiteur2")[0])
    corr = lambda x, z: float(np.corrcoef(x, z)[0, 1])
    print(f"\nprofil d'énergie par mesure — corrélations : A/B {corr(a, b):.3f}  A/C {corr(a, c):.3f}  B/C {corr(b, c):.3f}")
    print("8 premières mesures, B (dB):", np.round(20 * np.log10(b[:8] + 1e-9), 1))
    print("8 premières mesures, C (dB):", np.round(20 * np.log10(c[:8] + 1e-9), 1))
    # le break doit être plus bas que le développement
    for name in ("A-fondation", "B-visiteur1", "C-visiteur2"):
        y, sr = load(name)
        d = 20 * np.log10(np.sqrt(np.mean(y[int(2 * BAR * sr):int(10 * BAR * sr)] ** 2)))
        br = 20 * np.log10(np.sqrt(np.mean(y[int(16 * BAR * sr):int(18 * BAR * sr)] ** 2)))
        print(f"{name:14s} développement {d:5.1f} dB · break {br:5.1f} dB · écart {br - d:+.1f} dB")


if __name__ == "__main__":
    main()
