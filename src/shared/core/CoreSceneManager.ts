/**
 * Core scene manager using environment abstractions
 * Manages scenes, transitions, and rendering across environments
 */

import { 
  ISceneManager, 
  IScene, 
  IMediaRenderer, 
  ITextRenderer, 
  IAudioRenderer 
} from '../../core/interfaces/CoreInterface';
import { 
  IEnvironment, 
  IContainer, 
  IPixiApp 
} from '../../core/interfaces/EnvironmentInterface';
import { VoiceElement, TransitionConfig } from '../../types';
import { TransitionStateCalculator, getDefaultTransitionConfig } from './TransitionUtils.js';

export class CoreSceneManager implements ISceneManager {
  private environment: IEnvironment | null = null;
  private pixiApp: IPixiApp | null = null;
  private mainContainer: IContainer | null = null;
  private scenesContainer: IContainer | null = null;
  private uiLayer: IContainer | null = null;
  
  private scenes = new Map<number, IScene>();
  private transitionCalculator: TransitionStateCalculator;
  private activeSceneIndex: number = -1;
  private animationId: number | null = null;

  constructor(transitionConfig?: Partial<TransitionConfig>) {
    const config = { ...getDefaultTransitionConfig(), ...transitionConfig };
    this.transitionCalculator = new TransitionStateCalculator(config);
  }

  async initialize(environment: IEnvironment, pixiApp?: IPixiApp): Promise<void> {
    this.environment = environment;
    this.pixiApp = pixiApp || null; // Use the app passed from CoreApplication or null
    
    // Create main container hierarchy
    this.mainContainer = environment.pixiFactory.createContainer();
    this.scenesContainer = environment.pixiFactory.createContainer();
    this.uiLayer = environment.pixiFactory.createContainer();
    
    // Set up layer hierarchy
    this.mainContainer.addChild(this.scenesContainer);
    this.mainContainer.addChild(this.uiLayer);
    
    // Add to PixiJS stage if app is available
    if (this.pixiApp) {
      this.pixiApp.stage.addChild(this.mainContainer);
    }
    
    // Set labels for debugging
    this.mainContainer.label = 'MainContainer';
    this.scenesContainer.label = 'ScenesContainer';
    this.uiLayer.label = 'UILayer';

    console.log('✅ Core scene manager initialized');
  }

  createScene(sceneIndex: number, voiceElement?: VoiceElement): IScene {
    if (!this.environment) {
      throw new Error('Scene manager not initialized');
    }

    // Create main scene container
    const sceneContainer = this.environment.pixiFactory.createContainer();
    sceneContainer.label = `Scene_${sceneIndex}`;
    sceneContainer.visible = false;
    sceneContainer.alpha = 0;

    // Create media and text layers
    const mediaLayer = this.environment.pixiFactory.createContainer();
    const textLayer = this.environment.pixiFactory.createContainer();
    mediaLayer.label = `MediaLayer_${sceneIndex}`;
    textLayer.label = `TextLayer_${sceneIndex}`;

    // Add layers to scene container
    sceneContainer.addChild(mediaLayer);
    sceneContainer.addChild(textLayer);

    // Add to scenes container
    this.scenesContainer!.addChild(sceneContainer);

    // Create renderers
    const mediaRenderer = new CoreMediaRenderer(mediaLayer, this.environment);
    const textRenderer = new CoreTextRenderer(textLayer, this.environment);
    
    // Create audio renderer if needed (placeholder for now)
    let audioRenderer: IAudioRenderer | undefined;
    if (voiceElement) {
      // TODO: Create CoreAudioRenderer when we add audio support
      console.log(`🎵 Audio renderer would be created for scene ${sceneIndex}`);
    }

    // Create scene object
    const scene: IScene = {
      index: sceneIndex,
      container: sceneContainer,
      mediaRenderer,
      textRenderer,
      audioRenderer,
      isActive: false,
      alpha: 0
    };

    // Store scene
    this.scenes.set(sceneIndex, scene);

    console.log(`🎬 Created scene ${sceneIndex}${voiceElement ? ' with audio' : ''}`);
    return scene;
  }

  getScene(sceneIndex: number): IScene | null {
    return this.scenes.get(sceneIndex) || null;
  }

  switchToScene(newSceneIndex: number, currentSceneIndex?: number, forceInstant: boolean = false): void {
    // Ensure scene exists
    let targetScene = this.scenes.get(newSceneIndex);
    if (!targetScene) {
      targetScene = this.createScene(newSceneIndex);
    }

    // Handle transitions
    if (currentSceneIndex !== undefined && 
        currentSceneIndex !== newSceneIndex && 
        !forceInstant &&
        !this.transitionCalculator.isTransitioning()) {
      
      // Start transition
      this.transitionCalculator.startTransition(currentSceneIndex, newSceneIndex);
      this.startTransitionLoop();
      
      console.log(`🔄 Starting transition: ${currentSceneIndex} → ${newSceneIndex}`);
    } else {
      // Instant switch
      this.setActiveScene(newSceneIndex, forceInstant);
    }

    this.activeSceneIndex = newSceneIndex;
  }

  updateTransitions(): void {
    if (!this.transitionCalculator.isTransitioning()) {
      return;
    }

    const state = this.transitionCalculator.updateTransition();
    if (!state) return;

    const alphas = this.transitionCalculator.calculateAlphaValues();

    // Update scene alphas based on transition
    const fromScene = this.scenes.get(state.fromSceneIndex);
    const toScene = this.scenes.get(state.toSceneIndex);

    if (fromScene) {
      fromScene.alpha = alphas.fromAlpha;
      fromScene.container.alpha = alphas.fromAlpha;
      fromScene.isActive = alphas.fromAlpha > 0;
      fromScene.container.visible = fromScene.isActive;
    }

    if (toScene) {
      toScene.alpha = alphas.toAlpha;
      toScene.container.alpha = alphas.toAlpha;
      toScene.isActive = alphas.toAlpha > 0;
      toScene.container.visible = toScene.isActive;
    }

    // Complete transition when done
    if (!state.isTransitioning) {
      this.completeTransition(state.toSceneIndex);
    }
  }

  isTransitioning(): boolean {
    return this.transitionCalculator.isTransitioning();
  }

  getActiveScene(): IScene | null {
    if (this.activeSceneIndex >= 0) {
      return this.scenes.get(this.activeSceneIndex) || null;
    }
    return null;
  }

  resize(width: number, height: number): void {
    if (!this.pixiApp || !this.mainContainer) return;

    // Calculate responsive scaling
    const targetRatio = 16 / 9; // 1280x720 design
    const containerRatio = width / height;

    let newWidth: number;
    let newHeight: number;

    if (containerRatio > targetRatio) {
      newHeight = height;
      newWidth = newHeight * targetRatio;
    } else {
      newWidth = width;
      newHeight = newWidth / targetRatio;
    }

    // Resize PixiJS app
    this.pixiApp.resize(newWidth, newHeight);

    // Scale content
    const designWidth = 1280;
    const designHeight = 720;
    const scaleX = newWidth / designWidth;
    const scaleY = newHeight / designHeight;
    const scale = Math.min(scaleX, scaleY);

    this.mainContainer.scale.set(scale);

    // Center content
    this.mainContainer.x = (newWidth - designWidth * scale) / 2;
    this.mainContainer.y = (newHeight - designHeight * scale) / 2;

    console.log(`🔄 Resized to ${newWidth}x${newHeight}, scale: ${scale.toFixed(3)}`);
  }

  destroy(): void {
    console.log('🧹 Destroying core scene manager...');

    // Stop transition loop
    if (this.animationId && this.environment) {
      this.environment.timer.cancelFrame(this.animationId);
    }

    // Destroy all scenes
    for (const scene of this.scenes.values()) {
      scene.mediaRenderer.destroy();
      scene.textRenderer.destroy();
      scene.audioRenderer?.destroy();
    }
    this.scenes.clear();

    // Clean up containers
    this.mainContainer = null;
    this.scenesContainer = null;
    this.uiLayer = null;
    this.pixiApp = null;
    this.environment = null;

    console.log('✅ Core scene manager destroyed');
  }

  // Private methods
  private setActiveScene(sceneIndex: number, instant: boolean = false): void {
    // Hide all scenes
    for (const [index, scene] of this.scenes) {
      const isTarget = index === sceneIndex;
      scene.isActive = isTarget;
      scene.alpha = isTarget ? 1.0 : 0.0;
      scene.container.alpha = scene.alpha;
      scene.container.visible = isTarget;
    }
  }

  private startTransitionLoop(): void {
    if (!this.environment || this.animationId) return;

    const loop = () => {
      this.updateTransitions();
      
      if (this.transitionCalculator.isTransitioning()) {
        this.animationId = this.environment!.timer.requestFrame(loop);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = this.environment.timer.requestFrame(loop);
  }

  private completeTransition(toSceneIndex: number): void {
    console.log(`✅ Transition complete to scene ${toSceneIndex}`);
    
    // Ensure final state is correct
    this.setActiveScene(toSceneIndex);
  }
}

// Remove CoreScene interface - just use IScene directly

// Media renderer implementation
class CoreMediaRenderer implements IMediaRenderer {
  private currentSprite: any = null;
  private currentAssetId: string | null = null;
  private preloadedTextures = new Map<string, any>();
  
  // Ken Burns effect configuration
  private kenBurnsConfig = {
    enabled: true,
    zoomFrom: 1.0,
    zoomTo: 1.05,
    panFromX: 0,
    panFromY: 0,
    panToX: 0,
    panToY: 0,
    duration: 0
  };
  private basePosition = { x: 0, y: 0 };

  constructor(private container: IContainer, private environment: IEnvironment) {}

  async displayMedia(assets: any[], sceneRelativeTime: number): Promise<void> {
    if (assets.length === 0) return;

    // Find which media asset should be playing at current time
    const activeAsset = this.getActiveMediaAsset(assets, sceneRelativeTime);
    
    if (activeAsset && this.currentAssetId !== activeAsset.id) {
      this.switchToAsset(activeAsset);
    }
  }

  updateKenBurns(assetRelativeTime: number): void {
    if (!this.kenBurnsConfig.enabled || !this.currentSprite || this.kenBurnsConfig.duration <= 0) {
      return;
    }

    // Calculate progress (0 to 1) based on asset relative time
    const progress = Math.min(assetRelativeTime / this.kenBurnsConfig.duration, 1);
    this.applyKenBurnsTransform(progress);
  }

  clearCurrentMedia(): void {
    this.container.removeChildren();
    this.currentSprite = null;
    this.currentAssetId = null;
  }

  setPreloadedTextures(textures: Map<string, any>): void {
    this.preloadedTextures = textures;
    console.log(`📦 MediaRenderer received ${textures.size} preloaded textures`);
  }

  destroy(): void {
    this.clearCurrentMedia();
  }

  // Private helper methods
  private getActiveMediaAsset(assets: any[], sceneRelativeTime: number): any {
    if (assets.length === 1) {
      return assets[0]; // Single asset - always active
    }

    // Multiple assets - find which one should be playing
    let cumulativeTime = 0;
    for (const asset of assets) {
      if (sceneRelativeTime >= cumulativeTime && sceneRelativeTime < cumulativeTime + asset.duration) {
        return asset;
      }
      cumulativeTime += asset.duration;
    }

    // Return last asset if time exceeds total duration
    return assets[assets.length - 1];
  }

  private switchToAsset(asset: any): void {
    // Try to get preloaded texture
    let texture = this.preloadedTextures.get(asset.id) || this.preloadedTextures.get(asset.src);
    
    if (!texture) {
      console.warn(`⚠️ No preloaded texture found for asset: ${asset.id}`);
      return;
    }

    // Remove current sprite
    if (this.currentSprite) {
      this.container.removeChild(this.currentSprite);
    }

    // Create new sprite from texture
    const sprite = this.environment.pixiFactory.createSprite(texture);
    console.log(`🎨 Created sprite with texture: ${texture.width}x${texture.height}, has image: ${!!(texture as any).image}`);
    
    // Position sprite (center on 1280x720 canvas)
    this.positionSprite(sprite, asset);
    console.log(`📍 Positioned sprite at (${sprite.x}, ${sprite.y}) anchor (${sprite.anchor.x}, ${sprite.anchor.y})`);
    
    // Add to container
    this.container.addChild(sprite);
    this.currentSprite = sprite;
    this.currentAssetId = asset.id;

    console.log(`📦 Container now has ${this.container.children.length} children`);

    // Initialize Ken Burns
    this.initializeKenBurns(asset);
    
    console.log(`🖼️ Switched to media asset: ${asset.id}`);
  }

  private positionSprite(sprite: any, asset: any): void {
    const canvasWidth = 1280;
    const canvasHeight = 720;
    
    // Scale to fit canvas while maintaining aspect ratio
    const textureWidth = sprite.texture.width || 100;
    const textureHeight = sprite.texture.height || 100;
    
    const scaleX = canvasWidth / textureWidth;
    const scaleY = canvasHeight / textureHeight;
    const scale = Math.min(scaleX, scaleY);
    
    sprite.scale.set(scale);
    
    // Center on canvas
    sprite.anchor.set(0.5);
    sprite.x = canvasWidth / 2;
    sprite.y = canvasHeight / 2;
  }

  private initializeKenBurns(asset: any): void {
    if (!this.kenBurnsConfig.enabled || !this.currentSprite) return;

    this.kenBurnsConfig.duration = asset.duration;
    this.basePosition.x = this.currentSprite.x;
    this.basePosition.y = this.currentSprite.y;
    
    // Start Ken Burns at 0% progress
    this.applyKenBurnsTransform(0);
  }

  private applyKenBurnsTransform(progress: number): void {
    if (!this.currentSprite) return;

    // Apply zoom effect
    const currentZoom = this.kenBurnsConfig.zoomFrom + 
      (this.kenBurnsConfig.zoomTo - this.kenBurnsConfig.zoomFrom) * progress;
    
    this.currentSprite.scale.set(this.currentSprite.scale.x * currentZoom);
    
    // Apply pan effect (if configured)
    const panX = this.kenBurnsConfig.panFromX + 
      (this.kenBurnsConfig.panToX - this.kenBurnsConfig.panFromX) * progress;
    const panY = this.kenBurnsConfig.panFromY + 
      (this.kenBurnsConfig.panToY - this.kenBurnsConfig.panFromY) * progress;
    
    this.currentSprite.x = this.basePosition.x + panX;
    this.currentSprite.y = this.basePosition.y + panY;
  }
}

// Text renderer implementation
class CoreTextRenderer implements ITextRenderer {
  private currentTexts = new Map<number, any>();
  private projectFonts: any = null;

  constructor(private container: IContainer, private environment: IEnvironment) {}

  displayTexts(textElements: any[]): void {
    // Clear existing texts
    this.clearCurrentTexts();
    
    if (textElements.length === 0) return;

    // Text element display - logging removed for performance
    
    // Create and display each text element
    for (let i = 0; i < textElements.length; i++) {
      this.displayText(textElements[i], i);
    }
  }

  clearCurrentTexts(): void {
    this.container.removeChildren();
    this.currentTexts.clear();
  }

  setProjectFonts(fonts: any): void {
    this.projectFonts = fonts;
    console.log('📚 Set project fonts for text rendering');
  }

  destroy(): void {
    this.clearCurrentTexts();
  }

  // Private helper methods
  private displayText(textElement: any, index: number): void {
    if (!textElement.value || textElement.value.trim() === '') {
      return; // Skip empty text
    }

    // Get font configuration
    const fontConfig = this.getFontConfigForElement(textElement);
    
    // Create text style - use bright colors for debugging
    const style = {
      fontSize: fontConfig.fontSize || 64,
      fill: fontConfig.color || '#ff0000', // Bright red for visibility
      fontFamily: fontConfig.fontFamily || 'Arial',
      wordWrap: false,
      align: 'center'
    };

    // Create text object
    const textObj = this.environment.pixiFactory.createText(textElement.value, style);
    
    // Position text based on element config or default
    this.positionText(textObj, textElement, index);
    
    // Add to container and track
    this.container.addChild(textObj);
    this.currentTexts.set(index, textObj);
    
    // Text positioning - logging removed for performance
  }

  private getFontConfigForElement(textElement: any): any {
    // Try to get font from project fonts based on element type
    if (this.projectFonts && textElement.type) {
      const fontDef = this.projectFonts[textElement.type];
      if (fontDef) {
        return {
          fontFamily: fontDef.family || 'Arial',
          fontSize: this.parseFontSize(fontDef.size) || 48,
          color: fontDef.color || '#ffffff'
        };
      }
    }

    // Fallback configuration
    return {
      fontFamily: 'Arial',
      fontSize: 48,
      color: '#ffffff'
    };
  }

  private parseFontSize(sizeStr: string): number {
    if (!sizeStr) return 48;
    
    // Parse "32px" -> 32
    const match = sizeStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 48;
  }

  private positionText(textObj: any, textElement: any, index: number): void {
    const canvasWidth = 1280;
    const canvasHeight = 720;
    
    // Use element position if available, otherwise calculate defaults
    if (textElement.x !== undefined && textElement.y !== undefined) {
      textObj.x = textElement.x;
      textObj.y = textElement.y;
    } else {
      // Default positioning - stack text elements vertically
      textObj.x = canvasWidth / 2; // Center horizontally
      textObj.y = 100 + (index * 80); // Stack vertically with spacing
    }
    
    // Set anchor for proper positioning
    textObj.anchor?.set(0.5, 0.5);
  }
}