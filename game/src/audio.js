// All sound is synthesised with WebAudio: short oscillator blips and filtered noise,
// so the game ships no audio files at all. Audio starts on the first user gesture
// (browsers block it before then) and the M key mutes it.

export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, slideTo, volume) {
    if (muted || !ensure()) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, volume, lowpass) {
    if (muted || !ensure()) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(720, 0.09, 'square', 320, 0.16);
    },
    enemyDie() {
      tone(300, 0.16, 'triangle', 70, 0.3);
      noise(0.12, 0.2, 900);
    },
    ember() {
      tone(1180, 0.1, 'sine', 1760, 0.2);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 60, 0.35);
      noise(0.2, 0.25, 500);
    },
    lanternHit() {
      tone(220, 0.2, 'sawtooth', 110, 0.3);
    },
    nova() {
      tone(180, 0.5, 'sine', 900, 0.4);
      noise(0.45, 0.3, 2400);
    },
    waveHorn() {
      tone(196, 0.5, 'triangle', 196, 0.3);
      tone(294, 0.5, 'triangle', 294, 0.22);
    },
    upgrade() {
      tone(523, 0.12, 'sine', 523, 0.25);
      setTimeout(() => tone(784, 0.16, 'sine', 784, 0.25), 90);
    },
    gameOver() {
      tone(392, 0.3, 'triangle', 392, 0.3);
      setTimeout(() => tone(311, 0.3, 'triangle', 311, 0.3), 260);
      setTimeout(() => tone(233, 0.6, 'triangle', 220, 0.3), 520);
    },
    victory() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.35, 'sine', freq, 0.28), i * 140));
    },
  };
}
