#!/usr/bin/env python3
"""
V2.0.5 — agrège les extractions en modèles de style par univers, et valide.

Deux modes :
  --build   : compose docs/v2.0.5/data/style-<univers>.json à partir des
              extractions événementielles + des mesures Phase A3 déjà validées.
  --check   : contrôles automatiques (bornes, chronologie, couverture, alignement,
              stabilité) et génération des fichiers d'écoute de vérification.

Ce script ne modifie ni les stems, ni les moteurs V1/V2.

Usage :
  python build-style-models.py --build
  python build-style-models.py --check
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'docs/v2.0.5/data')
A3 = os.path.join(ROOT, 'docs/phase-a/data')
AUDIO = os.path.join(ROOT, 'docs/v2.0.5/validation/audio')

REFS = {
    'energetique': {'universe': 'electro-sega', 'label': 'Énergétique / Electro Sega', 'reference': 'Ohwalawa'},
    'dansant': {'universe': 'sega-trad', 'label': 'Dansant / Sega traditionnel', 'reference': 'Tififi'},
    'detendu': {'universe': 'segazz', 'label': 'Détendu / Segazz', 'reference': 'Zistoire'},
}

STEM_FILES = {
    'energetique': {'drums': 'assets/references/ohwalawa/ohwalawa_Energetique_drums.mp3',
                    'mix': 'assets/references/ohwalawa/ohwalawa_Energetique_mix.wav'},
    'dansant': {'drums': 'assets/references/tififi/tififi_Dansant_drums.mp3',
                'mix': 'assets/references/tififi/tififi_Dansant_mix.wav'},
    'detendu': {'drums': 'assets/references/zistoire/zistoire_Detendue_Stems 7-Zistwar-drums.wav',
                'mix': 'assets/references/zistoire/zistoire mix v0.wav'},
}


def load(p):
    with open(p) as f:
        return json.load(f)


def build():
    index = {'schema': 'v2.0.5/style-index', 'universes': []}
    for ref, meta in REFS.items():
        ev = load(os.path.join(DATA, f'events-{ref}.json'))
        arr = load(os.path.join(A3, f'arrangement-{ref}.json'))
        groove = load(os.path.join(A3, f'groove-{ref}.json'))
        base = load(os.path.join(A3, f'reference-{ref}.json'))

        sections = [{
            'kind': s.get('kind') or s.get('label') or 'section',
            'startBar': s['bar0'],
            'endBar': s['bar1'],
            'startS': round((s['bar0'] - 1) * arr['bar_seconds'], 2),
            'durationS': s['seconds'],
            'activeStems': s.get('playing') or s.get('stems') or [],
        } for s in arr.get('sections', [])]

        top_patterns = sorted(ev['patterns'], key=lambda p: -p['occurrences'])[:12]
        model = {
            'schema': 'v2.0.5/reference-style',
            'referenceId': ref,
            'universeId': meta['universe'],
            'label': meta['label'],
            'referenceTitle': meta['reference'],
            'sources': {
                'events': f'events-{ref}.json',
                'arrangement': f'../phase-a/data/arrangement-{ref}.json',
                'groove': f'../phase-a/data/groove-{ref}.json',
                'measures': f'../phase-a/data/reference-{ref}.json',
                'stem_hashes': {k: v['sha256'] for k, v in ev['stem_meta'].items()},
            },
            'time': {
                **ev['grid'],
                'swing': groove['swing']['first_offbeat_position'],
                'swing_reading': groove['swing']['reading'],
                'microtiming_ms': groove['microtiming']['median_ms'],
                'grid_is_hypothesis': True,
            },
            'stems': ev['stem_meta'],
            'arrangement': {
                'barSeconds': arr['bar_seconds'],
                'bars': arr['bars'],
                'sections': sections,
                'section_count': len(sections),
            },
            'rhythm': {
                'patterns': top_patterns,
                'variations': ev['pattern_variations'][:12],
                'cells_distinct_by_stem': {k: len(set(v.values())) for k, v in ev['cells_by_bar'].items()},
                'density_by_stem': {k: round(float(np.mean(list(v.values()))), 2) if v else 0
                                    for k, v in ev['density_by_bar'].items()},
            },
            'bass': ev.get('bass_profile'),
            'tonal': {k: v['counts'] for k, v in ev.get('tonal', {}).items()},
            'tonal_examples': {
                k: [n for n in v['notes'] if n['confidence'] == 'confirmed'][:6]
                for k, v in ev.get('tonal', {}).items()
            },
            'interactions': ev['pairs'],
            'harmony': {
                'key_candidates': (base.get('harmony', {}).get('other_stem')
                                   or base.get('harmony', {}).get('mix') or {}).get('top_key_candidates'),
            },
            'uncertainties': [
                'les noms de stems sont des hypothèses de rôle ; aucun instrument n’est confirmé',
                'les événements sont des attaques détectées, pas des notes jouées',
                'les interactions sont des corrélations mesurées, pas des intentions',
                'la grille temporelle est une hypothèse de profil, pas une sortie de tracker',
            ] + (['aucun centre tonal fiable : ne pas générer d’accords'] if ref == 'dansant' else []),
            'needs_human_validation': _needs_validation(ev, ref),
        }
        out = os.path.join(DATA, f"style-{meta['universe']}.json")
        with open(out, 'w') as f:
            json.dump(model, f, ensure_ascii=False, indent=2)
        index['universes'].append({
            'universeId': meta['universe'], 'referenceId': ref, 'file': os.path.basename(out),
            'sections': len(sections), 'patterns': len(ev['patterns']),
            'events': sum(len(v) for v in ev['events'].values()),
            'bass_reliable': bool(ev.get('bass_profile')),
        })
        print(f"{meta['universe']:14s} {len(sections):3d} sections · {len(ev['patterns']):3d} motifs · "
              f"{sum(len(v) for v in ev['events'].values()):5d} événements → {os.path.basename(out)}")

    with open(os.path.join(DATA, 'style-index.json'), 'w') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"index: {len(index['universes'])} univers")


def _needs_validation(ev, ref):
    out = []
    ambiguous = sum(v['counts']['ambiguous'] for v in ev.get('tonal', {}).values())
    if ambiguous > 200:
        out.append(f'{ambiguous} segments tonals ambigus — transcription à confirmer à l’écoute')
    if ref == 'dansant':
        out.append('roulement continu : aucune transcription rythmique discrète ne doit être supposée')
    if not ev.get('bass_profile'):
        out.append('aucun stem de basse : comportement de basse non mesurable')
    else:
        out.append('hauteur de basse majoritairement ambiguë : utiliser le profil rythmique, pas les notes')
    return out


def check():
    os.makedirs(AUDIO, exist_ok=True)
    results = []
    ok = True

    def chk(name, cond, detail=''):
        nonlocal ok
        results.append({'check': name, 'ok': bool(cond), 'detail': str(detail)[:200]})
        if not cond:
            ok = False
        print(f"{'PASS' if cond else 'FAIL'} {name}  {detail}")

    for ref, meta in REFS.items():
        ev = load(os.path.join(DATA, f'events-{ref}.json'))
        dur = max(v['duration_s'] for v in ev['stem_meta'].values())
        bad_bounds = 0
        bad_dur = 0
        non_monotonic = 0
        for stem, events in ev['events'].items():
            prev = -1
            for e in events:
                if e['startSeconds'] < 0 or e['endSeconds'] > dur + 0.05:
                    bad_bounds += 1
                if e['endSeconds'] <= e['startSeconds']:
                    bad_dur += 1
                if e['startSeconds'] < prev:
                    non_monotonic += 1
                prev = e['startSeconds']
        chk(f'{ref}:events_within_bounds', bad_bounds == 0, f'{bad_bounds} hors bornes')
        chk(f'{ref}:durations_positive', bad_dur == 0, f'{bad_dur} durées invalides')
        chk(f'{ref}:chronology_monotonic', non_monotonic == 0, f'{non_monotonic} inversions')

        # alignement des stems : durées identiques à ±1 échantillon
        durs = [v['duration_s'] for v in ev['stem_meta'].values()]
        chk(f'{ref}:stems_aligned', max(durs) - min(durs) < 0.01, f'écart {max(durs) - min(durs):.4f} s')

        # couverture des sections
        if os.path.exists(os.path.join(DATA, f'style-{meta["universe"]}.json')):
            st = load(os.path.join(DATA, f'style-{meta["universe"]}.json'))
            secs = st['arrangement']['sections']
            gaps = [secs[i + 1]['startBar'] - secs[i]['endBar'] for i in range(len(secs) - 1)]
            chk(f'{ref}:sections_contiguous', all(g == 1 for g in gaps), f'{len(secs)} sections')
            chk(f'{ref}:sections_cover_reference',
                secs[-1]['endBar'] == st['arrangement']['bars'], f"jusqu’à {secs[-1]['endBar']}/{st['arrangement']['bars']}")
            chk(f'{ref}:has_provenance', bool(st['sources']['stem_hashes']), f"{len(st['sources']['stem_hashes'])} empreintes")

        # hauteurs plausibles
        implausible = 0
        for stem, t in ev.get('tonal', {}).items():
            for n in t['notes']:
                if not (25 <= n['pitch_hz'] <= 2000):
                    implausible += 1
        chk(f'{ref}:pitches_in_range', implausible == 0, f'{implausible} hors 25–2000 Hz')

    # fichiers d'écoute : métronome aligné sur la grille de chaque référence
    for ref, files in STEM_FILES.items():
        ev = load(os.path.join(DATA, f'events-{ref}.json'))
        bar = ev['grid']['barSeconds']
        beats = ev['grid']['beatsPerBar']
        dur = max(v['duration_s'] for v in ev['stem_meta'].values())
        out = os.path.join(AUDIO, f'click-{ref}.wav')
        # Clic généré en numpy plutôt qu'en `aevalsrc` : les virgules de la fonction
        # if() sont interprétées comme des séparateurs de filtres par ffmpeg.
        import soundfile as sf
        sr = 44100
        n = int(dur * sr)
        click = np.zeros(n)
        period = bar / beats
        for k in range(int(dur / period) + 1):
            i0 = int(k * period * sr)
            ln = min(int(0.012 * sr), n - i0)
            if ln <= 0:
                break
            tt = np.arange(ln) / sr
            click[i0:i0 + ln] += 0.6 * np.sin(2 * np.pi * 1000 * tt) * np.hanning(ln)
        sf.write(out, click.astype('float32'), sr)
        merged = os.path.join(AUDIO, f'{ref}-drums-with-click.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(ROOT, files['drums']),
                        '-i', out, '-filter_complex',
                        '[0:a]volume=0.75[a];[1:a]volume=0.5[b];[a][b]amix=inputs=2:duration=first',
                        '-ar', '44100', merged], check=True)
        chk(f'{ref}:verification_audio', os.path.exists(merged),
            f"{os.path.basename(merged)} · {os.path.getsize(merged) // 1024} Ko")

    passed = sum(1 for r in results if r['ok'])
    with open(os.path.join(ROOT, 'docs/v2.0.5/validation/checks.json'), 'w') as f:
        json.dump({'generatedAt': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
                   'passed': passed, 'total': len(results), 'results': results}, f, indent=2)
    print(f"\n{passed}/{len(results)} contrôles OK")
    return 0 if ok else 1


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    if a.build:
        build()
    if a.check:
        sys.exit(check())
    if not (a.build or a.check):
        print('utilisez --build ou --check')
