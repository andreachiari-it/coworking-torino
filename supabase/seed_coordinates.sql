-- seed_coordinates.sql
-- Geocoding fatto a mano da Claude via Nominatim (OpenStreetMap), il 2026-09-28,
-- al posto di scripts/geocode.mjs (che resta disponibile se in futuro vuoi
-- rilanciare il geocoding da un computer con Node.js). Esegui DOPO supabase/seed.sql.
--
-- Note di qualità:
--   - Trovati con civico esatto o corrispondenza sul nome del posto: 18/20.
--   - Solo a livello di via (nessun civico nei dati OSM, posizione indicativa
--     sulla via): Talent Garden Torino, Costadoro Social Coffee Factory.
--   - Solo a livello di piazza: EDIT Torino (Pub e Ristorante).
--   - 6 spazi senza indirizzo non sono in questo file (restano "Da
--     completare" in dashboard): Combo Torino, Rinascimenti Sociali, Bricks,
--     Barney's (Circolo dei Lettori), Biblioteca Civica Centrale,
--     Biblioteca Nazionale Universitaria.

update public.spaces set lat = 45.0768005, lng = 7.6723732 where slug = 'talent-garden-torino';
update public.spaces set lat = 45.0502418, lng = 7.6692435 where slug = 'toolbox-coworking';
update public.spaces set lat = 45.0666858, lng = 7.6596510 where slug = 'ogr-tech-by-talent-garden';
update public.spaces set lat = 45.0802221, lng = 7.6659712 where slug = 'spazio-quattro';
update public.spaces set lat = 45.0393572, lng = 7.6725496 where slug = 'casa-del-quartiere-barrito';
update public.spaces set lat = 45.0579233, lng = 7.6824490 where slug = 'tomato-urban-retreat';
update public.spaces set lat = 45.0855257, lng = 7.6821793 where slug = 'il-cecchi-point';
update public.spaces set lat = 45.1035202, lng = 7.6301913 where slug = 'officine-caos-casa-del-quartiere-vallette';
update public.spaces set lat = 45.0881966, lng = 7.6925718 where slug = 'bagni-pubblici-di-via-aglie';
update public.spaces set lat = 45.0137174, lng = 7.6483134 where slug = 'casa-nel-parco';
update public.spaces set lat = 45.0541065, lng = 7.6783033 where slug = 'casa-del-quartiere-san-salvario';
update public.spaces set lat = 45.0770685, lng = 7.6834372 where slug = 'mercato-centrale-torino';
update public.spaces set lat = 45.0913729, lng = 7.6900926 where slug = 'via-baltea-3';
update public.spaces set lat = 45.0692059, lng = 7.6560086 where slug = 'associazione-culturale-comala';
update public.spaces set lat = 45.0759172, lng = 7.6985946 where slug = 'bartu';
update public.spaces set lat = 45.0752649, lng = 7.6953943 where slug = 'berlicabarbis';
update public.spaces set lat = 45.0411562, lng = 7.6251543 where slug = 'cascina-roccafranca';
update public.spaces set lat = 45.0668444, lng = 7.6884301 where slug = 'mara-dei-boschi';
update public.spaces set lat = 45.0661740, lng = 7.6825908 where slug = 'costadoro-social-coffee-factory';
update public.spaces set lat = 45.0901815, lng = 7.6856637 where slug = 'edit-torino-pub-e-ristorante';
