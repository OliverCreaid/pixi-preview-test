/**
 * Browser implementation of asset loader using fetch and PixiJS Assets
 */

import { Assets } from 'pixi.js';
import { IAssetLoader, ITexture, IAudioBuffer } from '../../core/interfaces/EnvironmentInterface';
import { MediaAsset, VoiceElement } from '../../types';
import { BrowserTexture } from './BrowserPixiFactory';

export class BrowserAssetLoader implements IAssetLoader {
  private loadedTextures = new Map<string, ITexture>();
  private loadedAudio = new Map<string, IAudioBuffer>();

  async loadTexture(url: string): Promise<ITexture> {
    if (this.loadedTextures.has(url)) {
      return this.loadedTextures.get(url)!;
    }

    try {
      const texture = await Assets.load(url);
      const browserTexture = new BrowserTexture(texture);
      this.loadedTextures.set(url, browserTexture);
      return browserTexture;
    } catch (error) {
      console.error(`Failed to load texture: ${url}`, error);
      throw error;
    }
  }

  async loadAudio(url: string): Promise<IAudioBuffer> {
    if (this.loadedAudio.has(url)) {
      return this.loadedAudio.get(url)!;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const browserAudioBuffer = new BrowserAudioBuffer(audioBuffer);
      this.loadedAudio.set(url, browserAudioBuffer);
      return browserAudioBuffer;
    } catch (error) {
      console.error(`Failed to load audio: ${url}`, error);
      throw error;
    }
  }

  async preloadAssets(assets: MediaAsset[]): Promise<Map<string, ITexture>> {
    const textureMap = new Map<string, ITexture>();
    const batchSize = 3; // Load assets in small batches

    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (asset) => {
        try {
          if (asset.mediaType === 'image') {
            const texture = await this.loadTexture(asset.src);
            textureMap.set(asset.src, texture);
            textureMap.set(asset.id, texture); // Also map by asset ID
          }
        } catch (error) {
          console.error(`Failed to preload asset: ${asset.src}`, error);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to prevent overwhelming the browser
      if (i + batchSize < assets.length) {
        await this.delay(50);
      }
    }

    return textureMap;
  }

  async preloadAudio(audioElements: VoiceElement[]): Promise<Map<string, IAudioBuffer>> {
    const audioMap = new Map<string, IAudioBuffer>();
    const batchSize = 2; // Smaller batches for audio

    for (let i = 0; i < audioElements.length; i += batchSize) {
      const batch = audioElements.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (voiceElement) => {
        try {
          const audioBuffer = await this.loadAudio(voiceElement.value);
          audioMap.set(voiceElement.value, audioBuffer);
        } catch (error) {
          console.error(`Failed to preload audio: ${voiceElement.value}`, error);
        }
      });

      await Promise.all(batchPromises);

      // Delay between audio batches
      if (i + batchSize < audioElements.length) {
        await this.delay(100);
      }
    }

    return audioMap;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class BrowserAudioBuffer implements IAudioBuffer {
  constructor(private audioBuffer: AudioBuffer) {}

  get duration(): number {
    return this.audioBuffer.duration;
  }

  get sampleRate(): number {
    return this.audioBuffer.sampleRate;
  }

  get numberOfChannels(): number {
    return this.audioBuffer.numberOfChannels;
  }

  // Expose the native buffer for Web Audio API usage
  get nativeBuffer(): AudioBuffer {
    return this.audioBuffer;
  }
}