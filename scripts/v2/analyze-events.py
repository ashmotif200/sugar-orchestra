#!/usr/bin/env python3
"""
V2.0.5 — extraction événementielle par stem.

Produit, pour une référence : les événements horodatés de chaque stem, les
silences, la densité par mesure, les cellules rythmiques mesure par mesure, la
bibliothèque de motifs qui en découle, les interactions entre stems, et une
transcription mélodique graduée par confiance.

Choix de méthode, hérités des corrections de la Phase A3 :
  * `backtrack=False` — avec `backtrack=True`, chaque attaque est déplacée vers le
    minimum d'énergie précédent, ce qui a produit 30 à 65 ms de faux microtiming.
  * la grille est une HYPOTHÈSE fournie en argument (mesure, temps, subdivision),
    pas une sortie de tracker : sur Tififi, aucun pouls discret n'est identifiable.
  * la confiance est explicite à trois niveaux ; rien n'est promu en « note » sans
    preuve. `detected` ≠ `musically_plausible` ≠ `confirmed`.

Usage :
  python analyze-events.py --ref energetique \
      --grid '{"barSeconds":1.778,"beatsPerBar":4,"subdivision":3}' \
      --out docs/v2.0.5/data
"""
import argparse
import csv
import hashlib
import json
import os
import sys

import numpy as np

HOP = 256
SR = 22050
MIN_SILENCE_S = 0.18
SILENCE_DB = -42.0
COINCIDENCE_S = 0.040
RESPONSE_WINDOW_S = 0.28

# rôles pressentis par stem — hypothèse de travail, pas une identification
STEM_ROLES = {
    'drums': 'percussion', 'bass': 'bass', 'vocals': 'voice',
    'other': 'tonal_layer', 'percs_and_synths': 'percussion_or_synth',
}

# bandes de recherche de hauteur par famille (Hz)
PITCH_RANGE = {
    'bass': (35.0, 320.0),
    'vocals': (90.0, 900.0),
    'other': (70.0, 1600.0),
    'percs_and_synths': (60.0, 1600.0),
    'drums': (40.0, 400.0),
}

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def load(path):
    import librosa
    y, _ = librosa.load(path, sr=SR, mono=True)
    return y


def onsets(y):
    import librosa
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=HOP,
                                        backtrack=False, units='frames')
    times = librosa.frames_to_time(frames, sr=SR, hop_length=HOP)
    strengths = [float(env[min(int(f), len(env) - 1)]) for f in frames]
    if strengths:
        peak = max(strengths) or 1.0
        strengths = [round(s / peak, 3) for s in strengths]
    return times, strengths


def silences(y, start_offset=0.0):
    """Trous d'énergie : silence de départ, de fin, et trous internes."""
    import librosa
    frame = int(0.05 * SR)
    rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=frame)[0]
    db = 20 * np.log10(np.maximum(rms, 1e-9))
    loud = db > SILENCE_DB
    out = []
    i = 0
    n = len(loud)
    while i < n:
        if not loud[i]:
            j = i
            while j < n and not loud[j]:
                j += 1
            dur = (j - i) * 0.05
            if dur >= MIN_SILENCE_S:
                out.append({
                    'start_s': round(start_offset + i * 0.05, 3),
                    'end_s': round(start_offset + j * 0.05, 3),
                    'duration_s': round(dur, 3),
                })
            i = j
        else:
            i += 1
    return out


def grid_of(grid):
    bar = float(grid['barSeconds'])
    beats = int(grid['beatsPerBar'])
    sub = int(grid['subdivision'])
    return bar, beats, sub, beats * sub


def cells_from_onsets(times, bar_s, steps_per_bar):
    """Cellule par mesure : chaîne de 'x' et '.' sur la grille du profil."""
    cells = {}
    for t in times:
        b = int(t // bar_s)
        pos = (t % bar_s) / (bar_s / steps_per_bar)
        k = int(pos) % steps_per_bar
        cells.setdefault(b, set()).add(k)
    return {b: ''.join('x' if i in v else '.' for i in range(steps_per_bar)) for b, v in cells.items()}


def pattern_library(cells, stem_id, ref_id, steps_per_bar, method):
    """Regroupe les cellules identiques et note les variations observées."""
    groups = {}
    for bar, cell in cells.items():
        groups.setdefault(cell, []).append(bar)
    patterns = []
    for cell, bars in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        hits = [i for i, c in enumerate(cell) if c == 'x']
        patterns.append({
            'patternId': f"{ref_id}:{stem_id}:{cell}",
            'referenceId': ref_id,
            'stemId': stem_id,
            'type': 'rhythmic_cell',
            'stepsPerBar': steps_per_bar,
            'cell': cell,
            'hits': hits,
            'density': round(len(hits) / steps_per_bar, 3),
            'occurrences': len(bars),
            'bars': bars[:40],
            'method': method,
            'confidence': 'confirmed' if len(bars) >= 3 else 'observed',
        })
    return patterns


def variations(patterns):
    """Variations observables entre motifs : ajout, retrait, déplacement."""
    out = []
    base = [p for p in patterns if p['occurrences'] >= 2][:6]
    for p in base:
        a = set(p['hits'])
        for q in patterns:
            if q is p or q['occurrences'] > p['occurrences']:
                continue
            b = set(q['hits'])
            if a == b:
                continue
            added, removed = sorted(b - a), sorted(a - b)
            distance = len(added) + len(removed)
            if 1 <= distance <= 2:
                out.append({
                    'basePattern': p['patternId'],
                    'variantPattern': q['patternId'],
                    'addedHits': added,
                    'removedHits': removed,
                    'editDistance': distance,
                    'observedBars': q['occurrences'],
                    'confidence': 'observed',
                })
    return out[:40]


def transcription(y, stem_id):
    """Notes graduées : detected / musically_plausible / confirmed / ambiguous."""
    import librosa
    lo, hi = PITCH_RANGE.get(stem_id, (60.0, 1200.0))
    # une fondamentale à 44 Hz tient en ~4 périodes dans 2048 échantillons à 22 kHz :
    # trop peu pour pyin, qui rend alors des notes « ambiguës » en masse. On élargit
    # la fenêtre pour le grave.
    frame = 4096 if hi <= 400 else 2048
    f0, voiced, prob = librosa.pyin(y, fmin=lo, fmax=hi, sr=SR, frame_length=frame,
                                    hop_length=HOP, fill_na=np.nan)
    times = librosa.times_like(f0, sr=SR, hop_length=HOP)
    notes = []
    i = 0
    n = len(f0)
    while i < n:
        if not voiced[i] or not np.isfinite(f0[i]):
            i += 1
            continue
        j = i
        while j + 1 < n and voiced[j + 1] and np.isfinite(f0[j + 1]) \
                and abs(12 * np.log2(f0[j + 1] / f0[i])) < 0.6:
            j += 1
        dur = (j - i + 1) * HOP / SR
        seg = f0[i:j + 1]
        seg = seg[np.isfinite(seg)]
        if len(seg) and dur >= 0.06:
            med = float(np.median(seg))
            cents = 1200 * np.log2(seg / med)
            stability = float(np.std(cents)) if len(cents) > 1 else 0.0
            strength = float(np.nanmean(prob[i:j + 1]))
            if strength >= 0.7 and stability <= 25 and dur >= 0.12:
                tier = 'confirmed'
            elif strength >= 0.5 and dur >= 0.10:
                tier = 'musically_plausible'
            else:
                tier = 'ambiguous'
            notes.append({
                'start_s': round(float(times[i]), 3),
                'end_s': round(float(times[j]), 3),
                'duration_s': round(dur, 3),
                'pitch_hz': round(med, 1),
                'midi_rounded': int(round(69 + 12 * np.log2(med / 440))),
                'cents_stability': round(stability, 1),
                'voiced_probability': round(strength, 3),
                'confidence': tier,
                'method': f'pyin fmin={lo} fmax={hi} sr={SR} hop={HOP} frame={frame}',
            })
        i = j + 1
    return notes


def bass_profile(events, drums, bar_s, steps_per_bar):
    """Comportement de basse sans dépendre de la hauteur.

    La transcription tonale d'un stem de basse encodé en MP3 est majoritairement
    « ambiguë » (probabilité voisée faible) : c'est une limite du matériau, pas un
    bug. En revanche le rythme, l'articulation et la position dans la mesure sont
    fiables — c'est ce que le futur moteur doit consommer.
    """
    if not events:
        return None
    t = np.array([e['startSeconds'] for e in events])
    d = np.array([max(1e-3, e['endSeconds'] - e['startSeconds']) for e in events])
    ioi = np.diff(t)
    pos = np.array([((x % bar_s) / (bar_s / steps_per_bar)) for x in t])
    hist = {int(k): int(np.sum(np.floor(pos) == k)) for k in range(steps_per_bar)}
    drum_t = np.array([e['startSeconds'] for e in drums]) if drums else np.array([])
    with_drums = int(sum(1 for x in t if len(drum_t) and np.min(np.abs(drum_t - x)) <= COINCIDENCE_S)) if len(drum_t) else None
    return {
        'onsets': int(len(t)),
        'notes_per_minute': round(len(t) / max(t.max(), 1e-9) * 60, 1),
        'ioi_median_s': round(float(np.median(ioi)), 3) if len(ioi) else None,
        'ioi_p10_s': round(float(np.percentile(ioi, 10)), 3) if len(ioi) else None,
        'ioi_p90_s': round(float(np.percentile(ioi, 90)), 3) if len(ioi) else None,
        'duration_median_s': round(float(np.median(d)), 3),
        'staccato_ratio': round(float(np.mean(d < 0.15)), 2),
        'step_histogram': hist,
        'step_histogram_note': f'positions sur {steps_per_bar} pas par mesure ; le pas 0 est le temps fort',
        'with_drums_within_40ms_pct': None if with_drums is None else round(100 * with_drums / len(t), 1),
        'silence_s_after_last_note': None,
        'reliable': ['onsets', 'intervals', 'articulation', 'position_in_bar', 'drum coincidence'],
        'unreliable': ['absolute pitch (voir tiers de transcription)'],
    }


def interactions(stem_events):
    """Coïncidence mesurée entre paires de stems. Jamais présentée comme intention."""
    out = []
    ids = sorted(stem_events)
    for a_i in range(len(ids)):
        for b_i in range(a_i + 1, len(ids)):
            a, b = ids[a_i], ids[b_i]
            ta = np.array([e['startSeconds'] for e in stem_events[a]['events']])
            tb = np.array([e['startSeconds'] for e in stem_events[b]['events']])
            if not len(ta) or not len(tb):
                continue
            joined = 0
            for t in ta:
                if np.min(np.abs(tb - t)) <= COINCIDENCE_S:
                    joined += 1
            expected = len(ta) * (2 * COINCIDENCE_S) * (len(tb) / max(ta.max(), 1e-9))
            lift = round(joined / expected, 2) if expected > 0 else None
            # enchaînements : a puis b dans la fenêtre de réponse, sans coïncidence
            responses = 0
            for t in ta:
                d = tb - t
                if np.any((d > COINCIDENCE_S) & (d <= RESPONSE_WINDOW_S)):
                    responses += 1
            out.append({
                'stemA': a,
                'stemB': b,
                'coincidence_within_ms': int(COINCIDENCE_S * 1000),
                'onsets_A': int(len(ta)),
                'onsets_B': int(len(tb)),
                'coincident_onsets': int(joined),
                'coincidence_pct_of_A': round(100 * joined / len(ta), 1),
                'lift_vs_chance': lift,
                'A_followed_by_B_pct': round(100 * responses / len(ta), 1),
                'reading': 'corrélation mesurée, pas une intention musicale démontrée',
            })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True)
    ap.add_argument('--grid', required=True, help='JSON {barSeconds,beatsPerBar,subdivision}')
    ap.add_argument('--stems', required=True, help='JSON {stemId: path}')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    grid = json.loads(a.grid)
    stems = json.loads(a.stems)
    bar_s, beats, sub, steps = grid_of(grid)
    os.makedirs(a.out, exist_ok=True)
    t0 = __import__('time').time()

    events_by_stem = {}
    all_patterns = []
    stem_meta = {}

    for stem_id, path in stems.items():
        y = load(path)
        times, strengths = onsets(y)
        sil = silences(y)
        dur = len(y) / SR

        events = []
        for i, t in enumerate(times):
            nxt = times[i + 1] if i + 1 < len(times) else min(t + 0.25, dur)
            events.append({
                'eventId': f"{a.ref}:{stem_id}:{i}",
                'referenceId': a.ref,
                'stemId': stem_id,
                'startSeconds': round(float(t), 4),
                'endSeconds': round(float(min(nxt, dur)), 4),
                'eventType': 'attack',
                'strength': strengths[i],
                'confidence': 'confirmed' if strengths[i] >= 0.15 else 'weak',
                'method': 'librosa onset_detect (backtrack=false) on 22050 Hz mono',
                'sourceEvidence': os.path.basename(path),
            })
        cells = cells_from_onsets(times, bar_s, steps)
        density = {str(b): len([t for t in times if int(t // bar_s) == b]) for b in sorted(set(int(t // bar_s) for t in times))}

        events_by_stem[stem_id] = {'events': events, 'silences': sil, 'cells': cells, 'density': density}
        all_patterns.extend(pattern_library(cells, stem_id, a.ref, steps, 'onsets quantised to the profile grid'))
        stem_meta[stem_id] = {
            'role_hypothesis': STEM_ROLES.get(stem_id, 'unknown'),
            'file': os.path.basename(path),
            'sha256': sha256(path),
            'duration_s': round(dur, 3),
            'onset_count': len(events),
            'silence_count': len(sil),
            'steps_per_bar': steps,
        }
        print(f"  {stem_id:16s} {len(events):5d} attaques · {len(sil):3d} silences · "
              f"{len(set(cells.values())):3d} cellules distinctes")

    # transcription tonale des stems qui en ont
    tonal = {}
    for stem_id in stems:
        if stem_id not in ('bass', 'vocals', 'other', 'percs_and_synths'):
            continue
        y = load(stems[stem_id])
        notes = transcription(y, stem_id)
        tonal[stem_id] = {
            'notes': notes,
            'counts': {t: sum(1 for n in notes if n['confidence'] == t)
                       for t in ('confirmed', 'musically_plausible', 'ambiguous')},
        }
        print(f"  {stem_id:16s} tonal : {tonal[stem_id]['counts']}")

    bass = bass_profile(
        events_by_stem.get('bass', {}).get('events'),
        events_by_stem.get('drums', {}).get('events'),
        bar_s, steps) if 'bass' in events_by_stem else None
    inter = interactions(events_by_stem)
    vars_ = variations(all_patterns)

    payload = {
        'schema': 'v2.0.5/events',
        'referenceId': a.ref,
        'grid': grid,
        'grid_source': 'hypothèse fournie par le profil (Phase A3), pas une sortie de tracker',
        'stem_meta': stem_meta,
        'pairs': inter,
        'patterns': all_patterns,
        'pattern_variations': vars_,
        'tonal': tonal,
        'bass_profile': bass,
        'silences_by_stem': {k: v['silences'] for k, v in events_by_stem.items()},
        'density_by_bar': {k: v['density'] for k, v in events_by_stem.items()},
        'cells_by_bar': {k: v['cells'] for k, v in events_by_stem.items()},
        'events': {k: v['events'] for k, v in events_by_stem.items()},
        'method_notes': [
            'les noms de stems sont des hypothèses de rôle, pas des identifications d’instruments',
            'les événements sont des attaques détectées, pas des notes',
            'les interactions sont des corrélations mesurées, pas des intentions musicales',
        ],
        'elapsed_s': round(__import__('time').time() - t0, 1),
    }

    jpath = os.path.join(a.out, f'events-{a.ref}.json')
    with open(jpath, 'w') as f:
        json.dump(payload, f, ensure_ascii=False)
    with open(os.path.join(a.out, f'events-{a.ref}.csv'), 'w', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['referenceId', 'stemId', 'eventId', 'startSeconds', 'endSeconds', 'eventType', 'strength', 'confidence'])
        for stem, evs in payload['events'].items():
            for e in evs:
                w.writerow([e['referenceId'], e['stemId'], e['eventId'], e['startSeconds'],
                            e['endSeconds'], e['eventType'], e['strength'], e['confidence']])

    total = sum(len(v) for v in payload['events'].values())
    print(f"{a.ref}: {total} événements · {len(all_patterns)} motifs · {len(vars_)} variations · "
          f"{len(inter)} paires · {payload['elapsed_s']} s → {jpath}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
