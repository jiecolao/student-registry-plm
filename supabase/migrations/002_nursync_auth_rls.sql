-- NurSync authentication, roles, foreign keys, and Row Level Security.
-- Run this migration in the new Supabase project before using the migrated app.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

-- Relationships for the normalized model.
alter table public.student_accounts
  add constraint student_accounts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.student_accounts
  add constraint student_accounts_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

-- student_documents should allow many document rows per student and per type,
-- but only one row for a particular student/document-type pair.
alter table public.student_documents
  drop constraint if exists student_documents_student_id_key;

alter table public.student_documents
  drop constraint if exists student_documents_document_type_id_key;

alter table public.student_documents
  add constraint student_documents_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

alter table public.student_documents
  add constraint student_documents_document_type_id_fkey
  foreign key (document_type_id) references public.document_types(id) on delete restrict;

alter table public.student_documents
  add constraint student_documents_student_document_type_key
  unique (student_id, document_type_id);

create index if not exists idx_student_documents_student_id
  on public.student_documents(student_id);

create index if not exists idx_student_documents_document_type_id
  on public.student_documents(document_type_id);

-- Helper used by RLS policies. SECURITY DEFINER avoids policy recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Enable RLS on all application tables.
alter table public.students enable row level security;
alter table public.student_accounts enable row level security;
alter table public.student_documents enable row level security;
alter table public.document_types enable row level security;
alter table public.user_roles enable row level security;

-- Students: admins have full access; students can read only their own row.
drop policy if exists "admins manage students" on public.students;
drop policy if exists "students read own student" on public.students;

create policy "admins manage students"
on public.students
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "students read own student"
on public.students
for select to authenticated
using (
  exists (
    select 1
    from public.student_accounts sa
    where sa.student_id = students.id
      and sa.user_id = auth.uid()
  )
);

-- Student account mapping: users can see only their own mapping; admins can manage all.
drop policy if exists "admins manage student accounts" on public.student_accounts;
drop policy if exists "users read own student account" on public.student_accounts;

create policy "admins manage student accounts"
on public.student_accounts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "users read own student account"
on public.student_accounts
for select to authenticated
using (user_id = auth.uid());

-- Documents: admins manage all; students can read only their own documents.
drop policy if exists "admins manage student documents" on public.student_documents;
drop policy if exists "students read own documents" on public.student_documents;

create policy "admins manage student documents"
on public.student_documents
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "students read own documents"
on public.student_documents
for select to authenticated
using (
  exists (
    select 1
    from public.student_accounts sa
    where sa.student_id = student_documents.student_id
      and sa.user_id = auth.uid()
  )
);

-- Document definitions are readable to signed-in users; only admins edit them.
drop policy if exists "authenticated read document types" on public.document_types;
drop policy if exists "admins manage document types" on public.document_types;

create policy "authenticated read document types"
on public.document_types
for select to authenticated
using (true);

create policy "admins manage document types"
on public.document_types
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- A user may read their own role; admins may read all roles.
drop policy if exists "users read own role" on public.user_roles;
drop policy if exists "admins manage roles" on public.user_roles;

create policy "users read own role"
on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "admins manage roles"
on public.user_roles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Realtime needs the tables to be in the publication. These are safe if already present.
alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.student_documents;
alter publication supabase_realtime add table public.document_types;
