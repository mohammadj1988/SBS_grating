"""Plot and animation output for Study A/B/C."""

import os

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.animation as animation

from .studies import find_resonance


def plot_study_a(result: dict, out_dir: str) -> str:
    freqs_ghz = result["freqs_hz"] / 1e9
    fig, ax = plt.subplots(figsize=(7, 5))

    for pol, color in (("longitudinal", "tab:blue"), ("shear", "tab:red")):
        amps = result["amplitudes"][pol]
        ax.plot(freqs_ghz, amps, color=color, label=pol.capitalize())
        f_peak = find_resonance(result["freqs_hz"], amps)
        ax.axvline(f_peak / 1e9, color=color, linestyle="--", alpha=0.6)
        ax.annotate(
            f"{pol[0].upper()}: {f_peak/1e9:.3f} GHz",
            xy=(f_peak / 1e9, amps.max()),
            xytext=(5, 0), textcoords="offset points",
            color=color, fontsize=9,
        )

    ax.set_xlabel("Drive frequency  $\\Omega / 2\\pi$  (GHz)")
    ax.set_ylabel("Steady-state domain kinetic energy (J, arb. units)")
    ax.set_title(
        f"Study A: {result['material'].name}, "
        f"$\\theta$={result['theta_deg']:.1f}$^\\circ$"
    )
    ax.legend()
    fig.tight_layout()

    path = os.path.join(out_dir, "study_a_frequency_sweep.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def plot_study_b(result: dict, out_dir: str) -> str:
    thetas = result["theta_deg"]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.plot(thetas, result["analytic_hz"] / 1e9, "k-", label="Analytic $f_B(\\theta)$")
    ax.plot(thetas, result["numeric_hz"] / 1e9, "o", color="tab:blue", label="FDTD peak (longitudinal)")
    ax.set_xlabel("Pump ring half-angle $\\theta$ (deg)")
    ax.set_ylabel("Resonant frequency (GHz)")
    ax.set_title("Study B: phase-matching validation")
    ax.legend()
    fig.tight_layout()

    path = os.path.join(out_dir, "study_b_ring_angle_sweep.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def animate_study_c(result: dict, polarization: str, out_dir: str) -> str:
    entry = result[polarization]
    history = entry["history"]
    mesh = entry["mesh"]

    field_idx = 1 if polarization == "longitudinal" else 2  # ux for L, uy for S
    frames = [h[field_idx] for h in history]
    vmax = max(np.abs(f).max() for f in frames) or 1.0

    fig, ax = plt.subplots(figsize=(5.5, 5))
    extent = [
        mesh.X.min() * 1e6, mesh.X.max() * 1e6,
        mesh.Y.min() * 1e6, mesh.Y.max() * 1e6,
    ]
    im = ax.imshow(
        frames[0].T, origin="lower", extent=extent,
        cmap="RdBu_r", vmin=-vmax, vmax=vmax, animated=True,
    )
    ax.set_xlabel("x (um, propagation direction)")
    ax.set_ylabel("y (um)")
    label = "u_x (longitudinal)" if polarization == "longitudinal" else "u_y (shear)"
    ax.set_title(f"Study C: {polarization} phonon field, {label}\nf = {entry['freq_hz']/1e9:.3f} GHz")
    fig.colorbar(im, ax=ax, label="displacement (m)")

    def update(i):
        im.set_data(frames[i].T)
        return (im,)

    anim = animation.FuncAnimation(fig, update, frames=len(frames), interval=120, blit=True)

    path = os.path.join(out_dir, f"study_c_{polarization}.gif")
    anim.save(path, writer=animation.PillowWriter(fps=8))
    plt.close(fig)
    return path
