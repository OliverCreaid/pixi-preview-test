import { SceneManager } from "./core/SceneManager";
import { ProjectParser } from "./core/ProjectParser";
import { Timeline } from "./components/Timeline";
import { ProjectPreloader } from "./core/ProjectPreloader";
import { LoadingProgress } from "./components/LoadingProgress";
import { WebAudioMusicManager } from "./core/WebAudioMusicManager";
import { fontManager } from "./core/FontManager";
import {
  ProjectData,
  SceneInfo,
  TimelineState,
  TransitionConfig,
} from "./types";

/**
 * Main application class for the Real Estate Video Preview
 * Orchestrates all components and manages playback state
 */
class VideoPreviewApp {
  private sceneManager: SceneManager;
  private timeline: Timeline;
  private preloader: ProjectPreloader;
  private loadingProgress: LoadingProgress;
  private musicManager: WebAudioMusicManager;

  // Transition configuration
  private transitionConfig: TransitionConfig = {
    enabled: true,
    type: "crossfade",
    duration: 500, // 500ms fade transitions
    easing: "ease-out",
  };

  private scenes: SceneInfo[] = [];
  private totalDuration: number = 0;
  private timelineState: TimelineState = {
    currentTime: 0,
    totalDuration: 0,
    currentSceneIndex: 0,
    isPlaying: false,
  };

  private animationId?: number;
  private lastFrameTime: number = 0;
  private preloadedSprites: Map<string, import("pixi.js").Sprite> = new Map();
  private preloadedAudio: Map<string, HTMLAudioElement> = new Map();

  // Scrubbing state for audio pause/resume
  private isScrubbing: boolean = false;
  private wasPlayingBeforeScrub: boolean = false;

  // SDK/iframe integration state
  private isInIframe: boolean = false;

  constructor() {
    const timelineContainer = document.getElementById("timeline-container")!;
    const appContainer = document.getElementById("app")!;

    // Check if we're running inside an iframe
    this.isInIframe = window.self !== window.top;

    // Initialize core components with transition support
    this.sceneManager = new SceneManager(this.transitionConfig);
    this.timeline = new Timeline(timelineContainer);

    // Initialize preloading system
    this.preloader = new ProjectPreloader();
    this.loadingProgress = new LoadingProgress(appContainer);

    // Initialize music manager
    this.musicManager = new WebAudioMusicManager();

    this.setupEventListeners();
    this.setupPreloaderCallbacks();

    // Setup iframe communication if needed
    if (this.isInIframe) {
      this.setupIframeMessaging();
    }
  }

  async initialize(): Promise<void> {
    //console.log(window.location);

    // Initialize PixiJS scene
    await this.sceneManager.initialize();

    if (this.isInIframe) {
      // When in iframe, wait for project data via postMessage
      this.loadingProgress.setStatus("Waiting for project data...");
      //console.log("🖼️ Running in iframe mode - waiting for project data");

      // Notify parent that we're ready to receive data
      this.postMessageToParent("READY");
    } else {
      // Standalone mode - load test project data
      await this.loadAndPreloadTestProject();
    }

    //console.log("Video Preview App initialized");
  }

  /**
   * Load and preload the test project
   */
  private async loadAndPreloadTestProject(): Promise<void> {
    try {
      // Show loading screen
      this.loadingProgress.setStatus("Loading project data...");

      const response = await fetch("/test-project.json");
      const projectData: ProjectData = await response.json();

      // Parse project data
      const { scenes, totalDuration } = ProjectParser.parseProject(projectData);
      this.scenes = scenes;
      this.totalDuration = totalDuration;
      this.timelineState.totalDuration = totalDuration;

      //console.log(
      //   `Loaded project with ${scenes.length} scenes, duration: ${totalDuration}ms`
      // );

      // Load fonts if available in project data
      if (projectData.style?.fonts) {
        this.loadingProgress.setStatus("Loading fonts...");
        await fontManager.loadProjectFonts(projectData.style.fonts);

        // Set project fonts on scene manager
        this.sceneManager.setProjectFonts(projectData.style.fonts);
      }

      // Start preloading all assets
      this.loadingProgress.setStatus("Preloading assets...");
      const { sprites, audio } =
        await this.preloader.preloadAllAssets(projectData);

      // Store preloaded assets for distribution to scene renderers
      this.preloadedSprites = sprites;
      this.preloadedAudio = audio;
      //console.log(
      //   `📦 Preloaded ${sprites.size} sprites and ${audio.size} audio files`
      // );

      // Load background music if available
      if (projectData.audio?.music) {
        this.loadingProgress.setStatus("Loading background music...");
        await this.musicManager.loadMusic(
          projectData.audio.music,
          totalDuration,
        );
        //console.log(
        //   `🎵 Background music loaded: ${projectData.audio.music.songTitle}`
        // );
      }

      // Hide loading screen
      this.loadingProgress.showSuccess();
      await this.delay(1000); // Show success state briefly
      await this.loadingProgress.hide();

      // Now setup the UI
      await this.setupUIAfterPreload();
    } catch (error) {
      console.error("Failed to load test project:", error);
      this.loadingProgress.showError("Failed to load project");
    }
  }

  /**
   * Setup UI after successful preloading
   */
  private async setupUIAfterPreload(): Promise<void> {
    // Restore the main UI structure (loading screen replaced the innerHTML)
    const appContainer = document.getElementById("app")!;
    appContainer.innerHTML = `
      <div id="pixi-container"></div>
      <div id="timeline-container"></div>
    `;

    // Recreate timeline component with new container
    const timelineContainer = document.getElementById("timeline-container")!;
    this.timeline = new Timeline(timelineContainer);
    this.setupTimelineEventListeners();

    // Append canvas to container
    const pixiContainer = document.getElementById("pixi-container")!;
    pixiContainer.appendChild(this.sceneManager.getCanvas());

    // Initial resize to fit the container properly
    this.handleResize();

    // Setup timeline
    this.timeline.setTotalDuration(this.totalDuration);
    this.timeline.setEnabled(true);

    // Display first scene (now instant!)
    if (this.scenes.length > 0) {
      await this.displayScene(0);
    }
  }

  /**
   * Setup preloader progress callbacks
   */
  private setupPreloaderCallbacks(): void {
    this.preloader.onProgress((progress, loaded, total) => {
      this.loadingProgress.updateProgress(progress, loaded, total);
    });

    this.preloader.onComplete(() => {
      //console.log("🎉 All assets preloaded successfully!");
    });
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Display a specific scene with transition support
   */
  private async displayScene(
    sceneIndex: number,
    forceInstant: boolean = false,
  ): Promise<void> {
    if (sceneIndex < 0 || sceneIndex >= this.scenes.length) {
      return;
    }

    const scene = this.scenes[sceneIndex];
    const previousSceneIndex = this.timelineState.currentSceneIndex;
    this.timelineState.currentSceneIndex = sceneIndex;

    // Get or create scene container with voice element if available
    const sceneContainer = this.sceneManager.getSceneContainer(
      sceneIndex,
      scene.voiceElement,
    );

    // Set up preloaded sprites for this scene's media renderer
    sceneContainer.mediaRenderer.setPreloadedSprites(this.preloadedSprites);

    // Calculate scene relative time
    const sceneRelativeTime = this.timelineState.currentTime - scene.startTime;

    // Clear and populate scene content
    this.sceneManager.clearSceneContent(sceneIndex);

    // Display media assets with scene relative time
    if (scene.mediaAssets.length > 0) {
      //console.log(
      //   `🎬 Loading ${scene.mediaAssets.length} media assets for scene ${sceneIndex}, sceneRelativeTime: ${sceneRelativeTime}ms`
      // );
      //console.log(
      //   `📦 Preloaded sprites available:`,
      //   this.preloadedSprites.size
      // );

      await sceneContainer.mediaRenderer.displayMedia(
        scene.mediaAssets,
        sceneRelativeTime,
      );

      // Debug: Check if container has children after loading
      //const mediaLayerChildren =
      //  sceneContainer.container.children[0]?.children?.length || 0;
      //console.log(`📊 Media layer children count: ${mediaLayerChildren}`);
    } else {
      //console.log(`⚠️  No media assets for scene ${sceneIndex}`);
    }

    // Display text overlays
    if (scene.textElements.length > 0) {
      sceneContainer.textRenderer.displayTexts(scene.textElements);
    }

    // Load and prepare audio if scene has voice element
    if (scene.voiceElement && sceneContainer.audioRenderer) {
      //console.log(
      //   `🎵 Loading audio for scene ${sceneIndex}: ${scene.voiceElement.value}`
      // );
      await sceneContainer.audioRenderer.loadVoiceElement(scene.voiceElement);

      // If timeline is playing, start audio at the correct time
      if (this.timelineState.isPlaying) {
        await sceneContainer.audioRenderer.startPlayback(
          Math.max(0, sceneRelativeTime),
        );
      }
    }

    // Switch to this scene with transition (unless it's the first scene or forced instant)
    const isFirstScene =
      previousSceneIndex === -1 || previousSceneIndex === sceneIndex;
    this.sceneManager.switchToScene(
      sceneIndex,
      isFirstScene ? undefined : previousSceneIndex,
      forceInstant || isFirstScene,
    );

    //console.log(
    //   `🎬 Displayed scene ${sceneIndex}: ${scene.textElements.map((t) => t.value).join(", ")} (${scene.mediaAssets.length} media items)`
    // );
  }

  /**
   * Setup event listeners for timeline and other controls
   */
  private setupEventListeners(): void {
    this.setupTimelineEventListeners();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.handleResize();
    });
  }

  /**
   * Setup timeline-specific event listeners (can be called multiple times)
   */
  private setupTimelineEventListeners(): void {
    // Timeline play/pause callback
    this.timeline.onPlayPauseCallback((isPlaying: boolean) => {
      this.timelineState.isPlaying = isPlaying;

      if (isPlaying) {
        this.startPlayback();
      } else {
        this.pausePlayback();
      }
    });

    // Timeline seek callback
    this.timeline.onSeekCallback((time: number) => {
      this.seekToTime(time);
    });

    // Timeline scrubbing callback - pause audio during scrubbing
    this.timeline.onScrubbingCallback((isScrubbing: boolean) => {
      this.handleScrubbing(isScrubbing);
    });
  }

  /**
   * Start playback animation loop
   */
  private startPlayback(): void {
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(() => this.playbackLoop());

    // Start audio playback for current scene
    this.startCurrentSceneAudio();

    // Start background music
    this.startBackgroundMusic();
  }

  /**
   * Pause playback
   */
  private pausePlayback(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }

    // Pause all audio
    this.pauseAllAudio();

    // Pause background music
    this.pauseBackgroundMusic();
  }

  /**
   * Main playback animation loop with transition support
   */
  private playbackLoop(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Always update transitions (even when paused, for smooth scrubbing)
    this.sceneManager.updateTransitions();

    if (this.timelineState.isPlaying) {
      // Update timeline position
      this.timelineState.currentTime += deltaTime;

      // Check if we've reached the end
      if (this.timelineState.currentTime >= this.totalDuration) {
        this.timelineState.currentTime = this.totalDuration;
        this.timelineState.isPlaying = false;
        this.timeline.setPlayState(false);
        this.pausePlayback();
        return;
      }

      // Update timeline display
      this.timeline.setCurrentTime(this.timelineState.currentTime);

      // Check if we need to switch scenes
      this.updateCurrentScene();

      // Continue animation loop
      this.animationId = requestAnimationFrame(() => this.playbackLoop());
    } else {
      // Even when paused, we need to keep updating transitions for scrubbing
      if (this.sceneManager.isTransitioning()) {
        this.animationId = requestAnimationFrame(() => this.playbackLoop());
      }
    }
  }

  /**
   * Update current scene based on timeline position
   */
  private updateCurrentScene(): void {
    const currentScene = ProjectParser.getSceneAtTime(
      this.scenes,
      this.timelineState.currentTime,
    );

    if (currentScene) {
      // Calculate time relative to the current scene start
      const sceneRelativeTime =
        this.timelineState.currentTime - currentScene.startTime;

      // If scene has changed, display the new scene
      if (currentScene.index !== this.timelineState.currentSceneIndex) {
        this.displayScene(currentScene.index);
      } else {
        // Scene hasn't changed, but we need to update media within the scene
        this.updateSceneMedia(currentScene, sceneRelativeTime);
      }
    }
  }

  /**
   * Update media display within the current scene based on scene relative time
   */
  private async updateSceneMedia(
    scene: SceneInfo,
    sceneRelativeTime: number,
  ): Promise<void> {
    // Get the scene container for the current scene
    const sceneContainer = this.sceneManager.getSceneContainer(scene.index);

    // Update media based on scene relative time
    if (scene.mediaAssets.length > 0 && sceneContainer) {
      await sceneContainer.mediaRenderer.displayMedia(
        scene.mediaAssets,
        sceneRelativeTime,
      );

      // Update Ken Burns effect based on individual asset timing
      this.updateKenBurnsForCurrentAsset(
        scene,
        sceneRelativeTime,
        sceneContainer.mediaRenderer,
      );
    }

    // Skip audio operations during scrubbing
    if (!this.isScrubbing) {
      // Sync audio with timeline
      if (sceneContainer.audioRenderer && this.timelineState.isPlaying) {
        sceneContainer.audioRenderer.syncWithTimeline(sceneRelativeTime);
      }

      // Handle background music volume ducking and sync
      this.updateBackgroundMusic(scene);
    }
  }

  /**
   * Update Ken Burns effect for the currently active asset
   */
  private updateKenBurnsForCurrentAsset(
    scene: SceneInfo,
    sceneRelativeTime: number,
    mediaRenderer: import("./core/MediaRenderer").MediaRenderer,
  ): void {
    // Find the currently active asset
    for (const asset of scene.mediaAssets) {
      if (
        sceneRelativeTime >= asset.startTime &&
        sceneRelativeTime < asset.endTime
      ) {
        // Calculate time relative to this asset's start
        const assetRelativeTime = sceneRelativeTime - asset.startTime;
        mediaRenderer.updateKenBurns(assetRelativeTime);
        break;
      }
    }
  }

  /**
   * Seek to specific time position with transition handling
   */
  private seekToTime(time: number): void {
    this.timelineState.currentTime = time;
    this.timeline.setCurrentTime(time);

    // Force complete any ongoing transitions when scrubbing
    if (this.sceneManager.isTransitioning()) {
      this.sceneManager.getTransitionManager().forceCompleteTransition();
    }

    // Pause ALL audio during timeline interaction - cleaner UX
    this.pauseAllAudio();
    this.pauseBackgroundMusic();

    // Update scene if necessary (force instant for scrubbing)
    const currentScene = ProjectParser.getSceneAtTime(this.scenes, time);
    if (
      currentScene &&
      currentScene.index !== this.timelineState.currentSceneIndex
    ) {
      this.displayScene(currentScene.index, true); // Force instant during scrubbing
    } else {
      this.updateCurrentScene();
    }
  }

  /**
   * Start audio playback for current scene
   */
  private startCurrentSceneAudio(): void {
    const currentScene = ProjectParser.getSceneAtTime(
      this.scenes,
      this.timelineState.currentTime,
    );

    if (currentScene) {
      const sceneContainer = this.sceneManager.getSceneContainer(
        currentScene.index,
        currentScene.voiceElement,
      );

      if (
        sceneContainer.audioRenderer &&
        sceneContainer.audioRenderer.isReady()
      ) {
        const sceneRelativeTime =
          this.timelineState.currentTime - currentScene.startTime;
        sceneContainer.audioRenderer.startPlayback(
          Math.max(0, sceneRelativeTime),
        );
      }
    }
  }

  /**
   * Pause all audio across all scenes
   */
  private pauseAllAudio(): void {
    // Pause current scene audio
    const activeSceneContainer = this.sceneManager.getActiveSceneContainer();
    if (activeSceneContainer?.audioRenderer) {
      activeSceneContainer.audioRenderer.pausePlayback();
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    const container = document.getElementById("pixi-container")!;
    const rect = container.getBoundingClientRect();
    this.sceneManager.resize(rect.width, rect.height);
  }

  /**
   * Start background music playback
   */
  private startBackgroundMusic(): void {
    if (this.musicManager.isReady()) {
      this.musicManager.startPlayback(this.timelineState.currentTime);
    }
  }

  /**
   * Pause background music
   */
  private pauseBackgroundMusic(): void {
    //console.log("Pause BG Music", this.musicManager.isPlaying());
    if (this.musicManager.isPlaying()) {
      this.musicManager.pausePlayback();
    }
  }

  /**
   * Update background music (sync and volume ducking)
   */
  private updateBackgroundMusic(scene: SceneInfo): void {
    if (!this.musicManager.isReady() || !this.timelineState.isPlaying) {
      return;
    }

    // Sync music with timeline
    this.musicManager.syncWithTimeline(this.timelineState.currentTime);

    // Duck volume if scene has voice over that's currently playing
    const hasActiveVoice =
      scene.voiceElement &&
      this.sceneManager
        .getSceneContainer(scene.index)
        .audioRenderer?.isPlaying();

    this.musicManager.duckVolume(!!hasActiveVoice);
  }

  /**
   * Handle timeline scrubbing - pause audio during scrubbing for better UX
   */
  private handleScrubbing(isScrubbing: boolean): void {
    if (isScrubbing) {
      // Starting to scrub - pause all audio
      this.isScrubbing = true;
      this.wasPlayingBeforeScrub = this.timelineState.isPlaying;

      //console.log("🎵 Pausing audio for timeline scrubbing");

      // Pause all audio
      this.pauseAllAudio();
      this.pauseBackgroundMusic();
    } else {
      // Finished scrubbing - resume audio if it was playing before
      this.isScrubbing = false;

      if (this.wasPlayingBeforeScrub && this.timelineState.isPlaying) {
        //console.log("🎵 Resuming audio after timeline scrubbing");

        // Resume audio for current scene and background music
        this.startCurrentSceneAudio();
        this.startBackgroundMusic();
      }

      this.wasPlayingBeforeScrub = false;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.pausePlayback();
    this.sceneManager.destroy();
    this.timeline.destroy();
    this.musicManager.destroy();
    this.preloader = null!;
    this.preloadedSprites.clear();
    this.preloadedAudio.clear();
  }

  /**
   * Setup iframe messaging system
   */
  private setupIframeMessaging(): void {
    //console.log("🔗 Setting up iframe messaging");

    window.addEventListener("message", (event) => {
      // Basic security check - in production you'd want to check event.origin
      const { type, payload } = event.data;

      switch (type) {
        case "LOAD_PROJECT":
          this.handleLoadProjectMessage(payload);
          break;

        default:
          console.warn("Unknown message type:", type);
      }
    });
  }

  /**
   * Handle LOAD_PROJECT message from parent
   */
  private async handleLoadProjectMessage(
    projectData: ProjectData,
  ): Promise<void> {
    try {
      //console.log("📥 Received project data from parent");

      // Process the project data (same logic as loadAndPreloadTestProject)
      await this.loadAndPreloadProjectData(projectData);
    } catch (error) {
      console.error("Failed to load project from message:", error);
      this.postMessageToParent(
        "ERROR",
        `Failed to load project: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send message to parent window (when in iframe)
   */
  private postMessageToParent(type: string, payload?: unknown): void {
    if (this.isInIframe && window.parent) {
      window.parent.postMessage({ type, payload }, "*");
    }
  }

  /**
   * Load and preload project data (extracted from loadAndPreloadTestProject)
   */
  private async loadAndPreloadProjectData(
    projectData: ProjectData,
  ): Promise<void> {
    try {
      // Show loading screen
      this.loadingProgress.setStatus("Loading project data...");

      // Parse project data
      const { scenes, totalDuration } = ProjectParser.parseProject(projectData);
      this.scenes = scenes;
      this.totalDuration = totalDuration;
      this.timelineState.totalDuration = totalDuration;

      //console.log(
      //   `Loaded project with ${scenes.length} scenes, duration: ${totalDuration}ms`
      // );

      // Load fonts if available in project data
      if (projectData.style?.fonts) {
        this.loadingProgress.setStatus("Loading fonts...");
        await fontManager.loadProjectFonts(projectData.style.fonts);

        // Set project fonts on scene manager
        this.sceneManager.setProjectFonts(projectData.style.fonts);
      }

      // Start preloading all assets
      this.loadingProgress.setStatus("Preloading assets...");
      const { sprites, audio } =
        await this.preloader.preloadAllAssets(projectData);

      // Store preloaded assets for distribution to scene renderers
      this.preloadedSprites = sprites;
      this.preloadedAudio = audio;
      //console.log(
      //   `📦 Preloaded ${sprites.size} sprites and ${audio.size} audio files`
      // );

      // Load background music if available
      if (projectData.audio?.music) {
        this.loadingProgress.setStatus("Loading background music...");
        await this.musicManager.loadMusic(
          projectData.audio.music,
          totalDuration,
        );
        //console.log(
        //   `🎵 Background music loaded: ${projectData.audio.music.songTitle}`
        // );
      }

      // Hide loading screen
      this.loadingProgress.showSuccess();
      await this.delay(1000); // Show success state briefly
      await this.loadingProgress.hide();

      // Now setup the UI
      await this.setupUIAfterPreload();
    } catch (error) {
      console.error("Failed to load project:", error);
      this.loadingProgress.showError("Failed to load project");

      // Notify parent of error if in iframe
      if (this.isInIframe) {
        this.postMessageToParent(
          "ERROR",
          `Failed to load project: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}

// Initialize application when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const app = new VideoPreviewApp();
    await app.initialize();

    // Store app reference globally for debugging
    (
      window as unknown as { videoPreviewApp: VideoPreviewApp }
    ).videoPreviewApp = app;
  } catch (error) {
    console.error("Failed to initialize Video Preview App:", error);
  }
});
