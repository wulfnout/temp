update public.posts set status='normal' where coalesce(reel,false) and status='frozen';
create or replace function public.trg_no_freeze_reels() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.kind='freeze' and exists(select 1 from public.posts where id=new.post_id and coalesce(reel,false)) then
    raise exception 'Replays can''t be frozen';
  end if;
  return new;
end $$;
drop trigger if exists no_freeze_reels on public.reactions;
create trigger no_freeze_reels before insert on public.reactions for each row execute function public.trg_no_freeze_reels();
-- ===== Creator earnings: 60% to creators, 40% to Temp, only from purchased Sparks =====
alter table public.profile_private add column if not exists sparks_paid integer not null default 0;

create table if not exists public.creator_ledger(
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('gift','cashout','refund','reversal','adjust')),
  sparks integer not null default 0,
  cents numeric(12,2) not null default 0,
  from_id uuid, gift_id text, stream_id bigint, note text,
  created_at timestamptz not null default now());
create index if not exists creator_ledger_user on public.creator_ledger(user_id, created_at desc);
alter table public.creator_ledger enable row level security;
drop policy if exists "own ledger" on public.creator_ledger;
create policy "own ledger" on public.creator_ledger for select using (user_id = (select auth.uid()));

create table if not exists public.cashout_requests(
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cents numeric(12,2) not null check (cents >= 1000),
  method text not null check (method in ('paypal','cashapp','venmo','bank')),
  handle text not null check (length(handle) between 2 and 120),
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  note text, created_at timestamptz not null default now(), processed_at timestamptz);
alter table public.cashout_requests enable row level security;
drop policy if exists "own cashouts" on public.cashout_requests;
create policy "own cashouts" on public.cashout_requests for select using (user_id = (select auth.uid()));

-- $0.99 buys 70 Sparks, so one Spark is worth 99/70 cents; creators keep 60% of that
create or replace function public.creator_rate() returns numeric language sql immutable as $$ select 0.60::numeric $$;
create or replace function public.spark_cents() returns numeric language sql immutable as $$ select (99.0/70.0)::numeric $$;

create or replace function public.live_send_gift(sid bigint, gift text, qty integer default 1, to_uid uuid default null)
returns integer language plpgsql security definer set search_path to '' as $function$
declare host uuid; guest uuid; ended timestamptz; c int; bal int; paid int; paid_used int; dest uuid; total int;
begin
  if auth.uid() is null then raise exception 'Sign in to send gifts.'; end if;
  if qty is null or qty < 1 or qty > 99 then raise exception 'Pick between 1 and 99.'; end if;
  select cost into c from public.live_gift_catalog where id = gift;
  if c is null then raise exception 'That gift isn’t available.'; end if;
  select host_id, guest_id, ended_at into host, guest, ended from public.live_streams where id = sid;
  if host is null or ended is not null then raise exception 'This live has ended.'; end if;
  dest := coalesce(to_uid, host);
  if dest <> host and dest is distinct from guest then raise exception 'They’re not on this live.'; end if;
  if dest = auth.uid() then raise exception 'You can’t gift yourself.'; end if;
  total := c * qty;
  select sparks, sparks_paid into bal, paid from public.profile_private where id = auth.uid() for update;
  if bal is null or bal < total then raise exception 'Not enough Sparks.'; end if;
  paid_used := least(total, greatest(coalesce(paid,0),0));
  update public.profile_private set sparks = sparks - total, sparks_paid = greatest(0, sparks_paid - paid_used), sparks_sent = sparks_sent + total where id = auth.uid();
  update public.profile_private set sparks_received = sparks_received + total where id = dest;
  insert into public.live_gift_events(stream_id, from_id, to_id, gift_id, qty, sparks) values (sid, auth.uid(), dest, gift, qty, total);
  insert into public.creator_ledger(user_id, kind, sparks, cents, from_id, gift_id, stream_id, note)
    values (dest, 'gift', total, round(paid_used * public.spark_cents() * public.creator_rate(), 2), auth.uid(), gift, sid,
            case when paid_used = 0 then 'free Sparks' when paid_used < total then 'part free Sparks' else null end);
  return bal - total;
end $function$;

create or replace function public.my_earnings()
returns jsonb language sql security definer set search_path to '' as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(cents) from public.creator_ledger where user_id = auth.uid()), 0),
    'lifetime', coalesce((select sum(cents) from public.creator_ledger where user_id = auth.uid() and kind = 'gift'), 0),
    'sparks', coalesce((select sparks_received from public.profile_private where id = auth.uid()), 0),
    'pending', coalesce((select sum(cents) from public.cashout_requests where user_id = auth.uid() and status = 'pending'), 0),
    'paid', coalesce((select sum(cents) from public.cashout_requests where user_id = auth.uid() and status = 'paid'), 0),
    'rate', public.creator_rate(), 'min', 1000,
    'adult', coalesce((select birth <= (now() - interval '18 years')::date from public.profile_private where id = auth.uid()), false),
    'history', coalesce((select jsonb_agg(h order by h.created_at desc) from (
        select l.id, l.kind, l.sparks, l.cents, l.gift_id, l.note, l.created_at, p.handle as from_handle
        from public.creator_ledger l left join public.profiles p on p.id = l.from_id
        where l.user_id = auth.uid() order by l.created_at desc limit 60) h), '[]'::jsonb),
    'cashouts', coalesce((select jsonb_agg(c order by c.created_at desc) from (
        select id, cents, method, status, created_at, processed_at from public.cashout_requests where user_id = auth.uid() order by created_at desc limit 20) c), '[]'::jsonb))
$$;

create or replace function public.request_cashout(method text, handle text, amount_cents numeric)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare bal numeric; b date; rid bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select birth into b from public.profile_private where id = auth.uid();
  if b is null or b > (now() - interval '18 years')::date then raise exception 'You need to be 18 or older to cash out. Check your birthday in Settings.'; end if;
  if method not in ('paypal','cashapp','venmo','bank') then raise exception 'Pick a payout method.'; end if;
  handle := trim(coalesce(handle,''));
  if length(handle) < 2 then raise exception 'Enter where to send your money.'; end if;
  amount_cents := round(amount_cents, 2);
  if amount_cents is null or amount_cents < 1000 then raise exception 'The smallest cash out is $10.'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(cents),0) into bal from public.creator_ledger where user_id = auth.uid();
  if amount_cents > bal then raise exception 'That’s more than your balance.'; end if;
  insert into public.cashout_requests(user_id, cents, method, handle) values (auth.uid(), amount_cents, method, left(handle,120)) returning id into rid;
  insert into public.creator_ledger(user_id, kind, cents, note) values (auth.uid(), 'cashout', -amount_cents, 'Cash out #' || rid);
  return public.my_earnings();
end $$;

-- for Temp's owner: mark a cash out paid, or reject it (rejecting puts the money back)
create or replace function public.settle_cashout(rid bigint, paid boolean, msg text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare r public.cashout_requests;
begin
  update public.cashout_requests set status = case when paid then 'paid' else 'rejected' end, processed_at = now(), note = msg
    where id = rid and status = 'pending' returning * into r;
  if r.id is null then raise exception 'No pending cash out with that number.'; end if;
  if not paid then insert into public.creator_ledger(user_id, kind, cents, note) values (r.user_id, 'refund', r.cents, 'Cash out #' || rid || ' returned'); end if;
end $$;
revoke all on function public.settle_cashout(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.my_earnings() to authenticated;
grant execute on function public.request_cashout(text, text, numeric) to authenticated;

-- ===== Reflame: keeps a take alive past its timer; quote reflames are posts that embed the original =====
alter table public.posts add column if not exists kept boolean not null default false;
alter table public.posts add column if not exists quote_of bigint references public.posts(id) on delete set null;

create or replace function public.trg_repost() returns trigger language plpgsql security definer set search_path to '' as $function$
declare p public.posts;
begin
  if tg_op='INSERT' then
    update public.posts set reposts=reposts+1, kept=true where id=new.post_id returning * into p;
    if p.user_id<>new.user_id then
      insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,new.user_id,'reflame',left(coalesce(nullif(p.text,''),'your post'),60),p.id);
    end if;
    return new;
  else
    update public.posts set reposts=greatest(0,reposts-1) where id=old.post_id;
    return old;
  end if;
end $function$;

create or replace function public.trg_quote() returns trigger language plpgsql security definer set search_path to '' as $$
declare p public.posts;
begin
  if new.quote_of is not null then
    update public.posts set kept=true, reposts=reposts+1 where id=new.quote_of and status<>'gone' returning * into p;
    if p.id is null then raise exception 'That take has burned away.'; end if;
    if p.user_id<>new.user_id then
      insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,new.user_id,'quote',left(coalesce(nullif(new.text,''),'quoted your take'),60),new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists post_quote on public.posts;
create trigger post_quote after insert on public.posts for each row execute function public.trg_quote();

create or replace function public.expire_posts() returns void language plpgsql security definer set search_path to '' as $function$
declare r record; pts int;
begin
  for r in update public.posts set status='gone', gone_at=now() where status='burning' and burn_ends<=now() and not kept returning id,user_id,heat,views loop
    pts := 50 + r.heat*10 + r.views/50;
    update public.profile_private set points=points+pts where id=r.user_id;
    insert into public.viral_log(user_id,post_id,points) values (r.user_id,r.id,pts);
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (r.user_id,r.user_id,'viral','+'||pts||' points',r.id);
  end loop;
end $function$;

grant select (kept, quote_of) on public.posts to authenticated, anon;
grant insert (quote_of) on public.posts to authenticated;
grant select (sparks_paid) on public.profile_private to authenticated;
