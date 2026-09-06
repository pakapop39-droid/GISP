export const productionStatusProgress = {
  ACKNOWLEDGED: 0,
  MATERIAL_PREPARATION: 10,
  IN_PRODUCTION: 30,
  ASSEMBLY: 60,
  FINISHING: 85,
  PRODUCTION_COMPLETED: 100,
  DELAYED: 0,
} as const;

export type ProductionStatus = keyof typeof productionStatusProgress;

type ProductionProgressUpdate = {
  status: string;
  progress_percent: number | null;
};

export function latestProductionProgress(updates: ProductionProgressUpdate[]): number {
  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const progress = updates[index]?.progress_percent;
    if (progress !== null && progress !== undefined) return Number(progress);
  }
  return 0;
}

export function latestProductionStatus(updates: ProductionProgressUpdate[]): ProductionStatus {
  const latest = updates.at(-1)?.status;
  return latest && latest in productionStatusProgress ? latest as ProductionStatus : "ACKNOWLEDGED";
}

export function suggestedProductionProgress(status: ProductionStatus, currentProgress: number): number {
  if (status === "DELAYED") return currentProgress;
  return Math.max(currentProgress, productionStatusProgress[status]);
}
