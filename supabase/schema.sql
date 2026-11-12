-- Historia Clínica Médico Ocupacional — Dra. Gricel Pérez
-- Ejecutar EXCLUSIVAMENTE en el proyecto PERSONAL Supabase.
-- NO ejecutar en bases de Proporca.
-- El dueño del proyecto debe crear/autorizar manualmente cuentas de personal clínico.

create table if not exists public.clinic_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'doctor' check (role in ('doctor','assistant')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.clinic_staff enable row level security;
drop policy if exists clinic_staff_read_self on public.clinic_staff;
create policy clinic_staff_read_self
  on public.clinic_staff for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.clinic_histories (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null check (length(patient_name) between 1 and 300),
  document_number text not null default '',
  evaluation_date date,
  form_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_histories_created_by_updated_at_idx
  on public.clinic_histories (created_by, updated_at desc);

alter table public.clinic_histories enable row level security;
drop policy if exists clinic_histories_select_own on public.clinic_histories;
drop policy if exists clinic_histories_insert_own on public.clinic_histories;
drop policy if exists clinic_histories_update_own on public.clinic_histories;

create policy clinic_histories_select_own
  on public.clinic_histories for select to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.clinic_staff staff
      where staff.user_id = (select auth.uid()) and staff.active = true
    )
  );

create policy clinic_histories_insert_own
  on public.clinic_histories for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.clinic_staff staff
      where staff.user_id = (select auth.uid()) and staff.active = true
    )
  );

create policy clinic_histories_update_own
  on public.clinic_histories for update to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.clinic_staff staff
      where staff.user_id = (select auth.uid()) and staff.active = true
    )
  )
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.clinic_staff staff
      where staff.user_id = (select auth.uid()) and staff.active = true
    )
  );

-- No hay política DELETE: se evita borrado desde la aplicación.
revoke all on public.clinic_staff from anon;
revoke all on public.clinic_histories from anon;
revoke all on public.clinic_staff from authenticated;
revoke all on public.clinic_histories from authenticated;
grant select on public.clinic_staff to authenticated;
grant select, insert, update on public.clinic_histories to authenticated;

-- Ejemplo de habilitación manual después de crear una cuenta en Authentication:
-- insert into public.clinic_staff(user_id, role, active)
-- values ('UUID_DE_USUARIO_DEL_MEDICO', 'doctor', true)
-- on conflict (user_id) do update set active = true;

-- Para validar RLS: un usuario autenticado no autorizado debe obtener
-- cero historias y no poder insertar; un autorizado solo ve sus historias.
