"""Validation checkpoints (spec section 5). All three must pass before Study A/B/C
outputs are trusted."""

import math
from dataclasses import dataclass

import numpy as np

from .config import SimConfig
from .materials import Material, MATERIALS
from .fdtd import ElasticFDTD2D
from .studies import build_mesh, run_single_frequency, find_resonance


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str


def check_analytic_cross_check(config: SimConfig, study_a_result: dict, tol_frac: float = 0.15) -> CheckResult:
    freqs = study_a_result["freqs_hz"]
    amps = study_a_result["amplitudes"]["longitudinal"]
    theta = study_a_result["theta_deg"]
    material = study_a_result["material"]

    f_numeric = find_resonance(freqs, amps)
    f_analytic = config.f_B_analytic(theta, material.v_L)
    err = abs(f_numeric - f_analytic) / f_analytic

    passed = err <= tol_frac
    detail = (
        f"numeric f_L = {f_numeric/1e9:.4f} GHz vs analytic f_B = {f_analytic/1e9:.4f} GHz "
        f"(rel. error {err*100:.1f}%, tolerance {tol_frac*100:.0f}%; tolerance is loose because "
        f"the sweep grid + finite forcing-spot bandwidth broaden the peak)"
    )
    return CheckResult("Analytic cross-check (Study A longitudinal peak vs f_B)", passed, detail)


def check_zero_shear(config: SimConfig, theta_deg: float | None = None, ratio_tol: float = 0.2) -> CheckResult:
    """Drive both water (mu~0) and a real-shear-modulus reference material with the
    *same* frequency window -- centered on the reference material's own analytic
    f_S, since that is the window where a genuine shear resonance would appear --
    and confirm water shows negligible response there. Using each material's own
    independently-sized sweep window would let water's window sit far from any
    reference feature and trivially "pass" without testing anything."""
    theta_deg = theta_deg if theta_deg is not None else config.theta_deg
    water = MATERIALS["water"]
    reference = config.material if config.material_name != "water" else MATERIALS["collagen_gel"]

    q = config.q_of_theta(theta_deg)
    f_S_ref = config.f_B_analytic(theta_deg, reference.v_S)
    freqs_hz = np.linspace(0.3 * f_S_ref, 2.0 * f_S_ref, max(config.n_freq_steps // 2, 8))

    mesh_water = build_mesh(config, water, freqs_hz.max(), q)
    amps_water = np.array([
        run_single_frequency(config, water, mesh_water, q, f, "shear")["amplitude"] for f in freqs_hz
    ])

    mesh_ref = build_mesh(config, reference, freqs_hz.max(), q)
    amps_ref = np.array([
        run_single_frequency(config, reference, mesh_ref, q, f, "shear")["amplitude"] for f in freqs_hz
    ])

    peak_water = amps_water.max()
    peak_ref = amps_ref.max()
    ratio = peak_water / peak_ref if peak_ref > 0 else float("inf")

    passed = ratio <= ratio_tol
    detail = (
        f"water (mu~0) shear peak = {peak_water:.3e} vs {reference.name} (mu={reference.mu:.2e} Pa) "
        f"shear peak = {peak_ref:.3e}; ratio = {ratio:.3f} (must be <= {ratio_tol})"
    )
    return CheckResult("Zero-shear-modulus sanity check (water shear response negligible)", passed, detail)


def check_boundary_absorption(config: SimConfig, material: Material | None = None, decay_tol: float = 0.05) -> CheckResult:
    """Release a localized initial velocity pulse with no forcing and confirm
    energy at a near-boundary probe decays monotonically after its initial peak,
    i.e. no reflected-wave re-growth.

    The pulse is seeded as an initial *velocity* field, not displacement: the
    solver's dynamics are driven by stress divergence, and stress starts at
    zero regardless of any initial ux/uy, so a displacement-only IC would
    never actually launch a propagating disturbance. An initial velocity
    bump couples directly into the stress-rate update on the very next step.
    """
    material = material or config.material
    q_dummy = config.q_of_theta(config.theta_deg)
    mesh = build_mesh(config, material, config.freq_max_ghz * 1e9, q_dummy)

    damping_layer_cells = max(int(config.damping_layer_fraction * mesh.nx), 8)
    solver = ElasticFDTD2D(
        nx=mesh.nx, ny=mesh.ny, dx=mesh.dx,
        rho=material.rho, lam=material.lam, mu=material.mu,
        eta=config.kelvin_voigt_eta,
        damping_layer_cells=damping_layer_cells,
        target_boundary_reflection=config.target_boundary_reflection,
        v_ref=material.v_L,
    )

    r2 = mesh.X ** 2 + mesh.Y ** 2
    pulse_waist = 3 * config.forcing_waist_m
    solver.vx += 1.0 * np.exp(-r2 / pulse_waist ** 2)

    dt = solver.cfl_dt(config.courant_number)
    domain_crossing_time = (mesh.Lx / 2) / material.v_L
    n_steps = int(4.0 * domain_crossing_time / dt)

    probe_i = max(mesh.nx - damping_layer_cells - 2, mesh.nx // 2 + 1)
    probe_j = mesh.ny // 2
    energy = np.empty(n_steps)
    for step in range(n_steps):
        solver.step(dt)
        energy[step] = solver.vx[probe_i, probe_j] ** 2 + solver.vy[probe_i, probe_j] ** 2

    peak_idx = int(np.argmax(energy))
    tail = energy[peak_idx:]
    if len(tail) < 5 or tail[0] <= 0:
        passed, detail = False, "insufficient signal reached the boundary probe to evaluate decay"
    else:
        late_max = tail[len(tail) // 2 :].max()
        rebound_frac = late_max / tail[0]
        passed = rebound_frac <= decay_tol
        detail = (
            f"boundary-probe energy peak={tail[0]:.3e}; late-window max={late_max:.3e} "
            f"(rebound fraction {rebound_frac*100:.2f}%, tolerance {decay_tol*100:.0f}%)"
        )
    return CheckResult("Absorbing-boundary sanity check (no reflection re-growth)", passed, detail)


def run_all_checks(config: SimConfig, study_a_result: dict) -> list[CheckResult]:
    return [
        check_analytic_cross_check(config, study_a_result),
        check_zero_shear(config),
        check_boundary_absorption(config),
    ]


def format_report(checks: list[CheckResult]) -> str:
    lines = ["SBS phonon FDTD validation report", "=" * 40]
    for c in checks:
        status = "PASS" if c.passed else "FAIL"
        lines.append(f"[{status}] {c.name}")
        lines.append(f"       {c.detail}")
    all_passed = all(c.passed for c in checks)
    lines.append("=" * 40)
    lines.append("ALL CHECKS PASSED" if all_passed else "AT LEAST ONE CHECK FAILED -- do not trust Study A/B/C output yet")
    return "\n".join(lines)
