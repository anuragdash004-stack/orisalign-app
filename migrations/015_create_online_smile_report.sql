-- Online Smile Report flow — new, self-contained feature.
-- Does NOT modify appointments_booking or any existing booking logic.
--
-- SHOW THIS FILE TO THE USER FOR REVIEW BEFORE RUNNING. Do not apply
-- automatically.

-- ── Extend existing coupons table ──────────────────────────────────────────
-- Existing rows keep discount_type='fixed', matching current discount_amount
-- semantics (an absolute rupee amount). New percentage coupons should only be
-- used by the Online Smile Report flow — the old checkout page doesn't check
-- discount_type, so a percentage coupon applied there would be misread as a
-- rupee amount.
alter table coupons
  add column if not exists discount_type text not null default 'fixed'
    check (discount_type in ('fixed', 'percentage')),
  add column if not exists max_uses integer,
  add column if not exists times_used integer not null default 0,
  add column if not exists expires_at timestamptz;

-- ── Reviewer profiles ───────────────────────────────────────────────────────
create table if not exists report_reviewers (
  id text primary key,           -- e.g. 'dr_anurag_dash'
  name text not null,
  designation text not null,
  registration_number text,      -- placeholder until real numbers are supplied
  active boolean not null default true
);

insert into report_reviewers (id, name, designation, registration_number) values
  ('dr_anurag_dash', 'Dr. Anurag Dash', 'BDS', 'REG-NUMBER-TBD'),
  ('consultant_ortho', 'Consultant Orthodontist', 'MDS (Orthodontics)', 'REG-NUMBER-TBD')
on conflict (id) do nothing;

-- ── Main submissions table ──────────────────────────────────────────────────
create table if not exists online_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- patient info
  full_name text not null,
  age integer,
  patient_phone text,
  patient_email text,

  -- medical history checkboxes + free-text "other"
  -- shape: { blood_pressure, sugar_diabetes, pcod, vitamin_deficiency,
  --          recent_surgery, asthma, pregnancy, other: string }
  conditions jsonb not null default '{}'::jsonb,

  -- dental self-assessment (free text)
  known_cavities text,
  food_lodgement text,
  tooth_mobility text,
  other_concerns text,

  -- uploads — 5 Supabase Storage paths
  photo_urls jsonb not null default '[]'::jsonb,

  -- step 1 payment
  coupon_code text,
  payment_amount numeric not null default 0,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'free_coupon')),
  razorpay_order_id text,
  razorpay_payment_id text,

  -- overall status / stage machine
  status text not null default 'new_submission'
    check (status in (
      'new_submission', 'report_ready',
      'impression_interested', 'ready_to_pay_impression', 'impression_paid', 'impression_taken',
      'plan_paid', 'treatment_started'
    )),

  -- reviewer output (filled by admin)
  estimated_duration text,
  reviewer_notes text,
  simulated_plan_url text,
  additional_photo_urls jsonb not null default '[]'::jsonb,
  reviewer_id text references report_reviewers(id),
  reviewed_at timestamptz,

  -- step 2/3 payment tracking
  impression_amount_paid numeric,
  impression_razorpay_payment_id text,
  plan_choice text check (plan_choice in ('plan_only', 'plan_treatment')),
  plan_amount_paid numeric,
  plan_razorpay_payment_id text
);

create index if not exists online_reports_status_idx on online_reports (status);
create index if not exists online_reports_created_at_idx on online_reports (created_at desc);

-- ── Zoom call bookings ───────────────────────────────────────────────────────
-- Separate table (not appointments_booking) — that table is tightly coupled
-- to the scan-booking/dentist-assignment flow and would pollute its admin
-- views. Same fixed 4-times-a-day slot pattern as the existing scan booking.
create table if not exists zoom_call_bookings (
  id uuid primary key default gen_random_uuid(),
  online_report_id uuid not null references online_reports(id),
  date date not null,
  time text not null,            -- one of "9 AM" | "11 AM" | "3:30 PM" | "5:30 PM"
  status text not null default 'booked',
  created_at timestamptz not null default now(),
  unique (date, time)
);
