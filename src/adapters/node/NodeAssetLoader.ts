/**
 * Node.js implementation of asset loader using file system and fetch
 */

import fs from 'fs/promises';
import { loadImage } from 'canvas';
import path from 'path';
import { IAssetLoader, ITexture, IAudioBuffer } from '../../core/interfaces/EnvironmentInterface';
import { MediaAsset, VoiceElement } from '../../types';
import { NodeTexture } from './NodePixiFactory.js';

export class NodeAssetLoader implements IAssetLoader {
  private loadedTextures = new Map<string, ITexture>();
  private loadedAudio = new Map<string, IAudioBuffer>();

  async loadTexture(url: string): Promise<ITexture> {
    if (this.loadedTextures.has(url)) {
      return this.loadedTextures.get(url)!;
    }

    try {
      let actualPath: string;

      // Handle different URL formats
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // Remote URL - fetch and cache locally
        actualPath = await this.fetchAndCacheRemoteAsset(url);
      } else if (url.startsWith('public/')) {
        // Public asset path
        actualPath = path.join(process.cwd(), url);
      } else if (url.startsWith('/')) {
        // Absolute path
        actualPath = url;
      } else {
        // Relative path - assume relative to public
        actualPath = path.join(process.cwd(), 'public', url);
      }

      // Verify file exists
      try {
        await fs.access(actualPath);
      } catch {
        throw new Error(`Asset file not found: ${actualPath}`);
      }

      // Load actual image using node-canvas
      const image = await loadImage(actualPath);
      const nodeTexture = new NodeTexture(image, image.width, image.height);
      this.loadedTextures.set(url, nodeTexture);
      return nodeTexture;
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
      let audioPath: string;

      // Handle different URL formats
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // Remote URL - fetch and cache locally
        audioPath = await this.fetchAndCacheRemoteAsset(url);
      } else if (url.startsWith('public/')) {
        // Public asset path
        audioPath = path.join(process.cwd(), url);
      } else if (url.startsWith('/')) {
        // Absolute path
        audioPath = url;
      } else {
        // Relative path - assume relative to public
        audioPath = path.join(process.cwd(), 'public', url);
      }

      // Read audio file
      const audioBuffer = await fs.readFile(audioPath);
      const nodeAudioBuffer = new NodeAudioBuffer(audioBuffer, audioPath);
      this.loadedAudio.set(url, nodeAudioBuffer);
      return nodeAudioBuffer;
    } catch (error) {
      console.error(`Failed to load audio: ${url}`, error);
      throw error;
    }
  }

  async preloadAssets(assets: MediaAsset[]): Promise<Map<string, ITexture>> {
    const textureMap = new Map<string, ITexture>();
    const batchSize = 5; // Larger batches for server-side

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
          // Continue with other assets
        }
      });

      await Promise.all(batchPromises);
    }

    return textureMap;
  }

  async preloadAudio(audioElements: VoiceElement[]): Promise<Map<string, IAudioBuffer>> {
    const audioMap = new Map<string, IAudioBuffer>();
    
    const audioPromises = audioElements.map(async (voiceElement) => {
      try {
        const audioBuffer = await this.loadAudio(voiceElement.value);
        audioMap.set(voiceElement.value, audioBuffer);
      } catch (error) {
        console.error(`Failed to preload audio: ${voiceElement.value}`, error);
        // Continue with other audio files
      }
    });

    await Promise.all(audioPromises);
    return audioMap;
  }

  private async fetchAndCacheRemoteAsset(url: string): Promise<string> {
    // Create cache directory
    const cacheDir = path.join(process.cwd(), '.cache', 'assets');
    await fs.mkdir(cacheDir, { recursive: true });

    // Generate cache filename
    const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '');
    const extension = path.extname(new URL(url).pathname) || '.bin';
    const cacheFile = path.join(cacheDir, `${urlHash}${extension}`);

    // Check if already cached
    try {
      await fs.access(cacheFile);
      return cacheFile;
    } catch {
      // File doesn't exist, fetch it
    }

    // Fetch and cache
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(cacheFile, buffer);

    return cacheFile;
  }
}

export class NodeAudioBuffer implements IAudioBuffer {
  constructor(private buffer: Buffer, private filePath: string) {}

  get duration(): number {
    // For Node.js, we'd need an audio library to get duration
    // For now, return a default - this could be enhanced with libraries like node-ffmpeg
    return 10; // Default 10 seconds
  }

  get sampleRate(): number {
    return 44100; // Standard sample rate
  }

  get numberOfChannels(): number {
    return 2; // Stereo
  }

  // Expose the buffer for Node.js audio processing
  get nodeBuffer(): Buffer {
    return this.buffer;
  }

  get path(): string {
    return this.filePath;
  }
}