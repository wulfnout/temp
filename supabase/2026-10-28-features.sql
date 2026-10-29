-- Fire Sale: "Clean Icons" (bare outlined icons instead of the die-cut icon look), 250 points
insert into public.shop_items(kind, id, name, price, plus_only)
values ('styles', 'clean', 'Clean Icons', 250, false)
on conflict (kind, id) do update set name = excluded.name, price = excluded.price;
-- ===== Polls on takes, pin a take to your profile, mute accounts =====

-- Polls: 2 to 4 options, open for 24 hours, one vote each
alter table public.posts add column if not exists poll jsonb;
alter table public.posts drop constraint if exists posts_poll_ok;
alter table public.posts add constraint posts_poll_ok check (poll is null or (jsonb_typeof(poll->'o') = 'array' and jsonb_array_length(poll->'o') between 2 and 4 and pg_column_size(poll) < 800));
grant select (poll) on public.posts to authenticated, anon;
grant insert (poll) on public.posts to authenticated;

create table if not exists public.poll_votes(
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  choice smallint not null check (choice between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id));
alter table public.poll_votes enable row level security;
drop policy if exists "own votes" on public.poll_votes;
create policy "own votes" on public.poll_votes for select using (user_id = (select auth.uid()));

create or replace function public.vote_poll(pid bigint, pick int) returns void language plpgsql security definer set search_path to '' as $$
declare p public.posts;
begin
  if auth.uid() is null then raise exception 'Sign in to vote.'; end if;
  select * into p from public.posts where id = pid;
  if p.id is null or p.poll is null or p.status = 'gone' then raise exception 'That poll is gone.'; end if;
  if p.created_at < now() - interval '24 hours' then raise exception 'This poll has closed.'; end if;
  if pick < 0 or pick >= jsonb_array_length(p.poll->'o') then raise exception 'Pick one of the options.'; end if;
  insert into public.poll_votes(post_id, user_id, choice) values (pid, auth.uid(), pick);
exception when unique_violation then raise exception 'You already voted.';
end $$;
grant execute on function public.vote_poll(bigint, int) to authenticated;

create or replace function public.poll_results(ids bigint[]) returns table(post_id bigint, choice smallint, n bigint) language sql security definer set search_path to '' stable as $$
  select post_id, choice, count(*) from public.poll_votes where post_id = any(ids) group by 1, 2
$$;
grant execute on function public.poll_results(bigint[]) to authenticated, anon;

-- Pin one of your own takes or Replays to the top of your profile
alter table public.profiles add column if not exists pinned_post bigint references public.posts(id) on delete set null;
grant select (pinned_post) on public.profiles to authenticated, anon;
grant update (pinned_post) on public.profiles to authenticated;
create or replace function public.trg_pin_own() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.pinned_post is not null and not exists(select 1 from public.posts where id = new.pinned_post and user_id = new.id) then
    raise exception 'You can only pin your own posts.';
  end if;
  return new;
end $$;
drop trigger if exists pin_own on public.profiles;
create trigger pin_own before update of pinned_post on public.profiles for each row execute function public.trg_pin_own();

-- Mute: hide someone's takes, Replays and stories without unfollowing or blocking them (they're never told)
create table if not exists public.mutes(
  muter uuid not null references auth.users(id) on delete cascade default auth.uid(),
  muted uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter, muted));
alter table public.mutes enable row level security;
drop policy if exists "own mutes" on public.mutes;
create policy "own mutes" on public.mutes for all using (muter = (select auth.uid())) with check (muter = (select auth.uid()));
grant select, insert, delete on public.mutes to authenticated;

-- Lingering thoughts: a short daily message on your profile (lasts 24 hours); people react with an emoji or reply in DMs
alter table public.profiles add column if not exists thought text check (thought is null or char_length(thought) <= 80);
alter table public.profiles add column if not exists thought_at timestamptz;
grant select (thought, thought_at) on public.profiles to authenticated, anon;
grant update (thought, thought_at) on public.profiles to authenticated;

create table if not exists public.thought_reactions(
  owner uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (owner, user_id));
alter table public.thought_reactions enable row level security;
drop policy if exists "see thought reactions" on public.thought_reactions;
create policy "see thought reactions" on public.thought_reactions for select using (true);
drop policy if exists "react to thoughts" on public.thought_reactions;
create policy "react to thoughts" on public.thought_reactions for insert with check (user_id = (select auth.uid()) and owner <> (select auth.uid()));
drop policy if exists "change own reaction" on public.thought_reactions;
create policy "change own reaction" on public.thought_reactions for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "remove own reaction" on public.thought_reactions;
create policy "remove own reaction" on public.thought_reactions for delete using (user_id = (select auth.uid()) or owner = (select auth.uid()));
grant select, insert, update, delete on public.thought_reactions to authenticated;

-- a new thought starts fresh: old reactions go
create or replace function public.trg_new_thought() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.thought is distinct from old.thought then
    delete from public.thought_reactions where owner = new.id;
    new.thought_at := case when new.thought is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists new_thought on public.profiles;
create trigger new_thought before update of thought on public.profiles for each row execute function public.trg_new_thought();

-- tell the owner when someone reacts
create or replace function public.trg_thought_react() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.notifications(user_id, actor_id, type, text) values (new.owner, new.user_id, 'thoughtReact', new.emoji);
  return new;
end $$;
drop trigger if exists thought_react on public.thought_reactions;
create trigger thought_react after insert on public.thought_reactions for each row execute function public.trg_thought_react();
