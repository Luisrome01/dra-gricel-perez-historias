-- Invitaciones por correo confirmado para el sistema clínico.
-- Antes de ejecutar, crear public.clinic_staff mediante schema.sql.
-- Las direcciones concretas se configuran exclusivamente en la base privada.

create schema if not exists clinic_private;
revoke all on schema clinic_private from public, anon, authenticated;

create table if not exists clinic_private.invites (
  email text primary key check (email = lower(trim(email))),
  role text not null check (role in ('doctor', 'assistant')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table clinic_private.invites enable row level security;
revoke all on clinic_private.invites from public, anon, authenticated;

create or replace function clinic_private.authorize_verified_clinic_invite()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare requested_role text;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  select ci.role into requested_role
  from clinic_private.invites ci
  where ci.email = lower(trim(new.email)) and ci.active;
  if requested_role is not null then
    insert into public.clinic_staff (user_id, role, active)
    values (new.id, requested_role, true)
    on conflict (user_id) do update
    set role = excluded.role, active = true;
  end if;
  return new;
end;
$$;
revoke all on function clinic_private.authorize_verified_clinic_invite()
from public, anon, authenticated;

drop trigger if exists clinic_invite_on_auth_user_confirmed on auth.users;
create trigger clinic_invite_on_auth_user_confirmed
after insert or update of email, email_confirmed_at on auth.users
for each row execute function clinic_private.authorize_verified_clinic_invite();

-- Configurar invitados por separado en SQL Editor (sin escribir contraseñas):
-- insert into clinic_private.invites (email,role,active)
-- values ('CORREO_VERIFICADO', 'doctor', true)
-- on conflict (email) do update set role=excluded.role,active=excluded.active;

-- Enviar invitación desde Authentication > Users > Add user > Send invitation.
-- La cuenta queda autorizada después de confirmar el correo.
-- Nunca crear usuarios de auth mediante inserciones directas en auth.users.
