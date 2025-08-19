# Real Estate Video Preview - Development Guide

## Architecture Overview

This application uses PixiJS as the rendering engine to create a timeline-based video preview system for real estate advertisements.

### Key Design Principles

1. **Component-Based Architecture**: Separate concerns for media handling, timeline management, and rendering
2. **Asset-Agnostic Loading**: Support various media formats through unified loading system
3. **Timeline-Driven**: All animations and media display controlled by central timeline
4. **Memory Efficient**: Proper cleanup and resource management for long-running previews

## Core Systems

### 1. Scene Management (`SceneManager`)
- Manages PixiJS Application lifecycle
- Handles canvas resizing and responsiveness
- Coordinates between different rendering layers

### 2. Media System
```typescript
interface MediaAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  duration?: number; // for videos, or display time for images
}
```

### 3. Timeline Engine (`TimelineEngine`)
```typescript
interface TimelineEvent {
  startTime: number;
  duration: number;
  asset: MediaAsset;
  transition?: TransitionConfig;
}
```

### 4. Text Overlay System (`TextRenderer`)
```typescript
interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  style: TextStyle;
  position: { x: number; y: number };
}
```

### 5. Transition System (`TransitionManager`)
- Handles fade in/out effects
- Manages timing between media elements
- Extensible for future transition types

## Implementation Strategy

### Phase 1: Foundation
1. **Setup PixiJS scene with proper canvas management**
2. **Create basic media loading system**
3. **Implement simple image display**

### Phase 2: Timeline Integration
1. **Build timeline management system**
2. **Add video playback support**
3. **Implement fade transitions**

### Phase 3: Text and Controls
1. **Text overlay rendering**
2. **Playback controls (play/pause/seek)**
3. **Integration testing**

## Data Format Specification

### Project Structure
```json
{
  "version": "1.0",
  "duration": 30000, // milliseconds
  "assets": [
    {
      "id": "asset1",
      "type": "image",
      "url": "/assets/house1.jpg"
    }
  ],
  "timeline": [
    {
      "startTime": 0,
      "duration": 5000,
      "assetId": "asset1",
      "transition": {
        "type": "fade",
        "duration": 500
      }
    }
  ],
  "textOverlays": [
    {
      "id": "text1",
      "text": "Beautiful 3BR Home",
      "startTime": 1000,
      "duration": 3000,
      "style": {
        "fontSize": 32,
        "color": "#ffffff",
        "fontFamily": "Arial"
      },
      "position": { "x": 100, "y": 100 }
    }
  ]
}
```

### 3. Audio System (PIXI Sound)

The audio system uses **PIXI Sound** for high-performance audio playbook, providing better integration with PixiJS and more advanced features compared to HTML5 Audio.

#### Voice Over System (`AudioRenderer`)
```typescript
class AudioRenderer {
  // Handles individual voice over tracks per scene
  async loadVoiceElement(voiceElement: VoiceElement): Promise<void>
  async startPlayback(startTime: number): Promise<void>
  async seekToTime(timeMs: number): Promise<void>
  syncWithTimeline(expectedTimeMs: number): void
}
```

**Key Features:**
- ✅ **PIXI Sound Integration**: Uses WebAudio API for better performance
- ✅ **Timeline Synchronization**: Automatic drift correction (300ms tolerance)
- ✅ **Smooth Fades**: Configurable fade in/out durations
- ✅ **Async Operations**: Non-blocking audio loading and seeking
- ✅ **Memory Management**: Automatic cleanup of sound instances

#### Background Music System (`GlobalMusicManager`)
```typescript
class GlobalMusicManager {
  // Manages continuous background music across entire video
  async loadMusic(config: BackgroundMusic, duration: number): Promise<void>
  async startPlayback(startTime: number): Promise<void>
  duckVolume(isDucking: boolean): void // Volume mixing with voice
  syncWithTimeline(expectedTimeMs: number): void
}
```

**Key Features:**
- ✅ **Auto-Looping**: Music loops when shorter than video duration
- ✅ **Volume Ducking**: Automatically reduces volume when voice over plays
- ✅ **Timeline Sync**: Stays synchronized with visual timeline (1s tolerance)
- ✅ **Project Integration**: Loads from existing `test-project.json` structure
- ✅ **Configurable Volumes**: Base volume (30%), ducking volume (10%)

#### Audio Configuration
```typescript
interface BackgroundMusic {
  songId: string;
  songTitle: string;
  songPreviewUrl: string;
  songDuration: number;
  volume: number; // 0-100, normalized to 0.0-1.0
  // ... additional properties
}

interface VoiceElement {
  id: number;
  elementType: "voice";
  value: string; // URL to audio file
  properties?: {
    duration?: number;
    volume?: number;
  };
}
```

#### Performance Optimizations
- **Throttled Sync**: Audio sync runs max every 500ms-1s to prevent lag
- **Async Seeking**: Non-blocking seek operations with error handling  
- **Smart Volume Mixing**: Smooth crossfades between volume states (300ms)
- **Resource Cleanup**: Automatic sound instance cleanup on destroy

#### Migration from HTML5 Audio
The system was migrated from HTML5 Audio to PIXI Sound for:
- **Better Integration**: Native PixiJS ecosystem support
- **Advanced Features**: WebAudio API capabilities
- **Performance**: More efficient audio processing
- **Future Extensibility**: Support for audio filters and effects

## Performance Considerations

### Memory Management
- Dispose of PixiJS textures when media is no longer needed
- Implement asset preloading with size limits
- Use object pooling for frequently created/destroyed objects

### Rendering Optimization
- Use PixiJS containers to group related elements
- Implement dirty checking to avoid unnecessary renders
- Leverage WebGL features for smooth transitions

## Testing Strategy

### Unit Tests
- Timeline calculation logic
- Asset loading and caching
- Transition timing functions

### Integration Tests
- Full project playback scenarios
- Memory leak detection
- Performance benchmarking

### Manual Testing
- Various media formats and sizes
- Different project configurations
- Browser compatibility (Chrome, Firefox, Safari)

## Development Workflow

1. **Feature Development**: Use feature branches for each major component
2. **Code Review**: Ensure performance and memory usage considerations
3. **Testing**: Both automated and manual testing before integration
4. **Documentation**: Update this guide as architecture evolves