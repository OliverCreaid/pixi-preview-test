import {
  ProjectData,
  Scene,
  SceneInfo,
  MediaAsset,
  TextElement,
  VoiceElement,
} from "../types";

/**
 * Parses Creatomate JSON format into our internal data structures
 * Extracts media assets, text elements, and calculates scene timing
 */
export class ProjectParser {
  /**
   * Parse complete project data and extract scene information
   */
  static parseProject(projectData: ProjectData): {
    scenes: SceneInfo[];
    totalDuration: number;
  } {
    const scenes: SceneInfo[] = [];
    let currentTime = 0;

    for (let i = 0; i < projectData.scenes.length; i++) {
      const scene = projectData.scenes[i];
      const sceneInfo = this.parseScene(scene, i, currentTime);
      scenes.push(sceneInfo);
      currentTime = sceneInfo.endTime;
    }

    return {
      scenes,
      totalDuration: currentTime,
    };
  }

  /**
   * Parse individual scene and extract all elements
   */
  private static parseScene(
    scene: Scene,
    index: number,
    startTime: number,
  ): SceneInfo {
    const rawMediaAssets: unknown[] = [];
    const textElements: TextElement[] = [];
    let voiceElement: VoiceElement | undefined;
    const sceneDuration =
      scene && typeof scene.audioDuration === "number"
        ? scene.audioDuration * 1000 + 2000
        : 6000;

    // First pass: collect raw media assets and determine scene duration
    for (const element of scene.sceneTypeElements) {
      switch (element.elementType) {
        case "sceneMedia":
          // Extract media assets (images/videos)
          if (Array.isArray(element.value)) {
            for (const mediaItem of element.value) {
              rawMediaAssets.push(mediaItem);
            }
          }
          break;

        case "h1Text":
          // Extract text elements
          textElements.push({
            id: element.id,
            elementType: "h1Text",
            value: String(element.value || ""),
            properties: element.properties || {},
          });
          break;

        case "voice":
          // Extract voice/audio element and use for scene duration
          voiceElement = {
            id: element.id,
            elementType: "voice",
            value: String(element.value || ""),
            properties: element.properties || {},
          };
          break;

        // Skip other element types for MVP (shape, watermark, etc.)
        default:
          break;
      }
    }

    // Second pass: calculate sequential media timings within the scene
    const mediaAssets = this.calculateSequentialMediaTimings(
      rawMediaAssets,
      sceneDuration,
    );

    return {
      index,
      startTime,
      duration: sceneDuration,
      endTime: startTime + sceneDuration,
      mediaAssets,
      textElements,
      voiceElement,
    };
  }

  /**
   * Calculate sequential media timings within a scene
   * Divides scene duration equally among all media assets
   */
  private static calculateSequentialMediaTimings(
    rawMediaAssets: unknown[],
    sceneDuration: number,
  ): MediaAsset[] {
    if (rawMediaAssets.length === 0) {
      return [];
    }

    // Calculate duration for each media item
    const mediaItemDuration = sceneDuration / rawMediaAssets.length;

    return rawMediaAssets.map((mediaItem, index) => {
      const mediaStartTime = index * mediaItemDuration;
      const mediaEndTime = (index + 1) * mediaItemDuration;

      return {
        ...this.parseMediaAsset(mediaItem),
        startTime: mediaStartTime,
        duration: mediaItemDuration,
        endTime: mediaEndTime,
      };
    });
  }

  /**
   * Parse media asset from scene media element
   */
  private static parseMediaAsset(
    mediaItem: unknown,
  ): Omit<MediaAsset, "startTime" | "duration" | "endTime"> {
    // Type assertion with safe fallbacks
    const item = mediaItem as Record<string, unknown>;

    return {
      id: String(item.id || item.mediaId || "unknown"),
      mediaType: item.mediaType === "video" ? "video" : "image",
      src: String(item.src || ""),
      thumbnail: String(item.thumbnail || item.src || ""),
      mediaIndex: Number(item.mediaIndex) || 0,
      posX: Number(item.posX) || 50,
      posY: Number(item.posY) || 50,
      width: Number(item.width) || 100,
      height: Number(item.height) || 100,
      scale: Number(item.scale) || 100,
      rotation: Number(item.rotation) || 0,
      fit: item.fit === "contain" || item.fit === "fill" ? item.fit : "cover",
      clipLength: Number(item.clipLength) || 0,
      sceneLength: Number(item.sceneLength) || 0,
      trimStart: Number(item.trimStart) || 0,
    };
  }

  /**
   * Calculate total project duration based on all scenes
   */
  static calculateTotalDuration(scenes: SceneInfo[]): number {
    if (scenes.length === 0) return 0;
    const lastScene = scenes[scenes.length - 1];
    return lastScene.endTime;
  }

  /**
   * Find which scene should be playing at a given time
   */
  static getSceneAtTime(scenes: SceneInfo[], time: number): SceneInfo | null {
    for (const scene of scenes) {
      if (time >= scene.startTime && time < scene.endTime) {
        return scene;
      }
    }

    // If time is past the end, return the last scene
    if (scenes.length > 0 && time >= scenes[scenes.length - 1].endTime) {
      return scenes[scenes.length - 1];
    }

    return null;
  }
}
