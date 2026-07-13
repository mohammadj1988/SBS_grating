"""Material property table and Lame-parameter derivation.

v_L, v_S are the *only* trustworthy numbers for water (calibration case).
Collagen/cartilage entries are placeholders pending a literature pass — see
PLACEHOLDER flag below. Do not read Study A/B outputs for those materials as
quantitatively final.
"""

from dataclasses import dataclass


@dataclass
class Material:
    name: str
    rho: float          # kg/m^3
    v_L: float           # m/s, longitudinal wave speed
    v_S: float           # m/s, shear wave speed
    n_index: float       # optical refractive index at the pump wavelength
    placeholder: bool = False  # True => literature values not yet verified

    @property
    def mu(self) -> float:
        """Shear modulus, mu = rho * v_S^2."""
        return self.rho * self.v_S ** 2

    @property
    def lam(self) -> float:
        """First Lame parameter, lambda = rho*v_L^2 - 2*mu."""
        return self.rho * self.v_L ** 2 - 2.0 * self.mu


MATERIALS = {
    "water": Material(
        name="water",
        rho=1000.0,
        v_L=1480.0,
        v_S=1.0,          # ~0 in reality; kept nonzero (1 m/s) only so mu>0 numerically
        n_index=1.33,
        placeholder=False,
    ),
    "collagen_gel": Material(
        name="collagen_gel",
        rho=1050.0,
        v_L=1575.0,        # midpoint of ~1550-1600 m/s range quoted in spec
        v_S=25.0,          # midpoint of ~10-50 m/s range quoted in spec
        n_index=1.40,
        placeholder=True,
    ),
    "cartilage_hydrogel": Material(
        name="cartilage_hydrogel",
        rho=1075.0,
        v_L=1600.0,        # midpoint of ~1550-1650 m/s range quoted in spec
        v_S=50.0,           # midpoint of ~5-100 m/s range quoted in spec
        n_index=1.40,
        placeholder=True,
    ),
}


def get_material(name: str) -> Material:
    try:
        return MATERIALS[name]
    except KeyError:
        raise KeyError(
            f"Unknown material '{name}'. Available: {list(MATERIALS)}"
        ) from None
