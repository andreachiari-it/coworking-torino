// js/api/checkins.js — "Ci vado" (sezione 6.3, 6.4).
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';
import { getSession } from '../auth.js';

/**
 * @param {{ spaceId: string, date: string, timeFrom?: string, timeTo?: string, note?: string }} params
 */
export async function createCheckin({ spaceId, date, timeFrom, timeTo, note }) {
  const session = await getSession();
  if (!session) return { data: null, error: new Error('not authenticated') };

  return request(
    () =>
      supabase
        .from('checkins')
        .insert({
          space_id: spaceId,
          user_id: session.user.id,
          date,
          time_from: timeFrom || null,
          time_to: timeTo || null,
          note: note || null,
        })
        .select()
        .single(),
    { fallbackMessage: 'Non sono riuscito a salvare il check-in.' }
  );
}

export async function cancelCheckin(id) {
  return request(() => supabase.from('checkins').delete().eq('id', id), {
    fallbackMessage: 'Non sono riuscito a cancellare il check-in.',
  });
}

/** I check-in futuri dell'utente loggato, con il nome dello spazio. */
export async function getMyUpcomingCheckins() {
  const session = await getSession();
  if (!session) return [];

  const { data } = await request(
    () =>
      supabase
        .from('checkins')
        .select('id, date, time_from, time_to, note, spaces:space_id (name, slug)')
        .eq('user_id', session.user.id)
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date'),
    { fallbackMessage: 'Non riesco a caricare i tuoi check-in.' }
  );
  return data || [];
}

/** Chi ci va nei prossimi 7 giorni per uno spazio (nomi anonimizzati secondo show_in_checkins). */
export async function getUpcomingCheckinsForSpace(spaceId) {
  const { data } = await request(
    () =>
      supabase
        .from('checkins_upcoming_public')
        .select('*')
        .eq('space_id', spaceId)
        .order('date'),
    { silent: true, fallbackMessage: 'Non riesco a caricare chi ci va.' }
  );
  return data || [];
}
