/**
 * Browser implementation of video capture using MediaRecorder API
 */

import { IVideoCapture, ICanvas } from '../../core/interfaces/EnvironmentInterface';

export class BrowserVideoCapture implements IVideoCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recording = false;

  async startRecording(canvas: ICanvas, audioStream?: MediaStream): Promise<void> {
    if (this.recording) {
      throw new Error('Already recording');
    }

    // Get canvas element (assuming browser canvas has the actual HTMLCanvasElement)
    const canvasElement = (canvas as any).canvas as HTMLCanvasElement;
    if (!canvasElement) {
      throw new Error('Invalid canvas element for recording');
    }

    try {
      // Capture video stream from canvas
      const canvasStream = canvasElement.captureStream(30); // 30fps
      
      // Combine video and audio streams if audio is provided
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      }

      // Setup MediaRecorder
      const options = { mimeType: 'video/webm;codecs=vp8' };
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
      
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.recording = false;
      };

      // Start recording
      this.mediaRecorder.start();
      this.recording = true;
      
      console.log('🎥 Started video recording');
    } catch (error) {
      console.error('Failed to start video recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    if (!this.recording || !this.mediaRecorder) {
      throw new Error('Not currently recording');
    }

    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No media recorder available'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          this.recordedChunks = [];
          this.recording = false;
          console.log('🎥 Video recording complete');
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recording;
  }
}