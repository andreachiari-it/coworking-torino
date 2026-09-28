# Coworking Torino

Una mappatura onesta degli spazi dove lavorare a Torino — coworking, bar, Case
del Quartiere, biblioteche — con costi, wifi, prese, spazio per le call,
raccontati con onestà. Sito statico (HTML/CSS/JS, nessun build step) con
backend [Supabase](https://supabase.com) (Postgres + Auth + RLS + Realtime).

Questa guida ti porta da zero a sito online, passo passo. Non serve
esperienza da sviluppatore: ogni passaggio dice esattamente dove cliccare.

---

## 1. Crea il progetto Supabase

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Regione: **Europe (Frankfurt)** o comunque un'area UE (per i dati dei tuoi utenti).
3. Segnati la password del database che ti chiede — non serve per il sito, ma è comodo averla per accessi diretti futuri.

## 2. Esegui le migration

Nel pannello Supabase, menu a sinistra → **SQL Editor**. Per ognuno dei file
in `supabase/migrations/`, **in quest'ordine esatto**: apri il file, copia
tutto il contenuto, incollalo in una nuova query, premi **Run**, aspetta che
finisca senza errori prima di passare al successivo.

1. `001_schema.sql` — tabelle
2. `002_rls.sql` — sicurezza (Row Level Security)
3. `003_functions_triggers.sql` — funzioni e trigger
4. `004_views.sql` — viste pubbliche
5. `005_checkins_upcoming_view.sql` — vista "chi ci va nei prossimi 7 giorni"
6. `006_admin_extras.sql` — funzioni admin, protezione ultimo admin, bucket per le immagini di copertina

In alternativa, se preferisci la riga di comando e hai la [Supabase CLI](https://supabase.com/docs/guides/cli) installata:

```bash
supabase link --project-ref <il-tuo-project-ref>
supabase db push
```

## 3. Carica i dati (seed)

Stessa procedura: apri `supabase/seed.sql`, copia, incolla nello SQL Editor, Run.
Inserisce le opzioni dei filtri (zone, tipi, ecc.) e i 26 spazi mappati.

Poi apri `supabase/seed_coordinates.sql` e ripeti: copia, incolla, Run. Aggiunge
le coordinate geografiche (geocodificate via Nominatim/OpenStreetMap) a 20 dei
26 spazi — gli altri 6 non avevano un indirizzo nei dati originali e restano
da completare a mano dalla dashboard admin (li trovi subito nel filtro **"Da
completare"**).

## 4. Configura l'accesso via email (OTP)

Questa è la parte con più passaggi — e quella con cui è più facile inciampare
(fidati, ci siamo passati). Seguila con calma, nell'ordine.

### 4.1 Attiva il provider email

**Authentication → Sign In / Providers → Email**: assicurati sia attivo.

### 4.2 Sostituisci i template email

**Authentication → Emails → Templates**. Il template di *default* di Supabase
manda un link cliccabile "Conferma", non un codice — e i client email (Gmail
soprattutto) a volte "cliccano" automaticamente quel link per scansionarlo,
consumandolo prima che tu lo veda. Per l'OTP a 6 cifre serve un template che
mostri solo il codice, senza link.

Apri **"Magic link or OTP"**, cancella il contenuto e incolla quello di
`supabase/email-templates/otp_email.html`. Come oggetto (campo Subject
sopra il corpo del template) scrivi:

```
{{ .Token }} — il tuo codice per Coworking Torino
```

Ripeti identico su **"Confirm sign up"** (usato al primissimo accesso in assoluto).

### 4.3 Controlla la lunghezza del codice OTP

**Authentication → Sign In / Providers → Email**, cerca **"OTP Length"** (o
campo simile) e assicurati sia **6**. Su alcuni progetti nuovi Supabase lo
imposta a 8 di default — il sito è costruito per un codice a 6 cifre
(campo di input, validazione, tutto), quindi se resta a 8 il login non
funziona.

### 4.4 Configura uno SMTP vero

Il mittente email di default di Supabase è pensato solo per test
leggerissimi: limiti di invio molto bassi e a volte inaffidabile con Gmail.
Per una community serve un provider SMTP vero — **Resend** è gratuito fino a
100 email/giorno e non richiede nemmeno un dominio verificato per iniziare.

1. Crea un account gratuito su [resend.com](https://resend.com).
2. **API Keys → Create API Key** (permessi di invio di default vanno bene). Copia la chiave (`re_...`), la vedi una volta sola.
3. Nel pannello Supabase, **Authentication → Emails → SMTP Settings**, attiva **"Enable custom SMTP"** e compila:

   | Campo | Valore |
   |---|---|
   | Sender email address | `onboarding@resend.dev` (funziona da subito, senza dominio verificato) |
   | Sender name | `Coworking Torino` |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Minimum interval per user | `60` |
   | Username | `resend` |
   | Password | la API key di Resend |

Più avanti, prima di condividere il sito nel gruppo WhatsApp, puoi passare a
un mittente `@cambio-vita.it` — richiede di verificare il dominio su Resend
aggiungendo qualche record DNS, un passaggio a parte quando vuoi farlo.

### 4.5 URL di redirect e rate limit

- **Authentication → URL Configuration**: imposta *Site URL* sul dominio di
  produzione (es. `https://coworking-torino.netlify.app`) e aggiungi anche
  `http://localhost:*` tra i *Redirect URLs* se vuoi testare in locale.
- **Authentication → Rate Limits**: i default vanno bene per iniziare; se la
  community cresce e qualcuno si lamenta di non ricevere il codice, è il
  primo posto da controllare.

## 5. Configura il sito

Copia `js/config.example.js` in un nuovo file `js/config.js` (è già nel
`.gitignore`, non finisce nel repository) e compila:

```js
export const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...'; // Project Settings → API, chiave "anon public"
export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/...';
export const SITE_NAME = 'Coworking Torino';
export const ADMIN_CONTACT_EMAIL = 'andrea@cambio-vita.it';
```

L'`anon key` è pubblica per definizione (Supabase la progetta per stare nel
codice del sito) — non è un segreto, ma non va **mai** sostituita con la
`service_role` key, che invece deve restare solo nella Edge Function (sezione 8).

## 6. Prova in locale

Il sito è fatto di moduli JavaScript: Chrome li blocca se apri i file col
doppio click (`file:///...`). Serve un piccolo server locale:

```bash
python3 -m http.server 8080
```

oppure, se hai Node.js:

```bash
npx serve .
```

Poi apri `http://localhost:8080` nel browser.

## 7. Promuoviti admin

Fai il primo accesso sul sito con la tua email (login OTP). Poi, nello SQL
Editor di Supabase:

```sql
update profiles set role = 'admin' where email = 'tua@email.it';
```

Ricarica la pagina: nella barra in alto di `app.html` comparirà un link **"Admin"**.

## 8. Pubblica la funzione di eliminazione account

`supabase/functions/delete-account/index.ts` cancella davvero l'account di
chi lo chiede (dati applicativi + utente Supabase). Nel pannello Supabase
cerca **Edge Functions**: se il tuo progetto permette di incollare codice
direttamente dal browser, crea una funzione chiamata `delete-account` e
incolla il contenuto del file. Se vedi solo istruzioni per la CLI:

```bash
supabase functions deploy delete-account
```

(richiede la Supabase CLI collegata al progetto — vedi il passaggio 2).

## 9. Deploy

Due strade, a seconda di quanto vuoi automatizzare:

**A. Netlify Drop (più veloce, aggiornamenti manuali)**
Vai su [app.netlify.com/drop](https://app.netlify.com/drop) e trascina la
cartella del progetto. In pochi secondi hai un indirizzo `https://...netlify.app`.
Per ogni aggiornamento futuro, ripeti il trascinamento sullo stesso sito
(dalla sua pagina su Netlify, non su app.netlify.com/drop).

**B. GitHub + Netlify/Cloudflare Pages (aggiornamenti automatici)**
Crea un repository GitHub, caricaci il progetto, poi collega Netlify o
Cloudflare Pages a quel repository (OAuth, tutto da browser). Da quel
momento, ogni volta che il repository si aggiorna, il sito si ridistribuisce
da solo — comodo se il sito continuerà a crescere.

Con entrambe: dopo il primo deploy, torna al passaggio 4.5 e aggiorna la
*Site URL* di Supabase con l'indirizzo vero. Se hai un dominio personalizzato
(es. `coworking.cambio-vita.it`), collegalo dal pannello del tuo host e
aggiorna di nuovo la *Site URL*.

`netlify.toml` nel repository imposta già gli header di sicurezza (CSP e
altri, sezione "Sicurezza" più sotto) se usi Netlify.

## 10. Checklist post-deploy

- [ ] Login OTP funziona da telefono (email → codice → dentro)
- [ ] Il link del sito, incollato in una chat WhatsApp, mostra un'anteprima decente (titolo, descrizione, immagine)
- [ ] Un "Ci vado" genera il messaggio WhatsApp precompilato con il link giusto
- [ ] Da admin: modifichi un campo di uno spazio, sposti il pin sulla mappa, e lo storico modifiche lo registra
- [ ] Da un account normale (non admin): provi a modificare uno spazio via API/console del browser e viene rifiutato — vedi `supabase/tests/rls_checks.sql` per query pronte da lanciare impersonando i ruoli
- [ ] Aggiungi una nuova Zona dalla dashboard admin e la ritrovi subito nei filtri di `app.html`

## 11. Backup

- **Dalla dashboard admin**: tab "Spazi" → Esporta CSV o JSON, in qualsiasi momento.
- **Dump completo del database**: dal pannello Supabase, **Database → Backups** (i progetti a pagamento hanno backup automatici; sul piano gratuito puoi comunque fare un dump manuale con `pg_dump` usando la stringa di connessione in **Project Settings → Database**).

---

## Sicurezza

La chiave `anon` è pubblica per design: ogni vera protezione vive nelle
policy RLS del database (`supabase/migrations/002_rls.sql` e seguenti), mai
nel JavaScript del client — anche se qualcuno leggesse tutto il codice del
sito, non potrebbe scavalcare i permessi.

**Content-Security-Policy**: impostata sia via `<meta http-equiv>` in ogni
pagina (funziona su qualsiasi hosting) sia via header in `netlify.toml` (più
completa — aggiunge `X-Frame-Options` e altri header che un tag `<meta>` non
può impostare, attivi solo se il deploy è su Netlify). `style-src` include
`'unsafe-inline'`: il sito usa blocchi `<style>` inline per il CSS
specifico di ogni pagina, e restringerlo avrebbe richiesto spostare tutto in
file esterni con un beneficio di sicurezza marginale, dato che `script-src`
resta rigoroso (nessuno script inline, nessun `unsafe-eval`) — è lì che
conta davvero contro l'XSS.

## Struttura del progetto

Vedi i commenti in cima a ogni file per il dettaglio; in breve:

- `index.html`, `app.html`, `space.html`, `profile.html`, `privacy.html`, `admin/index.html` — le pagine
- `css/` — design system (token, base, componenti) + layout per pagina
- `js/api/` — tutte le chiamate a Supabase, mai fatte direttamente dalle pagine
- `js/ui/` — componenti di interfaccia (mappa, filtri, card, editor admin...)
- `js/pages/` — il "collante" di ogni pagina: guardie di autenticazione, caricamento dati, wiring degli eventi
- `supabase/migrations/` — schema del database, in ordine
- `scripts/geocode.mjs` — script one-off per geocodificare nuovi indirizzi (richiede Node.js; se non ne hai, chiedi a Claude di farlo con l'accesso web, come per il seed iniziale)

Le decisioni tecniche prese lungo il percorso, con il perché, sono in
[DECISIONS.md](DECISIONS.md).
