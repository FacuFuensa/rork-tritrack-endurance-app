import { DailyLog, WeeklyStats, AllTimeStats, DistanceUnit } from '@/constants/types';
import { formatDate, getWeekDates } from './dateUtils';

const DISTANCE_TO_METERS: Record<DistanceUnit, number> = {
  meters: 1,
  km: 1000,
  yards: 0.9144,
  miles: 1609.344,
};

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to || value === 0) return value;
  const meters = value * DISTANCE_TO_METERS[from];
  const result = meters / DISTANCE_TO_METERS[to];
  return Math.round(result * 1000) / 1000;
}

export function convertSpeed(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to || value === 0) return value;
  return convertDistance(value, from, to);
}

export function getEmptyDailyLog(date: string): DailyLog {
  return {
    date,
    workouts: [],
    supplementsTaken: [],
    recoveryCompleted: [],
  };
}

export function calculateWeeklyStats(
  logs: Record<string, DailyLog>,
  referenceDate: Date,
  totalSupplements: number
): WeeklyStats {
  const weekDates = getWeekDates(referenceDate);
  let totalTime = 0;
  let totalDistance = 0;
  let swimDistance = 0;
  let swimTime = 0;
  let bikeDistance = 0;
  let bikeTime = 0;
  let runDistance = 0;
  let runTime = 0;
  let totalSupplementsTaken = 0;
  let totalSupplementsPossible = 0;
  let sessionsCount = 0;

  for (const date of weekDates) {
    const key = formatDate(date);
    const log = logs[key];
    if (!log) {
      totalSupplementsPossible += totalSupplements;
      continue;
    }

    totalSupplementsTaken += log.supplementsTaken.length;
    totalSupplementsPossible += totalSupplements;

    for (const w of log.workouts) {
      totalTime += w.time;
      sessionsCount++;

      if (w.type === 'swim') {
        const miles = w.distance * 0.000621371;
        swimDistance += w.distance;
        swimTime += w.time;
        totalDistance += miles;
      } else if (w.type === 'bike') {
        bikeDistance += w.distance;
        bikeTime += w.time;
        totalDistance += w.distance;
      } else if (w.type === 'run') {
        runDistance += w.distance;
        runTime += w.time;
        totalDistance += w.distance;
      }
    }
  }

  return {
    totalTime,
    totalDistance,
    swimDistance,
    swimTime,
    bikeDistance,
    bikeTime,
    runDistance,
    runTime,
    supplementAdherence: totalSupplementsPossible > 0
      ? totalSupplementsTaken / totalSupplementsPossible
      : 0,
    sessionsCount,
  };
}

export function calculateAllTimeStats(logs: Record<string, DailyLog>): AllTimeStats {
  let totalSessions = 0;
  let totalMiles = 0;
  let swimTotal = 0;
  let swimLongest = 0;
  let bikeTotal = 0;
  let bikeLongest = 0;
  let runTotal = 0;
  let runLongest = 0;
  let totalTrainingTime = 0;
  let swimBestPace = 0;
  let bikeBestSpeed = 0;
  let runBestPace = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i <= 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const key = formatDate(checkDate);
    const log = logs[key];

    if (log && log.workouts.length > 0) {
      tempStreak++;
    } else {
      if (i === 0) continue;
      break;
    }
  }
  currentStreak = tempStreak;

  for (const log of Object.values(logs)) {
    for (const w of log.workouts) {
      totalSessions++;
      totalTrainingTime += w.time;

      if (w.type === 'swim') {
        const miles = w.distance * 0.000621371;
        swimTotal += w.distance;
        totalMiles += miles;
        if (w.distance > swimLongest) swimLongest = w.distance;
        if (w.time > 0 && w.distance > 0) {
          const pace = w.time / (w.distance / 100);
          if (swimBestPace === 0 || pace < swimBestPace) swimBestPace = pace;
        }
      } else if (w.type === 'bike') {
        bikeTotal += w.distance;
        totalMiles += w.distance;
        if (w.distance > bikeLongest) bikeLongest = w.distance;
        if (w.time > 0 && w.distance > 0) {
          const speed = w.distance / (w.time / 3600);
          if (speed > bikeBestSpeed) bikeBestSpeed = speed;
        }
      } else if (w.type === 'run') {
        runTotal += w.distance;
        totalMiles += w.distance;
        if (w.distance > runLongest) runLongest = w.distance;
        if (w.time > 0 && w.distance > 0) {
          const pace = w.time / w.distance;
          if (runBestPace === 0 || pace < runBestPace) runBestPace = pace;
        }
      }
    }
  }

  return {
    totalSessions,
    currentStreak,
    totalMiles,
    swimTotal,
    swimLongest,
    bikeTotal,
    bikeLongest,
    runTotal,
    runLongest,
    totalTrainingTime,
    swimBestPace,
    bikeBestSpeed,
    runBestPace,
  };
}

export function generateWorkoutId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
