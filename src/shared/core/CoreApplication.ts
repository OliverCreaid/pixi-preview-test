/**
 * Core application logic using environment abstractions
 * This demonstrates how shared logic works with both browser and node environments
 */

import { 
  ICoreApplication,
  ISceneManager,
  IMusicManager,
  IAssetPreloader,
  ITimelineManager
} from '../../core/interfaces/CoreInterface';
import { 
  IEnvironment,
  IPixiApp
} from '../../core/interfaces/EnvironmentInterface';
import { ProjectData, SceneInfo, TimelineState } from '../../types';
import { ProjectParser } from './ProjectParser.js';
import { CoreSceneManager } from './CoreSceneManager.js';
import { CoreAssetPreloader } from './CoreAssetPreloader.js';

export class CoreApplication implements ICoreApplication {
  private environment: IEnvironment | null = null;
  private pixiApp: IPixiApp | null = null;
  private sceneManager: ISceneManager | null = null;
  private musicManager: IMusicManager | null = null;
  private assetPreloader: IAssetPreloader | null = null;
  private timelineManager: ITimelineManager | null = null;

  private scenes: SceneInfo[] = [];
  private totalDuration: number = 0;
  private timelineState: TimelineState = {
    currentTime: 0,
    totalDuration: 0,
    currentSceneIndex: 0,
    isPlaying: false,
  };

  // Event callbacks
  private onProjectLoadedCallback?: () => void;
  private onTimeUpdateCallback?: (time: number) => void;
  private onPlayStateChangeCallback?: (isPlaying: boolean) => void;
  private onSceneChangeCallback?: (sceneIndex: number) => void;

  async initialize(environment: IEnvironment): Promise<void> {
    this.environment = environment;

    console.log(`🚀 Initializing core application with ${environment.type} environment`);

    // Initialize environment
    await environment.initialize();

    // Create PixiJS application
    this.pixiApp = environment.pixiFactory.createApplication();
    await this.pixiApp.init({
      width: 1280,
      height: 720,
      backgroundColor: '#000000',
      antialias: true,
      resolution: environment.type === 'browser' ? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) : 1
    });

    // Initialize core managers
    this.sceneManager = new CoreSceneManager();
    await this.sceneManager.initialize(environment, this.pixiApp);
    
    this.assetPreloader = new CoreAssetPreloader(environment);
    
    // TODO: Initialize other managers when implemented
    // this.musicManager = new CoreMusicManager(environment);
    // this.timelineManager = new CoreTimelineManager(environment);

    console.log(`✅ Core application initialized for ${environment.type}`);
  }

  async loadProject(projectData: ProjectData): Promise<void> {
    if (!this.environment) {
      throw new Error('Application not initialized');
    }

    console.log('📦 Loading project data...');

    // Parse project using shared logic
    const { scenes, totalDuration } = ProjectParser.parseProject(projectData);
    this.scenes = scenes;
    this.totalDuration = totalDuration;
    this.timelineState.totalDuration = totalDuration;

    console.log(`📊 Parsed project: ${scenes.length} scenes, ${totalDuration}ms duration`);

    // Load fonts if available
    if (projectData.style?.fonts) {
      console.log('📚 Loading project fonts...');
      await this.environment.fontManager.loadProjectFonts(projectData.style.fonts);
    }

    // Preload assets
    console.log('🔄 Preloading assets...');
    const { textures, sprites, audio } = await this.assetPreloader!.preloadAllAssets(projectData);

    // Pass preloaded textures to all existing and future scenes
    this.distributePreloadedAssets(textures, audio);

    // Load background music
    if (projectData.audio?.music) {
      console.log('🎵 Loading background music...');
      // TODO: Use music manager  
      // await this.musicManager!.loadMusic(projectData.audio.music, totalDuration);
    }

    // Initialize timeline
    // TODO: Initialize timeline manager
    // this.timelineManager!.initialize(totalDuration);

    // Create and render initial scene if we have scenes
    if (this.scenes.length > 0) {
      this.sceneManager!.switchToScene(0);
      this.timelineState.currentSceneIndex = 0;
      
      // Render initial scene content
      const initialScene = this.scenes[0];
      this.renderCurrentScene(initialScene, 0);
    }

    console.log('✅ Project loaded successfully');

    if (this.onProjectLoadedCallback) {
      this.onProjectLoadedCallback();
    }
  }

  play(): void {
    if (!this.timelineState.isPlaying) {
      this.timelineState.isPlaying = true;
      
      // TODO: Start playback using timeline manager
      // this.timelineManager?.play();

      console.log('▶️ Playback started');
      
      if (this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(true);
      }
    }
  }

  pause(): void {
    if (this.timelineState.isPlaying) {
      this.timelineState.isPlaying = false;
      
      // TODO: Pause playback using timeline manager
      // this.timelineManager?.pause();

      console.log('⏸️ Playback paused');
      
      if (this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(false);
      }
    }
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.totalDuration));
    this.timelineState.currentTime = clampedTime;

    // TODO: Seek using timeline manager
    // this.timelineManager?.seek(clampedTime);

    // Find current scene
    const currentScene = ProjectParser.getSceneAtTime(this.scenes, clampedTime);
    if (currentScene) {
      // Switch to scene if needed
      if (currentScene.index !== this.timelineState.currentSceneIndex) {
        this.timelineState.currentSceneIndex = currentScene.index;
        this.sceneManager?.switchToScene(currentScene.index);
        
        if (this.onSceneChangeCallback) {
          this.onSceneChangeCallback(currentScene.index);
        }
      }

      // Render scene content at current time
      this.renderCurrentScene(currentScene, clampedTime);
    }

    // Seek logging removed for performance
    
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(clampedTime);
    }
  }

  private renderCurrentScene(sceneInfo: any, globalTime: number): void {
    // Calculate scene-relative time
    const sceneRelativeTime = globalTime - sceneInfo.startTime;
    
    // Get the actual scene object from scene manager
    const scene = this.sceneManager?.getScene(sceneInfo.index);
    if (!scene) return;

    // Render media assets at current time
    if (sceneInfo.mediaAssets && sceneInfo.mediaAssets.length > 0) {
      scene.mediaRenderer.displayMedia(sceneInfo.mediaAssets, sceneRelativeTime);
      
      // Update Ken Burns effect for active asset
      const activeAsset = this.getActiveMediaAsset(sceneInfo.mediaAssets, sceneRelativeTime);
      if (activeAsset) {
        const assetRelativeTime = this.getAssetRelativeTime(sceneInfo.mediaAssets, activeAsset, sceneRelativeTime);
        scene.mediaRenderer.updateKenBurns(assetRelativeTime);
      }
    }

    // Render text elements
    if (sceneInfo.textElements && sceneInfo.textElements.length > 0) {
      scene.textRenderer.displayTexts(sceneInfo.textElements);
    }
  }

  private getActiveMediaAsset(assets: any[], sceneRelativeTime: number): any {
    if (assets.length === 1) return assets[0];

    let cumulativeTime = 0;
    for (const asset of assets) {
      if (sceneRelativeTime >= cumulativeTime && sceneRelativeTime < cumulativeTime + asset.duration) {
        return asset;
      }
      cumulativeTime += asset.duration;
    }
    return assets[assets.length - 1];
  }

  private getAssetRelativeTime(assets: any[], activeAsset: any, sceneRelativeTime: number): number {
    if (assets.length === 1) return sceneRelativeTime;

    let cumulativeTime = 0;
    for (const asset of assets) {
      if (asset.id === activeAsset.id) {
        return sceneRelativeTime - cumulativeTime;
      }
      cumulativeTime += asset.duration;
    }
    return 0;
  }

  private distributePreloadedAssets(textures: Map<string, any>, audio: Map<string, any>): void {
    console.log(`🎯 Distributing ${textures.size} textures to scenes`);
    
    // Create scenes for all parsed scenes and distribute assets
    for (const sceneInfo of this.scenes) {
      let scene = this.sceneManager?.getScene(sceneInfo.index);
      if (!scene) {
        scene = this.sceneManager?.createScene(sceneInfo.index, sceneInfo.voiceElement);
      }
      
      if (scene) {
        // Pass textures to media renderer
        scene.mediaRenderer.setPreloadedTextures(textures);
        
        // Pass fonts to text renderer if available
        if (this.environment?.fontManager) {
          scene.textRenderer.setProjectFonts(null); // TODO: Get actual project fonts
        }
      }
    }
  }

  getCurrentTime(): number {
    return this.timelineState.currentTime;
  }

  getTotalDuration(): number {
    return this.totalDuration;
  }

  isPlaying(): boolean {
    return this.timelineState.isPlaying;
  }

  resize(width: number, height: number): void {
    if (this.pixiApp) {
      this.pixiApp.resize(width, height);
    }
    
    if (this.sceneManager) {
      this.sceneManager.resize(width, height);
    }
  }

  destroy(): void {
    console.log('🧹 Destroying core application...');

    // Cleanup managers
    this.sceneManager?.destroy();
    this.musicManager?.destroy();
    this.timelineManager?.destroy();

    // Cleanup PixiJS
    this.pixiApp?.destroy();

    // Cleanup environment
    this.environment?.destroy();

    // Reset state
    this.environment = null;
    this.pixiApp = null;
    this.sceneManager = null;
    this.musicManager = null;
    this.assetPreloader = null;
    this.timelineManager = null;
    this.scenes = [];
    this.totalDuration = 0;

    console.log('✅ Core application destroyed');
  }

  // Event callbacks
  onProjectLoaded(callback: () => void): void {
    this.onProjectLoadedCallback = callback;
  }

  onTimeUpdate(callback: (time: number) => void): void {
    this.onTimeUpdateCallback = callback;
  }

  onPlayStateChange(callback: (isPlaying: boolean) => void): void {
    this.onPlayStateChangeCallback = callback;
  }

  onSceneChange(callback: (sceneIndex: number) => void): void {
    this.onSceneChangeCallback = callback;
  }

  // Environment-specific methods
  getCanvas(): any {
    return this.pixiApp?.canvas;
  }

  getEnvironmentType(): 'browser' | 'node' | null {
    return this.environment?.type || null;
  }

  supportsVideoCapture(): boolean {
    return this.environment?.supportsVideoCapture || false;
  }

  supportsFileSystem(): boolean {
    return this.environment?.supportsFileSystem || false;
  }

  // Render current frame to canvas
  render(): void {
    if (this.pixiApp && this.sceneManager && this.environment?.type === 'node') {
      // For Node.js, trigger manual render
      const renderer = this.pixiApp.renderer;
      if (renderer && typeof (renderer as any).render === 'function') {
        // Manual render trigger - logging removed for performance
        (renderer as any).render(this.pixiApp.stage);
      } else {
        console.warn('⚠️ No render method found on renderer');
      }
    }
  }
}