// js/api/profile.js — il profilo dell'utente loggato (sezione 6.4).
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';
import { getSession } from '../auth.js';

export async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data } = await request(() => supabase.from('profiles').select('*').eq('id', session.user.id).single(), {
    fallbackMessage: 'Non riesco a caricare il tuo profilo.',
  });
  return data;
}

export async function updateMyProfile({ displayName, showInCheckins }) {
  const session = await getSession();
  if (!session) return { data: null, error: new Error('not authenticated') };

  return request(
    () =>
      supabase
        .from('profiles')
        .update({ display_name: displayName, show_in_checkins: showInCheckins })
        .eq('id', session.user.id),
    { fallbackMessage: 'Non sono riuscito a salvare le modifiche.' }
  );
}

/**
 * Tutti i dati dell'utente in un unico oggetto, per "Esporta i miei dati".
 */
export async function exportMyData() {
  const session = await getSession();
  if (!session) return null;

  const [{ data: profile }, { data: checkins }, { data: reviews }, { data: suggestions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('checkins').select('*').eq('user_id', session.user.id),
    supabase.from('reviews').select('*').eq('user_id', session.user.id),
    supabase.from('suggestions').select('*').eq('user_id', session.user.id),
  ]);

  return {
    exported_at: new Date().toISOString(),
    profile,
    checkins,
    reviews,
    suggestions,
  };
}

/**
 * Elimina l'account: la funzione Edge (supabase/functions/delete-account)
 * cancella i dati applicativi e poi la riga in auth.users con la
 * service_role key, che il browser non deve mai vedere.
 */
export async function deleteMyAccount() {
  return request(() => supabase.functions.invoke('delete-account'), {
    fallbackMessage: "Non sono riuscito a eliminare l'account. Riprova o scrivimi.",
  });
}
