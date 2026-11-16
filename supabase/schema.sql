-- TUNAV DIGITAL VOICE – Supabase schema
-- Run once in Supabase › SQL Editor (new project). Safe to re-run.
-- Security model:
--   * anyone with the page (anon key) can INSERT one response – nobody anonymous can read anything;
--   * only signed-in users whose email is in dv_admins can READ responses (admin page).
-- Answers are nominative (decision 2026-11-16): keep the admin list short.

create extension if not exists pgcrypto;

-- 1. Responses -------------------------------------------------------------
create table if not exists public.dv_responses (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  questionnaire_version text not null,
  lang                  text not null check (lang in ('fr', 'tn')),
  respondent_name       text not null check (char_length(respondent_name) between 2 and 120),
  respondent_position   text check (char_length(respondent_position) <= 120),
  department            text not null check (department in ('DIR','COM','SAV','ADM','TEC','IT','PI')),
  client_contact        text not null check (client_contact in ('C','N')),
  answers               jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) < 200000),
  duration_seconds      integer check (duration_seconds is null or duration_seconds between 0 and 86400)
);

create index if not exists dv_responses_created_at_idx on public.dv_responses (created_at desc);
create index if not exists dv_responses_department_idx on public.dv_responses (department);

alter table public.dv_responses enable row level security;

-- 2. Admins (emails allowed to read the answers) ---------------------------
create table if not exists public.dv_admins (
  email text primary key check (email = lower(email))
);
alter table public.dv_admins enable row level security;

create or replace function public.dv_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.dv_admins where email = lower(auth.jwt() ->> 'email'));
$$;

-- 3. Policies --------------------------------------------------------------
drop policy if exists "dv insert response" on public.dv_responses;
create policy "dv insert response" on public.dv_responses
  for insert to anon, authenticated
  with check (true);

drop policy if exists "dv admins read responses" on public.dv_responses;
create policy "dv admins read responses" on public.dv_responses
  for select to authenticated
  using (public.dv_is_admin());

drop policy if exists "dv admin sees own row" on public.dv_admins;
create policy "dv admin sees own row" on public.dv_admins
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- No UPDATE / DELETE policy: responses cannot be changed or deleted from the web pages
-- (deleting data needs the owner's approval – do it in the Supabase dashboard if ever needed).

-- 4. Add the admin(s) ------------------------------------------------------
-- Replace with the work email of the account you create in Authentication › Users, then run:
-- insert into public.dv_admins (email) values ('prenom.nom@exemple.com') on conflict do nothing;
