-- Online Smile Report — reviewer photo approve/reject, structured report
-- fields, and reviewer<->patient info-request exchange.
--
-- SHOW THIS FILE TO THE USER FOR REVIEW BEFORE RUNNING. Do not apply
-- automatically.

alter table online_reports
  -- Reviewer's structured output (order shown to patient: severity -> concern -> objectives -> duration)
  add column if not exists case_severity text check (case_severity in ('mild', 'moderate', 'severe')),
  add column if not exists dental_concerns jsonb not null default '[]'::jsonb,   -- reviewer-entered, point-wise string[]
  add column if not exists objectives jsonb not null default '[]'::jsonb,        -- reviewer-entered, point-wise string[]
  -- estimated_duration (existing text column) is reused as-is for "duration in months"

  -- Per-photo review state, keyed by the same slot keys as photo_urls.
  -- shape: { [slotKey]: { status: 'approved' | 'rejected' | 'pending', reason?: string, reviewedAt: string } }
  add column if not exists photo_review jsonb not null default '{}'::jsonb,

  -- Reviewer -> patient single-question exchange (reviewer overwrites these to ask again)
  add column if not exists reviewer_question text,
  add column if not exists reviewer_question_at timestamptz,
  add column if not exists patient_answer text,
  add column if not exists patient_answer_at timestamptz,

  -- Patient-initiated "let me edit my info" / "call me back" — timestamps only,
  -- no self-service editing; just gates the notification + on-page message.
  add column if not exists edit_requested_at timestamptz,
  add column if not exists callback_requested_at timestamptz;
