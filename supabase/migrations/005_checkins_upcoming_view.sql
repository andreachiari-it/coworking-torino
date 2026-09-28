-- 005_checkins_upcoming_view.sql
-- La scheda spazio (Fase 4) mostra "chi ci va nei prossimi 7 giorni", non
-- solo oggi/domani: la vista checkins_today_public di 004_views.sql copriva
-- una finestra troppo stretta per quello. La sostituiamo con una vista più
-- ampia (e più chiaramente nominata) invece di modificare 004 con effetto
-- retroattivo su chi l'ha già eseguita.

drop view if exists public.checkins_today_public;

create view public.checkins_upcoming_public
with (security_invoker = true)
as
select
  c.id,
  c.space_id,
  c.date,
  c.time_from,
  c.time_to,
  c.note,
  case
    when p.show_in_checkins then p.display_name
    else 'Qualcuno della community'
  end as display_name,
  (c.user_id = auth.uid()) as is_mine
from public.checkins c
join public.profiles p on p.id = c.user_id
where c.date between current_date and current_date + 6;

grant select on public.checkins_upcoming_public to authenticated;
