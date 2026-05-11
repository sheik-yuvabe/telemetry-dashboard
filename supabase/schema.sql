create extension if not exists pgcrypto;

create table if not exists public.telemetry_reports (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  student_name text not null,
  report_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  month integer not null check (month between 1 and 12),
  week integer not null check (week between 1 and 5),
  day integer not null check (day between 1 and 7),
  lesson_path text,
  assignment_path text,
  lesson_confidence text not null check (lesson_confidence in ('high', 'medium', 'low')),
  understanding_status text not null check (understanding_status in ('clear', 'partial', 'stuck')),
  progress_score integer not null check (progress_score between 0 and 100),
  confidence_score integer not null check (confidence_score between 0 and 100),
  gap_categories jsonb not null default '[]'::jsonb,
  summary text not null,
  likely_causes jsonb not null default '[]'::jsonb,
  recommended_tutor_action text not null,
  repeated_topic_signals integer not null default 0,
  trigger_reason text not null,
  report_fingerprint text
);

alter table public.telemetry_reports
  add column if not exists report_fingerprint text;

alter table public.telemetry_reports enable row level security;

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.telemetry_reports
  to service_role;

create index if not exists telemetry_reports_report_date_idx
  on public.telemetry_reports (report_date desc);

create index if not exists telemetry_reports_student_id_idx
  on public.telemetry_reports (student_id, report_date desc);

create unique index if not exists telemetry_reports_report_fingerprint_idx
  on public.telemetry_reports (report_fingerprint)
  where report_fingerprint is not null;
