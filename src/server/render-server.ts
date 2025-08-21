import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { RenderJob, RenderRequest, RenderResponse } from "./types.js";
import { VideoRenderer } from "./VideoRenderer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Middleware
app.use(express.json({ limit: "50mb" }));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.static(path.join(__dirname, "../../public")));

// In-memory job storage (replace with Redis/DB in production)
const jobs = new Map<string, RenderJob>();

// Ensure renders directory exists
const rendersDir = path.join(__dirname, "../../renders");
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

// Initialize video renderer
const videoRenderer = new VideoRenderer();

// Routes
app.post("/api/render", async (req, res) => {
  try {
    const { projectData }: RenderRequest = req.body;

    if (!projectData) {
      return res.status(400).json({ error: "Project data is required" });
    }

    const jobId = uuidv4();
    const job: RenderJob = {
      id: jobId,
      projectData,
      status: "queued",
      createdAt: new Date(),
    };

    jobs.set(jobId, job);

    // Start rendering (don't await - run in background)
    videoRenderer
      .render(job)
      .then((filePath) => {
        job.status = "completed";
        job.filePath = filePath;
        job.completedAt = new Date();
        jobs.set(jobId, job);
        console.log(`Render completed: ${jobId}`);
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.message;
        jobs.set(jobId, job);
        console.error(`Render failed: ${jobId}`, error);
      });

    const response: RenderResponse = {
      jobId,
      status: "queued",
      message: "Render job created successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("Error creating render job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/render/:jobId/status", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
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

app.get("/api/render/:jobId/download", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (job.status !== "completed" || !job.filePath) {
    return res
      .status(400)
      .json({ error: "Job not completed or file not available" });
  }

  const filePath = path.resolve(job.filePath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const filename = `render-${jobId}.webm`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "video/webm");

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    activeJobs: Array.from(jobs.values()).filter(
      (job) => job.status === "processing",
    ).length,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Render server running on http://localhost:${PORT}`);
  console.log(`Renders will be saved to: ${rendersDir}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down render server...");
  await videoRenderer.cleanup();
  process.exit(0);
});
