/**
 * Core environment interfaces for browser/node abstraction
 * Defines contracts that both preview and render adapters must implement
 */

import { ProjectData, MediaAsset, VoiceElement, BackgroundMusic } from '../../types';

// ====== PIXI APPLICATION INTERFACE ======
export interface IPixiApp {
  canvas: ICanvas;
  stage: IContainer;
  renderer: IRenderer;
  ticker: ITicker;
  
  init(options: IPixiAppOptions): Promise<void>;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface IPixiAppOptions {
  width: number;
  height: number;
  backgroundColor: string | number;
  antialias?: boolean;
  resolution?: number;
}

export interface ICanvas {
  width: number;
  height: number;
  getContext?(type: string): any; // For browser canvas context
}

export interface IContainer {
  children: IContainer[];
  x: number;
  y: number;
  alpha: number;
  visible: boolean;
  scale: { x: number; y: number; set(value: number): void };
  label?: string;
  
  addChild(child: IContainer): void;
  removeChild(child: IContainer): void;
  removeChildren(): void;
}

export interface ISprite extends IContainer {
  texture: ITexture;
  width: number;
  height: number;
  anchor: { x: number; y: number; set(x: number, y?: number): void };
  rotation: number;
}

export interface ITexture {
  width: number;
  height: number;
  source?: any;
}

export interface IText extends IContainer {
  text: string;
  style: ITextStyle;
}

export interface ITextStyle {
  fontFamily?: string;
  fontSize?: number;
  fill?: string | number;
  align?: string;
  fontWeight?: string;
  stroke?: string | number;
  strokeThickness?: number;
  dropShadow?: boolean;
  dropShadowColor?: string | number;
  dropShadowDistance?: number;
  dropShadowAngle?: number;
  wordWrap?: boolean;
  wordWrapWidth?: number;
}

export interface IRenderer {
  resize(width: number, height: number): void;
}

export interface ITicker {
  add(fn: () => void): void;
  remove(fn: () => void): void;
  start(): void;
  stop(): void;
  deltaTime: number;
}

// ====== ASSET LOADING INTERFACE ======
export interface IAssetLoader {
  loadTexture(url: string): Promise<ITexture>;
  loadAudio(url: string): Promise<IAudioBuffer>;
  preloadAssets(assets: MediaAsset[]): Promise<Map<string, ITexture>>;
  preloadAudio(audioElements: VoiceElement[]): Promise<Map<string, IAudioBuffer>>;
}

// ====== AUDIO SYSTEM INTERFACE ======
export interface IAudioManager {
  initialize(): Promise<void>;
  loadAudioBuffer(url: string): Promise<IAudioBuffer>;
  createAudioSource(buffer: IAudioBuffer, startTime?: number, volume?: number, loop?: boolean): IAudioSource | null;
  stopAudioSource(source: IAudioSource): void;
  fadeSourceVolume(source: IAudioSource, targetVolume: number, duration: number): void;
  getCurrentTime(): number;
  resumeContext(): Promise<void>;
  getAudioContext?(): any; // For browser MediaStream capture
  destroy(): void;
}

export interface IAudioBuffer {
  duration: number;
  sampleRate?: number;
  numberOfChannels?: number;
}

export interface IAudioSource {
  buffer: IAudioBuffer;
  loop: boolean;
  onended?: () => void;
  connect?(destination: any): void;
}

// ====== TIMING SYSTEM INTERFACE ======
export interface ITimer {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  delay(ms: number): Promise<void>;
}

// ====== FONT SYSTEM INTERFACE ======
export interface IFontManager {
  loadFont(fontFamily: string, fontUrl: string): Promise<void>;
  loadProjectFonts(fonts: any): Promise<void>;
  isFontLoaded(fontFamily: string): boolean;
}

// ====== FILE SYSTEM INTERFACE ======
export interface IFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: any): Promise<void>;
  writeBuffer(path: string, data: Buffer): Promise<void>;
  exists(path: string): boolean;
  createDirectory(path: string): void;
}

// ====== VIDEO CAPTURE INTERFACE (Browser only) ======
export interface IVideoCapture {
  startRecording(canvas: ICanvas, audioStream?: any): Promise<void>;
  stopRecording(): Promise<Blob>;
  isRecording(): boolean;
}

// ====== MAIN ENVIRONMENT INTERFACE ======
export interface IEnvironment {
  // Core systems
  pixiFactory: IPixiFactory;
  assetLoader: IAssetLoader;
  audioManager: IAudioManager;
  timer: ITimer;
  fontManager: IFontManager;
  
  // Optional systems (browser-only features)
  fileSystem?: IFileSystem;
  videoCapture?: IVideoCapture;
  
  // Environment info
  type: 'browser' | 'node';
  supportsDOM: boolean;
  supportsVideoCapture: boolean;
  supportsFileSystem: boolean;
  
  // Lifecycle
  initialize(): Promise<void>;
  destroy(): void;
}

// ====== PIXI FACTORY INTERFACE ======
export interface IPixiFactory {
  createApplication(): IPixiApp;
  createContainer(): IContainer;
  createSprite(texture: ITexture): ISprite;
  createText(text: string, style?: ITextStyle): IText;
  createTexture(source: any): ITexture;
}