import { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useTraining } from '@/providers/TrainingProvider';

export const [IronLogProvider, useIronLog] = createContextHook(() => {
  const { session } = useAuth();
  const { saveWorkout, getDailyLog } = useTraining();
  const userId = session?.user?.id ?? null;

  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
  const [fullPlan, setFullPlan] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    const [wp, tp, acts] = await Promise.all([
      supabase.from('weekly_plans').select('*').eq('user_id', userId).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('training_plans').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('activities').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60),
    ]);

    setWeeklyPlan(wp.data?.plan ?? null);
    setFullPlan(tp.data ?? null);

    const fetchedActivities = acts.data ?? [];
    setActivities(fetchedActivities);

    // Bridge Supabase activities into local dailyLogs
    for (const act of fetchedActivities) {
      const date = act.date?.split('T')[0] ?? act.start_date?.split('T')[0];
      if (!date) continue;

      const existingLog = getDailyLog(date);
      const alreadySaved = existingLog.workouts.some(
        (w: any) => w.externalId === String(act.strava_id ?? act.id)
      );
      if (alreadySaved) continue;

      const sportType = (act.sport_type ?? act.type ?? 'run').toLowerCase();
      const typeMap: Record<string, string> = {
        run: 'run', ride: 'bike', swim: 'swim',
        virtualride: 'bike', trailrun: 'run',
        walk: 'run', hike: 'run', workout: 'run',
      };

      saveWorkout(date, {
        id: `supabase_${act.id}`,
        type: typeMap[sportType] ?? 'run',
        distance: Math.round(((act.distance ?? 0) / 1000) * 100) / 100, // meters → km
        time: act.moving_time ?? act.elapsed_time ?? 0,
        elevation: act.total_elevation_gain ?? 0,
        externalId: String(act.strava_id ?? act.id),
        sourceProvider: act.source ?? 'strava',
      });
    }

    setLoading(false);
  }, [userId, saveWorkout, getDailyLog]);

  useEffect(() => { loadData(); }, [loadData]);

  return { weeklyPlan, fullPlan, activities, loading, refresh: loadData };
});
