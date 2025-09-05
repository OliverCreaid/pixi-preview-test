/**
 * Node.js implementation of PIXI factory using node-canvas for real rendering
 */

import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { 
  IPixiFactory, 
  IPixiApp, 
  IContainer, 
  ISprite, 
  IText, 
  ITexture, 
  ICanvas,
  IRenderer,
  ITicker,
  IPixiAppOptions,
  ITextStyle
} from '../../core/interfaces/EnvironmentInterface';

export class NodePixiFactory implements IPixiFactory {
  createApplication(): IPixiApp {
    return new NodePixiApp();
  }

  createContainer(): IContainer {
    return new NodeContainer();
  }

  createSprite(texture: ITexture): ISprite {
    const sprite = new NodeSprite();
    sprite.texture = texture; // Set the texture properly
    return sprite;
  }

  createText(text: string, style?: ITextStyle): IText {
    return new NodeText(text, style);
  }

  createTexture(source: any): ITexture {
    return new NodeTexture();
  }
}

// Real node-canvas implementation for actual rendering
class NodePixiApp implements IPixiApp {
  private nodeCanvas: Canvas | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private initialized = false;
  private nodeStage: NodeContainer;

  constructor() {
    this.nodeStage = new NodeContainer();
  }

  get canvas(): ICanvas {
    if (!this.nodeCanvas) {
      throw new Error('Canvas not initialized - call init() first');
    }
    return new NodeCanvas(this.nodeCanvas);
  }

  get stage(): IContainer {
    return this.nodeStage;
  }

  get renderer(): IRenderer {
    return new NodeRenderer(this.nodeCanvas, this.ctx);
  }

  get ticker(): ITicker {
    return new NodeTicker();
  }

  async init(options: IPixiAppOptions): Promise<void> {
    // Create real node-canvas
    this.nodeCanvas = createCanvas(options.width, options.height);
    this.ctx = this.nodeCanvas.getContext('2d');
    
    // Set initial background
    if (typeof options.backgroundColor === 'string') {
      this.ctx.fillStyle = options.backgroundColor;
    } else if (typeof options.backgroundColor === 'number') {
      // Convert hex number to CSS color
      const hex = options.backgroundColor.toString(16).padStart(6, '0');
      this.ctx.fillStyle = `#${hex}`;
    } else {
      this.ctx.fillStyle = '#000000';
    }
    this.ctx.fillRect(0, 0, options.width, options.height);
    
    this.initialized = true;
    console.log(`📱 Initialized real Node canvas: ${options.width}x${options.height}`);
  }

  resize(width: number, height: number): void {
    if (this.nodeCanvas && this.ctx) {
      // Recreate canvas with new dimensions
      const oldCanvas = this.nodeCanvas;
      this.nodeCanvas = createCanvas(width, height);
      this.ctx = this.nodeCanvas.getContext('2d');
      
      // Copy old content if it fits
      if (oldCanvas) {
        this.ctx.drawImage(oldCanvas, 0, 0);
      }
    }
  }

  destroy(): void {
    this.nodeCanvas = null;
    this.ctx = null;
    this.initialized = false;
  }
}

class NodeCanvas implements ICanvas {
  constructor(private canvas: Canvas) {}

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  toBuffer(format: 'image/png' | 'image/jpeg' = 'image/png'): Buffer {
    try {
      if (format === 'image/jpeg') {
        return this.canvas.toBuffer('image/jpeg', { quality: 0.8 });
      }
      return this.canvas.toBuffer('image/png');
    } catch (error) {
      console.error('❌ Failed to extract canvas buffer:', error);
      return Buffer.alloc(0);
    }
  }

  getContext(type: '2d'): CanvasRenderingContext2D {
    return this.canvas.getContext(type);
  }
}

class NodeRenderer implements IRenderer {
  constructor(private canvas?: Canvas | null, private ctx?: CanvasRenderingContext2D | null) {}

  resize(width: number, height: number): void {
    // Resize is handled by the app itself
  }

  render(container: IContainer): void {
    if (!this.ctx || !this.canvas) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render container hierarchy
    this.renderContainer(container, this.ctx);
  }

  private renderContainer(container: IContainer, ctx: CanvasRenderingContext2D): void {
    if (!container.visible || container.alpha <= 0) return;

    ctx.save();
    
    // Apply transform
    ctx.globalAlpha *= container.alpha;
    ctx.translate(container.x, container.y);
    ctx.scale(container.scale.x, container.scale.y);
    
    // Render this container's content
    if (container instanceof NodeSprite) {
      this.renderSprite(container, ctx);
    } else if (container instanceof NodeText) {
      this.renderText(container, ctx);
    }
    
    // Render children
    for (const child of container.children) {
      this.renderContainer(child, ctx);
    }
    
    ctx.restore();
  }

  private renderSprite(sprite: NodeSprite, ctx: CanvasRenderingContext2D): void {
    const texture = sprite.texture as NodeTexture;
    console.log(`🖼️ Rendering sprite: ${sprite.width}x${sprite.height}, has image: ${!!texture.image}`);
    
    if (texture.image) {
      ctx.save();
      
      // Apply anchor
      const anchorX = sprite.anchor.x * sprite.width;
      const anchorY = sprite.anchor.y * sprite.height;
      ctx.translate(-anchorX, -anchorY);
      
      // Draw image
      ctx.drawImage(texture.image, 0, 0, sprite.width, sprite.height);
      console.log(`✅ Drew image at (${-anchorX}, ${-anchorY}) size ${sprite.width}x${sprite.height}`);
      
      ctx.restore();
    } else {
      console.warn(`⚠️ Sprite has no image to render`);
    }
  }

  private renderText(text: NodeText, ctx: CanvasRenderingContext2D): void {
    if (!text.text) return;

    ctx.save();
    
    const style = text.style;
    
    // Set font
    let fontString = '';
    if (style.fontWeight) fontString += style.fontWeight + ' ';
    if (style.fontSize) fontString += style.fontSize + 'px ';
    if (style.fontFamily) fontString += style.fontFamily;
    else fontString += 'Arial';
    
    ctx.font = fontString;
    ctx.textAlign = (style.align as CanvasTextAlign) || 'left';
    ctx.textBaseline = 'top';
    
    // Set fill color
    if (style.fill) {
      if (typeof style.fill === 'number') {
        const hex = style.fill.toString(16).padStart(6, '0');
        ctx.fillStyle = `#${hex}`;
      } else {
        ctx.fillStyle = style.fill;
      }
    } else {
      ctx.fillStyle = '#ffffff';
    }
    
    // Set stroke
    if (style.stroke && style.strokeThickness) {
      if (typeof style.stroke === 'number') {
        const hex = style.stroke.toString(16).padStart(6, '0');
        ctx.strokeStyle = `#${hex}`;
      } else {
        ctx.strokeStyle = style.stroke;
      }
      ctx.lineWidth = style.strokeThickness;
    }
    
    // Apply anchor (for text, anchor affects the position)
    const metrics = ctx.measureText(text.text);
    let x = 0;
    let y = 0;
    
    if ((text as any).anchor) {
      const anchor = (text as any).anchor;
      x -= metrics.width * anchor.x;
      y -= (style.fontSize || 20) * anchor.y;
    }
    
    // Draw text
    if (style.stroke && style.strokeThickness) {
      ctx.strokeText(text.text, x, y);
    }
    ctx.fillText(text.text, x, y);
    
    ctx.restore();
  }
}

class NodeTicker implements ITicker {
  private callbacks = new Set<() => void>();
  private intervalId: NodeJS.Timeout | null = null;
  private _deltaTime = 1;
  private lastTime = 0;

  get deltaTime(): number {
    return this._deltaTime;
  }

  add(fn: () => void): void {
    this.callbacks.add(fn);
    this.startIfNeeded();
  }

  remove(fn: () => void): void {
    this.callbacks.delete(fn);
    this.stopIfEmpty();
  }

  start(): void {
    this.startIfNeeded();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private startIfNeeded(): void {
    if (this.callbacks.size > 0 && !this.intervalId) {
      this.lastTime = Date.now();
      this.intervalId = setInterval(() => {
        const now = Date.now();
        this._deltaTime = (now - this.lastTime) / (1000 / 60);
        this.lastTime = now;

        for (const callback of this.callbacks) {
          callback();
        }
      }, 1000 / 60);
    }
  }

  private stopIfEmpty(): void {
    if (this.callbacks.size === 0 && this.intervalId) {
      this.stop();
    }
  }
}

class NodeContainer implements IContainer {
  private childElements: IContainer[] = [];
  private _x: number = 0;
  private _y: number = 0;
  private _alpha: number = 1;
  private _visible: boolean = true;
  private _scaleX: number = 1;
  private _scaleY: number = 1;
  private _label?: string;

  get children(): IContainer[] {
    return this.childElements;
  }

  get x(): number { return this._x; }
  set x(value: number) { this._x = value; }

  get y(): number { return this._y; }
  set y(value: number) { this._y = value; }

  get alpha(): number { return this._alpha; }
  set alpha(value: number) { this._alpha = value; }

  get visible(): boolean { return this._visible; }
  set visible(value: boolean) { this._visible = value; }

  get scale(): { x: number; y: number; set(value: number): void } {
    const container = this;
    return {
      get x() { return container._scaleX; },
      set x(value: number) { container._scaleX = value; },
      get y() { return container._scaleY; },
      set y(value: number) { container._scaleY = value; },
      set: (value: number) => { container._scaleX = container._scaleY = value; }
    };
  }

  get label(): string | undefined { return this._label; }
  set label(value: string | undefined) { this._label = value; }

  addChild(child: IContainer): void {
    this.childElements.push(child);
  }

  removeChild(child: IContainer): void {
    const index = this.childElements.indexOf(child);
    if (index >= 0) {
      this.childElements.splice(index, 1);
    }
  }

  removeChildren(): void {
    this.childElements.length = 0;
  }
}

class NodeSprite extends NodeContainer implements ISprite {
  private _texture: ITexture = new NodeTexture();
  private _width: number = 100;
  private _height: number = 100;
  private _anchorX: number = 0;
  private _anchorY: number = 0;
  private _rotation: number = 0;

  get texture(): ITexture { return this._texture; }
  set texture(value: ITexture) { 
    this._texture = value; 
    // Update dimensions based on texture
    this._width = value.width;
    this._height = value.height;
  }

  get width(): number { return this._width; }
  set width(value: number) { this._width = value; }

  get height(): number { return this._height; }
  set height(value: number) { this._height = value; }

  get anchor(): { x: number; y: number; set(x: number, y?: number): void } {
    const sprite = this;
    return {
      get x() { return sprite._anchorX; },
      set x(value: number) { sprite._anchorX = value; },
      get y() { return sprite._anchorY; },
      set y(value: number) { sprite._anchorY = value; },
      set: (x: number, y?: number) => { 
        sprite._anchorX = x; 
        sprite._anchorY = y !== undefined ? y : x; 
      }
    };
  }

  get rotation(): number { return this._rotation; }
  set rotation(value: number) { this._rotation = value; }
}

class NodeText extends NodeContainer implements IText {
  private _anchorX: number = 0;
  private _anchorY: number = 0;

  constructor(private textValue: string = '', private textStyle?: ITextStyle) {
    super();
  }

  get text(): string { return this.textValue; }
  set text(value: string) { this.textValue = value; }

  get style(): ITextStyle { return this.textStyle || {}; }
  set style(value: ITextStyle) { this.textStyle = value; }

  get anchor(): { x: number; y: number; set(x: number, y?: number): void } {
    const text = this;
    return {
      get x() { return text._anchorX; },
      set x(value: number) { text._anchorX = value; },
      get y() { return text._anchorY; },
      set y(value: number) { text._anchorY = value; },
      set: (x: number, y?: number) => { 
        text._anchorX = x; 
        text._anchorY = y !== undefined ? y : x; 
      }
    };
  }
}

export class NodeTexture implements ITexture {
  private _width: number = 100;
  private _height: number = 100;
  private _source: any = null;
  public image?: any; // Canvas-compatible image

  constructor(image?: any, width?: number, height?: number) {
    this.image = image;
    if (width) this._width = width;
    if (height) this._height = height;
    if (image && image.width && image.height) {
      this._width = image.width;
      this._height = image.height;
    }
  }

  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get source(): any { return this._source; }
  
  setSource(source: any, width?: number, height?: number): void {
    this._source = source;
    this.image = source;
    if (width) this._width = width;
    if (height) this._height = height;
    if (source && source.width && source.height) {
      this._width = source.width;
      this._height = source.height;
    }
  }
}