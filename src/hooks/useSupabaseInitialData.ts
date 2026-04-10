import { useEffect, useRef, useState } from 'react';
import { ANONYMOUS_USER_ID } from '../constants';
import {
  mergeServerAndLocalDailyTimelines,
  normalizeDailyTimelineFromApiRow,
  parseDailyTimelinesFromLocalStorage,
  pushRicherTimelinesToSupabase,
} from '../lib/dailyTimeline';
import { supabase } from '../lib/supabase';
import type {
  DailyTimeline,
  Payment,
  PaymentMonthOverride,
  Project,
  ProjectTurn,
  RecurringTask,
  Task,
} from '../types';

export function useSupabaseInitialData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMonthOverrides, setPaymentMonthOverrides] = useState<PaymentMonthOverride[]>([]);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [dailyTimelines, setDailyTimelines] = useState<Record<string, DailyTimeline>>({});
  const [hasCompletedTimelineBootstrap, setHasCompletedTimelineBootstrap] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskOrder, setTaskOrder] = useState<Record<string, string[]>>({});
  const allowPersistTaskOrder = useRef(false);

  useEffect(() => {
    if (!allowPersistTaskOrder.current) return;
    supabase
      .from('user_task_order')
      .upsert(
        { user_id: ANONYMOUS_USER_ID, order_json: taskOrder },
        { onConflict: 'user_id' }
      )
      .then(({ error }) => {
        if (error) console.error('Error saving task order:', error);
      });
  }, [taskOrder]);

  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data from Supabase...');
      try {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*, subtasks(*)');

        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
          throw tasksError;
        }

        console.log('Tasks fetched:', tasksData?.length);
        if (tasksData) {
          setTasks(
            tasksData.map(t => ({
              ...t,
              subtasks: t.subtasks || [],
            }))
          );
        }

        const { data: rtData, error: rtError } = await supabase.from('recurring_tasks').select('*');

        if (rtError) console.error('Error fetching recurring tasks:', rtError);
        if (rtData) {
          console.log('Recurring tasks fetched:', rtData.length);
          setRecurringTasks(rtData);
        }

        const { data: paymentsData, error: pError } = await supabase.from('payments').select('*');

        if (pError) console.error('Error fetching payments:', pError);
        if (paymentsData) {
          console.log('Payments fetched:', paymentsData.length);
          setPayments(paymentsData);
        }

        const { data: overridesData, error: oError } = await supabase
          .from('payment_month_overrides')
          .select('*');
        if (oError) console.error('Error fetching payment month overrides:', oError);
        if (overridesData) {
          setPaymentMonthOverrides(overridesData as PaymentMonthOverride[]);
        }

        const { data: notesData, error: notesError } = await supabase.from('daily_notes').select('*');

        if (notesError) console.error('Error fetching daily notes:', notesError);
        if (notesData) {
          console.log('Daily notes fetched:', notesData.length);
          const notesMap: Record<string, string> = {};
          notesData.forEach(n => {
            notesMap[n.date] = n.content;
          });
          setDailyNotes(notesMap);
        }

        const { data: timelineData, error: timelineError } = await supabase
          .from('daily_timelines')
          .select('*');

        if (timelineError) console.error('Error fetching daily timelines:', timelineError);
        if (!timelineError && timelineData != null) {
          console.log('Daily timelines fetched:', timelineData.length);
          const timelineMap: Record<string, DailyTimeline> = {};
          timelineData.forEach(raw => {
            const t = normalizeDailyTimelineFromApiRow(raw);
            if (t) timelineMap[t.date] = t;
          });
          const fromLs = parseDailyTimelinesFromLocalStorage();
          setDailyTimelines(prev => {
            const session = { ...fromLs, ...prev };
            const merged = mergeServerAndLocalDailyTimelines(timelineMap, session);
            queueMicrotask(() => {
              void pushRicherTimelinesToSupabase(timelineMap, merged);
            });
            return merged;
          });
        } else {
          const fromLs = parseDailyTimelinesFromLocalStorage();
          setDailyTimelines(prev => {
            const next = { ...fromLs, ...prev };
            queueMicrotask(() => {
              void pushRicherTimelinesToSupabase({}, next);
            });
            return next;
          });
        }

        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (projectsError) console.error('Error fetching projects:', projectsError);
        if (projectsData && projectsData.length > 0) {
          console.log('Projects fetched:', projectsData.length);
          const list = projectsData as Project[];
          let localById = new Map<string, Project>();
          try {
            const raw = localStorage.getItem('user_projects');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                localById = new Map(
                  parsed
                    .filter((p: unknown) => p && typeof (p as Project).id === 'string')
                    .map((p: Project) => [p.id, p])
                );
              }
            }
          } catch {
            /* ignore */
          }
          const merged = list.map((p): Project => {
            const t = p.turn;
            if (t === 'mine' || t === 'theirs') return p;
            const lt = localById.get(p.id)?.turn;
            if (lt === 'mine' || lt === 'theirs') return { ...p, turn: lt as ProjectTurn };
            return { ...p, turn: 'mine' satisfies ProjectTurn };
          });
          setProjects(merged);
        } else {
          const saved = localStorage.getItem('user_projects');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.length > 0) {
                const projectsToInsert = parsed.map((p: Record<string, unknown>) => ({
                  ...p,
                  user_id: ANONYMOUS_USER_ID,
                }));
                const { data: insertedData, error: insertError } = await supabase
                  .from('projects')
                  .insert(projectsToInsert)
                  .select();

                if (!insertError && insertedData) {
                  setProjects(insertedData);
                } else {
                  setProjects(parsed);
                }
              }
            } catch {
              console.error('Failed to parse projects from local storage');
            }
          }
        }

        const { data: orderRow, error: orderErr } = await supabase
          .from('user_task_order')
          .select('order_json')
          .eq('user_id', ANONYMOUS_USER_ID)
          .maybeSingle();
        if (orderErr) console.error('Error fetching task order:', orderErr);
        if (orderRow?.order_json && typeof orderRow.order_json === 'object') {
          setTaskOrder(orderRow.order_json as Record<string, string[]>);
        } else {
          const savedOrder = localStorage.getItem('taskOrder');
          if (savedOrder) {
            try {
              const parsed = JSON.parse(savedOrder);
              setTaskOrder(parsed);
              await supabase.from('user_task_order').upsert(
                { user_id: ANONYMOUS_USER_ID, order_json: parsed },
                { onConflict: 'user_id' }
              );
            } catch (e) {
              console.error('Failed to migrate taskOrder from local storage', e);
            }
          }
        }
        allowPersistTaskOrder.current = true;
      } catch (err: unknown) {
        console.error('Error in fetchData:', err);
        allowPersistTaskOrder.current = true;
      } finally {
        setHasCompletedTimelineBootstrap(true);
      }
    };

    fetchData();
  }, []);

  return {
    tasks,
    setTasks,
    recurringTasks,
    setRecurringTasks,
    payments,
    setPayments,
    paymentMonthOverrides,
    setPaymentMonthOverrides,
    dailyNotes,
    setDailyNotes,
    dailyTimelines,
    setDailyTimelines,
    hasCompletedTimelineBootstrap,
    projects,
    setProjects,
    taskOrder,
    setTaskOrder,
    allowPersistTaskOrder,
  };
}
