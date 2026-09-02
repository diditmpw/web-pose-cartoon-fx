/**
 * Zero-Latency Audio Engine for Cartoon Pose Soundboard
 * Supports both pre-decoded in-memory AudioBuffers and pure procedural Web Audio synthesis
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.isMuted = false;
    this.volume = 0.85;
    this.buffers = {};
    this.isLoaded = false;
    this.mode = 'synth'; // 'synth' or 'sample' or 'hybrid'
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.preloadSamples();
  }

  async resumeContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  async preloadSamples() {
    const soundList = [
      { id: 'sad_trombone', url: '/audio/sad_trombone.wav' },
      { id: 'fanfare', url: '/audio/fanfare.wav' },
      { id: 'pow', url: '/audio/pow.wav' }
    ];

    for (const s of soundList) {
      try {
        const resp = await fetch(s.url);
        if (resp.ok) {
          const arrayBuffer = await resp.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers[s.id] = decoded;
        }
      } catch (err) {
        console.warn(`[AudioEngine] Could not load audio file ${s.url}, falling back to real-time procedural synth`, err);
      }
    }
    this.isLoaded = true;
  }

  playBuffer(id) {
    if (!this.ctx || !this.buffers[id]) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[id];
      src.connect(this.masterGain);
      src.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Play Sad Trombone Sound ("Wah-Wah-Wah-Waaaaah")
   */
  playSadTrombone() {
    this.resumeContext();
    if (this.isMuted) return;

    // Try preloaded buffer first or run rich procedural synth
    if (this.mode === 'sample' && this.playBuffer('sad_trombone')) {
      return;
    }

    const t0 = this.ctx.currentTime;
    const notes = [
      { freq: 293.66, dur: 0.45, gap: 0.1 },  // D4
      { freq: 277.18, dur: 0.45, gap: 0.1 },  // Db4
      { freq: 261.63, dur: 0.45, gap: 0.1 },  // C4
      { freq: 246.94, dur: 1.4, slide: 215.0 } // B3 sliding down to A3/Bb3
    ];

    let noteStartTime = t0;

    notes.forEach((note, idx) => {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();

      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Brass-like spectrum
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      subOsc.type = 'triangle';

      osc1.frequency.setValueAtTime(note.freq, noteStartTime);
      osc2.frequency.setValueAtTime(note.freq * 1.002, noteStartTime); // slight detune
      subOsc.frequency.setValueAtTime(note.freq * 0.5, noteStartTime);

      if (note.slide) {
        const slideStart = noteStartTime + 0.15;
        osc1.frequency.exponentialRampToValueAtTime(note.slide, noteStartTime + note.dur);
        osc2.frequency.exponentialRampToValueAtTime(note.slide * 1.002, noteStartTime + note.dur);
        subOsc.frequency.exponentialRampToValueAtTime(note.slide * 0.5, noteStartTime + note.dur);
      }

      // Vibrato / Wah modulation
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(5.8, noteStartTime); // 5.8Hz vibrato
      lfoGain.gain.setValueAtTime(idx === 3 ? 12 : 5, noteStartTime);
      lfo.connect(osc1.frequency);
      lfo.connect(osc2.frequency);
      lfo.start(noteStartTime);
      lfo.stop(noteStartTime + note.dur);

      // Formant Wah Filter
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(5.0, noteStartTime);
      filter.frequency.setValueAtTime(350, noteStartTime);
      filter.frequency.exponentialRampToValueAtTime(1600, noteStartTime + note.dur * 0.4);
      filter.frequency.exponentialRampToValueAtTime(450, noteStartTime + note.dur);

      // Amplitude Envelope
      gain.gain.setValueAtTime(0.001, noteStartTime);
      gain.gain.linearRampToValueAtTime(0.35, noteStartTime + 0.04);
      gain.gain.setValueAtTime(0.35, noteStartTime + note.dur - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.dur);

      osc1.connect(filter);
      osc2.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(noteStartTime);
      osc2.start(noteStartTime);
      subOsc.start(noteStartTime);

      osc1.stop(noteStartTime + note.dur);
      osc2.stop(noteStartTime + note.dur);
      subOsc.stop(noteStartTime + note.dur);

      noteStartTime += note.dur + (note.gap || 0);
    });
  }

  /**
   * Play Triumphant Fanfare ("Ta-da-da-DAAA!")
   */
  playFanfare() {
    this.resumeContext();
    if (this.isMuted) return;

    if (this.mode === 'sample' && this.playBuffer('fanfare')) {
      return;
    }

    const t0 = this.ctx.currentTime;
    const arpeggios = [
      { freq: 261.63, start: 0.0, dur: 0.16 }, // C4
      { freq: 329.63, start: 0.15, dur: 0.16 }, // E4
      { freq: 392.00, start: 0.30, dur: 0.16 }, // G4
      { freq: 523.25, start: 0.45, dur: 0.35 }  // C5
    ];

    // Sustained triumph chord at end (C4, G4, C5, E5)
    const chord = [
      { freq: 261.63, start: 0.75, dur: 1.6, vol: 0.3 },
      { freq: 392.00, start: 0.75, dur: 1.6, vol: 0.35 },
      { freq: 523.25, start: 0.75, dur: 1.6, vol: 0.4 },
      { freq: 659.25, start: 0.75, dur: 1.6, vol: 0.3 },
      { freq: 1046.5, start: 0.75, dur: 0.9, vol: 0.2 } // High C sparkle
    ];

    const allNotes = [...arpeggios, ...chord];

    allNotes.forEach(note => {
      const startTime = t0 + note.start;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, startTime);
      osc2.frequency.setValueAtTime(note.freq * 1.003, startTime);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(note.freq * 2.2, startTime);
      filter.Q.setValueAtTime(1.5, startTime);

      const peakVol = note.vol || 0.4;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(peakVol, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.dur);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + note.dur);
      osc2.stop(startTime + note.dur);
    });
  }

  /**
   * Play Comic "POW!" Strike Sound Effect
   * @param {number} intensity - Velocity multiplier (0.5 to 2.0)
   */
  playPow(intensity = 1.0) {
    this.resumeContext();
    if (this.isMuted) return;

    if (this.mode === 'sample' && this.playBuffer('pow')) {
      return;
    }

    const t0 = this.ctx.currentTime;
    const clampedIntensity = Math.min(2.0, Math.max(0.6, intensity));

    // 1. Heavy 808-style Bass Kick with fast pitch drop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';

    const startFreq = 240 * clampedIntensity;
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.28);

    oscGain.gain.setValueAtTime(0.7 * clampedIntensity, t0);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t0);
    osc.stop(t0 + 0.35);

    // 2. High-Frequency Noise Click / Punch Smack
    const bufferSize = this.ctx.sampleRate * 0.15;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(800, t0);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55 * clampedIntensity, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    whiteNoise.start(t0);
    whiteNoise.stop(t0 + 0.15);

    // 3. Comic Metallic Slap / Crunch
    const crunchOsc = this.ctx.createOscillator();
    const crunchGain = this.ctx.createGain();
    crunchOsc.type = 'sawtooth';
    crunchOsc.frequency.setValueAtTime(450 * clampedIntensity, t0);
    crunchOsc.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);

    crunchGain.gain.setValueAtTime(0.4 * clampedIntensity, t0);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);

    crunchOsc.connect(crunchGain);
    crunchGain.connect(this.masterGain);

    crunchOsc.start(t0);
    crunchOsc.stop(t0 + 0.09);
  }

  getAudioVisualizerData() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}

export const audioEngine = new AudioEngine();
