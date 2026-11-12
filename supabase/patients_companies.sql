-- Dashboard: catálogos de pacientes y empresas vinculados a historias ocupacionales.
-- Ejecutar SOLO en el proyecto independiente Dra. Gricel Pérez.
create table if not exists public.clinic_companies (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 240),
  economic_activity text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clinic_companies_unique_owner_name
on public.clinic_companies (created_by, lower(btrim(name)));

create table if not exists public.clinic_patients (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 240),
  document_number text not null default '',
  birth_date date,
  gender text not null default '',
  marital_status text not null default '',
  education text not null default '',
  hand text not null default '',
  address text not null default '',
  contact text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clinic_patients_unique_owner_document
on public.clinic_patients (created_by, lower(btrim(document_number)))
where btrim(document_number) <> '';

alter table public.clinic_companies enable row level security;
alter table public.clinic_patients enable row level security;

revoke all on table public.clinic_companies from anon, authenticated;
revoke all on table public.clinic_patients from anon, authenticated;
grant select,insert,update on public.clinic_companies to authenticated;
grant select,insert,update on public.clinic_patients to authenticated;

drop policy if exists clinic_companies_select_own on public.clinic_companies;
drop policy if exists clinic_companies_insert_own on public.clinic_companies;
drop policy if exists clinic_companies_update_own on public.clinic_companies;
create policy clinic_companies_select_own on public.clinic_companies
  for select to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  );
create policy clinic_companies_insert_own on public.clinic_companies
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  );
create policy clinic_companies_update_own on public.clinic_companies
  for update to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  ) with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  );

drop policy if exists clinic_patients_select_own on public.clinic_patients;
drop policy if exists clinic_patients_insert_own on public.clinic_patients;
drop policy if exists clinic_patients_update_own on public.clinic_patients;
create policy clinic_patients_select_own on public.clinic_patients
  for select to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  );
create policy clinic_patients_insert_own on public.clinic_patients
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  );
create policy clinic_patients_update_own on public.clinic_patients
  for update to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  ) with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  );

alter table public.clinic_histories
 add column if not exists company_id uuid references public.clinic_companies(id) on delete set null,
 add column if not exists patient_id uuid references public.clinic_patients(id) on delete set null;

create index if not exists clinic_histories_patient_idx on public.clinic_histories(patient_id);
create index if not exists clinic_histories_company_idx on public.clinic_histories(company_id);

-- Proteger la relación entre historias y catálogos del usuario.
drop policy if exists clinic_histories_insert_own on public.clinic_histories;
drop policy if exists clinic_histories_update_own on public.clinic_histories;
create policy clinic_histories_insert_own on public.clinic_histories
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
    and (patient_id is null or exists (
      select 1 from public.clinic_patients p where p.id=patient_id and p.created_by=(select auth.uid())
    ))
    and (company_id is null or exists (
      select 1 from public.clinic_companies c where c.id=company_id and c.created_by=(select auth.uid())
    ))
  );
create policy clinic_histories_update_own on public.clinic_histories
  for update to authenticated using (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
  ) with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.clinic_staff s where s.user_id=(select auth.uid()) and s.active=true)
    and (patient_id is null or exists (
      select 1 from public.clinic_patients p where p.id=patient_id and p.created_by=(select auth.uid())
    ))
    and (company_id is null or exists (
      select 1 from public.clinic_companies c where c.id=company_id and c.created_by=(select auth.uid())
    ))
  );

-- Ninguna tabla puede borrarse desde el navegador ni permitir acceso anónimo.
