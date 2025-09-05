import { SceneManager } from './core/SceneManager';
import { ProjectParser } from './core/ProjectParser';
import { Timeline } from './components/Timeline';
import { ProjectPreloader } from './core/ProjectPreloader';
import { LoadingProgress } from './components/LoadingProgress';
import { WebAudioMusicManager } from './core/WebAudioMusicManager';
import { fontManager } from './core/FontManager';
import { ProjectData, SceneInfo, TimelineState, TransitionConfig } from './types';

interface RenderStatus {
    started: boolean;
    progress: number;
    completed: boolean;
    fileReady: boolean;
}

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
        type: 'crossfade',
        duration: 500, // 500ms fade transitions
        easing: 'ease-out',
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
    private preloadedSprites: Map<string, import('pixi.js').Sprite> = new Map();
    private preloadedAudio: Map<string, HTMLAudioElement> = new Map();

    // Frame extraction mode support
    private isFastFrameMode: boolean = false;

    // Scrubbing state for audio pause/resume
    private isScrubbing: boolean = false;
    private wasPlayingBeforeScrub: boolean = false;

    // SDK/iframe integration state
    private isInIframe: boolean = false;

    // Render mode state
    private isRenderMode: boolean = false;
    private renderJobId: string | null = null;
    private isFrameExtractMode: boolean = false;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];

    constructor() {
        const timelineContainer = document.getElementById('timeline-container')!;
        const appContainer = document.getElementById('app')!;

        // Check if we're running inside an iframe
        this.isInIframe = window.self !== window.top;

        // Check if we're in render mode
        const urlParams = new URLSearchParams(window.location.search);
        this.isRenderMode = urlParams.has('render') && urlParams.get('render') === 'true';
        this.isFrameExtractMode = urlParams.has('frameExtract') && urlParams.get('frameExtract') === 'true';
        this.isFastFrameMode = urlParams.has('fastFrame') && urlParams.get('fastFrame') === 'true';
        this.renderJobId = urlParams.get('jobId');

        console.log('🎬 Render mode check:', {
            isRenderMode: this.isRenderMode,
            isFrameExtractMode: this.isFrameExtractMode,
            isFastFrameMode: this.isFastFrameMode,
            renderJobId: this.renderJobId,
            urlParams: urlParams.toString(),
        });

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

        // Setup render mode if needed
        if (this.isRenderMode) {
            this.setupRenderMode();
        }

        // Setup frame extract mode if needed
        if (this.isFrameExtractMode) {
            this.setupFrameExtractMode();
        }

        // Setup fast frame mode if needed
        if (this.isFastFrameMode) {
            this.setupFastFrameMode();
        }
    }

    async initialize(): Promise<void> {
        //console.log(window.location);

        // Initialize PixiJS scene
        await this.sceneManager.initialize();

        if (this.isInIframe) {
            // When in iframe, wait for project data via postMessage
            this.loadingProgress.setStatus('Waiting for project data...');
            //console.log("🖼️ Running in iframe mode - waiting for project data");

            // Notify parent that we're ready to receive data
            this.postMessageToParent('READY');
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
            this.loadingProgress.setStatus('Loading project data...');

            const response = await fetch('/test-project.json');
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
                this.loadingProgress.setStatus('Loading fonts...');
                await fontManager.loadProjectFonts(projectData.style.fonts);

                // Set project fonts on scene manager
                this.sceneManager.setProjectFonts(projectData.style.fonts);
            }

            // Start preloading all assets
            this.loadingProgress.setStatus('Preloading assets...');
            const { sprites, audio } = await this.preloader.preloadAllAssets(projectData);

            // Store preloaded assets for distribution to scene renderers
            this.preloadedSprites = sprites;
            this.preloadedAudio = audio;
            //console.log(
            //   `📦 Preloaded ${sprites.size} sprites and ${audio.size} audio files`
            // );

            // Load background music if available
            if (projectData.audio?.music) {
                this.loadingProgress.setStatus('Loading background music...');
                await this.musicManager.loadMusic(projectData.audio.music, totalDuration);
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
            console.error('Failed to load test project:', error);
            this.loadingProgress.showError('Failed to load project');
        }
    }

    /**
     * Setup UI after successful preloading
     */
    private async setupUIAfterPreload(): Promise<void> {
        // Restore the main UI structure (loading screen replaced the innerHTML)
        const appContainer = document.getElementById('app')!;
        appContainer.innerHTML = `
      <div id="pixi-container"></div>
      <div id="timeline-container"></div>
    `;

        // Recreate timeline component with new container
        const timelineContainer = document.getElementById('timeline-container')!;
        this.timeline = new Timeline(timelineContainer);
        this.setupTimelineEventListeners();

        // Append canvas to container
        const pixiContainer = document.getElementById('pixi-container')!;
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
    private async displayScene(sceneIndex: number, forceInstant: boolean = false): Promise<void> {
        if (sceneIndex < 0 || sceneIndex >= this.scenes.length) {
            return;
        }

        const scene = this.scenes[sceneIndex];
        const previousSceneIndex = this.timelineState.currentSceneIndex;
        this.timelineState.currentSceneIndex = sceneIndex;

        // Get or create scene container with voice element if available
        const sceneContainer = this.sceneManager.getSceneContainer(sceneIndex, scene.voiceElement);

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

            await sceneContainer.mediaRenderer.displayMedia(scene.mediaAssets, sceneRelativeTime);

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
                await sceneContainer.audioRenderer.startPlayback(Math.max(0, sceneRelativeTime));
            }
        }

        // Switch to this scene with transition (unless it's the first scene or forced instant)
        const isFirstScene = previousSceneIndex === -1 || previousSceneIndex === sceneIndex;
        this.sceneManager.switchToScene(sceneIndex, isFirstScene ? undefined : previousSceneIndex, forceInstant || isFirstScene);

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
        window.addEventListener('resize', () => {
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

        // Timeline render callback
        this.timeline.onRenderCallback(() => {
            this.handleRenderRequest();
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
        const currentScene = ProjectParser.getSceneAtTime(this.scenes, this.timelineState.currentTime);

        if (currentScene) {
            // Calculate time relative to the current scene start
            const sceneRelativeTime = this.timelineState.currentTime - currentScene.startTime;

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
    private async updateSceneMedia(scene: SceneInfo, sceneRelativeTime: number): Promise<void> {
        // Get the scene container for the current scene
        const sceneContainer = this.sceneManager.getSceneContainer(scene.index);

        // Update media based on scene relative time
        if (scene.mediaAssets.length > 0 && sceneContainer) {
            await sceneContainer.mediaRenderer.displayMedia(scene.mediaAssets, sceneRelativeTime);

            // Update Ken Burns effect based on individual asset timing
            this.updateKenBurnsForCurrentAsset(scene, sceneRelativeTime, sceneContainer.mediaRenderer);
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
    private updateKenBurnsForCurrentAsset(scene: SceneInfo, sceneRelativeTime: number, mediaRenderer: import('./core/MediaRenderer').MediaRenderer): void {
        // Find the currently active asset
        for (const asset of scene.mediaAssets) {
            if (sceneRelativeTime >= asset.startTime && sceneRelativeTime < asset.endTime) {
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
        if (currentScene && currentScene.index !== this.timelineState.currentSceneIndex) {
            this.displayScene(currentScene.index, true); // Force instant during scrubbing
        } else {
            this.updateCurrentScene();
        }
    }

    /**
     * Start audio playback for current scene
     */
    private startCurrentSceneAudio(): void {
        const currentScene = ProjectParser.getSceneAtTime(this.scenes, this.timelineState.currentTime);

        if (currentScene) {
            const sceneContainer = this.sceneManager.getSceneContainer(currentScene.index, currentScene.voiceElement);

            if (sceneContainer.audioRenderer && sceneContainer.audioRenderer.isReady()) {
                const sceneRelativeTime = this.timelineState.currentTime - currentScene.startTime;
                sceneContainer.audioRenderer.startPlayback(Math.max(0, sceneRelativeTime));
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
        const container = document.getElementById('pixi-container')!;
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
        const hasActiveVoice = scene.voiceElement && this.sceneManager.getSceneContainer(scene.index).audioRenderer?.isPlaying();

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
     * Setup frame extract mode functionality
     */
    private setupFrameExtractMode(): void {
        console.log('🖼️ Setting up frame extract mode for job:', this.renderJobId);

        // Expose app instance and methods for Puppeteer frame extraction
        (window as any).videoPreviewApp = this;
        (window as any).totalDuration = 0;
        (window as any).projectLoaded = false;

        // Listen for project data from Puppeteer
        window.addEventListener('message', (event) => {
            if (event.data.type === 'RENDER_PROJECT_DATA') {
                this.handleFrameExtractProjectData(event.data.projectData);
            }
        });
    }

    /**
     * Setup fast frame mode functionality (optimized frame extraction)
     */
    private setupFastFrameMode(): void {
        console.log('⚡ Setting up fast frame mode for job:', this.renderJobId);

        // Expose app instance and methods for optimized frame extraction
        (window as any).videoPreviewApp = this;
        (window as any).totalDuration = 0;
        (window as any).frameExtractionReady = false;

        // Listen for project data from Puppeteer
        window.addEventListener('message', (event) => {
            if (event.data.type === 'RENDER_PROJECT_DATA') {
                this.handleFastFrameProjectData(event.data.projectData);
            }
        });
    }

    /**
     * Handle project data for fast frame extraction
     */
    private async handleFastFrameProjectData(projectData: ProjectData): Promise<void> {
        try {
            console.log('📥 Received project data for fast frame extraction');

            // Load the project data (same as normal loading)
            await this.loadAndPreloadProjectData(projectData);

            // Set up for frame extraction
            (window as any).totalDuration = this.totalDuration;
            (window as any).frameExtractionReady = true;

            console.log('✅ Fast frame extraction ready, duration:', this.totalDuration);
        } catch (error) {
            console.error('❌ Error preparing fast frame extraction:', error);
            (window as any).frameExtractionReady = false;
        }
    }

    /**
     * Start optimized frame extraction using timeline playback
     */
    public startFrameExtraction(): void {
        console.log('⚡ Starting optimized frame extraction playback');

        // Reset to start
        this.timelineState.currentTime = 0;
        this.timelineState.isPlaying = true;

        // Start the render loop for frame extraction
        this.lastFrameTime = performance.now();
        this.animationId = requestAnimationFrame(() => this.playbackLoop());
    }

    /**
     * Stop frame extraction
     */
    public stopFrameExtraction(): void {
        console.log('⚡ Stopping frame extraction');
        this.timelineState.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }

    /**
     * Handle project data for frame extraction
     */
    private async handleFrameExtractProjectData(projectData: ProjectData): Promise<void> {
        try {
            console.log('📥 Received project data for frame extraction');

            // Load the project data (same as normal loading)
            await this.loadAndPreloadProjectData(projectData);

            // Set global variables for Puppeteer
            (window as any).totalDuration = this.totalDuration;
            (window as any).projectLoaded = true;

            console.log('✅ Project loaded for frame extraction, duration:', this.totalDuration);
        } catch (error) {
            console.error('Failed to load project for frame extraction:', error);
            (window as any).projectLoaded = false;
        }
    }

    /**
     * Public method for Puppeteer to seek to specific time
     */
    public seekToTime(time: number): void {
        this.timelineState.currentTime = time;

        // Force complete any ongoing transitions
        if (this.sceneManager.isTransitioning()) {
            this.sceneManager.getTransitionManager().forceCompleteTransition();
        }

        // Update scene without transitions (instant)
        const currentScene = ProjectParser.getSceneAtTime(this.scenes, time);
        if (currentScene && currentScene.index !== this.timelineState.currentSceneIndex) {
            this.displayScene(currentScene.index, true); // Force instant
        } else if (currentScene) {
            this.updateCurrentScene();
        }
    }

    /**
     * Setup render mode functionality
     */
    private setupRenderMode(): void {
        console.log('🎬 Setting up render mode for job:', this.renderJobId);
        console.log('🎬 URL params:', window.location.search);

        // Add global render status for server communication
        (window as unknown as { renderStatus: RenderStatus }).renderStatus = {
            started: false,
            progress: 0,
            completed: false,
            fileReady: false,
        };

        // Listen for project data from server
        window.addEventListener('message', (event) => {
            if (event.data.type === 'RENDER_PROJECT_DATA') {
                this.handleRenderProjectData(event.data.projectData);
            }
        });
    }

    /**
     * Create a render-compatible version of the project data
     */
    private createRenderCompatibleProject(projectData: ProjectData): ProjectData {
        const renderProject = JSON.parse(JSON.stringify(projectData)); // Deep clone

        // Remove external audio that might fail to load in headless mode
        if (renderProject.audio?.music) {
            console.log('🎵 Removing external music for headless rendering');
            delete renderProject.audio.music;
        }

        // Remove voice-over elements that might fail
        if (renderProject.scenes) {
            renderProject.scenes.forEach((scene: any) => {
                if (scene.elements) {
                    scene.elements = scene.elements.filter((element: any) => {
                        if (element.type === 'audio' && element.value?.includes('blob.core.windows.net')) {
                            console.log('🎵 Removing external audio element for headless rendering');
                            return false;
                        }
                        return true;
                    });
                }
            });
        }

        return renderProject;
    }

    /**
     * Handle project data for rendering
     */
    private async handleRenderProjectData(projectData: ProjectData): Promise<void> {
        try {
            console.log('📥 Received project data for rendering');
            console.log('📥 Project data keys:', Object.keys(projectData));

            // For render mode, create a simplified project that will work in headless mode
            const renderProjectData = this.createRenderCompatibleProject(projectData);

            // Load and setup project
            await this.loadAndPreloadProjectData(renderProjectData);

            // Start recording after everything is loaded
            await this.startVideoRecording();
        } catch (error) {
            console.error('Failed to setup project for rendering:', error);

            // Still mark as started so the server doesn't wait forever
            (window as unknown as { renderStatus: RenderStatus }).renderStatus.started = true;

            window.postMessage(
                {
                    type: 'RENDER_ERROR',
                    error: error instanceof Error ? error.message : String(error),
                },
                '*'
            );
        }
    }

    /**
     * Start video recording using MediaRecorder
     */
    private async startVideoRecording(): Promise<void> {
        try {
            console.log('🎥 Starting video recording...');

            // Mark as started first so server doesn't timeout
            (window as unknown as { renderStatus: RenderStatus }).renderStatus.started = true;

            const canvas = this.sceneManager.getCanvas();
            console.log('🎥 Canvas info:', {
                width: canvas.width,
                height: canvas.height,
                hasContent: canvas.getContext('2d') ? true : false,
            });
            const canvasStream = canvas.captureStream(30); // 30fps

            // Get audio stream from Web Audio API - make optional
            let audioStream: MediaStream | null = null;
            try {
                if (this.musicManager.isReady()) {
                    audioStream = this.musicManager.getAudioStream();
                }
            } catch (audioError) {
                console.warn('Could not get audio stream, continuing with video only:', audioError);
            }

            // Combine video and audio streams
            const combinedStream = new MediaStream();
            canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

            if (audioStream) {
                audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
            }

            // Setup MediaRecorder - try without audio first for debugging
            const options = { mimeType: 'video/webm;codecs=vp8' };
            this.mediaRecorder = new MediaRecorder(canvasStream, options);

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingComplete();
            };

            // Start recording
            this.mediaRecorder.start();

            console.log('🎬 Recording started');

            // Start playback from beginning
            this.seekToTime(0);
            this.timelineState.isPlaying = true;
            this.timeline.setPlayState(true);
            this.startPlayback();

            // Monitor playback completion
            this.monitorRecordingProgress();
        } catch (error) {
            console.error('Failed to start video recording:', error);
            window.postMessage(
                {
                    type: 'RENDER_ERROR',
                    error: error instanceof Error ? error.message : String(error),
                },
                '*'
            );
        }
    }

    /**
     * Monitor recording progress
     */
    private monitorRecordingProgress(): void {
        const checkProgress = () => {
            const progress = (this.timelineState.currentTime / this.totalDuration) * 100;
            (window as unknown as { renderStatus: RenderStatus }).renderStatus.progress = progress;

            window.postMessage(
                {
                    type: 'RENDER_PROGRESS',
                    progress,
                },
                '*'
            );

            // Check if recording is complete
            if (this.timelineState.currentTime >= this.totalDuration || !this.timelineState.isPlaying) {
                console.log('🎬 Recording playback complete, stopping recorder...');
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
                return;
            }

            // Continue monitoring
            setTimeout(checkProgress, 100);
        };

        checkProgress();
    }

    /**
     * Handle recording completion
     */
    private handleRecordingComplete(): void {
        try {
            console.log('🎬 Recording complete, processing video...');

            // Create video blob
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });

            // Create download URL
            const url = URL.createObjectURL(blob);

            // Create download link and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `render-${this.renderJobId || 'video'}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Store blob on window for server access
            (window as unknown as { renderBlob: Blob }).renderBlob = blob;

            // Mark as complete
            (window as unknown as { renderStatus: RenderStatus }).renderStatus.completed = true;
            (window as unknown as { renderStatus: RenderStatus }).renderStatus.fileReady = true;

            window.postMessage(
                {
                    type: 'RENDER_COMPLETE',
                    videoBlob: blob,
                },
                '*'
            );

            console.log('🎉 Render complete and file ready for download');
        } catch (error) {
            console.error('Failed to complete recording:', error);
            window.postMessage(
                {
                    type: 'RENDER_ERROR',
                    error: error instanceof Error ? error.message : String(error),
                },
                '*'
            );
        }
    }

    /**
     * Handle render request from UI
     */
    private async handleRenderRequest(): Promise<void> {
        try {
            console.log('🎬 Starting render request...');

            // Get the current project data - need to fetch it since we don't store it
            const response = await fetch('/test-project.json');
            const projectData: ProjectData = await response.json();

            // Send render request to server
            const renderResponse = await fetch('http://localhost:3002/api/render', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectData,
                    outputFormat: 'mp4',
                    quality: 'medium',
                }),
            });

            if (!renderResponse.ok) {
                throw new Error(`Render request failed: ${renderResponse.statusText}`);
            }

            const { jobId } = await renderResponse.json();
            console.log(`🎬 Render job created: ${jobId}`);

            // Start polling for status
            this.pollRenderStatus(jobId);
        } catch (error) {
            console.error('Failed to start render:', error);
            alert(`Failed to start render: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Poll render job status
     */
    private async pollRenderStatus(jobId: string): Promise<void> {
        const checkStatus = async () => {
            try {
                const response = await fetch(`http://localhost:3002/api/render/${jobId}/status`);
                const status = await response.json();

                console.log(`🎬 Render status: ${status.status} (${status.progress || 0}%)`);

                if (status.status === 'completed') {
                    console.log('🎉 Render completed! Opening download...');
                    // Open download link
                    window.open(`http://localhost:3002/api/render/${jobId}/download`, '_blank');
                } else if (status.status === 'failed') {
                    console.error('Render failed:', status.error);
                    alert(`Render failed: ${status.error || 'Unknown error'}`);
                } else {
                    // Still processing, check again in 2 seconds
                    setTimeout(checkStatus, 2000);
                }
            } catch (error) {
                console.error('Failed to check render status:', error);
                alert(`Failed to check render status: ${error instanceof Error ? error.message : String(error)}`);
            }
        };

        checkStatus();
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

        window.addEventListener('message', (event) => {
            // Basic security check - in production you'd want to check event.origin
            const { type, payload } = event.data;

            switch (type) {
                case 'LOAD_PROJECT':
                    this.handleLoadProjectMessage(payload);
                    break;

                default:
                    console.warn('Unknown message type:', type);
            }
        });
    }

    /**
     * Handle LOAD_PROJECT message from parent
     */
    private async handleLoadProjectMessage(projectData: ProjectData): Promise<void> {
        try {
            //console.log("📥 Received project data from parent");

            // Process the project data (same logic as loadAndPreloadTestProject)
            await this.loadAndPreloadProjectData(projectData);
        } catch (error) {
            console.error('Failed to load project from message:', error);
            this.postMessageToParent('ERROR', `Failed to load project: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Send message to parent window (when in iframe)
     */
    private postMessageToParent(type: string, payload?: unknown): void {
        if (this.isInIframe && window.parent) {
            window.parent.postMessage({ type, payload }, '*');
        }
    }

    /**
     * Load and preload project data (extracted from loadAndPreloadTestProject)
     */
    private async loadAndPreloadProjectData(projectData: ProjectData): Promise<void> {
        try {
            // Show loading screen
            this.loadingProgress.setStatus('Loading project data...');

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
                this.loadingProgress.setStatus('Loading fonts...');
                await fontManager.loadProjectFonts(projectData.style.fonts);

                // Set project fonts on scene manager
                this.sceneManager.setProjectFonts(projectData.style.fonts);
            }

            // Start preloading all assets
            this.loadingProgress.setStatus('Preloading assets...');
            const { sprites, audio } = await this.preloader.preloadAllAssets(projectData);

            // Store preloaded assets for distribution to scene renderers
            this.preloadedSprites = sprites;
            this.preloadedAudio = audio;
            //console.log(
            //   `📦 Preloaded ${sprites.size} sprites and ${audio.size} audio files`
            // );

            // Load background music if available
            if (projectData.audio?.music) {
                this.loadingProgress.setStatus('Loading background music...');
                await this.musicManager.loadMusic(projectData.audio.music, totalDuration);
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
            console.error('Failed to load project:', error);
            this.loadingProgress.showError('Failed to load project');

            // Notify parent of error if in iframe
            if (this.isInIframe) {
                this.postMessageToParent('ERROR', `Failed to load project: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const app = new VideoPreviewApp();
        await app.initialize();

        // Store app reference globally for debugging
        (window as unknown as { videoPreviewApp: VideoPreviewApp }).videoPreviewApp = app;
    } catch (error) {
        console.error('Failed to initialize Video Preview App:', error);
    }
});
