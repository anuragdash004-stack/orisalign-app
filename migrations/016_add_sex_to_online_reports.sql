-- Online Smile Report upload form now collects gender at step 1.
alter table online_reports add column if not exists sex text;
