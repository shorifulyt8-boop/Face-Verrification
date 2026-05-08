import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fiabzdpzqafjsozdvtgp.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpYWJ6ZHB6cWFmanNvemR2dGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTMyNDksImV4cCI6MjA5MzgyOTI0OX0.00BpLT4HqD_xi6BbC3spex6z96i-krYUFcqhlKuxW08';

export const supabase = createClient(supabaseUrl, supabaseKey);
