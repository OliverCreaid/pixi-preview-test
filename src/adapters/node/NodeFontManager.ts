/**
 * Node.js implementation of font manager using node-canvas font registration
 */

import fs from 'fs/promises';
import path from 'path';
import { Canvas, registerFont } from 'canvas';
import { IFontManager } from '../../core/interfaces/EnvironmentInterface';
import { ProjectFonts } from '../../types';

export class NodeFontManager implements IFontManager {
  private loadedFonts = new Set<string>();

  async loadFont(fontFamily: string, fontUrl: string): Promise<void> {
    if (this.loadedFonts.has(fontFamily)) {
      return;
    }

    try {
      let fontPath: string;

      // Handle different URL formats
      if (fontUrl.startsWith('http://') || fontUrl.startsWith('https://')) {
        // Remote font - fetch and cache locally
        fontPath = await this.fetchAndCacheFont(fontUrl, fontFamily);
      } else if (fontUrl.startsWith('/')) {
        // Absolute path
        fontPath = fontUrl;
      } else if (fontUrl.startsWith('public/')) {
        // Public asset path
        fontPath = path.join(process.cwd(), fontUrl);
      } else {
        // Relative path - assume relative to public
        fontPath = path.join(process.cwd(), 'public', fontUrl);
      }

      // Verify font file exists
      try {
        await fs.access(fontPath);
      } catch {
        throw new Error(`Font file not found: ${fontPath}`);
      }

      // Register font with node-canvas
      registerFont(fontPath, { family: fontFamily });
      
      this.loadedFonts.add(fontFamily);
      console.log(`✅ Font registered: ${fontFamily} from ${fontPath}`);
    } catch (error) {
      console.error(`Failed to load font ${fontFamily}:`, error);
      throw error;
    }
  }

  async loadProjectFonts(fonts: ProjectFonts): Promise<void> {
    const fontPromises: Promise<void>[] = [];

    // Load all font types from the project
    for (const [fontType, fontDef] of Object.entries(fonts)) {
      if (fontDef.src && fontDef.font) {
        fontPromises.push(
          this.loadFont(fontDef.font, fontDef.src).catch(error => {
            console.error(`Failed to load ${fontType} font:`, error);
            // Don't throw - continue with other fonts
          })
        );
      }
    }

    await Promise.all(fontPromises);
    console.log(`📚 Registered ${fontPromises.length} project fonts with node-canvas`);
  }

  isFontLoaded(fontFamily: string): boolean {
    return this.loadedFonts.has(fontFamily);
  }

  private async fetchAndCacheFont(url: string, fontFamily: string): Promise<string> {
    // Create cache directory
    const cacheDir = path.join(process.cwd(), '.cache', 'fonts');
    await fs.mkdir(cacheDir, { recursive: true });

    // Generate cache filename
    const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '');
    const extension = path.extname(new URL(url).pathname) || '.ttf';
    const cacheFile = path.join(cacheDir, `${fontFamily}-${urlHash}${extension}`);

    // Check if already cached
    try {
      await fs.access(cacheFile);
      return cacheFile;
    } catch {
      // File doesn't exist, fetch it
    }

    // Fetch and cache font
    console.log(`📡 Fetching font: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch font ${url}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(cacheFile, buffer);

    console.log(`💾 Cached font: ${cacheFile}`);
    return cacheFile;
  }
}