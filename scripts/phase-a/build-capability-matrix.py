#!/usr/bin/env python3
"""
Build the sound-capability matrix used by the V2 engine design.

Reads the measured corpus (docs/phase-a/data/corpus-analysis.json) and the museum
selection (docs/phase-a/sound-selection-v2.csv, ';'-delimited, RETENU rows) and
derives, for every SELECTED sound, a score per musical potential plus a
transformation fitness verdict.

Field names come from the actual corpus schema (classification / rhythm /
spectral / pitch / envelope), verified against the file — an earlier draft of
this script guessed 'harmonicity' and 'roles' keys that do not exist and silently
scored every sound at zero.

Deliberately conservative: a sound is melodic-capable only if the corpus marked
credible_pitch, which itself requires voiced_ratio >= 0.30 AND periodicity >= 0.75.
A detector returning a frequency is not evidence of a usable pitch — that mistake
is what made V1 write bass lines for sounds that have none.

Usage:
  python build-capability-matrix.py [--out docs/phase-a/data/capability-matrix.json]
"""
import argparse
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def clamp(x):
    return round(max(0.0, min(1.0, float(x))), 2)


def potentials(s):
    cl = s.get('classification') or {}
    sp = s.get('spectral') or {}
    rh = s.get('rhythm') or {}
    pi = s.get('pitch') or {}
    env = s.get('envelope') or {}

    periodicity = max(0.0, float(pi.get('periodicity') or 0.0))
    onset_rate = float(rh.get('onset_rate_per_s') or 0.0)
    low_pct = float(cl.get('low_band_share_pct') or 0.0)
    high_pct = float(cl.get('high_band_share_pct') or 0.0)
    flatness = float(sp.get('flatness') or 0.0)
    credible = bool(cl.get('credible_pitch'))
    decay_ms = float(env.get('decay_ms') or 0.0)
    dur_s = float(s.get('duration_s') or 1.0)
    # 'sustained' in the corpus means few onsets; combine with decay vs duration
    sustain = min(1.0, (decay_ms / 1000.0) / max(dur_s * 0.5, 0.001)) if dur_s else 0.0

    return {
        'rhythmic': clamp(onset_rate / 8.0 * 0.7 + (1.0 if cl.get('rhythmic') else 0.0) * 0.3),
        'percussive': clamp((1.0 if cl.get('transient_heavy') else 0.0) * 0.7
                            + max(0.0, (float(s.get('crest_factor_db') or 0) - 8) / 20) * 0.3),
        # melodic: only a credible pitch counts; periodicity alone cannot carry a line
        'melodic': clamp(1.0 if credible else periodicity * 0.35),
        'harmonic': clamp(periodicity if cl.get('tonal') else periodicity * 0.5),
        'low': clamp(low_pct / 60.0),
        'textural': clamp((1.0 if cl.get('sustained') else 0.0) * 0.5 + sustain * 0.3 + flatness * 0.2),
        'atmospheric': clamp(high_pct / 40.0 * 0.6 + flatness * 0.4),
    }


def transform_fitness(s, pot):
    cl = s.get('classification') or {}
    sp = s.get('spectral') or {}
    rh = s.get('rhythm') or {}
    onset_rate = float(rh.get('onset_rate_per_s') or 0.0)
    centroid = float(sp.get('centroid_hz') or 0.0)
    notes = []

    stretch = 'safe' if (cl.get('sustained') and onset_rate <= 2.0) else 'risky'
    if stretch == 'risky':
        notes.append('dense transients: time-stretch smears attacks, prefer slicing')
    pitch = 'safe' if cl.get('credible_pitch') else 'not applicable'
    if pitch == 'not applicable':
        notes.append('no credible pitch: pitch-shift colours the sound, it will not tune it')
    granular = 'good' if (cl.get('sustained') and not cl.get('transient_heavy')) else 'poor'
    if granular == 'poor':
        notes.append('articulated material: grains duplicate transients')
    low_derivation = 'plausible' if centroid < 1200 else 'unlikely'
    if low_derivation == 'unlikely':
        notes.append('spectrum centred high: a derived bass would be a new sound, not the visitor’s')
    return {'time_stretch': stretch, 'pitch_shift': pitch, 'granular': granular,
            'low_derivation': low_derivation, 'notes': notes}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', default=os.path.join(ROOT, 'docs/phase-a/data/corpus-analysis.json'))
    ap.add_argument('--selection', default=os.path.join(ROOT, 'docs/phase-a/sound-selection-v2.csv'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'docs/phase-a/data/capability-matrix.json'))
    a = ap.parse_args()

    corpus = json.load(open(a.corpus))
    by_id = {s['id']: s for s in corpus['sounds']}

    # ';'-delimited export with a BOM; only RETENU rows are museum-selected
    selected, meta = [], {}
    with open(a.selection, newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f, delimiter=';'):
            if (row.get('statut') or '').strip().upper() != 'RETENU':
                continue
            sid = (row.get('code') or '').strip()
            if not sid:
                continue
            selected.append(sid)
            meta[sid] = row

    out = {'source': 'corpus-analysis.json + sound-selection-v2.csv (RETENU only)',
           'generated_by': 'scripts/phase-a/build-capability-matrix.py',
           'selected_count': len(selected), 'sounds': []}

    for sid in selected:
        s = by_id.get(sid)
        m = meta.get(sid, {})
        if not s:
            out['sounds'].append({'id': sid, 'error': 'absent du corpus mesuré'})
            continue
        pot = potentials(s)
        ranked = sorted(pot.items(), key=lambda kv: -kv[1])
        cl = s.get('classification') or {}
        restricted = bool((s.get('catalog') or {}).get('sensitive')) or (m.get('sensible', '').lower() == 'oui')
        out['sounds'].append({
            'id': sid,
            'name': (s.get('catalog') or {}).get('name'),
            'pdf_title': m.get('title_catalogue'),
            'step_id': int(m['etape_pdf']) if (m.get('etape_pdf') or '').isdigit() else None,
            'sensitive': restricted,
            'potential': pot,
            # A restricted sound is measured like any other (analysis is neutral) but
            # is NEVER given a composition role: that would read as permission.
            'best_roles': [] if restricted else [r for r, v in ranked[:3] if v >= 0.30],
            'roles_withheld_reason': ('restriction éditoriale : aucun rôle de composition attribué'
                                      if restricted else None),
            'role_hypotheses': cl.get('role_hypotheses') or [],
            'pitch_reliability': {
                'periodicity': round(float((s.get('pitch') or {}).get('periodicity') or 0), 2),
                'voiced_ratio': round(float((s.get('pitch') or {}).get('voiced_ratio') or 0), 2),
                'median_hz': (s.get('pitch') or {}).get('median_hz'),
                'credible_pitch': bool(cl.get('credible_pitch')),
                'bass_capable': bool(cl.get('bass_capable')),
            },
            'transform_fitness': transform_fitness(s, pot),
        })

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(out, open(a.out, 'w'), indent=2, ensure_ascii=False)
    print(f"wrote {a.out}: {len(out['sounds'])} selected sounds")
    for s in out['sounds']:
        if s.get('error'):
            print(f"  {s['id']}: {s['error']}")
            continue
        pr = s['pitch_reliability']
        print(f"  {s['id']:6s} {','.join(s['best_roles']) or '—':26s} "
              f"pitch={'YES' if pr['credible_pitch'] else 'no ':3s} "
              f"bass={'yes' if pr['bass_capable'] else 'no ':3s} "
              f"stretch={s['transform_fitness']['time_stretch']:6s} low={s['transform_fitness']['low_derivation']}")


if __name__ == '__main__':
    main()
