-- Hardening for the shared `segments` and `sentiment` tables.
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Any client holding the public anon key can write rows, so the database now
-- rejects implausible data itself (the extension also validates on read):
--   • segments: a JSON array of well-formed segments that fit inside the video
--     and skip at most half of it — a poisoned row can't skip whole videos.
--   • sentiment: summaries capped at 600 characters.
-- Constraints are added NOT VALID: existing rows aren't re-checked, but every
-- new insert or update is.

create or replace function public.skipper_segments_plausible(segs jsonb, dur numeric)
returns boolean
language plpgsql
immutable
as $$
declare
  seg jsonb;
  seg_start numeric;
  seg_end numeric;
  skipped numeric := 0;
begin
  if dur is null or dur <= 0 or jsonb_typeof(segs) is distinct from 'array'
     or jsonb_array_length(segs) > 50 then
    return false;
  end if;

  for seg in select value from jsonb_array_elements(segs) loop
    if jsonb_typeof(seg) <> 'object'
       or jsonb_typeof(seg -> 'start') is distinct from 'number'
       or jsonb_typeof(seg -> 'end') is distinct from 'number'
       or coalesce(seg ->> 'type', '') not in (
         'sponsor', 'self_promo', 'affiliate', 'vpn', 'course', 'software',
         'product', 'discount_code', 'intro', 'outro'
       ) then
      return false;
    end if;

    seg_start := (seg ->> 'start')::numeric;
    seg_end := (seg ->> 'end')::numeric;
    if seg_start < 0 or seg_end <= seg_start or seg_end > dur + 1 then
      return false;
    end if;
    skipped := skipped + (seg_end - seg_start);
  end loop;

  return skipped <= dur * 0.5;
end;
$$;

alter table public.segments drop constraint if exists segments_plausible;
alter table public.segments
  add constraint segments_plausible
  check (public.skipper_segments_plausible(segments::jsonb, duration::numeric))
  not valid;

alter table public.sentiment drop constraint if exists sentiment_summary_length;
alter table public.sentiment
  add constraint sentiment_summary_length
  check (char_length(summary) <= 600)
  not valid;
