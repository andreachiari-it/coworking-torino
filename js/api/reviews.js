// js/api/reviews.js — recensioni community (sezione 6.3, 6.4).
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';
import { getSession } from '../auth.js';

/** Tutte le recensioni leggibili per uno spazio: pubblicate di chiunque + la propria anche se nascosta (RLS). */
export async function getReviewsForSpace(spaceId) {
  const { data } = await request(
    () => supabase.from('reviews').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }),
    { silent: true, fallbackMessage: 'Non riesco a caricare le recensioni.' }
  );
  return data || [];
}

/**
 * Crea o aggiorna la recensione dell'utente per questo spazio (una per
 * coppia spazio/utente, vedi il vincolo unique in 001_schema.sql).
 */
export async function upsertReview(spaceId, fields) {
  const session = await getSession();
  if (!session) return { data: null, error: new Error('not authenticated') };

  return request(
    () =>
      supabase
        .from('reviews')
        .upsert(
          {
            space_id: spaceId,
            user_id: session.user.id,
            rating: fields.rating,
            wifi_quality: fields.wifiQuality || null,
            power_outlets: fields.powerOutlets || null,
            noise_level: fields.noiseLevel || null,
            comment: fields.comment || null,
            visited_on: fields.visitedOn || null,
          },
          { onConflict: 'space_id,user_id' }
        )
        .select()
        .single(),
    { fallbackMessage: 'Non sono riuscito a salvare la recensione.' }
  );
}

export async function deleteReview(id) {
  return request(() => supabase.from('reviews').delete().eq('id', id), {
    fallbackMessage: 'Non sono riuscito a eliminare la recensione.',
  });
}

export async function getMyReviews() {
  const session = await getSession();
  if (!session) return [];

  const { data } = await request(
    () =>
      supabase
        .from('reviews')
        .select('id, rating, comment, visited_on, created_at, spaces:space_id (name, slug)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
    { fallbackMessage: 'Non riesco a caricare le tue recensioni.' }
  );
  return data || [];
}
