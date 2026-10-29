-- ===== Saved payout details + cash out any time once you have $10 =====
-- Where to send a creator's money. Only the creator (and Temp's owner in the dashboard) can see it.
create table if not exists public.payout_details(
  user_id uuid primary key references auth.users(id) on delete cascade,
  method text not null check (method in ('paypal','cashapp','venmo','zelle')),
  handle text not null check (length(handle) between 2 and 120),
  legal_name text not null check (length(legal_name) between 2 and 100),
  updated_at timestamptz not null default now());
alter table public.payout_details enable row level security;
drop policy if exists "own payout details" on public.payout_details;
create policy "own payout details" on public.payout_details for select using (user_id = (select auth.uid()));

alter table public.cashout_requests drop constraint if exists cashout_requests_method_check;
alter table public.cashout_requests add constraint cashout_requests_method_check check (method in ('paypal','cashapp','venmo','zelle','bank'));
alter table public.cashout_requests add column if not exists legal_name text;

create or replace function public.set_payout_details(method text, handle text, legal_name text)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if method not in ('paypal','cashapp','venmo','zelle') then raise exception 'Pick a payout method.'; end if;
  handle := trim(coalesce(handle,'')); legal_name := trim(coalesce(legal_name,''));
  if length(handle) < 2 then raise exception 'Enter where to send your money.'; end if;
  if method = 'paypal' and handle !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter the email on your PayPal.'; end if;
  if method = 'cashapp' and handle !~ '^\$?[A-Za-z][A-Za-z0-9_-]{0,19}$' then raise exception 'Enter your $Cashtag.'; end if;
  if method = 'venmo' and handle !~ '^@?[A-Za-z0-9_-]{2,30}$' then raise exception 'Enter your Venmo @username.'; end if;
  if method = 'zelle' and handle !~ '^([^@\s]+@[^@\s]+\.[^@\s]+|\+?[0-9 ()-]{10,16})$' then raise exception 'Enter the email or phone number on your Zelle.'; end if;
  if length(legal_name) < 2 then raise exception 'Enter your full name as it shows on that account.'; end if;
  if method = 'cashapp' and left(handle,1) <> '$' then handle := '$' || handle; end if;
  if method = 'venmo' and left(handle,1) <> '@' then handle := '@' || handle; end if;
  insert into public.payout_details(user_id, method, handle, legal_name) values (auth.uid(), method, left(handle,120), left(legal_name,100))
    on conflict (user_id) do update set method = excluded.method, handle = excluded.handle, legal_name = excluded.legal_name, updated_at = now();
  return public.my_earnings();
end $$;

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
    'payout', (select jsonb_build_object('method', method, 'handle', handle, 'legal_name', legal_name) from public.payout_details where user_id = auth.uid()),
    'history', coalesce((select jsonb_agg(h order by h.created_at desc) from (
        select l.id, l.kind, l.sparks, l.cents, l.gift_id, l.note, l.created_at, p.handle as from_handle
        from public.creator_ledger l left join public.profiles p on p.id = l.from_id
        where l.user_id = auth.uid() order by l.created_at desc limit 60) h), '[]'::jsonb),
    'cashouts', coalesce((select jsonb_agg(c order by c.created_at desc) from (
        select id, cents, method, status, created_at, processed_at from public.cashout_requests where user_id = auth.uid() order by created_at desc limit 20) c), '[]'::jsonb))
$$;

-- cash out any time your balance is $10 or more: no waiting periods, no monthly limits, no fees
drop function if exists public.request_cashout(text, text, numeric);
create or replace function public.request_cashout(amount_cents numeric default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare bal numeric; b date; rid bigint; pd public.payout_details;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select birth into b from public.profile_private where id = auth.uid();
  if b is null or b > (now() - interval '18 years')::date then raise exception 'You need to be 18 or older to cash out. Check your birthday in Settings.'; end if;
  select * into pd from public.payout_details where user_id = auth.uid();
  if pd.user_id is null then raise exception 'Add where to send your money first.'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce(sum(cents),0) into bal from public.creator_ledger where user_id = auth.uid();
  amount_cents := round(coalesce(amount_cents, bal), 2);
  if amount_cents < 1000 then raise exception 'You can cash out once you have $10.'; end if;
  if amount_cents > bal then raise exception 'That’s more than your balance.'; end if;
  insert into public.cashout_requests(user_id, cents, method, handle, legal_name) values (auth.uid(), amount_cents, pd.method, pd.handle, pd.legal_name) returning id into rid;
  insert into public.creator_ledger(user_id, kind, cents, note) values (auth.uid(), 'cashout', -amount_cents, 'Cash out #' || rid);
  return public.my_earnings();
end $$;

grant execute on function public.my_earnings() to authenticated;
grant execute on function public.set_payout_details(text, text, text) to authenticated;
grant execute on function public.request_cashout(numeric) to authenticated;

-- live match x2 (in case it wasn't run yet): gifts in the final 30 seconds count double
create or replace function public.live_match_score(sid bigint)
 returns table(host_score bigint, guest_score bigint)
 language sql security definer set search_path to ''
as $function$
  select coalesce(sum(e.sparks * case when e.created_at >= s.match_until - interval '30 seconds' then 2 else 1 end) filter (where e.to_id = s.host_id),0)::bigint,
         coalesce(sum(e.sparks * case when e.created_at >= s.match_until - interval '30 seconds' then 2 else 1 end) filter (where e.to_id = s.guest_id),0)::bigint
  from public.live_streams s left join public.live_gift_events e on e.stream_id = s.id and s.match_started is not null and e.created_at >= s.match_started and e.created_at <= coalesce(s.match_until, now())
  where s.id = sid group by s.id;
$function$;

-- story reactions: allow any emoji (the old rule only allowed 🔥 😂 😮 🧊); the length limit stays
alter table public.story_reactions drop constraint if exists story_reactions_emoji_check;
alter table public.story_reactions validate constraint story_reaction_emoji_len;
