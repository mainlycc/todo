import { supabase } from './supabase';

/**
 * INSERT do `projects` z ponowieniem przy typowym błędzie „brak kolumny” (stary schemat w Supabase).
 */
export async function insertProjectWithSchemaFallback(row: Record<string, unknown>) {
  const first = await supabase.from('projects').insert([row]).select();
  if (!first.error) return first;

  const msg = (first.error.message || '').toLowerCase();
  const maybeColumn =
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    first.error.code === 'PGRST204';

  if (!maybeColumn) return first;

  const fewer: Record<string, unknown> = { ...row };
  delete fewer.priority;
  delete fewer.turn;
  delete fewer.emoji;
  delete fewer.link;
  delete fewer.type;

  const second = await supabase.from('projects').insert([fewer]).select();
  if (!second.error) return second;

  const minimal: Record<string, unknown> = {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description ?? '',
    notes: row.notes ?? '',
    completed: row.completed ?? false,
    tasks: row.tasks ?? [],
    created_at: row.created_at,
  };
  if (row.color != null && row.color !== '') minimal.color = row.color;

  return supabase.from('projects').insert([minimal]).select();
}
