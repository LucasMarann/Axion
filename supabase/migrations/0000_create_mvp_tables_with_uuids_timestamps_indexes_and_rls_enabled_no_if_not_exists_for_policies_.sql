-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- Helper: drop policies if they already exist (Supabase/Postgres doesn't support IF NOT EXISTS for policies)
do $$
begin
  -- users
  if exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_select_own') then
    execute 'drop policy users_select_own on public.users';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_insert_own') then
    execute 'drop policy users_insert_own on public.users';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_update_own') then
    execute 'drop policy users_update_own on public.users';
  end if;

  -- user_roles
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles_select_own') then
    execute 'drop policy user_roles_select_own on public.user_roles';
  end if;

  -- drivers
  if exists (select 1 from pg_policies where schemaname='public' and tablename='drivers' and policyname='drivers_select_own') then
    execute 'drop policy drivers_select_own on public.drivers';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='drivers' and policyname='drivers_insert_own') then
    execute 'drop policy drivers_insert_own on public.drivers';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='drivers' and policyname='drivers_update_own') then
    execute 'drop policy drivers_update_own on public.drivers';
  end if;
end $$;

-- 1) users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  full_name text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_active_uniq
  on public.users (email)
  where deleted_at is null and email is not null;

create unique index if not exists users_phone_active_uniq
  on public.users (phone)
  where deleted_at is null and phone is not null;

create index if not exists users_created_at_idx on public.users (created_at);

alter table public.users enable row level security;

create policy users_select_own on public.users
for select to authenticated
using (auth.uid() = id);

create policy users_insert_own on public.users
for insert to authenticated
with check (auth.uid() = id);

create policy users_update_own on public.users
for update to authenticated
using (auth.uid() = id);

-- 2) user_roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  scope_type text not null default 'global',
  scope_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists user_roles_user_role_scope_uniq
  on public.user_roles(user_id, role, scope_type, scope_id);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists user_roles_role_idx on public.user_roles(role);

alter table public.user_roles enable row level security;

create policy user_roles_select_own on public.user_roles
for select to authenticated
using (auth.uid() = user_id);

-- Writes intentionally not allowed yet (owner-only later)

-- 3) drivers
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  license_number text,
  document_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drivers_user_id_idx on public.drivers(user_id);

alter table public.drivers enable row level security;

create policy drivers_select_own on public.drivers
for select to authenticated
using (auth.uid() = user_id);

create policy drivers_insert_own on public.drivers
for insert to authenticated
with check (auth.uid() = user_id);

create policy drivers_update_own on public.drivers
for update to authenticated
using (auth.uid() = user_id);

-- 4) vehicles
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  fleet_number text,
  model text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicles_plate_uniq on public.vehicles(plate);
create unique index if not exists vehicles_fleet_number_uniq on public.vehicles(fleet_number) where fleet_number is not null;
create index if not exists vehicles_status_idx on public.vehicles(status);

alter table public.vehicles enable row level security;

-- 5) routes
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  origin_name text not null,
  destination_name text not null,
  planned_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null,
  driver_id uuid references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),
  created_by_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_code_uniq unique (code)
);

create index if not exists routes_status_idx on public.routes(status);
create index if not exists routes_driver_status_idx on public.routes(driver_id, status);
create index if not exists routes_vehicle_status_idx on public.routes(vehicle_id, status);
create index if not exists routes_started_at_idx on public.routes(started_at);

alter table public.routes enable row level security;

-- 6) deliveries
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null,
  route_id uuid references public.routes(id),
  origin_name text not null,
  destination_name text not null,
  recipient_name text not null,
  recipient_document text not null,
  status text not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_tracking_code_uniq unique (tracking_code)
);

create index if not exists deliveries_route_id_idx on public.deliveries(route_id);
create index if not exists deliveries_status_idx on public.deliveries(status);
create index if not exists deliveries_tracking_doc_idx on public.deliveries(tracking_code, recipient_document);

alter table public.deliveries enable row level security;

-- 7) route_events (immutable)
create table if not exists public.route_events (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_user_id uuid references public.users(id),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists route_events_route_time_idx on public.route_events(route_id, occurred_at desc);
create index if not exists route_events_type_idx on public.route_events(event_type);
create index if not exists route_events_recorded_at_idx on public.route_events(recorded_at desc);

alter table public.route_events enable row level security;

-- 8) incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete restrict,
  delivery_id uuid references public.deliveries(id) on delete restrict,
  reported_by_user_id uuid references public.users(id),
  incident_type text not null,
  severity text not null,
  description text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_route_time_idx on public.incidents(route_id, occurred_at desc);
create index if not exists incidents_delivery_idx on public.incidents(delivery_id);
create index if not exists incidents_severity_idx on public.incidents(severity);

alter table public.incidents enable row level security;

-- 9) location_snapshots (immutable)
create table if not exists public.location_snapshots (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete restrict,
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  captured_at timestamptz not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  speed_kmh numeric(6,2),
  heading_deg numeric(6,2),
  source text not null default 'device',
  accuracy_m numeric(8,2),
  meta jsonb not null default '{}'::jsonb,
  constraint location_lat_check check (lat >= -90 and lat <= 90),
  constraint location_lng_check check (lng >= -180 and lng <= 180)
);

create index if not exists location_snapshots_route_captured_idx on public.location_snapshots(route_id, captured_at desc);
create index if not exists location_snapshots_vehicle_time_idx on public.location_snapshots(vehicle_id, captured_at desc);
create index if not exists location_snapshots_driver_time_idx on public.location_snapshots(driver_id, captured_at desc);

alter table public.location_snapshots enable row level security;

-- 10) ai_insights
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete restrict,
  delivery_id uuid references public.deliveries(id) on delete restrict,
  generated_at timestamptz not null default now(),
  eta_at timestamptz,
  risk_level text not null,
  summary text not null,
  features jsonb not null default '{}'::jsonb,
  model_version text not null default 'mvp-v1'
);

create index if not exists ai_insights_route_generated_idx on public.ai_insights(route_id, generated_at desc);
create index if not exists ai_insights_risk_idx on public.ai_insights(risk_level, generated_at desc);

alter table public.ai_insights enable row level security;

-- 11) notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.users(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  status text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists notifications_recipient_time_idx on public.notifications(recipient_user_id, created_at desc);
create index if not exists notifications_route_time_idx on public.notifications(route_id, created_at desc);
create index if not exists notifications_delivery_time_idx on public.notifications(delivery_id, created_at desc);
create index if not exists notifications_status_idx on public.notifications(status);

alter table public.notifications enable row level security;

-- 12) metric_events (immutable)
create table if not exists public.metric_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  user_id uuid references public.users(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  source text not null default 'backend'
);

create index if not exists metric_events_name_time_idx on public.metric_events(event_name, occurred_at desc);
create index if not exists metric_events_user_time_idx on public.metric_events(user_id, occurred_at desc);
create index if not exists metric_events_route_time_idx on public.metric_events(route_id, occurred_at desc);

alter table public.metric_events enable row level security;
