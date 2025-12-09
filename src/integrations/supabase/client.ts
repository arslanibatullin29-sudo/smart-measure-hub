import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://czqatrknpxxjajsvkhvl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cWF0cmtucHh4amFqc3ZraHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzA4MjMsImV4cCI6MjA4MDcwNjgyM30.5bTT_eDwWh1ilatuD8R5PW_7D6a7dPFkM4hHJ8k5lBs";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
