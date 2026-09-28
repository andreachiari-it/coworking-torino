// js/api/admin.js — tutto ciò che la dashboard admin legge/scrive oltre a
// spaces (vedi js/api/field-options.js per le opzioni campo).
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';
import { getSession } from '../auth.js';

// --- Spazi ------------------------------------------------------------

export async function listAllSpaces() {
  const { data } = await request(() => supabase.from('spaces').select('*').order('name'), {
    fallbackMessage: 'Non riesco a caricare gli spazi.',
  });
  return data || [];
}

export async function getSpaceById(id) {
  const { data } = await request(() => supabase.from('spaces').select('*').eq('id', id).single(), {
    fallbackMessage: 'Non riesco a caricare questo spazio.',
  });
  return data;
}

export async function createSpace(fields) {
  return request(() => supabase.from('spaces').insert(fields).select().single(), {
    fallbackMessage: 'Non sono riuscito a creare lo spazio.',
  });
}

export async function updateSpace(id, patch) {
  return request(() => supabase.from('spaces').update(patch).eq('id', id).select().single(), {
    fallbackMessage: 'Non sono riuscito a salvare le modifiche.',
  });
}

export async function deleteSpace(id) {
  return request(() => supabase.from('spaces').delete().eq('id', id), {
    fallbackMessage: 'Non sono riuscito a eliminare lo spazio.',
  });
}

export async function duplicateSpace(space) {
  // eslint-disable-next-line no-unused-vars
  const { id, slug, created_at, updated_at, updated_by, ...rest } = space;
  return createSpace({ ...rest, name: `${space.name} (copia)`, is_published: false });
}

export async function bulkSetPublished(ids, isPublished) {
  return request(() => supabase.from('spaces').update({ is_published: isPublished }).in('id', ids), {
    fallbackMessage: 'Non sono riuscito ad aggiornare gli spazi selezionati.',
  });
}

export async function getAuditLogForSpace(spaceId) {
  const { data } = await request(
    () => supabase.from('audit_log').select('*').eq('table_name', 'spaces').eq('record_id', spaceId).order('created_at', { ascending: false }),
    { fallbackMessage: "Non riesco a caricare lo storico." }
  );
  return data || [];
}

// --- Segnalazioni -------------------------------------------------------

export async function listSuggestions(status) {
  let query = supabase.from('suggestions').select('*, spaces:space_id (name, slug)').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await request(() => query, { fallbackMessage: 'Non riesco a caricare le segnalazioni.' });
  return data || [];
}

export async function approveSuggestion(id) {
  return request(() => supabase.rpc('approve_suggestion', { suggestion_id: id }), {
    fallbackMessage: 'Non sono riuscito ad approvare la segnalazione.',
  });
}

export async function rejectSuggestion(id, adminNote) {
  const session = await getSession();
  return request(
    () =>
      supabase
        .from('suggestions')
        .update({ status: 'rejected', admin_note: adminNote || null, reviewed_at: new Date().toISOString(), reviewed_by: session?.user.id })
        .eq('id', id),
    { fallbackMessage: 'Non sono riuscito a rifiutare la segnalazione.' }
  );
}

/** Marca approvata una segnalazione dopo che l'admin l'ha applicata a mano ("Approva con modifiche"). */
export async function markSuggestionApprovedManually(id) {
  const session = await getSession();
  return request(
    () => supabase.from('suggestions').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: session?.user.id }).eq('id', id),
    { fallbackMessage: 'Non sono riuscito ad aggiornare la segnalazione.' }
  );
}

// --- Recensioni -----------------------------------------------------------

export async function listAllReviews(spaceId) {
  let query = supabase.from('reviews').select('*, spaces:space_id (name, slug)').order('created_at', { ascending: false });
  if (spaceId) query = query.eq('space_id', spaceId);
  const { data } = await request(() => query, { fallbackMessage: 'Non riesco a caricare le recensioni.' });
  return data || [];
}

export async function setReviewStatus(id, status) {
  return request(() => supabase.from('reviews').update({ status }).eq('id', id), {
    fallbackMessage: 'Non sono riuscito ad aggiornare la recensione.',
  });
}

export async function deleteReviewAdmin(id) {
  return request(() => supabase.from('reviews').delete().eq('id', id), {
    fallbackMessage: 'Non sono riuscito a eliminare la recensione.',
  });
}

// --- Community --------------------------------------------------------

export async function listCommunityUsers() {
  const [{ data: profiles }, { data: checkins }, { data: reviews }] = await Promise.all([
    request(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }), {
      fallbackMessage: 'Non riesco a caricare la community.',
    }),
    request(() => supabase.from('checkins').select('user_id'), { silent: true }),
    request(() => supabase.from('reviews').select('user_id'), { silent: true }),
  ]);

  const checkinCounts = countBy(checkins || []);
  const reviewCounts = countBy(reviews || []);

  return (profiles || []).map((p) => ({
    ...p,
    checkins_count: checkinCounts[p.id] || 0,
    reviews_count: reviewCounts[p.id] || 0,
  }));
}

function countBy(rows) {
  const counts = {};
  for (const row of rows) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
  return counts;
}

export async function setUserRole(userId, role) {
  return request(() => supabase.from('profiles').update({ role }).eq('id', userId), {
    fallbackMessage: 'Non sono riuscito a cambiare il ruolo.',
  });
}

export async function getCheckinsThisWeekStats() {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  const startIso = start.toISOString().slice(0, 10);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const endIso = end.toISOString().slice(0, 10);

  const { data } = await request(
    () => supabase.from('checkins').select('space_id, spaces:space_id (name)').gte('date', startIso).lt('date', endIso),
    { silent: true }
  );

  const bySpace = {};
  for (const row of data || []) {
    const name = row.spaces?.name || 'Spazio';
    bySpace[name] = (bySpace[name] || 0) + 1;
  }
  return { total: (data || []).length, bySpace };
}

export async function getUpcomingCheckinsBySpace() {
  const { data } = await request(
    () =>
      supabase
        .from('checkins')
        .select('space_id, date, spaces:space_id (name)')
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date'),
    { fallbackMessage: 'Non riesco a caricare i check-in in programma.' }
  );
  return data || [];
}

// --- Storage: copertine ------------------------------------------------

export async function uploadCoverImage(spaceId, file) {
  const ext = file.name.split('.').pop();
  const path = `${spaceId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('space-covers').upload(path, file, { upsert: false });
  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const { data } = supabase.storage.from('space-covers').getPublicUrl(path);
  return { data: data.publicUrl, error: null };
}
