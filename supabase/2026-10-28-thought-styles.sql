-- Lingering thought bubble styles: Orange (default) and Blackout are free; the rest are in Fire Sale
alter table public.profiles add column if not exists thought_style text check (thought_style is null or thought_style ~ '^[a-z]{2,20}$');
grant select (thought_style) on public.profiles to authenticated, anon;
grant update (thought_style) on public.profiles to authenticated;
insert into public.shop_items(kind, id, name, price, plus_only) values
  ('bubbles', 'orange', 'Orange', 0, false),
  ('bubbles', 'blackout', 'Blackout', 0, false),
  ('bubbles', 'bubble', 'Bubble', 300, false),
  ('bubbles', 'gold', 'Gold', 400, false),
  ('bubbles', 'ice', 'Ice', 200, false),
  ('bubbles', 'neon', 'Neon', 250, false),
  ('bubbles', 'midnight', 'Midnight', 250, false)
on conflict (kind, id) do update set name = excluded.name, price = excluded.price;
-- only styles you own (or the free ones) can be worn
create or replace function public.trg_thought_style() returns trigger language plpgsql security definer set search_path to '' as $$
declare ok boolean;
begin
  if new.thought_style is null or new.thought_style in ('orange','blackout') then return new; end if;
  select coalesce((owned->'bubbles') ? new.thought_style, false) into ok from public.profile_private where id = new.id;
  if not ok then raise exception 'Get that bubble in Fire Sale first.'; end if;
  return new;
end $$;
drop trigger if exists thought_style_owned on public.profiles;
create trigger thought_style_owned before update of thought_style on public.profiles for each row execute function public.trg_thought_style();
