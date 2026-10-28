-- Live matches: gifts sent in the final 30 seconds count double (x2 gifting points)
create or replace function public.live_match_score(sid bigint)
 returns table(host_score bigint, guest_score bigint)
 language sql security definer set search_path to ''
as $function$
  select coalesce(sum(e.sparks * case when e.created_at >= s.match_until - interval '30 seconds' then 2 else 1 end) filter (where e.to_id = s.host_id),0)::bigint,
         coalesce(sum(e.sparks * case when e.created_at >= s.match_until - interval '30 seconds' then 2 else 1 end) filter (where e.to_id = s.guest_id),0)::bigint
  from public.live_streams s left join public.live_gift_events e on e.stream_id = s.id and s.match_started is not null and e.created_at >= s.match_started and e.created_at <= coalesce(s.match_until, now())
  where s.id = sid group by s.id;
$function$;
