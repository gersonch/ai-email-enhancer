-- =============================================
-- AI Email Enhancer - Initial Schema
-- Project: ibpsesbmnosfrblwzzhn
-- =============================================

-- =============================================
-- EXTENSIONS
-- =============================================
create extension if not exists "uuid-ossp";

-- Para encriptar las API keys de usuarios
create extension if not exists "pgcrypto";

-- =============================================
-- TABLES
-- =============================================

-- Tabla de planes por usuario
-- Se crea automáticamente cuando el usuario se registra (trigger)
create table if not exists user_plans (
  user_id uuid references auth.users on delete cascade primary key,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  has_own_api_key boolean default false,
  requests_today int default 0,
  requests_this_month int default 0,
  daily_reset_at timestamptz default now(),
  monthly_reset_at timestamptz default date_trunc('month', now()),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- API keys traídas por usuarios (encriptadas con pgcrypto)
-- AES-256 encryption usando la encryption key del developer
create table if not exists user_api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  encrypted_key text not null,
  key_hash text not null,  -- Para verificar sin desencriptar
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Log de uso para auditoría y billing
create table if not exists usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tokens_used int,
  model_used text default 'gpt-3.5-turbo',
  ip_address text,
  user_agent text,
  success boolean default true,
  error_message text,
  created_at timestamptz default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists idx_usage_logs_user_id on usage_logs(user_id);
create index if not exists idx_usage_logs_created_at on usage_logs(created_at);
create index if not exists idx_user_plans_plan on user_plans(plan);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS
alter table user_plans enable row level security;
alter table user_api_keys enable row level security;
alter table usage_logs enable row level security;

-- Policies: users solo ven/manipulan SU propia data
create policy "Users can manage their own plan"
  on user_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own api key"
  on user_api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own usage logs"
  on usage_logs for select
  using (auth.uid() = user_id);

-- Service role puede insertar logs (desde edge functions)
create policy "Service role can insert usage logs"
  on usage_logs for insert
  with check (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Función para verificar límites antes de cada request
create or replace function check_user_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_plan user_plans%rowtype;
  v_limit int;
  v_reset_needed boolean := false;
begin
  -- Obtener plan del usuario
  select * into v_plan
  from user_plans
  where user_id = p_user_id;

  -- Si no existe, crear con plan free
  if not found then
    insert into user_plans (user_id) values (p_user_id);
    select * into v_plan from user_plans where user_id = p_user_id;
  end if;

  -- Reset diario si corresponde (nueva fecha)
  if v_plan.daily_reset_at::date < current_date then
    v_reset_needed := true;
    v_plan.requests_today := 0;
  end if;

  -- Reset mensual si corresponde
  if v_plan.monthly_reset_at < date_trunc('month', now()) then
    v_plan.requests_this_month := 0;
  end if;

  -- Si necesita reset, actualizar
  if v_reset_needed then
    update user_plans set
      requests_today = 0,
      daily_reset_at = now(),
      monthly_reset_at = case
        when v_plan.monthly_reset_at < date_trunc('month', now())
        then date_trunc('month', now())
        else monthly_reset_at
      end,
      updated_at = now()
    where user_id = p_user_id;
  end if;

  -- SI tiene su propia API key, no hay límites
  if v_plan.has_own_api_key then
    return jsonb_build_object(
      'allowed', true,
      'reason', 'own_key',
      'api_key_source', 'user'
    );
  end if;

  -- Verificar límites según plan
  case v_plan.plan
    when 'paid' then v_limit := 1000;  -- "Ilimitado" con cap razonable
    when 'free' then v_limit := 5;
    else v_limit := 0;
  end case;

  -- Verificar si excedió
  if v_plan.requests_today >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'limit_exceeded',
      'plan', v_plan.plan,
      'limit', v_limit,
      'used', v_plan.requests_today,
      'api_key_source', 'developer'
    );
  end if;

  -- Dentro del límite
  return jsonb_build_object(
    'allowed', true,
    'reason', 'ok',
    'plan', v_plan.plan,
    'remaining', v_limit - v_plan.requests_today,
    'api_key_source', 'developer'
  );
end;
$$;

-- Función para incrementar contadores después de cada request
create or replace function increment_request_count(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update user_plans set
    requests_today = requests_today + 1,
    requests_this_month = requests_this_month + 1,
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- Función para guardar API key del usuario (simple base64 encoding)
-- Nota: Esta no es encriptación real, solo codificación. 
-- Para mayor seguridad, implementar en edge function.
create or replace function save_user_encrypted_api_key(p_api_key text)
returns void
language plpgsql
security definer
as $$
declare
  v_encrypted text;
  v_key_hash text;
begin
  -- Validar que la API key comienza con sk-
  if not p_api_key like 'sk-%' then
    raise exception 'Invalid API key format';
  end if;
  
  -- Simple base64 encoding (no es encriptación real)
  v_encrypted := encode(p_api_key::bytea, 'base64');
  
  -- Crear hash para verificación (no reversible)
  v_key_hash := encode(sha256(convert_to(p_api_key, 'UTF8')), 'hex');
  
  -- Upsert en user_api_keys
  insert into user_api_keys (user_id, encrypted_key, key_hash)
  values (auth.uid(), v_encrypted, v_key_hash)
  on conflict (user_id) do update
    set encrypted_key = v_encrypted,
        key_hash = v_key_hash,
        updated_at = now();
  
  -- Actualizar has_own_api_key
  update user_plans
  set has_own_api_key = true,
      updated_at = now()
  where user_id = auth.uid();
end;
$$;

-- Función para obtener API key encriptada del usuario
create or replace function get_user_encrypted_key(p_user_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_key text;
begin
  select encrypted_key into v_key
  from user_api_keys
  where user_id = p_user_id;
  
  return v_key;
end;
$$;

-- Función para eliminar API key del usuario Y actualizar has_own_api_key
create or replace function remove_user_api_key(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Eliminar la API key
  delete from user_api_keys where user_id = p_user_id;
  
  -- Actualizar has_own_api_key a false
  update user_plans set has_own_api_key = false, updated_at = now() where user_id = p_user_id;
end;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Crear user_plans automáticamente cuando usuario se registra
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_plans (user_id)
  values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- ENCRYPTION HELPERS (para usar en edge functions)
-- =============================================

-- Crear hash de la API key para verificación (no reversible)
create or replace function hash_api_key(p_key text)
returns text
language plpgsql
as $$
begin
  return encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
end;
$$;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Dar permisos a service_role para las funciones
grant execute on function check_user_limit(uuid) to service_role;
grant execute on function increment_request_count(uuid) to service_role;
grant execute on function save_user_encrypted_api_key(text) to service_role;
grant execute on function get_user_encrypted_key(uuid) to service_role;
grant execute on function remove_user_api_key(uuid) to service_role;
grant execute on function hash_api_key(text) to service_role;

-- Dar permisos a anon para las funciones necesarias
grant execute on function check_user_limit(uuid) to anon;
grant execute on function increment_request_count(uuid) to anon;
grant execute on function get_user_encrypted_key(uuid) to anon;
grant execute on function remove_user_api_key(uuid) to anon;
grant execute on function save_user_encrypted_api_key(text) to anon;

-- =============================================
-- VERIFY
-- =============================================

-- Para verificar que todo está bien:
-- select * from user_plans limit 5;
-- select check_user_limit('user-uuid-here');
