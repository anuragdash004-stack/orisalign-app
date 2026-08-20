-- Proper Doctors directory — replaces the ad-hoc report_reviewers table.
-- Four fields as requested: name, designation, registration number,
-- location — plus role_type (dentist/orthodontist) to mirror the existing
-- assigned_dentist/assigned_ortho split used elsewhere in the app.
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text not null,
  registration_number text,
  location text,
  role_type text not null check (role_type in ('dentist', 'orthodontist')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into doctors (name, designation, registration_number, location, role_type)
select 'Dr. Anurag Dash', 'BDS', 'REG-NUMBER-TBD', 'Bhubaneswar', 'dentist'
where not exists (select 1 from doctors where name = 'Dr. Anurag Dash');

insert into doctors (name, designation, registration_number, location, role_type)
select 'Consultant Orthodontist', 'MDS (Orthodontics)', 'REG-NUMBER-TBD', 'Bhubaneswar', 'orthodontist'
where not exists (select 1 from doctors where name = 'Consultant Orthodontist');

-- online_reports now assigns a doctor from this table instead of the old
-- report_reviewers table. reviewer_id is left in place (unused) rather than
-- dropped, in case any test data still references it.
alter table online_reports add column if not exists doctor_id uuid references doctors(id);
