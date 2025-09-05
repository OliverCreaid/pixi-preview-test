// Container imported via SceneContainer interface
import { TransitionConfig, TransitionState, SceneContainer } from '../types';

/**
 * Manages smooth scene transitions with configurable fade effects
 * Supports cross-fade, fade-to-black, and various easing functions
 */
export class TransitionManager {
    private config: TransitionConfig;
    private currentTransition: TransitionState | null = null;
    private sceneContainers: Map<number, SceneContainer> = new Map();

    constructor(config?: Partial<TransitionConfig>) {
        this.config = {
            enabled: true,
            type: 'crossfade',
            duration: 500, // 500ms default transition
            easing: 'ease-out',
            ...config,
        };
    }

    /**
     * Register a scene container for transition management
     */
    registerSceneContainer(sceneContainer: SceneContainer): void {
        this.sceneContainers.set(sceneContainer.index, sceneContainer);
        //console.log(`📋 Registered scene container ${sceneContainer.index}`);
    }

    /**
     * Start a transition from one scene to another
     */
    startTransition(fromSceneIndex: number, toSceneIndex: number): void {
        if (!this.config.enabled) {
            // If transitions disabled, just switch instantly
            this.instantSwitch(fromSceneIndex, toSceneIndex);
            return;
        }

        // Don't start transition if already transitioning to the same scene
        if (this.currentTransition && this.currentTransition.toSceneIndex === toSceneIndex) {
            return;
        }

        this.currentTransition = {
            isTransitioning: true,
            fromSceneIndex,
            toSceneIndex,
            startTime: performance.now(),
            duration: this.config.duration,
            progress: 0,
        };

        //console.log(
        //   `🎬 Starting ${this.config.type} transition: Scene ${fromSceneIndex} → Scene ${toSceneIndex} (${this.config.duration}ms)`,
        // );

        // Initialize transition state
        this.setupTransitionContainers(fromSceneIndex, toSceneIndex);
    }

    /**
     * Update transition animation (call every frame)
     */
    updateTransition(): boolean {
        if (!this.currentTransition) {
            return false;
        }

        const currentTime = performance.now();
        const elapsed = currentTime - this.currentTransition.startTime;
        const rawProgress = Math.min(elapsed / this.currentTransition.duration, 1);

        // Apply easing function
        this.currentTransition.progress = this.applyEasing(rawProgress, this.config.easing);

        // Update container alphas based on transition type
        this.updateContainerAlphas(this.currentTransition.progress);

        // Check if transition is complete
        if (rawProgress >= 1) {
            this.completeTransition();
            return false; // Transition finished
        }

        return true; // Transition still in progress
    }

    /**
     * Setup containers for transition start
     */
    private setupTransitionContainers(fromSceneIndex: number, toSceneIndex: number): void {
        const fromContainer = this.sceneContainers.get(fromSceneIndex);
        const toContainer = this.sceneContainers.get(toSceneIndex);

        if (fromContainer) {
            fromContainer.isActive = false;
            fromContainer.alpha = 1.0; // Start fully visible
            fromContainer.container.alpha = 1.0;
        }

        if (toContainer) {
            toContainer.isActive = true;
            toContainer.alpha = 0.0; // Start invisible
            toContainer.container.alpha = 0.0;
            toContainer.container.visible = true; // Make sure it's visible for transition
        }
    }

    /**
     * Update container alphas based on transition progress and type
     */
    private updateContainerAlphas(progress: number): void {
        if (!this.currentTransition) return;

        const fromContainer = this.sceneContainers.get(this.currentTransition.fromSceneIndex);
        const toContainer = this.sceneContainers.get(this.currentTransition.toSceneIndex);

        switch (this.config.type) {
            case 'crossfade':
                // Old scene fades out, new scene fades in simultaneously
                if (fromContainer) {
                    fromContainer.alpha = 1.0 - progress;
                    fromContainer.container.alpha = fromContainer.alpha;
                }
                if (toContainer) {
                    toContainer.alpha = progress;
                    toContainer.container.alpha = toContainer.alpha;
                }
                break;

            case 'fade-to-black':
                // Fade out first half, fade in second half
                if (progress < 0.5) {
                    // First half: fade out old scene
                    const fadeOutProgress = progress * 2; // 0 to 1 over first half
                    if (fromContainer) {
                        fromContainer.alpha = 1.0 - fadeOutProgress;
                        fromContainer.container.alpha = fromContainer.alpha;
                    }
                    if (toContainer) {
                        toContainer.alpha = 0.0;
                        toContainer.container.alpha = 0.0;
                    }
                } else {
                    // Second half: fade in new scene
                    const fadeInProgress = (progress - 0.5) * 2; // 0 to 1 over second half
                    if (fromContainer) {
                        fromContainer.alpha = 0.0;
                        fromContainer.container.alpha = 0.0;
                    }
                    if (toContainer) {
                        toContainer.alpha = fadeInProgress;
                        toContainer.container.alpha = toContainer.alpha;
                    }
                }
                break;

            case 'none':
            default:
                // Instant switch
                if (fromContainer) {
                    fromContainer.alpha = 0.0;
                    fromContainer.container.alpha = 0.0;
                }
                if (toContainer) {
                    toContainer.alpha = 1.0;
                    toContainer.container.alpha = 1.0;
                }
                break;
        }
    }

    /**
     * Complete the current transition
     */
    private completeTransition(): void {
        if (!this.currentTransition) return;

        const fromContainer = this.sceneContainers.get(this.currentTransition.fromSceneIndex);
        const toContainer = this.sceneContainers.get(this.currentTransition.toSceneIndex);

        // Finalize container states
        if (fromContainer) {
            fromContainer.isActive = false;
            fromContainer.alpha = 0.0;
            fromContainer.container.alpha = 0.0;
            fromContainer.container.visible = false; // Hide inactive scenes
        }

        if (toContainer) {
            toContainer.isActive = true;
            toContainer.alpha = 1.0;
            toContainer.container.alpha = 1.0;
            toContainer.container.visible = true;
        }

        //console.log(
        //   `✅ Transition completed: Scene ${this.currentTransition.fromSceneIndex} → Scene ${this.currentTransition.toSceneIndex}`,
        // );

        this.currentTransition = null;
    }

    /**
     * Instant switch without transition (for scrubbing or when transitions disabled)
     */
    private instantSwitch(fromSceneIndex: number, toSceneIndex: number): void {
        // Hide all scenes first
        for (const [index, sceneContainer] of this.sceneContainers) {
            sceneContainer.isActive = index === toSceneIndex;
            sceneContainer.alpha = index === toSceneIndex ? 1.0 : 0.0;
            sceneContainer.container.alpha = sceneContainer.alpha;
            sceneContainer.container.visible = sceneContainer.isActive;
        }

        //console.log(
        //   `⚡ Instant switch: Scene ${fromSceneIndex} → Scene ${toSceneIndex}`,
        // );
    }

    /**
     * Apply easing function to transition progress
     */
    private applyEasing(progress: number, easing: TransitionConfig['easing']): number {
        switch (easing) {
            case 'linear':
                return progress;

            case 'ease-in':
                return progress * progress;

            case 'ease-out':
                return 1 - Math.pow(1 - progress, 2);

            case 'ease-in-out':
                return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            default:
                return progress;
        }
    }

    /**
     * Check if currently transitioning
     */
    isTransitioning(): boolean {
        return this.currentTransition !== null;
    }

    /**
     * Get current transition state
     */
    getCurrentTransition(): TransitionState | null {
        return this.currentTransition;
    }

    /**
     * Update transition configuration
     */
    updateConfig(newConfig: Partial<TransitionConfig>): void {
        this.config = { ...this.config, ...newConfig };
        //console.log("🔧 Transition config updated:", this.config);
    }

    /**
     * Force complete current transition (useful for scrubbing)
     */
    forceCompleteTransition(): void {
        if (this.currentTransition) {
            this.currentTransition.progress = 1.0;
            this.updateContainerAlphas(1.0);
            this.completeTransition();
        }
    }

    /**
     * Get active scene container
     */
    getActiveSceneContainer(): SceneContainer | null {
        for (const sceneContainer of this.sceneContainers.values()) {
            if (sceneContainer.isActive) {
                return sceneContainer;
            }
        }
        return null;
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.currentTransition = null;
        this.sceneContainers.clear();
        //console.log("🗑️ TransitionManager destroyed");
    }
}
