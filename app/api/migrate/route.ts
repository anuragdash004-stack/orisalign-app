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
    // ── Lead tracker: per-occurrence stage history (Old Leads section) ──
    // Each time a lead's stage/date is set, a log entry is appended instead of
    // overwritten, so past occurrences stay visible (and keep their own
    // confirmed/unconfirmed color) even after the lead moves on. Existing
    // leads already sitting in a tracked stage get a synthesized entry so
    // they don't disappear from the tracker after this ships.
    "ALTER TABLE appointments_booking ADD COLUMN IF NOT EXISTS stage_log JSONB DEFAULT '[]'::jsonb",
    `UPDATE appointments_booking SET stage_log = jsonb_build_array(jsonb_build_object(
      'bucket', CASE WHEN callback_date::text = to_char(CURRENT_DATE,'YYYY-MM-DD') THEN 'callback' ELSE 'old' END,
      'stage', 'callback',
      'date', COALESCE(callback_date::text, to_char(created_at,'YYYY-MM-DD')),
      'time', callback_time,
      'confirmed', COALESCE(stage_confirmed, true),
      'loggedAt', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) WHERE lead_stage = 'callback' AND (stage_log IS NULL OR stage_log = '[]'::jsonb)`,
    `UPDATE appointments_booking SET stage_log = jsonb_build_array(jsonb_build_object(
      'bucket', CASE WHEN followup_date::text = to_char(CURRENT_DATE,'YYYY-MM-DD') THEN 'followups' ELSE 'old' END,
      'stage', 'followups',
      'date', COALESCE(followup_date::text, to_char(created_at,'YYYY-MM-DD')),
      'time', followup_time,
      'confirmed', COALESCE(stage_confirmed, true),
      'loggedAt', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) WHERE lead_stage = 'followups' AND (stage_log IS NULL OR stage_log = '[]'::jsonb)`,
    `UPDATE appointments_booking SET stage_log = jsonb_build_array(jsonb_build_object(
      'bucket', 'booked',
      'stage', 'booked',
      'date', to_char(COALESCE(booking_confirmed_at, created_at),'YYYY-MM-DD'),
      'time', NULL,
      'confirmed', true,
      'loggedAt', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) WHERE lead_stage = 'booked' AND (stage_log IS NULL OR stage_log = '[]'::jsonb)`,
    `UPDATE appointments_booking SET stage_log = jsonb_build_array(jsonb_build_object(
      'bucket', 'denied',
      'stage', 'denied',
      'date', to_char(created_at,'YYYY-MM-DD'),
      'time', NULL,
      'confirmed', true,
      'loggedAt', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) WHERE lead_stage = 'denied' AND (stage_log IS NULL OR stage_log = '[]'::jsonb)`,
    // ── Lead tracker: Fresh Leads is log-based too, so it stops vanishing on stage change ──
    `UPDATE appointments_booking SET stage_log = COALESCE(stage_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'bucket', 'fresh',
      'stage', 'fresh',
      'date', to_char(COALESCE(promoted_at, created_at), 'YYYY-MM-DD'),
      'time', NULL,
      'confirmed', true,
      'loggedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )) WHERE lead_stage = 'fresh' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(stage_log, '[]'::jsonb)) e WHERE e->>'bucket' = 'fresh'
    )`,
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
