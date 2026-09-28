// js/api/spaces.js — accesso alla vista spaces_public.
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';

/**
 * Numeri aggregati + massimo 3 nomi di spazio, visibili anche da anonimi
 * (RPC security definer, vedi supabase/migrations/003_functions_triggers.sql).
 */
export async function getPublicTeaser() {
  const { data } = await request(() => supabase.rpc('public_teaser'), {
    silent: true,
    fallbackMessage: 'Non riesco a caricare i numeri della guida.',
  });
  return data;
}

/**
 * Tutti gli spazi pubblicati, con i contatori (recensioni, check-in) già
 * calcolati dalla vista. Il dataset è piccolo (poche decine di righe): si
 * carica tutto una volta e si filtra/ordina lato client.
 */
export async function listPublishedSpaces() {
  const { data } = await request(() => supabase.from('spaces_public').select('*'), {
    fallbackMessage: 'Non riesco a caricare gli spazi. Ricarica la pagina.',
  });
  return data || [];
}

export async function getSpaceBySlug(slug) {
  const { data } = await request(() => supabase.from('spaces_public').select('*').eq('slug', slug).single(), {
    silent: true,
    fallbackMessage: 'Spazio non trovato.',
  });
  return data;
}

/**
 * Notifica `onChange` a ogni check-in creato/cancellato, così la lista può
 * aggiornare il contatore "oggi" senza refresh (sezione 6.2).
 * @returns {() => void} funzione per annullare la sottoscrizione
 */
export function subscribeToCheckinChanges(onChange) {
  const channel = supabase
    .channel('checkins-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
