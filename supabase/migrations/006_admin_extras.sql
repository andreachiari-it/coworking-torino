-- 006_admin_extras.sql
-- Tre cose che servono alla dashboard admin (Fase 5):
--  1) rename_field_option: rinomina un valore di field_options e aggiorna
--     a cascata ogni riga di spaces che lo usa, in una transazione.
--  2) un trigger che impedisce di revocare l'ultimo admin rimasto.
--  3) il bucket di storage per le immagini di copertina degli spazi.

-- ---------------------------------------------------------------------------
-- 1) rename_field_option
-- ---------------------------------------------------------------------------
create or replace function public.rename_field_option(p_field text, p_old_value text, p_new_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can rename field options';
  end if;

  update public.field_options set value = p_new_value where field = p_field and value = p_old_value;

  if p_field = 'type' then
    update public.spaces set type = p_new_value where type = p_old_value;
  elsif p_field = 'zone' then
    update public.spaces set zone = p_new_value where zone = p_old_value;
  elsif p_field = 'cost_type' then
    update public.spaces set cost_type = p_new_value where cost_type = p_old_value;
  elsif p_field = 'source' then
    update public.spaces set source = p_new_value where source = p_old_value;
  elsif p_field = 'personal_rating' then
    update public.spaces set personal_rating = p_new_value where personal_rating = p_old_value;
  elsif p_field = 'wifi_quality' then
    update public.spaces set wifi_quality = p_new_value where wifi_quality = p_old_value;
  elsif p_field = 'power_outlets' then
    update public.spaces set power_outlets = p_new_value where power_outlets = p_old_value;
  elsif p_field = 'call_space' then
    update public.spaces set call_space = p_new_value where call_space = p_old_value;
  elsif p_field = 'mood' then
    update public.spaces set mood = array_replace(mood, p_old_value, p_new_value) where p_old_value = any(mood);
  end if;
end;
$$;

revoke execute on function public.rename_field_option(text, text, text) from public;
grant execute on function public.rename_field_option(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) non si può revocare l'ultimo admin
-- ---------------------------------------------------------------------------
create or replace function public.prevent_last_admin_revoke()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  admin_count int;
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin';
    if admin_count <= 1 then
      raise exception 'Non puoi revocare l''unico admin rimasto';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_last_admin_revoke
  before update on public.profiles
  for each row execute function public.prevent_last_admin_revoke();

-- ---------------------------------------------------------------------------
-- 3) storage: copertine degli spazi (lettura pubblica, scrittura solo admin)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('space-covers', 'space-covers', true)
on conflict (id) do nothing;

create policy "space_covers_public_read" on storage.objects
  for select using (bucket_id = 'space-covers');

create policy "space_covers_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'space-covers' and public.is_admin());

create policy "space_covers_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'space-covers' and public.is_admin());

create policy "space_covers_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'space-covers' and public.is_admin());
