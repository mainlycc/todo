import { supabase } from './src/lib/supabase.js';

async function test() {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  console.log('Tasks schema:', data, error);
}
test();
