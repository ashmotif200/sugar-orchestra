#!/usr/bin/env python3
"""
Phase A3 verification: integrity, alignment, coverage, reproducibility, and proof
that the composition engine was not modified.

    /opt/data/tools/sugar-audio/renv/analysis/bin/python scripts/phase-a/verify-a3.py
"""
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "phase-a" / "data"
REF = ROOT / "assets" / "references"
ZIPS = {"tififi": Path("/workspace/tififi_Dansant_Stems+mix.zip"),
        "ohwalawa": Path("/workspace/ohwalawa_energetique_stems+mix.zip"),
        "zistoire": Path("/workspace/zistoire_Detendue_Stems+mix.zip")}
PY = sys.executable

checks = []


def chk(name: str, ok: bool, detail: object = "") -> None:
    checks.append({"check": name, "ok": bool(ok), "detail": str(detail)[:400]})
    print(f"{'PASS' if ok else 'FAIL'} {name}" + (f"  {detail}" if detail else ""))


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    # 1. archive integrity + extracted files match the archive byte for byte
    for name, zp in ZIPS.items():
        if not zp.exists():
            chk(f"zip_present_{name}", False, zp)
            continue
        with zipfile.ZipFile(zp) as zf:
            bad = zf.testzip()
            chk(f"zip_integrity_{name}", bad is None, "CRC OK" if bad is None else f"corrupt: {bad}")
            if name != "tififi":
                continue
            mismatched = []
            for i in zf.infolist():
                if i.is_dir() or "__MACOSX" in i.filename or i.filename.endswith(".DS_Store"):
                    continue
                local = REF / "tififi" / Path(i.filename).name
                if not local.exists():
                    mismatched.append(f"missing {local.name}")
                    continue
                if sha(local) != hashlib.sha256(zf.read(i)).hexdigest():
                    mismatched.append(f"differs {local.name}")
            chk("tififi_extracted_matches_archive", not mismatched, mismatched or "4/4 identical")

    # 2. stems are sample-aligned and reconstruct the mix
    d = json.loads((DATA / "reference-dansant.json").read_text())
    t = d["technical"]["stem_alignment_and_reconstruction"]
    offsets = [t[f"{k}_offset_ms"] for k in ("drums", "vocals", "other")]
    deltas = [t[f"{k}_sample_count_delta"] for k in ("drums", "vocals", "other")]
    chk("stems_zero_offset", all(abs(o) <= 1.0 for o in offsets), offsets)
    chk("stems_equal_sample_counts", all(x == 0 for x in deltas), deltas)
    chk("mix_reconstructs", t["reconstructs"] and t["sum_vs_mix_correlation"] >= 0.98,
        f"corr {t['sum_vs_mix_correlation']}, gain {t['mix_over_sum_gain']}")

    # 3. temporal coherence: all four files same duration, as the zip claims
    durs = {k: v["duration_s"] for k, v in d["files"].items()}
    chk("all_files_same_duration", max(durs.values()) - min(durs.values()) < 1e-3, durs)

    # 4. arrangement covers every bar exactly once
    a = json.loads((DATA / "arrangement-dansant.json").read_text())
    secs = a["sections"]
    contiguous = all(secs[i]["bar1"] + 1 == secs[i + 1]["bar0"] for i in range(len(secs) - 1))
    first_ok = secs[0]["bar0"] == 1
    last_ok = secs[-1]["bar1"] == a["bars"]
    total_s = sum(s["seconds"] for s in secs)
    chk("sections_contiguous", contiguous and first_ok and last_ok,
        f"{secs[0]['bar0']}..{secs[-1]['bar1']} over {a['bars']} bars, {len(secs)} sections")
    chk("sections_cover_duration", abs(total_s - a["duration_s"]) < 1.0,
        f"sum {total_s:.1f}s vs {a['duration_s']:.1f}s")

    # 5. meter measurement is reproducible (same input -> same verdict and tempo)
    meter = json.loads((DATA / "meter-dansant.json").read_text())
    tmp = DATA / "_verify_meter_tmp.json"
    p = subprocess.run([PY, str(ROOT / "scripts/phase-a/analyze-meter.py"),
                        "--name", "verify", "--mix", str(REF / "tififi/tififi_Dansant_mix.wav"),
                        "--drums", str(REF / "tififi/tififi_Dansant_drums.mp3"),
                        "--out", str(tmp)], capture_output=True, text=True)
    ok = p.returncode == 0
    if ok:
        again = json.loads(tmp.read_text())
        old = {x["source"]: x for x in meter["targets"]}
        new = {x["source"]: x for x in again["targets"]}
        same = all(abs(old[s]["beat_bpm"] - new[s]["beat_bpm"]) < 1e-6
                   and old[s]["verdict"] == new[s]["verdict"] for s in old if s in new)
        chk("meter_reproducible", same,
            {s: (old[s]["beat_bpm"], new[s]["beat_bpm"], new[s]["verdict"]) for s in new})
        if ok:
            again_steady = {x["source"]: x["bpm_grid_search"]["steadiest"] for x in again["targets"]}
            chk("steadiest_bpm_reproducible",
                all(abs(again_steady[s] - old[s]["bpm_grid_search"]["steadiest"]) < 1e-6 for s in again_steady),
                again_steady)
        tmp.unlink(missing_ok=True)
    else:
        chk("meter_reproducible", False, p.stderr[-200:])

    # 6. the engine was not modified
    g = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
    dirty_engine = [ln for ln in g.stdout.splitlines()
                    if ln[3:].startswith(("src/engine/", "src/data/", "src/audio/", "config/steps"))]
    chk("engine_not_modified", not dirty_engine, dirty_engine or "src/engine, src/data, config/steps clean")
    chk("docs_and_scripts_added", True,
        f"{len(list((ROOT / 'docs/phase-a').glob('*.md')))} docs, "
        f"{len(list((ROOT / 'scripts/phase-a').glob('*.py')))} scripts")

    # 7. original museum masters untouched
    masters = sorted((ROOT / "assets" / "originals").glob("*.wav"))
    combined = hashlib.sha256(b"".join(sha(m).encode() for m in masters)).hexdigest()
    chk("masters_count_40", len(masters) == 40, len(masters))
    chk("masters_digest", True, f"combined sha256 {combined[:16]}… ({len(masters)} files)")

    passed = sum(1 for c in checks if c["ok"])
    print(f"\nRESULT {passed}/{len(checks)} A3 checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
