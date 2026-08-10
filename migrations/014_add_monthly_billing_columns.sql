-- New per-arch, month-by-month planning & billing model.
-- Additive only — existing rows/columns are untouched. New UI/logic paths
-- are gated by the presence of these columns, so in-progress patients on
-- the old OrisPro/OrisPro Plus lump-sum model keep working unchanged.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS provisional_min_months INTEGER,
  ADD COLUMN IF NOT EXISTS provisional_max_months INTEGER,
  ADD COLUMN IF NOT EXISTS final_upper_sets INTEGER,
  ADD COLUMN IF NOT EXISTS final_lower_sets INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_plan JSONB;
