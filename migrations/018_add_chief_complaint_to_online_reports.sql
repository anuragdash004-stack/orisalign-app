-- Step 2 now opens with a Chief Complaint box before the existing
-- conditions / dental self-assessment cards.
alter table online_reports add column if not exists chief_complaint text;
