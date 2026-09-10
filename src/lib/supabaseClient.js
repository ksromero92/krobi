import { createClient } from '@supabase/supabase-js';

let client;

export function getSupabase() {
    if (client) return client;

    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // NO imprime secretos; solo flags
    console.warn('Supabase ENV flags → url:', !!url, 'key:', !!key);

    if (!url) throw new Error('Falta VITE_SUPABASE_URL');
    if (!key) throw new Error('Falta VITE_SUPABASE_ANON_KEY');

    client = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return client;
}
