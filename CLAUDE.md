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
- **PixiJS 8.8.1** - Main graphics rendering library (browser)
- **node-canvas** - Node.js Canvas API implementation for server rendering
- **Vite 6.2.0** - Build tool and dev server
- **TypeScript 5.7.3** - Type-safe JavaScript
- **Express 4.18.0** - Server framework for render API
- **Environment Abstraction** - NEW: Unified interface for browser/node rendering
- **ESLint + Prettier** - Code linting and formatting

### Project Structure
```
src/
  main.ts                    - Entry point with PixiJS application setup
  core/                      - Original PixiJS rendering classes (legacy)
    SceneManager.ts         - Scene container and transition management
    ProjectParser.ts        - Creatomate JSON parsing
    MediaRenderer.ts        - Image/video rendering with Ken Burns
    TextRenderer.ts         - Text overlay rendering
    WebAudioManager.ts      - Web Audio API context management
    WebAudioRenderer.ts     - Voice-over audio using Web Audio API
    WebAudioMusicManager.ts - Background music using Web Audio API
    TransitionManager.ts    - Scene transition animations
    ProjectPreloader.ts     - Asset preloading system
  shared/                   - NEW: Cross-platform shared logic
    core/                   - Platform-agnostic core application logic
      CoreApplication.ts    - Main application orchestrator
      CoreSceneManager.ts   - Scene management with environment abstraction
      CoreAssetPreloader.ts - Asset preloading for any environment
      ProjectParser.ts      - Shared project parsing logic
  adapters/                 - NEW: Environment-specific implementations
    browser/                - Browser-specific implementations
      BrowserEnvironment.ts - Browser environment adapter
      BrowserPixiFactory.ts - Real PixiJS factory for browsers
    node/                   - Node.js-specific implementations
      NodeEnvironment.ts    - Node.js environment adapter
      NodePixiFactory.ts    - node-canvas based PixiJS implementation
      NodeAssetLoader.ts    - Node.js asset loading using node-canvas
      NodeFontManager.ts    - Font loading for Node.js rendering
  server/                   - Server-side rendering system
    render-server.ts        - Express API server for video rendering
    NodeVideoRenderer.ts    - Node.js video renderer using new architecture
    types.ts               - Server-specific TypeScript types
  types.ts                  - TypeScript type definitions
  core/interfaces/          - NEW: TypeScript interfaces for environment abstraction
    EnvironmentInterface.ts - Core environment abstraction interfaces
    CoreInterface.ts        - Core application interfaces
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
debug-frames/               - Debug frame extraction output
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
- **Native Node.js Rendering**: Direct server-side rendering using node-canvas (no browser required)
- **CoreApplication Integration**: Uses same shared logic as browser preview
- **Frame-by-Frame Generation**: Precise frame extraction with debug output
- **Job Queue System**: Asynchronous rendering with progress tracking
- **PNG Frame Output**: High-quality debug frames for verification
- **File Download**: Automatic download links for completed renders

### SDK & Integration
- **Embeddable SDK**: VideoPreviewSDK class for iframe-based integration
- **PostMessage Communication**: Secure parent-iframe messaging for project data
- **Dual Build System**: Separate builds for development/staging and production

## New Architecture (Environment Abstraction)

### Design Overview
The project now uses a **dual-environment architecture** that allows the same core application logic to run in both browser and Node.js environments:

- **Browser Environment**: Uses real PixiJS for interactive preview
- **Node.js Environment**: Uses node-canvas for server-side rendering
- **Shared Core Logic**: CoreApplication orchestrates both environments identically

### Key Architecture Components

#### Environment Interface (`EnvironmentInterface.ts`)
Defines platform-agnostic interfaces for:
- `IPixiFactory` - Creates PixiJS-compatible objects for any environment
- `IPixiApp` - Unified application interface (PixiJS or node-canvas)
- `IContainer`, `ISprite`, `IText` - Rendering primitives
- `IAssetLoader`, `IFontManager` - Resource loading

#### Core Application (`CoreApplication.ts`)
- Environment-agnostic business logic
- Handles project loading, scene management, timeline control
- Uses dependency injection to work with any environment
- Single source of truth for both preview and rendering

#### Environment Adapters
- **BrowserEnvironment**: Real PixiJS implementation
- **NodeEnvironment**: node-canvas implementation that mimics PixiJS API
- **NodePixiFactory**: Creates node-canvas objects that implement PixiJS interfaces

### Benefits
- **Code Reuse**: Same logic renders identically in browser and server
- **Consistency**: Server output matches preview exactly
- **Maintainability**: Single codebase for all rendering logic
- **Testing**: Easy to verify server output matches browser preview

## Development Notes

### Technical Implementation Details
- The project uses module-based imports (`type: "module"` in package.json)
- Assets are served from the `public/` directory
- The application automatically resizes with the window
- PixiJS devtools are included for debugging (`@pixi/devtools`)
- **Transition System**: Uses hardware-accelerated alpha blending for smooth fades
- **Smart Scrubbing**: Transitions complete instantly during timeline seeking
- **Environment Abstraction**: Same CoreApplication runs in browser and Node.js
- **node-canvas Integration**: Server rendering uses real Canvas API implementation

### Audio Architecture Details
- **Web Audio API Migration**: Completely replaced PIXI Sound with Web Audio API for better control
- **Tab Switching Fix**: Audio context resumption handles browser autoplay policies and tab changes
- **Loop Point Fix**: Explicit loopStart/loopEnd settings prevent premature source ending with start offsets  
- **Timeline Sync Fix**: TrimStart properly accounted for in drift calculation and sync logic
- **Volume Mapping**: JSON volume values (0-100) correctly normalized to Web Audio API range (0.0-1.0)
- **Gradual Ducking**: Background music fades gradually (1.5s down, 2s up) when voice starts/stops

### Server-Side Rendering Architecture
- **Environment Abstraction**: Single codebase renders in both browser and Node.js
- **Native Node.js Rendering**: Direct server-side rendering without browser dependencies
- **node-canvas Integration**: Real Canvas API implementation for server-side graphics
- **Shared Core Logic**: Same CoreApplication used for both preview and rendering
- **Frame Extraction**: Precise frame-by-frame generation with debug output
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

## Debug Frame Method for Video Rendering

When testing video rendering, **always use the debug frame extraction method** to inspect output quality:

### How It Works
The NodeVideoRenderer automatically saves **5 strategically selected frames** during rendering:
- Frame 0 (video start)
- 3 evenly distributed middle frames  
- Final frame (video end)

### Debug Frame Locations
```bash
debug-frames/{jobId}/
├── debug-frame-000000-time-0ms.png          # Video start
├── debug-frame-000177-time-5900ms.png       # ~20% through
├── debug-frame-000354-time-11800ms.png      # ~40% through  
├── debug-frame-000531-time-17700ms.png      # ~60% through
└── debug-frame-000888-time-29600ms.png      # Video end
```

### Successful Implementation
The Node.js renderer now successfully:
- ✅ Loads real images from URLs using node-canvas `loadImage()`
- ✅ Renders sprites with proper textures (not mock data)
- ✅ Applies Ken Burns effects and image scaling
- ✅ Renders text overlays with custom fonts
- ✅ Matches browser preview output exactly
- ✅ Generates high-quality debug frames showing real content

**Example Debug Output:**
```
📱 Initialized real Node canvas: 1280x720
🔄 Loading texture from: https://images.unsplash.com/photo-1560518883...
✅ Loaded image: 1600x1067
🖼️ Rendering sprite: 1280x720, has image: true
✅ Drew image at (-640, -360) size 1280x720
🔍 Debug frame saved: frame 0 (0ms) -> debug-frame-000000-time-0ms.png
```

### Console Output
```
🔍 Debug frame saved: frame 0 (0ms) -> debug-frame-000000-time-0ms.png
🔍 Debug frame saved: frame 177 (5900ms) -> debug-frame-000177-time-5900ms.png
```

### Usage
1. Start render job via API: `POST /api/render`
2. Wait for completion or monitor progress
3. Check `debug-frames/{jobId}/` directory  
4. Open PNG files to inspect visual output at key moments
5. Verify scene transitions, asset loading, text rendering

This provides **complete coverage** without generating excessive debug files.

- node for now has to run on Node 18, you can start the terminal with node 18 to start the server with: export PATH="$(brew --prefix node@18)/bin:$PATH"

## Critical Implementation Details

### Node.js Canvas Integration
The server-side renderer uses **real node-canvas rendering** (not mock data):

```typescript
// NodePixiFactory.ts - Creates real canvas-based sprites
createSprite(texture: ITexture): ISprite {
  const sprite = new NodeSprite();
  sprite.texture = texture; // CRITICAL: Must assign texture properly
  return sprite;
}

// NodeAssetLoader.ts - Loads real images
const image = await loadImage(actualPath);
const nodeTexture = new NodeTexture(image, image.width, image.height);
```

### Fixed Issues
- **Canvas Architecture**: Fixed ARM64/x86_64 mismatch with `npm rebuild canvas`
- **ES Modules**: Fixed `require` errors by importing `registerFont` directly
- **Texture Assignment**: Fixed sprites not displaying by properly setting `sprite.texture`
- **Mock vs Real**: Replaced all placeholder implementations with real node-canvas calls

The renderer now produces **pixel-perfect output** matching the browser preview.