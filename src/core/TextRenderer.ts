import { Text, TextStyle, Container } from "pixi.js";
import { TextElement, ProjectFonts, FontDefinition } from "../types";
import { fontManager } from "./FontManager";

/**
 * Handles rendering of text overlays on scenes
 * Manages text positioning and basic styling
 */
export class TextRenderer {
  private container: Container;
  private currentTexts = new Map<number, Text>();
  private projectFonts: ProjectFonts | null = null;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Set project fonts for text rendering
   */
  setProjectFonts(fonts: ProjectFonts | null): void {
    this.projectFonts = fonts;
  }

  /**
   * Display text elements for a scene
   */
  displayTexts(textElements: TextElement[]): void {
    // Clear existing texts
    this.clearCurrentTexts();

    // Create and display each text element
    for (const textElement of textElements) {
      this.displayText(textElement);
    }
  }

  /**
   * Create and display a single text element
   */
  private displayText(textElement: TextElement): void {
    if (!textElement.value || textElement.value.trim() === "") {
      return; // Skip empty text
    }

    // Get font configuration from project fonts
    const fontConfig = this.getFontConfigForElement(textElement);

    // Create text style using project fonts or fallback
    const style = new TextStyle({
      fontFamily: fontConfig.fontFamily,
      fontSize: fontConfig.fontSize,
      fill: fontConfig.color,
      stroke: {
        color: fontConfig.strokeColor,
        width: fontConfig.strokeWidth,
      },
      dropShadow: {
        color: "#000000",
        blur: 4,
        angle: Math.PI / 4,
        distance: 2,
      },
      wordWrap: true,
      wordWrapWidth: 800,
      align: "center",
    });

    // Create text object
    const textObject = new Text(textElement.value, style);

    // Apply positioning
    this.applyTextPosition(textObject, textElement);

    // Add to container and track
    this.container.addChild(textObject);
    this.currentTexts.set(textElement.id, textObject);
  }

  /**
   * Get font configuration for a text element
   */
  private getFontConfigForElement(textElement: TextElement): {
    fontFamily: string;
    fontSize: number;
    color: string;
    strokeColor: string;
    strokeWidth: number;
  } {
    // Default fallback configuration
    const defaultConfig = {
      fontFamily: "Arial, sans-serif",
      fontSize: 32,
      color: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 2,
    };

    // If no project fonts available, use defaults
    if (!this.projectFonts) {
      return defaultConfig;
    }

    // Determine which font type to use based on element type
    let fontDef: FontDefinition | null = null;
    if (textElement.elementType === "h1Text") {
      fontDef = fontManager.getFontDefinition(this.projectFonts, "h1");
    }

    // If no font definition found, use defaults
    if (!fontDef) {
      return defaultConfig;
    }

    // Return configuration using project font
    return {
      fontFamily: fontManager.getFontFamily(fontDef.font),
      fontSize: 32, // TODO: Get from font definition or element properties
      color: "#ffffff", // TODO: Map color reference to actual color
      strokeColor: fontDef.stroke > 0 ? "#000000" : "transparent", // TODO: Map strokeColor reference
      strokeWidth: fontDef.stroke,
    };
  }

  /**
   * Apply positioning to text based on element properties
   */
  private applyTextPosition(textObject: Text, textElement: TextElement): void {
    const canvasWidth = 1280;
    const canvasHeight = 720;

    // Default positioning (centered horizontally, in lower third)
    let x = canvasWidth / 2;
    let y = canvasHeight * 0.75;

    // Check if custom positioning is specified in properties
    if (textElement.properties?.x !== undefined) {
      x = textElement.properties.x;
    }
    if (textElement.properties?.y !== undefined) {
      y = textElement.properties.y;
    }

    // Set anchor to center for better positioning control
    textObject.anchor.set(0.5);
    textObject.x = x;
    textObject.y = y;

    // Apply width constraint if specified
    if (textElement.properties?.width) {
      textObject.style.wordWrapWidth = textElement.properties.width;
    }
  }

  /**
   * Update text content for an existing text element
   */
  updateText(textId: number, newText: string): void {
    const textObject = this.currentTexts.get(textId);
    if (textObject) {
      textObject.text = newText;
    }
  }

  /**
   * Clear all currently displayed texts
   */
  clearCurrentTexts(): void {
    this.container.removeChildren();
    this.currentTexts.clear();
  }

  /**
   * Get all currently displayed text objects
   */
  getCurrentTexts(): Map<number, Text> {
    return new Map(this.currentTexts);
  }

  /**
   * Hide specific text element
   */
  hideText(textId: number): void {
    const textObject = this.currentTexts.get(textId);
    if (textObject) {
      textObject.visible = false;
    }
  }

  /**
   * Show specific text element
   */
  showText(textId: number): void {
    const textObject = this.currentTexts.get(textId);
    if (textObject) {
      textObject.visible = true;
    }
  }

  /**
   * Destroy all text resources
   */
  destroy(): void {
    this.clearCurrentTexts();
  }
}
