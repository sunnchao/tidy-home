import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../assets/resources/audio');
fs.mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, filename), buffer);
}

function mixNotes(totalSec, notes) {
  const len = Math.floor(totalSec * SAMPLE_RATE);
  const buf = new Float32Array(len);

  for (const n of notes) {
    const startIdx = Math.floor((n.start || 0) * SAMPLE_RATE);
    const durSamples = Math.floor(n.dur * SAMPLE_RATE);
    const amp = n.amp ?? 0.35;
    const wave = n.wave ?? 'marimba';

    for (let i = 0; i < durSamples && startIdx + i < len; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / durSamples;
      const attack = Math.min(1, i / (SAMPLE_RATE * 0.008));
      const decay = Math.exp(-progress * (n.decay ?? 5.5));
      const env = attack * decay * Math.min(1, (durSamples - i) / (SAMPLE_RATE * 0.012));

      const f0 = n.freq;
      const f1 = n.freqEnd ?? f0;
      const freq = f0 + (f1 - f0) * progress;
      const phase = 2 * Math.PI * freq * t;

      let s = 0;
      if (wave === 'marimba') {
        s = Math.sin(phase) * 0.72 + Math.sin(phase * 2) * 0.2 + Math.sin(phase * 3) * 0.08;
      } else if (wave === 'triangle') {
        s = (2 / Math.PI) * Math.asin(Math.sin(phase));
      } else if (wave === 'soft_thud') {
        s = Math.sin(phase) * 0.8 + Math.sin(phase * 0.5) * 0.2;
      } else {
        s = Math.sin(phase);
      }

      buf[startIdx + i] += s * env * amp;
    }
  }

  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak > 0.92) {
    const norm = 0.92 / peak;
    for (let i = 0; i < len; i++) buf[i] *= norm;
  }
  return buf;
}

const AUDIO_SPECS = {
  'pick.wav': mixNotes(0.14, [
    { start: 0, dur: 0.13, freq: 587.33, freqEnd: 740, amp: 0.4, wave: 'marimba', decay: 7 },
  ]),
  'deliver.wav': mixNotes(0.24, [
    { start: 0, dur: 0.14, freq: 659.25, amp: 0.36, wave: 'marimba', decay: 6 },
    { start: 0.06, dur: 0.17, freq: 987.77, amp: 0.42, wave: 'marimba', decay: 5.5 },
  ]),
  'box_seal.wav': mixNotes(0.42, [
    { start: 0, dur: 0.12, freq: 523.25, amp: 0.32, wave: 'marimba' },
    { start: 0.08, dur: 0.12, freq: 659.25, amp: 0.34, wave: 'marimba' },
    { start: 0.16, dur: 0.24, freq: 1046.5, amp: 0.42, wave: 'marimba', decay: 4.5 },
  ]),
  'blocked.wav': mixNotes(0.16, [
    { start: 0, dur: 0.15, freq: 210, freqEnd: 135, amp: 0.42, wave: 'soft_thud', decay: 7 },
  ]),
  'cardboard_hit.wav': mixNotes(0.18, [
    { start: 0, dur: 0.14, freq: 260, freqEnd: 160, amp: 0.45, wave: 'soft_thud', decay: 8 },
    { start: 0.01, dur: 0.08, freq: 440, freqEnd: 320, amp: 0.18, wave: 'triangle', decay: 9 },
  ]),
  'cardboard_open.wav': mixNotes(0.32, [
    { start: 0, dur: 0.1, freq: 392, freqEnd: 523.25, amp: 0.32, wave: 'triangle' },
    { start: 0.08, dur: 0.22, freq: 783.99, amp: 0.4, wave: 'marimba', decay: 5 },
  ]),
  'fever.wav': mixNotes(0.55, [
    { start: 0, dur: 0.14, freq: 523.25, amp: 0.3, wave: 'marimba' },
    { start: 0.08, dur: 0.14, freq: 659.25, amp: 0.32, wave: 'marimba' },
    { start: 0.16, dur: 0.14, freq: 783.99, amp: 0.36, wave: 'marimba' },
    { start: 0.24, dur: 0.3, freq: 1046.5, amp: 0.42, wave: 'marimba', decay: 4 },
  ]),
  'meow_mischief.wav': mixNotes(0.34, [
    { start: 0, dur: 0.14, freq: 760, freqEnd: 980, amp: 0.32, wave: 'triangle', decay: 4 },
    { start: 0.12, dur: 0.2, freq: 960, freqEnd: 620, amp: 0.34, wave: 'triangle', decay: 4.5 },
  ]),
  'meow_happy.wav': mixNotes(0.36, [
    { start: 0, dur: 0.14, freq: 700, freqEnd: 1040, amp: 0.34, wave: 'marimba', decay: 4 },
    { start: 0.12, dur: 0.22, freq: 880, freqEnd: 1180, amp: 0.36, wave: 'marimba', decay: 4 },
  ]),
  'booster.wav': mixNotes(0.34, [
    { start: 0, dur: 0.28, freq: 440, freqEnd: 1174.66, amp: 0.35, wave: 'marimba', decay: 4.8 },
    { start: 0.1, dur: 0.22, freq: 880, amp: 0.25, wave: 'sine', decay: 5 },
  ]),
  'win.wav': mixNotes(0.85, [
    { start: 0, dur: 0.16, freq: 523.25, amp: 0.34, wave: 'marimba' },
    { start: 0.12, dur: 0.16, freq: 659.25, amp: 0.34, wave: 'marimba' },
    { start: 0.24, dur: 0.16, freq: 783.99, amp: 0.36, wave: 'marimba' },
    { start: 0.36, dur: 0.45, freq: 1046.5, amp: 0.44, wave: 'marimba', decay: 3.4 },
    { start: 0.36, dur: 0.45, freq: 1318.5, amp: 0.24, wave: 'sine', decay: 3.6 },
  ]),
  'fail.wav': mixNotes(0.55, [
    { start: 0, dur: 0.18, freq: 392.0, freqEnd: 349.23, amp: 0.35, wave: 'triangle', decay: 4.5 },
    { start: 0.18, dur: 0.34, freq: 329.63, freqEnd: 246.94, amp: 0.36, wave: 'triangle', decay: 4 },
  ]),
};

for (const [name, data] of Object.entries(AUDIO_SPECS)) {
  writeWav(name, data);
}

console.log(`Generated ${Object.keys(AUDIO_SPECS).length} audio clips in ${OUT_DIR}`);
