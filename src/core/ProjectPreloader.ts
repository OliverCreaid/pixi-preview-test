import { Assets, Texture, Sprite } from "pixi.js";
import { ProjectData, MediaAsset, SceneInfo, VoiceElement } from "../types";
import { ProjectParser } from "./ProjectParser";

/**
 * Handles preloading of all project assets at startup
 * Eliminates loading delays during playback for smooth experience
 */
export class ProjectPreloader {
  private loadedTextures = new Map<string, Texture>();
  private preloadedSprites = new Map<string, Sprite>();
  private preloadedAudio = new Map<string, HTMLAudioElement>();
  private loadingProgress = 0;
  private totalAssets = 0;

  // Callbacks for progress updates
  private onProgressCallback?: (
    progress: number,
    loaded: number,
    total: number,
  ) => void;
  private onCompleteCallback?: () => void;

  /**
   * Set callback for loading progress updates
   */
  onProgress(
    callback: (progress: number, loaded: number, total: number) => void,
  ): void {
    this.onProgressCallback = callback;
  }

  /**
   * Set callback for loading completion
   */
  onComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
  }

  /**
   * Preload all assets from project data (images + audio)
   */
  async preloadAllAssets(projectData: ProjectData): Promise<{
    textures: Map<string, Texture>;
    sprites: Map<string, Sprite>;
    audio: Map<string, HTMLAudioElement>;
  }> {
    //console.log("🚀 Starting global asset preloading (images + audio)...");

    // Parse project to get all scenes and assets
    const { scenes } = ProjectParser.parseProject(projectData);

    // Collect all unique assets (media + audio)
    const allMediaAssets = this.collectAllAssets(scenes);
    const allAudioAssets = this.collectAllAudioAssets(scenes);
    this.totalAssets = allMediaAssets.length + allAudioAssets.length;

    //console.log(
    //   `📦 Found ${allMediaAssets.length} media assets and ${allAudioAssets.length} audio assets to preload`,
    // );

    // Load media assets
    await this.loadAllAssets(allMediaAssets);

    // Load audio assets
    await this.loadAllAudioAssets(allAudioAssets);

    //console.log("✅ Global asset preloading complete (images + audio)!");

    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }

    return {
      textures: this.loadedTextures,
      sprites: this.preloadedSprites,
      audio: this.preloadedAudio,
    };
  }

  /**
   * Collect all unique assets from all scenes
   */
  private collectAllAssets(scenes: SceneInfo[]): MediaAsset[] {
    const assetMap = new Map<string, MediaAsset>();

    for (const scene of scenes) {
      for (const asset of scene.mediaAssets) {
        if (asset.mediaType === "image" && !assetMap.has(asset.src)) {
          assetMap.set(asset.src, asset);
        }
      }
    }

    return Array.from(assetMap.values());
  }

  /**
   * Collect all unique audio assets from all scenes
   */
  private collectAllAudioAssets(scenes: SceneInfo[]): VoiceElement[] {
    const audioMap = new Map<string, VoiceElement>();

    for (const scene of scenes) {
      if (scene.voiceElement && !audioMap.has(scene.voiceElement.value)) {
        audioMap.set(scene.voiceElement.value, scene.voiceElement);
      }
    }

    return Array.from(audioMap.values());
  }

  /**
   * Load all assets with progress tracking
   */
  private async loadAllAssets(assets: MediaAsset[]): Promise<void> {
    let loadedCount = 0;

    // Load assets in batches to avoid overwhelming the browser
    const batchSize = 3;
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);

      // Load batch in parallel
      const batchPromises = batch.map(async (asset) => {
        try {
          await this.loadSingleAsset(asset);
          loadedCount++;
          this.updateProgress(loadedCount);
        } catch (error) {
          console.error(`Failed to load asset: ${asset.src}`, error);
          loadedCount++; // Still count as "processed"
          this.updateProgress(loadedCount);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to prevent browser freezing
      if (i + batchSize < assets.length) {
        await this.delay(50);
      }
    }
  }

  /**
   * Load all audio assets with progress tracking
   */
  private async loadAllAudioAssets(audioAssets: VoiceElement[]): Promise<void> {
    if (audioAssets.length === 0) {
      //console.log("🎵 No audio assets to load");
      return;
    }

    let loadedCount = 0;
    const batchSize = 2; // Smaller batches for audio to avoid overwhelming

    for (let i = 0; i < audioAssets.length; i += batchSize) {
      const batch = audioAssets.slice(i, i + batchSize);

      // Load batch in parallel
      const batchPromises = batch.map(async (voiceElement) => {
        try {
          await this.loadSingleAudioAsset(voiceElement);
          loadedCount++;
          this.updateProgress(this.loadedTextures.size + loadedCount); // Include media asset count
        } catch (error) {
          console.error(
            `Failed to load audio asset: ${voiceElement.value}`,
            error,
          );
          loadedCount++; // Still count as "processed"
          this.updateProgress(this.loadedTextures.size + loadedCount);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches
      if (i + batchSize < audioAssets.length) {
        await this.delay(100); // Slightly longer delay for audio
      }
    }

    //console.log(`🎵 Loaded ${loadedCount} audio assets`);
  }

  /**
   * Load a single audio asset
   */
  private async loadSingleAudioAsset(
    voiceElement: VoiceElement,
  ): Promise<void> {
    const audio = new Audio();
    audio.src = voiceElement.value;
    audio.preload = "auto";

    // Wait for audio to load
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Audio load timeout: ${voiceElement.value}`));
      }, 10000); // 10 second timeout

      audio.addEventListener("canplaythrough", () => {
        clearTimeout(timeoutId);
        resolve();
      });

      audio.addEventListener("error", (e) => {
        clearTimeout(timeoutId);
        reject(new Error(`Audio load error: ${e}`));
      });
    });

    // Store preloaded audio
    this.preloadedAudio.set(voiceElement.value, audio);
    //console.log(`✅ Audio loaded: ${voiceElement.value} (${audio.duration}s)`);
  }

  /**
   * Load a single asset (texture + sprite)
   */
  private async loadSingleAsset(asset: MediaAsset): Promise<void> {
    // Load texture
    const texture = await Assets.load(asset.src);
    this.loadedTextures.set(asset.src, texture);

    // Create and configure sprite
    const sprite = new Sprite(texture);
    this.applyAssetTransform(sprite, asset);
    this.preloadedSprites.set(asset.id, sprite);
  }

  /**
   * Apply positioning and scaling to sprite (same logic as MediaRenderer)
   */
  private applyAssetTransform(sprite: Sprite, asset: MediaAsset): void {
    const canvasWidth = 1280;
    const canvasHeight = 720;

    // Calculate dimensions based on fit type
    const { width, height, x, y } = this.calculateAssetDimensions(
      sprite.texture.width,
      sprite.texture.height,
      asset,
      canvasWidth,
      canvasHeight,
    );

    // Apply dimensions and position
    sprite.width = width;
    sprite.height = height;
    sprite.x = x;
    sprite.y = y;

    // Apply rotation if specified
    if (asset.rotation !== 0) {
      sprite.anchor.set(0.5);
      sprite.x += width / 2;
      sprite.y += height / 2;
      sprite.rotation = (asset.rotation * Math.PI) / 180;
    }
  }

  /**
   * Calculate sprite dimensions and position (copied from MediaRenderer)
   */
  private calculateAssetDimensions(
    originalWidth: number,
    originalHeight: number,
    asset: MediaAsset,
    canvasWidth: number,
    canvasHeight: number,
  ): { width: number; height: number; x: number; y: number } {
    // Convert percentage-based properties to pixels
    const targetWidth = (asset.width / 100) * canvasWidth;
    const targetHeight = (asset.height / 100) * canvasHeight;
    const posX = (asset.posX / 100) * canvasWidth;
    const posY = (asset.posY / 100) * canvasHeight;

    let finalWidth = targetWidth;
    let finalHeight = targetHeight;

    // Apply fit logic
    switch (asset.fit) {
      case "cover": {
        const scaleX = targetWidth / originalWidth;
        const scaleY = targetHeight / originalHeight;
        const scale = Math.max(scaleX, scaleY);
        finalWidth = originalWidth * scale;
        finalHeight = originalHeight * scale;
        break;
      }
      case "contain": {
        const containScaleX = targetWidth / originalWidth;
        const containScaleY = targetHeight / originalHeight;
        const containScale = Math.min(containScaleX, containScaleY);
        finalWidth = originalWidth * containScale;
        finalHeight = originalHeight * containScale;
        break;
      }
      case "fill":
        finalWidth = targetWidth;
        finalHeight = targetHeight;
        break;
    }

    // Apply additional scaling
    const scaleMultiplier = asset.scale / 100;
    finalWidth *= scaleMultiplier;
    finalHeight *= scaleMultiplier;

    // Calculate final position (considering anchor point)
    const x = posX - finalWidth / 2;
    const y = posY - finalHeight / 2;

    return { width: finalWidth, height: finalHeight, x, y };
  }

  /**
   * Update loading progress
   */
  private updateProgress(loadedCount: number): void {
    this.loadingProgress = (loadedCount / this.totalAssets) * 100;

    if (this.onProgressCallback) {
      this.onProgressCallback(
        this.loadingProgress,
        loadedCount,
        this.totalAssets,
      );
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get preloaded sprite by asset ID
   */
  getPreloadedSprite(assetId: string): Sprite | undefined {
    return this.preloadedSprites.get(assetId);
  }

  /**
   * Get preloaded texture by URL
   */
  getPreloadedTexture(url: string): Texture | undefined {
    return this.loadedTextures.get(url);
  }

  /**
   * Check if asset is preloaded
   */
  isAssetPreloaded(assetId: string): boolean {
    return this.preloadedSprites.has(assetId);
  }

  /**
   * Get preloaded audio element by URL
   */
  getPreloadedAudio(url: string): HTMLAudioElement | undefined {
    return this.preloadedAudio.get(url);
  }

  /**
   * Check if audio is preloaded
   */
  isAudioPreloaded(url: string): boolean {
    return this.preloadedAudio.has(url);
  }

  /**
   * Get all preloaded audio URLs
   */
  getPreloadedAudioUrls(): string[] {
    return Array.from(this.preloadedAudio.keys());
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): { progress: number; loaded: number; total: number } {
    return {
      progress: this.loadingProgress,
      loaded: Math.floor((this.loadingProgress / 100) * this.totalAssets),
      total: this.totalAssets,
    };
  }
}
