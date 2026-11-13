#!/usr/bin/env python3
"""Vérification de la 2e passe de Phase A (A1 sélection + A3 références).

Contrôles indépendants des affirmations des documents :
  1. le CSV de sélection couvre les 40 sons, une fois chacun ;
  2. config/steps.v2.json est cohérent avec le catalogue ET avec le CSV ;
  3. les restrictions éditoriales sont intactes (aucune levée, aucun son
     sensible proposé à l'usage musical) ;
  4. les mesures de référence sont cohérentes entre elles (BPM ↔ mesure,
     reconstruction des stems, durées) ;
  5. les sections d'arrangement couvrent toutes les mesures sans trou ;
  6. les WAV originaux sont bit-à-bit identiques à ceux du ZIP fourni.
"""
import csv, hashlib, json, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ok, fail = [], []

def check(name, cond, detail=''):
    (ok if cond else fail).append(f"{name}{' — ' + detail if detail else ''}")

catalog = json.loads((ROOT / 'src/data/catalog.json').read_text())
sounds = {s['code']: s for s in catalog['sounds']}

# 1. CSV
rows = list(csv.DictReader((ROOT / 'docs/phase-a/sound-selection-v2.csv').open(encoding='utf-8'), delimiter=';'))
check('CSV : 40 lignes', len(rows) == 40, f"{len(rows)}")
codes = [r['code'] for r in rows]
check('CSV : codes uniques', len(set(codes)) == len(codes))
check('CSV : tous les codes du catalogue', set(codes) == set(sounds))
retenus = [r for r in rows if r['statut'] == 'RETENU']
check('CSV : au moins 10 sons retenus', len(retenus) >= 10, f"{len(retenus)}")

# 2. config v2
cfg = json.loads((ROOT / 'config/steps.v2.json').read_text())
check('config : 7 étapes', len(cfg['steps']) == 7, f"{len(cfg['steps'])}")
check('config : version 2', cfg.get('version') == 2)
cfg_codes = [s['code'] for st in cfg['steps'] for s in st['sounds']]
check('config : codes existants', all(c in sounds for c in cfg_codes), str([c for c in cfg_codes if c not in sounds]))
check('config : pas de doublon entre étapes', len(cfg_codes) == len(set(cfg_codes)))
check('config : mêmes codes que le CSV', set(cfg_codes) == {r['code'] for r in retenus})
check('config : chaque étape a au moins un son', all(st['sounds'] for st in cfg['steps']))

# 3. restrictions éditoriales
bad = [s['code'] for st in cfg['steps'] for s in st['sounds']
       if (sounds[s['code']].get('availability') == 'not_musical' or sounds[s['code']].get('sensitive')) and not s['sensitive']]
check('restrictions : aucun son sensible déclaré utilisable', not bad, str(bad))
mismatch = [s['code'] for st in cfg['steps'] for s in st['sounds']
            if s['availability'] != sounds[s['code']].get('availability', 'available')]
check('restrictions : disponibilités recopiées du catalogue', not mismatch, str(mismatch))
step4 = [st for st in cfg['steps'] if st['id'] == 4][0]
check('restrictions : étape 4 marquée restreinte', step4.get('restricted') is True)
check('restrictions : étape 4 contient des sons sensibles',
      any(s['sensitive'] for s in step4['sounds']))

# 4. cohérence des mesures de référence
for tag in ('energetique', 'detendu'):
    ref = json.loads((ROOT / f'docs/phase-a/data/reference-{tag}.json').read_text())
    arr = json.loads((ROOT / f'docs/phase-a/data/arrangement-{tag}.json').read_text())
    bpm = ref['rhythm']['beat']['bpm']
    bar = ref['arrangement']['mix_timeline']['bar_seconds']
    check(f'{tag} : mesure = 4 temps au BPM suivi', abs(bar - 240 / bpm) / bar < 0.02,
          f"mesure {bar}s vs {round(240/bpm,3)}s")
    rec = ref['technical']['stem_alignment_and_reconstruction']
    check(f'{tag} : stems reconstruisent le mix', rec['sum_vs_mix_correlation'] >= 0.98,
          f"corr {rec['sum_vs_mix_correlation']}")
    dur = ref['files']['mix']['duration_s']
    check(f'{tag} : durée > 45 s', dur > 45, f"{dur}s")
    # 5. sections
    sections = arr['sections']
    covered = []
    for s in sections:
        covered += list(range(s['bar0'], s['bar1'] + 1))
    check(f'{tag} : sections sans trou ni recouvrement',
          covered == list(range(1, arr['bars'] + 1)), f"{len(covered)} mes. couvertes / {arr['bars']}")
    for name, stem in arr['stems'].items():
        check(f'{tag} : {name} RMS par mesure complet', len(stem['bar_rms_db']) == arr['bars'])

# 6. originaux intacts
zp = Path('/workspace/Sons_sucre_40_pistes_20s.zip')
if zp.exists():
    with zipfile.ZipFile(zp) as z:
        diffs = []
        for info in z.infolist():
            if info.is_dir() or not info.filename.lower().endswith('.wav'):
                continue
            base = Path(info.filename).name
            # les originaux sont conservés sous leur code (01_01.wav), pas sous
            # leur nom de fichier d'origine
            m = __import__('re').match(r'(\d{2}_\d{2})', base)
            if not m:
                continue
            local = ROOT / 'assets/originals' / f"{m.group(1)}.wav"
            if not local.exists():
                diffs.append(f"absent:{base}"); continue
            a = hashlib.sha256(z.read(info)).hexdigest()
            b = hashlib.sha256(local.read_bytes()).hexdigest()
            if a != b: diffs.append(base)
        check('originaux : 40 WAV identiques au ZIP', not diffs, str(diffs[:3]))
else:
    check('originaux : ZIP source présent', False, str(zp))

# 7. documents
for doc, needles in {
    'reference-analysis-ohwalawa.md': ['LUFS', '135', 'basse', 'stems'],
    'reference-analysis-detendue.md': ['LUFS', '133', 'si mineur', 'stems'],
    'arrangement-sheet-energetique.md': ['Contrat d', '135 BPM', 'Décision requise'],
    'arrangement-sheet-detendu.md': ['Contrat d', '134 BPM', 'Décision requise'],
    'sound-selection-v2.md': ['correspondance', 'Ambiguïtés'],
}.items():
    p = ROOT / 'docs/phase-a' / doc
    text = p.read_text(encoding='utf-8') if p.exists() else ''
    missing = [n for n in needles if n not in text]
    check(f'doc {doc}', p.exists() and not missing, f"manque {missing}")

print(f"\n{len(ok)}/{len(ok)+len(fail)} contrôles OK")
for f in fail: print('  ÉCHEC:', f)
if fail: sys.exit(1)
