import { useState, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/providers/AuthProvider';

export const [IronLogProvider, useIronLog] = createContextHook(() => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
  const [fullPlan, setFullPlan] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  async function loadData() {
    setLoading(true);
    const [wp, tp, acts] = await Promise.all([
      supabase.from('weekly_plans').select('*').eq('user_id', userId).order('generated_at', { ascending: false }).limit(1).single(),
      supabase.from('training_plans').select('*').eq('user_id', userId).single(),
      supabase.from('activities').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
    ]);
    setWeeklyPlan(wp.data?.plan ?? null);
    setFullPlan(tp.data ?? null);
    setActivities(acts.data ?? []);
    setLoading(false);
  }

  async function markWorkoutComplete(weekIndex: number, dayIndex: number) {
    if (!fullPlan) return;
    const weeks = [...fullPlan.weeks];
    weeks[weekIndex].days[dayIndex].completed = true;
    await supabase.from('training_plans').update({ weeks }).eq('user_id', userId);
    setFullPlan({ ...fullPlan, weeks });
  }

  return { weeklyPlan, fullPlan, activities, loading, markWorkoutComplete, refresh: loadData };
});
