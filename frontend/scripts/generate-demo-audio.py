"""Generate three small original WAV loops for the React player demo."""

import math
import os
import struct
import wave

RATE = 22050
SONGS = [
    ("luz-de-tarde", 112, [64, 67, 71, 67, 69, 72, 76, 72, 67, 71, 74, 71, 64, 67, 71, 67], [[52, 55, 59], [57, 60, 64], [55, 59, 62], [52, 55, 59]]),
    ("ciudad-nocturna", 100, [62, 65, 69, 65, 60, 64, 67, 64, 58, 62, 65, 62, 60, 64, 67, 64], [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]]),
    ("aire-nuevo", 120, [67, 71, 74, 71, 69, 72, 76, 72, 64, 67, 71, 67, 66, 69, 74, 69], [[55, 59, 62], [57, 60, 64], [52, 55, 59], [54, 57, 62]]),
]


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def pluck(frequency, age):
    decay = math.exp(-5.4 * age)
    return decay * (
        math.sin(2 * math.pi * frequency * age)
        + 0.3 * math.sin(2 * math.pi * frequency * 2 * age)
        + 0.11 * math.sin(2 * math.pi * frequency * 3 * age)
    )


def render(name, bpm, notes, chords):
    beat = 60 / bpm
    length = len(notes) * beat
    samples = int(length * RATE)
    output = bytearray()
    for index in range(samples):
        t = index / RATE
        step = min(int(t / beat), len(notes) - 1)
        age = t - step * beat
        chord = chords[step // 4]
        melody = 0.24 * pluck(hz(notes[step]), age)
        echo_age = age + beat / 2
        echo = 0.07 * pluck(hz(notes[(step - 1) % len(notes)]), echo_age)
        pad = sum(math.sin(2 * math.pi * hz(n - 12) * t) for n in chord) * 0.045
        bass = math.sin(2 * math.pi * hz(chord[0] - 24) * t) * 0.13 * math.exp(-2.8 * (t % (2 * beat)))
        kick_age = t % beat
        kick = math.sin(2 * math.pi * (65 - 22 * min(kick_age, 0.18)) * kick_age) * 0.11 * math.exp(-27 * kick_age)
        fade = min(1, t / 0.035, (length - t) / 0.15)
        value = max(-1, min(1, (melody + echo + pad + bass + kick) * max(0, fade)))
        output.extend(struct.pack("<h", round(value * 32767)))
    path = os.path.join(os.path.dirname(__file__), "..", "public", "audio", name + ".wav")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(output)


if __name__ == "__main__":
    for song in SONGS:
        render(*song)
