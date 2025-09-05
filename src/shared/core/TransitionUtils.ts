/**
 * Shared transition calculation utilities
 * Pure logic for transition animations - no environment dependencies
 */

import { TransitionConfig, TransitionState } from "../../types";
import { interpolate } from "./MathUtils.js";

/**
 * Calculate transition alpha values for crossfade
 */
export function calculateCrossfadeAlpha(
  progress: number,
  fromAlpha: number = 1.0,
  toAlpha: number = 1.0
): { fromAlpha: number; toAlpha: number } {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  
  return {
    fromAlpha: interpolate(fromAlpha, 0, clampedProgress, 'ease-out'),
    toAlpha: interpolate(0, toAlpha, clampedProgress, 'ease-in')
  };
}

/**
 * Calculate fade-to-black transition alpha values
 */
export function calculateFadeToBlackAlpha(
  progress: number,
  fromAlpha: number = 1.0,
  toAlpha: number = 1.0
): { fromAlpha: number; toAlpha: number; blackAlpha: number } {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const halfPoint = 0.5;
  
  if (clampedProgress <= halfPoint) {
    // First half: fade out from scene
    const fadeOutProgress = clampedProgress / halfPoint;
    return {
      fromAlpha: interpolate(fromAlpha, 0, fadeOutProgress, 'ease-out'),
      toAlpha: 0,
      blackAlpha: interpolate(0, 1, fadeOutProgress, 'ease-out')
    };
  } else {
    // Second half: fade in to scene
    const fadeInProgress = (clampedProgress - halfPoint) / halfPoint;
    return {
      fromAlpha: 0,
      toAlpha: interpolate(0, toAlpha, fadeInProgress, 'ease-in'),
      blackAlpha: interpolate(1, 0, fadeInProgress, 'ease-in')
    };
  }
}

/**
 * Create a transition state tracker
 */
export class TransitionStateCalculator {
  private config: TransitionConfig;
  private state: TransitionState | null = null;
  private startTime: number = 0;

  constructor(config: TransitionConfig) {
    this.config = config;
  }

  /**
   * Start a new transition
   */
  startTransition(
    fromSceneIndex: number,
    toSceneIndex: number,
    currentTime?: number
  ): void {
    this.startTime = currentTime ?? Date.now();
    this.state = {
      isTransitioning: true,
      fromSceneIndex,
      toSceneIndex,
      startTime: this.startTime,
      duration: this.config.duration,
      progress: 0
    };
  }

  /**
   * Update transition progress based on current time
   */
  updateTransition(currentTime?: number): TransitionState | null {
    if (!this.state || !this.state.isTransitioning) {
      return this.state;
    }

    const now = currentTime ?? Date.now();
    const elapsed = now - this.startTime;
    const progress = Math.min(elapsed / this.config.duration, 1);

    this.state = {
      ...this.state,
      progress
    };

    // Complete transition when progress reaches 1
    if (progress >= 1) {
      this.completeTransition();
    }

    return this.state;
  }

  /**
   * Force complete the current transition
   */
  forceCompleteTransition(): void {
    if (this.state && this.state.isTransitioning) {
      this.state = {
        ...this.state,
        progress: 1
      };
      this.completeTransition();
    }
  }

  /**
   * Complete the transition
   */
  private completeTransition(): void {
    if (this.state) {
      this.state = {
        ...this.state,
        isTransitioning: false,
        progress: 1
      };
    }
  }

  /**
   * Get current transition state
   */
  getState(): TransitionState | null {
    return this.state;
  }

  /**
   * Check if currently transitioning
   */
  isTransitioning(): boolean {
    return this.state?.isTransitioning ?? false;
  }

  /**
   * Reset the transition state
   */
  reset(): void {
    this.state = null;
    this.startTime = 0;
  }

  /**
   * Calculate alpha values for current transition
   */
  calculateAlphaValues(): { fromAlpha: number; toAlpha: number; blackAlpha?: number } {
    if (!this.state || !this.state.isTransitioning) {
      return { fromAlpha: 1, toAlpha: 1 };
    }

    switch (this.config.type) {
      case 'crossfade':
        return calculateCrossfadeAlpha(this.state.progress);
      
      case 'fade-to-black': {
        const result = calculateFadeToBlackAlpha(this.state.progress);
        return {
          fromAlpha: result.fromAlpha,
          toAlpha: result.toAlpha,
          blackAlpha: result.blackAlpha
        };
      }
      
      case 'none':
      default:
        return { fromAlpha: 0, toAlpha: 1 };
    }
  }
}

/**
 * Get default transition configuration
 */
export function getDefaultTransitionConfig(): TransitionConfig {
  return {
    enabled: true,
    type: 'crossfade',
    duration: 500,
    easing: 'ease-out'
  };
}