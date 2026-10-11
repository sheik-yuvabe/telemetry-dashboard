-- Run after schema.sql. Existing reports remain in Batch 1.
begin;
create table if not exists public.batches (
  id text primary key, name text not null,
  status text not null check (status in ('active', 'archived'))
);
insert into public.batches values ('batch-1', 'Batch 1', 'archived'), ('batch-2', 'Batch 2', 'active') on conflict do nothing;

create table if not exists public.shared_accounts (
  id text primary key, name text not null, capacity integer not null check (capacity in (2, 4))
);
create table if not exists public.batch_students (
  batch_id text not null references public.batches(id),
  student_id text not null, name text not null,
  account_id text references public.shared_accounts(id),
  primary key (batch_id, student_id)
);
create table if not exists public.student_projects (
  id text primary key, batch_id text not null, student_id text not null,
  name text not null, description text not null default '',
  status text not null check (status in ('planning', 'building', 'review', 'shipped')),
  progress integer not null default 0 check (progress between 0 and 100),
  repository_url text,
  foreign key (batch_id, student_id) references public.batch_students(batch_id, student_id),
  unique (batch_id, student_id, id)
);
create table if not exists public.usage_events (
  batch_id text not null references public.batches(id), event_id text not null,
  student_id text, project_id text,
  account_id text not null references public.shared_accounts(id),
  session_id text not null, occurred_at timestamptz not null,
  input_tokens bigint not null check (input_tokens between 0 and 1000000000),
  output_tokens bigint not null check (output_tokens between 0 and 1000000000),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens between 0 and input_tokens),
  source text not null,
  primary key (batch_id, event_id),
  foreign key (batch_id, student_id) references public.batch_students(batch_id, student_id),
  foreign key (batch_id, student_id, project_id) references public.student_projects(batch_id, student_id, id),
  check (project_id is null or student_id is not null)
);
alter table public.telemetry_reports add column if not exists batch_id text not null default 'batch-1' references public.batches(id);
alter table public.telemetry_reports add column if not exists project_id text references public.student_projects(id);
create index if not exists telemetry_reports_batch_student_date_idx on public.telemetry_reports(batch_id, student_id, report_date desc, created_at desc);
create index if not exists usage_events_batch_date_idx on public.usage_events(batch_id, occurred_at);

-- Preserve real historical enrollment, without creating fictional Batch 2 students.
insert into public.batch_students(batch_id, student_id, name)
select distinct on (batch_id, student_id) batch_id, student_id, student_name
from public.telemetry_reports order by batch_id, student_id, created_at desc
on conflict do nothing;

alter table public.batches enable row level security;
alter table public.shared_accounts enable row level security;
alter table public.batch_students enable row level security;
alter table public.student_projects enable row level security;
alter table public.usage_events enable row level security;
grant select, insert, update, delete on public.batches, public.shared_accounts, public.batch_students, public.student_projects, public.usage_events to service_role;
commit;
