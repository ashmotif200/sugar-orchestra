#!/usr/bin/env python3
"""
Production musicale — Énergétique / Electro Sega.

Trois rendus :
  A  fondation instrumentale (aucun son du musée)
  B  visiteur 1 : sons du musée intégrés, hook porté par une cloche métallique
  C  visiteur 2 : autre collection, autre ordre de sections, autre basse

24 mesures à 135 BPM, 4/4 ternaire, Fa majeur.
Tout est synthétisé ou échantillonné ici ; aucun enregistrement de référence
n'est utilisé comme accompagnement.

Sortie : WAV 44,1 kHz stéréo, stems séparés, fichier MIDI.
"""
import json
import os
import struct

import numpy as np

SR = 44100
BPM = 135.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
STEPS = 12                 # subdivision ternaire
STEP = BAR / STEPS
BARS = 24
DUR = BARS * BAR

ROOT = "/workspace/sugar-orchestra"
ORIG = os.path.join(ROOT, "assets/originals")
OUT = "/workspace/download/sugar-audio/production"
STEMS = os.path.join(OUT, "stems")

rng = np.random.default_rng(20261113)

# --------------------------------------------------------------------- accords
CHORDS = {
    "F":  [53, 57, 60],
    "Am": [57, 60, 64],
    "Bb": [58, 62, 65],
    "C":  [60, 64, 67],
    "Dm": [62, 65, 69],
}
PROG_A = ["F", "Am", "Bb", "C", "F", "Am", "Bb", "C"]
PROG_B = ["F", "Dm", "Bb", "C", "Bb", "C"]
PROG_A2 = ["F", "Am", "Bb", "C"]
PROG_OUT = ["F", "F"]

# grille : (nom de section, mesure de début, nombre de mesures, accords)
def plan(order):
    """Les sections sont chaînées : la mesure de départ est calculée, jamais figée.

    Ordre ABA : le groove s'installe, le thème arrive, puis revient.
    Ordre BAA : le thème est annoncé d'abord, le groove s'installe ensuite.
    """
    content = {
        "intro": (2, ["F", "F"]),
        "A": (8, PROG_A),
        "B": (6, PROG_B),
        "break": (2, ["Bb", "Bb"]),
        "A2": (4, PROG_A2),
        "outro": (2, PROG_OUT),
    }
    seq = ["intro", "A", "B", "break", "A2", "outro"] if order == "ABA" \
        else ["intro", "B", "A", "break", "A2", "outro"]
    out, bar = [], 1
    for k in seq:
        n, chords = content[k]
        out.append((k, bar, n, chords))
        bar += n
    return out


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- synthèse
def env_adsr(n, a, d, s, r, sr=SR):
    a_n, d_n, r_n = int(a * sr), int(d * sr), int(r * sr)
    a_n, d_n, r_n = max(1, a_n), max(1, d_n), max(1, r_n)
    sustain_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False),
        np.linspace(1, s, d_n, endpoint=False),
        np.full(sustain_n, s),
        np.linspace(s, 0, r_n),
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def kick(dur=0.42, f0=118, f1=44, punch=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = rng.normal(0, 1, n) * np.exp(-t / 0.004) * 0.16 * punch
    return (body + click) * 0.9


def snare(dur=0.22, tone=190):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    # bande 1,2–4 kHz par différence de moyennes mobiles (simple, efficace)
    k1, k2 = 6, 18
    hp = noise - np.convolve(noise, np.ones(k1) / k1, "same")
    bp = np.convolve(hp, np.ones(k2) / k2, "same")
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.05) * 0.5
    return (bp * 0.55 + body) * np.exp(-t / 0.075)


def rim(dur=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    hp = noise - np.convolve(noise, np.ones(5) / 5, "same")
    tone = np.sin(2 * np.pi * 420 * t) * 0.6 + np.sin(2 * np.pi * 830 * t) * 0.3
    return (hp * 0.5 + tone) * np.exp(-t / 0.028)


def hat(dur=0.06, open_=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    hp = noise - np.convolve(noise, np.ones(8) / 8, "same")
    hp = hp - np.convolve(hp, np.ones(4) / 4, "same")
    return hp * np.exp(-t / (0.11 if open_ else 0.022)) * 0.7


def shaker(dur=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    hp = noise - np.convolve(noise, np.ones(10) / 10, "same")
    e = np.minimum(1, t / 0.012) * np.exp(-t / 0.045)
    return hp * e * 0.6


def conga(dur=0.25, f=210):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 0.35 * np.exp(-t / 0.02))
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.09)
    slap = rng.normal(0, 1, n) * np.exp(-t / 0.006) * 0.25
    return body * 0.8 + slap


def lowpass(x, cutoff):
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def bass_note(midi, dur, bright=1.0, sustain=0.42):
    n = int(dur * SR)
    f = hz(midi)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t)
         + 0.38 * bright * np.sin(4 * np.pi * f * t)
         + 0.16 * bright * np.sin(6 * np.pi * f * t))
    x = lowpass(x, 420)
    e = env_adsr(n, 0.004, 0.10, sustain, min(0.06, dur * 0.4))
    return np.tanh(x * e * 1.15) * 0.8


def pluck_chord(midis, dur, brightness=2600, strum=0.009):
    """Accord pincé, façon guitare/clavier sega : attaque nette, décroissance courte."""
    total = int((dur + strum * len(midis)) * SR)
    out = np.zeros(total)
    for k, m in enumerate(midis):
        f = hz(m)
        n = int(dur * SR)
        t = np.arange(n) / SR
        x = np.zeros(n)
        for h in range(1, 7):
            if f * h > 6000:
                break
            x += (1.0 / h) * np.sin(2 * np.pi * f * h * t + h * 0.7)
        x = lowpass(x, brightness)
        e = env_adsr(n, 0.003, 0.09, 0.28, min(0.09, dur * 0.5))
        off = int(k * strum * SR)
        out[off:off + n] += x * e * (0.55 if k else 0.7)
    return out * 0.55


def lead_note(midi, dur, timbre="saw"):
    n = int(dur * SR)
    f = hz(midi)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.15)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    if timbre == "saw":
        x = sum((1.0 / h) * np.sin(h * ph) for h in range(1, 9))
        x = lowpass(x, 2200)
    else:  # square adouci
        x = sum((1.0 / h) * np.sin(h * ph) for h in range(1, 12, 2))
        x = lowpass(x, 1800)
    e = env_adsr(n, 0.02, 0.12, 0.62, min(0.12, dur * 0.5))
    return x * e * 0.42


def pad_chord(midis, dur, cutoff=1200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in midis:
        f = hz(m)
        for det in (-0.0015, 0.0015):
            ff = f * (1 + det)
            for h in (1, 2, 3):
                x += (0.5 / h) * np.sin(2 * np.pi * ff * h * t + rng.uniform(0, 6.28))
    x = lowpass(x, cutoff)
    e = env_adsr(n, 0.35, 0.2, 0.75, min(0.8, dur * 0.5))
    return x * e * 0.16


# ------------------------------------------------------- sons du musée
def load_sample(sound_id, dur=0.45, start="onset"):
    import soundfile as sf
    path = os.path.join(ORIG, f"{sound_id}.wav")
    y, sr = sf.read(path, always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)
    y = y.astype(np.float64)
    if sr != SR:
        import librosa
        y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    if start == "onset":
        import librosa
        on = librosa.onset.onset_detect(y=y, sr=SR, units="samples", backtrack=False)
        i0 = int(on[0]) if len(on) else 0
    else:
        i0 = int(float(start) * SR)
    seg = y[i0:i0 + int(dur * SR)].copy()
    if len(seg) < int(0.02 * SR):
        seg = np.pad(seg, (0, int(0.02 * SR) - len(seg)))
    fi = min(len(seg), int(0.003 * SR))
    fo = min(len(seg), int(0.03 * SR))
    seg[:fi] *= np.linspace(0, 1, fi)
    seg[-fo:] *= np.linspace(1, 0, fo)
    peak = np.max(np.abs(seg)) or 1.0
    return seg / peak


def place(buf, x, at_s, gain=1.0, pan=0.0, rate=1.0):
    """Ajoute un signal mono dans un bus stéréo, avec taux de lecture optionnel."""
    if rate != 1.0:
        idx = np.arange(0, len(x) - 1, rate)
        x = np.interp(idx, np.arange(len(x)), x)
    i0 = int(at_s * SR)
    n = min(len(x), len(buf[0]) - i0)
    if n <= 0:
        return
    gl = np.cos((pan + 1) * np.pi / 4) * gain
    gr = np.sin((pan + 1) * np.pi / 4) * gain
    buf[0][i0:i0 + n] += x[:n] * gl
    buf[1][i0:i0 + n] += x[:n] * gr


def new_bus():
    return np.zeros((2, int(DUR * SR) + SR))


# ------------------------------------------------------------------ écriture
BASS_PATTERN = [(0, 0, 0.5), (6, 7, 0.5), (9, 12, 0.5)]   # (pas, intervalle, durée en temps)
HAT_STEPS = [0, 2, 4, 6, 8, 10]
KICK_STEPS = [0, 6]
RIM_STEPS = [3, 9]
CONGA_STEPS = [4, 10]

HOOK = [
    ([77, 77, 81, 84], [0, 2, 4, 6], [0.6, 0.6, 0.9, 1.6]),
    ([81, 77, 74, 77], [0, 2, 4, 6], [0.6, 0.6, 0.9, 1.6]),
    ([82, 82, 81, 77], [0, 2, 4, 6], [0.6, 0.6, 0.9, 1.6]),
    ([79, 76, 72, 74], [0, 2, 4, 6], [0.6, 0.9, 0.9, 1.8]),
]

MUSEUM = {
    "set1": {
        "ostinato": {"id": "04_03", "steps": [2, 5, 8, 11], "gain": 0.30, "pan": -0.35, "transpose": [0, 0, -2, 0]},
        "shaker":   {"id": "08_02", "steps": list(range(12)), "gain": 0.10, "pan": 0.28},
        "kick":     {"id": "06_04", "steps": [0], "gain": 0.42, "pan": 0.0, "lowpass": 220},
        "accent":   {"id": "04_02", "bars": [10, 16, 24], "step": 0, "gain": 0.55, "pan": 0.15},
        "bell":     {"id": "04_09", "gain": 0.40, "pan": -0.1},
        "texture":  {"id": "04_07", "gain": 0.16, "pan": 0.4},
        "riser":    {"id": "01_03", "bars": [2, 16], "gain": 0.30, "pan": 0.0},
    },
    "set2": {
        "ostinato": {"id": "03_04", "steps": [1, 4, 7, 10], "gain": 0.28, "pan": 0.30, "transpose": [0, 2, 0, -2]},
        "shaker":   {"id": "02_04", "steps": [0, 3, 6, 9], "gain": 0.16, "pan": -0.30},
        "kick":     {"id": "01_01", "steps": [0, 6], "gain": 0.34, "pan": 0.0, "lowpass": 160},
        "accent":   {"id": "07_02", "bars": [10, 24], "step": 6, "gain": 0.30, "pan": 0.0},
        "bell":     None,
        "texture":  {"id": "05_01", "gain": 0.20, "pan": -0.35},
        "riser":    {"id": "08_03", "bars": [16], "gain": 0.24, "pan": 0.0},
    },
}


def build(version):
    cfg = {
        "A": dict(name="A-fondation", order="ABA", bass_timbre=1.0, lead_timbre="saw", museum=None, hook="synth"),
        "B": dict(name="B-visiteur1", order="ABA", bass_timbre=1.0, lead_timbre="saw", museum="set1", hook="bell"),
        "C": dict(name="C-visiteur2", order="BAA", bass_timbre=1.35, lead_timbre="square", museum="set2", hook="synth_hi"),
    }[version]

    buses = {k: new_bus() for k in ("kick", "snare", "hats", "perc", "bass", "chords", "lead", "pad", "museum")}
    events = []       # pour le MIDI
    sections = plan(cfg["order"])
    mus = MUSEUM[cfg["museum"]] if cfg["museum"] else None
    samples = {}
    if mus:
        for key, spec in mus.items():
            if not spec:
                continue
            dur = 1.6 if key in ("texture", "riser") else (0.9 if key == "bell" else 0.35)
            samples[key] = (load_sample(spec["id"], dur=dur), spec)

    for sec, start_bar, nbars, chords in sections:
        for i in range(nbars):
            bar = start_bar - 1 + i
            t0 = bar * BAR
            chord = chords[i % len(chords)]
            notes = CHORDS[chord]
            loud = sec in ("A", "B", "A2")

            # --- batterie
            if sec in ("A", "B", "A2"):
                for s in KICK_STEPS:
                    place(buses["kick"], kick(), t0 + s * STEP, 0.95)
                if bar % 4 == 3:  # relance
                    place(buses["kick"], kick(dur=0.3), t0 + 10 * STEP, 0.7)
                for s in RIM_STEPS:
                    place(buses["snare"], rim(), t0 + s * STEP, 0.62)
                if bar % 4 == 2:
                    place(buses["snare"], rim(), t0 + 7 * STEP, 0.3)
                for j, s in enumerate(HAT_STEPS):
                    place(buses["hats"], hat(open_=(s == 10 and bar % 2 == 1)),
                          t0 + s * STEP, 0.30 if j % 2 else 0.42, pan=0.25)
                if sec in ("B", "A2"):
                    for s in range(12):
                        place(buses["hats"], shaker(), t0 + s * STEP, 0.13, pan=-0.3)
                if sec == "A2":
                    for s in CONGA_STEPS:
                        place(buses["perc"], conga(), t0 + s * STEP, 0.22, pan=0.35)

            # --- basse (ligne qui évolue)
            root = notes[0] - 12
            if sec in ("A", "A2", "outro"):
                for s, iv, dur in BASS_PATTERN:
                    place(buses["bass"], bass_note(root + iv, dur * BEAT, cfg["bass_timbre"]),
                          t0 + s * STEP, 0.85)
            elif sec == "B":  # marche : plus de mouvement
                for s, iv, dur in [(0, 0, 0.5), (3, 0, 0.4), (6, 7, 0.5), (9, 10, 0.5), (11, 12, 0.4)]:
                    place(buses["bass"], bass_note(root + iv, dur * BEAT, cfg["bass_timbre"]),
                          t0 + s * STEP, 0.8)
            elif sec == "break":
                place(buses["bass"], bass_note(root - 12, BAR * 0.9, 0.4, sustain=0.8), t0, 0.34)

            # --- accords pincés
            if sec in ("A", "B", "A2"):
                for s in (3, 9):
                    place(buses["chords"], pluck_chord(notes, 0.45), t0 + s * STEP, 0.30, pan=-0.15)
                if sec == "A2":
                    place(buses["chords"], pluck_chord(notes, 0.35), t0 + 6 * STEP, 0.22, pan=0.2)
            if sec in ("intro", "break", "outro"):
                pad_gain = 0.20 if sec == "break" else 0.62
                place(buses["pad"], pad_chord(notes + [notes[0] + 12], BAR * 1.05), t0, pad_gain)

            # --- hook mélodique
            if sec == "B" and 0 <= i < 4:
                midis, steps, durs = HOOK[i]
                for m, s, d in zip(midis, steps, durs):
                    if cfg["hook"] == "bell" and "bell" in samples:
                        spec = samples["bell"][1]
                        base_midi = 78.0   # 04_09 ≈ 722 Hz ≈ Fa#5
                        rate = 2 ** ((m - base_midi) / 12)
                        place(buses["museum"], samples["bell"][0], t0 + s * STEP,
                              spec["gain"], spec["pan"], rate=rate)
                    else:
                        timbre = cfg["lead_timbre"]
                        pitch = m if cfg["hook"] != "synth_hi" else m + 12
                        place(buses["lead"], lead_note(pitch, d * BEAT, timbre),
                              t0 + s * STEP, 0.55 if not events else 0.5)
                    events.append((0, t0 + s * STEP, m, d * BEAT))
            if sec == "A2" and 0 <= i < 4:
                midis, steps, durs = HOOK[i]
                for m, s, d in zip(midis, steps, durs):
                    if cfg["hook"] == "bell" and "bell" in samples:
                        spec = samples["bell"][1]
                        rate = 2 ** ((m - 78) / 12)
                        place(buses["museum"], samples["bell"][0], t0 + s * STEP,
                              spec["gain"] * 0.8, spec["pan"], rate=rate)
                    else:
                        place(buses["lead"], lead_note(m, d * BEAT, cfg["lead_timbre"]),
                              t0 + s * STEP, 0.45, pan=0.15)

            # montée d'intro : balai croissant sur la dernière mesure avant le groove
            if sec == "intro" and i == nbars - 1:
                for k in range(8):
                    place(buses["hats"], shaker(), t0 + k * STEP * 1.5, 0.05 + 0.02 * k, pan=-0.2)

            # --- sons du musée
            if mus:
                o = mus["ostinato"]
                if sec in ("A", "B", "A2"):
                    for k, s in enumerate(o["steps"]):
                        if "transpose" in o and k < len(o["transpose"]):
                            rate = 2 ** (o["transpose"][k] / 12)
                        else:
                            rate = 1.0
                        place(buses["museum"], samples["ostinato"][0], t0 + s * STEP,
                              o["gain"], o["pan"], rate=rate)
                sh = mus["shaker"]
                if sec in ("A", "A2"):
                    for s in sh["steps"]:
                        place(buses["museum"], samples["shaker"][0], t0 + s * STEP,
                              sh["gain"], sh["pan"])
                kk = mus["kick"]
                if sec in ("A", "B", "A2"):
                    for s in kk["steps"]:
                        x = samples["kick"][0]
                        if kk.get("lowpass"):
                            x = lowpass(x, kk["lowpass"])
                        place(buses["museum"], x, t0 + s * STEP, kk["gain"], kk["pan"])
                tf = mus["texture"]
                if sec in ("intro", "break"):
                    place(buses["museum"], samples["texture"][0], t0,
                          tf["gain"], tf["pan"], rate=1.0)

    # accents de signature (rares, donc marquants)
    if mus and mus["accent"]:
        a = mus["accent"]
        for bar in a["bars"]:
            place(buses["museum"], samples["accent"][0], (bar - 1) * BAR + a["step"] * STEP,
                  a["gain"], a["pan"])
    # transitions
    if mus and mus["riser"]:
        r = mus["riser"]
        for bar in r["bars"]:
            place(buses["museum"], samples["riser"][0], (bar - 1) * BAR, r["gain"], r["pan"], rate=0.9)

    return buses, events, cfg


def master(buses, path, stems_dir=None):
    # niveaux calculés sur la mesure des stems : les accords et le lead sortaient
    # 15 à 18 dB sous la basse, donc inaudibles.
    gains = dict(kick=0.85, snare=1.35, hats=0.72, perc=1.80, bass=1.13,
                 chords=2.50, lead=1.30, pad=0.90, museum=1.25)
    mix = np.zeros_like(buses["kick"])
    for k, b in buses.items():
        mix += b * gains[k]
    # saturation douce AVANT normalisation : appliquée après, elle repoussait les
    # crêtes inter-échantillons au-delà du plafond (−0,2 dBTP mesuré).
    mix = np.tanh(mix * 1.02) / np.tanh(1.02)
    peak = np.max(np.abs(mix))
    target = 10 ** (-2.4 / 20)   # crête d'échantillon ; le true peak mesuré sort 1,2 dB au-dessus
    if peak > 0:
        mix *= target / peak
    n_exact = int(round(DUR * SR))
    mix = mix[:, :n_exact]
    import soundfile as sf
    sf.write(path, mix.T.astype(np.float32), SR, subtype="PCM_16")
    if stems_dir:
        os.makedirs(stems_dir, exist_ok=True)
        for k, b in buses.items():
            if np.max(np.abs(b)) < 1e-6:
                continue
            s = b * gains[k] * (target / peak)
            sf.write(os.path.join(stems_dir, f"{k}.wav"), s.T.astype(np.float32), SR, subtype="PCM_16")
    return peak


# ------------------------------------------------------------------ MIDI
def write_midi(path, events, tempo=BPM):
    def vlq(n):
        out = [n & 0x7F]
        n >>= 7
        while n:
            out.insert(0, (n & 0x7F) | 0x80)
            n >>= 7
        return bytes(out)

    track = bytearray()
    uspq = int(60_000_000 / tempo)
    track += b"\x00\xff\x51\x03" + uspq.to_bytes(3, "big")
    track += b"\x00\xff\x58\x04\x04\x02\x18\x08"   # 4/4

    msgs = []
    for _, t, midi, dur in sorted(events, key=lambda x: x[1]):
        msgs.append((int(t * 1000), 0x90, midi, 96))
        msgs.append((int((t + dur) * 1000), 0x80, midi, 0))
    msgs.sort()
    last = 0
    for tick, st, n, v in msgs:
        track += vlq(max(0, tick - last)) + bytes([st, n, v])
        last = tick
    track += b"\x00\xff\x2f\x00"

    hdr = b"MThd" + struct.pack(">IHHH", 6, 0, 1, 960)
    trk = b"MTrk" + struct.pack(">I", len(track)) + bytes(track)
    with open(path, "wb") as f:
        f.write(hdr + trk)


def score_json(cfg):
    """Partition lisible : ce que joue chaque pupitre, mesure par mesure."""
    out = {"version": cfg["name"], "bpm": BPM, "meter": "4/4 ternaire (12 pas par mesure)",
           "key": "Fa majeur", "bars": BARS, "order": cfg["order"], "sections": [], "melody": []}
    for sec, start, n, chords in plan(cfg["order"]):
        out["sections"].append({"kind": sec, "startBar": start, "bars": n, "chords": chords})
        for i in range(n):
            bar = start + i
            if sec in ("A", "B", "A2", "intro", "outro"):
                root = CHORDS[chords[i % len(chords)]][0] - 12
                bass = []
                if sec in ("A", "A2", "outro"):
                    bass = [{"step": s, "midi": root + iv} for s, iv, _ in BASS_PATTERN]
                elif sec == "B":
                    bass = [{"step": s, "midi": root + iv} for s, iv, _ in
                            [(0, 0, 0), (3, 0, 0), (6, 7, 0), (9, 10, 0), (11, 12, 0)]]
                if sec in ("A", "B", "A2"):
                    out["melody"].append({"bar": bar, "chord": chords[i % len(chords)],
                                          "kick": KICK_STEPS, "rim": RIM_STEPS, "hats": HAT_STEPS,
                                          "bass": bass, "stabs": [3, 9]})
    for i, (midis, steps, durs) in enumerate(HOOK):
        out["melody"].append({"hookBar": i + 1, "notes": midis, "steps": steps,
                              "durationsBeats": durs,
                              "instrument": "cloche 04_09 transposée" if cfg["hook"] == "bell"
                                            else f"lead synthé {cfg['lead_timbre']}"})
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    for v in ("A", "B", "C"):
        buses, events, cfg = build(v)
        wav = os.path.join(OUT, f"{cfg['name']}.wav")
        peak = master(buses, wav, stems_dir=os.path.join(STEMS, cfg["name"]))
        mid = os.path.join(OUT, f"{cfg['name']}.mid")
        write_midi(mid, events)
        with open(os.path.join(OUT, f"{cfg['name']}.score.json"), "w") as f:
            json.dump(score_json(cfg), f, indent=2, ensure_ascii=False)
        report.append({"version": v, "file": wav, "stems": os.path.join(STEMS, cfg["name"]),
                       "midi": mid, "peak_before_norm": round(float(peak), 4),
                       "order": cfg["order"], "museum": cfg["museum"], "hook": cfg["hook"]})
        print(f"{v} → {os.path.basename(wav)} · pic avant normalisation {peak:.3f}")
    with open(os.path.join(OUT, "production.json"), "w") as f:
        json.dump({"bpm": BPM, "bars": BARS, "duration_s": round(DUR, 2),
                   "renders": report}, f, indent=2, ensure_ascii=False)
    print(f"durée {DUR:.2f} s · {OUT}")


if __name__ == "__main__":
    main()
