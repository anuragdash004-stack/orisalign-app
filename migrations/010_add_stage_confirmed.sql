-- Tracks whether a lead's current stage occurrence (Callback / Follow-up) has
-- been actively confirmed by staff, as opposed to just landing there because
-- its callback_date/followup_date happens to fall on the viewed day. Reset to
-- false whenever a lead newly enters (or is rescheduled within) Callback or
-- Follow-ups, so the row shows as unworked (black) until staff explicitly
-- re-picks its stage from the dropdown, at which point it turns green.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS stage_confirmed BOOLEAN NOT NULL DEFAULT true;
