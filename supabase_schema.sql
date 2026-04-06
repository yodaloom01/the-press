-- ============================================================
-- THE PRESS — Supabase Database Schema
-- Run this in your Supabase SQL editor (supabase.com → SQL Editor)
-- ============================================================

-- POSTS TABLE
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc', now()),
  wallet_address text not null,
  caption text,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'gif')),
  coin_ticker text not null,
  coin_mint text not null,
  amount_paid numeric not null,
  amount_paid_usd numeric,
  tx_signature text not null unique,
  views bigint default 0,
  likes bigint default 0,
  represses bigint default 0,
  reach_target bigint default 0,
  is_active boolean default true
);

-- LIKES TABLE (prevent double likes)
create table if not exists likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  wallet_address text not null,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(post_id, wallet_address)
);

-- COIN STATS TABLE (track which coins are used most)
create table if not exists coin_stats (
  id uuid default gen_random_uuid() primary key,
  coin_ticker text not null unique,
  coin_mint text not null,
  total_paid numeric default 0,
  total_posts bigint default 0,
  last_used timestamp with time zone default timezone('utc', now())
);

-- STORAGE BUCKET for media uploads
insert into storage.buckets (id, name, public)
values ('press-media', 'press-media', true)
on conflict do nothing;

-- STORAGE POLICY: anyone can read, authenticated wallets can upload
create policy "Public media access"
  on storage.objects for select
  using (bucket_id = 'press-media');

create policy "Wallet upload access"
  on storage.objects for insert
  with check (bucket_id = 'press-media');

-- ROW LEVEL SECURITY
alter table posts enable row level security;
alter table likes enable row level security;
alter table coin_stats enable row level security;

-- POSTS POLICIES
create policy "Anyone can read posts"
  on posts for select using (true);

create policy "Anyone can insert posts"
  on posts for insert with check (true);

-- LIKES POLICIES
create policy "Anyone can read likes"
  on likes for select using (true);

create policy "Anyone can insert likes"
  on likes for insert with check (true);

-- COIN STATS POLICIES
create policy "Anyone can read coin stats"
  on coin_stats for select using (true);

create policy "Anyone can upsert coin stats"
  on coin_stats for insert with check (true);

create policy "Anyone can update coin stats"
  on coin_stats for update using (true);

-- FUNCTION: increment view count
create or replace function increment_views(post_id uuid)
returns void as $$
  update posts set views = views + 1 where id = post_id;
$$ language sql;

-- FUNCTION: increment likes
create or replace function increment_likes(post_id uuid, wallet text)
returns void as $$
begin
  insert into likes (post_id, wallet_address) values (post_id, wallet)
  on conflict do nothing;
  update posts set likes = (select count(*) from likes where likes.post_id = posts.id)
  where id = post_id;
end;
$$ language plpgsql;

-- INDEX for fast feed queries
create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists posts_amount_paid_idx on posts(amount_paid desc);
create index if not exists posts_views_idx on posts(views desc);
