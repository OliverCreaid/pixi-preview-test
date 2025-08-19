/**
 * Simple loading progress indicator for asset preloading
 * Shows progress bar and status messages during startup
 */
export class LoadingProgress {
  private container: HTMLElement;
  // private progressBar!: HTMLElement; // Currently unused
  private progressFill!: HTMLElement;
  private statusText!: HTMLElement;
  private percentText!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.createLoadingUI();
  }

  /**
   * Create the loading UI elements
   */
  private createLoadingUI(): void {
    this.container.innerHTML = `
      <div class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <h3 class="loading-title">Loading Video Preview</h3>
          <p class="loading-status">Preparing assets...</p>
          <div class="loading-progress-container">
            <div class="loading-progress-bar">
              <div class="loading-progress-fill"></div>
            </div>
            <span class="loading-percentage">0%</span>
          </div>
        </div>
      </div>
    `;

    // Get references to elements
    // this.progressBar = this.container.querySelector(".loading-progress-bar")!; // Currently unused
    this.progressFill = this.container.querySelector(".loading-progress-fill")!;
    this.statusText = this.container.querySelector(".loading-status")!;
    this.percentText = this.container.querySelector(".loading-percentage")!;

    // Add CSS styles
    this.addLoadingStyles();
  }

  /**
   * Add CSS styles for the loading screen
   */
  private addLoadingStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Arial', sans-serif;
      }

      .loading-content {
        text-align: center;
        color: white;
        max-width: 400px;
        padding: 40px;
      }

      .loading-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid #333;
        border-top: 4px solid #007acc;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 30px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-title {
        font-size: 24px;
        font-weight: bold;
        margin: 0 0 10px 0;
        color: #ffffff;
      }

      .loading-status {
        font-size: 16px;
        color: #cccccc;
        margin: 0 0 30px 0;
      }

      .loading-progress-container {
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .loading-progress-bar {
        flex: 1;
        height: 8px;
        background: #333;
        border-radius: 4px;
        overflow: hidden;
      }

      .loading-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #007acc 0%, #0099ff 100%);
        border-radius: 4px;
        width: 0%;
        transition: width 0.3s ease;
      }

      .loading-percentage {
        font-size: 14px;
        font-weight: bold;
        color: #007acc;
        min-width: 40px;
      }

      .loading-fade-out {
        opacity: 0;
        transition: opacity 0.5s ease;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update loading progress
   */
  updateProgress(progress: number, loaded: number, total: number): void {
    const percentage = Math.round(progress);

    // Update progress bar
    this.progressFill.style.width = `${percentage}%`;

    // Update percentage text
    this.percentText.textContent = `${percentage}%`;

    // Update status text
    if (percentage < 100) {
      this.statusText.textContent = `Loading assets... (${loaded}/${total})`;
    } else {
      this.statusText.textContent = "Loading complete!";
    }
  }

  /**
   * Set custom status message
   */
  setStatus(message: string): void {
    this.statusText.textContent = message;
  }

  /**
   * Hide loading screen with fade out
   */
  hide(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = this.container.querySelector(
        ".loading-overlay",
      ) as HTMLElement;
      overlay.classList.add("loading-fade-out");

      setTimeout(() => {
        this.container.innerHTML = "";
        resolve();
      }, 500);
    });
  }

  /**
   * Show error state
   */
  showError(message: string): void {
    this.statusText.textContent = `Error: ${message}`;
    this.statusText.style.color = "#ff4444";

    // Hide spinner
    const spinner = this.container.querySelector(
      ".loading-spinner",
    ) as HTMLElement;
    if (spinner) {
      spinner.style.display = "none";
    }
  }

  /**
   * Show success state
   */
  showSuccess(): void {
    this.setStatus("Ready to play!");
    this.updateProgress(100, 0, 0);

    // Change spinner to checkmark
    const spinner = this.container.querySelector(
      ".loading-spinner",
    ) as HTMLElement;
    if (spinner) {
      spinner.innerHTML = "✓";
      spinner.style.border = "none";
      spinner.style.fontSize = "30px";
      spinner.style.color = "#00aa44";
      spinner.style.animation = "none";
      spinner.style.display = "flex";
      spinner.style.alignItems = "center";
      spinner.style.justifyContent = "center";
    }
  }
}
