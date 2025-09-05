/**
 * Browser environment implementation
 * Coordinates all browser-specific adapters and services
 */

import { 
  IEnvironment, 
  IPixiFactory, 
  IAssetLoader, 
  IAudioManager, 
  ITimer, 
  IFontManager,
  IVideoCapture
} from '../../core/interfaces/EnvironmentInterface';

import { BrowserPixiFactory } from './BrowserPixiFactory';
import { BrowserAssetLoader } from './BrowserAssetLoader';
import { BrowserAudioManager } from './BrowserAudioManager';
import { BrowserTimer } from './BrowserTimer';
import { BrowserFontManager } from './BrowserFontManager';
import { BrowserVideoCapture } from './BrowserVideoCapture';

export class BrowserEnvironment implements IEnvironment {
  // Core systems
  public readonly pixiFactory: IPixiFactory;
  public readonly assetLoader: IAssetLoader;
  public readonly audioManager: IAudioManager;
  public readonly timer: ITimer;
  public readonly fontManager: IFontManager;

  // Browser-specific features
  public readonly videoCapture: IVideoCapture;

  // Environment info
  public readonly type = 'browser' as const;
  public readonly supportsDOM = true;
  public readonly supportsVideoCapture = true;
  public readonly supportsFileSystem = false;

  private initialized = false;

  constructor() {
    this.pixiFactory = new BrowserPixiFactory();
    this.assetLoader = new BrowserAssetLoader();
    this.audioManager = new BrowserAudioManager();
    this.timer = new BrowserTimer();
    this.fontManager = new BrowserFontManager();
    this.videoCapture = new BrowserVideoCapture();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🌐 Initializing browser environment...');

      // Initialize audio system
      await this.audioManager.initialize();
      console.log('✅ Audio system initialized');

      // Check for required browser APIs
      this.checkBrowserSupport();

      this.initialized = true;
      console.log('🌐 Browser environment initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize browser environment:', error);
      throw error;
    }
  }

  destroy(): void {
    console.log('🧹 Cleaning up browser environment...');

    // Clean up audio system
    this.audioManager.destroy();

    this.initialized = false;
    console.log('✅ Browser environment cleaned up');
  }

  private checkBrowserSupport(): void {
    const missing: string[] = [];

    // Check for required APIs
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      missing.push('Web Audio API');
    }

    if (!window.requestAnimationFrame) {
      missing.push('requestAnimationFrame');
    }

    if (!window.fetch) {
      missing.push('Fetch API');
    }

    if (!window.MediaRecorder) {
      console.warn('⚠️ MediaRecorder not available - video recording disabled');
    }

    if (!document.fonts) {
      console.warn('⚠️ Font Loading API not available - font loading may be unreliable');
    }

    if (missing.length > 0) {
      throw new Error(`Browser missing required APIs: ${missing.join(', ')}`);
    }

    console.log('✅ Browser support check passed');
  }

  // Utility methods for browser-specific features
  isInIframe(): boolean {
    return window.self !== window.top;
  }

  getDomElement(selector: string): HTMLElement | null {
    return document.querySelector(selector);
  }

  createDomElement(tagName: string): HTMLElement {
    return document.createElement(tagName);
  }

  appendCanvasToDOM(canvas: HTMLCanvasElement, container: HTMLElement): void {
    container.appendChild(canvas);
  }

  // PostMessage communication for iframe integration
  setupIframeMessaging(callback: (data: any) => void): void {
    window.addEventListener('message', (event) => {
      callback(event.data);
    });
  }

  postMessageToParent(type: string, payload?: any): void {
    if (this.isInIframe() && window.parent) {
      window.parent.postMessage({ type, payload }, '*');
    }
  }

  // URL parameter handling
  getUrlParams(): URLSearchParams {
    return new URLSearchParams(window.location.search);
  }

  // Window event handling
  onResize(callback: () => void): void {
    window.addEventListener('resize', callback);
  }

  offResize(callback: () => void): void {
    window.removeEventListener('resize', callback);
  }
}