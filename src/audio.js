// ============ ECHO COURIER — procedural Web Audio engine ============
// All music & SFX are synthesized at runtime. Audio starts only after
// the first user gesture (browser autoplay policy safe).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.ambBus = null;
    this.muted = false;
    this.started = false;
    this.engineNodes = null;
    this.musicTimer = null;
    this.chordIndex = 0;
    this.completionMode = false;
  }

  // call on first user gesture
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = 0.9;
    // gentle limiter
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 8;
    this.master.connect(comp);
    comp.connect(c.destination);

    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.34; this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.3; this.ambBus.connect(this.master);

    // shared echo/delay for pulse sfx
    this.delay = c.createDelay(1.0);
    this.delay.delayTime.value = 0.34;
    const fb = c.createGain(); fb.gain.value = 0.35;
    const dFilter = c.createBiquadFilter(); dFilter.type = 'lowpass'; dFilter.frequency.value = 2400;
    this.delay.connect(fb); fb.connect(dFilter); dFilter.connect(this.delay);
    this.delayOut = c.createGain(); this.delayOut.gain.value = 0.5;
    this.delay.connect(this.delayOut);
    this.delayOut.connect(this.master);

    this.started = true;
    this.startAmbience();
    this.startEngine();
    this.startMusic();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------- ambience: filtered city rumble ----------
  startAmbience() {
    const c = this.ctx;
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.5;
    src.connect(lp); lp.connect(g); g.connect(this.ambBus);
    src.start();

    // slow LFO on filter for "breathing city"
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);
    lfo.start();
  }

  // ---------- hover-bike engine (continuous, pitch follows speed) ----------
  startEngine() {
    const c = this.ctx;
    const osc1 = c.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 110;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 2;
    const g = c.createGain(); g.gain.value = 0.0;
    osc1.connect(lp); osc2.connect(lp); lp.connect(g); g.connect(this.sfxBus);
    osc1.start(); osc2.start();

    // electric whine
    const whine = c.createOscillator(); whine.type = 'triangle'; whine.frequency.value = 880;
    const wg = c.createGain(); wg.gain.value = 0.0;
    whine.connect(wg); wg.connect(this.sfxBus);
    whine.start();

    this.engineNodes = { osc1, osc2, lp, g, whine, wg };
  }

  // speedNorm 0..1, boosting bool
  updateEngine(speedNorm, boosting) {
    if (!this.engineNodes) return;
    const t = this.now();
    const { osc1, osc2, lp, g, whine, wg } = this.engineNodes;
    const target = speedNorm > 0.02 ? 0.05 + speedNorm * 0.075 : 0.0;
    g.gain.setTargetAtTime(target, t, 0.12);
    osc1.frequency.setTargetAtTime(48 + speedNorm * 60 + (boosting ? 24 : 0), t, 0.1);
    osc2.frequency.setTargetAtTime(96 + speedNorm * 120 + (boosting ? 48 : 0), t, 0.1);
    lp.frequency.setTargetAtTime(320 + speedNorm * 900 + (boosting ? 500 : 0), t, 0.15);
    whine.frequency.setTargetAtTime(700 + speedNorm * 900 + (boosting ? 500 : 0), t, 0.2);
    wg.gain.setTargetAtTime(speedNorm > 0.3 ? 0.008 + speedNorm * 0.012 : 0.0, t, 0.2);
  }

  stopEngineSound() {
    if (!this.engineNodes) return;
    const t = this.now();
    this.engineNodes.g.gain.setTargetAtTime(0, t, 0.2);
    this.engineNodes.wg.gain.setTargetAtTime(0, t, 0.2);
  }

  // ---------- music: slow synthwave pad progression ----------
  startMusic() {
    // Am – F – G – C voicings, dark synthwave feel
    this.chords = [
      [110.0, 164.8, 220.0, 261.6],
      [87.3, 130.8, 174.6, 220.0],
      [98.0, 146.8, 196.0, 246.9],
      [130.8, 196.0, 261.6, 329.6],
    ];
    this.completionChords = [
      [130.8, 196.0, 261.6, 392.0],
      [146.8, 220.0, 293.7, 440.0],
      [164.8, 246.9, 329.6, 493.9],
      [196.0, 293.7, 392.0, 587.3],
    ];
    const step = () => {
      if (!this.started) return;
      const set = this.completionMode ? this.completionChords : this.chords;
      const chord = set[this.chordIndex % set.length];
      this.playPadChord(chord, this.completionMode ? 3.4 : 5.2);
      this.playBassPulse(chord[0] / 2, this.completionMode ? 3.4 : 5.2);
      this.chordIndex++;
      this.musicTimer = setTimeout(step, this.completionMode ? 3400 : 5200);
    };
    step();
  }

  playPadChord(freqs, dur) {
    const c = this.ctx;
    const t = c.currentTime;
    for (const f of freqs) {
      for (const det of [-4, 3]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.linearRampToValueAtTime(900, t + dur * 0.5);
        lp.frequency.linearRampToValueAtTime(320, t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(this.musicBus);
        o.start(t); o.stop(t + dur + 0.1);
      }
    }
    if (Math.random() < 0.6) {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.value = freqs[2 + Math.floor(Math.random() * 2)] * 4;
      const g = c.createGain();
      const t2 = t + 1 + Math.random() * 2;
      g.gain.setValueAtTime(0, t2);
      g.gain.linearRampToValueAtTime(0.03, t2 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.6);
      o.connect(g); g.connect(this.musicBus); g.connect(this.delay);
      o.start(t2); o.stop(t2 + 1.8);
    }
  }

  playBassPulse(root, dur) {
    const c = this.ctx;
    const t = c.currentTime;
    const hits = this.completionMode ? 8 : 4;
    for (let i = 0; i < hits; i++) {
      const ht = t + (i * dur) / hits;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = root;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0, ht);
      g.gain.linearRampToValueAtTime(0.09, ht + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ht + 0.5);
      o.connect(g); g.connect(this.musicBus);
      o.start(ht); o.stop(ht + 0.6);
    }
  }

  // ---------- one-shot SFX ----------
  blip(freq, dur, type = 'sine', vol = 0.2, dest = null) {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noiseBurst(dur, filterFreq, vol = 0.2, type = 'bandpass') {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t);
  }


  // signature echo pulse: deep sweep + shimmer through echo delay
  playPulse() {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 1.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); g.connect(this.sfxBus); g.connect(this.delay);
    o.start(t); o.stop(t + 1.5);

    const o2 = c.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(1760, t);
    o2.frequency.exponentialRampToValueAtTime(220, t + 0.8);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.1, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o2.connect(g2); g2.connect(this.delay); g2.connect(this.sfxBus);
    o2.start(t); o2.stop(t + 1.1);

    this.noiseBurst(0.7, 1800, 0.25);
  }

  playPickup() {
    this.blip(880, 0.18, 'sine', 0.16);
    setTimeout(() => this.blip(1320, 0.25, 'sine', 0.14), 70);
  }

  playCapsule() {
    this.blip(523, 0.15, 'triangle', 0.18);
    setTimeout(() => this.blip(784, 0.15, 'triangle', 0.18), 90);
    setTimeout(() => this.blip(1046, 0.3, 'triangle', 0.2), 180);
  }

  playTowerActivate() {
    if (!this.started) return;
    const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this.blip(f, 0.7, 'sine', 0.16);
        this.blip(f * 2, 0.4, 'triangle', 0.06);
      }, i * 95);
    });
    this.noiseBurst(1.2, 900, 0.12, 'highpass');
  }

  playObjective() {
    this.blip(659.3, 0.2, 'sine', 0.14);
    setTimeout(() => this.blip(987.8, 0.35, 'sine', 0.14), 110);
  }

  playComplete() {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const freqs = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5];
    freqs.forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
      const g = c.createGain();
      const st = t + i * 0.12;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.09, st + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 3.2);
      o.connect(lp); lp.connect(g); g.connect(this.sfxBus); g.connect(this.delay);
      o.start(st); o.stop(st + 3.4);
    });
    this.noiseBurst(2.0, 600, 0.15, 'lowpass');
  }

  playUIClick() { this.blip(1200, 0.07, 'square', 0.06); }
  playDenied() { this.blip(180, 0.25, 'sawtooth', 0.1); }
  playBoost() { this.noiseBurst(0.5, 1400, 0.2); this.blip(220, 0.4, 'sawtooth', 0.08); }
  playFall() {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.9);
  }

  // ---------- combat SFX ----------
  // continuous laser hum while firing
  startLaser() {
    if (!this.started || this._laserOn) return;
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 320;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 95;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 4;
    const g = c.createGain(); g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.sfxBus);
    o1.start(); o2.start();
    const t = c.currentTime;
    g.gain.setTargetAtTime(0.075, t, 0.03);
    o1.frequency.setTargetAtTime(340, t, 0.05);
    this._laserNodes = { o1, o2, lp, g };
    this._laserOn = true;
  }

  stopLaser() {
    if (!this._laserOn || !this._laserNodes) return;
    const c = this.ctx;
    const t = c.currentTime;
    const { o1, o2, g } = this._laserNodes;
    g.gain.setTargetAtTime(0, t, 0.04);
    setTimeout(() => { try { o1.stop(); o2.stop(); } catch (e) {} }, 250);
    this._laserOn = false;
  }

  playLaserTick() {
    // quick zap layered on the hum each damage tick
    this.blip(1400 + Math.random() * 500, 0.06, 'square', 0.045);
  }

  playEnemyHit() { this.blip(500 + Math.random() * 300, 0.08, 'square', 0.09); }

  playExplosion() {
    if (!this.started) return;
    this.noiseBurst(0.6, 700, 0.4, 'lowpass');
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.7);
  }

  playHurt() {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
    const g = c.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.3);
  }

  playBossRoar() {
    if (!this.started) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, t);
    o.frequency.linearRampToValueAtTime(180, t + 1.2);
    o.frequency.exponentialRampToValueAtTime(45, t + 3.0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(1200, t + 1.2);
    o.connect(lp); lp.connect(g); g.connect(this.sfxBus); g.connect(this.delay);
    o.start(t); o.stop(t + 3.3);
    this.noiseBurst(2.4, 400, 0.3, 'lowpass');
  }

  playBossPhase() {
    const notes = [130.8, 155.6, 185.0];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.9, 'sawtooth', 0.14), i * 130));
    this.noiseBurst(1.0, 900, 0.2);
  }

  playEnemyAlert() { this.blip(880, 0.12, 'square', 0.08); setTimeout(() => this.blip(660, 0.14, 'square', 0.08), 110); }
}

