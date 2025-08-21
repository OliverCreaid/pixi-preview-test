export interface RenderJob {
  id: string;
  projectData: Record<string, unknown>;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  filePath?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface RenderRequest {
  projectData: Record<string, unknown>;
  outputFormat?: "webm" | "mp4";
  quality?: "low" | "medium" | "high";
}

export interface RenderResponse {
  jobId: string;
  status: string;
  message?: string;
}
