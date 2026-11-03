// Sound of wind and water, synthesised with the Web Audio API (no audio files):
//   wind     filtered noise, louder and brighter with the apparent wind; a faint whistle
//            in strong wind
//   water    slow lapping of small waves, plus a rushing hiss that grows with boat speed
//   sails    a fluttering rumble while sails are flapping
// Browsers only allow sound after a user gesture, so it starts on the first click or key.

export interface SoundInput {
  /** Apparent wind speed, m/s. */
  apparentWind: number;
  /** Boat speed through the water, m/s. */
  boatSpeed: number;
  /** Share of the set sails that are flapping, 0..1. */
  flapping: number;
}

export class Sound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private windGain?: GainNode;
  private windFilter?: BiquadFilterNode;
  private whistleGain?: GainNode;
  private whistle?: BiquadFilterNode;
  private rushGain?: GainNode;
  private flapGain?: GainNode;
  private muted = false;
  private t = 0;

  constructor() {
    const start = () => {
      this.start();
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  get enabled(): boolean {
    return !this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }

  private start(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    // Two seconds of noise, looped: the raw material for every sound here.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Slightly "pink": softer highs than white noise.
      last = 0.97 * last + 0.03 * (Math.random() * 2 - 1);
      data[i] = last * 6 + (Math.random() * 2 - 1) * 0.15;
    }
    const noise = () => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = Math.random();
      src.start(0, Math.random() * 2);
      return src;
    };

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // Wind: low-passed noise.
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise().connect(this.windFilter).connect(this.windGain).connect(this.master);

    // A faint whistle in the rigging (narrow band), only in a strong wind.
    this.whistle = ctx.createBiquadFilter();
    this.whistle.type = 'bandpass';
    this.whistle.frequency.value = 1200;
    this.whistle.Q.value = 18;
    this.whistleGain = ctx.createGain();
    this.whistleGain.gain.value = 0;
    noise().connect(this.whistle).connect(this.whistleGain).connect(this.master);

    // Water lapping: band-passed noise, its loudness swayed by a slow wave rhythm.
    const lapFilter = ctx.createBiquadFilter();
    lapFilter.type = 'bandpass';
    lapFilter.frequency.value = 420;
    lapFilter.Q.value = 0.8;
    const lapGain = ctx.createGain();
    lapGain.gain.value = 0.18;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.12;
    lfo.connect(lfoDepth).connect(lapGain.gain);
    lfo.start();
    noise().connect(lapFilter).connect(lapGain).connect(this.master);

    // Rush of water along the hull: brighter noise, louder with speed.
    const rushFilter = ctx.createBiquadFilter();
    rushFilter.type = 'bandpass';
    rushFilter.frequency.value = 1400;
    rushFilter.Q.value = 0.5;
    this.rushGain = ctx.createGain();
    this.rushGain.gain.value = 0;
    noise().connect(rushFilter).connect(this.rushGain).connect(this.master);

    // Flapping sails: low noise chopped by a fast flutter.
    const flapFilter = ctx.createBiquadFilter();
    flapFilter.type = 'lowpass';
    flapFilter.frequency.value = 300;
    const flutter = ctx.createGain();
    flutter.gain.value = 0;
    const flutterOsc = ctx.createOscillator();
    flutterOsc.type = 'square';
    flutterOsc.frequency.value = 7;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.5;
    flutterOsc.connect(flutterDepth).connect(flutter.gain);
    flutterOsc.start();
    this.flapGain = ctx.createGain();
    this.flapGain.gain.value = 0;
    noise().connect(flapFilter).connect(flutter).connect(this.flapGain).connect(this.master);
  }

  /** Call every frame. */
  update(input: SoundInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.windGain || !this.windFilter || !this.whistleGain || !this.whistle || !this.rushGain || !this.flapGain) return;
    this.t += dt;
    const now = ctx.currentTime;
    const aw = Math.max(0, input.apparentWind);
    // Gusty breathing in the wind's loudness, so it never sounds like a steady hiss.
    const breath = 1 + 0.25 * Math.sin(this.t * 0.7) + 0.15 * Math.sin(this.t * 1.9 + 1);
    this.windGain.gain.setTargetAtTime(Math.min(0.5, 0.0035 * aw * aw) * breath, now, 0.3);
    this.windFilter.frequency.setTargetAtTime(300 + aw * 70 * breath, now, 0.3);
    this.whistleGain.gain.setTargetAtTime(aw > 7 ? Math.min(0.06, (aw - 7) * 0.012) * breath : 0, now, 0.5);
    this.whistle.frequency.setTargetAtTime(900 + aw * 40, now, 0.5);
    const v = Math.max(0, input.boatSpeed);
    this.rushGain.gain.setTargetAtTime(Math.min(0.35, 0.03 * v * v), now, 0.4);
    this.flapGain.gain.setTargetAtTime(Math.min(1, input.flapping) * Math.min(0.5, 0.012 * aw * aw), now, 0.15);
  }
}
