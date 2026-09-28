// js/api/field-options.js — le liste di valori ammessi (sezione 4.1),
// lette dal DB così un valore aggiunto dall'admin compare subito nei filtri.
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';

/**
 * @returns {Promise<Record<string, {value: string, color: string|null}[]>>}
 *   mappa field -> lista di opzioni, ordinate per sort_order.
 */
export async function getFieldOptions() {
  const { data } = await request(
    () => supabase.from('field_options').select('field, value, color, sort_order').order('sort_order'),
    { fallbackMessage: 'Non riesco a caricare le opzioni dei filtri.' }
  );

  const byField = {};
  for (const row of data || []) {
    if (!byField[row.field]) byField[row.field] = [];
    byField[row.field].push({ value: row.value, color: row.color });
  }
  return byField;
}

/** Le stesse righe di getFieldOptions(), ma in forma di lista piatta — comoda per l'admin. */
export async function listFieldOptionsFlat() {
  const { data } = await request(
    () => supabase.from('field_options').select('field, value, color, sort_order').order('field').order('sort_order'),
    { fallbackMessage: 'Non riesco a caricare le opzioni.' }
  );
  return data || [];
}

export async function createFieldOption({ field, value, color, sortOrder }) {
  return request(() => supabase.from('field_options').insert({ field, value, color: color || null, sort_order: sortOrder ?? 0 }), {
    fallbackMessage: 'Non sono riuscito ad aggiungere il valore.',
  });
}

/** Rinomina un valore e aggiorna a cascata gli spazi che lo usano (RPC transazionale). */
export async function renameFieldOption(field, oldValue, newValue) {
  return request(() => supabase.rpc('rename_field_option', { p_field: field, p_old_value: oldValue, p_new_value: newValue }), {
    fallbackMessage: 'Non sono riuscito a rinominare il valore.',
  });
}

export async function updateFieldOptionAppearance(field, value, { color, sortOrder }) {
  const patch = {};
  if (color !== undefined) patch.color = color;
  if (sortOrder !== undefined) patch.sort_order = sortOrder;
  return request(() => supabase.from('field_options').update(patch).eq('field', field).eq('value', value), {
    fallbackMessage: 'Non sono riuscito a salvare le modifiche.',
  });
}

export async function deleteFieldOption(field, value) {
  return request(() => supabase.from('field_options').delete().eq('field', field).eq('value', value), {
    fallbackMessage: 'Non sono riuscito a eliminare il valore.',
  });
}

/** Quanti spazi usano questo valore — per impedire di eliminare un valore in uso. */
export async function countSpacesUsingFieldOption(field, value) {
  if (field === 'mood') {
    const { data } = await request(() => supabase.from('spaces').select('id, mood'), { silent: true });
    return (data || []).filter((s) => (s.mood || []).includes(value)).length;
  }
  const { count } = await supabase.from('spaces').select('id', { count: 'exact', head: true }).eq(field, value);
  return count || 0;
}
