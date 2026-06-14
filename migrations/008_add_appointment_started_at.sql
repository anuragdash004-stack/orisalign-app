-- Records the timestamp when the dentist verified the patient's OTP to
-- start the in-person Scanning and Provisional Planning appointment.
-- Used by the patient Report tab as the completion time for that step.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS appointment_started_at TIMESTAMPTZ;
