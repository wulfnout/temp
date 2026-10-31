-- ===== Back to the heat clock =====
-- * Every new take starts with a 24 hour timer.
-- * Heat reaching double the freezes (and at least 5 heat) saves it for good: timer gone, +points.
-- * Timer runs out without being saved: the take burns off the timeline.
-- * Replays and kept takes (Reflamed, Temp+ kept, already saved) never get a timer.

-- 1) new takes start the clock
create or replace function public.trg_post_clock() returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if not coalesce(new.reel,false) and not coalesce(new.kept,false) then
    new.status := 'burning';
    new.burn_ends := now() + interval '24 hours';
    new.burn_left := null;
  end if;
  return new;
end $function$;
drop trigger if exists post_clock on public.posts;
create trigger post_clock before insert on public.posts for each row execute function public.trg_post_clock();

-- 2) reactions: only heat can save a take; nothing else touches the clock
create or replace function public.trg_reaction() returns trigger language plpgsql security definer set search_path to '' as $function$
declare p public.posts; pts int;
begin
  update public.posts set heat=heat+(new.kind='heat')::int, freezes=freezes+(new.kind='freeze')::int where id=new.post_id returning * into p;
  if p.status='burning' and not coalesce(p.reel,false) and not p.kept and p.heat >= 5 and p.heat >= p.freezes*2 then
    update public.posts set status='normal', burn_ends=null, burn_left=null, kept=true where id=p.id;
    pts := 25 + p.heat*5;
    update public.profile_private set points=points+pts where id=p.user_id;
    insert into public.viral_log(user_id,post_id,points) values (p.user_id,p.id,pts);
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,p.user_id,'saved','+'||pts||' points',p.id);
  end if;
  if p.user_id<>new.user_id then
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,new.user_id,new.kind,left(coalesce(nullif(p.text,''),'your post'),60),p.id);
  end if;
  return new;
end $function$;

-- 3) the clock runs out: burned off
create or replace function public.expire_posts() returns void language plpgsql security definer set search_path to '' as $function$
declare r record; pts int;
begin
  for r in update public.posts set status='gone', gone_at=now()
      where status='burning' and burn_ends<=now() and not kept returning id,user_id,text loop
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (r.user_id,r.user_id,'burned',left(coalesce(nullif(r.text,''),'your take'),60),r.id);
  end loop;
end $function$;

-- 4) takes already up (not saved, not Replays) get a fresh 24 hours from now, so nothing vanishes at once
update public.posts set status='burning', burn_ends=now()+interval '24 hours', burn_left=null
  where status<>'gone' and not kept and not coalesce(reel,false);
update public.posts set status='normal', burn_ends=null, burn_left=null where status<>'gone' and (kept or coalesce(reel,false));
