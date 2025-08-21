/**
 * Basic timeline scrubber component for video preview control
 * Provides play/pause and seek functionality
 */
export class Timeline {
  private container: HTMLElement;
  private progressBar!: HTMLElement;
  private progressFill!: HTMLElement;
  private playButton!: HTMLElement;
  private renderButton!: HTMLElement;
  private timeDisplay!: HTMLElement;

  private totalDuration: number = 0;
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private isDragging: boolean = false;

  // Callbacks
  private onPlayPause?: (isPlaying: boolean) => void;
  private onSeek?: (time: number) => void;
  private onScrubbing?: (isScrubbing: boolean) => void;
  private onRender?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.createTimelineUI();
    this.attachEventListeners();
  }

  /**
   * Create the timeline UI elements
   */
  private createTimelineUI(): void {
    this.container.innerHTML = `
      <div class="timeline-container">
        <button class="timeline-play-button" aria-label="Play/Pause">
          <span class="play-icon">▶</span>
        </button>
        <div class="timeline-progress-container">
          <div class="timeline-progress-bar">
            <div class="timeline-progress-fill"></div>
          </div>
        </div>
        <div class="timeline-time-display">
          <span class="current-time">00:00</span> / <span class="total-time">00:00</span>
        </div>
        <button class="timeline-render-button" aria-label="Export Video">
          🎬 Export Video
        </button>
      </div>
    `;

    // Get references to elements
    this.playButton = this.container.querySelector(".timeline-play-button")!;
    this.renderButton = this.container.querySelector(
      ".timeline-render-button",
    )!;
    this.progressBar = this.container.querySelector(".timeline-progress-bar")!;
    this.progressFill = this.container.querySelector(
      ".timeline-progress-fill",
    )!;
    this.timeDisplay = this.container.querySelector(".timeline-time-display")!;

    // Add CSS styles
    this.addTimelineStyles();
  }

  /**
   * Add CSS styles for the timeline
   */
  private addTimelineStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .timeline-container {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: #1a1a1a;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        color: white;
        user-select: none;
      }

      .timeline-play-button {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: #007acc;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: background-color 0.2s;
      }

      .timeline-play-button:hover {
        background: #0099ff;
      }

      .timeline-play-button:disabled {
        background: #666;
        cursor: not-allowed;
      }

      .timeline-progress-container {
        flex: 1;
        height: 20px;
        display: flex;
        align-items: center;
      }

      .timeline-progress-bar {
        width: 100%;
        height: 6px;
        background: #333;
        border-radius: 3px;
        cursor: pointer;
        position: relative;
        transition: height 0.2s;
      }

      .timeline-progress-bar:hover {
        height: 8px;
      }

      .timeline-progress-fill {
        height: 100%;
        background: #007acc;
        border-radius: 3px;
        width: 0%;
        pointer-events: none;
      }

      .timeline-time-display {
        font-size: 12px;
        color: #ccc;
        min-width: 80px;
        text-align: right;
      }

      .current-time {
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Play/pause button
    this.playButton.addEventListener("click", () => {
      this.togglePlayPause();
    });

    // Render button
    this.renderButton.addEventListener("click", () => {
      if (this.onRender) {
        this.onRender();
      }
    });

    // Progress bar clicking and dragging
    this.progressBar.addEventListener("mousedown", (e) => {
      this.isDragging = true;

      // Notify that scrubbing started
      if (this.onScrubbing) {
        this.onScrubbing(true);
      }

      this.handleProgressBarInteraction(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.handleProgressBarInteraction(e);
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;

        // Notify that scrubbing ended
        if (this.onScrubbing) {
          this.onScrubbing(false);
        }
      }
    });

    // Prevent context menu on progress bar
    this.progressBar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  /**
   * Handle clicking and dragging on progress bar
   */
  private handleProgressBarInteraction(event: MouseEvent): void {
    const rect = this.progressBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * this.totalDuration;

    this.seek(time);
  }

  /**
   * Toggle play/pause state
   */
  private togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();

    if (this.onPlayPause) {
      this.onPlayPause(this.isPlaying);
    }
  }

  /**
   * Seek to specific time
   */
  private seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
    this.updateProgress();

    if (this.onSeek) {
      this.onSeek(this.currentTime);
    }
  }

  /**
   * Update play button appearance
   */
  private updatePlayButton(): void {
    const icon = this.playButton.querySelector(".play-icon")!;
    icon.textContent = this.isPlaying ? "⏸" : "▶";
    this.playButton.setAttribute(
      "aria-label",
      this.isPlaying ? "Pause" : "Play",
    );
  }

  /**
   * Update progress bar and time display
   */
  private updateProgress(): void {
    const percentage =
      this.totalDuration > 0
        ? (this.currentTime / this.totalDuration) * 100
        : 0;
    this.progressFill.style.width = `${percentage}%`;

    const currentTimeText = this.formatTime(this.currentTime);
    const totalTimeText = this.formatTime(this.totalDuration);

    this.timeDisplay.innerHTML = `
      <span class="current-time">${currentTimeText}</span> / <span class="total-time">${totalTimeText}</span>
    `;
  }

  /**
   * Format time in MM:SS format
   */
  private formatTime(timeMs: number): string {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Set total duration
   */
  setTotalDuration(duration: number): void {
    this.totalDuration = duration;
    this.updateProgress();
  }

  /**
   * Set current time (called from external playback system)
   */
  setCurrentTime(time: number): void {
    this.currentTime = time;
    this.updateProgress();
  }

  /**
   * Set play state (called from external playback system)
   */
  setPlayState(isPlaying: boolean): void {
    this.isPlaying = isPlaying;
    this.updatePlayButton();
  }

  /**
   * Enable or disable timeline controls
   */
  setEnabled(enabled: boolean): void {
    const playButton = this.playButton as HTMLButtonElement;
    playButton.disabled = !enabled;

    if (enabled) {
      this.progressBar.style.pointerEvents = "auto";
    } else {
      this.progressBar.style.pointerEvents = "none";
    }
  }

  /**
   * Set callback for play/pause events
   */
  onPlayPauseCallback(callback: (isPlaying: boolean) => void): void {
    this.onPlayPause = callback;
  }

  /**
   * Set callback for seek events
   */
  onSeekCallback(callback: (time: number) => void): void {
    this.onSeek = callback;
  }

  /**
   * Set callback for scrubbing events (dragging timeline)
   */
  onScrubbingCallback(callback: (isScrubbing: boolean) => void): void {
    this.onScrubbing = callback;
  }

  /**
   * Set callback for render events
   */
  onRenderCallback(callback: () => void): void {
    this.onRender = callback;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.container.innerHTML = "";
  }
}
