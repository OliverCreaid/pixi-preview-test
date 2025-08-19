// Core project data types based on Creatomate JSON format

export interface ProjectData {
  head: ProjectHead;
  scenes: Scene[];
  audio?: ProjectAudio;
}

export interface ProjectHead {
  id: number;
  title: string;
  orientation: "landscape" | "portrait";
  duration?: number;
  [key: string]: unknown; // For other properties we don't need yet
}

export interface Scene {
  sceneTypeId: number;
  sceneGroupId: number;
  typeId: number;
  sceneTypeElements: SceneElement[];
  audioDuration: number;
}

export interface SceneElement {
  id: number;
  elementType:
    | "sceneMedia"
    | "h1Text"
    | "h1TextBox"
    | "voice"
    | "shape"
    | "watermark";
  description: string;
  value: unknown;
  properties?: ElementProperties;
}

export interface ElementProperties {
  [key: string]: unknown;
}

// Media-specific types
export interface MediaAsset {
  id: string;
  mediaType: "image" | "video";
  src: string;
  thumbnail: string;
  mediaIndex: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  fit: "cover" | "contain" | "fill";
  clipLength: number;
  sceneLength: number;
  trimStart: number;
  // New properties for sequential playback within scenes
  startTime: number; // When this media starts within the scene (relative to scene start)
  duration: number; // How long this media plays within the scene
  endTime: number; // When this media ends within the scene
}

// Text-specific types
export interface TextElement {
  id: number;
  elementType: "h1Text";
  value: string;
  properties?: TextProperties;
}

export interface TextProperties {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// Audio-specific types
export interface VoiceElement {
  id: number;
  elementType: "voice";
  value: string; // URL to audio file
  properties?: {
    duration?: number;
    volume?: number;
  };
}

// Audio playback configuration
export interface AudioConfig {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  fadeInDuration: number; // ms for fade in at scene start
  fadeOutDuration: number; // ms for fade out at scene end
  crossfadeDuration: number; // ms for crossfade between scenes
}

// Audio state tracking (PIXI Sound based)
export interface AudioState {
  isLoaded: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  soundName: string; // PIXI Sound identifier
  soundInstance?: import("@pixi/sound").IMediaInstance;
}

// Background music configuration (matches test-project.json structure)
export interface BackgroundMusic {
  tags: string[];
  songId: string;
  songTitle: string;
  songBpm: number;
  bpm2: number;
  songDuration: number;
  songPreviewUrl: string;
  songThumbnailUrl: string;
  trimStart: number;
  volume: number; // Volume level from JSON (will be normalized to 0.0-1.0)
  beatTimes: number[];
  // Additional config for playback
  loop?: boolean; // Whether to loop if shorter than video
  fadeInDuration?: number; // ms for fade in at video start
  fadeOutDuration?: number; // ms for fade out at video end
  duckingVolume?: number; // Volume when voice over is playing (0.0 to 1.0)
}

// Audio section of project data
export interface ProjectAudio {
  music: BackgroundMusic;
}

// Background music state (PIXI Sound based)
export interface BackgroundMusicState {
  isLoaded: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isDucking: boolean; // Currently ducked for voice over
  soundName: string; // PIXI Sound identifier
  soundInstance?: import("@pixi/sound").IMediaInstance;
}

// Timeline and playback types
export interface TimelineState {
  currentTime: number;
  totalDuration: number;
  currentSceneIndex: number;
  isPlaying: boolean;
}

// Ken Burns effect configuration
export interface KenBurnsConfig {
  enabled: boolean;
  zoomFrom: number; // Starting scale (e.g., 1.0)
  zoomTo: number; // Ending scale (e.g., 1.2)
  panFromX: number; // Starting X offset percentage (0-100)
  panFromY: number; // Starting Y offset percentage (0-100)
  panToX: number; // Ending X offset percentage (0-100)
  panToY: number; // Ending Y offset percentage (0-100)
  duration: number; // Animation duration in milliseconds
}

export interface SceneInfo {
  index: number;
  startTime: number;
  duration: number;
  endTime: number;
  mediaAssets: MediaAsset[];
  textElements: TextElement[];
  voiceElement?: VoiceElement;
}

// Scene transition configuration
export interface TransitionConfig {
  enabled: boolean;
  type: "crossfade" | "fade-to-black" | "none";
  duration: number; // Transition duration in milliseconds (e.g., 500ms)
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

// Transition state tracking
export interface TransitionState {
  isTransitioning: boolean;
  fromSceneIndex: number;
  toSceneIndex: number;
  startTime: number;
  duration: number;
  progress: number; // 0 to 1
}

// Scene container management
export interface SceneContainer {
  index: number;
  container: import("pixi.js").Container;
  mediaRenderer: import("./core/MediaRenderer").MediaRenderer;
  textRenderer: import("./core/TextRenderer").TextRenderer;
  audioRenderer?: import("./core/AudioRenderer").AudioRenderer;
  isActive: boolean;
  alpha: number;
}
