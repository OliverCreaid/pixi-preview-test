/**
 * Browser implementation of PIXI factory using pixi.js
 */

import { Application, Container, Sprite, Text, Texture, Ticker } from 'pixi.js';
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

export class BrowserPixiFactory implements IPixiFactory {
  createApplication(): IPixiApp {
    return new BrowserPixiApp();
  }

  createContainer(): IContainer {
    return new BrowserContainer(new Container());
  }

  createSprite(texture: ITexture): ISprite {
    return new BrowserSprite(new Sprite((texture as BrowserTexture).texture));
  }

  createText(text: string, style?: ITextStyle): IText {
    return new BrowserText(new Text({ text, style }));
  }

  createTexture(source: any): ITexture {
    return new BrowserTexture(Texture.from(source));
  }
}

class BrowserPixiApp implements IPixiApp {
  private app: Application;

  constructor() {
    this.app = new Application();
  }

  get canvas(): ICanvas {
    return new BrowserCanvas(this.app.canvas);
  }

  get stage(): IContainer {
    return new BrowserContainer(this.app.stage);
  }

  get renderer(): IRenderer {
    return new BrowserRenderer(this.app.renderer);
  }

  get ticker(): ITicker {
    return new BrowserTicker(this.app.ticker);
  }

  async init(options: IPixiAppOptions): Promise<void> {
    await this.app.init({
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor,
      antialias: options.antialias,
      resolution: options.resolution || window.devicePixelRatio || 1,
      autoDensity: true,
    });
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}

class BrowserCanvas implements ICanvas {
  constructor(public canvas: HTMLCanvasElement) {}

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  getContext(type: string): any {
    return this.canvas.getContext(type);
  }
}

class BrowserRenderer implements IRenderer {
  constructor(private renderer: any) {}

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }
}

class BrowserTicker implements ITicker {
  constructor(private ticker: Ticker) {}

  get deltaTime(): number {
    return this.ticker.deltaTime;
  }

  add(fn: () => void): void {
    this.ticker.add(fn);
  }

  remove(fn: () => void): void {
    this.ticker.remove(fn);
  }

  start(): void {
    this.ticker.start();
  }

  stop(): void {
    this.ticker.stop();
  }
}

class BrowserContainer implements IContainer {
  constructor(public container: Container) {}

  get children(): IContainer[] {
    return this.container.children.map(child => new BrowserContainer(child as Container));
  }

  get x(): number {
    return this.container.x;
  }

  set x(value: number) {
    this.container.x = value;
  }

  get y(): number {
    return this.container.y;
  }

  set y(value: number) {
    this.container.y = value;
  }

  get alpha(): number {
    return this.container.alpha;
  }

  set alpha(value: number) {
    this.container.alpha = value;
  }

  get visible(): boolean {
    return this.container.visible;
  }

  set visible(value: boolean) {
    this.container.visible = value;
  }

  get scale(): { x: number; y: number; set(value: number): void } {
    return {
      x: this.container.scale.x,
      y: this.container.scale.y,
      set: (value: number) => this.container.scale.set(value)
    };
  }

  get label(): string | undefined {
    return this.container.label;
  }

  set label(value: string | undefined) {
    this.container.label = value;
  }

  addChild(child: IContainer): void {
    this.container.addChild((child as BrowserContainer).container);
  }

  removeChild(child: IContainer): void {
    this.container.removeChild((child as BrowserContainer).container);
  }

  removeChildren(): void {
    this.container.removeChildren();
  }
}

class BrowserSprite extends BrowserContainer implements ISprite {
  private sprite: Sprite;

  constructor(sprite: Sprite) {
    super(sprite);
    this.sprite = sprite;
  }

  get texture(): ITexture {
    return new BrowserTexture(this.sprite.texture);
  }

  set texture(value: ITexture) {
    this.sprite.texture = (value as BrowserTexture).texture;
  }

  get width(): number {
    return this.sprite.width;
  }

  set width(value: number) {
    this.sprite.width = value;
  }

  get height(): number {
    return this.sprite.height;
  }

  set height(value: number) {
    this.sprite.height = value;
  }

  get anchor(): { x: number; y: number; set(x: number, y?: number): void } {
    return {
      x: this.sprite.anchor.x,
      y: this.sprite.anchor.y,
      set: (x: number, y?: number) => this.sprite.anchor.set(x, y)
    };
  }

  get rotation(): number {
    return this.sprite.rotation;
  }

  set rotation(value: number) {
    this.sprite.rotation = value;
  }
}

class BrowserText extends BrowserContainer implements IText {
  private text: Text;

  constructor(text: Text) {
    super(text);
    this.text = text;
  }

  get text(): string {
    return this.text.text;
  }

  set text(value: string) {
    this.text.text = value;
  }

  get style(): ITextStyle {
    return this.text.style;
  }

  set style(value: ITextStyle) {
    this.text.style = value;
  }
}

export class BrowserTexture implements ITexture {
  constructor(public texture: Texture) {}

  get width(): number {
    return this.texture.width;
  }

  get height(): number {
    return this.texture.height;
  }

  get source(): any {
    return this.texture.source;
  }
}