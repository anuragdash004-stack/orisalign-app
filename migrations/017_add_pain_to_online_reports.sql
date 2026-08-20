-- Dental Self-Assessment gets a 4th item: Pain (same tooth-location picker
-- pattern as cavity/food lodgement/tooth mobility).
alter table online_reports add column if not exists pain text;
