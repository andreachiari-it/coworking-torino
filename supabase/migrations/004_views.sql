-- 004_views.sql
-- security_invoker = true means these views run with the CALLING role's
-- privileges and RLS, not the view owner's -- so a member still only ever
-- sees what the base-table policies allow.

create view public.spaces_public
with (security_invoker = true)
as
select
  s.*,
  r.avg_rating as avg_community_rating,
  coalesce(r.reviews_count, 0) as reviews_count,
  coalesce(ct.checkins_today, 0) as checkins_today,
  coalesce(c7.checkins_next_7_days, 0) as checkins_next_7_days
from public.spaces s
left join (
  select space_id, avg(rating)::numeric(3, 2) as avg_rating, count(*) as reviews_count
  from public.reviews
  where status = 'published'
  group by space_id
) r on r.space_id = s.id
left join (
  select space_id, count(*) as checkins_today
  from public.checkins
  where date = current_date
  group by space_id
) ct on ct.space_id = s.id
left join (
  select space_id, count(*) as checkins_next_7_days
  from public.checkins
  where date between current_date and current_date + 6
  group by space_id
) c7 on c7.space_id = s.id
where s.is_published = true;

grant select on public.spaces_public to authenticated;

-- Check-ins for today and tomorrow, with the display name suppressed
-- (never the email) when the user opted out of show_in_checkins.
create view public.checkins_today_public
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
  end as display_name
from public.checkins c
join public.profiles p on p.id = c.user_id
where c.date in (current_date, current_date + 1);

grant select on public.checkins_today_public to authenticated;
