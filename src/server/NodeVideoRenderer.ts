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
    console.log(`📊 Options: ${opts.width}x${opts.height} @ ${opts.frameRate}fps, quality: ${opts.quality}`);
    
    const renderStartTime = performance.now();

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
        console.log('🎞️ Starting frame extraction...');
        const frameStartTime = performance.now();
        
        // Debug: Choose random frames to save as debug images
        const debugFrames = this.selectDebugFrames(frameCount, 5); // Save 5 random frames for debugging
        const debugDir = path.join(process.cwd(), 'renders', 'debug_frames', jobId);
        await fs.mkdir(debugDir, { recursive: true });
        
        let lastProgressTime = performance.now();
        let frameProcessingTimes: number[] = [];
        const frameBuffers: Array<{index: number, buffer: Buffer, debugFrame?: boolean}> = [];
        
        console.log('🖼️ Processing frames (render only)...');
        
        for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
          const frameStartTime = performance.now();
          const time = frameIndex * frameDuration;
          
          // Step 1: Seek to frame time
          const seekStartTime = performance.now();
          this.coreApp.seek(time);
          const seekEndTime = performance.now();
          
          // Step 2: Force a render tick to update the scene
          const renderStartTime = performance.now();
          this.renderFrame();
          const renderEndTime = performance.now();
          
          // Step 3: Extract frame buffer (PNG encoding)
          const bufferStartTime = performance.now();
          const frameBuffer = this.extractFrameBuffer();
          const bufferEndTime = performance.now();
          
          // Store in memory for batch writing
          frameBuffers.push({
            index: frameIndex,
            buffer: frameBuffer,
            debugFrame: debugFrames.includes(frameIndex)
          });
          
          const frameEndTime = performance.now();
          frameProcessingTimes.push(frameEndTime - frameStartTime);
          
          // Log detailed timing for first few frames and every 50th frame
          if (frameIndex < 5 || frameIndex % 50 === 0) {
            const seekTime = (seekEndTime - seekStartTime).toFixed(1);
            const renderTime = (renderEndTime - renderStartTime).toFixed(1);
            const bufferTime = (bufferEndTime - bufferStartTime).toFixed(1);
            const totalTime = (frameEndTime - frameStartTime).toFixed(1);
            console.log(`🎞️ Frame ${frameIndex}: ${totalTime}ms total (${seekTime}ms seek + ${renderTime}ms render + ${bufferTime}ms PNG)`);
          }
          
          // Debug frames will be written in batch later
          
          // Performance logging every 25% of frames or every 5 seconds
          const now = performance.now();
          const shouldLogProgress = frameIndex % Math.ceil(frameCount / 4) === 0 || 
                                   (now - lastProgressTime) > 5000 || 
                                   frameIndex === frameCount - 1;
          
          if (shouldLogProgress) {
            const progress = Math.round((frameIndex / frameCount) * 100);
            const avgFrameTime = frameProcessingTimes.reduce((a, b) => a + b, 0) / frameProcessingTimes.length;
            const framesPerSecond = 1000 / avgFrameTime;
            const elapsedSeconds = (now - frameStartTime) / 1000;
            const estimatedTotalSeconds = elapsedSeconds / (frameIndex / frameCount);
            const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
            
            console.log(`⚡ ${progress}% (${frameIndex + 1}/${frameCount}) | ${framesPerSecond.toFixed(1)} fps | ${remainingSeconds.toFixed(0)}s remaining`);
            lastProgressTime = now;
            
            // Reset frame timing array to avoid memory buildup
            if (frameProcessingTimes.length > 100) {
              frameProcessingTimes = frameProcessingTimes.slice(-50);
            }
          }
        }

        const renderEndTime = performance.now();
        const renderTime = (renderEndTime - frameStartTime) / 1000;
        const avgFrameTime = frameProcessingTimes.reduce((a, b) => a + b, 0) / frameProcessingTimes.length;
        const renderFps = 1000 / avgFrameTime;
        console.log(`✅ Frame rendering complete in ${renderTime.toFixed(1)}s (avg ${avgFrameTime.toFixed(1)}ms/frame, ${renderFps.toFixed(1)} render fps)`);

        // Batch write all frames to disk (much faster than individual writes)
        console.log(`💾 Writing ${frameBuffers.length} frames to disk...`);
        const writeStartTime = performance.now();
        
        // Create write promises for all frames
        const writePromises: Promise<void>[] = [];
        
        frameBuffers.forEach(({index, buffer, debugFrame}) => {
          // Write main frame
          const framePath = path.join(framesDir, `frame-${index.toString().padStart(6, '0')}.png`);
          writePromises.push(this.environment.fileSystem!.writeBuffer(framePath, buffer));
          
          // Write debug frame if selected
          if (debugFrame) {
            const time = index * frameDuration;
            const debugPath = path.join(debugDir, `debug-frame-${index.toString().padStart(6, '0')}-time-${Math.round(time)}ms.png`);
            writePromises.push(this.environment.fileSystem!.writeBuffer(debugPath, buffer));
          }
        });
        
        // Write all files in parallel
        await Promise.all(writePromises);
        
        const writeEndTime = performance.now();
        const writeTime = (writeEndTime - writeStartTime) / 1000;
        const writeFps = frameBuffers.length / writeTime;
        console.log(`✅ File writing complete in ${writeTime.toFixed(1)}s (${writeFps.toFixed(1)} files/sec)`);
        
        // Log debug frames saved
        const debugCount = frameBuffers.filter(f => f.debugFrame).length;
        if (debugCount > 0) {
          console.log(`🔍 ${debugCount} debug frames saved to renders/debug_frames/${jobId}/`);
        }

        // Combine frames with FFmpeg
        console.log('🎬 Starting FFmpeg encoding...');
        const ffmpegStartTime = performance.now();
        const outputPath = await this.combineFramesWithFFmpeg(framesDir, jobId, opts);
        const ffmpegEndTime = performance.now();
        const ffmpegTime = (ffmpegEndTime - ffmpegStartTime) / 1000;

        // Cleanup frames
        await this.cleanupFrames(framesDir);

        const totalRenderTime = (performance.now() - renderStartTime) / 1000;
        console.log(`🎉 Render complete in ${totalRenderTime.toFixed(1)}s (${renderTime.toFixed(1)}s processing + ${writeTime.toFixed(1)}s writing + ${ffmpegTime.toFixed(1)}s encoding)`);
        console.log(`📊 Performance: ${(frameCount / totalRenderTime).toFixed(1)} total fps | ${outputPath}`);
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

  private renderFrame(): void {
    // Force render the current frame - synchronous with node-canvas
    this.coreApp.render();
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
    
    const frameCount = await fs.readdir(framesDir).then(files => files.length);
    console.log(`🎬 Combining ${frameCount} frames with FFmpeg...`);

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