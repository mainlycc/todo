import { useEffect, useState } from 'react';

export function useSupabaseEnv() {
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);

  useEffect(() => {
    const url = (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL;
    const key = (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env
      ?.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder') {
      setIsSupabaseConfigured(false);
    }
  }, []);

  return { isSupabaseConfigured };
}
