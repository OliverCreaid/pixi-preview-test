import { ProjectData } from '../types.js';

export interface RenderJob {
  id: string;
  projectData: ProjectData;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  filePath?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface RenderRequest {
  projectData: ProjectData;
  outputFormat?: "webm" | "mp4";
  quality?: "low" | "medium" | "high";
}

export interface RenderResponse {
  jobId: string;
  status: string;
  message?: string;
}
