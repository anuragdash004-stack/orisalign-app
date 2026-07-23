-- Fresh Leads is now log-based like every other section (Call Back/Follow-
-- ups/Booked/Denied/Old Leads): a lead's original "fresh" occurrence is
-- itself a stage_log entry, so it stays visible in Fresh Leads — frozen
-- green once confirmed — instead of disappearing the moment its stage
-- changes. See app/(dashboard)/leads/page.js (TRACKED_STAGES now includes
-- "fresh").
--
-- Existing leads sitting in lead_stage = 'fresh' predate this and have no
-- "fresh" entry in their stage_log, so without a backfill they'd vanish
-- from Fresh Leads the instant this ships. Synthesize one, marked already
-- confirmed (green) since these aren't new/pending rows — mirrors how
-- 011's backfill treated pre-existing callback/followups/booked/denied
-- leads.
UPDATE appointments_booking
SET stage_log = COALESCE(stage_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'bucket', 'fresh',
  'stage', 'fresh',
  'date', to_char(COALESCE(promoted_at, created_at), 'YYYY-MM-DD'),
  'time', NULL,
  'confirmed', true,
  'loggedAt', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
))
WHERE lead_stage = 'fresh'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(stage_log, '[]'::jsonb)) e
    WHERE e->>'bucket' = 'fresh'
  );
