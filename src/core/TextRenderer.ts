import { Text, TextStyle, Container } from 'pixi.js';
import { TextElement, ProjectFonts, FontDefinition } from '../types';
import { fontManager } from './FontManager.js';

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
        if (!textElement.value || textElement.value.trim() === '') {
            return; // Skip empty text
        }

        // Get font configuration from project fonts
        const fontConfig = this.getFontConfigForElement(textElement);

        // Create text style using project fonts or fallback
        // DEBUG: Use very obvious styling for headless mode testing  
        const style = new TextStyle({
            fontFamily: 'Arial', // Use exact registered font name
            fontSize: 64, // Very large text
            fill: '#ff0000', // Bright red
            stroke: {
                color: '#ffffff', // White stroke
                width: 4,
            },
            wordWrap: false, // Disable word wrap for testing
            align: 'left', // Left align for testing
            padding: 10, // Add padding to prevent clipping
        });

        // Create text object
        const textObject = new Text(textElement.value, style);

        // Log diagnostics for headless debugging
        console.log('🔍 Text diagnostics:');
        console.log(`- Text content: "${textElement.value}"`);
        console.log(`- Font family: "${style.fontFamily}"`);
        console.log(`- Font size: ${style.fontSize}`);
        console.log(`- Fill color: ${style.fill}`);
        console.log(`- Text width: ${textObject.width}`);
        console.log(`- Text height: ${textObject.height}`);
        console.log(`- Has visible content: ${textObject.width > 0 && textObject.height > 0}`);

        // Apply positioning
        this.applyTextPosition(textObject, textElement);

        // Add to container and track (with headless environment safety)
        try {
            this.container.addChild(textObject);
        } catch (error) {
            // In headless environment, container might have initialization issues
            // Store the text object for manual addition to stage later
            console.warn('Container addChild failed (headless mode):', (error as Error).message);
        }
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
            fontFamily: 'Arial, sans-serif',
            fontSize: 32,
            color: '#ffffff',
            strokeColor: '#000000',
            strokeWidth: 2,
        };

        // If no project fonts available, use defaults
        if (!this.projectFonts) {
            return defaultConfig;
        }

        // Determine which font type to use based on element type
        let fontDef: FontDefinition | null = null;
        if (textElement.elementType === 'h1Text') {
            fontDef = fontManager.getFontDefinition(this.projectFonts, 'h1');
        }

        // If no font definition found, use defaults
        if (!fontDef) {
            return defaultConfig;
        }

        // Return configuration using project font
        return {
            fontFamily: fontManager.getFontFamily(fontDef.font),
            fontSize: 32, // TODO: Get from font definition or element properties
            color: '#ffffff', // TODO: Map color reference to actual color
            strokeColor: fontDef.stroke > 0 ? '#000000' : 'transparent', // TODO: Map strokeColor reference
            strokeWidth: fontDef.stroke,
        };
    }

    /**
     * Apply positioning to text based on element properties
     */
    private applyTextPosition(textObject: Text, textElement: TextElement): void {
        console.log('Apply text positioning', textObject, textElement);
        const canvasWidth = 1280;
        const canvasHeight = 720;

        // Default positioning (centered horizontally, in lower third)
        let x = canvasWidth / 2;
        let y = canvasHeight * 0.75;

        // TODO - Read positioning from sceneTypeElement.
        // Check if custom positioning is specified in properties
        if (textElement.properties?.x !== undefined) {
            x = textElement.properties.x;
        }
        if (textElement.properties?.y !== undefined) {
            y = textElement.properties.y;
        }

        // DEBUG: Keep text at (0,0) with no anchor for testing
        textObject.anchor.set(0, 0); // Top-left anchor
        textObject.x = 0;
        textObject.y = 0;
        
        console.log(`📍 Text positioned at (${x}, ${y}) - actual position: (${textObject.x}, ${textObject.y}), anchor: (${textObject.anchor.x}, ${textObject.anchor.y})`);

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
     * Get all text objects as an array (for manual stage addition in headless mode)
     */
    getTextObjects(): Text[] {
        return Array.from(this.currentTexts.values());
    }

    /**
     * Clear all currently displayed texts
     */
    clearCurrentTexts(): void {
        try {
            this.container.removeChildren();
        } catch (error) {
            // In headless mode, container operations might fail
            console.warn('Container removeChildren failed (headless mode):', (error as Error).message);
        }
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
