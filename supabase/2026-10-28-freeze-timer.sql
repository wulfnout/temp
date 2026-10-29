-- ===== New rule: freezes start the clock =====
-- * A take with more heat than freezes (or no reactions) stays on the timeline. No timer.
-- * Once freezes outnumber heat, a 24 hour flame timer starts: the take has that long to heat back up.
-- * Heat catches up (heat >= freezes): the timer pauses and the time left is saved.
--   If freezes take the lead again, the timer picks up where it left off (at least 1 hour).
-- * Heat reaches double the freezes (and at least 5): saved for good, never gets a timer again, +points.
-- * Timer runs out while freezes still lead: the take burns off the timeline.
-- * A take that's been up 24 hours with more heat than freezes pays out once: 50 + heat x10 + views/50.
alter table public.posts add column if not exists burn_left interval;
alter table public.posts add column if not exists paid boolean not null default false;
grant select (burn_left, paid) on public.posts to authenticated, anon;

-- posts that were on the old heat timer now just stay up; nothing is frozen any more
update public.posts set status='normal', burn_ends=null where status in ('burning','frozen') and heat >= freezes;
update public.posts set status='burning', burn_ends=now()+interval '24 hours' where status in ('burning','frozen') and freezes > heat and not kept;
update public.posts set status='normal', burn_ends=null where status in ('burning','frozen') and kept;

create or replace function public.trg_reaction() returns trigger language plpgsql security definer set search_path to '' as $function$
declare p public.posts; pts int;
begin
  update public.posts set heat=heat+(new.kind='heat')::int, freezes=freezes+(new.kind='freeze')::int where id=new.post_id returning * into p;
  -- Replays and kept takes (Reflamed, Temp+ kept, or saved) never get a timer
  if p.status<>'gone' and not coalesce(p.reel,false) and not p.kept then
    if (p.status='burning' or p.burn_left is not null) and p.heat >= 5 and p.heat >= p.freezes*2 then
      -- saved for good
      update public.posts set status='normal', burn_ends=null, burn_left=null, kept=true where id=p.id;
      pts := 25 + p.heat*5;
      update public.profile_private set points=points+pts where id=p.user_id;
      insert into public.viral_log(user_id,post_id,points) values (p.user_id,p.id,pts);
      insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,p.user_id,'saved','+'||pts||' points',p.id);
    elsif p.freezes > p.heat and p.status<>'burning' then
      update public.posts set status='burning', burn_ends=now()+coalesce(greatest(p.burn_left, interval '1 hour'), interval '24 hours'), burn_left=null where id=p.id;
    elsif p.heat >= p.freezes and p.status='burning' then
      update public.posts set status='normal', burn_left=greatest(p.burn_ends-now(), interval '0'), burn_ends=null where id=p.id;
    end if;
  end if;
  if p.user_id<>new.user_id then
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,new.user_id,new.kind,left(coalesce(nullif(p.text,''),'your post'),60),p.id);
  end if;
  return new;
end $function$;

create or replace function public.expire_posts() returns void language plpgsql security definer set search_path to '' as $function$
declare r record; pts int;
begin
  -- the clock ran out while freezes still lead: burned off the timeline
  for r in update public.posts set status='gone', gone_at=now()
      where status='burning' and burn_ends<=now() and not kept and freezes>heat returning id,user_id,text loop
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (r.user_id,r.user_id,'burned',left(coalesce(nullif(r.text,''),'your take'),60),r.id);
  end loop;
  -- safety: a timer that ran out after heat caught up just stops
  update public.posts set status='normal', burn_left=null, burn_ends=null where status='burning' and burn_ends<=now() and (kept or heat>=freezes);
  -- hot takes pay out once they've been up a day
  for r in update public.posts set paid=true
      where not paid and status<>'gone' and not coalesce(reel,false) and created_at<=now()-interval '24 hours' and heat>freezes
      returning id,user_id,heat,views loop
    pts := 50 + r.heat*10 + r.views/50;
    update public.profile_private set points=points+pts where id=r.user_id;
    insert into public.viral_log(user_id,post_id,points) values (r.user_id,r.id,pts);
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (r.user_id,r.user_id,'viral','+'||pts||' points',r.id);
  end loop;
end $function$;
