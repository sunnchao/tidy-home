const CLIP_NAMES = [
  'pick',
  'deliver',
  'box_seal',
  'blocked',
  'cardboard_hit',
  'cardboard_open',
  'fever',
  'meow_mischief',
  'meow_happy',
  'booster',
  'win',
  'fail',
] as const;

export type SfxName = (typeof CLIP_NAMES)[number];

export class WebAudioPlayer {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadingStarted = false;
  public muted = false;

  unlockAndPreload(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    if (!this.loadingStarted) {
      this.loadingStarted = true;
      void this.preloadAll();
    }
  }

  private async preloadAll(): Promise<void> {
    if (!this.ctx) return;
    await Promise.all(
      CLIP_NAMES.map(async (name) => {
        try {
          const resp = await fetch(`/resources/audio/${name}.wav`);
          if (!resp.ok) return;
          const arr = await resp.arrayBuffer();
          const decoded = await this.ctx!.decodeAudioData(arr);
          this.buffers.set(name, decoded);
        } catch {
          // Ignore audio decode failures in constrained environments
        }
      })
    );
  }

  play(name: SfxName, playbackRate = 1): void {
    if (this.muted) return;
    this.unlockAndPreload();
    if (!this.ctx) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.75, Math.min(1.6, playbackRate));
      const gain = this.ctx.createGain();
      gain.gain.value = 0.72;
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(0);
    } catch {
      // Ignore playback errors
    }
  }
}
