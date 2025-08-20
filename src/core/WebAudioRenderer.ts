import { webAudioManager } from "./WebAudioManager";
import { VoiceElement, AudioConfig, AudioState } from "../types";

/**
 * Web Audio API-based audio renderer for voice over tracks
 * Replaces PIXI Sound for better tab switching and timing control
 */
export class WebAudioRenderer {
  private config: AudioConfig;
  private audioState: AudioState | null = null;
  private currentVoiceElement: VoiceElement | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private startTimeOffset: number = 0;
  private pausedAt: number = 0;
  private isActuallyPlaying: boolean = false;

  constructor(config?: Partial<AudioConfig>) {
    this.config = {
      enabled: true,
      volume: 0.7,
      fadeInDuration: 200,
      fadeOutDuration: 200,
      crossfadeDuration: 300,
      ...config,
    };
  }

  /**
   * Load and prepare audio for a voice element using Web Audio API
   */
  async loadVoiceElement(voiceElement: VoiceElement): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Create audio state
    this.audioState = {
      isLoaded: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: this.config.volume,
      soundName: `voice_${voiceElement.id}_${Date.now()}`,
      soundInstance: undefined,
    };

    this.currentVoiceElement = voiceElement;

    // Load audio buffer using Web Audio API
    this.audioBuffer = await webAudioManager.loadAudioBuffer(
      voiceElement.value,
    );

    // Update state after loading
    this.audioState.isLoaded = true;
    this.audioState.duration = this.audioBuffer.duration * 1000; // Convert to ms
  }

  /**
   * Start audio playback with fade in using Web Audio API
   */
  async startPlayback(startTime: number = 0): Promise<void> {
    if (
      !this.audioState ||
      !this.config.enabled ||
      !this.audioState.isLoaded ||
      !this.audioBuffer
    ) {
      return;
    }

    try {
      // Resume audio context if suspended (handles autoplay policies and tab switching)
      await webAudioManager.resumeContext();

      // Stop any existing playback
      if (this.audioSource) {
        this.stopPlayback();
      }

      // Create and start audio source
      const startTimeSeconds = Math.max(0, startTime / 1000);
      this.audioSource = webAudioManager.createAudioSource(
        this.audioBuffer,
        startTimeSeconds,
        0, // Start muted for fade in
        false, // Don't loop voice audio
      );

      if (this.audioSource) {
        this.audioState.isPlaying = true;
        this.isActuallyPlaying = true;
        this.startTimeOffset =
          webAudioManager.getCurrentTime() - startTimeSeconds;
        this.pausedAt = 0;

        // Handle source end
        this.audioSource.onended = () => {
          this.audioState!.isPlaying = false;
          this.isActuallyPlaying = false;
          this.audioSource = null;
        };

        // Fade in
        this.fadeIn();
      }
    } catch {
      // Failed to start audio playback
    }
  }

  /**
   * Pause audio playback
   */
  pausePlayback(): void {
    if (!this.audioState || !this.audioSource || !this.isActuallyPlaying) {
      return;
    }

    // Calculate where we paused
    const currentTime = webAudioManager.getCurrentTime();
    this.pausedAt = currentTime - this.startTimeOffset;

    // Stop the current source
    webAudioManager.stopAudioSource(this.audioSource);
    this.audioSource = null;
    this.audioState.isPlaying = false;
    this.isActuallyPlaying = false;
  }

  /**
   * Stop audio playback with fade out
   */
  async stopPlayback(): Promise<void> {
    if (!this.audioState || !this.audioSource) {
      return;
    }

    // Fade out then stop
    if (this.isActuallyPlaying) {
      await this.fadeOut();
    }

    if (this.audioSource) {
      webAudioManager.stopAudioSource(this.audioSource);
      this.audioSource = null;
    }

    this.audioState.isPlaying = false;
    this.isActuallyPlaying = false;
    this.pausedAt = 0;
  }

  /**
   * Seek audio to specific time position
   */
  async seekToTime(timeMs: number): Promise<void> {
    if (!this.audioState || !this.audioState.isLoaded || !this.audioBuffer) {
      return;
    }

    const timeSeconds = Math.max(0, timeMs / 1000);
    const maxTime = this.audioState.duration / 1000;

    if (timeSeconds <= maxTime) {
      const wasPlaying = this.audioState.isPlaying;
      const currentVolume = this.getCurrentVolume();

      // Stop current playback
      if (this.audioSource) {
        webAudioManager.stopAudioSource(this.audioSource);
        this.audioSource = null;
      }

      this.audioState.isPlaying = false;
      this.isActuallyPlaying = false;

      // Start new playback from the desired position if it was playing
      if (wasPlaying) {
        await webAudioManager.resumeContext();

        this.audioSource = webAudioManager.createAudioSource(
          this.audioBuffer,
          timeSeconds,
          currentVolume,
          false,
        );

        if (this.audioSource) {
          this.audioState.isPlaying = true;
          this.isActuallyPlaying = true;
          this.startTimeOffset = webAudioManager.getCurrentTime() - timeSeconds;
          this.pausedAt = 0;

          // Handle source end
          this.audioSource.onended = () => {
            this.audioState!.isPlaying = false;
            this.isActuallyPlaying = false;
            this.audioSource = null;
          };
        }
      }

      this.audioState.currentTime = timeMs;
    } else {
      // Cannot seek beyond audio duration
    }
  }

  /**
   * Sync audio with timeline
   */
  syncWithTimeline(expectedTimeMs: number): void {
    if (
      !this.audioState ||
      !this.audioState.isPlaying ||
      !this.audioSource ||
      !this.isActuallyPlaying
    ) {
      return;
    }

    // Calculate actual playback time
    const currentTime = webAudioManager.getCurrentTime();
    const actualTimeMs = (currentTime - this.startTimeOffset) * 1000;
    const drift = Math.abs(expectedTimeMs - actualTimeMs);
    const syncThreshold = 300; // 300ms threshold

    // If drift is significant, correct it
    if (drift > syncThreshold) {
      this.seekToTime(expectedTimeMs).catch(() => {});
    }

    // Update internal state
    this.audioState.currentTime = actualTimeMs;
  }

  /**
   * Resume playback after pause
   */
  async resumePlayback(): Promise<void> {
    if (!this.audioState || this.isActuallyPlaying || this.pausedAt === 0) {
      return;
    }

    await this.startPlayback(this.pausedAt * 1000);
  }

  /**
   * Fade in audio volume
   */
  private fadeIn(): void {
    if (!this.audioSource) return;

    webAudioManager.fadeSourceVolume(
      this.audioSource,
      this.config.volume,
      this.config.fadeInDuration / 1000,
    );
  }

  /**
   * Fade out audio volume
   */
  private fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioSource) {
        resolve();
        return;
      }

      webAudioManager.fadeSourceVolume(
        this.audioSource,
        0,
        this.config.fadeOutDuration / 1000,
      );

      // Resolve after fade duration
      setTimeout(resolve, this.config.fadeOutDuration);
    });
  }

  /**
   * Get current volume
   */
  private getCurrentVolume(): number {
    return this.config.volume;
  }

  /**
   * Set volume level
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));

    if (this.audioState) {
      this.audioState.volume = this.config.volume;

      if (this.audioSource) {
        webAudioManager.setSourceVolume(this.audioSource, this.config.volume);
      }
    }
  }

  /**
   * Get current audio state
   */
  getAudioState(): AudioState | null {
    return this.audioState;
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.audioState?.isPlaying || false;
  }

  /**
   * Check if audio is loaded and ready
   */
  isReady(): boolean {
    return this.audioState?.isLoaded || false;
  }

  /**
   * Get current voice element
   */
  getCurrentVoiceElement(): VoiceElement | null {
    return this.currentVoiceElement;
  }

  /**
   * Update audio configuration
   */
  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clean up audio resources
   */
  destroy(): void {
    if (this.audioSource) {
      webAudioManager.stopAudioSource(this.audioSource);
      this.audioSource = null;
    }

    this.audioState = null;
    this.currentVoiceElement = null;
    this.audioBuffer = null;
    this.isActuallyPlaying = false;
  }
}
