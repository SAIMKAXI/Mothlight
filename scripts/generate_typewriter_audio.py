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
    # Keep the transient detail while storing compact, broadly supported PCM WAV files.
    peak = max(max(abs(sample) for sample in samples), 1e-8)
    gain = 0.80 / peak
    output_rate = 12_000
    output_frames = round(len(samples) * output_rate / SAMPLE_RATE)
    frames = bytearray()
    for index in range(output_frames):
        source_position = index * SAMPLE_RATE / output_rate
        lower = int(source_position)
        upper = min(lower + 1, len(samples) - 1)
        fraction = source_position - lower
        value = samples[lower] * (1 - fraction) + samples[upper] * fraction
        pcm = max(0, min(255, 128 + round(value * gain * 127)))
        frames.append(pcm)
    with wave.open(path, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(1)
        output.setframerate(output_rate)
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
    # Never overwrite supplied recordings. Generate synthetic fallback clips only when absent.
    key_path = os.path.join(ROOT, "typewriter-key.wav")
    return_path = os.path.join(ROOT, "typewriter-return.wav")
    if not os.path.exists(key_path):
        write_wav(key_path, 0.14, key_strike())
    if not os.path.exists(return_path):
        write_wav(return_path, 0.22, carriage_return())


if __name__ == "__main__":
    main()
