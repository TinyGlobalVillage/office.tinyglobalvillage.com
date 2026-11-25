// Folding@home donor hosts — shared types (client + server).
export type FoldingUnit = {
  project: number | null;
  state: string | null;
  /** 0–1 */
  progress: number | null;
  ppd: number | null;
  eta: string | null;
  cpus: number | null;
};

export type FoldingHostStatus = {
  id: string;
  label: string;
  role?: string;
  reachable: boolean;
  error?: string;
  active?: boolean;
  enabled?: boolean;
  cores?: number;
  load?: number[];
  user?: string | null;
  team?: number | null;
  cpus?: number | null;
  paused?: boolean;
  units?: FoldingUnit[];
  ppd?: number;
  stateError?: string;
};

/** Public Folding@home stats for a donor name (api.foldingathome.org). */
export type FoldingDonorStats = { name: string; score: number | null; wus: number | null; rank: number | null } | null;

export type FoldingSnapshot = { hosts: FoldingHostStatus[]; donor: FoldingDonorStats; checkedAt: string };

export type FoldingAction = "start" | "stop" | "team";
