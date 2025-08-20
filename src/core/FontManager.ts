import { Assets } from "pixi.js";
import { ProjectFonts, FontDefinition } from "../types";

/**
 * Manages font loading and registration for the application
 * Loads fonts from project JSON and registers them with PixiJS Assets
 */
export class FontManager {
  private loadedFonts = new Map<string, boolean>();

  /**
   * Load fonts from project style configuration
   */
  async loadProjectFonts(fonts: ProjectFonts): Promise<void> {
    const fontPromises: Promise<void>[] = [];

    // Load each font definition
    for (const [fontType, fontDef] of Object.entries(fonts)) {
      if (fontDef.src && !this.loadedFonts.has(fontDef.font)) {
        fontPromises.push(this.loadFont(fontType, fontDef));
      }
    }

    // Wait for all fonts to load
    if (fontPromises.length > 0) {
      await Promise.all(fontPromises);
    }
  }

  /**
   * Load a single font
   */
  private async loadFont(
    fontType: string,
    fontDef: FontDefinition,
  ): Promise<void> {
    try {
      // Add font to PixiJS Assets with both the font name and a unique identifier
      const fontAlias = `font-${fontDef.font.replace(/\s+/g, "-").toLowerCase()}`;

      await Assets.load({
        alias: fontAlias,
        src: fontDef.src,
      });

      // Mark as loaded
      this.loadedFonts.set(fontDef.font, true);
    } catch (error) {
      console.warn(`Failed to load font ${fontDef.font}:`, error);
      // Font loading failed, but we'll continue with fallback fonts
    }
  }

  /**
   * Get the font family name to use in TextStyle
   * Returns the requested font if loaded, otherwise returns a fallback
   */
  getFontFamily(fontName: string): string {
    if (this.loadedFonts.has(fontName)) {
      return fontName;
    }

    // Return fallback fonts
    return "Arial, sans-serif";
  }

  /**
   * Check if a font is loaded
   */
  isFontLoaded(fontName: string): boolean {
    return this.loadedFonts.has(fontName);
  }

  /**
   * Get font definition for a specific text type (h1, h2, body, subtitle)
   */
  getFontDefinition(
    fonts: ProjectFonts,
    textType: "h1" | "h2" | "body" | "subtitle",
  ): FontDefinition | null {
    return fonts[textType] || null;
  }

  /**
   * Clear loaded fonts cache
   */
  clearCache(): void {
    this.loadedFonts.clear();
  }
}

// Global instance
export const fontManager = new FontManager();
