"""Run configuration: everything that should be swept/tuned without touching solver code."""

from dataclasses import dataclass, field, asdict
import math
import os
import yaml

from .materials import get_material, Material


@dataclass
class SimConfig:
    material_name: str = "water"

    lambda_opt_m: float = 780.24e-9   # pump/probe optical wavelength
    theta_deg: float = 30.0            # pump ring half-angle used by Study A / C
    NA: float = 0.70                   # objective NA -> sets theta_max for Study B

    domain_size_um: float = 15.0       # square domain, per side
    points_per_wavelength: int = 10    # spatial resolution at the *highest* freq in a sweep
    damping_layer_fraction: float = 0.15  # fraction of domain width devoted to sponge layer
    target_boundary_reflection: float = 1e-3

    forcing_waist_um: float = 1.0      # Gaussian envelope waist (1/e^2 half-width) of pump-probe overlap
    F0: float = 1.0                    # body force amplitude, N/m^3 (arbitrary units; linear model)

    freq_min_ghz: float = 0.1
    freq_max_ghz: float = 2.0
    n_freq_steps: int = 50

    n_cycles_warmup: int = 5           # drive cycles discarded before measuring steady state
    n_cycles_measure: int = 10         # drive cycles used to extract steady-state amplitude
    courant_number: float = 0.5        # fraction of CFL limit used for dt

    kelvin_voigt_eta: float = 0.0      # viscous stress coefficient; 0 = undamped elastic (stage 1)

    theta_b_steps: int = 9             # number of angles in Study B ring-angle sweep

    output_dir: str = "outputs"

    quick: bool = False                # coarser/faster settings for smoke-testing the pipeline

    def __post_init__(self):
        if self.quick:
            self.points_per_wavelength = min(self.points_per_wavelength, 6)
            self.n_freq_steps = min(self.n_freq_steps, 12)
            self.n_cycles_warmup = min(self.n_cycles_warmup, 3)
            self.n_cycles_measure = min(self.n_cycles_measure, 4)
            self.theta_b_steps = min(self.theta_b_steps, 5)
            self.domain_size_um = min(self.domain_size_um, 10.0)

    @property
    def material(self) -> Material:
        return get_material(self.material_name)

    @property
    def forcing_waist_m(self) -> float:
        return self.forcing_waist_um * 1e-6

    @property
    def theta_max_deg(self) -> float:
        """Marginal-ray half-angle set by the objective NA (spec's own convention: asin(NA))."""
        return math.degrees(math.asin(min(self.NA, 1.0)))

    def q_of_theta(self, theta_deg: float) -> float:
        """Phase-matched phonon wavevector magnitude at pump ring half-angle theta."""
        k_opt = 2.0 * math.pi * self.material.n_index / self.lambda_opt_m
        return 2.0 * k_opt * math.sin(math.radians(theta_deg) / 2.0)

    def f_B_analytic(self, theta_deg: float, v: float) -> float:
        """Analytic Brillouin frequency f_B = (2 n v / lambda_opt) sin(theta/2)."""
        return (2.0 * self.material.n_index * v / self.lambda_opt_m) * math.sin(
            math.radians(theta_deg) / 2.0
        )

    def resolve_output_dir(self, base_dir: str) -> str:
        path = os.path.join(base_dir, self.output_dir)
        os.makedirs(path, exist_ok=True)
        return path

    def to_dict(self):
        return asdict(self)


def load_config(path: str | None) -> SimConfig:
    if path is None or not os.path.exists(path):
        return SimConfig()
    with open(path, "r") as f:
        raw = yaml.safe_load(f) or {}
    return SimConfig(**raw)
