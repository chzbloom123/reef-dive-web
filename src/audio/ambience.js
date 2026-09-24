import { loadSetting, saveSetting } from '../storage.js';

// The ambient sound loop, synthesized with the Web Audio API (the browser's built-in audio engine),
// so there's no sound file to download. Two layers:
//
//   rumble   "brown" noise (random values that wander slowly, rich in low tones) through a low-pass filter,
//            swelling gently: the deep, muffled hush of being underwater
//   crackle  a scatter of tiny sharp clicks: snapping shrimp, the actual signature sound of a coral reef.
//            Real reefs crackle constantly, like frying bacon heard from far away.
//
//   noise buffers ─> filters ─> layer volumes ─> master volume (mute switch) ─> speakers
//
// Browsers only allow audio to start after a click, so start() is called from the "Click to dive" button.

const VOLUME = 0.5;

export function createAmbience() {
  let ctx = null;
  let master = null;
  let enabled = loadSetting('sound', true);

  function loopingNoise(seconds, fill) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    fill(data, ctx.sampleRate);
    // Crossfade the end into the start so the loop point doesn't click.
    const fade = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[length - fade + i] * (1 - t);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopEnd = (length - fade) / ctx.sampleRate;
    return source;
  }

  function build() {
    master = ctx.createGain();
    master.gain.value = enabled ? VOLUME : 0;
    master.connect(ctx.destination);

    // Rumble
    const rumble = loopingNoise(9, (data) => {
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise: each sample drifts from the last
        data[i] = last * 3.5;
      }
    });
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.55;
    // A very slow oscillator nudges the volume up and down: the surge of swell passing overhead.
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.07;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.2;
    swell.connect(swellDepth).connect(rumbleGain.gain);
    rumble.connect(low).connect(rumbleGain).connect(master);

    // Crackle: ~35 clicks per second, each a few milliseconds of fading noise, with random loudness.
    const crackle = loopingNoise(7, (data, rate) => {
      const clicks = 7 * 35;
      for (let c = 0; c < clicks; c++) {
        const start = Math.floor(Math.random() * (data.length - rate * 0.01));
        const loud = Math.pow(Math.random(), 3); // mostly faint, occasionally a sharp nearby snap
        const len = Math.floor(rate * (0.002 + Math.random() * 0.004));
        for (let i = 0; i < len; i++) data[start + i] += (Math.random() * 2 - 1) * loud * Math.exp(-i / (len * 0.25));
      }
    });
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 2500;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.12;
    crackle.connect(high).connect(crackleGain).connect(master);

    rumble.start();
    crackle.start();
    swell.start();
  }

  return {
    get enabled() {
      return enabled;
    },
    // Call from a click handler.
    start() {
      try {
        if (!ctx) {
          ctx = new AudioContext();
          build();
        }
        ctx.resume();
      } catch {
        // No audio available: the dive works fine without it.
      }
    },
    setEnabled(on) {
      enabled = on;
      saveSetting('sound', on);
      if (master) master.gain.setTargetAtTime(on ? VOLUME : 0, ctx.currentTime, 0.15);
    },
  };
}
