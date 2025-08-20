import { Sprite, Container } from "pixi.js";
import { MediaAsset, KenBurnsConfig } from "../types";

/**
 * Handles loading and rendering of media assets (images and videos)
 * Manages asset caching and positioning based on scene requirements
 */
export class MediaRenderer {
  private container: Container;
  private currentSprite: Sprite | null = null;
  private currentAssetId: string | null = null; // Track current active asset ID
  private globalPreloadedSprites: Map<string, Sprite> = new Map(); // Global preloaded sprites

  // Ken Burns effect
  private kenBurnsConfig: KenBurnsConfig = {
    enabled: true,
    zoomFrom: 1.0,
    zoomTo: 1.05,
    panFromX: 0,
    panFromY: 0,
    panToX: 0,
    panToY: 0,
    duration: 0, // Will be set to asset duration
  };
  // private kenBurnsStartTime: number = 0; // Currently unused
  private basePosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Set preloaded sprites from ProjectPreloader
   */
  setPreloadedSprites(sprites: Map<string, Sprite>): void {
    this.globalPreloadedSprites = sprites;
    //console.log(`📦 MediaRenderer loaded ${sprites.size} preloaded sprites`);
  }

  /**
   * Load and display media assets for a scene
   * Preloads all assets for smooth switching
   */
  async displayMedia(
    assets: MediaAsset[],
    sceneRelativeTime: number = 0
  ): Promise<void> {
    // Find which media asset should be playing at the current scene time
    const activeAsset = this.getActiveMediaAsset(assets, sceneRelativeTime);

    if (activeAsset) {
      // Only switch if the asset has actually changed
      if (this.currentAssetId !== activeAsset.id) {
        this.switchToAssetInstant(activeAsset);
      }
    }
  }

  /**
   * Switch to display a specific asset instantly (using preloaded sprites)
   */
  private switchToAssetInstant(activeAsset: MediaAsset): void {
    //console.log(`🔄 Switching to asset: ${activeAsset.id}`);

    const newSprite = this.globalPreloadedSprites.get(activeAsset.id);

    if (!newSprite) {
      console.warn(
        `⚠️  Preloaded sprite not found for asset: ${activeAsset.id}`
      );
      //console.log(`🔍 Looking for alternatives in preloaded sprites...`);
      for (const [key] of this.globalPreloadedSprites) {
        //console.log(`  - Available: ${key}`);
      }
      return;
    }

    if (newSprite === this.currentSprite) {
      return; // Already active
    }

    // Remove current sprite if any
    if (this.currentSprite) {
      this.container.removeChild(this.currentSprite);
    }

    // Add new sprite (instant since it's preloaded)
    this.container.addChild(newSprite);
    this.currentSprite = newSprite;
    this.currentAssetId = activeAsset.id; // Track current asset ID

    // Initialize Ken Burns effect for this asset
    this.initializeKenBurns(activeAsset);
  }

  /**
   * Initialize Ken Burns effect for an asset
   */
  private initializeKenBurns(asset: MediaAsset): void {
    if (!this.kenBurnsConfig.enabled || !this.currentSprite) {
      return;
    }

    // Set Ken Burns duration to match asset duration
    this.kenBurnsConfig.duration = asset.duration;
    // this.kenBurnsStartTime = performance.now(); // Currently not used

    // Store base position (after normal positioning)
    this.basePosition.x = this.currentSprite.x;
    this.basePosition.y = this.currentSprite.y;

    // Reset sprite to initial Ken Burns state
    this.applyKenBurnsTransform(0); // Start at 0% progress
  }

  /**
   * Update Ken Burns effect based on current time
   */
  updateKenBurns(assetRelativeTime: number): void {
    if (
      !this.kenBurnsConfig.enabled ||
      !this.currentSprite ||
      this.kenBurnsConfig.duration <= 0
    ) {
      return;
    }

    // Calculate progress (0 to 1) based on asset relative time
    const progress = Math.min(
      assetRelativeTime / this.kenBurnsConfig.duration,
      1
    );
    this.applyKenBurnsTransform(progress);
  }

  /**
   * Apply Ken Burns transform based on progress (0 to 1)
   */
  private applyKenBurnsTransform(progress: number): void {
    if (!this.currentSprite) return;

    const config = this.kenBurnsConfig;

    // Interpolate scale
    const currentScale =
      config.zoomFrom + (config.zoomTo - config.zoomFrom) * progress;

    // Interpolate pan position
    const currentPanX =
      config.panFromX + (config.panToX - config.panFromX) * progress;
    const currentPanY =
      config.panFromY + (config.panToY - config.panFromY) * progress;

    // Apply transforms
    this.currentSprite.scale.set(currentScale);

    // Convert pan percentages to pixel offsets (relative to image size)
    const imageWidth = this.currentSprite.width;
    const imageHeight = this.currentSprite.height;
    const panOffsetX = (currentPanX / 100) * imageWidth * 0.1; // Scale down the pan effect
    const panOffsetY = (currentPanY / 100) * imageHeight * 0.1;

    // Apply position from base position plus pan offset
    this.currentSprite.x = this.basePosition.x + panOffsetX;
    this.currentSprite.y = this.basePosition.y + panOffsetY;
  }

  /**
   * Determine which media asset should be active at a given time within the scene
   */
  private getActiveMediaAsset(
    assets: MediaAsset[],
    sceneRelativeTime: number
  ): MediaAsset | null {
    for (const asset of assets) {
      if (
        sceneRelativeTime >= asset.startTime &&
        sceneRelativeTime < asset.endTime
      ) {
        return asset;
      }
    }

    // If no asset is found and we have assets, return the last one if time is past the end
    if (assets.length > 0) {
      const lastAsset = assets[assets.length - 1];
      if (sceneRelativeTime >= lastAsset.endTime) {
        return lastAsset;
      }
    }

    return null;
  }

  // Note: applyAssetTransform method removed as it's unused
  // Asset transforms are now applied in ProjectPreloader during preloading

  // Note: calculateAssetDimensions method removed - asset transforms are handled in ProjectPreloader

  /**
   * Clear all currently displayed media
   */
  clearCurrentMedia(): void {
    this.container.removeChildren();
    this.currentSprite = null;
    this.currentAssetId = null; // Reset asset tracking
  }

  /**
   * Destroy all resources
   */
  destroy(): void {
    this.clearCurrentMedia();
    // Note: Preloaded sprites are managed by ProjectPreloader
  }
}
