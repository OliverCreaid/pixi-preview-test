/**
 * New render server using the refactored architecture
 * Uses NodeEnvironment + CoreApplication instead of Puppeteer
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RenderJob, RenderRequest, RenderResponse } from './types.js';
import { NodeVideoRenderer } from './NodeVideoRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Middleware
app.use(express.json({ limit: '50mb' }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.static(path.join(__dirname, '../../public')));

// In-memory job storage
const jobs = new Map<string, RenderJob>();

// Ensure renders directory exists
const rendersDir = path.join(__dirname, '../../renders');
if (!fs.existsSync(rendersDir)) {
    fs.mkdirSync(rendersDir, { recursive: true });
}

// Initialize video renderer with new architecture
const nodeRenderer = new NodeVideoRenderer();

console.log('🖥️ Initializing Node.js video renderer...');
nodeRenderer.initialize().then(() => {
    console.log('✅ Node.js renderer ready');
}).catch(error => {
    console.error('❌ Failed to initialize renderer:', error);
});

// Routes
app.post('/api/render', async (req, res) => {
    try {
        const { projectData, ...options }: RenderRequest = req.body;

        if (!projectData) {
            return res.status(400).json({ error: 'Project data is required' });
        }

        console.log('🎬 Creating new render job with Node.js renderer');

        const jobId = uuidv4();
        const job: RenderJob = {
            id: jobId,
            projectData,
            status: 'queued',
            createdAt: new Date(),
        };

        jobs.set(jobId, job);

        // Start rendering with Node.js renderer
        const renderPromise = nodeRenderer.renderVideo(jobId, projectData, {
            frameRate: 30,
            quality: 'medium',
            format: 'mp4',
            ...options
        });

        renderPromise
            .then((filePath) => {
                job.status = 'completed';
                job.filePath = filePath;
                job.completedAt = new Date();
                jobs.set(jobId, job);
                console.log(`✅ Node.js render completed: ${jobId}`);
            })
            .catch((error) => {
                job.status = 'failed';
                job.error = error.message;
                jobs.set(jobId, job);
                console.error(`❌ Node.js render failed: ${jobId}`, error);
            });

        const response: RenderResponse = {
            jobId,
            status: 'queued',
            message: 'Render job created successfully with Node.js renderer',
        };

        res.json(response);
    } catch (error) {
        console.error('Error creating render job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/render/:jobId/status', (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
        jobId,
        status: job.status,
        progress: job.progress,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
    });
});

app.get('/api/render/:jobId/download', (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed' || !job.filePath) {
        return res.status(400).json({ error: 'Job not completed or file not available' });
    }

    const filePath = path.resolve(job.filePath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    const fileExtension = path.extname(filePath).toLowerCase();
    const filename = `render-${jobId}${fileExtension}`;

    let contentType = 'video/mp4';
    if (fileExtension === '.webm') {
        contentType = 'video/webm';
    } else if (fileExtension === '.mov') {
        contentType = 'video/quicktime';
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
});

// System info endpoint
app.get('/api/system', async (_req, res) => {
    const systemInfo = nodeRenderer.getSystemInfo();

    res.json({
        renderer: 'NodeVideoRenderer',
        architecture: 'Node.js + @pixi/node',
        systemInfo,
    });
});

// Test render endpoint
app.post('/api/test-render', async (req, res) => {
    try {
        console.log('🧪 Starting test render with Node.js architecture...');

        const testProjectPath = path.join(__dirname, '../../test-project.json');
        let projectData;

        if (fs.existsSync(testProjectPath)) {
            projectData = JSON.parse(fs.readFileSync(testProjectPath, 'utf8'));
            console.log('📁 Loaded test project from test-project.json');
        } else {
            // Create minimal test project
            projectData = {
                head: {
                    title: 'Node.js Test Render',
                    duration: 3000
                },
                scenes: [{
                    sceneTypeId: 300,
                    sceneGroupId: -1,
                    typeId: 1,
                    sceneTypeElements: [{
                        id: 1,
                        elementType: 'h1Text',
                        description: 'Test text',
                        value: 'Node.js + @pixi/node Success!',
                        properties: {
                            fontSize: 64,
                            color: '#ffffff',
                            align: 'center'
                        }
                    }]
                }]
            };
            console.log('📝 Using fallback test project');
        }

        const jobId = uuidv4();
        const job: RenderJob = {
            id: jobId,
            projectData,
            status: 'queued',
            createdAt: new Date(),
        };

        jobs.set(jobId, job);

        // Start render
        nodeRenderer.renderVideo(jobId, projectData, {
            frameRate: 30,
            quality: 'medium',
            format: 'mp4'
        }).then((filePath) => {
            job.status = 'completed';
            job.filePath = filePath;
            job.completedAt = new Date();
            jobs.set(jobId, job);
            console.log(`✅ Test render completed: ${jobId}`);
        }).catch((error) => {
            job.status = 'failed';
            job.error = error.message;
            jobs.set(jobId, job);
            console.error(`❌ Test render failed: ${jobId}`, error);
        });

        const response: RenderResponse = {
            jobId,
            status: 'queued',
            message: 'Test render job created successfully',
        };

        res.json(response);
    } catch (error) {
        console.error('Error creating test render job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        renderer: 'NodeVideoRenderer',
        timestamp: new Date().toISOString(),
        activeJobs: Array.from(jobs.values()).filter((job) => job.status === 'processing').length,
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🖥️ Node.js render server running on http://localhost:${PORT}`);
    console.log(`📁 Renders will be saved to: ${rendersDir}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down Node.js render server...');
    nodeRenderer.destroy();
    process.exit(0);
});