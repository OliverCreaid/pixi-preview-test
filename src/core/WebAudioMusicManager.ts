import { webAudioManager } from "./WebAudioManager";
import { BackgroundMusic, BackgroundMusicState } from "../types";

/**
 * Web Audio API-based music manager for background music
 * Replaces PIXI Sound for better tab switching and timing control
 */
export class WebAudioMusicManager {
  private musicConfig: BackgroundMusic | null = null;
  private musicState: BackgroundMusicState | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private startTimeOffset: number = 0;
  private pausedAt: number = 0;
  private isActuallyPlaying: boolean = false;

  // Volume configuration
  private baseVolume: number = 0.3;
  private duckingVolume: number = 0.15; // Less extreme ducking - 15% instead of 10%
  private currentTargetVolume: number = 0.3;

  // Fade configuration
  private defaultFadeInDuration: number = 1000;
  private defaultFadeOutDuration: number = 1000;
  private duckingFadeInDuration: number = 1500; // 1.5s fade when voice starts
  private duckingFadeOutDuration: number = 2000; // 2s fade when voice ends

  constructor() {
    console.log("🎵 WebAudioMusicManager initialized");
  }

  /**
   * Load background music from project data
   */
  async loadMusic(
    musicConfig: BackgroundMusic,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _totalDuration: number,
  ): Promise<void> {
    console.log(`🎵 Loading background music: ${musicConfig.songTitle}`);
    console.log(`🎵 Music URL: ${musicConfig.songPreviewUrl}`);
    console.log(`🎵 Music volume: ${musicConfig.volume}%`);
    console.log(`🎵 Music trimStart: ${musicConfig.trimStart}s`);
    console.log(`🎵 Music duration: ${musicConfig.songDuration}s`);

    this.musicConfig = musicConfig;

    // Use volume from JSON (0-100) normalized to 0.0-1.0
    this.baseVolume = Math.max(0, Math.min(1, musicConfig.volume / 100));
    // Better ducking volume calculation - 50% of base volume with a minimum of 0.1
    this.duckingVolume =
      musicConfig.duckingVolume || Math.max(0.1, this.baseVolume * 0.5);
    this.currentTargetVolume = this.baseVolume;

    // Create music state
    this.musicState = {
      isLoaded: false,
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      volume: this.baseVolume,
      isDucking: false,
      soundName: `bg_music_${Date.now()}`,
      soundInstance: undefined,
    };

    try {
      // Load music using Web Audio API
      this.audioBuffer = await webAudioManager.loadAudioBuffer(
        musicConfig.songPreviewUrl,
      );

      // Update state after loading
      this.musicState.isLoaded = true;
      this.musicState.duration = this.audioBuffer.duration * 1000; // Convert to ms

      console.log(
        `✅ Background music loaded: ${musicConfig.songTitle} (${this.musicState.duration}ms, Web Audio API)`,
      );
    } catch (error) {
      console.error(
        `Failed to load background music: ${musicConfig.songTitle}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Start music playback with fade in using Web Audio API
   */
  async startPlayback(startTime: number = 0): Promise<void> {
    if (!this.musicState || !this.musicState.isLoaded || !this.audioBuffer) {
      console.warn("🎵 Cannot start music: not loaded");
      console.warn("🎵 Music state:", this.musicState);
      return;
    }

    console.log(`🎵 Starting background music at ${startTime}ms`);
    console.log(`🎵 Music config:`, this.musicConfig);
    console.log(`🎵 Music state:`, this.musicState);

    try {
      // Resume audio context if suspended
      await webAudioManager.resumeContext();

      // Stop any existing playback
      if (this.audioSource) {
        this.stopPlayback();
      }

      // Calculate start time including trimStart offset
      const musicDuration = this.musicState.duration / 1000; // Convert to seconds
      const trimStartSeconds = this.musicConfig?.trimStart || 0;
      let playStartTime = Math.max(0, startTime / 1000) + trimStartSeconds;

      // Handle looping for shorter music (accounting for trim)
      const effectiveMusicDuration = musicDuration - trimStartSeconds;
      if (
        effectiveMusicDuration > 0 &&
        playStartTime - trimStartSeconds > effectiveMusicDuration
      ) {
        // Loop within the trimmed portion
        playStartTime =
          trimStartSeconds +
          ((playStartTime - trimStartSeconds) % effectiveMusicDuration);
      }

      console.log(
        `🎵 Music playback: startTime=${startTime}ms, trimStart=${trimStartSeconds}s, finalPlayTime=${playStartTime.toFixed(2)}s`,
      );

      // Create and start audio source
      this.audioSource = webAudioManager.createAudioSource(
        this.audioBuffer,
        playStartTime,
        0, // Start muted for fade in
        this.musicConfig?.loop !== false, // Default to loop
      );

      if (this.audioSource) {
        this.musicState.isPlaying = true;
        this.musicState.isPaused = false;
        this.isActuallyPlaying = true;
        this.startTimeOffset = webAudioManager.getCurrentTime() - playStartTime;
        this.pausedAt = 0;

        // Handle source end (for non-looping music)
        this.audioSource.onended = () => {
          if (!this.musicConfig?.loop) {
            this.musicState!.isPlaying = false;
            this.isActuallyPlaying = false;
            this.audioSource = null;
            console.log("🎵 Background music ended");
          }
        };

        // Fade in music
        this.fadeToVolume(this.currentTargetVolume, this.getFadeInDuration());

        console.log(
          `🎵 Background music started successfully with Web Audio API`,
        );
        console.log(`🎵 Target volume:`, this.currentTargetVolume);
      } else {
        console.error("🎵 Failed to create audio source for background music");
      }
    } catch (error) {
      console.error("Failed to start background music:", error);
    }
  }

  /**
   * Pause music playback
   */
  pausePlayback(): void {
    if (
      !this.musicState ||
      !this.musicState.isPlaying ||
      !this.audioSource ||
      !this.isActuallyPlaying
    ) {
      return;
    }

    console.log("🎵 Pausing background music");

    // Calculate where we paused (subtract trimStart to get timeline position)
    const currentTime = webAudioManager.getCurrentTime();
    const audioFilePosition = currentTime - this.startTimeOffset;
    const trimStartSeconds = this.musicConfig?.trimStart || 0;
    this.pausedAt = Math.max(0, audioFilePosition - trimStartSeconds);

    console.log(
      `🎵 Paused at audioPosition=${audioFilePosition.toFixed(2)}s, trimStart=${trimStartSeconds}s, timelinePosition=${this.pausedAt.toFixed(2)}s`,
    );

    // Stop the current source
    webAudioManager.stopAudioSource(this.audioSource);
    this.audioSource = null;
    this.musicState.isPlaying = false;
    this.musicState.isPaused = true;
    this.isActuallyPlaying = false;
  }

  /**
   * Stop music playback with fade out
   */
  async stopPlayback(): Promise<void> {
    if (!this.musicState || !this.audioSource) {
      return;
    }

    console.log("🎵 Stopping background music");

    // Fade out then stop
    if (this.isActuallyPlaying) {
      this.fadeToVolume(0, this.getFadeOutDuration());
      // Wait for fade to complete before stopping
      await new Promise((resolve) =>
        setTimeout(resolve, this.getFadeOutDuration()),
      );
    }

    if (this.audioSource) {
      webAudioManager.stopAudioSource(this.audioSource);
      this.audioSource = null;
    }

    this.musicState.isPlaying = false;
    this.musicState.isPaused = false;
    this.isActuallyPlaying = false;
    this.pausedAt = 0;
  }

  /**
   * Duck music volume when voice over is playing
   */
  duckVolume(isDucking: boolean): void {
    if (!this.musicState || !this.musicState.isPlaying || !this.audioSource) {
      return;
    }

    const targetVolume = isDucking ? this.duckingVolume : this.baseVolume;
    this.currentTargetVolume = targetVolume;
    this.musicState.isDucking = isDucking;

    // Use different fade durations for ducking vs unducking
    const fadeDuration = isDucking
      ? this.duckingFadeInDuration / 1000 // 1.5s to duck down (when voice starts)
      : this.duckingFadeOutDuration / 1000; // 2s to come back up (when voice ends)

    this.fadeToVolume(targetVolume, fadeDuration);

    console.log(
      `🎵 Music volume ${isDucking ? "ducking" : "restoring"} to ${Math.round(targetVolume * 100)}% over ${fadeDuration}s`,
    );
  }

  /**
   * Seek music to specific time position
   */
  async seekToTime(timeMs: number): Promise<void> {
    if (!this.musicState || !this.musicState.isLoaded || !this.audioBuffer) {
      return;
    }

    const timeSeconds = Math.max(0, timeMs / 1000);
    const musicDuration = this.musicState.duration / 1000;
    const trimStartSeconds = this.musicConfig?.trimStart || 0;

    // Handle looping for music shorter than video (accounting for trim)
    let seekTime = timeSeconds + trimStartSeconds;
    const effectiveMusicDuration = musicDuration - trimStartSeconds;
    if (this.musicConfig?.loop !== false && effectiveMusicDuration > 0) {
      if (timeSeconds > effectiveMusicDuration) {
        // Loop within the trimmed portion
        seekTime = trimStartSeconds + (timeSeconds % effectiveMusicDuration);
      }
    }

    if (seekTime <= musicDuration) {
      const wasPlaying = this.musicState.isPlaying;
      const currentVolume = this.getCurrentVolume();

      // Stop current source
      if (this.audioSource) {
        webAudioManager.stopAudioSource(this.audioSource);
        this.audioSource = null;
      }

      this.musicState.isPlaying = false;
      this.isActuallyPlaying = false;

      // Start new source from the desired position if was playing
      if (wasPlaying) {
        await webAudioManager.resumeContext();

        this.audioSource = webAudioManager.createAudioSource(
          this.audioBuffer,
          seekTime,
          currentVolume,
          this.musicConfig?.loop !== false,
        );

        if (this.audioSource) {
          this.musicState.isPlaying = true;
          this.isActuallyPlaying = true;
          this.startTimeOffset = webAudioManager.getCurrentTime() - seekTime;
          this.pausedAt = 0;

          // Handle source end
          this.audioSource.onended = () => {
            if (!this.musicConfig?.loop) {
              this.musicState!.isPlaying = false;
              this.isActuallyPlaying = false;
              this.audioSource = null;
            }
          };
        }
      }

      this.musicState.currentTime = timeMs;
    } else {
      console.warn(
        `⚠️ Cannot seek music to ${timeMs}ms, duration is ${this.musicState.duration}ms`,
      );
    }
  }

  /**
   * Sync music with timeline
   */
  syncWithTimeline(expectedTimeMs: number): void {
    if (
      !this.musicState ||
      !this.musicState.isPlaying ||
      !this.audioSource ||
      !this.isActuallyPlaying
    ) {
      return;
    }

    // Calculate actual playback time
    const currentTime = webAudioManager.getCurrentTime();
    const actualTimeMs = (currentTime - this.startTimeOffset) * 1000;
    const musicDuration = this.musicState.duration;

    // For looping music, calculate expected position within loop
    let expectedLoopTime = expectedTimeMs;
    if (this.musicConfig?.loop !== false && musicDuration > 0) {
      expectedLoopTime = expectedTimeMs % musicDuration;
    }

    const drift = Math.abs(expectedLoopTime - actualTimeMs);
    const syncThreshold = 2000; // 2 second tolerance for background music

    // If drift is significant, correct it
    if (drift > syncThreshold) {
      console.log(`🔧 Music sync correction: drift ${Math.round(drift)}ms`);
      this.seekToTime(expectedTimeMs).catch(console.error);
    }

    // Update internal state
    this.musicState.currentTime = actualTimeMs;
  }

  /**
   * Resume playback after pause
   */
  async resumePlayback(): Promise<void> {
    if (!this.musicState || this.isActuallyPlaying || this.pausedAt === 0) {
      return;
    }

    console.log("🎵 Resuming background music");

    await this.startPlayback(this.pausedAt * 1000);
  }

  /**
   * Fade to target volume
   */
  private fadeToVolume(targetVolume: number, duration: number): void {
    if (!this.audioSource) return;

    webAudioManager.fadeSourceVolume(this.audioSource, targetVolume, duration);
  }

  /**
   * Get current volume
   */
  private getCurrentVolume(): number {
    return this.currentTargetVolume;
  }

  /**
   * Get fade in duration from config or default
   */
  private getFadeInDuration(): number {
    return (
      (this.musicConfig?.fadeInDuration || this.defaultFadeInDuration) / 1000
    ); // Convert to seconds
  }

  /**
   * Get fade out duration from config or default
   */
  private getFadeOutDuration(): number {
    return (
      (this.musicConfig?.fadeOutDuration || this.defaultFadeOutDuration) / 1000
    ); // Convert to seconds
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
    console.log("🗑️ WebAudioMusicManager cleanup");

    if (this.audioSource) {
      webAudioManager.stopAudioSource(this.audioSource);
      this.audioSource = null;
    }

    this.musicState = null;
    this.musicConfig = null;
    this.audioBuffer = null;
    this.isActuallyPlaying = false;
  }
}
