import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client.
 *
 * "Keep me logged in" controls session persistence via a tiny custom storage
 * adapter:
 *   - If the user ticked the box (default) we route the session to
 *     localStorage, so it survives browser restarts.
 *   - If they unticked it, the session goes into sessionStorage, which the
 *     browser clears the moment the last tab closes.
 *
 * The login page writes a "os_remember" flag to localStorage BEFORE calling
 * supabase.auth.signInWithPassword(); the adapter reads that flag on every
 * setItem to decide which backing store to use, then mirrors removals to
 * both stores so we never leave a stale token behind.
 *
 * Server-side imports of this module (e.g. /payment, dashboard SSR) skip the
 * storage override — the default in-memory storage is correct there.
 */

let supabase: SupabaseClient | null = null;

const REMEMBER_KEY = "os_remember";

function getBrowserStorage() {
  if (typeof window === "undefined") return undefined;
  return {
    getItem(key: string) {
      // Read from either store. localStorage wins if both exist.
      return (
        window.localStorage.getItem(key) ??
        window.sessionStorage.getItem(key)
      );
    },
    setItem(key: string, value: string) {
      const remember = window.localStorage.getItem(REMEMBER_KEY) !== "0";
      if (remember) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    },
    removeItem(key: string) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    },
  };
}

export function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!url || !key) {
      console.error("Supabase ENV missing");
      return null;
    }

    const storage = getBrowserStorage();
    supabase = createClient(
      url,
      key,
      storage ? { auth: { storage } } : undefined,
    );
  }

  return supabase;
}
