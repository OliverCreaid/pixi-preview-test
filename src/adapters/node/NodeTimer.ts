/**
 * Node.js implementation of timer using setInterval and Date.now()
 */

import { ITimer } from '../../core/interfaces/EnvironmentInterface';

export class NodeTimer implements ITimer {
  now(): number {
    return Date.now();
  }

  requestFrame(callback: () => void): number {
    // Node.js doesn't have requestAnimationFrame, use setTimeout for deterministic timing
    return setTimeout(callback, 1000 / 60) as any; // 60fps
  }

  cancelFrame(id: number): void {
    clearTimeout(id);
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}