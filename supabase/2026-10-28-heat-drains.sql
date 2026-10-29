-- Freeze timer, round 3:
-- * Freezes outnumber heat -> 24 hour timer starts.
-- * While the timer runs, every heat drains an hour off it (never below 10 minutes left).
-- * A take whose heat reaches double its freezes (and at least 5) is saved for good.
-- * When the timer runs out, the take burns off the timeline.
create or replace function public.trg_reaction() returns trigger language plpgsql security definer set search_path to '' as $function$
declare p public.posts; pts int;
begin
  update public.posts set heat=heat+(new.kind='heat')::int, freezes=freezes+(new.kind='freeze')::int where id=new.post_id returning * into p;
  if p.status<>'gone' and not coalesce(p.reel,false) and not p.kept then
    if p.status='burning' and p.heat >= 5 and p.heat >= p.freezes*2 then
      update public.posts set status='normal', burn_ends=null, burn_left=null, kept=true where id=p.id;
      pts := 25 + p.heat*5;
      update public.profile_private set points=points+pts where id=p.user_id;
      insert into public.viral_log(user_id,post_id,points) values (p.user_id,p.id,pts);
      insert into public.notifications(user_id,actor_id,type,text,post_id) values (p.user_id,p.user_id,'saved','+'||pts||' points',p.id);
    elsif p.status='burning' and new.kind='heat' then
      update public.posts set burn_ends=greatest(now()+interval '10 minutes', burn_ends-interval '1 hour') where id=p.id;
    elsif p.status<>'burning' and p.freezes > p.heat then
      update public.posts set status='burning', burn_ends=now()+interval '24 hours', burn_left=null where id=p.id;
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
  for r in update public.posts set status='gone', gone_at=now()
      where status='burning' and burn_ends<=now() and not kept returning id,user_id,text loop
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (r.user_id,r.user_id,'burned',left(coalesce(nullif(r.text,''),'your take'),60),r.id);
  end loop;
  for r in update public.posts set paid=true
      where not paid and status<>'gone' and not coalesce(reel,false) and created_at<=now()-interval '24 hours' and heat>freezes
      returning id,user_id,heat,views loop
    pts := 50 + r.heat*10 + r.views/50;
    update public.profile_private set points=points+pts where id=r.user_id;
    insert into public.viral_log(user_id,post_id,points) values (r.user_id,r.id,pts);
    insert into public.notifications(user_id,actor_id,type,text,post_id) values (r.user_id,r.user_id,'viral','+'||pts||' points',r.id);
  end loop;
end $function$;

-- takes that were paused under the old rule pick their clock back up
update public.posts set status='burning', burn_ends=now()+greatest(burn_left, interval '1 hour'), burn_left=null where status='normal' and burn_left is not null and not kept and freezes>heat;
update public.posts set burn_left=null where burn_left is not null;
