"""Study A (frequency sweep), Study B (ring-angle sweep), Study C (time-domain snapshots)."""

import math
from dataclasses import dataclass

import numpy as np

from .config import SimConfig
from .materials import Material
from .fdtd import ElasticFDTD2D
from .forcing import make_envelope


@dataclass
class MeshSpec:
    nx: int
    ny: int
    dx: float
    Lx: float
    Ly: float
    X: np.ndarray
    Y: np.ndarray
    center_m: tuple[float, float]


def build_mesh(config: SimConfig, material: Material, freq_max_hz: float, q: float) -> MeshSpec:
    """Size the grid to resolve both the forcing grating (2*pi/q) and the fastest
    freely-propagating elastic wave at freq_max_hz (v_L / freq_max_hz) -- whichever
    is the shorter length scale. Using only 'v/f_max' (the spec's literal wording)
    under-resolves the forcing grating whenever the shear branch is being probed,
    since q is fixed by phase-matching and is independent of the temporal sweep.
    """
    lambda_grating = 2.0 * math.pi / q
    lambda_wave = material.v_L / freq_max_hz
    lambda_min = min(lambda_grating, lambda_wave)

    dx = lambda_min / config.points_per_wavelength
    L = config.domain_size_um * 1e-6
    n = int(round(L / dx))
    n = max(n, 40)
    if n % 2 == 1:
        n += 1

    xs = (np.arange(n) - n / 2) * dx
    ys = (np.arange(n) - n / 2) * dx
    X, Y = np.meshgrid(xs, ys, indexing="ij")
    return MeshSpec(nx=n, ny=n, dx=dx, Lx=n * dx, Ly=n * dx, X=X, Y=Y, center_m=(0.0, 0.0))


def _force_bbox(mesh: MeshSpec, waist_m: float, pad_factor: float = 5.0):
    half = pad_factor * waist_m
    cx, cy = mesh.center_m
    i0 = max(int((cx - half - mesh.X[0, 0]) / mesh.dx), 0)
    i1 = min(int((cx + half - mesh.X[0, 0]) / mesh.dx) + 1, mesh.nx)
    j0 = max(int((cy - half - mesh.Y[0, 0]) / mesh.dx), 0)
    j1 = min(int((cy + half - mesh.Y[0, 0]) / mesh.dx) + 1, mesh.ny)
    return i0, i1, j0, j1


def run_single_frequency(
    config: SimConfig,
    material: Material,
    mesh: MeshSpec,
    q: float,
    freq_hz: float,
    polarization: str,
    return_history: bool = False,
):
    omega = 2.0 * math.pi * freq_hz
    solver = ElasticFDTD2D(
        nx=mesh.nx,
        ny=mesh.ny,
        dx=mesh.dx,
        rho=material.rho,
        lam=material.lam,
        mu=material.mu,
        eta=config.kelvin_voigt_eta,
        damping_layer_cells=max(int(config.damping_layer_fraction * mesh.nx), 8),
        target_boundary_reflection=config.target_boundary_reflection,
        v_ref=material.v_L,
    )

    dt = solver.cfl_dt(config.courant_number)
    period = 1.0 / freq_hz
    n_warmup = int(config.n_cycles_warmup * period / dt)
    n_measure = int(config.n_cycles_measure * period / dt)
    n_total = n_warmup + n_measure

    i0, i1, j0, j1 = _force_bbox(mesh, config.forcing_waist_m)
    Xb, Yb = mesh.X[i0:i1, j0:j1], mesh.Y[i0:i1, j0:j1]
    envelope_b = make_envelope(Xb, Yb, mesh.center_m, config.forcing_waist_m)

    ci, cj = mesh.nx // 2, mesh.ny // 2

    history = [] if return_history else None
    # Domain-integrated kinetic energy, not point displacement at the drive
    # location: a point probe co-located with the source is dominated by the
    # local quasi-static/near-field compliance response (largest near DC,
    # inversely related to stiffness), which swamps the resonant, radiating
    # response we actually want. Net energy build-up in the domain only
    # accumulates when the force does sustained positive work on a genuinely
    # propagating wave, i.e. at phase-matched resonance -- so it cleanly
    # separates the resonance signature from the reactive near-field term.
    energy_trace = np.empty(n_measure)

    Fx_full = np.zeros((mesh.nx, mesh.ny))
    Fy_full = np.zeros((mesh.nx, mesh.ny))
    cell_area = mesh.dx ** 2

    for step in range(n_total):
        t = solver.t
        grating_b = config.F0 * envelope_b * np.sin(q * Xb - omega * t)

        Fx_full[i0:i1, j0:j1] = grating_b if polarization == "longitudinal" else 0.0
        Fy_full[i0:i1, j0:j1] = grating_b if polarization == "shear" else 0.0

        solver.step(dt, Fx=Fx_full, Fy=Fy_full)

        if step >= n_warmup:
            ke = 0.5 * material.rho * cell_area * np.sum(solver.vx ** 2 + solver.vy ** 2)
            energy_trace[step - n_warmup] = ke

        if return_history and step % max(n_total // 40, 1) == 0:
            history.append((t + dt, solver.ux.copy(), solver.uy.copy()))

    steady_energy = float(np.mean(energy_trace[n_measure // 2 :]))
    result = {"amplitude": steady_energy, "energy_trace": energy_trace, "dt": dt, "n_total": n_total}
    if return_history:
        result["history"] = history
    return result


def run_study_a(config: SimConfig, theta_deg: float | None = None, material: Material | None = None):
    material = material or config.material
    theta_deg = theta_deg if theta_deg is not None else config.theta_deg
    q = config.q_of_theta(theta_deg)

    freqs_hz = np.linspace(config.freq_min_ghz, config.freq_max_ghz, config.n_freq_steps) * 1e9
    freq_max_hz = freqs_hz.max()
    mesh = build_mesh(config, material, freq_max_hz, q)

    results = {}
    for pol in ("longitudinal", "shear"):
        amps = np.empty_like(freqs_hz)
        for k, f in enumerate(freqs_hz):
            amps[k] = run_single_frequency(config, material, mesh, q, f, pol)["amplitude"]
        results[pol] = amps

    return {
        "freqs_hz": freqs_hz,
        "amplitudes": results,
        "mesh": mesh,
        "q": q,
        "theta_deg": theta_deg,
        "material": material,
    }


def find_resonance(freqs_hz: np.ndarray, amplitudes: np.ndarray) -> float:
    return float(freqs_hz[int(np.argmax(amplitudes))])


def run_study_b(config: SimConfig, material: Material | None = None, n_freq_local: int = 9, window_frac: float = 0.5):
    """For each ring angle theta, run a narrow local frequency sweep around the
    analytic longitudinal resonance and record the numerically found peak, to
    confirm it tracks f_B(theta) = (2 n v_L / lambda_opt) sin(theta/2)."""
    material = material or config.material
    thetas = np.linspace(1.0, config.theta_max_deg, config.theta_b_steps)

    analytic = np.array([config.f_B_analytic(th, material.v_L) for th in thetas])
    numeric = np.empty_like(analytic)

    for idx, (th, f_center) in enumerate(zip(thetas, analytic)):
        q = config.q_of_theta(th)
        half_window = window_frac * f_center
        f_lo = max(f_center - half_window, 1e6)
        f_hi = f_center + half_window
        freqs_hz = np.linspace(f_lo, f_hi, n_freq_local)
        mesh = build_mesh(config, material, freqs_hz.max(), q)

        amps = np.empty_like(freqs_hz)
        for k, f in enumerate(freqs_hz):
            amps[k] = run_single_frequency(config, material, mesh, q, f, "longitudinal")["amplitude"]
        numeric[idx] = find_resonance(freqs_hz, amps)

    return {"theta_deg": thetas, "analytic_hz": analytic, "numeric_hz": numeric}


def run_study_c(config: SimConfig, theta_deg: float | None = None, material: Material | None = None):
    material = material or config.material
    theta_deg = theta_deg if theta_deg is not None else config.theta_deg
    q = config.q_of_theta(theta_deg)

    out = {}
    for pol, v in (("longitudinal", material.v_L), ("shear", material.v_S)):
        f_res = config.f_B_analytic(theta_deg, v)
        mesh = build_mesh(config, material, f_res, q)
        res = run_single_frequency(config, material, mesh, q, f_res, pol, return_history=True)
        out[pol] = {"mesh": mesh, "freq_hz": f_res, **res}
    return out
