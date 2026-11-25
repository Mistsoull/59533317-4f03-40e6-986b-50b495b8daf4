const MUTE_STORAGE_KEY = 'cozy_kitchen_muted_v1';

class KitchenAudioEngine {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private muted = false;
  private listenersAttached = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isUnlocked(): boolean {
    return this.unlocked && this.ctx?.state === 'running';
  }

  public setMuted(next: boolean): void {
    this.muted = next;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Ignore storage quota / private mode failures
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.unlockSync();
      this.playTap();
    }
    return this.muted;
  }

  /**
   * MUST be called synchronously inside a pointerdown / touchstart handler
   * to unlock iOS Safari Standalone PWA Web Audio.
   */
  public unlockSync(): boolean {
    if (typeof window === 'undefined') return false;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
      void this.ctx.resume();
    }

    if (!this.unlocked) {
      try {
        // 1-sample silent buffer reliably primes iOS Safari audio output
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.ctx.destination);
        src.start(0);
        this.unlocked = true;
      } catch {
        // Retry on next user gesture
      }
    }

    this.attachLifecycleRecovery();
    return true;
  }

  private attachLifecycleRecovery(): void {
    if (this.listenersAttached || typeof document === 'undefined') return;
    this.listenersAttached = true;

    const markNeedsResume = () => {
      if (document.visibilityState === 'visible' && this.ctx && this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => {
          // Will resume synchronously on next pointerdown
        });
      }
    };

    document.addEventListener('visibilitychange', markNeedsResume);
    window.addEventListener('pageshow', markNeedsResume);
  }

  private getReadyContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) return null;
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.14,
    endFreq?: number,
    delaySec = 0,
  ): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playTap(): void {
    this.playTone(520, 0.07, 'triangle', 0.1, 680);
  }

  public playStep(): void {
    this.playTone(170, 0.045, 'sine', 0.045, 110);
  }

  public playChop(perfect = true): void {
    if (perfect) {
      this.playTone(320, 0.06, 'triangle', 0.16, 120);
      this.playTone(760, 0.09, 'sine', 0.1, 980, 0.03);
    } else {
      this.playTone(210, 0.07, 'sawtooth', 0.08, 120);
    }
  }

  public playFlip(): void {
    this.playTone(420, 0.11, 'triangle', 0.14, 860);
  }

  public playSizzle(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    const length = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3400;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  public playCoin(): void {
    this.playTone(880, 0.09, 'sine', 0.12, 920, 0);
    this.playTone(1318, 0.18, 'sine', 0.13, 1340, 0.075);
  }

  public playSuccess(): void {
    this.playTone(523.25, 0.12, 'triangle', 0.13, undefined, 0);
    this.playTone(659.25, 0.12, 'triangle', 0.13, undefined, 0.09);
    this.playTone(783.99, 0.22, 'triangle', 0.15, undefined, 0.18);
  }

  public playError(): void {
    this.playTone(260, 0.1, 'sawtooth', 0.09, 180, 0);
    this.playTone(190, 0.14, 'sawtooth', 0.09, 140, 0.09);
  }

  /** Bright metallic bistro service bell ("Ding!") for new customer / order dispatch */
  public playBell(): void {
    this.playTone(1174.66, 0.28, 'sine', 0.13, 1170, 0);
    this.playTone(2349.32, 0.18, 'sine', 0.06, 2340, 0);
  }

  /** Soft double chime when an order enters urgent (<20%) patience */
  public playUrgent(): void {
    this.playTone(587.33, 0.09, 'triangle', 0.09, 520, 0);
    this.playTone(587.33, 0.1, 'triangle', 0.09, 480, 0.12);
  }
}

export const kitchenAudio = new KitchenAudioEngine();
