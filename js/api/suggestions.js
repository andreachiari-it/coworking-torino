// js/api/suggestions.js — segnalazioni della community (sezione 6.3, 6.4).
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';
import { getSession } from '../auth.js';

/**
 * @param {{ kind: 'new_space'|'correction'|'closed', spaceId?: string, payload?: object, message?: string }} params
 */
export async function createSuggestion({ kind, spaceId, payload, message }) {
  const session = await getSession();
  if (!session) return { data: null, error: new Error('not authenticated') };

  return request(
    () =>
      supabase
        .from('suggestions')
        .insert({
          user_id: session.user.id,
          kind,
          space_id: spaceId || null,
          payload: payload || null,
          message: message || null,
        })
        .select()
        .single(),
    { fallbackMessage: 'Non sono riuscito a inviare la segnalazione.' }
  );
}

export async function getMySuggestions() {
  const session = await getSession();
  if (!session) return [];

  const { data } = await request(
    () =>
      supabase
        .from('suggestions')
        .select('id, kind, status, message, admin_note, created_at, reviewed_at, spaces:space_id (name, slug)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
    { fallbackMessage: 'Non riesco a caricare le tue segnalazioni.' }
  );
  return data || [];
}
