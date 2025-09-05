/**
 * Browser implementation of timer using requestAnimationFrame and performance.now()
 */

import { ITimer } from '../../core/interfaces/EnvironmentInterface';

export class BrowserTimer implements ITimer {
  now(): number {
    return performance.now();
  }

  requestFrame(callback: () => void): number {
    return requestAnimationFrame(callback);
  }

  cancelFrame(id: number): void {
    cancelAnimationFrame(id);
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}