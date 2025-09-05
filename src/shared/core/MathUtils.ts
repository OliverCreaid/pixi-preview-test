/**
 * Shared mathematical utilities for rendering calculations
 * Pure functions with no environment dependencies
 */

import { MediaAsset, KenBurnsConfig } from "../../types";

export interface AssetDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface KenBurnsTransform {
  scale: number;
  x: number;
  y: number;
}

/**
 * Calculate asset dimensions and position based on fit mode
 */
export function calculateAssetDimensions(
  originalWidth: number,
  originalHeight: number,
  asset: MediaAsset,
  canvasWidth: number,
  canvasHeight: number,
): AssetDimensions {
  // Convert percentage-based properties to pixels
  const targetWidth = (asset.width / 100) * canvasWidth;
  const targetHeight = (asset.height / 100) * canvasHeight;
  const posX = (asset.posX / 100) * canvasWidth;
  const posY = (asset.posY / 100) * canvasHeight;

  let finalWidth = targetWidth;
  let finalHeight = targetHeight;

  // Apply fit logic
  switch (asset.fit) {
    case "cover": {
      const scaleX = targetWidth / originalWidth;
      const scaleY = targetHeight / originalHeight;
      const scale = Math.max(scaleX, scaleY);
      finalWidth = originalWidth * scale;
      finalHeight = originalHeight * scale;
      break;
    }
    case "contain": {
      const containScaleX = targetWidth / originalWidth;
      const containScaleY = targetHeight / originalHeight;
      const containScale = Math.min(containScaleX, containScaleY);
      finalWidth = originalWidth * containScale;
      finalHeight = originalHeight * containScale;
      break;
    }
    case "fill":
      finalWidth = targetWidth;
      finalHeight = targetHeight;
      break;
  }

  // Apply additional scaling
  const scaleMultiplier = asset.scale / 100;
  finalWidth *= scaleMultiplier;
  finalHeight *= scaleMultiplier;

  // Calculate final position (considering anchor point)
  const x = posX - finalWidth / 2;
  const y = posY - finalHeight / 2;

  return { width: finalWidth, height: finalHeight, x, y };
}

/**
 * Calculate Ken Burns effect transform at a given time
 */
export function calculateKenBurnsTransform(
  normalizedTime: number, // 0 to 1
  config?: Partial<KenBurnsConfig>
): KenBurnsTransform {
  const defaultConfig: KenBurnsConfig = {
    enabled: true,
    zoomFrom: 1.0,
    zoomTo: 1.05,
    panFromX: 0,
    panFromY: 0,
    panToX: 0,
    panToY: 0,
    duration: 0, // Not used in this function
  };

  const kenBurns = { ...defaultConfig, ...config };

  if (!kenBurns.enabled) {
    return { scale: 1.0, x: 0, y: 0 };
  }

  // Clamp normalized time
  const t = Math.max(0, Math.min(1, normalizedTime));

  // Apply easing (ease-out)
  const eased = 1 - Math.pow(1 - t, 2);

  // Interpolate scale
  const scale = kenBurns.zoomFrom + (kenBurns.zoomTo - kenBurns.zoomFrom) * eased;

  // Interpolate pan (convert percentage to pixels would happen at render time)
  const panX = kenBurns.panFromX + (kenBurns.panToX - kenBurns.panFromX) * eased;
  const panY = kenBurns.panFromY + (kenBurns.panToY - kenBurns.panFromY) * eased;

  return { scale, x: panX, y: panY };
}

/**
 * Calculate responsive scaling to maintain aspect ratio
 */
export function calculateResponsiveScale(
  containerWidth: number,
  containerHeight: number,
  designWidth: number = 1280,
  designHeight: number = 720
): {
  scale: number;
  offsetX: number;
  offsetY: number;
  newWidth: number;
  newHeight: number;
} {
  const targetRatio = designWidth / designHeight;
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

  const scaleX = newWidth / designWidth;
  const scaleY = newHeight / designHeight;
  const scale = Math.min(scaleX, scaleY);

  // Center content if there's letterboxing
  const offsetX = (newWidth - designWidth * scale) / 2;
  const offsetY = (newHeight - designHeight * scale) / 2;

  return { scale, offsetX, offsetY, newWidth, newHeight };
}

/**
 * Interpolate between two values with easing
 */
export function interpolate(
  from: number,
  to: number,
  progress: number,
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear'
): number {
  // Clamp progress
  const t = Math.max(0, Math.min(1, progress));
  
  let easedT = t;
  
  switch (easing) {
    case 'ease-in':
      easedT = t * t;
      break;
    case 'ease-out':
      easedT = 1 - Math.pow(1 - t, 2);
      break;
    case 'ease-in-out':
      easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      break;
    case 'linear':
    default:
      easedT = t;
      break;
  }
  
  return from + (to - from) * easedT;
}

/**
 * Convert time from milliseconds to various formats
 */
export const TimeUtils = {
  msToSeconds: (ms: number): number => ms / 1000,
  secondsToMs: (seconds: number): number => seconds * 1000,
  msToFrames: (ms: number, frameRate: number): number => Math.floor((ms / 1000) * frameRate),
  framesToMs: (frames: number, frameRate: number): number => (frames / frameRate) * 1000,
  formatTime: (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

/**
 * Color utilities
 */
export const ColorUtils = {
  hexToRgb: (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },
  
  rgbToHex: (r: number, g: number, b: number): string => {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  },
  
  normalizeColor: (color: string | number): number => {
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
      if (color.startsWith('#')) {
        return parseInt(color.slice(1), 16);
      }
      return parseInt(color, 16);
    }
    return 0x000000; // Default to black
  }
};