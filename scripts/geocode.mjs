#!/usr/bin/env node
// scripts/geocode.mjs
//
// One-off geocoding of data/seed_spaces.json against Nominatim (OpenStreetMap).
// The Notion database had no coordinates (its map was an embed), so this
// fills them in before the first deploy. Never run this from the browser --
// it's a Node 18+ script, run manually, respecting Nominatim's 1 req/s policy.
//
// Usage:
//   NOMINATIM_CONTACT_EMAIL=tuo@indirizzo.it node scripts/geocode.mjs
//
// Output:
//   data/seed_spaces.geocoded.json  -- the seed data with lat/lng filled in
//   supabase/seed_coordinates.sql   -- UPDATE statements to run after seed.sql

import fs from 'node:fs/promises';

const CONTACT_EMAIL = process.env.NOMINATIM_CONTACT_EMAIL || 'imposta-NOMINATIM_CONTACT_EMAIL@example.com';
const USER_AGENT = `CoworkingTorino-Geocoder/1.0 (${CONTACT_EMAIL})`;
const RATE_LIMIT_MS = 1100;
// Torino bounding box, format left,top,right,bottom (lon_min,lat_max,lon_max,lat_min).
const TORINO_VIEWBOX = '7.55,45.15,7.80,44.98';

const SEED_PATH = new URL('../data/seed_spaces.json', import.meta.url);
const OUT_JSON_PATH = new URL('../data/seed_spaces.geocoded.json', import.meta.url);
const OUT_SQL_PATH = new URL('../supabase/seed_coordinates.sql', import.meta.url);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strips parenthetical asides ("(quartiere Nizza Millefonti)") before
 * geocoding, since they confuse the search. The one exception is a
 * "sede temporanea: X" aside, which names the address actually in use
 * right now -- we geocode that instead of the (currently closed) main one.
 */
function cleanAddress(raw) {
  if (!raw) return null;
  const temp = raw.match(/sede temporanea:\s*([^)]+)\)/i);
  if (temp) return temp[1].trim();
  return raw
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

async function geocode(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycodes', 'it');
  url.searchParams.set('viewbox', TORINO_VIEWBOX);
  url.searchParams.set('bounded', '1');
  url.searchParams.set('limit', '5');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Nominatim ha risposto ${res.status} per "${query}"`);
  }
  return res.json();
}

async function main() {
  if (CONTACT_EMAIL.includes('example.com')) {
    console.warn(
      'ATTENZIONE: NOMINATIM_CONTACT_EMAIL non impostata. ' +
      'Nominatim chiede uno User-Agent identificativo: imposta la variabile prima di lanciare lo script.\n'
    );
  }

  const spaces = JSON.parse(await fs.readFile(SEED_PATH, 'utf8'));

  const found = [];
  const ambiguous = [];
  const notFound = [];
  const skipped = [];
  const results = [];

  for (const space of spaces) {
    if (!space.address) {
      skipped.push(space.name);
      results.push({ ...space });
      continue;
    }

    const query = `${cleanAddress(space.address)}, Torino, Italia`;
    process.stdout.write(`Geocoding "${space.name}" -> "${query}" ... `);

    let matches = [];
    try {
      matches = await geocode(query);
    } catch (err) {
      console.log(`ERRORE (${err.message})`);
      notFound.push(space.name);
      results.push({ ...space });
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    if (matches.length === 0) {
      console.log('nessun risultato');
      notFound.push(space.name);
      results.push({ ...space });
    } else if (matches.length === 1) {
      console.log(`OK (${matches[0].lat}, ${matches[0].lon})`);
      found.push(space.name);
      results.push({ ...space, lat: Number(matches[0].lat), lng: Number(matches[0].lon) });
    } else {
      console.log(`${matches.length} risultati ambigui, uso il primo`);
      ambiguous.push({
        name: space.name,
        candidates: matches.map((m) => ({ lat: m.lat, lon: m.lon, display_name: m.display_name })),
      });
      results.push({ ...space, lat: Number(matches[0].lat), lng: Number(matches[0].lon) });
    }

    await sleep(RATE_LIMIT_MS);
  }

  await fs.writeFile(OUT_JSON_PATH, JSON.stringify(results, null, 2), 'utf8');

  const sqlLines = results
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => `update public.spaces set lat = ${s.lat}, lng = ${s.lng} where slug = '${escapeSql(s.slug)}';`);

  const sqlContent = [
    '-- seed_coordinates.sql',
    '-- Generato da scripts/geocode.mjs. Esegui DOPO supabase/seed.sql.',
    '-- Rivedi le voci "ambigue" segnalate nel report dello script prima di fidartene.',
    '',
    ...sqlLines,
    '',
  ].join('\n');

  await fs.writeFile(OUT_SQL_PATH, sqlContent, 'utf8');

  console.log('\n--- Report geocoding ---');
  console.log(`Trovati: ${found.length}/${spaces.length}`);
  console.log(`\nAmbigui (${ambiguous.length}) -- rivedi a mano, ho tenuto il primo risultato:`);
  for (const a of ambiguous) {
    console.log(`  ${a.name}:`);
    for (const c of a.candidates) {
      console.log(`    ${c.lat}, ${c.lon} -- ${c.display_name}`);
    }
  }
  console.log(`\nNon trovati (${notFound.length}): ${notFound.join(', ') || '-'}`);
  console.log(`Senza indirizzo, saltati (${skipped.length}): ${skipped.join(', ') || '-'}`);
  console.log(`\nScritti: ${OUT_JSON_PATH.pathname} e ${OUT_SQL_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
