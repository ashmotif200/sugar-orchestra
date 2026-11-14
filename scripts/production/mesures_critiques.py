#!/usr/bin/env python3
"""Mesures objectives sur la pièce étalon — pour distinguer défaut de composition
et défaut de production, sans recourir à un jugement d'écoute."""
import json

import librosa
import numpy as np
import soundfile as sf

SR = 44100
BPM = 135.0
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BAR / 12
P = "/workspace/download/sugar-audio/production"


def mono(path):
    y, _ = sf.read(path)
    return y.mean(1) if y.ndim > 1 else y


def main():
    # 1. microtiming : écart réel des percussions à la grille de 12 pas
    for stem in ("kick", "snare", "hats"):
        y = mono(f"{P}/stems/A-fondation/{stem}.wav")
        on = librosa.onset.onset_detect(y=y, sr=SR, units="time", backtrack=False)
        if not len(on):
            continue
        dev = [abs((float(t) / STEP) - round(float(t) / STEP)) * STEP for t in on[:80]]
        print(f"{stem:6s} {len(on):4d} attaques · écart à la grille : moy {1000*np.mean(dev):6.2f} ms · "
              f"écart-type {1000*np.std(dev):5.2f} ms")

    # 2. dynamique frappe par frappe
    y = mono(f"{P}/stems/A-fondation/kick.wav")
    on = librosa.onset.onset_detect(y=y, sr=SR, units="time", backtrack=False)
    peaks = []
    for t in on[:80]:
        i = int(t * SR)
        seg = y[i:i + int(0.2 * SR)]
        if len(seg) > 100:
            peaks.append(20 * np.log10(np.max(np.abs(seg)) + 1e-9))
    if peaks:
        print(f"kick   dynamique entre frappes : médiane {np.median(peaks):6.1f} dB · "
              f"écart-type {np.std(peaks):4.2f} dB · amplitude {max(peaks)-min(peaks):4.2f} dB")

    # 3. répétition des motifs de batterie
    score = json.load(open(f"{P}/A-fondation.score.json"))
    bars = [(tuple(b["kick"]), tuple(b["rim"]), tuple(b["hats"]))
            for b in score["melody"] if "kick" in b]
    print(f"batterie : {len(bars)} mesures · {len(set(bars))} motif(s) distinct(s)")
    bass_steps = [tuple((n['step'], n['midi']) for n in b["bass"]) for b in score["melody"] if "kick" in b]
    print(f"basse    : {len(bass_steps)} mesures · {len(set(bass_steps))} cellule(s) distincte(s)")

    # 4. hauteurs réellement produites par la basse
    by = mono(f"{P}/stems/A-fondation/bass.wav")
    f0, voiced, _ = librosa.pyin(by, fmin=30, fmax=220, sr=SR, frame_length=4096)
    vals = f0[voiced & np.isfinite(f0)]
    if len(vals):
        midi = np.round(69 + 12 * np.log2(vals / 440)).astype(int)
        u, c = np.unique(midi, return_counts=True)
        print(f"basse    : {len(vals)} trames voisées · hauteurs MIDI distinctes "
              f"{[(int(a), int(b)) for a, b in zip(u, c)][:10]}")

    # 5. phrase mélodique
    hook = [n for n in score["melody"] if "hookBar" in n]
    if hook:
        notes = hook[0]["notes"]
        print(f"hook     : {len(notes)} notes · {len(set(notes))} hauteurs · "
              f"intervalles {np.diff(notes).tolist()}")
        print(f"hook     : {len(hook)} expositions, toutes identiques = "
              f"{all(h['notes'] == notes for h in hook)}")

    # 6. densité harmonique : combien d'accords différents, combien de fois
    chords = [b["chord"] for b in score["melody"] if "chord" in b]
    u, c = np.unique(chords, return_counts=True)
    print(f"harmonie : {len(u)} accords distincts {dict(zip(u.tolist(), c.tolist()))}")


if __name__ == "__main__":
    main()
