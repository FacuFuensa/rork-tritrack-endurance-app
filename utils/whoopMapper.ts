import { WhoopRawFetchResult, WhoopDailyMetrics } from '@/constants/types';

export function formatStrain(raw: number): string {
  return raw.toFixed(1);
}

export function formatSleepDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function hasRealMetrics(metrics: WhoopDailyMetrics | null | undefined): boolean {
  if (!metrics) return false;
  return metrics.rawRecovery > 0 || metrics.rawStrain > 0 || metrics.rawSleepSeconds > 0;
}

export function mapWhoopRawToDaily(raw: WhoopRawFetchResult): WhoopDailyMetrics {
  console.log('[WhoopMapper] Mapping raw data for date:', raw.date, {
    rawRecovery: raw.rawRecoveryScore,
    rawStrain: raw.rawStrain,
    rawSleepSeconds: raw.rawSleepDurationSeconds,
  });

  const mapped: WhoopDailyMetrics = {
    date: normalizeToLocalDate(raw.date),
    recoveryScore: Math.round(raw.rawRecoveryScore),
    strain: formatStrain(raw.rawStrain),
    sleepDurationSeconds: raw.rawSleepDurationSeconds,
    rawRecovery: raw.rawRecoveryScore,
    rawStrain: raw.rawStrain,
    rawSleepSeconds: raw.rawSleepDurationSeconds,
    manualOverride: false,
    syncedAt: new Date().toISOString(),
  };

  console.log('[WhoopMapper] Mapped result:', {
    recoveryScore: mapped.recoveryScore,
    strain: mapped.strain,
    sleepDisplay: formatSleepDuration(mapped.sleepDurationSeconds),
    hasRealData: mapped.rawRecovery > 0 || mapped.rawStrain > 0 || mapped.rawSleepSeconds > 0,
  });

  return mapped;
}

export function whoopTimestampToLocalDate(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function whoopSleepEndToLocalDate(startIso: string, endIso: string | undefined): string {
  const ts = endIso && endIso.length > 0 ? endIso : startIso;
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mergeWhoopMetrics(
  existing: Record<string, WhoopDailyMetrics>,
  incoming: WhoopDailyMetrics[]
): Record<string, WhoopDailyMetrics> {
  const merged = { ...existing };

  for (const metric of incoming) {
    if (!hasRealMetrics(metric)) {
      console.log('[WhoopMapper] Skipping date (no real data):', metric.date);
      continue;
    }
    const prev = merged[metric.date];
    if (prev?.manualOverride) {
      console.log('[WhoopMapper] Skipping date (manual override):', metric.date);
      merged[metric.date] = {
        ...prev,
        rawRecovery: Math.max(prev.rawRecovery, metric.rawRecovery),
        rawStrain: Math.max(prev.rawStrain, metric.rawStrain),
        rawSleepSeconds: Math.max(prev.rawSleepSeconds, metric.rawSleepSeconds),
        syncedAt: metric.syncedAt,
      };
    } else if (prev) {
      merged[metric.date] = {
        ...metric,
        recoveryScore: Math.round(Math.max(prev.rawRecovery, metric.rawRecovery)),
        strain: formatStrain(Math.max(prev.rawStrain, metric.rawStrain)),
        sleepDurationSeconds: Math.max(prev.sleepDurationSeconds, metric.sleepDurationSeconds),
        rawRecovery: Math.max(prev.rawRecovery, metric.rawRecovery),
        rawStrain: Math.max(prev.rawStrain, metric.rawStrain),
        rawSleepSeconds: Math.max(prev.rawSleepSeconds, metric.rawSleepSeconds),
      };
    } else {
      merged[metric.date] = metric;
    }
  }

  return merged;
}
function normalizeToLocalDate(dateString: string): string {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}