-- 007_rename_freeco_source.sql
-- Andrea ha chiesto di togliere ogni riferimento a "Freeco" dal sito, per
-- restare un progetto neutro senza citare quella guida per nome. Rinomina
-- il valore 'Freeco' del campo source in 'Guida esterna', a cascata su
-- tutti gli spazi che lo usano — la stessa identica operazione che avrebbe
-- fatto la funzione "Rinomina" della dashboard admin (sezione 7.2), qui
-- come migration per restare coerenti con come applichiamo ogni altra
-- modifica al database.

select public.rename_field_option('source', 'Freeco', 'Guida esterna');

-- La nota di Tomato Urban Retreat citava "Freeco" per nome nel testo libero:
-- rendila coerente con la stessa riformulazione usata nel seed aggiornato.
update public.spaces
set notes = replace(notes, 'unico con prezzo fisso reale nella guida Freeco', 'unico con prezzo fisso reale tra gli spazi mappati')
where slug = 'tomato-urban-retreat';
