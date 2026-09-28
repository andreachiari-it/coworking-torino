// js/lib/request.js — wrapper centrale per le chiamate Supabase (sezione 10):
// mai una promise Supabase chiamata "a nudo" nelle pagine, sempre da qui.
import { showError } from '../ui/toast.js';

/**
 * @param {() => Promise<{data: any, error: any}>} promiseFactory
 * @param {{ silent?: boolean, fallbackMessage?: string }} [options]
 * @returns {Promise<{data: any, error: any}>}
 */
export async function request(promiseFactory, options = {}) {
  const { silent = false, fallbackMessage = 'Qualcosa è andato storto. Riprova.' } = options;
  try {
    const result = await promiseFactory();
    if (result && result.error) {
      throw result.error;
    }
    return { data: result ? result.data ?? null : null, error: null };
  } catch (error) {
    console.error(error);
    if (!silent) showError(fallbackMessage);
    return { data: null, error };
  }
}
