import { sound } from "@pixi/sound";
import { BackgroundMusic, BackgroundMusicState } from "../types";

/**
 * Manages background music playbook across the entire video
 * Uses PIXI Sound for better integration and performance
 * Handles looping, volume ducking, and timeline synchronization
 */
export class GlobalMusicManager {
  private musicConfig: BackgroundMusic | null = null;
  private musicState: BackgroundMusicState | null = null;
  private fadeInterval: number | null = null;
  // private videoTotalDuration: number = 0; // Future use for end-of-video fade out

  // Volume configuration
  private baseVolume: number = 0.3; // Base volume for background music (30%)
  private duckingVolume: number = 0.1; // Volume when voice over is playing (10%)
  private currentTargetVolume: number = 0.3;

  // Fade configuration (can be overridden by music config)
  private defaultFadeInDuration: number = 1000; // 1 second fade in
  private defaultFadeOutDuration: number = 1000; // 1 second fade out

  // Sync throttling to prevent performance issues
  private lastSyncTime: number = 0;
  private syncInterval: number = 1000; // Only sync every second

  constructor() {
    console.log("🎵 GlobalMusicManager initialized");
  }

  /**
   * Load background music from project data
   */
  async loadMusic(
    musicConfig: BackgroundMusic,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _totalDuration: number, // Future use for end-of-video fade out
  ): Promise<void> {
    console.log(`🎵 Loading background music: ${musicConfig.songTitle}`);

    this.musicConfig = musicConfig;

    // Normalize volume from JSON format (0-100) to 0.0-1.0
    this.baseVolume = (musicConfig.volume || 30) / 100;
    this.duckingVolume = musicConfig.duckingVolume || this.baseVolume * 0.3;
    this.currentTargetVolume = this.baseVolume;

    // Generate unique sound name for background music
    const soundName = `bg_music_${Date.now()}`;

    // Create music state
    this.musicState = {
      isLoaded: false,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      volume: this.baseVolume,
      isDucking: false,
      soundName,
      soundInstance: undefined,
    };

    // Load music using PIXI Sound
    await this.loadMusicWithPixi(musicConfig.songPreviewUrl, soundName);

    // Update state after loading
    this.musicState.isLoaded = true;
    const soundData = sound.find(soundName);
    this.musicState.duration = (soundData?.duration || 0) * 1000; // Convert to ms

    console.log(
      `✅ Background music loaded: ${musicConfig.songTitle} (${this.musicState.duration}ms, PIXI Sound)`,
    );
  }

  /**
   * Load music using PIXI Sound system
   */
  private loadMusicWithPixi(url: string, soundName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`PIXI Sound music load timeout: ${url}`));
      }, 20000); // 20 second timeout for background music

      // Add music to PIXI Sound library
      sound.add(soundName, {
        url: url,
        preload: true,
        loaded: (error, soundData) => {
          clearTimeout(timeoutId);

          if (error) {
            reject(new Error(`PIXI Sound music load error: ${error.message}`));
          } else {
            console.log(
              `🎵 PIXI Sound music loaded: ${soundName} (${soundData?.duration}s)`,
            );
            resolve();
          }
        },
      });
    });
  }

  /**
   * Start music playbook with fade in using PIXI Sound
   */
  async startPlayback(startTime: number = 0): Promise<void> {
    if (!this.musicState || !this.musicState.isLoaded) {
      console.warn("🎵 Cannot start music: not loaded");
      return;
    }

    console.log(`🎵 Starting background music at ${startTime}ms`);

    try {
      // Calculate loop position if music is shorter than video
      const musicDuration = this.musicState.duration / 1000; // Convert to seconds
      let playStartTime = Math.max(0, startTime / 1000);

      // Handle looping for shorter music
      if (musicDuration > 0 && playStartTime > musicDuration) {
        playStartTime = playStartTime % musicDuration;
      }

      // Start playing with PIXI Sound (await if it returns a Promise)
      const soundInstanceOrPromise = sound.play(this.musicState.soundName, {
        start: playStartTime,
        volume: 0, // Start muted for fade in
        loop: this.musicConfig?.loop !== false, // Default to loop
      });

      const soundInstance = await Promise.resolve(soundInstanceOrPromise);

      if (soundInstance) {
        this.musicState.soundInstance = soundInstance;
        this.musicState.isPlaying = true;
        this.musicState.isPaused = false;

        // Fade in music
        this.fadeToVolume(this.currentTargetVolume, this.getFadeInDuration());

        console.log(`🎵 Background music started successfully with PIXI Sound`);
      }
    } catch (error) {
      console.error("Failed to start background music:", error);
    }
  }

  /**
   * Pause music playbook
   */
  pausePlayback(): void {
    if (
      !this.musicState ||
      !this.musicState.isPlaying ||
      !this.musicState.soundInstance
    ) {
      return;
    }

    console.log("🎵 Pausing background music");

    this.musicState.soundInstance.paused = true;
    this.musicState.isPlaying = false;
    this.musicState.isPaused = true;
    this.clearFade();
  }

  /**
   * Stop music playback with fade out
   */
  async stopPlayback(): Promise<void> {
    if (!this.musicState || !this.musicState.soundInstance) {
      return;
    }

    console.log("🎵 Stopping background music");

    // Fade out then stop
    await this.fadeToVolume(0, this.getFadeOutDuration());
    this.musicState.soundInstance.stop();
    this.musicState.soundInstance = undefined;
    this.musicState.isPlaying = false;
    this.musicState.isPaused = false;
  }

  /**
   * Duck music volume when voice over is playing
   */
  duckVolume(isDucking: boolean): void {
    if (!this.musicState || !this.musicState.isPlaying) {
      return;
    }

    const targetVolume = isDucking ? this.duckingVolume : this.baseVolume;
    this.currentTargetVolume = targetVolume;
    this.musicState.isDucking = isDucking;

    // Quick crossfade to new volume (300ms)
    this.fadeToVolume(targetVolume, 300);

    console.log(
      `🎵 Music volume ${isDucking ? "ducked" : "restored"} to ${Math.round(targetVolume * 100)}%`,
    );
  }

  /**
   * Seek music to specific time position
   */
  async seekToTime(timeMs: number): Promise<void> {
    if (!this.musicState || !this.musicState.isLoaded) {
      return;
    }

    const timeSeconds = Math.max(0, timeMs / 1000);
    const musicDuration = this.musicState.duration / 1000;

    // Handle looping for music shorter than video
    let seekTime = timeSeconds;
    if (this.musicConfig?.loop !== false && musicDuration > 0) {
      // If video is longer than music and looping is enabled, calculate loop position
      seekTime = timeSeconds % musicDuration;
    }

    if (seekTime <= musicDuration && this.musicState.soundInstance) {
      // PIXI Sound doesn't have direct seek, restart from position if playing
      const wasPlaying = this.musicState.isPlaying;
      const currentVolume = this.musicState.soundInstance.volume;

      // Stop current instance
      this.musicState.soundInstance.stop();

      // Start new instance from the desired position if was playing
      if (wasPlaying) {
        const newInstanceOrPromise = sound.play(this.musicState.soundName, {
          start: seekTime,
          volume: currentVolume,
          loop: this.musicConfig?.loop !== false,
        });
        this.musicState.soundInstance =
          await Promise.resolve(newInstanceOrPromise);
      }

      this.musicState.currentTime = timeMs;
    } else {
      console.warn(
        `⚠️ Cannot seek music to ${timeMs}ms, duration is ${this.musicState.duration}ms`,
      );
    }
  }

  /**
   * Sync music with timeline (throttled to prevent performance issues)
   */
  syncWithTimeline(expectedTimeMs: number): void {
    if (
      !this.musicState ||
      !this.musicState.isPlaying ||
      !this.musicState.soundInstance
    ) {
      return;
    }

    const currentTime = performance.now();

    // Throttle sync calls - only sync every second
    if (currentTime - this.lastSyncTime < this.syncInterval) {
      return;
    }

    this.lastSyncTime = currentTime;

    // PIXI Sound instances track their progress (0-1), convert to time
    const progress = this.musicState.soundInstance.progress || 0;
    const actualTimeMs = progress * this.musicState.duration;
    const musicDuration = this.musicState.duration;

    // For looping music, calculate expected position within loop
    let expectedLoopTime = expectedTimeMs;
    if (this.musicConfig?.loop !== false && musicDuration > 0) {
      expectedLoopTime = expectedTimeMs % musicDuration;
    }

    const drift = Math.abs(expectedLoopTime - actualTimeMs);
    const syncThreshold = 1000; // 1 second tolerance for background music

    // If drift is significant, correct it
    if (drift > syncThreshold) {
      console.log(`🔧 Music sync correction: drift ${Math.round(drift)}ms`);
      // Fire and forget async seek
      this.seekToTime(expectedTimeMs).catch(console.error);
    }

    // Update internal state
    this.musicState.currentTime = actualTimeMs;
  }

  /**
   * Fade to target volume
   */
  private fadeToVolume(targetVolume: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.musicState || !this.musicState.soundInstance) {
        resolve();
        return;
      }

      this.clearFade();

      const soundInstance = this.musicState.soundInstance;
      const startVolume = soundInstance.volume;
      const volumeDiff = targetVolume - startVolume;
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = volumeDiff / steps;

      let currentStep = 0;

      this.fadeInterval = window.setInterval(() => {
        currentStep++;
        const newVolume = startVolume + volumeStep * currentStep;

        if (currentStep >= steps) {
          soundInstance.volume = targetVolume;
          this.clearFade();
          resolve();
        } else {
          soundInstance.volume = Math.max(0, Math.min(1, newVolume));
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
   * Get fade in duration from config or default
   */
  private getFadeInDuration(): number {
    return this.musicConfig?.fadeInDuration || this.defaultFadeInDuration;
  }

  /**
   * Get fade out duration from config or default
   */
  private getFadeOutDuration(): number {
    return this.musicConfig?.fadeOutDuration || this.defaultFadeOutDuration;
  }

  /**
   * Check if music is currently playing
   */
  isPlaying(): boolean {
    return this.musicState?.isPlaying || false;
  }

  /**
   * Check if music is loaded and ready
   */
  isReady(): boolean {
    return this.musicState?.isLoaded || false;
  }

  /**
   * Get current music state
   */
  getMusicState(): BackgroundMusicState | null {
    return this.musicState;
  }

  /**
   * Get current music config
   */
  getMusicConfig(): BackgroundMusic | null {
    return this.musicConfig;
  }

  /**
   * Clean up music resources
   */
  destroy(): void {
    console.log("🗑️ GlobalMusicManager cleanup");

    this.clearFade();

    if (this.musicState) {
      // Stop and clean up sound instance
      if (this.musicState.soundInstance) {
        this.musicState.soundInstance.stop();
        this.musicState.soundInstance = undefined;
      }

      // Remove sound from PIXI Sound library
      if (this.musicState.soundName) {
        sound.remove(this.musicState.soundName);
      }

      this.musicState = null;
    }

    this.musicConfig = null;
  }
}
