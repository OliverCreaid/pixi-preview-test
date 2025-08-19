import { Application, Container } from "pixi.js";
import { TransitionManager } from "./TransitionManager";
import { MediaRenderer } from "./MediaRenderer";
import { TextRenderer } from "./TextRenderer";
import { AudioRenderer } from "./AudioRenderer";
import { SceneContainer, TransitionConfig, VoiceElement } from "../types";

/**
 * Enhanced SceneManager with multi-container support for smooth scene transitions
 * Manages PixiJS application, scene containers, and transition animations
 */
export class SceneManager {
  private app: Application;
  private mainContainer: Container;
  private scenesContainer: Container; // Container for all scene containers
  private uiLayer: Container;
  private transitionManager: TransitionManager;
  private sceneContainers: Map<number, SceneContainer> = new Map();

  // Legacy layer references for backward compatibility
  private mediaLayer: Container; // Points to active scene's media layer
  private textLayer: Container; // Points to active scene's text layer

  constructor(transitionConfig?: Partial<TransitionConfig>) {
    this.app = new Application();
    this.mainContainer = new Container();
    this.scenesContainer = new Container();
    this.uiLayer = new Container();
    this.transitionManager = new TransitionManager(transitionConfig);

    // Initialize legacy layers (will point to active scene)
    this.mediaLayer = new Container();
    this.textLayer = new Container();

    this.setupLayers();
  }

  async initialize(): Promise<void> {
    // Initialize PixiJS application with fixed 16:9 aspect ratio
    await this.app.init({
      width: 1280,
      height: 720,
      backgroundColor: "#000000",
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Setup layer hierarchy
    this.app.stage.addChild(this.mainContainer);
    this.setupLayers();
  }

  private setupLayers(): void {
    // Clear and rebuild layer hierarchy
    this.mainContainer.removeChildren();

    // Add layers in order (bottom to top)
    this.mainContainer.addChild(this.scenesContainer); // All scene containers
    this.mainContainer.addChild(this.uiLayer); // UI elements (future use)

    // Set layer names for debugging
    this.scenesContainer.label = "ScenesContainer";
    this.uiLayer.label = "UILayer";
  }

  /**
   * Get the PixiJS application instance
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get the main canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /**
   * Get the media layer for adding background content
   */
  getMediaLayer(): Container {
    return this.mediaLayer;
  }

  /**
   * Get the text layer for adding text overlays
   */
  getTextLayer(): Container {
    return this.textLayer;
  }

  /**
   * Get the UI layer for controls and interface elements
   */
  getUILayer(): Container {
    return this.uiLayer;
  }

  /**
   * Create a new scene container with its own media, text, and optional audio layers
   */
  createSceneContainer(
    sceneIndex: number,
    voiceElement?: VoiceElement,
  ): SceneContainer {
    // Create main container for this scene
    const sceneContainer = new Container();
    sceneContainer.label = `Scene_${sceneIndex}`;
    sceneContainer.visible = false; // Start hidden
    sceneContainer.alpha = 0;

    // Create media and text layers for this scene
    const mediaLayer = new Container();
    const textLayer = new Container();
    mediaLayer.label = `MediaLayer_${sceneIndex}`;
    textLayer.label = `TextLayer_${sceneIndex}`;

    // Add layers to scene container (media behind text)
    sceneContainer.addChild(mediaLayer);
    sceneContainer.addChild(textLayer);

    // Add scene container to main scenes container
    this.scenesContainer.addChild(sceneContainer);

    // Create renderers for this scene
    const mediaRenderer = new MediaRenderer(mediaLayer);
    const textRenderer = new TextRenderer(textLayer);

    // Create audio renderer if scene has voice element
    let audioRenderer: AudioRenderer | undefined;
    if (voiceElement) {
      audioRenderer = new AudioRenderer();
      console.log(
        `🎵 Created AudioRenderer for scene ${sceneIndex} with voice: ${voiceElement.value}`,
      );
    }

    // Create scene container object
    const sceneContainerObj: SceneContainer = {
      index: sceneIndex,
      container: sceneContainer,
      mediaRenderer,
      textRenderer,
      audioRenderer,
      isActive: false,
      alpha: 0,
    };

    // Store and register with transition manager
    this.sceneContainers.set(sceneIndex, sceneContainerObj);
    this.transitionManager.registerSceneContainer(sceneContainerObj);

    console.log(
      `🎬 Created scene container ${sceneIndex}${voiceElement ? " with audio" : ""}`,
    );
    return sceneContainerObj;
  }

  /**
   * Get or create scene container
   */
  getSceneContainer(
    sceneIndex: number,
    voiceElement?: VoiceElement,
  ): SceneContainer {
    let sceneContainer = this.sceneContainers.get(sceneIndex);
    if (!sceneContainer) {
      sceneContainer = this.createSceneContainer(sceneIndex, voiceElement);
    }
    return sceneContainer;
  }

  /**
   * Switch to a specific scene with optional transition
   */
  switchToScene(
    newSceneIndex: number,
    currentSceneIndex?: number,
    forceInstant: boolean = false,
  ): void {
    // Ensure scene container exists
    this.getSceneContainer(newSceneIndex);

    // Update legacy layer references to point to new active scene
    const newSceneContainer = this.sceneContainers.get(newSceneIndex);
    if (newSceneContainer) {
      this.mediaLayer = newSceneContainer.container.children[0] as Container;
      this.textLayer = newSceneContainer.container.children[1] as Container;
    }

    // Start transition if we have a current scene and transitions are enabled
    if (
      currentSceneIndex !== undefined &&
      currentSceneIndex !== newSceneIndex &&
      !forceInstant
    ) {
      this.transitionManager.startTransition(currentSceneIndex, newSceneIndex);
    } else {
      // Instant switch - hide all scenes except the target
      for (const [index, sceneContainer] of this.sceneContainers) {
        const isActive = index === newSceneIndex;
        sceneContainer.isActive = isActive;
        sceneContainer.alpha = isActive ? 1.0 : 0.0;
        sceneContainer.container.alpha = sceneContainer.alpha;
        sceneContainer.container.visible = isActive;
      }
    }
  }

  /**
   * Update transition animations (call every frame)
   */
  updateTransitions(): void {
    this.transitionManager.updateTransition();
  }

  /**
   * Check if currently transitioning
   */
  isTransitioning(): boolean {
    return this.transitionManager.isTransitioning();
  }

  /**
   * Get the transition manager for advanced control
   */
  getTransitionManager(): TransitionManager {
    return this.transitionManager;
  }

  /**
   * Clear all content from all scenes
   */
  clearScene(): void {
    // Clear all scene containers
    for (const sceneContainer of this.sceneContainers.values()) {
      sceneContainer.container.removeChildren();
    }
    this.uiLayer.removeChildren();
  }

  /**
   * Clear content from a specific scene (preserves layer structure)
   */
  clearSceneContent(sceneIndex: number): void {
    const sceneContainer = this.sceneContainers.get(sceneIndex);
    if (sceneContainer) {
      // Clear the renderers' content instead of removing the layer containers
      sceneContainer.mediaRenderer.clearCurrentMedia();
      sceneContainer.textRenderer.clearCurrentTexts();

      // Stop any audio playback
      if (sceneContainer.audioRenderer) {
        sceneContainer.audioRenderer.pausePlayback();
      }
    }
  }

  /**
   * Resize the application to fit container while maintaining aspect ratio
   */
  resize(containerWidth: number, containerHeight: number): void {
    const targetRatio = 16 / 9;
    const containerRatio = containerWidth / containerHeight;

    let newWidth: number;
    let newHeight: number;

    if (containerRatio > targetRatio) {
      // Container is wider than target ratio
      newHeight = containerHeight;
      newWidth = newHeight * targetRatio;
    } else {
      // Container is taller than target ratio
      newWidth = containerWidth;
      newHeight = newWidth / targetRatio;
    }

    // Resize the renderer
    this.app.renderer.resize(newWidth, newHeight);

    // Calculate scale factor based on the design size (1280x720)
    const designWidth = 1280;
    const designHeight = 720;
    const scaleX = newWidth / designWidth;
    const scaleY = newHeight / designHeight;

    // Use the smaller scale to maintain aspect ratio
    const scale = Math.min(scaleX, scaleY);

    // Scale the main container to fit the new size
    this.mainContainer.scale.set(scale);

    // Center the content if there's letterboxing
    this.mainContainer.x = (newWidth - designWidth * scale) / 2;
    this.mainContainer.y = (newHeight - designHeight * scale) / 2;

    console.log(
      `🔄 Resized canvas to ${newWidth}x${newHeight}, content scale: ${scale.toFixed(3)}`,
    );
  }

  /**
   * Get active scene container
   */
  getActiveSceneContainer(): SceneContainer | null {
    return this.transitionManager.getActiveSceneContainer();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearScene();
    this.transitionManager.destroy();

    // Clean up scene containers
    for (const sceneContainer of this.sceneContainers.values()) {
      sceneContainer.mediaRenderer.destroy();
      sceneContainer.textRenderer.destroy();
      if (sceneContainer.audioRenderer) {
        sceneContainer.audioRenderer.destroy();
      }
    }
    this.sceneContainers.clear();

    this.app.destroy(true, { children: true, texture: true });
  }
}
