-- Two-sided referrals. Each patient owns one shareable code; redeeming it
-- gives the new patient ₹500 immediately, and gives the referrer ₹500 once
-- the person they referred actually pays for an aligner package (capped in
-- application code — see lib/referrals.ts).

ALTER TABLE appointments_booking
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_booking_referral_code_key
  ON appointments_booking (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  referrer_id UUID NOT NULL REFERENCES appointments_booking(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES appointments_booking(id) ON DELETE CASCADE,
  reward_amount NUMERIC NOT NULL DEFAULT 500,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  reward_credited_at TIMESTAMPTZ,
  CONSTRAINT referrals_referee_once UNIQUE (referee_id),
  CONSTRAINT referrals_not_self CHECK (referrer_id <> referee_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals (code);
