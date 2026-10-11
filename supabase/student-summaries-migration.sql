-- Apply after batch-2-migration.sql. No provider keys or student content in this migration.
begin;
create table if not exists public.student_summaries (
  scope_key text primary key, batch_id text not null, student_id text not null,
  scope jsonb not null, saved jsonb not null,
  foreign key (batch_id, student_id) references public.batch_students(batch_id, student_id)
);
create table if not exists public.student_summary_locks (
  batch_id text not null, student_id text not null, request_id uuid,
  lease_until timestamptz, last_attempt_at timestamptz,
  primary key (batch_id, student_id),
  foreign key (batch_id, student_id) references public.batch_students(batch_id, student_id)
);
create index if not exists student_history_cursor_idx on public.telemetry_reports(batch_id, student_id, report_date desc, created_at desc, id desc);
alter table public.student_summaries enable row level security;
alter table public.student_summary_locks enable row level security;
grant select, insert, update, delete on public.student_summaries, public.student_summary_locks to service_role;

create or replace function public.claim_student_summary(p_batch text, p_student text, p_request uuid)
returns boolean language plpgsql set search_path = public as $$
declare claimed integer;
begin
  insert into student_summary_locks(batch_id, student_id) values(p_batch, p_student) on conflict do nothing;
  update student_summary_locks set request_id=p_request, lease_until=now()+interval '180 seconds', last_attempt_at=now()
    where batch_id=p_batch and student_id=p_student
      and (lease_until is null or lease_until < now())
      and (last_attempt_at is null or last_attempt_at < now()-interval '60 seconds');
  get diagnostics claimed = row_count;
  return claimed = 1;
end; $$;

create or replace function public.finish_student_summary(p_batch text, p_student text, p_request uuid, p_scope_key text, p_scope jsonb, p_saved jsonb)
returns boolean language plpgsql set search_path = public as $$
begin
  perform 1 from student_summary_locks where batch_id=p_batch and student_id=p_student and request_id=p_request and lease_until > now() for update;
  if not found then return false; end if;
  if p_saved is not null then
    insert into student_summaries(scope_key,batch_id,student_id,scope,saved) values(p_scope_key,p_batch,p_student,p_scope,p_saved)
      on conflict(scope_key) do update set saved=excluded.saved, scope=excluded.scope;
  end if;
  update student_summary_locks set lease_until=null, request_id=null where batch_id=p_batch and student_id=p_student and request_id=p_request;
  return true;
end; $$;
revoke all on function public.claim_student_summary(text,text,uuid) from public, anon, authenticated;
revoke all on function public.finish_student_summary(text,text,uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.claim_student_summary(text,text,uuid) to service_role;
grant execute on function public.finish_student_summary(text,text,uuid,text,jsonb,jsonb) to service_role;
commit;
