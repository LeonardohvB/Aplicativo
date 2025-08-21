import { createClient } from '@supabase/supabase-js';

// Tentar obter as variáveis de ambiente do Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                   import.meta.env.SUPABASE_URL || 
                   process.env.VITE_SUPABASE_URL || 
                   process.env.SUPABASE_URL || '';
                   
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                       import.meta.env.SUPABASE_ANON_KEY || 
                       process.env.VITE_SUPABASE_ANON_KEY || 
                       process.env.SUPABASE_ANON_KEY || '';

// Function to validate URL format
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Create a proper mock query builder that supports chaining
const createMockQueryBuilder = () => {
  const mockError = { message: 'Supabase not configured' };
  
  const mockQuery = {
    select: () => mockQuery,
    insert: () => mockQuery,
    update: () => mockQuery,
    delete: () => mockQuery,
    order: () => mockQuery,
    limit: () => mockQuery,
    eq: () => mockQuery,
    neq: () => mockQuery,
    gt: () => mockQuery,
    gte: () => mockQuery,
    lt: () => mockQuery,
    lte: () => mockQuery,
    like: () => mockQuery,
    ilike: () => mockQuery,
    is: () => mockQuery,
    in: () => mockQuery,
    contains: () => mockQuery,
    containedBy: () => mockQuery,
    rangeGt: () => mockQuery,
    rangeGte: () => mockQuery,
    rangeLt: () => mockQuery,
    rangeLte: () => mockQuery,
    rangeAdjacent: () => mockQuery,
    overlaps: () => mockQuery,
    textSearch: () => mockQuery,
    match: () => mockQuery,
    not: () => mockQuery,
    or: () => mockQuery,
    filter: () => mockQuery,
    single: () => Promise.resolve({ data: null, error: mockError }),
    maybeSingle: () => Promise.resolve({ data: null, error: mockError }),
    then: (resolve: any) => resolve({ data: null, error: mockError }),
    catch: (reject: any) => Promise.resolve({ data: null, error: mockError })
  };

  return mockQuery;
};

let supabase: any;
let isSupabaseConfigured = false;

if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) {
  console.warn('⚠️ Supabase environment variables not found or invalid. Using fallback configuration.');
  isSupabaseConfigured = false;
  // Create a mock client that properly supports method chaining
  supabase = {
    from: () => createMockQueryBuilder(),
    rpc: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    auth: {
      signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      signIn: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  };
} else {
  isSupabaseConfigured = true;
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase, isSupabaseConfigured };