# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a video preview/renderer SDK for an online video editing tool, specifically designed for creating real estate advertisements. Built with PixiJS, Vite, and TypeScript, this application provides both standalone preview functionality and an embeddable SDK for integration into other web applications.

**Primary Goals:**
- MVP video preview functionality for real estate ads  
- Server-side video rendering and MP4 export
- Embeddable SDK for integration into PHP/Vanilla JS applications
- Support for images, videos, and text overlays
- Fade transitions between media elements
- Timeline-based sequence management
- Iframe-based embedding with postMessage communication

## Development Commands

### Development
- `npm start` or `npm run dev` - Start development server on port 8080 with auto-open  
- `npm run lint` - Run ESLint to check code quality
- `npm run dev:server` - Start render server on port 3002 for video export

### Building
- `npm run build` - Build standalone application
- `npm run build:sdk:staging` - Build SDK for staging (with source maps)
- `npm run build:sdk:prod` - Build SDK for production (minified)
- `npm run build:sdk:all` - Build SDK for both staging and production

### Server-Side Rendering
- `npm run server` - Run compiled render server (after building)
- `npm run dev:server` - Compile and run render server for development

## Project Architecture

### Core Technologies
- **PixiJS 8.8.1** - Main graphics rendering library
- **Vite 6.2.0** - Build tool and dev server
- **TypeScript 5.7.3** - Type-safe JavaScript
- **Express 4.18.0** - Server framework for render API
- **Puppeteer 21.11.0** - Headless browser for server-side rendering
- **ESLint + Prettier** - Code linting and formatting

### Project Structure
```
src/
  main.ts                    - Entry point with PixiJS application setup
  core/                      - Core rendering and management classes
    SceneManager.ts         - Scene container and transition management
    ProjectParser.ts        - Creatomate JSON parsing
    MediaRenderer.ts        - Image/video rendering with Ken Burns
    TextRenderer.ts         - Text overlay rendering
    WebAudioManager.ts      - Web Audio API context management
    WebAudioRenderer.ts     - Voice-over audio using Web Audio API
    WebAudioMusicManager.ts - Background music using Web Audio API
    TransitionManager.ts    - Scene transition animations
    ProjectPreloader.ts     - Asset preloading system
  components/
    Timeline.ts             - Interactive timeline controls with export button
    LoadingProgress.ts      - Loading screen component
  server/                   - Server-side rendering system
    render-server.ts        - Express API server for video rendering
    VideoRenderer.ts        - Puppeteer-based headless rendering
    types.ts               - Server-specific TypeScript types
  types.ts                  - TypeScript type definitions
sdk/
  VideoPreviewSDK.js        - SDK wrapper for iframe embedding
public/
  assets/                   - Static assets (bunny.png, logo.svg)
  style.css                 - Global styles
  favicon.png               - Site favicon
index.html                  - Standalone HTML entry point
iframe.html                 - SDK iframe content
test-integration.html       - SDK integration test page
dist-sdk/                   - Built SDK files for deployment
dist/                       - Compiled server code
renders/                    - Server-generated video files
tsconfig.server.json        - TypeScript config for server compilation
```

### Application Flow
The main application (`src/main.ts`) supports standalone, iframe, and render modes:

**Standalone Mode:**
1. Loads test project data from `/test-project.json`
2. Creates PixiJS Application with responsive scaling
3. Parses project data and preloads all assets
4. Renders scenes with media, text, and audio
5. Provides interactive timeline controls with export button

**Iframe/SDK Mode:**
1. Detects iframe context automatically
2. Sets up postMessage communication with parent
3. Waits for project data from parent window
4. Renders preview identically to standalone mode
5. Scales responsively to iframe container

**Server-Side Render Mode:**
1. Detects `?render=true` URL parameter 
2. Sets up headless rendering environment
3. Receives project data via postMessage from Puppeteer
4. Auto-plays timeline while MediaRecorder captures output
5. Combines canvas stream + Web Audio for synchronized A/V recording

### Configuration Details
- **Vite Config**: Development server on port 8080 with auto-open
- **Render Server**: Express server on port 3002 for video export API
- **TypeScript**: ES2020 target, strict mode enabled, bundler module resolution
- **Server TypeScript**: Separate config (tsconfig.server.json) with ES modules for Node.js
- **ESLint**: Uses recommended configs for JS/TS with Prettier integration
- **Build Process**: Linting → TypeScript compilation → Vite bundling

## Key Features Implemented

### Core Rendering & Media
- **Scene-based Video Preview**: Real estate ads rendered with PixiJS at 1280x720 (16:9)
- **Sequential Media Playback**: Multiple images per scene play sequentially (dividing scene duration)
- **Ken Burns Effect**: Subtle zoom/pan animations on images (1.0x to 1.05x scale)
- **Global Asset Preloading**: Eliminates loading flicker with batched preloading and progress tracking
- **Smooth Scene Transitions**: Cross-fade transitions between scenes (500ms default, configurable)
- **Multi-Container Architecture**: Each scene has its own PixiJS container for seamless transitions

### Audio System (Web Audio API)
- **Advanced Audio Management**: Complete Web Audio API implementation replacing PIXI Sound
- **Tab Switching Resilience**: Audio continues playing seamlessly when switching tabs/windows
- **Background Music with Looping**: Supports trimStart, volume control, and seamless looping
- **Voice Over Integration**: Scene-based voice audio with precise timing synchronization
- **Audio Ducking**: Background music automatically ducks down when voice plays (gradual fade)
- **Timeline Synchronization**: Audio stays in sync with video timeline during scrubbing
- **Pause/Resume Support**: Proper pause/resume functionality even with trimStart offsets
- **Loop Point Management**: Handles complex looping scenarios with start offsets correctly

### User Interface & Controls
- **Interactive Timeline**: Play/pause/seek controls with smooth scrubbing
- **Export Button**: "🎬 Export Video" button for server-side rendering
- **Render Progress**: Real-time progress tracking and status updates
- **Responsive Scaling**: Content scales proportionally to any container size

### Server-Side Video Rendering
- **Express API Server**: RESTful endpoints for render job management
- **Puppeteer Integration**: Headless Chrome automation for consistent rendering
- **MediaRecorder Capture**: Browser-native video recording with audio sync
- **Job Queue System**: Asynchronous rendering with progress tracking
- **WebM Output**: High-quality 1280x720 30fps video export
- **File Download**: Automatic download links for completed renders

### SDK & Integration
- **Embeddable SDK**: VideoPreviewSDK class for iframe-based integration
- **PostMessage Communication**: Secure parent-iframe messaging for project data
- **Dual Build System**: Separate builds for development/staging and production

## Development Notes

### Technical Implementation Details
- The project uses module-based imports (`type: "module"` in package.json)
- Assets are served from the `public/` directory
- The application automatically resizes with the window
- PixiJS devtools are included for debugging (`@pixi/devtools`)
- **Transition System**: Uses hardware-accelerated alpha blending for smooth fades
- **Smart Scrubbing**: Transitions complete instantly during timeline seeking

### Audio Architecture Details
- **Web Audio API Migration**: Completely replaced PIXI Sound with Web Audio API for better control
- **Tab Switching Fix**: Audio context resumption handles browser autoplay policies and tab changes
- **Loop Point Fix**: Explicit loopStart/loopEnd settings prevent premature source ending with start offsets  
- **Timeline Sync Fix**: TrimStart properly accounted for in drift calculation and sync logic
- **Volume Mapping**: JSON volume values (0-100) correctly normalized to Web Audio API range (0.0-1.0)
- **Gradual Ducking**: Background music fades gradually (1.5s down, 2s up) when voice starts/stops

### Server-Side Rendering Architecture
- **Dual-Process System**: Client preview + dedicated render server
- **Headless Automation**: Puppeteer controls Chrome for consistent rendering
- **Stream Capture**: MediaRecorder API captures canvas video + Web Audio streams
- **Job Management**: In-memory job queue with unique IDs and status tracking
- **API Endpoints**: `/api/render`, `/api/render/:jobId/status`, `/api/render/:jobId/download`
- **Error Handling**: Comprehensive error reporting and timeout management

### Development Workflow
- you don't have to run "npm run dev" I already have it running when we are working
- you don't need to do any git operations
- For video rendering, start both: `npm run dev` (port 8080) + `npm run dev:server` (port 3002)

## Server-Side Rendering API

### Render Endpoints

**Start Render Job:**
```http
POST http://localhost:3002/api/render
Content-Type: application/json

{
  "projectData": { /* Creatomate JSON project data */ },
  "outputFormat": "webm",  // Optional, defaults to "webm"
  "quality": "medium"      // Optional: "low"|"medium"|"high"
}

Response: {
  "jobId": "uuid-string",
  "status": "queued",
  "message": "Render job created successfully"
}
```

**Check Render Status:**
```http
GET http://localhost:3002/api/render/{jobId}/status

Response: {
  "jobId": "uuid-string",
  "status": "processing|completed|failed",
  "progress": 0-100,
  "error": "error message if failed",
  "createdAt": "ISO timestamp",
  "completedAt": "ISO timestamp"
}
```

**Download Completed Render:**
```http
GET http://localhost:3002/api/render/{jobId}/download

Response: Video file download (WebM format)
```

### Usage Example

```javascript
// Start render job
const response = await fetch('http://localhost:3002/api/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectData })
});
const { jobId } = await response.json();

// Poll for completion
const checkStatus = async () => {
  const status = await fetch(`http://localhost:3002/api/render/${jobId}/status`);
  const result = await status.json();
  
  if (result.status === 'completed') {
    window.open(`http://localhost:3002/api/render/${jobId}/download`, '_blank');
  } else if (result.status === 'failed') {
    console.error('Render failed:', result.error);
  } else {
    setTimeout(checkStatus, 2000); // Check again in 2 seconds
  }
};
checkStatus();
```

## SDK Integration

### VideoPreviewSDK Class
The project includes a complete SDK for embedding the video preview in other applications:

```javascript
// Initialize SDK
const preview = new VideoPreviewSDK({
  container: '#preview-container'  // Required: DOM selector or element
});

// Load project data (Creatomate JSON format)
preview.loadProject(projectData);

// Cleanup when done  
preview.destroy();
```

### Integration Example (PHP)
```html
<!-- In your PHP application -->
<div id="preview-container" style="width: 800px;"></div>

<script src="https://yourdomain.com/video-preview-sdk/staging/v1.0.0/video-preview-sdk.js"></script>
<script>
const preview = new VideoPreviewSDK({
  container: '#preview-container'
});

// Project data from your PHP backend
const projectData = <?php echo json_encode($projectData); ?>;
preview.loadProject(projectData);
</script>
```

### Deployment Files
Built SDK files are located in `dist-sdk/`:
- `staging/v1.0.0/` - Development builds with source maps
- `prod/v1.0.0/` - Production builds (minified)

Upload these files to your hosting provider and reference the main `video-preview-sdk.js` file.