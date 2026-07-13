"""sbs_phonon_fem — 2D elastodynamic FDTD model of co-propagating SBS phonon generation.

Solves the full vector elastic wave equation (longitudinal + shear DOFs) for a
body force representing the electrostrictive pump-probe beat grating, to check
whether the expected co-propagating Brillouin phonon signal is mechanically
plausible before attributing a null result on the bench to alignment.
"""

from .config import SimConfig, load_config
from .materials import Material, MATERIALS

__all__ = ["SimConfig", "load_config", "Material", "MATERIALS"]
