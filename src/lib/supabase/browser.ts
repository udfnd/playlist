'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Browser-safe Supabase client using the publishable key. Respects Row Level Security,
// so this client can only see what RLS policies explicitly allow. Use it from client
// components for read-only access to public data (e.g. a visitor viewing a public room).
let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowser(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase public env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  cachedClient = createClient<Database>(url, publishableKey);
  return cachedClient;
}
