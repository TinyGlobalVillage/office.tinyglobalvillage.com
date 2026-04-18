export type VideoJob = {
  percent: number;
  done: boolean;
  error: string | null;
  outPath: string | null;
  outMime: string;
  outExt: string;
  baseName: string;
  cleanupPaths: string[];
  createdAt: number;
};

const _global = globalThis as typeof globalThis & { __videoJobs?: Map<string, VideoJob> };
if (!_global.__videoJobs) _global.__videoJobs = new Map<string, VideoJob>();
export const videoJobs: Map<string, VideoJob> = _global.__videoJobs;

export function pruneJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
  for (const [id, job] of videoJobs) {
    if (job.createdAt < cutoff) videoJobs.delete(id);
  }
}
