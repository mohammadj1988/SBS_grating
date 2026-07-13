"""Electrostrictive pump-probe body force: a Gaussian-enveloped traveling grating.

F(x, t) = F0 * envelope(x, y) * sin(q*x - Omega*t) * e_hat

e_hat = x_hat (parallel to q)      -> longitudinal case, co-polarized pump/probe (p11/p12 coupling)
e_hat = y_hat (perpendicular to q) -> shear case, cross-polarized pump/probe (p44 coupling)

Not a boundary condition: this is a volumetric body force localized to the
pump-probe focal overlap region by the Gaussian envelope, per the SBS spec.
"""

from dataclasses import dataclass
from typing import Literal

import numpy as np


@dataclass
class ForcingSpec:
    F0: float
    q: float                 # phonon wavevector, rad/m
    omega: float              # drive angular frequency, rad/s
    waist_m: float            # Gaussian envelope 1/e half-width, m
    polarization: Literal["longitudinal", "shear"]
    center_m: tuple[float, float]


def make_envelope(X: np.ndarray, Y: np.ndarray, center_m, waist_m: float) -> np.ndarray:
    cx, cy = center_m
    r2 = (X - cx) ** 2 + (Y - cy) ** 2
    return np.exp(-r2 / (waist_m ** 2))


def body_force(X: np.ndarray, Y: np.ndarray, t: float, spec: ForcingSpec):
    envelope = make_envelope(X, Y, spec.center_m, spec.waist_m)
    grating = spec.F0 * envelope * np.sin(spec.q * X - spec.omega * t)

    if spec.polarization == "longitudinal":
        return grating, np.zeros_like(grating)
    elif spec.polarization == "shear":
        return np.zeros_like(grating), grating
    else:
        raise ValueError(f"Unknown polarization '{spec.polarization}'")
