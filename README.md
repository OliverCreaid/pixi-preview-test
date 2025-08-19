# Video Preview SDK

A PixiJS-based video preview system for real estate advertisements with embeddable SDK capabilities.

## Features

- 🎬 **Scene-based video preview** with smooth transitions
- 🖼️ **Image and video support** with Ken Burns effects
- 📝 **Text overlays** with multiple elements per scene
- 🎵 **Audio integration** - voice-over and background music
- ⏯️ **Interactive timeline** with play/pause/seek controls
- 📦 **Embeddable SDK** for iframe-based integration
- 📱 **Responsive design** - adapts to any container size
- 🚀 **Production ready** with staging and production builds

## Quick Start

### Development
```bash
npm install
npm run dev
```

### SDK Integration
```html
<script src="https://yourdomain.com/video-preview-sdk/staging/v1.0.0/video-preview-sdk.js"></script>
<script>
const preview = new VideoPreviewSDK({
  container: '#preview-container'
});
preview.loadProject(projectData);
</script>
```

### Building for Production
```bash
npm run build:sdk:all  # Build both staging and production
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidance and architecture
- [FEATURES.md](./FEATURES.md) - Feature tracker and technical details
- [dist-sdk/README.md](./dist-sdk/README.md) - SDK deployment guide

## Project Structure

- `src/` - Core application source code
- `sdk/` - SDK wrapper for embedding
- `dist-sdk/` - Built SDK files ready for deployment
- `public/` - Static assets
- `test-integration.html` - SDK integration test page

## Built With

- [PixiJS 8.8.1](https://pixijs.com/) - 2D graphics rendering
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [@pixi/sound](https://github.com/pixijs/sound) - Audio management