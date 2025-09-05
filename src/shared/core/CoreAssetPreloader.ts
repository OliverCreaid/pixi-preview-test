/**
 * Core asset preloader using environment abstractions
 * Handles preloading of images and audio across environments
 */

import { IAssetPreloader } from '../../core/interfaces/CoreInterface';
import { IEnvironment, ITexture, IAudioBuffer } from '../../core/interfaces/EnvironmentInterface';
import { ProjectData, MediaAsset, VoiceElement, SceneInfo } from '../../types';
import { ProjectParser } from './ProjectParser.js';

export class CoreAssetPreloader implements IAssetPreloader {
  private environment: IEnvironment | null = null;
  private loadedTextures = new Map<string, ITexture>();
  private loadedAudio = new Map<string, IAudioBuffer>();
  private loadingProgress = 0;
  private totalAssets = 0;

  // Callbacks for progress updates
  private onProgressCallback?: (progress: number, loaded: number, total: number) => void;
  private onCompleteCallback?: () => void;

  constructor(environment: IEnvironment) {
    this.environment = environment;
  }

  async preloadAllAssets(projectData: ProjectData): Promise<{
    textures: Map<string, ITexture>;
    sprites: Map<string, any>; // Simplified for now
    audio: Map<string, IAudioBuffer>;
  }> {
    if (!this.environment) {
      throw new Error('Asset preloader not initialized');
    }

    console.log('🚀 Starting global asset preloading...');

    // Parse project to get all scenes and assets
    const { scenes } = ProjectParser.parseProject(projectData);

    // Collect all unique assets
    const allMediaAssets = this.collectAllMediaAssets(scenes);
    const allAudioAssets = this.collectAllAudioAssets(scenes);
    
    this.totalAssets = allMediaAssets.length + allAudioAssets.length;

    console.log(`📦 Found ${allMediaAssets.length} media assets and ${allAudioAssets.length} audio assets to preload`);

    // Load media assets
    await this.loadAllMediaAssets(allMediaAssets);

    // Load audio assets  
    await this.loadAllAudioAssets(allAudioAssets);

    console.log('✅ Global asset preloading complete!');

    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }

    return {
      textures: this.loadedTextures,
      sprites: new Map(), // Simplified - would create sprites from textures
      audio: this.loadedAudio,
    };
  }

  onProgress(callback: (progress: number, loaded: number, total: number) => void): void {
    this.onProgressCallback = callback;
  }

  onComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
  }

  getPreloadedTexture(url: string): ITexture | undefined {
    return this.loadedTextures.get(url);
  }

  getPreloadedAudio(url: string): IAudioBuffer | undefined {
    return this.loadedAudio.get(url);
  }

  isAssetPreloaded(assetId: string): boolean {
    return this.loadedTextures.has(assetId);
  }

  isAudioPreloaded(url: string): boolean {
    return this.loadedAudio.has(url);
  }

  // Private methods
  private collectAllMediaAssets(scenes: SceneInfo[]): MediaAsset[] {
    const assetMap = new Map<string, MediaAsset>();

    for (const scene of scenes) {
      for (const asset of scene.mediaAssets) {
        if (asset.mediaType === 'image' && !assetMap.has(asset.src)) {
          assetMap.set(asset.src, asset);
        }
      }
    }

    return Array.from(assetMap.values());
  }

  private collectAllAudioAssets(scenes: SceneInfo[]): VoiceElement[] {
    const audioMap = new Map<string, VoiceElement>();

    for (const scene of scenes) {
      if (scene.voiceElement && !audioMap.has(scene.voiceElement.value)) {
        audioMap.set(scene.voiceElement.value, scene.voiceElement);
      }
    }

    return Array.from(audioMap.values());
  }

  private async loadAllMediaAssets(assets: MediaAsset[]): Promise<void> {
    if (assets.length === 0) return;

    let loadedCount = 0;
    const batchSize = 3;

    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);

      const batchPromises = batch.map(async (asset) => {
        try {
          await this.loadSingleMediaAsset(asset);
          loadedCount++;
          this.updateProgress(loadedCount);
        } catch (error) {
          console.error(`Failed to load media asset: ${asset.src}`, error);
          loadedCount++; // Still count as processed
          this.updateProgress(loadedCount);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches
      if (i + batchSize < assets.length) {
        await this.environment!.timer.delay(50);
      }
    }

    console.log(`🖼️ Loaded ${loadedCount} media assets`);
  }

  private async loadAllAudioAssets(audioAssets: VoiceElement[]): Promise<void> {
    if (audioAssets.length === 0) {
      console.log('🎵 No audio assets to load');
      return;
    }

    let loadedCount = 0;
    const batchSize = 2;

    for (let i = 0; i < audioAssets.length; i += batchSize) {
      const batch = audioAssets.slice(i, i + batchSize);

      const batchPromises = batch.map(async (voiceElement) => {
        try {
          await this.loadSingleAudioAsset(voiceElement);
          loadedCount++;
          this.updateProgress(this.loadedTextures.size + loadedCount);
        } catch (error) {
          console.error(`Failed to load audio asset: ${voiceElement.value}`, error);
          loadedCount++;
          this.updateProgress(this.loadedTextures.size + loadedCount);
        }
      });

      await Promise.all(batchPromises);

      // Delay between audio batches
      if (i + batchSize < audioAssets.length) {
        await this.environment!.timer.delay(100);
      }
    }

    console.log(`🎵 Loaded ${loadedCount} audio assets`);
  }

  private async loadSingleMediaAsset(asset: MediaAsset): Promise<void> {
    if (!this.environment) return;

    try {
      const texture = await this.environment.assetLoader.loadTexture(asset.src);
      this.loadedTextures.set(asset.src, texture);
      this.loadedTextures.set(asset.id, texture); // Also map by ID
      
      console.log(`✅ Loaded texture: ${asset.src}`);
    } catch (error) {
      console.error(`Failed to load texture: ${asset.src}`, error);
      throw error;
    }
  }

  private async loadSingleAudioAsset(voiceElement: VoiceElement): Promise<void> {
    if (!this.environment) return;

    try {
      const audioBuffer = await this.environment.assetLoader.loadAudio(voiceElement.value);
      this.loadedAudio.set(voiceElement.value, audioBuffer);
      
      console.log(`✅ Loaded audio: ${voiceElement.value}`);
    } catch (error) {
      console.error(`Failed to load audio: ${voiceElement.value}`, error);
      throw error;
    }
  }

  private updateProgress(loadedCount: number): void {
    this.loadingProgress = (loadedCount / this.totalAssets) * 100;

    if (this.onProgressCallback) {
      this.onProgressCallback(
        this.loadingProgress,
        loadedCount,
        this.totalAssets,
      );
    }

    console.log(`📊 Asset loading progress: ${this.loadingProgress.toFixed(1)}% (${loadedCount}/${this.totalAssets})`);
  }
}