#!/usr/bin/env python3
"""
Verification harness for the Phase A scripts.

Checks the things that can actually break:
  1. every script compiles;
  2. the pure classification logic behaves on known inputs (unit level);
  3. the two report generators are IDEMPOTENT — regenerating produces byte-identical
     deliverables, which is what makes them safe to re-run;
  4. analyze-reference recovers the ground truth of the synthetic stems.

Run with the toolchain interpreter (librosa/numpy live there):

    /opt/data/tools/sugar-audio/renv/analysis/bin/python scripts/phase-a/verify.py

Exit 0 = all checks passed.
"""
import hashlib
import importlib.util
import json
import py_compile
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PA = ROOT / "scripts" / "phase-a"
DOCS = ROOT / "docs" / "phase-a"
SCRIPTS = ["analyze-corpus.py", "analyze-reference.py", "build-capability-report.py",
           "build-selection-mapping.py", "make-synthetic-reference.py"]

checks = []


def chk(name, ok, detail=""):
    checks.append({"check": name, "ok": bool(ok), "detail": str(detail)[:300]})
    print(f"{'PASS' if ok else 'FAIL'} {name}" + (f"  {detail}" if detail else ""))


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def main():
    # 1. compile
    bad = []
    with tempfile.TemporaryDirectory() as td:
        for s in SCRIPTS:
            try:
                py_compile.compile(str(PA / s), doraise=True, cfile=str(Path(td) / "x.pyc"))
            except py_compile.PyCompileError as e:
                bad.append(f"{s}: {e.msg}")
    chk("all_scripts_compile", not bad,
        ", ".join(bad) if bad else f"{len(SCRIPTS)} scripts")

    # 2. classification logic, on constructed metric dicts with known intent
    ac = load(PA / "analyze-corpus.py", "ac")

    def metrics(low, per, med, harm=0.0, flat=0.5, onrate=1.0, crest=10.0,
                prev=0.9, voiced=0.8, pulse=0.0):
        bands = {"0-80Hz": low * 0.6, "80-250Hz": low * 0.4, "250-2000Hz": 20.0,
                 "2000-8000Hz": 10.0, "8000-16000Hz": 2.0}
        return {"spectral": {"flatness": flat, "band_share_pct": bands},
                "hpss": {"harmonic_share": harm},
                "rhythm": {"onset_rate_per_s": onrate, "pulse_strength": pulse},
                "pitch": {"median_hz": med, "prevalence": prev, "voiced_ratio": voiced,
                          "periodicity": per},
                "crest_factor_db": crest}

    bass_like = ac.classify(metrics(low=80, per=0.90, med=73.0, harm=0.7, flat=0.005))
    noise_like = ac.classify(metrics(low=10, per=0.02, med=42.0, harm=0.1, flat=0.8))
    high_tonal = ac.classify(metrics(low=5, per=0.95, med=844.0, harm=0.4, flat=0.01))
    rumble = ac.classify(metrics(low=96, per=-0.05, med=40.0, harm=0.9, flat=0.0, onrate=9.9))

    chk("classify_bass_when_low_and_periodic", "bass" in bass_like["role_hypotheses"],
        bass_like["role_hypotheses"])
    chk("classify_no_bass_for_noise", "bass" not in noise_like["role_hypotheses"],
        noise_like["role_hypotheses"])
    chk("classify_melodic_above_220", "melodic" in high_tonal["role_hypotheses"],
        high_tonal["role_hypotheses"])
    # The volcano case: 96 % of energy low, but periodic structure absent.
    chk("classify_rumble_is_not_bass", "bass" not in rumble["role_hypotheses"],
        rumble["role_hypotheses"])

    # 3. generators are idempotent -> safe to re-run
    deliverables = ["sound-selection-mapping.md", "sound-selection-mapping.csv",
                    "museum-sound-musical-capabilities.md"]
    before = {f: sha(DOCS / f) for f in deliverables if (DOCS / f).exists()}
    for script in ("build-selection-mapping.py", "build-capability-report.py"):
        p = subprocess.run([sys.executable, str(PA / script)], capture_output=True, text=True)
        chk(f"{script}_runs", p.returncode == 0, (p.stderr or p.stdout).strip()[-160:])
    after = {f: sha(DOCS / f) for f in deliverables if (DOCS / f).exists()}
    chk("generators_idempotent", before == after and len(before) == 3,
        "identical bytes" if before == after else f"changed: {[k for k in before if before[k] != after.get(k)]}")

    # 4. reference pipeline recovers the synthetic ground truth
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        stems = td / "stems"
        g = subprocess.run([sys.executable, str(PA / "make-synthetic-reference.py"),
                            "--out", str(stems)], capture_output=True, text=True)
        chk("synthetic_reference_built", g.returncode == 0, g.stderr.strip()[-160:])
        out = td / "analysis.json"
        a = subprocess.run([sys.executable, str(PA / "analyze-reference.py"),
                            "--mix", str(stems / "zistoire mix v0.wav"),
                            "--drums", str(stems / "Zistwar-drums.wav"),
                            "--bass", str(stems / "Zistwar-bass.wav"),
                            "--other", str(stems / "Zistwar-other.wav"),
                            "--out", str(out)], capture_output=True, text=True)
        chk("analyze_reference_runs", a.returncode == 0, a.stderr.strip()[-200:])
        d = json.loads(out.read_text())
        tech = d["technical"]["stem_alignment_and_reconstruction"]
        rh, ba, ha = d["rhythm"], d["bass"]["stem"], d["harmony"]["other_stem"]

        chk("tempo_within_2pct_of_88", abs(rh["beat"]["bpm"] - 88) / 88 < 0.02,
            f"{rh['beat']['bpm']} BPM")
        chk("mix_reconstructs_from_stems", tech["reconstructs"] is True,
            f"corr {tech['sum_vs_mix_correlation']}")
        chk("stems_sample_aligned", tech["drums_sample_count_delta"] == 0
            and abs(tech["drums_offset_ms"]) <= 12.0,
            f"drums offset {tech['drums_offset_ms']} ms")
        chk("bar_count_is_8", len(d["arrangement"]["mix_timeline"]["bars"]) == 8,
            f"{len(d['arrangement']['mix_timeline']['bars'])} bars")
        chk("key_D_minor_first", ha["top_key_candidates"][0]["key"] == "D minor",
            ha["top_key_candidates"][0])
        midis = [n["midi"] for n in ba["notes"] if n["midi"] is not None][:4]
        chk("bass_notes_are_D2", midis == [38, 38, 38, 38], f"{midis} (D2 = 38)")
        chk("swing_recovered", abs((rh["swing_syncopation"]["first_offbeat_position"] or 0) - 0.62) < 0.05,
            rh["swing_syncopation"]["first_offbeat_position"])

    passed = sum(1 for c in checks if c["ok"])
    print(f"\nRESULT {passed}/{len(checks)} phase-a script checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
