-- =====================================================================
-- Leilo Blinds: full database setup (reference)
-- Mirrors the live Supabase database as of October 30, 2026, including
-- patch_2026-10-30.sql. Use it for a NEW Supabase project or to keep the
-- repository in sync. Safe to run more than once.
-- Your live database does not need this file; run the patch instead.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------
create table if not exists staff (
  email          text primary key,            -- the login in Authentication > Users
  role           text not null check (role in ('admin', 'agent')),
  ask_agent_name boolean not null default false   -- true = shared guest account
);

create table if not exists blind_styles (
  name        text primary key,               -- must match fabrics.blind_type
  description text,
  image_path  text,                           -- path in the "blinds" storage bucket
  sort_order  integer not null default 100,
  active      boolean not null default true
);

create table if not exists fabrics (
  id             bigint generated always as identity primary key,
  blind_type     text not null,
  name           text not null,
  price_per_sqft numeric not null,
  colors         text[] not null,
  active         boolean not null default true,
  color_images   jsonb not null default '{}'::jsonb,   -- {"White": "colors/....jpg"}
  constraint fabrics_type_name_key unique (blind_type, name)
);

create table if not exists orders (
  id             bigint generated always as identity primary key,
  order_no       text unique not null,
  customer_name  text,
  phone          text,
  email          text,                        -- unused by the app (kept from the first version)
  address        text,
  payment_method text,                        -- unused: payments are outside the system
  status         text not null default 'Pending'
                 constraint orders_status_check check (status in ('Pending', 'Completed', 'Cancelled')),
  total          numeric not null default 0,
  created_at     timestamptz not null default now(),
  agent_email    text,
  notes          text,
  completed_at   timestamptz,
  agent_name     text
);

create table if not exists order_items (
  id          bigint generated always as identity primary key,
  order_id    bigint references orders(id) on delete cascade,
  blind_type  text,
  fabric_id   bigint references fabrics(id),
  fabric_name text,
  color       text,
  width_in    numeric,
  height_in   numeric,
  casing      text,
  acetate     boolean,
  quantity    integer,
  unit_price  numeric
);

create table if not exists order_charges (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  label      text not null,
  amount     numeric not null,                -- negative = discount
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. HELPER AND ROLE FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.file_slug(t text)
returns text language sql immutable as $function$
  select trim(both '-' from regexp_replace(lower(t), '[^a-z0-9]+', '-', 'g'))
$function$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from staff where lower(email) = lower(auth.jwt() ->> 'email'))
$function$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from staff where lower(email) = lower(auth.jwt() ->> 'email') and role = 'admin')
$function$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path to 'public' as $function$
  select role from staff where lower(email) = lower(auth.jwt() ->> 'email')
$function$;

create or replace function public.my_needs_agent_name()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce(
    (select ask_agent_name from staff where lower(email) = lower(auth.jwt() ->> 'email')),
    false)
$function$;


-- ---------------------------------------------------------------------
-- 3. SAVING AN ORDER (prices recalculated here; same formula as
--    src/services/PricingService.js, minimum billable area 15 sq ft)
-- ---------------------------------------------------------------------
create or replace function public.place_order(customer jsonb, items jsonb)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  min_area constant numeric := 15;
  new_id bigint; new_no text; it jsonb; f fabrics%rowtype;
  w numeric; h numeric; qty int; unit numeric; running numeric := 0;
  ask boolean;
begin
  if not is_staff() then raise exception 'Not allowed. Sign in with a staff account.'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if coalesce(trim(customer->>'name'), '') = '' then raise exception 'Customer name is required'; end if;
  if coalesce(trim(customer->>'phone'), '') = '' then raise exception 'Contact number is required'; end if;
  if coalesce(trim(customer->>'address'), '') = '' then raise exception 'Address is required'; end if;

  ask := my_needs_agent_name();
  if ask and coalesce(trim(customer->>'agent_name'), '') = '' then
    raise exception 'Enter your name as the agent.';
  end if;

  loop
    new_no := 'BL-' || to_char(now() at time zone 'Asia/Manila', 'YYMMDD') || '-'
              || lpad((floor(random() * 9000) + 1000)::text, 4, '0');
    exit when not exists (select 1 from orders where order_no = new_no);
  end loop;

  insert into orders(order_no, customer_name, phone, address, notes, agent_email, agent_name, status)
  values (new_no, left(trim(customer->>'name'), 120), left(trim(customer->>'phone'), 40),
          left(trim(customer->>'address'), 300),
          nullif(left(trim(coalesce(customer->>'notes', '')), 300), ''),
          lower(auth.jwt() ->> 'email'),
          case when ask then left(trim(customer->>'agent_name'), 80) else null end,
          'Pending')
  returning id into new_id;

  for it in select value from jsonb_array_elements(items) loop
    select * into f from fabrics where id = (it->>'fabric_id')::bigint and active;
    if not found then raise exception 'Invalid fabric'; end if;
    w := (it->>'width')::numeric; h := (it->>'height')::numeric;
    qty := greatest(1, coalesce((it->>'quantity')::int, 1));
    if w is null or h is null or w not between 12 and 120 or h not between 12 and 120 then
      raise exception 'Size must be 12 to 120 inches';
    end if;
    unit := round(greatest(min_area, w * h / 144) * f.price_per_sqft
            + w / 12 * (case when it->>'casing' = 'Metal' then 85 else 35 end)
            + (case when coalesce((it->>'acetate')::boolean, false) then 120 else 0 end));
    insert into order_items(order_id, blind_type, fabric_id, fabric_name, color,
      width_in, height_in, casing, acetate, quantity, unit_price)
    values (new_id, f.blind_type, f.id, f.name, left(it->>'color', 40), w, h,
      case when it->>'casing' = 'Metal' then 'Metal' else 'Plastic' end,
      coalesce((it->>'acetate')::boolean, false), qty, unit);
    running := running + unit * qty;
  end loop;

  update orders set total = running where id = new_id;
  return new_no;
end $function$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant  execute on function public.place_order(jsonb, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4. ORDER RULES (triggers)
-- ---------------------------------------------------------------------
create or replace function public.set_completed_at()
returns trigger language plpgsql as $function$
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    new.completed_at := now();
  elsif new.status <> 'Completed' then
    new.completed_at := null;
  end if;
  return new;
end $function$;

create or replace function public.prevent_cancelled_order_edits()
returns trigger language plpgsql as $function$
begin
  if OLD.status = 'Cancelled' then
    raise exception 'Order % is Cancelled and locked. No further modifications allowed.', OLD.order_no;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $function$;

create or replace function public.prevent_cancelled_child_edits()
returns trigger language plpgsql as $function$
declare
  parent_status text;
begin
  select status into parent_status
  from public.orders where id = coalesce(NEW.order_id, OLD.order_id);
  if parent_status = 'Cancelled' then
    raise exception 'Cannot modify charges or items for a Cancelled order.';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $function$;

drop trigger if exists trg_completed_at on orders;
create trigger trg_completed_at before update on orders
  for each row execute function set_completed_at();

drop trigger if exists trg_lock_cancelled_orders on orders;
create trigger trg_lock_cancelled_orders before update or delete on orders
  for each row execute function prevent_cancelled_order_edits();

drop trigger if exists trg_lock_cancelled_charges on order_charges;
create trigger trg_lock_cancelled_charges before insert or update or delete on order_charges
  for each row execute function prevent_cancelled_child_edits();

drop trigger if exists trg_lock_cancelled_items on order_items;
create trigger trg_lock_cancelled_items before insert or update or delete on order_items
  for each row execute function prevent_cancelled_child_edits();


-- ---------------------------------------------------------------------
-- 5. SECURITY (row-level security)
-- ---------------------------------------------------------------------
alter table staff         enable row level security;
alter table blind_styles  enable row level security;
alter table fabrics       enable row level security;
alter table orders        enable row level security;
alter table order_items   enable row level security;
alter table order_charges enable row level security;

drop policy if exists "admin manages staff"       on staff;
drop policy if exists "staff read own row"        on staff;
drop policy if exists "admin manages styles"      on blind_styles;
drop policy if exists "staff read styles"         on blind_styles;
drop policy if exists "admin manages fabrics"     on fabrics;
drop policy if exists "staff read active fabrics" on fabrics;
drop policy if exists "admin manages orders"      on orders;
drop policy if exists "admin manages items"       on order_items;
drop policy if exists "admin manages charges"     on order_charges;

create policy "admin manages staff" on staff for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "staff read own row" on staff for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy "admin manages styles" on blind_styles for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "staff read styles" on blind_styles for select to authenticated
  using (active and is_staff());

create policy "admin manages fabrics" on fabrics for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "staff read active fabrics" on fabrics for select to authenticated
  using (active and is_staff());

-- Agents never read orders; they save through place_order().
create policy "admin manages orders" on orders for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "admin manages items" on order_items for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "admin manages charges" on order_charges for all to authenticated
  using (is_admin()) with check (is_admin());


-- ---------------------------------------------------------------------
-- 6. CATALOG (current price list; existing rows are left unchanged)
-- ---------------------------------------------------------------------
insert into fabrics (blind_type, name, price_per_sqft, colors) values
('Combi Blinds','Basic',125,'{"White","Ivory","Peach","M. Taupe","Mustard","Brown","Caramel","Mocha","Taupe","Grey","Black","Dark Green","Blue","Pink","Red","Chocolate","Dark Grey","Yellow","Ice Blue","Dark Blue","Orange","Purple"}'),
('Combi Blinds','Full House Blackout',150,'{"Coconut","Light Grey","Brown"}'),
('Combi Blinds','Indian S/T',140,'{"Ivory","Brown","Black"}'),
('Combi Blinds','Luxury Blackout',165,'{"Ivory","Beige","Peach","Grey","Charcoal","Choco"}'),
('Combi Blinds','Luxury Woodlook',160,'{"Khaki","Peach","Cherry","Navy","Wine","White","L. Grey","Blue Grey","D. Grey","Mushroom"}'),
('Combi Blinds','Woodlook Normal',130,'{"White","N. White","N. Beige","Sand","N. Peach","N. Cherry","Cherry","Brown","Light Green","Nile","Coffee","Choco","Khaki","Ashtree","Grey","Stone","Navy","Black","Light Blue","Sky Blue","Turquoise","Pink","Lilac","Wine","Dark Green"}'),
('Combi Blinds','Woolsy',130,'{"Brown","Chocolate","Cherry"}'),
('Noblesse','Single Color',180,'{"White","Ivory","Beige","Chocolate","Olive Night"}'),
('Noblesse','Two color',200,'{"Beige and Choco","White and Ivory"}'),
('Roller Blinds','100% Black Out',150,'{"Anthracite","Grey","Beige","Cream"}'),
('Roller Blinds','5% Sunscreen',125,'{"001","002","003"}'),
('Roller Blinds','Cubic',120,'{"Ivory","Khaki","Grey"}'),
('Roller Blinds','Eco Screen',130,'{"Beige","White","Grey","Mocha"}'),
('Roller Blinds','Hanoi',130,'{"Beige","Green","Grey"}'),
('Roller Blinds','Single Black Out',120,'{"Mint","Project Screen","Violet","White"}'),
('Roller Blinds','T/C',115,'{"Ivory","Grey","Peach","White"}'),
('Smart Curtain','Honey',210,'{"Ivory","Cinder","Nordick","Metal Navy"}'),
('Smart Curtain','Plain',190,'{"White","Ivory","Coffee","Cinder","Nordick","Dark Grey","Metal Navy","Brown"}'),
('Wood Blinds','Classic',250,'{"C-904","C-903"}'),
('Wood Blinds','Textured',260,'{"P-101","P-102","P-103","P-104","P-105","P-106"}')
on conflict (blind_type, name) do nothing;

-- One style card per blind type; edit descriptions, photos and order later.
insert into blind_styles (name)
select distinct blind_type from fabrics
on conflict (name) do nothing;


-- ---------------------------------------------------------------------
-- 7. STAFF ACCOUNTS (new project only)
-- Create each login first in Authentication > Users, then add it here.
-- Usernames get "@leilo.app" added by the app (e.g. "maria" -> maria@leilo.app).
-- ---------------------------------------------------------------------
-- insert into staff (email, role, ask_agent_name) values
--   ('owner@leilo.app',  'admin', false),
--   ('agent1@leilo.app', 'agent', false),
--   ('agent2@leilo.app', 'agent', false),
--   ('guest@leilo.app',  'agent', true)
-- on conflict (email) do nothing;


-- ---------------------------------------------------------------------
-- 8. PHOTO STORAGE (public bucket used by BlindPreview.js)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('blinds', 'blinds', true)
on conflict (id) do update set public = true;
