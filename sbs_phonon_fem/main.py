"""CLI entry point: config -> Study A/B/C -> plots/animation -> validation report.

Usage (from the repo root, with this package on PYTHONPATH):
    python -m sbs_phonon_fem.main --studies all
    python -m sbs_phonon_fem.main --quick --studies a
    python -m sbs_phonon_fem.main --config sbs_phonon_fem/config.yaml --material collagen_gel
"""

import argparse
import os
import time

from .config import SimConfig, load_config
from . import studies, plotting, validation


def parse_args():
    p = argparse.ArgumentParser(description="SBS co-propagating phonon FDTD model")
    p.add_argument("--config", default=None, help="Path to a YAML config file")
    p.add_argument("--material", default=None, help="Override material_name from config")
    p.add_argument("--theta", type=float, default=None, help="Override theta_deg from config")
    p.add_argument(
        "--studies", default="all", choices=["a", "b", "c", "all"],
        help="Which studies to run",
    )
    p.add_argument(
        "--quick", action="store_true",
        help="Coarse/fast settings for smoke-testing the pipeline, not for quantitative results",
    )
    p.add_argument("--out", default=None, help="Output directory (default: config.output_dir)")
    return p.parse_args()


def main():
    args = parse_args()
    config = load_config(args.config)
    if args.material:
        config.material_name = args.material
    if args.theta is not None:
        config.theta_deg = args.theta
    if args.quick:
        config.quick = True
        config.__post_init__()
    if args.out:
        config.output_dir = args.out

    base_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = config.resolve_output_dir(base_dir)

    print(f"Material: {config.material_name} "
          f"(v_L={config.material.v_L} m/s, v_S={config.material.v_S} m/s, "
          f"placeholder={config.material.placeholder})")
    print(f"theta = {config.theta_deg} deg, theta_max (NA={config.NA}) = {config.theta_max_deg:.1f} deg")
    print(f"Output directory: {out_dir}")
    if config.material.placeholder:
        print("WARNING: material constants are literature placeholders, not verified -- "
              "treat quantitative outputs as provisional.")

    study_a_result = None

    run_a = args.studies in ("a", "all")
    run_b = args.studies in ("b", "all")
    run_c = args.studies in ("c", "all")

    if run_a:
        t0 = time.time()
        print("\nRunning Study A (frequency sweep)...")
        study_a_result = studies.run_study_a(config)
        path = plotting.plot_study_a(study_a_result, out_dir)
        f_L = studies.find_resonance(study_a_result["freqs_hz"], study_a_result["amplitudes"]["longitudinal"])
        f_S = studies.find_resonance(study_a_result["freqs_hz"], study_a_result["amplitudes"]["shear"])
        print(f"  f_L peak = {f_L/1e9:.4f} GHz, f_S peak = {f_S/1e9:.4f} GHz  ({time.time()-t0:.1f}s)")
        print(f"  Saved: {path}")

    if run_b:
        t0 = time.time()
        print("\nRunning Study B (ring-angle sweep)...")
        study_b_result = studies.run_study_b(config)
        path = plotting.plot_study_b(study_b_result, out_dir)
        print(f"  ({time.time()-t0:.1f}s) Saved: {path}")

    if run_c:
        t0 = time.time()
        print("\nRunning Study C (time-domain snapshots)...")
        study_c_result = studies.run_study_c(config)
        for pol in ("longitudinal", "shear"):
            path = plotting.animate_study_c(study_c_result, pol, out_dir)
            print(f"  Saved: {path}")
        print(f"  ({time.time()-t0:.1f}s)")

    if study_a_result is not None:
        print("\nRunning validation checkpoints...")
        checks = validation.run_all_checks(config, study_a_result)
        report = validation.format_report(checks)
        print("\n" + report)
        report_path = os.path.join(out_dir, "validation_report.txt")
        with open(report_path, "w") as f:
            f.write(report + "\n")
        print(f"\nSaved: {report_path}")


if __name__ == "__main__":
    main()
