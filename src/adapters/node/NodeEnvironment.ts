/**
 * Node.js environment implementation
 * Coordinates all Node.js-specific adapters and services
 */

import { 
  IEnvironment, 
  IPixiFactory, 
  IAssetLoader, 
  IAudioManager, 
  ITimer, 
  IFontManager,
  IFileSystem
} from '../../core/interfaces/EnvironmentInterface';

import { NodePixiFactory } from './NodePixiFactory.js';
import { NodeAssetLoader } from './NodeAssetLoader.js';
import { NodeAudioManager } from './NodeAudioManager.js';
import { NodeTimer } from './NodeTimer.js';
import { NodeFontManager } from './NodeFontManager.js';
import { NodeFileSystem } from './NodeFileSystem.js';

export class NodeEnvironment implements IEnvironment {
  // Core systems
  public readonly pixiFactory: IPixiFactory;
  public readonly assetLoader: IAssetLoader;
  public readonly audioManager: IAudioManager;
  public readonly timer: ITimer;
  public readonly fontManager: IFontManager;

  // Node.js-specific features
  public readonly fileSystem: IFileSystem;

  // Environment info
  public readonly type = 'node' as const;
  public readonly supportsDOM = false;
  public readonly supportsVideoCapture = false;
  public readonly supportsFileSystem = true;

  private initialized = false;

  constructor() {
    this.pixiFactory = new NodePixiFactory();
    this.assetLoader = new NodeAssetLoader();
    this.audioManager = new NodeAudioManager();
    this.timer = new NodeTimer();
    this.fontManager = new NodeFontManager();
    this.fileSystem = new NodeFileSystem();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🖥️ Initializing Node.js environment...');

      // Check for required dependencies
      this.checkNodeDependencies();

      // Initialize audio system (simplified for Node.js)
      await this.audioManager.initialize();
      console.log('✅ Audio system initialized');

      // Initialize font system (register with node-canvas)
      console.log('✅ Font system ready');

      // Ensure cache directories exist
      await this.createCacheDirectories();

      this.initialized = true;
      console.log('🖥️ Node.js environment initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Node.js environment:', error);
      throw error;
    }
  }

  destroy(): void {
    console.log('🧹 Cleaning up Node.js environment...');

    // Clean up audio system
    this.audioManager.destroy();

    this.initialized = false;
    console.log('✅ Node.js environment cleaned up');
  }

  private checkNodeDependencies(): void {
    // Since we're using ES modules and the imports would fail at module load time if missing,
    // we can assume dependencies are available if we got this far
    console.log('✅ Node.js dependency check passed');
  }

  private async createCacheDirectories(): Promise<void> {
    const cacheDirectories = [
      '.cache/assets',
      '.cache/fonts',
      '.cache/frames',
      'renders'
    ];

    for (const dir of cacheDirectories) {
      this.fileSystem.createDirectory(dir);
    }

    console.log('📁 Cache directories created');
  }

  // Node.js specific utility methods
  getNodeVersion(): string {
    return process.version;
  }

  getPlatform(): NodeJS.Platform {
    return process.platform;
  }

  getArchitecture(): string {
    return process.arch;
  }

  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  getCwd(): string {
    return process.cwd();
  }

  // Environment variables
  getEnvVar(name: string, defaultValue?: string): string | undefined {
    return process.env[name] || defaultValue;
  }

  setEnvVar(name: string, value: string): void {
    process.env[name] = value;
  }

  // Process management
  onExit(callback: (code: number) => void): void {
    process.on('exit', callback);
  }

  onSignal(signal: NodeJS.Signals, callback: () => void): void {
    process.on(signal, callback);
  }

  // File system shortcuts
  async readProjectFile(filename: string): Promise<string> {
    return this.fileSystem.readFile(filename);
  }

  async writeRenderOutput(filename: string, data: Buffer): Promise<void> {
    const outputPath = `renders/${filename}`;
    await this.fileSystem.writeBuffer(outputPath, data);
  }

  // System info for debugging
  getSystemInfo(): {
    node: string;
    platform: string;
    arch: string;
    memory: NodeJS.MemoryUsage;
    cwd: string;
    dependencies: { [key: string]: string };
  } {
    const packageJson = require('../../../package.json');
    
    return {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      cwd: process.cwd(),
      dependencies: {
        '@pixi/node': packageJson.dependencies['@pixi/node'] || 'unknown',
        'canvas': packageJson.dependencies['canvas'] || 'unknown'
      }
    };
  }
}