// js/auth.js — OTP via email, sessione, guard() e requireAdmin().
//
// requireAdmin() è solo UX (nasconde la dashboard a chi non è admin nel
// browser): la protezione vera è nelle policy RLS su ogni tabella, non qui.
import { supabase } from './supabase.js';
import { request } from './lib/request.js';

const RESEND_COOLDOWN_SECONDS = 60;

/** Invia il codice OTP a 6 cifre via email. */
export async function sendOtp(email) {
  return request(
    () => supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }),
    { silent: true }
  );
}

/** Verifica il codice OTP a 6 cifre. */
export async function verifyOtp(email, token) {
  return request(() => supabase.auth.verifyOtp({ email, token, type: 'email' }), { silent: true });
}

export async function signOut() {
  return request(() => supabase.auth.signOut());
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/** Il profilo (tabella profiles) dell'utente attualmente loggato, o null. */
export async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data } = await request(
    () => supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    { silent: true }
  );
  return data;
}

/** True se l'onboarding (nome visibile, ecc.) non è ancora stato completato. */
export function needsOnboarding(profile) {
  return !profile || !profile.display_name || profile.display_name.trim() === '';
}

/**
 * Da chiamare in cima a ogni pagina riservata. Se non c'è sessione,
 * reindirizza al login preservando la pagina di destinazione in ?next=.
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function guard() {
  const session = await getSession();
  if (!session) {
    // Percorso assoluto dalla root: admin/index.html vive in una
    // sottocartella, un redirect relativo ('index.html') la rimanderebbe
    // su se stessa invece che alla vera pagina di login.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/index.html?next=${next}#accedi`;
    throw new Error('redirecting to login');
  }
  return session;
}

/**
 * Da chiamare in cima a admin/index.html. Verifica anche la sessione
 * (chiama guard() internamente): non serve chiamarli entrambi.
 */
export async function requireAdmin() {
  await guard();
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') {
    window.location.href = '/app.html';
    throw new Error('redirecting: not admin');
  }
  return profile;
}

export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => subscription.unsubscribe();
}

export const resendCooldownSeconds = RESEND_COOLDOWN_SECONDS;
