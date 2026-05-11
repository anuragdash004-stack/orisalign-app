import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sqls = [
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS journey_steps JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS payment_data JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS manufacturing_data JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS logistics_data JSONB DEFAULT '{}'",
  ];

  const results = [];
  for (const sql of sqls) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": key,
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({ sql }),
      });
      const text = await res.text();
      results.push({ sql: sql.substring(0, 60), status: res.status, response: text });
    } catch (e: any) {
      results.push({ sql: sql.substring(0, 60), error: e.message });
    }
  }

  return NextResponse.json({ results });
}
