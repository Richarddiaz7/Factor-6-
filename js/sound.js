// js/sound.js
// Gestión de sonidos con Web Audio API

class SoundManager {
  constructor() {
    this.audioContext = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicGain = null;
    this.musicInterval = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Audio no soportado');
    }
  }

  playTick() {
    if (!this.sfxEnabled || !this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  playError() {
    if (!this.sfxEnabled || !this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.3);
  }

  playVictory() {
    if (!this.sfxEnabled || !this.audioContext) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.2, this.audioContext.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + i * 0.15 + 0.2);
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start(this.audioContext.currentTime + i * 0.15);
      osc.stop(this.audioContext.currentTime + i * 0.15 + 0.2);
    });
  }

  playDefeat() {
    if (!this.sfxEnabled || !this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.5);
  }

  startMusic() {
    if (!this.musicEnabled || !this.audioContext) return;
    this.stopMusic();
    this.musicGain = this.audioContext.createGain();
    this.musicGain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
    this.musicGain.connect(this.audioContext.destination);

    const chords = [
      [261.63, 329.63, 392.00],
      [293.66, 369.99, 440.00],
      [329.63, 415.30, 493.88],
      [261.63, 329.63, 392.00]
    ];
    let index = 0;
    const playNext = () => {
      if (!this.musicEnabled) return;
      const chord = chords[index % chords.length];
      chord.forEach(freq => {
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
        osc.connect(this.musicGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 1.5);
      });
      index++;
      this.musicInterval = setTimeout(playNext, 2000);
    };
    playNext();
  }

  stopMusic() {
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return this.musicEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }
}

const soundManager = new SoundManager();
