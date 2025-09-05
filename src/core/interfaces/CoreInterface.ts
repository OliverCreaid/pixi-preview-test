/**
 * Core logic interfaces - environment-agnostic business logic
 * These interfaces define the shared functionality between preview and render modes
 */

import { 
  ProjectData, 
  SceneInfo, 
  MediaAsset, 
  TextElement, 
  VoiceElement,
  TimelineState,
  TransitionConfig,
  TransitionState,
  BackgroundMusic,
  KenBurnsConfig 
} from '../../types';
import { IContainer, ISprite, IText, ITexture, IAudioBuffer, IEnvironment, IPixiApp } from './EnvironmentInterface';

// ====== PROJECT PARSING INTERFACE ======
export interface IProjectParser {
  parseProject(projectData: ProjectData): { scenes: SceneInfo[]; totalDuration: number };
  getSceneAtTime(scenes: SceneInfo[], time: number): (SceneInfo & { index: number }) | null;
  calculateMediaTiming(assets: MediaAsset[], sceneDuration: number): MediaAsset[];
}

// ====== SCENE MANAGEMENT INTERFACE ======
export interface ISceneManager {
  initialize(environment: IEnvironment, pixiApp?: IPixiApp): Promise<void>;
  createScene(sceneIndex: number, voiceElement?: VoiceElement): IScene;
  getScene(sceneIndex: number): IScene | null;
  switchToScene(newSceneIndex: number, currentSceneIndex?: number, forceInstant?: boolean): void;
  updateTransitions(): void;
  isTransitioning(): boolean;
  getActiveScene(): IScene | null;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface IScene {
  index: number;
  container: IContainer;
  mediaRenderer: IMediaRenderer;
  textRenderer: ITextRenderer;
  audioRenderer?: IAudioRenderer;
  isActive: boolean;
  alpha: number;
}

// ====== MEDIA RENDERING INTERFACE ======
export interface IMediaRenderer {
  displayMedia(assets: MediaAsset[], sceneRelativeTime: number): Promise<void>;
  updateKenBurns(assetRelativeTime: number): void;
  clearCurrentMedia(): void;
  setPreloadedTextures(textures: Map<string, ITexture>): void;
  destroy(): void;
}

// ====== TEXT RENDERING INTERFACE ======
export interface ITextRenderer {
  displayTexts(textElements: TextElement[]): void;
  clearCurrentTexts(): void;
  setProjectFonts(fonts: any): void;
  destroy(): void;
}

// ====== AUDIO RENDERING INTERFACE ======
export interface IAudioRenderer {
  loadVoiceElement(voiceElement: VoiceElement): Promise<void>;
  startPlayback(startTime: number): Promise<void>;
  pausePlayback(): void;
  syncWithTimeline(sceneRelativeTime: number): void;
  isReady(): boolean;
  isPlaying(): boolean;
  destroy(): void;
}

// ====== TRANSITION MANAGEMENT INTERFACE ======
export interface ITransitionManager {
  registerScene(scene: IScene): void;
  startTransition(fromSceneIndex: number, toSceneIndex: number): void;
  updateTransition(): void;
  forceCompleteTransition(): void;
  isTransitioning(): boolean;
  getActiveScene(): IScene | null;
  destroy(): void;
}

// ====== MUSIC MANAGEMENT INTERFACE ======
export interface IMusicManager {
  loadMusic(musicConfig: BackgroundMusic, totalDuration: number): Promise<void>;
  startPlayback(startTime?: number): Promise<void>;
  pausePlayback(): void;
  stopPlayback(): Promise<void>;
  syncWithTimeline(expectedTimeMs: number): void;
  duckVolume(isDucking: boolean): void;
  seekToTime(timeMs: number): Promise<void>;
  isPlaying(): boolean;
  isReady(): boolean;
  getAudioStream?(): any; // Browser-only for MediaRecorder
  destroy(): void;
}

// ====== ASSET PRELOADING INTERFACE ======
export interface IAssetPreloader {
  preloadAllAssets(projectData: ProjectData): Promise<{
    textures: Map<string, ITexture>;
    sprites: Map<string, ISprite>;
    audio: Map<string, IAudioBuffer>;
  }>;
  onProgress(callback: (progress: number, loaded: number, total: number) => void): void;
  onComplete(callback: () => void): void;
  getPreloadedTexture(url: string): ITexture | undefined;
  getPreloadedAudio(url: string): IAudioBuffer | undefined;
  isAssetPreloaded(assetId: string): boolean;
  isAudioPreloaded(url: string): boolean;
}

// ====== TIMELINE MANAGEMENT INTERFACE ======
export interface ITimelineManager {
  initialize(totalDuration: number): void;
  play(): void;
  pause(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  getTotalDuration(): number;
  isPlaying(): boolean;
  onTimeUpdate(callback: (time: number) => void): void;
  onPlayStateChange(callback: (isPlaying: boolean) => void): void;
  destroy(): void;
}

// ====== CORE APPLICATION INTERFACE ======
export interface ICoreApplication {
  initialize(environment: IEnvironment): Promise<void>;
  loadProject(projectData: ProjectData): Promise<void>;
  play(): void;
  pause(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  getTotalDuration(): number;
  isPlaying(): boolean;
  resize(width: number, height: number): void;
  destroy(): void;
  
  // Event callbacks
  onProjectLoaded(callback: () => void): void;
  onTimeUpdate(callback: (time: number) => void): void;
  onPlayStateChange(callback: (isPlaying: boolean) => void): void;
  onSceneChange(callback: (sceneIndex: number) => void): void;
}

// ====== RENDER SPECIFIC INTERFACES ======
export interface IRenderEngine {
  renderFrame(time: number): Promise<Buffer | ImageData>;
  renderVideo(projectData: ProjectData, options: RenderOptions): Promise<string>;
  extractFrames(projectData: ProjectData, frameRate: number): AsyncGenerator<Buffer, void>;
  destroy(): void;
}

export interface RenderOptions {
  outputPath?: string;
  format?: 'mp4' | 'webm' | 'mov';
  quality?: 'low' | 'medium' | 'high';
  width?: number;
  height?: number;
  frameRate?: number;
  duration?: number;
}