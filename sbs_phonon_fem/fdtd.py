"""2D elastodynamic FDTD solver, velocity-stress formulation.

Solves:
    rho dv/dt = div(sigma) + F
    dsigma/dt = C : grad(v)                (+ eta*(grad(v)+grad(v)^T) Kelvin-Voigt, applied algebraically)

on a collocated Cartesian grid with 2nd-order central differences and leapfrog
time stepping. This is the vector elastic wave equation, not scalar acoustics:
both compressional (div v != 0) and shear (curl v != 0) motion are supported,
because sigma_xy and the off-diagonal velocity gradients are carried explicitly.

Boundaries are truncated with a quadratic-profile sponge (Rayleigh damping)
layer rather than a full C-PML, per the spec's explicitly permitted fallback.
"""

import math
import numpy as np


def _ddx(f, dx):
    d = np.zeros_like(f)
    d[1:-1, :] = (f[2:, :] - f[:-2, :]) / (2.0 * dx)
    return d


def _ddy(f, dy):
    d = np.zeros_like(f)
    d[:, 1:-1] = (f[:, 2:] - f[:, :-2]) / (2.0 * dy)
    return d


class ElasticFDTD2D:
    def __init__(
        self,
        nx: int,
        ny: int,
        dx: float,
        rho: float,
        lam: float,
        mu: float,
        eta: float = 0.0,
        damping_layer_cells: int = 20,
        target_boundary_reflection: float = 1e-3,
        v_ref: float | None = None,
    ):
        self.nx, self.ny, self.dx = nx, ny, dx
        self.rho, self.lam, self.mu, self.eta = rho, lam, mu, eta

        self.vx = np.zeros((nx, ny))
        self.vy = np.zeros((nx, ny))
        self.sxx = np.zeros((nx, ny))
        self.syy = np.zeros((nx, ny))
        self.sxy = np.zeros((nx, ny))
        self.ux = np.zeros((nx, ny))
        self.uy = np.zeros((nx, ny))

        self.t = 0.0

        v_ref = v_ref or math.sqrt((lam + 2 * mu) / rho)
        self.damping = self._build_damping_profile(
            nx, ny, dx, damping_layer_cells, target_boundary_reflection, v_ref
        )

    @staticmethod
    def _build_damping_profile(nx, ny, dx, layer_cells, target_reflection, v_ref):
        layer_cells = max(int(layer_cells), 1)
        crossing_time = (layer_cells * dx) / v_ref
        gamma_max = -math.log(target_reflection) / crossing_time

        def axis_profile(n):
            idx = np.arange(n)
            dist_from_edge = np.minimum(idx, n - 1 - idx).astype(float)
            depth = np.clip((layer_cells - dist_from_edge) / layer_cells, 0.0, 1.0)
            return gamma_max * depth ** 2

        gx = axis_profile(nx)
        gy = axis_profile(ny)
        return np.maximum(gx[:, None], gy[None, :])

    def cfl_dt(self, courant_number: float) -> float:
        v_p = math.sqrt((self.lam + 2 * self.mu) / self.rho)
        return courant_number * self.dx / (v_p * math.sqrt(2.0))

    def step(self, dt: float, Fx: np.ndarray | None = None, Fy: np.ndarray | None = None):
        # Viscous (Kelvin-Voigt) stress is algebraic in the current velocity field,
        # not integrated state, and is added on top of the elastic stress when
        # computing the divergence that drives the velocity update.
        visc_xx = visc_yy = visc_xy = 0.0
        if self.eta > 0.0:
            dvx_dx0 = _ddx(self.vx, self.dx)
            dvy_dy0 = _ddy(self.vy, self.dx)
            dvx_dy0 = _ddy(self.vx, self.dx)
            dvy_dx0 = _ddx(self.vy, self.dx)
            visc_xx = self.eta * 2.0 * dvx_dx0
            visc_yy = self.eta * 2.0 * dvy_dy0
            visc_xy = self.eta * (dvx_dy0 + dvy_dx0)

        dsxx_dx = _ddx(self.sxx + visc_xx, self.dx)
        dsxy_dy = _ddy(self.sxy + visc_xy, self.dx)
        dsxy_dx = _ddx(self.sxy + visc_xy, self.dx)
        dsyy_dy = _ddy(self.syy + visc_yy, self.dx)

        ax = (dsxx_dx + dsxy_dy) / self.rho
        ay = (dsxy_dx + dsyy_dy) / self.rho
        if Fx is not None:
            ax = ax + Fx / self.rho
        if Fy is not None:
            ay = ay + Fy / self.rho

        self.vx += dt * ax
        self.vy += dt * ay

        damp_factor = np.exp(-self.damping * dt)
        self.vx *= damp_factor
        self.vy *= damp_factor

        dvx_dx = _ddx(self.vx, self.dx)
        dvx_dy = _ddy(self.vx, self.dx)
        dvy_dx = _ddx(self.vy, self.dx)
        dvy_dy = _ddy(self.vy, self.dx)

        self.sxx += dt * ((self.lam + 2 * self.mu) * dvx_dx + self.lam * dvy_dy)
        self.syy += dt * (self.lam * dvx_dx + (self.lam + 2 * self.mu) * dvy_dy)
        self.sxy += dt * (self.mu * (dvx_dy + dvy_dx))

        self.sxx *= damp_factor
        self.syy *= damp_factor
        self.sxy *= damp_factor

        self.ux += dt * self.vx
        self.uy += dt * self.vy

        self.t += dt
