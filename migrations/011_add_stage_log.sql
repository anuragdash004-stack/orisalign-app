-- Per-occurrence stage history for the Lead Tracker's "Old Leads" section.
-- Previously a lead had a single mutable lead_stage/stage_confirmed pair, so
-- moving it forward silently erased where it had been. Now every time a
-- lead's stage+date is set, a log entry is appended (never overwritten):
--   { bucket, stage, date, time, confirmed, loggedAt }
-- bucket = the stage itself when the target date is today, otherwise "old".
-- Entries never get removed or edited except flipping confirmed to true, so
-- old occurrences stay visible with their own frozen black/green state.
-- Applied in production via GET /api/migrate (see app/api/migrate/route.ts),
-- which also backfills existing callback/followups/booked/denied leads with
-- a synthesized first entry so they don't vanish from the tracker.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS stage_log JSONB DEFAULT '[]'::jsonb;
