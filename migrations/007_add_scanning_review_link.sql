-- Adds support for a "Pre-Treatment Scanning Review" link on the
-- Scanning and Provisional Planning step, shown to the patient as a
-- "Review" button that opens the link in a new tab.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS scanning_review_link TEXT;
