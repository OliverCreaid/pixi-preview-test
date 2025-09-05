/**
 * Node.js video renderer using the new architecture
 * Uses NodeEnvironment + CoreApplication for headless rendering
 */

import path from 'path';
import fs from 'fs/promises';
import { NodeEnvironment } from '../adapters/node/NodeEnvironment.js';
import { CoreApplication } from '../shared/core/CoreApplication.js';
import { ProjectData } from '../types.js';
import { spawn } from 'child_process';

export interface RenderOptions {
  frameRate?: number;
  quality?: 'low' | 'medium' | 'high';
  format?: 'mp4' | 'webm';
  width?: number;
  height?: number;
}

export class NodeVideoRenderer {
  private environment: NodeEnvironment;
  private coreApp: CoreApplication;
  private initialized = false;

  constructor() {
    this.environment = new NodeEnvironment();
    this.coreApp = new CoreApplication();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🖥️ Initializing Node.js video renderer...');

    // Initialize core application with Node environment
    await this.coreApp.initialize(this.environment);

    // Setup progress callbacks
    this.coreApp.onProjectLoaded(() => {
      console.log('📦 Project loaded in Node.js renderer');
    });

    this.coreApp.onTimeUpdate((time) => {
      // Could emit progress events here
    });

    this.initialized = true;
    console.log('✅ Node.js video renderer initialized');
  }

  async renderVideo(
    jobId: string, 
    projectData: ProjectData, 
    options: RenderOptions = {}
  ): Promise<string> {
    const opts: Required<RenderOptions> = {
      frameRate: 30,
      quality: 'medium',
      format: 'mp4',
      width: 1280,
      height: 720,
      ...options
    };

    console.log(`🎬 Starting Node.js render for job ${jobId}`);
    console.log(`📊 Options:`, opts);

    try {
      // Load project
      await this.coreApp.loadProject(projectData);
      
      const totalDuration = this.coreApp.getTotalDuration();
      const frameCount = Math.ceil((totalDuration / 1000) * opts.frameRate);
      const frameDuration = 1000 / opts.frameRate;

      console.log(`📋 Render plan: ${frameCount} frames at ${opts.frameRate}fps (${totalDuration}ms duration)`);

      // Create frames directory
      const framesDir = path.join(process.cwd(), 'frames', jobId);
      await fs.mkdir(framesDir, { recursive: true });

      try {
        // Extract frames
        console.log('🎞️ Extracting frames...');
        
        // Debug: Choose random frames to save as debug images
        const debugFrames = this.selectDebugFrames(frameCount, 5); // Save 5 random frames for debugging
        const debugDir = path.join(process.cwd(), 'debug-frames', jobId);
        await fs.mkdir(debugDir, { recursive: true });
        
        for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
          const time = frameIndex * frameDuration;
          
          // Seek to frame time
          this.coreApp.seek(time);
          
          // Force a render tick to update the scene
          await this.renderFrame();
          
          // Extract frame buffer
          const frameBuffer = this.extractFrameBuffer();
          
          // Save frame
          const framePath = path.join(framesDir, `frame-${frameIndex.toString().padStart(6, '0')}.png`);
          await this.environment.fileSystem!.writeBuffer(framePath, frameBuffer);
          
          // Save debug frame if selected
          if (debugFrames.includes(frameIndex)) {
            const debugPath = path.join(debugDir, `debug-frame-${frameIndex.toString().padStart(6, '0')}-time-${Math.round(time)}ms.png`);
            await this.environment.fileSystem!.writeBuffer(debugPath, frameBuffer);
            console.log(`🔍 Debug frame saved: frame ${frameIndex} (${Math.round(time)}ms) -> ${path.basename(debugPath)}`);
          }
          
          // Log progress every 10% or when complete
          if (frameIndex % Math.ceil(frameCount / 10) === 0 || frameIndex === frameCount - 1) {
            const progress = Math.round((frameIndex / frameCount) * 100);
            console.log(`📸 Progress: ${progress}% (${frameIndex + 1}/${frameCount} frames)`);
          }
        }

        console.log('✅ Frame extraction complete');

        // Combine frames with FFmpeg
        const outputPath = await this.combineFramesWithFFmpeg(framesDir, jobId, opts);

        // Cleanup frames
        await this.cleanupFrames(framesDir);

        console.log(`🎉 Video render complete: ${outputPath}`);
        return outputPath;

      } catch (error) {
        // Cleanup on error
        await this.cleanupFrames(framesDir);
        throw error;
      }

    } catch (error) {
      console.error(`❌ Node.js render failed for job ${jobId}:`, error);
      throw error;
    }
  }

  private selectDebugFrames(totalFrames: number, count: number): number[] {
    const debugFrames: number[] = [];
    const step = Math.max(1, Math.floor(totalFrames / count));
    
    // Always include first frame
    debugFrames.push(0);
    
    // Add evenly distributed frames
    for (let i = 1; i < count - 1; i++) {
      debugFrames.push(i * step);
    }
    
    // Always include last frame (if more than 1 frame total)
    if (totalFrames > 1) {
      debugFrames.push(totalFrames - 1);
    }
    
    // Remove duplicates and sort
    return [...new Set(debugFrames)].sort((a, b) => a - b);
  }

  private async renderFrame(): Promise<void> {
    // Force render the current frame
    this.coreApp.render();
    
    // Small delay to ensure render completes
    await this.environment.timer.delay(5);
  }

  private extractFrameBuffer(): Buffer {
    // Get the canvas from CoreApplication
    const canvas = this.coreApp.getCanvas();
    
    if (!canvas || typeof canvas.toBuffer !== 'function') {
      throw new Error('Cannot extract frame buffer - invalid canvas');
    }

    // Extract PNG buffer from node-canvas
    return canvas.toBuffer('image/png');
  }

  private async combineFramesWithFFmpeg(
    framesDir: string, 
    jobId: string, 
    options: Required<RenderOptions>
  ): Promise<string> {
    const outputPath = path.join(process.cwd(), 'renders', `${jobId}.${options.format}`);
    
    console.log(`🎬 Combining ${path.basename(framesDir)} frames with FFmpeg...`);
    console.log(`📁 Output: ${outputPath}`);

    // Ensure renders directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // FFmpeg command
    const ffmpegArgs = [
      '-framerate', options.frameRate.toString(),
      '-i', path.join(framesDir, 'frame-%06d.png'),
      '-c:v', 'libx264',
      '-preset', this.getFFmpegPreset(options.quality),
      '-pix_fmt', 'yuv420p',
      '-y', // Overwrite output file
      outputPath
    ];

    console.log(`🎬 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

    return new Promise<string>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // Could parse progress from stderr here
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ FFmpeg encoding complete');
          resolve(outputPath);
        } else {
          console.error('❌ FFmpeg failed:', stderr);
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg spawn error:', error);
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }

  private getFFmpegPreset(quality: string): string {
    switch (quality) {
      case 'low': return 'ultrafast';
      case 'medium': return 'medium';
      case 'high': return 'slow';
      default: return 'medium';
    }
  }

  private async cleanupFrames(framesDir: string): Promise<void> {
    try {
      await fs.rm(framesDir, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up frames: ${path.basename(framesDir)}`);
    } catch (error) {
      console.warn(`⚠️ Could not clean up frames: ${error}`);
    }
  }

  // Streaming API for advanced use cases
  async *renderFrames(
    projectData: ProjectData, 
    frameRate: number = 30
  ): AsyncGenerator<Buffer, void> {
    await this.coreApp.loadProject(projectData);
    
    const totalDuration = this.coreApp.getTotalDuration();
    const frameCount = Math.ceil((totalDuration / 1000) * frameRate);
    const frameDuration = 1000 / frameRate;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const time = frameIndex * frameDuration;
      
      // Seek and render
      this.coreApp.seek(time);
      await this.renderFrame();
      
      // Extract and yield frame
      const frameBuffer = this.extractFrameBuffer();
      yield frameBuffer;
    }
  }

  getSystemInfo(): any {
    return this.environment.getSystemInfo();
  }

  destroy(): void {
    console.log('🧹 Destroying Node.js video renderer...');
    this.coreApp.destroy();
    this.initialized = false;
  }
}