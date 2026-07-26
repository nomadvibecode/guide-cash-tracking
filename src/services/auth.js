import { supabase } from './supabase-client.js';

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase configuration is missing.');
  }

  return supabase;
}

export async function getCurrentSession() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithEmail(email, password) {
  const client = requireSupabaseClient();

  return client.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signUpWithEmail(email, password) {
  const client = requireSupabaseClient();

  return client.auth.signUp({
    email,
    password,
  });
}

export async function signOutCurrentUser() {
  const client = requireSupabaseClient();

  return client.auth.signOut();
}