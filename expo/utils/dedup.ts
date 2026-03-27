import { ImportedWorkout } from '@/constants/types';

export function isDuplicateByExternalId(
  existing: ImportedWorkout[],
  candidate: ImportedWorkout
): boolean {
  return existing.some(
    (w) => w.sourceId === candidate.sourceId && w.source === candidate.source
  );
}

export function isDuplicateByTimeMatch(
  existing: ImportedWorkout[],
  candidate: ImportedWorkout,
  timeToleranceMs: number = 3 * 60 * 1000,
  durationTolerancePct: number = 0.05
): boolean {
  if (!candidate.startTime) return false;

  const candidateStart = new Date(candidate.startTime).getTime();
  const candidateDuration = candidate.time;

  return existing.some((w) => {
    if (!w.startTime) return false;
    if (w.type !== candidate.type) return false;

    const existingStart = new Date(w.startTime).getTime();
    const timeDiff = Math.abs(candidateStart - existingStart);
    if (timeDiff > timeToleranceMs) return false;

    const durationDiff = Math.abs(w.time - candidateDuration);
    const maxDuration = Math.max(w.time, candidateDuration, 1);
    if (durationDiff / maxDuration > durationTolerancePct) return false;

    console.log(
      `[Dedup] Match found: ${candidate.source}/${candidate.sourceId} ≈ ${w.source}/${w.sourceId}`
    );
    return true;
  });
}

export function deduplicateWorkouts(
  existing: ImportedWorkout[],
  incoming: ImportedWorkout[]
): ImportedWorkout[] {
  const newWorkouts: ImportedWorkout[] = [];

  for (const candidate of incoming) {
    if (isDuplicateByExternalId(existing, candidate)) {
      console.log(`[Dedup] Skipped (externalId match): ${candidate.sourceId}`);
      continue;
    }

    if (isDuplicateByTimeMatch([...existing, ...newWorkouts], candidate)) {
      console.log(`[Dedup] Skipped (time match): ${candidate.sourceId}`);
      continue;
    }

    newWorkouts.push(candidate);
  }

  console.log(
    `[Dedup] ${incoming.length} incoming → ${newWorkouts.length} new (${incoming.length - newWorkouts.length} duplicates)`
  );
  return newWorkouts;
}
