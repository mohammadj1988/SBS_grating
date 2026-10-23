"""Scan the NanoMax X piezo via MDT693B X-axis EXT input, driven by a PXIe-6124 AO.

Wiring:
    BNC-2110 "AO 0"  --BNC-->  MDT693B X-AXIS "EXT 0-10V"
    (optional) detector --BNC--> BNC-2110 "AI 0", switch set to FS or GS to match the source

Find DEVICE in NI MAX (Devices and Interfaces -> the 6124 the BNC-2110 cable goes to).
"""
import numpy as np
import nidaqmx
from nidaqmx.constants import AcquisitionType, TerminalConfiguration

DEVICE = "PXI1Slot2"      # name from NI MAX
AO_CH = "ao0"             # drives MDT693B X EXT
AI_CH = "ai0"             # optional detector readback; set to None to disable

V_START, V_STOP = 0.0, 5.0  # AO volts into EXT (0-10 V allowed). Start small.
V_MAX_SAFE = 10.0           # MDT693B EXT input range
N_POINTS = 200              # points per sweep
RATE = 1000.0               # samples/s -> one sweep = N_POINTS/RATE s
N_SWEEPS = 5
BIDIRECTIONAL = True        # triangle (up then down) avoids a hard jump back to V_START


def make_waveform():
    up = np.linspace(V_START, V_STOP, N_POINTS)
    wave = np.concatenate([up, up[::-1]]) if BIDIRECTIONAL else up
    wave = np.tile(wave, N_SWEEPS)
    return np.clip(wave, 0.0, V_MAX_SAFE)


def run():
    wave = make_waveform()
    n = wave.size
    with nidaqmx.Task() as ao, nidaqmx.Task() as ai:
        ao.ao_channels.add_ao_voltage_chan(f"{DEVICE}/{AO_CH}", min_val=0.0, max_val=V_MAX_SAFE)
        ao.timing.cfg_samp_clk_timing(RATE, sample_mode=AcquisitionType.FINITE, samps_per_chan=n)
        ao.write(wave, auto_start=False)

        data = None
        if AI_CH:
            ai.ai_channels.add_ai_voltage_chan(f"{DEVICE}/{AI_CH}", min_val=-10.0, max_val=10.0,
                                               terminal_config=TerminalConfiguration.DEFAULT)
            # AI shares the AO sample clock so every AI point matches one AO point
            ai.timing.cfg_samp_clk_timing(RATE, source=f"/{DEVICE}/ao/SampleClock",
                                          sample_mode=AcquisitionType.FINITE, samps_per_chan=n)
            ai.start()

        ao.start()
        ao.wait_until_done(timeout=n / RATE + 10)
        if AI_CH:
            data = np.asarray(ai.read(number_of_samples_per_channel=n, timeout=10))

    # leave the stage at 0 V
    with nidaqmx.Task() as park:
        park.ao_channels.add_ao_voltage_chan(f"{DEVICE}/{AO_CH}", min_val=0.0, max_val=V_MAX_SAFE)
        park.write(0.0, auto_start=True)

    if data is not None:
        np.savetxt("scan_x.csv", np.column_stack([wave, data]), delimiter=",",
                   header="ao_volts,ai_volts", comments="")
        try:
            import matplotlib.pyplot as plt
            plt.plot(wave, data, ".", ms=2)
            plt.xlabel("AO0 drive into MDT693B EXT (V)")
            plt.ylabel("AI0 (V)")
            plt.show()
        except ImportError:
            pass


if __name__ == "__main__":
    run()
