import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ONE-TIME ROUTE — delete after use
export async function POST(req: Request) {
  const { secret, email, role } = await req.json()
  if (secret !== "orisalign-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Create auth user properly via admin SDK (sets password hash, identity, etc.)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: "ChangeMe@2026!",
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Upsert into public.users with the given role
  const { error: dbError } = await supabase
    .from("users")
    .upsert([{ id: data.user.id, email, role }], { onConflict: "id" })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true, id: data.user.id })
}
