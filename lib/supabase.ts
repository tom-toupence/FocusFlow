import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// null = localStorage-only mode (no env vars configured)
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export type UserId = string;

/** Returns the current authenticated user, or null. */
export async function getUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/** Redirects to Google OAuth. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined,
    },
  });
}

/** Signs the user out. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
