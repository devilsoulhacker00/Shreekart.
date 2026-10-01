create extension if not exists pgcrypto;

create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,phone text,role text not null default 'customer' check(role in ('customer','seller','admin')),created_at timestamptz default now());
create table if not exists public.categories(id uuid primary key default gen_random_uuid(),name text unique not null,active boolean not null default true,created_at timestamptz default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),seller_id uuid references public.profiles(id),name text not null,description text,category text not null,sku text unique,price numeric(12,2) not null check(price>=0),compare_at_price numeric(12,2),stock integer not null default 0 check(stock>=0),image_url text,active boolean not null default true,created_at timestamptz default now());
create table if not exists public.addresses(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,label text default 'Home',full_address text not null,city text,state text,pincode text,is_default boolean default false,created_at timestamptz default now());
create table if not exists public.wishlists(user_id uuid references public.profiles(id) on delete cascade,product_id uuid references public.products(id) on delete cascade,created_at timestamptz default now(),primary key(user_id,product_id));
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),status text not null default 'placed' check(status in ('placed','confirmed','packed','shipped','delivered','cancelled')),payment_method text not null default 'cod',payment_status text not null default 'pending',total numeric(12,2) not null check(total>=0),shipping_address jsonb not null,created_at timestamptz default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id),quantity integer not null check(quantity>0),unit_price numeric(12,2) not null check(unit_price>=0));
create table if not exists public.reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),product_id uuid not null references public.products(id) on delete cascade,rating integer not null check(rating between 1 and 5),review_text text,created_at timestamptz default now(),unique(user_id,product_id));

alter table public.profiles enable row level security;alter table public.categories enable row level security;alter table public.products enable row level security;alter table public.addresses enable row level security;alter table public.wishlists enable row level security;alter table public.orders enable row level security;alter table public.order_items enable row level security;alter table public.reviews enable row level security;

drop policy if exists "profiles own" on public.profiles;create policy "profiles own" on public.profiles for select using(auth.uid()=id);
drop policy if exists "profiles insert own" on public.profiles;create policy "profiles insert own" on public.profiles for insert with check(auth.uid()=id);
drop policy if exists "profiles update own" on public.profiles;create policy "profiles update own" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
drop policy if exists "public read active categories" on public.categories;create policy "public read active categories" on public.categories for select using(active=true);
drop policy if exists "public read active products" on public.products;create policy "public read active products" on public.products for select using(active=true);
drop policy if exists "users addresses" on public.addresses;create policy "users addresses" on public.addresses for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "users wishlist" on public.wishlists;create policy "users wishlist" on public.wishlists for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "users read own orders" on public.orders;create policy "users read own orders" on public.orders for select using(auth.uid()=user_id);
drop policy if exists "users read own order items" on public.order_items;create policy "users read own order items" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists "public read reviews" on public.reviews;create policy "public read reviews" on public.reviews for select using(true);
drop policy if exists "users reviews" on public.reviews;create policy "users reviews" on public.reviews for insert with check(auth.uid()=user_id);
drop policy if exists "users update reviews" on public.reviews;create policy "users update reviews" on public.reviews for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "users delete reviews" on public.reviews;create policy "users delete reviews" on public.reviews for delete using(auth.uid()=user_id);

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('admin','seller')); $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin'); $$;
create or replace function public.is_seller() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='seller'); $$;

drop policy if exists "staff manage products" on public.products;
drop policy if exists "admin manage products" on public.products;create policy "admin manage products" on public.products for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "seller manage own products" on public.products;create policy "seller manage own products" on public.products for all using(public.is_seller() and seller_id=auth.uid()) with check(public.is_seller() and seller_id=auth.uid());

drop policy if exists "staff update orders" on public.orders;
drop policy if exists "staff read all orders" on public.orders;
drop policy if exists "admin read all orders" on public.orders;create policy "admin read all orders" on public.orders for select using(public.is_admin() or auth.uid()=user_id);
drop policy if exists "seller read related orders" on public.orders;create policy "seller read related orders" on public.orders for select using(public.is_seller() and exists(select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=orders.id and p.seller_id=auth.uid()));
drop policy if exists "admin update orders" on public.orders;create policy "admin update orders" on public.orders for update using(public.is_admin()) with check(public.is_admin());
drop policy if exists "seller update related orders" on public.orders;create policy "seller update related orders" on public.orders for update using(public.is_seller() and exists(select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=orders.id and p.seller_id=auth.uid())) with check(public.is_seller());

drop policy if exists "staff read all order items" on public.order_items;
drop policy if exists "admin read all order items" on public.order_items;create policy "admin read all order items" on public.order_items for select using(public.is_admin() or exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists "seller read own order items" on public.order_items;create policy "seller read own order items" on public.order_items for select using(public.is_seller() and exists(select 1 from public.products p where p.id=product_id and p.seller_id=auth.uid()));

create or replace function public.place_order(p_items jsonb,p_address jsonb,p_payment_method text default 'cod') returns uuid language plpgsql security definer set search_path=public as $$
declare v_order_id uuid;v_total numeric(12,2):=0;item jsonb;v_product products%rowtype;v_qty integer;v_price numeric(12,2);
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_payment_method not in ('cod','online') then raise exception 'Invalid payment method';end if;
 if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Cart is empty';end if;
 insert into orders(user_id,status,payment_method,payment_status,total,shipping_address) values(auth.uid(),'placed',p_payment_method,case when p_payment_method='cod' then 'pending' else 'created' end,0,p_address) returning id into v_order_id;
 for item in select * from jsonb_array_elements(p_items) loop
  v_qty:=(item->>'quantity')::integer;if v_qty<1 then raise exception 'Invalid quantity';end if;
  select * into v_product from products where id=(item->>'product_id')::uuid and active=true for update;
  if not found then raise exception 'Product not available';end if;
  if v_product.stock<v_qty then raise exception 'Insufficient stock for %',v_product.name;end if;
  v_price:=v_product.price;v_total:=v_total+v_price*v_qty;
  insert into order_items(order_id,product_id,quantity,unit_price) values(v_order_id,v_product.id,v_qty,v_price);
  update products set stock=stock-v_qty where id=v_product.id;
 end loop;
 update orders set total=v_total where id=v_order_id;return v_order_id;
end;$$;
revoke all on function public.place_order(jsonb,jsonb,text) from public;grant execute on function public.place_order(jsonb,jsonb,text) to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));return new;end;$$;
drop trigger if exists on_auth_user_created on auth.users;create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace view public.product_ratings as select p.*,coalesce(round(avg(r.rating)::numeric,1),0) as rating_avg,count(r.id)::integer as review_count from public.products p left join public.reviews r on r.product_id=p.id group by p.id;

insert into public.categories(name) values('Fashion'),('Electronics'),('Home'),('Footwear'),('Beauty'),('Mobiles') on conflict(name) do nothing;

alter table public.products add column if not exists rating_avg numeric(3,2) not null default 0;
alter table public.products add column if not exists review_count integer not null default 0;
create or replace function public.refresh_product_rating() returns trigger language plpgsql security definer set search_path=public as $$ begin update products set rating_avg=coalesce((select round(avg(rating)::numeric,2) from reviews where product_id=coalesce(new.product_id,old.product_id)),0),review_count=(select count(*) from reviews where product_id=coalesce(new.product_id,old.product_id)) where id=coalesce(new.product_id,old.product_id);return coalesce(new,old);end;$$;
drop trigger if exists reviews_rating_refresh on public.reviews;create trigger reviews_rating_refresh after insert or update or delete on public.reviews for each row execute procedure public.refresh_product_rating();
