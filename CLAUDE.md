# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a video preview/renderer SDK for an online video editing tool, specifically designed for creating real estate advertisements. Built with PixiJS, Vite, and TypeScript, this application provides both standalone preview functionality and an embeddable SDK for integration into other web applications.

**Primary Goals:**
- MVP video preview functionality for real estate ads  
- Embeddable SDK for integration into PHP/Vanilla JS applications
- Support for images, videos, and text overlays
- Fade transitions between media elements
- Timeline-based sequence management
- Iframe-based embedding with postMessage communication

## Development Commands

### Development
- `npm start` or `npm run dev` - Start development server on port 8080 with auto-open  
- `npm run lint` - Run ESLint to check code quality

### Building
- `npm run build` - Build standalone application
- `npm run build:sdk:staging` - Build SDK for staging (with source maps)
- `npm run build:sdk:prod` - Build SDK for production (minified)
- `npm run build:sdk:all` - Build SDK for both staging and production

## Project Architecture

### Core Technologies
- **PixiJS 8.8.1** - Main graphics rendering library
- **Vite 6.2.0** - Build tool and dev server
- **TypeScript 5.7.3** - Type-safe JavaScript
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
    Timeline.ts             - Interactive timeline controls
    LoadingProgress.ts      - Loading screen component
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
```

### Application Flow
The main application (`src/main.ts`) supports both standalone and iframe modes:

**Standalone Mode:**
1. Loads test project data from `/test-project.json`
2. Creates PixiJS Application with responsive scaling
3. Parses project data and preloads all assets
4. Renders scenes with media, text, and audio
5. Provides interactive timeline controls

**Iframe/SDK Mode:**
1. Detects iframe context automatically
2. Sets up postMessage communication with parent
3. Waits for project data from parent window
4. Renders preview identically to standalone mode
5. Scales responsively to iframe container

### Configuration Details
- **Vite Config**: Development server on port 8080 with auto-open
- **TypeScript**: ES2020 target, strict mode enabled, bundler module resolution
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
- **Responsive Scaling**: Content scales proportionally to any container size

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

### Development Workflow
- you don't have to run "npm run dev" I already have it running when we are working
- you don't need to do any git operations

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