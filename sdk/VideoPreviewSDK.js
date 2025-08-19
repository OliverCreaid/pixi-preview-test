/**
 * Video Preview SDK
 * 
 * Embeds the PixiJS video preview in an iframe with postMessage communication
 * Usage:
 *   const preview = new VideoPreviewSDK({ container: '#my-container' });
 *   preview.loadProject(projectData);
 */
class VideoPreviewSDK {
  constructor(options) {
    if (!options.container) {
      throw new Error('VideoPreviewSDK: container option is required');
    }

    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;

    if (!this.container) {
      throw new Error('VideoPreviewSDK: container element not found');
    }

    this.iframe = null;
    this.isReady = false;
    this.messageHandlers = new Map();

    // Bind message handler to maintain context
    this.handleMessage = this.handleMessage.bind(this);

    console.log('📦 VideoPreviewSDK initialized');

    // Initialize iframe immediately
    this.createIframe();
  }

  /**
   * Create and setup the iframe
   */
  createIframe() {
    // Create iframe element
    this.iframe = document.createElement('iframe');

    // Configure iframe
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.style.display = 'block';

    // Set aspect ratio container styles
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.aspectRatio = '16 / 9'; // Fixed landscape aspect ratio
    this.container.style.backgroundColor = '#1099bb'; // Match app background

    // Get the base URL for the iframe source
    // This will work whether we're in dev or production
    const baseUrl = this.getBaseUrl();
    this.iframe.src = `${baseUrl}/iframe.html`;

    console.log('🖼️ Iframe source URL:', this.iframe.src);

    // Setup message listener
    window.addEventListener('message', this.handleMessage);

    // Add load event listeners for debugging
    this.iframe.addEventListener('load', () => {
      console.log('✅ Iframe loaded successfully');
    });

    this.iframe.addEventListener('error', (error) => {
      console.error('❌ Iframe failed to load:', error);
    });

    // Append to container
    this.container.appendChild(this.iframe);

    console.log('🖼️ Iframe created and mounted');
  }

  /**
   * Get the base URL for iframe source
   */
  getBaseUrl() {
    // For staging and production builds, always use GitHub Pages
    return 'https://olivercreaid.github.io/pixi-preview-test/dist-sdk/staging/v1.0.0/';
  }

  /**
   * Handle messages from iframe
   */
  handleMessage(event) {
    console.log('📨 Received message:', event.data, 'from:', event.origin);

    // Security check - ensure message is from our iframe
    if (event.source !== this.iframe.contentWindow) {
      console.log('🚫 Message not from our iframe, ignoring');
      return;
    }

    const { type, payload } = event.data;
    console.log('📋 Processing message type:', type, 'payload:', payload);

    switch (type) {
      case 'READY':
        this.isReady = true;
        console.log('✅ Video preview iframe is ready');

        // Trigger the custom handler if registered
        const readyHandler = this.messageHandlers.get('READY');
        if (readyHandler) {
          console.log('🎯 Calling READY handler');
          readyHandler(payload);
        } else {
          console.log('⚠️ No READY handler registered');
        }
        break;

      case 'ERROR':
        console.error('❌ Video preview error:', payload);

        const errorHandler = this.messageHandlers.get('ERROR');
        if (errorHandler) {
          errorHandler(payload);
        }
        break;

      default:
        // Handle any custom message types in the future
        const handler = this.messageHandlers.get(type);
        if (handler) {
          console.log(`🎯 Calling ${type} handler`);
          handler(payload);
        } else {
          console.log(`⚠️ No handler for message type: ${type}`);
        }
    }
  }

  /**
   * Load project data into the preview
   */
  loadProject(projectData) {
    if (!projectData) {
      console.error('VideoPreviewSDK: projectData is required');
      return;
    }

    if (!this.iframe || !this.iframe.contentWindow) {
      console.error('VideoPreviewSDK: iframe not ready');
      return;
    }

    console.log('📤 Sending project data to iframe...');

    // Send project data to iframe
    this.iframe.contentWindow.postMessage({
      type: 'LOAD_PROJECT',
      payload: projectData
    }, '*');
  }

  /**
   * Add custom message handler
   */
  onMessage(type, handler) {
    console.log(`🔧 Registering handler for message type: ${type}`);
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove message handler
   */
  offMessage(type) {
    this.messageHandlers.delete(type);
  }

  /**
   * Destroy the SDK instance and clean up
   */
  destroy() {
    console.log('🗑️ Destroying VideoPreviewSDK');

    // Remove message listener
    window.removeEventListener('message', this.handleMessage);

    // Remove iframe
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }

    // Clear references
    this.iframe = null;
    this.container = null;
    this.messageHandlers.clear();
    this.isReady = false;
  }

  /**
   * Check if the SDK is ready to receive commands
   */
  getIsReady() {
    return this.isReady;
  }
}

// Export for both module systems and global usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoPreviewSDK;
} else {
  window.VideoPreviewSDK = VideoPreviewSDK;
}