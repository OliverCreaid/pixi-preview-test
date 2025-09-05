/**
 * Browser implementation of font manager using CSS Font Loading API
 */

import { IFontManager } from '../../core/interfaces/EnvironmentInterface';
import { ProjectFonts } from '../../types';

export class BrowserFontManager implements IFontManager {
  private loadedFonts = new Set<string>();

  async loadFont(fontFamily: string, fontUrl: string): Promise<void> {
    if (this.loadedFonts.has(fontFamily)) {
      return;
    }

    try {
      // Create @font-face rule
      const fontFace = new FontFace(fontFamily, `url(${fontUrl})`);
      await fontFace.load();
      
      // Add to document fonts
      document.fonts.add(fontFace);
      
      this.loadedFonts.add(fontFamily);
      console.log(`✅ Font loaded: ${fontFamily}`);
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
    console.log(`📚 Loaded ${fontPromises.length} project fonts`);
  }

  isFontLoaded(fontFamily: string): boolean {
    return this.loadedFonts.has(fontFamily);
  }
}