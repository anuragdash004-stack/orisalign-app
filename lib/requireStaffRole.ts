import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the caller is a logged-in staff member with an allowed role,
 * for API routes that mutate money/records and must not trust a
 * client-supplied actorEmail/actorRole (those are just audit-trail labels,
 * not proof of who's calling — anyone who knows an appointment's UUID could
 * otherwise POST straight to the route and fabricate a payment).
 *
 * Reads the Supabase access token from `Authorization: Bearer <token>`,
 * verifies it against Supabase Auth, then looks up the caller's role the
 * same way app/(dashboard)/layout.js does client-side — this is that same
 * check, enforced server-side where it can't be skipped.
 */
export async function requireStaffRole(
  req: Request,
  allowedRoles: string[]
): Promise<
  | { ok: true; userId: string; email: string; role: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }

  const { data: roleRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  const role = roleRow?.role || "";
  if (!allowedRoles.includes(role)) {
    return { ok: false, status: 403, error: "Not authorized" };
  }

  return { ok: true, userId: userData.user.id, email: userData.user.email || "", role };
}
