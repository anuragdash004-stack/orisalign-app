-- Links an appointments_booking row to the online_reports row it was
-- created for, so Online Smile Report leads can show up in the Lead
-- Tracker (new "Online Smile Report Leads" section, driven by stage_log
-- entries with bucket 'osr_unpaid' / 'osr_paid') using the same
-- stage_log/bucket machinery as every other lead there.
alter table appointments_booking add column if not exists online_report_id uuid references online_reports(id);
create index if not exists appointments_booking_online_report_id_idx on appointments_booking (online_report_id);
