const MUTE_STORAGE_KEY = "puzzle-path-muted";

const getStoredMuted = (): boolean => localStorage.getItem(MUTE_STORAGE_KEY) === "true";

class GameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicStep = 0;
  private started = false;
  private muted = getStoredMuted();

  bindFirstGesture(): void {
    const unlock = (): void => {
      void this.resume();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  createMuteButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "control-button icon-button";
    button.type = "button";

    const update = (muted: boolean): void => {
      button.textContent = muted ? "🔇" : "🔊";
      button.setAttribute("aria-label", muted ? "เปิดเสียง" : "ปิดเสียง");
      button.title = muted ? "เปิดเสียง" : "ปิดเสียง";
    };

    update(this.muted);
    button.addEventListener("click", () => {
      void this.resume();
      this.setMuted(!this.muted);
      update(this.muted);
    });

    return button;
  }

  playPathBlip(pathLength: number): void {
    const playable = this.getPlayableNodes();
    if (!playable) {
      return;
    }

    const now = playable.context.currentTime;
    const frequency = Math.min(860, 360 + pathLength * 22);
    this.playTone(frequency, now, 0.075, 0.032, "sine", 0.006);
    this.playTone(frequency * 1.5, now + 0.01, 0.045, 0.015, "triangle", 0.004);
  }

  playUndo(): void {
    const playable = this.getPlayableNodes();
    if (!playable) {
      return;
    }

    const now = playable.context.currentTime;
    this.playSweep(300, 170, now, 0.11, 0.032, "triangle");
  }

  playWin(): void {
    const playable = this.getPlayableNodes();
    if (!playable) {
      return;
    }

    const now = playable.context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      this.playTone(frequency, now + index * 0.105, 0.22, 0.035, "sine", 0.018);
      this.playTone(frequency * 2, now + index * 0.105, 0.16, 0.012, "triangle", 0.014);
    });
  }

  playReset(): void {
    const playable = this.getPlayableNodes();
    if (!playable) {
      return;
    }

    const now = playable.context.currentTime;
    this.playSweep(520, 110, now, 0.22, 0.04, "sawtooth");
  }

  playSoftClick(): void {
    const playable = this.getPlayableNodes();
    if (!playable) {
      return;
    }

    const now = playable.context.currentTime;
    this.playTone(420, now, 0.045, 0.018, "sine", 0.004);
    this.playTone(620, now + 0.018, 0.04, 0.014, "triangle", 0.004);
  }

  private async resume(): Promise<void> {
    this.ensureContext();

    if (!this.context) {
      return;
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    if (!this.muted) {
      this.startMusic();
    }
  }

  private setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));

    if (this.masterGain && this.context) {
      this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.025);
    }

    if (!muted) {
      void this.resume();
    }
  }

  private getPlayableNodes(): { context: AudioContext; sfxGain: GainNode } | null {
    if (this.muted) {
      return null;
    }

    this.ensureContext();
    void this.resume();
    if (!this.context || !this.sfxGain) {
      return null;
    }

    return { context: this.context, sfxGain: this.sfxGain };
  }

  private ensureContext(): void {
    if (this.context) {
      return;
    }

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();

    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.musicGain.gain.value = 0.055;
    this.sfxGain.gain.value = 0.34;

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
  }

  private startMusic(): void {
    if (!this.context || this.started || this.muted) {
      return;
    }

    this.started = true;
    this.scheduleMusicStep();
    window.setInterval(() => this.scheduleMusicStep(), 420);
  }

  private scheduleMusicStep(): void {
    if (!this.context || !this.musicGain || this.muted) {
      return;
    }

    const scale = [261.63, 329.63, 392, 493.88, 659.25, 587.33, 392, 329.63];
    const now = this.context.currentTime + 0.025;
    const musicGain = this.musicGain;
    const frequency = scale[this.musicStep % scale.length];
    this.musicStep += 1;

    this.playTone(frequency, now, 0.34, 0.018, "sine", 0.028, musicGain);

    if (this.musicStep % 4 === 1) {
      [frequency / 2, frequency * 1.5].forEach((padFrequency) => {
        this.playTone(padFrequency, now, 1.3, 0.012, "triangle", 0.28, musicGain);
      });
    }
  }

  private playTone(
    frequency: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
    attack: number,
    target: GainNode = this.sfxGain as GainNode,
  ): void {
    if (!this.context || !target) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const endTime = startTime + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(target);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.025);
  }

  private playSweep(
    startFrequency: number,
    endFrequency: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
  ): void {
    if (!this.context || !this.sfxGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const endTime = startTime + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.025);
  }
}

export const gameAudio = new GameAudio();
