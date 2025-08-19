import { sound } from "@pixi/sound";
import { VoiceElement, AudioConfig, AudioState } from "../types";

/**
 * Handles audio playbook for voice over tracks in scenes
 * Uses PIXI Sound for better integration and performance
 */
export class AudioRenderer {
  private config: AudioConfig;
  private audioState: AudioState | null = null;
  private currentVoiceElement: VoiceElement | null = null;
  private fadeInterval: number | null = null;
  private syncThreshold: number = 300; // ms - acceptable sync drift before correction
  private lastSyncTime: number = 0; // Track last sync time to throttle sync calls
  private syncInterval: number = 500; // Only sync every 500ms instead of every frame

  constructor(config?: Partial<AudioConfig>) {
    this.config = {
      enabled: true,
      volume: 0.7, // 70% volume by default for voice over
      fadeInDuration: 200, // 200ms fade in
      fadeOutDuration: 200, // 200ms fade out
      crossfadeDuration: 300, // 300ms crossfade between scenes
      ...config,
    };

    console.log("🎵 AudioRenderer initialized with config:", this.config);
  }

  /**
   * Load and prepare audio for a voice element using PIXI Sound
   */
  async loadVoiceElement(voiceElement: VoiceElement): Promise<void> {
    if (!this.config.enabled) {
      console.log("🔇 Audio disabled, skipping voice element load");
      return;
    }

    console.log(`🎵 Loading voice element: ${voiceElement.value}`);

    // Generate unique sound name for this voice element
    const soundName = `voice_${voiceElement.id}_${Date.now()}`;

    // Create audio state
    this.audioState = {
      isLoaded: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: this.config.volume,
      soundName,
      soundInstance: undefined,
    };

    this.currentVoiceElement = voiceElement;

    // Load sound using PIXI Sound
    await this.loadSoundWithPixi(voiceElement.value, soundName);

    // Update state after loading
    this.audioState.isLoaded = true;
    const soundData = sound.find(soundName);
    this.audioState.duration = (soundData?.duration || 0) * 1000; // Convert to ms

    console.log(
      `✅ Voice element loaded: ${voiceElement.value} (${this.audioState.duration}ms)`,
    );
  }

  /**
   * Load sound using PIXI Sound system
   */
  private loadSoundWithPixi(url: string, soundName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`PIXI Sound load timeout: ${url}`));
      }, 15000); // 15 second timeout

      // Add sound to PIXI Sound library
      sound.add(soundName, {
        url: url,
        preload: true,
        loaded: (error, soundData) => {
          clearTimeout(timeoutId);

          if (error) {
            reject(new Error(`PIXI Sound load error: ${error.message}`));
          } else {
            console.log(
              `🎵 PIXI Sound loaded: ${soundName} (${soundData?.duration}s)`,
            );
            resolve();
          }
        },
      });
    });
  }

  /**
   * Start audio playbook with fade in using PIXI Sound
   */
  async startPlayback(startTime: number = 0): Promise<void> {
    if (!this.audioState || !this.config.enabled || !this.audioState.isLoaded) {
      return;
    }

    console.log(`▶️ Starting audio playbook at ${startTime}ms`);

    try {
      // Start playing with PIXI Sound (await if it returns a Promise)
      const soundInstanceOrPromise = sound.play(this.audioState.soundName, {
        start: Math.max(0, startTime / 1000), // Convert ms to seconds
        volume: 0, // Start muted for fade in
        loop: false,
      });

      const soundInstance = await Promise.resolve(soundInstanceOrPromise);

      if (soundInstance) {
        this.audioState.soundInstance = soundInstance;
        this.audioState.isPlaying = true;

        // Fade in
        this.fadeIn();

        console.log(`🎵 Audio playbook started successfully with PIXI Sound`);
      }
    } catch (error) {
      console.error("Failed to start audio playbook:", error);
    }
  }

  /**
   * Pause audio playback
   */
  pausePlayback(): void {
    if (!this.audioState || !this.audioState.soundInstance) {
      return;
    }

    console.log("⏸️ Pausing audio playback");

    // Additional safety check - soundInstance might be destroyed/null
    try {
      if (
        this.audioState.soundInstance &&
        typeof this.audioState.soundInstance.paused !== "undefined"
      ) {
        this.audioState.soundInstance.paused = true;
      }
    } catch (error) {
      console.warn(
        "⚠️ Error pausing audio - sound instance may be destroyed:",
        error,
      );
      // Clean up the reference if the instance is invalid
      this.audioState.soundInstance = undefined;
    }

    this.audioState.isPlaying = false;
    this.clearFade();
  }

  /**
   * Stop audio playback with fade out
   */
  async stopPlayback(): Promise<void> {
    if (!this.audioState || !this.audioState.soundInstance) {
      return;
    }

    console.log("⏹️ Stopping audio playback");

    // Fade out then stop
    await this.fadeOut();

    try {
      if (this.audioState.soundInstance) {
        this.audioState.soundInstance.stop();
      }
    } catch (error) {
      console.warn(
        "⚠️ Error stopping audio - sound instance may be destroyed:",
        error,
      );
    }

    this.audioState.soundInstance = undefined;
    this.audioState.isPlaying = false;
  }

  /**
   * Seek audio to specific time position
   */
  async seekToTime(timeMs: number): Promise<void> {
    if (!this.audioState || !this.audioState.isLoaded) {
      return;
    }

    const timeSeconds = Math.max(0, timeMs / 1000);
    const maxTime = this.audioState.duration / 1000; // Convert ms to seconds

    if (timeSeconds <= maxTime) {
      // PIXI Sound doesn't have direct seek, so we need to restart from the position
      const wasPlaying = this.audioState.isPlaying;
      const currentVolume =
        this.audioState.soundInstance?.volume || this.config.volume;

      // Always stop current instance first (even if it doesn't exist)
      try {
        if (this.audioState.soundInstance) {
          this.audioState.soundInstance.stop();
        }
      } catch (error) {
        console.warn(
          "⚠️ Error stopping audio during seek - sound instance may be destroyed:",
          error,
        );
      }

      // Clear the old instance reference
      this.audioState.soundInstance = undefined;
      this.audioState.isPlaying = false;

      // Start new instance from the desired position if it was playing
      if (wasPlaying) {
        const newInstanceOrPromise = sound.play(this.audioState.soundName, {
          start: timeSeconds,
          volume: currentVolume,
          loop: false,
        });
        const newInstance = await Promise.resolve(newInstanceOrPromise);

        if (newInstance) {
          this.audioState.soundInstance = newInstance;
          this.audioState.isPlaying = true;
        }
      }

      this.audioState.currentTime = timeMs;
    } else {
      console.warn(
        `⚠️ Cannot seek to ${timeMs}ms, audio duration is ${this.audioState.duration}ms`,
      );
    }
  }

  /**
   * Sync audio with timeline (call regularly during playbook)
   * Throttled to avoid excessive seeking
   */
  syncWithTimeline(expectedTimeMs: number): void {
    if (
      !this.audioState ||
      !this.audioState.isPlaying ||
      !this.audioState.soundInstance
    ) {
      return;
    }

    const currentTime = performance.now();

    // Throttle sync calls - only sync every 500ms instead of every frame
    if (currentTime - this.lastSyncTime < this.syncInterval) {
      return;
    }

    this.lastSyncTime = currentTime;

    // PIXI Sound instances track their progress (0-1), convert to time
    const progress = this.audioState.soundInstance.progress || 0;
    const actualTimeMs = progress * this.audioState.duration;
    const drift = Math.abs(expectedTimeMs - actualTimeMs);

    // If drift is significant, correct it
    if (drift > this.syncThreshold) {
      console.log(`🔧 Audio sync correction: drift ${Math.round(drift)}ms`);
      // Fire and forget async seek
      this.seekToTime(expectedTimeMs).catch(console.error);
    }

    // Update internal state
    this.audioState.currentTime = actualTimeMs;
  }

  /**
   * Fade in audio volume
   */
  private fadeIn(): void {
    if (!this.audioState || !this.audioState.soundInstance) return;

    this.clearFade();

    const soundInstance = this.audioState.soundInstance;
    if (!soundInstance) return;
    const startVolume = 0;
    const targetVolume = this.config.volume;
    const duration = this.config.fadeInDuration;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = (targetVolume - startVolume) / steps;

    let currentStep = 0;
    soundInstance.volume = startVolume;

    this.fadeInterval = window.setInterval(() => {
      currentStep++;
      const newVolume = startVolume + volumeStep * currentStep;

      if (currentStep >= steps) {
        soundInstance.volume = targetVolume;
        this.clearFade();
      } else {
        soundInstance.volume = Math.min(newVolume, targetVolume);
      }
    }, stepDuration);
  }

  /**
   * Fade out audio volume
   */
  private fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioState || !this.audioState.soundInstance) {
        resolve();
        return;
      }

      this.clearFade();

      const soundInstance = this.audioState.soundInstance;
      const startVolume = soundInstance.volume;
      const targetVolume = 0;
      const duration = this.config.fadeOutDuration;
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = (startVolume - targetVolume) / steps;

      let currentStep = 0;

      this.fadeInterval = window.setInterval(() => {
        currentStep++;
        const newVolume = startVolume - volumeStep * currentStep;

        if (currentStep >= steps) {
          soundInstance.volume = targetVolume;
          this.clearFade();
          resolve();
        } else {
          soundInstance.volume = Math.max(newVolume, targetVolume);
        }
      }, stepDuration);
    });
  }

  /**
   * Clear any active fade interval
   */
  private clearFade(): void {
    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  /**
   * Set volume level
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));

    if (this.audioState) {
      this.audioState.volume = this.config.volume;
      // Only apply immediately if not fading
      if (this.fadeInterval === null && this.audioState.soundInstance) {
        try {
          this.audioState.soundInstance.volume = this.config.volume;
        } catch (error) {
          console.warn(
            "⚠️ Error setting audio volume - sound instance may be destroyed:",
            error,
          );
          this.audioState.soundInstance = undefined;
        }
      }
    }

    console.log(`🔊 Audio volume set to ${this.config.volume}`);
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
    console.log("🔧 Audio config updated:", this.config);
  }

  /**
   * Clean up audio resources
   */
  destroy(): void {
    console.log("🗑️ AudioRenderer cleanup");

    this.clearFade();

    if (this.audioState) {
      // Stop and clean up sound instance
      if (this.audioState.soundInstance) {
        try {
          this.audioState.soundInstance.stop();
        } catch (error) {
          console.warn(
            "⚠️ Error stopping audio during cleanup - sound instance may be destroyed:",
            error,
          );
        }
        this.audioState.soundInstance = undefined;
      }

      // Remove sound from PIXI Sound library
      if (this.audioState.soundName) {
        try {
          sound.remove(this.audioState.soundName);
        } catch (error) {
          console.warn(
            "⚠️ Error removing sound from PIXI Sound library:",
            error,
          );
        }
      }

      this.audioState = null;
    }

    this.currentVoiceElement = null;
  }
}
