-- STEP 1: change the email below to the admin email you will create in Supabase.
create or replace function is_admin() returns boolean
language sql stable as $$ select (auth.jwt() ->> 'email') = 'you@email.com' $$;

create table if not exists fabrics (
  id bigint generated always as identity primary key,
  blind_type text not null,
  name text not null,
  price_per_sqft numeric not null,
  colors text[] not null,
  active boolean not null default true
);

create table if not exists orders (
  id bigint generated always as identity primary key,
  order_no text unique not null,
  customer_name text, phone text, email text, address text,
  payment_method text,
  status text not null default 'Order placed',
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id bigint references orders(id) on delete cascade,
  blind_type text, fabric_id bigint references fabrics(id), fabric_name text,
  color text, width_in numeric, height_in numeric,
  casing text, acetate boolean, quantity int, unit_price numeric
);

insert into fabrics (blind_type, name, price_per_sqft, colors) values
('Combi Blinds','Regular',170,'{"White","Cream","Dove Gray","Charcoal"}'),
('Combi Blinds','Black Out',230,'{"White","Cream","Dove Gray","Charcoal"}'),
('Combi Blinds','Woodlook',280,'{"Oak","Walnut","Ash"}'),
('Roller Blinds','Regular',140,'{"White","Cream","Dove Gray","Charcoal"}'),
('Roller Blinds','Black Out',200,'{"White","Cream","Dove Gray","Charcoal"}'),
('Roller Blinds','Sunscreen',220,'{"White","Cream","Dove Gray"}'),
('HoneyComb','Light Filtering',250,'{"White","Cream","Dove Gray"}'),
('HoneyComb','Black Out',310,'{"White","Cream","Dove Gray"}'),
('Smart Curtain','Sheer',300,'{"White","Cream"}'),
('Smart Curtain','Black Out',380,'{"White","Cream","Dove Gray"}');

alter table fabrics enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "public reads active fabrics" on fabrics;
drop policy if exists "admin manages fabrics" on fabrics;
drop policy if exists "admin manages orders" on orders;
drop policy if exists "admin manages items" on order_items;

create policy "public reads active fabrics" on fabrics for select using (active);
create policy "admin manages fabrics" on fabrics for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin manages orders" on orders for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin manages items" on order_items for all to authenticated using (is_admin()) with check (is_admin());

create or replace function place_order(customer jsonb, items jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_id bigint; new_no text; it jsonb; f fabrics%rowtype;
  w numeric; h numeric; qty int; unit numeric; running numeric := 0;
begin
  if jsonb_array_length(items) = 0 then raise exception 'Cart is empty'; end if;
  new_no := 'BL-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*9000)+1000)::text,4,'0');
  insert into orders(order_no, customer_name, phone, email, address, payment_method)
  values (new_no, left(customer->>'name',120), left(customer->>'phone',40), left(customer->>'email',120),
          left(customer->>'address',300), left(customer->>'payment',40))
  returning id into new_id;

  for it in select value from jsonb_array_elements(items) loop
    select * into f from fabrics where id = (it->>'fabric_id')::bigint and active;
    if not found then raise exception 'Invalid fabric'; end if;
    w := (it->>'width')::numeric; h := (it->>'height')::numeric;
    qty := greatest(1, (it->>'quantity')::int);
    if w not between 12 and 120 or h not between 12 and 120 then
      raise exception 'Size must be 12 to 120 inches';
    end if;
    unit := round(greatest(6, w*h/144) * f.price_per_sqft
            + w/12 * (case when it->>'casing' = 'Metal' then 85 else 35 end)
            + (case when (it->>'acetate')::boolean then 120 else 0 end));
    insert into order_items(order_id, blind_type, fabric_id, fabric_name, color,
      width_in, height_in, casing, acetate, quantity, unit_price)
    values (new_id, f.blind_type, f.id, f.name, left(it->>'color',40), w, h,
      case when it->>'casing' = 'Metal' then 'Metal' else 'Plastic' end,
      coalesce((it->>'acetate')::boolean,false), qty, unit);
    running := running + unit * qty;
  end loop;

  update orders set total = running where id = new_id;
  return new_no;
end $$;

create or replace function track_order(p_no text)
returns table(order_no text, status text, total numeric, created_at timestamptz)
language sql security definer set search_path = public as $$
  select o.order_no, o.status, o.total, o.created_at from orders o where o.order_no = p_no
$$;

grant execute on function place_order(jsonb, jsonb) to anon, authenticated;
grant execute on function track_order(text) to anon, authenticated;
