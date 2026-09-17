-- NurSync / student-registry-plm
-- Schema expected by the existing frontend.
-- Run this only if your Supabase `students` table does not already match it.

create table if not exists public.students (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists students_updated_at_idx
  on public.students (updated_at);

create index if not exists students_year_graduated_idx
  on public.students ((data ->> 'yearGraduated'));

create or replace function public.set_students_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_students_updated_at();

-- The frontend uses Supabase Realtime on public.students.
alter table public.students replica identity full;

-- SECURITY NOTE:
-- The legacy frontend currently performs client-side password matching and
-- direct CRUD. Do not enable permissive public RLS policies for production
-- student data. The frontend should be migrated to Supabase Auth + RLS before
-- real student records are exposed.
