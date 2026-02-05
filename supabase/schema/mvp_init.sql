-- MVP Init Schema (public)
-- Regras: UUID em tudo, timestamps em tudo, entregas não deletáveis, histórico imutável para eventos/localizações/métricas/insights.
-- Observação: execute no Supabase SQL Editor.

-- 0) Extensões
create extension if not exists "pgcrypto";

-- 1) Funções utilitárias

-- 1.1) Atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1.2) Bloqueia UPDATE/DELETE (append-only / imutável)
create or replace function public.prevent_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This table is immutable (no UPDATE/DELETE). Insert new rows instead.';
end;
$$;

-- 1.3) Bloqueia DELETE (para Delivery, por regra de negócio)
create or replace function public.prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Deletes are not allowed for this table.';
end;
$$;

-- 2) Tabelas

-- 2.1) Users
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

-- Unique "ativos" (permite reuso do email após soft delete, se desejado)
create unique index if not exists users_email_active_uidx
on public.users (email)
where email is not null and deleted_at is null;

create unique index if not exists users_phone_active_uidx
on public.users (phone)
where phone is not null and deleted_at is null;

create index if not exists users_created_at_idx on public.users (created_at);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- 2.2) User Roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  role text not null,
  scope_type text not null default 'global',
  scope_id uuid,
  created_at timestamptz not null default now()
);

-- Roles do MVP (expansível depois)
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('owner','manager','driver','client'));

create unique index if not exists user_roles_unique_scope_uidx
on public.user_roles (user_id, role, scope_type, scope_id);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role);

-- 2.3) Drivers
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id),
  license_number text,
  document_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drivers_user_id_idx on public.drivers (user_id);

drop trigger if exists drivers_set_updated_at on public.drivers;
create trigger drivers_set_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

-- 2.4) Vehicles
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  fleet_number text,
  model text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicles
  drop constraint if exists vehicles_plate_unique;
alter table public.vehicles
  add constraint vehicles_plate_unique unique (plate);

alter table public.vehicles
  drop constraint if exists vehicles_fleet_number_unique;
alter table public.vehicles
  add constraint vehicles_fleet_number_unique unique (fleet_number);

alter table public.vehicles
  drop constraint if exists vehicles_status_check;
alter table public.vehicles
  add constraint vehicles_status_check
  check (status in ('active','maintenance','inactive'));

create index if not exists vehicles_status_idx on public.vehicles (status);

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- 2.5) Routes
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
  updated_at timestamptz not null default now()
);

alter table public.routes
  drop constraint if exists routes_code_unique;
alter table public.routes
  add constraint routes_code_unique unique (code);

alter table public.routes
  drop constraint if exists routes_status_check;
alter table public.routes
  add constraint routes_status_check
  check (status in ('planned','active','done','canceled'));

-- Basic time consistency
alter table public.routes
  drop constraint if exists routes_time_order_check;

alter table public.routes
  add constraint routes_time_order_check
  check (ended_at is null or started_at is null or ended_at >= started_at);

create index if not exists routes_status_idx on public.routes (status);
create index if not exists routes_driver_status_idx on public.routes (driver_id, status);
create index if not exists routes_vehicle_status_idx on public.routes (vehicle_id, status);
create index if not exists routes_started_at_idx on public.routes (started_at);

drop trigger if exists routes_set_updated_at on public.routes;
create trigger routes_set_updated_at
before update on public.routes
for each row execute function public.set_updated_at();

-- 2.6) Deliveries (não deletável)
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
  updated_at timestamptz not null default now()
);

alter table public.deliveries
  drop constraint if exists deliveries_tracking_code_unique;
alter table public.deliveries
  add constraint deliveries_tracking_code_unique unique (tracking_code);

alter table public.deliveries
  drop constraint if exists deliveries_status_check;
alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('collected','in_transit','stopped','delivered'));

create index if not exists deliveries_tracking_code_idx on public.deliveries (tracking_code);
create index if not exists deliveries_route_id_idx on public.deliveries (route_id);
create index if not exists deliveries_status_idx on public.deliveries (status);

-- Para consulta cliente: código + documento (CPF)
create index if not exists deliveries_tracking_doc_idx
on public.deliveries (tracking_code, recipient_document);

drop trigger if exists deliveries_set_updated_at on public.deliveries;
create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_updated_at();

-- Bloqueia DELETE (entrega nunca é deletada)
drop trigger if exists deliveries_prevent_delete on public.deliveries;
create trigger deliveries_prevent_delete
before delete on public.deliveries
for each row execute function public.prevent_delete();

-- 2.7) Route Events (imutável)
create table if not exists public.route_events (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  event_type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_user_id uuid references public.users(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists route_events_route_time_idx
on public.route_events (route_id, occurred_at desc);

create index if not exists route_events_type_idx
on public.route_events (event_type);

create index if not exists route_events_recorded_at_idx
on public.route_events (recorded_at desc);

-- Imutabilidade
drop trigger if exists route_events_prevent_update on public.route_events;
create trigger route_events_prevent_update
before update on public.route_events
for each row execute function public.prevent_update_delete();

drop trigger if exists route_events_prevent_delete on public.route_events;
create trigger route_events_prevent_delete
before delete on public.route_events
for each row execute function public.prevent_update_delete();

-- 2.8) Incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  delivery_id uuid references public.deliveries(id),
  reported_by_user_id uuid references public.users(id),
  incident_type text not null,
  severity text not null,
  description text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.incidents
  drop constraint if exists incidents_severity_check;
alter table public.incidents
  add constraint incidents_severity_check
  check (severity in ('low','medium','high'));

create index if not exists incidents_route_time_idx
on public.incidents (route_id, occurred_at desc);

create index if not exists incidents_delivery_idx
on public.incidents (delivery_id);

create index if not exists incidents_severity_idx
on public.incidents (severity);

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function public.set_updated_at();

-- 2.9) Location Snapshots (imutável; hot table)
create table if not exists public.location_snapshots (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  driver_id uuid references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),
  recorded_at timestamptz not null default now(),
  captured_at timestamptz not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  speed_kmh numeric(6,2),
  heading_deg numeric(6,2),
  source text not null default 'device',
  accuracy_m numeric(8,2),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.location_snapshots
  drop constraint if exists location_snapshots_lat_check;
alter table public.location_snapshots
  add constraint location_snapshots_lat_check
  check (lat >= -90 and lat <= 90);

alter table public.location_snapshots
  drop constraint if exists location_snapshots_lng_check;
alter table public.location_snapshots
  add constraint location_snapshots_lng_check
  check (lng >= -180 and lng <= 180);

create index if not exists location_snapshots_route_captured_idx
on public.location_snapshots (route_id, captured_at desc);

create index if not exists location_snapshots_vehicle_time_idx
on public.location_snapshots (vehicle_id, captured_at desc);

create index if not exists location_snapshots_driver_time_idx
on public.location_snapshots (driver_id, captured_at desc);

-- Imutabilidade
drop trigger if exists location_snapshots_prevent_update on public.location_snapshots;
create trigger location_snapshots_prevent_update
before update on public.location_snapshots
for each row execute function public.prevent_update_delete();

drop trigger if exists location_snapshots_prevent_delete on public.location_snapshots;
create trigger location_snapshots_prevent_delete
before delete on public.location_snapshots
for each row execute function public.prevent_update_delete();

-- 2.10) AI Insights (imutável)
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  delivery_id uuid references public.deliveries(id),
  generated_at timestamptz not null default now(),
  eta_at timestamptz,
  risk_level text not null,
  summary text not null,
  features jsonb not null default '{}'::jsonb,
  model_version text not null default 'mvp-v1',
  created_at timestamptz not null default now()
);

alter table public.ai_insights
  drop constraint if exists ai_insights_risk_check;
alter table public.ai_insights
  add constraint ai_insights_risk_check
  check (risk_level in ('normal','at_risk','late'));

create index if not exists ai_insights_route_generated_idx
on public.ai_insights (route_id, generated_at desc);

create index if not exists ai_insights_risk_idx
on public.ai_insights (risk_level, generated_at desc);

-- Imutabilidade
drop trigger if exists ai_insights_prevent_update on public.ai_insights;
create trigger ai_insights_prevent_update
before update on public.ai_insights
for each row execute function public.prevent_update_delete();

drop trigger if exists ai_insights_prevent_delete on public.ai_insights;
create trigger ai_insights_prevent_delete
before delete on public.ai_insights
for each row execute function public.prevent_update_delete();

-- 2.11) Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.users(id),
  delivery_id uuid references public.deliveries(id),
  route_id uuid references public.routes(id),
  type text not null,
  title text not null,
  message text not null,
  status text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

alter table public.notifications
  drop constraint if exists notifications_status_check;
alter table public.notifications
  add constraint notifications_status_check
  check (status in ('queued','sent','failed','opened'));

create index if not exists notifications_recipient_time_idx
on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_route_time_idx
on public.notifications (route_id, created_at desc);

create index if not exists notifications_delivery_time_idx
on public.notifications (delivery_id, created_at desc);

create index if not exists notifications_status_idx
on public.notifications (status);

-- 2.12) Metric Events (imutável; hot table)
create table if not exists public.metric_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  occurred_at timestamptz not null default now(),
  user_id uuid references public.users(id),
  route_id uuid references public.routes(id),
  delivery_id uuid references public.deliveries(id),
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  source text not null default 'backend',
  created_at timestamptz not null default now()
);

create index if not exists metric_events_name_time_idx
on public.metric_events (event_name, occurred_at desc);

create index if not exists metric_events_user_time_idx
on public.metric_events (user_id, occurred_at desc);

create index if not exists metric_events_route_time_idx
on public.metric_events (route_id, occurred_at desc);

-- Imutabilidade
drop trigger if exists metric_events_prevent_update on public.metric_events;
create trigger metric_events_prevent_update
before update on public.metric_events
for each row execute function public.prevent_update_delete();

drop trigger if exists metric_events_prevent_delete on public.metric_events;
create trigger metric_events_prevent_delete
before delete on public.metric_events
for each row execute function public.prevent_update_delete();

-- 3) RLS (habilitar por padrão, com políticas mínimas seguras)
-- Importante: políticas específicas dependem do modelo de autorização do seu backend/API.
-- Para evitar exposição acidental, habilitamos RLS e NÃO criamos políticas permissivas aqui.

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.routes enable row level security;
alter table public.deliveries enable row level security;
alter table public.route_events enable row level security;
alter table public.incidents enable row level security;
alter table public.location_snapshots enable row level security;
alter table public.ai_insights enable row level security;
alter table public.notifications enable row level security;
alter table public.metric_events enable row level security;