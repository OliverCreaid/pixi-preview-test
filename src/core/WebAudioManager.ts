/**
 * Web Audio API manager for better audio control and tab switching handling
 * Replaces PIXI Sound for more reliable audio playbook
 */
export class WebAudioManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeAudioContext();
  }

  /**
   * Initialize Web Audio Context
   */
  private initializeAudioContext(): void {
    try {
      // Create AudioContext
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Create master gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);

      this.isInitialized = true;
      console.log("🎵 Web Audio Context initialized");
    } catch (error) {
      console.error("Failed to initialize Web Audio Context:", error);
    }
  }

  /**
   * Get the audio context (create if needed)
   */
  getAudioContext(): AudioContext | null {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.initializeAudioContext();
    }
    return this.audioContext;
  }

  /**
   * Get the master gain node
   */
  getGainNode(): GainNode | null {
    return this.gainNode;
  }

  /**
   * Resume audio context if suspended (handles autoplay policies and tab switching)
   */
  async resumeContext(): Promise<void> {
    if (!this.audioContext) return;

    if (this.audioContext.state === "suspended") {
      console.log("🎵 Resuming suspended Audio Context");
      try {
        await this.audioContext.resume();
        console.log("🎵 Audio Context resumed successfully");
      } catch (error) {
        console.error("Failed to resume Audio Context:", error);
      }
    }
  }

  /**
   * Load audio buffer from URL
   */
  async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error("Audio context not initialized");
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      console.log(
        `🎵 Loaded audio buffer: ${url} (${audioBuffer.duration.toFixed(2)}s)`,
      );
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load audio from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Create and start audio source from buffer
   */
  createAudioSource(
    audioBuffer: AudioBuffer,
    startTime: number = 0,
    volume: number = 1,
    loop: boolean = false,
  ): AudioBufferSourceNode | null {
    if (!this.audioContext || !this.gainNode) {
      console.warn("Audio context not available");
      return null;
    }

    try {
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = loop;

      // Fix looping with start offset - set loop points correctly
      if (loop && startTime > 0) {
        source.loopStart = startTime;
        source.loopEnd = audioBuffer.duration;
        console.log(
          `🔄 Set loop points: start=${startTime.toFixed(2)}s, end=${audioBuffer.duration.toFixed(2)}s`,
        );
      }

      // Create gain node for this source
      const sourceGain = this.audioContext.createGain();
      sourceGain.gain.value = volume;

      // Connect: source -> sourceGain -> masterGain -> destination
      source.connect(sourceGain);
      sourceGain.connect(this.gainNode);

      // Start playback
      const when = this.audioContext.currentTime;
      const offset = Math.max(0, startTime);

      source.start(when, offset);

      console.log(
        `🎵 Started audio source at offset ${offset.toFixed(2)}s, volume ${volume}`,
      );

      // Store gain node reference for volume control
      (source as AudioBufferSourceNode & { __gainNode: GainNode }).__gainNode =
        sourceGain;
      return source;
    } catch (error) {
      console.error("Failed to create audio source:", error);
      return null;
    }
  }

  /**
   * Stop audio source
   */
  stopAudioSource(source: AudioBufferSourceNode): void {
    try {
      source.stop();
      source.disconnect();
    } catch (error) {
      // Source might already be stopped
      console.warn("Error stopping audio source:", error);
    }
  }

  /**
   * Set volume for audio source
   */
  setSourceVolume(source: AudioBufferSourceNode, volume: number): void {
    const gainNode = (
      source as AudioBufferSourceNode & { __gainNode: GainNode }
    ).__gainNode;
    if (gainNode) {
      gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Fade volume for audio source
   */
  fadeSourceVolume(
    source: AudioBufferSourceNode,
    targetVolume: number,
    duration: number,
  ): void {
    const gainNode = (
      source as AudioBufferSourceNode & { __gainNode: GainNode }
    ).__gainNode;
    if (!gainNode || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(currentTime);
    gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + duration);
  }

  /**
   * Get current audio context time
   */
  getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }

  /**
   * Check if audio context is running
   */
  isRunning(): boolean {
    return this.audioContext?.state === "running";
  }

  /**
   * Destroy audio context
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
      this.isInitialized = false;
      console.log("🗑️ Web Audio Context destroyed");
    }
  }
}

// Global instance
export const webAudioManager = new WebAudioManager();
