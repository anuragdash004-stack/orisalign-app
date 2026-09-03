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
 * In the installed Android app the WebView can clear localStorage on its own
 * (low storage, a force-stop on some builds, "clear cache" from app
 * settings) — the same failure mode the patient login's cookie fallback
 * (see app/login/page.js) was built around. Staff sessions live only in
 * Supabase's own storage, so they'd get silently logged out even with
 * "Keep me logged in" checked. The adapter mirrors just the refresh token
 * into a one-year cookie for that reason; restoreStaffSession() below uses
 * it to rehydrate a session that localStorage lost.
 *
 * Server-side imports of this module (e.g. /checkout, dashboard SSR) skip the
 * storage override — the default in-memory storage is correct there.
 */

let supabase: SupabaseClient | null = null;

const REMEMBER_KEY = "os_remember";
const REFRESH_COOKIE = "os_staff_rt";
const REFRESH_COOKIE_DAYS = 365;

function writeRefreshCookie(value: string) {
  try {
    document.cookie =
      REFRESH_COOKIE + "=" + encodeURIComponent(value) +
      ";path=/;max-age=" + REFRESH_COOKIE_DAYS * 24 * 60 * 60 + ";samesite=lax" +
      (location.protocol === "https:" ? ";secure" : "");
  } catch {}
}

function clearRefreshCookie() {
  try { document.cookie = REFRESH_COOKIE + "=;path=/;max-age=0;samesite=lax"; } catch {}
}

export function readRefreshCookie(): string | null {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(REFRESH_COOKIE + "="));
    return hit ? decodeURIComponent(hit.slice(REFRESH_COOKIE.length + 1)) : null;
  } catch {
    return null;
  }
}

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
      // Whatever key this is, if it looks like a Supabase auth session
      // object, keep its refresh token in the cookie backup too.
      try {
        const parsed = JSON.parse(value);
        if (parsed?.refresh_token) writeRefreshCookie(parsed.refresh_token);
      } catch {}
    },
    removeItem(key: string) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
      clearRefreshCookie();
    },
  };
}

// Called once, early, on staff-facing pages: if neither storage has a
// Supabase session (the exact loss the cookie backup exists for) but the
// refresh-token cookie survived, use it to restore the session before the
// page's own getSession() check runs. No-op if a session is already there,
// or if there's no cookie to restore from.
export async function restoreStaffSession(client: SupabaseClient) {
  if (typeof window === "undefined") return;
  const hasStoredSession =
    Object.keys(window.localStorage).some((k) => k.endsWith("-auth-token")) ||
    Object.keys(window.sessionStorage).some((k) => k.endsWith("-auth-token"));
  if (hasStoredSession) return;
  const refreshToken = readRefreshCookie();
  if (!refreshToken) return;
  const { error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error) clearRefreshCookie();
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
