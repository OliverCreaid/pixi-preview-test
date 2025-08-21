import puppeteer, { Browser } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RenderJob } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VideoRenderer {
    private browser: Browser | null = null;
    private rendersDir: string;

    constructor() {
        this.rendersDir = path.join(__dirname, '../../renders');
        this.ensureRendersDir();
    }

    private ensureRendersDir(): void {
        if (!fs.existsSync(this.rendersDir)) {
            fs.mkdirSync(this.rendersDir, { recursive: true });
        }
    }

    private async getBrowser(): Promise<Browser> {
        // Check if existing browser is still connected
        if (this.browser) {
            try {
                await this.browser.version(); // Test connection
            } catch (error) {
                console.log('Browser connection lost, restarting...');
                try {
                    await this.browser.close();
                } catch (closeError) {
                    // Ignore close errors
                }
                this.browser = null;
            }
        }

        if (!this.browser) {
            console.log('🚀 Launching Puppeteer browser...');

            // Try with explicit Chrome path and minimal config
            const launchOptions = {
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                headless: false,
                defaultViewport: { width: 1280, height: 720 },
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=VizDisplayCompositor'],
            };

            console.log('Launch options:', JSON.stringify(launchOptions, null, 2));

            try {
                this.browser = await puppeteer.launch(launchOptions);
                console.log('✅ Browser launched successfully');
            } catch (error) {
                console.error('❌ Browser launch failed:', error);

                // Fallback: try without executable path
                console.log('🔄 Trying fallback launch without explicit path...');
                this.browser = await puppeteer.launch({
                    headless: false,
                    defaultViewport: { width: 1280, height: 720 },
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                });
                console.log('✅ Browser launched with fallback config');
            }
        }
        return this.browser;
    }

    /**
     * Determine if the project data is a real project (vs test data)
     */
    private isRealProjectData(projectData: any): boolean {
        if (!projectData || typeof projectData !== 'object') {
            return false;
        }

        // Real project data has specific structure with scenes, head, etc.
        const hasRealProjectStructure = projectData.scenes && Array.isArray(projectData.scenes) && projectData.scenes.length > 0;

        // Test data usually has simple test properties
        const isTestData = projectData.test !== undefined;

        return hasRealProjectStructure && !isTestData;
    }

    async render(job: RenderJob): Promise<string> {
        let browser: Browser;
        let page: any;

        try {
            browser = await this.getBrowser();
            page = await browser.newPage();

            // Update job status
            job.status = 'processing';
            job.progress = 0;

            // Set viewport for consistent rendering
            await page.setViewport({ width: 1280, height: 720 });

            // Enable console logging from the page
            page.on('console', (msg: any) => {
                console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
            });

            page.on('pageerror', (error: any) => {
                console.error(`[Browser Error] ${error.message}`);
            });

            // Determine which page to navigate to based on project data
            const isRealProject = this.isRealProjectData(job.projectData);
            const renderUrl = isRealProject ? `http://localhost:8080/?render=true&jobId=${job.id}` : `http://localhost:8080/test-render.html?render=true&jobId=${job.id}`;

            console.log(`Starting ${isRealProject ? 'PixiJS project' : 'simple test'} render for job ${job.id}`);
            console.log(`Navigating to: ${renderUrl}`);

            await page.goto(renderUrl, {
                waitUntil: 'networkidle0',
                timeout: 60000, // Increase timeout
            });

            console.log(`Page loaded, waiting for #app element...`);

            // Wait for the preview to be ready
            await page.waitForSelector('#app', { timeout: 30000 });

            // Send project data to the page
            await page.evaluate((projectData: any) => {
                window.postMessage({ type: 'RENDER_PROJECT_DATA', projectData }, '*');
            }, job.projectData);

            // Wait for rendering to start
            await page.waitForFunction(
                () => {
                    return (window as any).renderStatus && (window as any).renderStatus.started;
                },
                { timeout: 30000 }
            );

            job.progress = 25;

            // Start video recording
            const outputPath = path.join(this.rendersDir, `${job.id}.webm`);

            // Start the recording process without waiting in evaluate
            await page.evaluate(() => {
                // Just start the render, don't wait for completion in this evaluate call
                console.log('🎬 Starting render process...');
                return true;
            });

            // Wait for completion using page event listeners instead of evaluate
            let renderCompleted = false;
            let renderError = null;

            page.on('console', (msg: any) => {
                const text = msg.text();

                // Different completion messages for different render types
                const isCompleted = isRealProject ? text.includes('🎬 Recording complete, processing video...') : text.includes('🎉 Simple render complete!');

                const isFailed = isRealProject ? text.includes('❌') && (text.includes('render') || text.includes('recording')) : text.includes('❌ Simple render failed:');

                if (isCompleted) {
                    renderCompleted = true;
                } else if (isFailed) {
                    renderError = new Error(text);
                }
            });

            // Wait for completion with a longer timeout
            const startTime = Date.now();
            const maxWaitTime = 5 * 60 * 1000; // 5 minutes

            while (!renderCompleted && !renderError && Date.now() - startTime < maxWaitTime) {
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

                // Update progress periodically
                const elapsed = Date.now() - startTime;
                const progressPercent = Math.min(75 + (elapsed / maxWaitTime) * 20, 95);
                job.progress = Math.round(progressPercent);
            }

            if (renderError) {
                throw renderError;
            }

            if (!renderCompleted) {
                throw new Error('Recording timeout after 5 minutes');
            }

            // Wait for the blob to be available on the window object
            await page.waitForFunction(
                () => {
                    return (window as any).renderBlob !== undefined;
                },
                { timeout: 60000 }
            );

            // Get the video blob from the page as base64
            const videoBlob = await page.evaluate(() => {
                const blob = (window as any).renderBlob;
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read blob'));
                    reader.readAsDataURL(blob); // Use DataURL instead of ArrayBuffer
                });
            });

            // Convert base64 data URL to Buffer and save to file
            const base64Data = (videoBlob as string).split(',')[1]; // Remove data:video/webm;base64, prefix
            const buffer = Buffer.from(base64Data, 'base64');
            const fs = await import('fs');
            fs.writeFileSync(outputPath, buffer);

            job.progress = 100;
            console.log(`Render completed for job ${job.id}, saved ${buffer.length} bytes`);
            return outputPath;
        } catch (error) {
            console.error(`Render failed for job ${job.id}:`, error);
            throw error;
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch (closeError) {
                    console.error(`Error closing page:`, closeError);
                }
            }
        }
    }

    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    // Clean up old render files (optional maintenance function)
    cleanupOldRenders(olderThanHours: number = 24): void {
        const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

        if (!fs.existsSync(this.rendersDir)) return;

        const files = fs.readdirSync(this.rendersDir);
        for (const file of files) {
            const filePath = path.join(this.rendersDir, file);
            const stats = fs.statSync(filePath);

            if (stats.mtime.getTime() < cutoffTime) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up old render file: ${file}`);
            }
        }
    }
}
