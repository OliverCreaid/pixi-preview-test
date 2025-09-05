/**
 * Browser implementation of audio manager using Web Audio API
 */

import { IAudioManager, IAudioBuffer, IAudioSource } from '../../core/interfaces/EnvironmentInterface';
import { BrowserAudioBuffer } from './BrowserAssetLoader';

export class BrowserAudioManager implements IAudioManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private activeSources = new Set<BrowserAudioSource>();

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async loadAudioBuffer(url: string): Promise<IAudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return new BrowserAudioBuffer(audioBuffer);
    } catch (error) {
      console.error(`Failed to load audio buffer: ${url}`, error);
      throw error;
    }
  }

  createAudioSource(
    buffer: IAudioBuffer,
    startTime: number = 0,
    volume: number = 1.0,
    loop: boolean = false
  ): IAudioSource | null {
    if (!this.audioContext || !this.gainNode) {
      console.warn('Audio context not initialized');
      return null;
    }

    const browserBuffer = buffer as BrowserAudioBuffer;
    const source = new BrowserAudioSource(
      this.audioContext,
      browserBuffer.nativeBuffer,
      this.gainNode,
      startTime,
      volume,
      loop
    );

    this.activeSources.add(source);

    // Clean up when source ends
    source.onended = () => {
      this.activeSources.delete(source);
    };

    return source;
  }

  stopAudioSource(source: IAudioSource): void {
    if (source instanceof BrowserAudioSource) {
      source.stop();
      this.activeSources.delete(source);
    }
  }

  fadeSourceVolume(source: IAudioSource, targetVolume: number, duration: number): void {
    if (source instanceof BrowserAudioSource) {
      source.fadeVolume(targetVolume, duration);
    }
  }

  getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }

  async resumeContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  destroy(): void {
    // Stop all active sources
    for (const source of this.activeSources) {
      source.stop();
    }
    this.activeSources.clear();

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
    }
  }
}

export class BrowserAudioSource implements IAudioSource {
  private audioContext: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private masterGain: GainNode;
  private startTime: number;
  private volume: number;
  public onended?: () => void;

  constructor(
    audioContext: AudioContext,
    public buffer: IAudioBuffer,
    masterGain: GainNode,
    startTime: number = 0,
    volume: number = 1.0,
    public loop: boolean = false
  ) {
    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.startTime = startTime;
    this.volume = volume;

    // Create source and gain nodes
    this.createSource();
  }

  private createSource(): void {
    if (!this.audioContext) return;

    const browserBuffer = this.buffer as BrowserAudioBuffer;
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = browserBuffer.nativeBuffer;
    this.source.loop = this.loop;

    // Set up loop points for proper looping with start offset
    if (this.loop && this.startTime > 0) {
      this.source.loopStart = this.startTime;
      this.source.loopEnd = browserBuffer.nativeBuffer.duration;
    }

    // Create gain node for this source
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);

    // Connect: source -> gain -> master gain -> destination
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.masterGain);

    // Handle ended event
    this.source.onended = () => {
      if (this.onended) {
        this.onended();
      }
    };

    // Start playback
    const now = this.audioContext.currentTime;
    if (this.startTime > 0) {
      this.source.start(now, this.startTime);
    } else {
      this.source.start(now);
    }
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch (error) {
        // Source might already be stopped
      }
      this.source = null;
    }
  }

  fadeVolume(targetVolume: number, duration: number): void {
    if (!this.gainNode || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(targetVolume, now + duration);
    
    this.volume = targetVolume;
  }

  connect(destination: AudioNode): void {
    if (this.gainNode) {
      this.gainNode.connect(destination);
    }
  }
}