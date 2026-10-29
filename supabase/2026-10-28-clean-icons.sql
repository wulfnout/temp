-- Fire Sale: "Clean Icons" (bare outlined icons instead of the die-cut icon look), 250 points
insert into public.shop_items(kind, id, name, price, plus_only)
values ('styles', 'clean', 'Clean Icons', 250, false)
on conflict (kind, id) do update set name = excluded.name, price = excluded.price;
