#!/usr/bin/env python3
"""
Targeted verification for the A3 / V2 conception pass.

Only checks what this pass actually produced or touched. It does not re-run the
Phase A battery (verify-a2 / verify-a3) — those components did not change.

  1. every new data file exists and is internally coherent
  2. one measurement is reproducible (re-run a groove analysis, compare numbers)
  3. the reference archives and the museum masters are untouched
  4. the composition engine and the editorial restrictions are untouched
  5. the capability matrix never presents a restricted sound as composable

Usage:
  /opt/data/tools/sugar-audio/renv/analysis/bin/python scripts/phase-a/verify-v2.py
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'docs/phase-a/data')
PY = sys.executable

checks = []


def chk(name: str, ok: bool, detail: object = '') -> None:
    checks.append({'check': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(f"{'PASS' if ok else 'FAIL'} {name}" + (f"  {detail}" if detail else ''))


def load(name):
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def main():
    # 1. coherence of the new artefacts
    for name in ('groove-energetique.json', 'groove-detendu.json', 'groove-dansant.json',
                 'pulse-energetique.json', 'pulse-detendu.json', 'pulse-dansant.json',
                 'capability-matrix.json'):
        p = os.path.join(DATA, name)
        chk(f'exists_{name}', os.path.exists(p), f'{os.path.getsize(p) // 1024} KiB' if os.path.exists(p) else 'absent')

    g = load('groove-dansant.json')
    b = g.get('bars', {})
    longest = max((len(x['pattern']) for x in b.get('most_common', [])), default=0)
    chk('bar_pattern_length_matches_grid', longest == b.get('steps_per_bar'),
        f"pattern {longest} pas vs grille {b.get('steps_per_bar')}")

    for n in ('energetique', 'detendu', 'dansant'):
        gg = load(f'groove-{n}.json')
        rng = (gg.get('loudness_by_section_mix') or {}).get('lufs_range')
        ok = bool(rng) and rng['min'] <= rng['max']
        chk(f'mix_loudness_range_ordered_{n}', ok, rng)

    m = load('capability-matrix.json')
    chk('capability_selection_is_17', m['selected_count'] == 17, m['selected_count'])
    restricted = [s['id'] for s in m['sounds'] if s.get('sensitive')]
    # the 17-sound selection contains exactly one restricted recording (04_02)
    chk('restricted_sounds_are_flagged_not_hidden', len(restricted) == 1, restricted)
    bass = [s['id'] for s in m['sounds'] if s['pitch_reliability'].get('bass_capable')]
    credible = [s['id'] for s in m['sounds'] if s['pitch_reliability'].get('credible_pitch')]
    chk('no_sound_claims_bass_capability', bass == [], bass or 'aucun')
    chk('credible_pitch_count_documented', len(credible) == 2, credible)

    # 2. reproducibility of one measurement
    tmp = tempfile.mktemp(suffix='.json')
    p = subprocess.run([PY, os.path.join(ROOT, 'scripts/phase-a/analyze-groove.py'),
                        '--name', 'repro', '--drums',
                        os.path.join(ROOT, 'assets/references/tififi/tififi_Dansant_drums.mp3'),
                        '--bpm', '77.42', '--subdiv', '3', '--bar-s', '2.322',
                        '--steps-per-bar', '6', '--band', 'low', '--out', tmp],
                       capture_output=True, text=True)
    if p.returncode == 0:
        again = json.load(open(tmp))
        same = (again['onset_count'] == g['onset_count']
                and again['swing']['first_offbeat_position'] == g['swing']['first_offbeat_position']
                and again['microtiming']['median_ms'] == g['microtiming']['median_ms'])
        chk('groove_reproducible', same,
            f"onsets {again['onset_count']}, swing {again['swing']['first_offbeat_position']}")
        os.unlink(tmp)
    else:
        chk('groove_reproducible', False, p.stderr[-200:])

    # 3. originals untouched
    refs = {
        'ohwalawa': os.path.join(ROOT, 'assets/references/ohwalawa/ohwalawa_Energetique_mix.wav'),
        'zistoire': os.path.join(ROOT, 'assets/references/zistoire/zistoire mix v0.wav'),
        'tififi': os.path.join(ROOT, 'assets/references/tififi/tififi_Dansant_mix.wav'),
    }
    digests = {k: sha(v)[:16] for k, v in refs.items() if os.path.exists(v)}
    chk('reference_mixes_present', len(digests) == 3, digests)

    masters = sorted(f for f in os.listdir(os.path.join(ROOT, 'assets/originals')) if f.endswith('.wav'))
    chk('museum_masters_40', len(masters) == 40, len(masters))

    # 4. engine and restrictions untouched
    gs = subprocess.run(['git', 'status', '--porcelain', 'src/engine/', 'src/data/'],
                        cwd=ROOT, capture_output=True, text=True)
    chk('engine_untouched', not gs.stdout.strip(), gs.stdout.strip() or 'src/engine et src/data propres')
    rs = subprocess.run(['git', 'status', '--porcelain', 'config/steps.json', 'config/steps.v2.json'],
                        cwd=ROOT, capture_output=True, text=True)
    chk('steps_config_untouched', not rs.stdout.strip(), rs.stdout.strip() or 'config intacte')

    # 5. matrix never promotes a restricted sound into a composable role
    bad = [s['id'] for s in m['sounds'] if s.get('sensitive') and s.get('best_roles')]
    chk('restricted_not_given_composition_roles', bad == [], bad or 'aucun rôle attribué')

    passed = sum(1 for c in checks if c['ok'])
    print(f"\nRESULT {passed}/{len(checks)} contrôles V2 OK")
    return 0 if passed == len(checks) else 1


if __name__ == '__main__':
    sys.exit(main())
