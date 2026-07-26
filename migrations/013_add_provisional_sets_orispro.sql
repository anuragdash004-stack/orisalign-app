-- Ortho's Provisional Planning step stores the number of aligner sets
-- required (basis: OrisPro, 15 days/set) — the OrisPro Plus (10 days/set)
-- duration is derived from this same count at display time, not stored
-- separately. See app/(dashboard)/ortho/[id]/page.js.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS provisional_sets_orispro INTEGER;
