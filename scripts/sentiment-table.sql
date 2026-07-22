-- Shared audience-sentiment verdicts, one row per video.
-- Run once in the Supabase SQL editor. Mirrors the privacy model of the
-- `segments` table: video_id is a SHA-256 hash, never the raw YouTube ID.

create table if not exists public.sentiment (
  video_id text primary key,
  rating numeric not null check (rating >= 0 and rating <= 10),
  positive_pct integer not null check (positive_pct between 0 and 100),
  negative_pct integer not null check (negative_pct between 0 and 100),
  neutral_pct integer not null check (neutral_pct between 0 and 100),
  summary text not null default '',
  sample_size integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sentiment enable row level security;

-- Anyone with the anon key may read and contribute verdicts (same policy
-- shape as `segments`).
create policy "sentiment anon read" on public.sentiment
  for select to anon using (true);

create policy "sentiment anon insert" on public.sentiment
  for insert to anon with check (true);

create policy "sentiment anon update" on public.sentiment
  for update to anon using (true) with check (true);
