-- Adds support for:
--  - Scanning & Provisional Planning step video (uploaded by admin, viewable/downloadable by patient)
--  - Planning Done step review link (shown to patient as a "Review" button)
--  - "Others" payment type with a custom amount

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS scanning_video_url TEXT,
  ADD COLUMN IF NOT EXISTS review_link TEXT,
  ADD COLUMN IF NOT EXISTS payment_custom_amount NUMERIC;
