-- Stores the dentist-configured aligner set plan: total number of sets
-- and the wear duration (in days) per set. Used to calculate the total
-- treatment duration shown to the patient once Planning Done is marked.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS aligner_total_sets INTEGER,
  ADD COLUMN IF NOT EXISTS aligner_days_per_set INTEGER;
