import math
import os
import random
import struct
import wave

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets")
SAMPLE_RATE = 16_000
RNG = random.Random(48201)


def envelope(time: float, start: float, decay: float) -> float:
    if time < start:
        return 0.0
    return math.exp(-(time - start) / decay)


def write_wav(path: str, duration: float, samples: list[float]) -> None:
    peak = max(max(abs(sample) for sample in samples), 1e-8)
    gain = 0.86 / peak
    frames = bytearray()
    for value in samples:
        sample = int(max(-1.0, min(1.0, value * gain)) * 32767)
        frames.extend(struct.pack("<h", sample))
    with wave.open(path, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(frames)


def key_strike() -> list[float]:
    duration = 0.14
    samples: list[float] = []
    for index in range(int(SAMPLE_RATE * duration)):
        time = index / SAMPLE_RATE
        transient = 0.0
        for start, amplitude, decay in (
            (0.000, 1.0, 0.0038),
            (0.0045, 0.38, 0.006),
            (0.012, 0.16, 0.009),
        ):
            transient += amplitude * envelope(time, start, decay) * (
                RNG.uniform(-1, 1) * 0.7
                + math.sin(2 * math.pi * 3600 * (time - start)) * 0.3
            )
        thump = 0.52 * envelope(time, 0.001, 0.018) * math.sin(
            2 * math.pi * (178 - 70 * time) * time
        )
        metal = 0.24 * envelope(time, 0.004, 0.045) * math.sin(2 * math.pi * 1280 * time)
        spring = 0.12 * envelope(time, 0.025, 0.075) * math.sin(2 * math.pi * 520 * time)
        samples.append(transient + thump + metal + spring)
    return samples


def carriage_return() -> list[float]:
    duration = 0.22
    samples: list[float] = []
    for index in range(int(SAMPLE_RATE * duration)):
        time = index / SAMPLE_RATE
        clunk = 0.9 * envelope(time, 0.0, 0.014) * (
            RNG.uniform(-1, 1) * 0.62 + math.sin(2 * math.pi * 145 * time) * 0.38
        )
        glide_envelope = envelope(time, 0.018, 0.11)
        sweep_frequency = 1050 - 1700 * time
        glide = 0.27 * glide_envelope * (
            math.sin(2 * math.pi * max(140, sweep_frequency) * time)
            + 0.32 * RNG.uniform(-1, 1)
        )
        stop = 0.62 * envelope(time, 0.19, 0.037) * math.sin(
            2 * math.pi * 740 * (time - 0.19)
        )
        ring = 0.16 * envelope(time, 0.2, 0.09) * math.sin(
            2 * math.pi * 1480 * (time - 0.2)
        )
        samples.append(clunk + glide + stop + ring)
    return samples


def main() -> None:
    os.makedirs(ROOT, exist_ok=True)
    write_wav(os.path.join(ROOT, "typewriter-key.wav"), 0.14, key_strike())
    write_wav(os.path.join(ROOT, "typewriter-return.wav"), 0.22, carriage_return())


if __name__ == "__main__":
    main()
