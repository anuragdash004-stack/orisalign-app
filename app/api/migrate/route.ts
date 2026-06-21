import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sqls = [
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS journey_steps JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS payment_data JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS manufacturing_data JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS logistics_data JSONB DEFAULT '{}'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS aligner_total_sets INTEGER",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS aligner_days_per_set INTEGER",
    // ── Lead tracker ──
    "CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1001",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS lead_number BIGINT",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS lead_stage TEXT DEFAULT 'fresh'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'website'",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS lead_response TEXT",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS alt_phone TEXT",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS lead_notes TEXT",
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS clinic_location TEXT",
    "WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at) rn FROM appointments_booking WHERE lead_number IS NULL) UPDATE appointments_booking ab SET lead_number = 1000 + ordered.rn FROM ordered WHERE ab.id = ordered.id",
    "SELECT setval('lead_number_seq', GREATEST((SELECT COALESCE(MAX(lead_number),1000) FROM appointments_booking),1000))",
    "ALTER TABLE appointments_booking ALTER COLUMN lead_number SET DEFAULT nextval('lead_number_seq')",
    "UPDATE appointments_booking SET lead_stage = CASE WHEN booking_confirmed OR status <> 'lead' THEN 'booked' ELSE 'fresh' END WHERE lead_stage IS NULL",
    "UPDATE appointments_booking SET lead_source = 'website' WHERE lead_source IS NULL",
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
