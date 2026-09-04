-- Stores each patient's FCM device tokens, so a journey-step notification
-- can be pushed to their phone alongside the existing email/WhatsApp sends.
-- An array (not a single column) because a patient may have the app
-- installed on more than one device, or reinstall and get a new token
-- without the old one ever being explicitly removed.

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS push_tokens JSONB NOT NULL DEFAULT '[]'::jsonb;
