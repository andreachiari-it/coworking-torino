# Decisioni tecniche

Ogni volta che una scelta non è specificata nel prompt originale, la registro
qui con una riga sul perché, e vado avanti. Ordinate per fase.

## Fase 1 — Fondamenta DB

**Enum come `field_options` + trigger, non `CHECK` fissi.**
Tutti i campi "a scelta" di `spaces` (`type`, `zone`, `cost_type`, `source`,
`personal_rating`, `wifi_quality`, `power_outlets`, `call_space`, `mood`)
sono validati da un trigger (`validate_space_field_options()` in
`003_functions_triggers.sql`) contro la tabella `field_options`, invece che
da `CHECK (... in (...))`. Motivo: il requisito esplicito è che l'admin possa
aggiungere una nuova Zona o un nuovo Mood dalla dashboard senza una
migration. Ho esteso l'approccio a *tutti* i campi enum-like (non solo Zona e
Mood) per coerenza: la sezione 7.2 della dashboard ("CRUD su field_options")
ha così un unico meccanismo uniforme invece di un misto CHECK/tabella.

**`is_admin()` vive in `002_rls.sql`, non in `003_functions_triggers.sql`.**
Le policy RLS la richiamano, quindi deve esistere prima che le policy
vengano create. Ho preferito tenerla vicino alle policy che la usano
piuttosto che spezzare l'ordine dei file numerati.

**Validazione della finestra data dei check-in via trigger `BEFORE INSERT`,
non `CHECK`.** Il prompt dice "date >= current_date all'inserimento": una
`CHECK` con `current_date` bloccherebbe anche gli `UPDATE` futuri su una riga
il cui `date` è ormai passato (es. modificare la nota di un check-in di ieri
fallirebbe). Il trigger valida solo in inserimento, come richiesto alla
lettera, e lascia gli `UPDATE` successivi liberi di toccare altri campi.

**Anti-spam check-in interpretato come "al massimo 3 spazi diversi per lo
stesso giorno per utente"**, non "3 inserimenti al giorno in assoluto" (la
`UNIQUE (space_id, user_id, date)` già impedisce duplicati sullo stesso
spazio). Conto le righe con lo stesso `date` per lo stesso `user_id`.

**`audit_log` e le RPC sensibili (`approve_suggestion`, `delete_my_account`,
`public_teaser`) sono `SECURITY DEFINER`** con `set search_path = public`
esplicito (buona pratica anti hijacking) e permessi `EXECUTE` ristretti
esplicitamente ai ruoli giusti (`anon`+`authenticated` solo per
`public_teaser`, `authenticated` per le altre) invece di lasciare il default
Postgres (`EXECUTE` a `PUBLIC`).

**Grant espliciti a livello di tabella** in `002_rls.sql` oltre alle policy
RLS. Supabase imposta di norma permessi di default per `anon`/`authenticated`
a livello di schema, ma li ho resi espliciti nel file di migration così lo
schema è leggibile e riproducibile anche fuori dal pannello Supabase (es. via
CLI su un altro progetto).

**`scripts/geocode.mjs` non contiene l'email di contatto in chiaro.** La
legge come `NOMINATIM_CONTACT_EMAIL` da variabile d'ambiente, con un
placeholder e un warning se non è impostata, invece di avere un indirizzo
email hardcoded nel repository.

**Pulizia indirizzi per il geocoding:** rimuovo le parentesi tipo
"(quartiere Nizza Millefonti)" prima di interrogare Nominatim. Eccezione:
"(sede temporanea: X)" — in quel caso geocodifico X, perché è l'indirizzo
dove lo spazio si trova *ora*, non quello storico chiuso per lavori
(+Spazio Quattro).

## Fase 1 (aggiunta) — Geocoding fatto senza Node.js

Andrea non ha Node.js installato (Chromebook). Invece di fargli installare un
ambiente di sviluppo solo per uno script one-off, ho interrogato Nominatim
io stesso (ho accesso web da questa sessione) per i 20 spazi con indirizzo, e
ho scritto direttamente `supabase/seed_coordinates.sql` e
`data/seed_spaces.geocoded.json` — stesso output che avrebbe prodotto
`scripts/geocode.mjs`, che resta comunque nel repo se in futuro serve
rilanciare il geocoding (es. dopo aver aggiunto nuovi spazi via CSV import).

Qualità: 18/20 con corrispondenza sul civico o sul nome del locale, 2/20
solo a livello di via/piazza (Talent Garden Torino, Costadoro Social Coffee
Factory — nessun civico indicizzato su OSM per quegli indirizzi; EDIT
Torino è a livello di piazza). Sufficiente per posizionare il marker sulla
mappa; se vuoi la precisione del portone puoi sempre trascinare il pin dalla
dashboard admin (sezione 7.1).

Il geocoding ha anche confermato/corretto i quartieri reali per la proposta
di nuove Zone della Fase 1: **Comala è in Cenisia**, non Santa Rita come
avevo ipotizzato; **Cascina Roccafranca è in Mirafiori Nord**, non Santa
Rita. BarTU e Berlicabarbis sono entrambi in **Vanchiglia** — zona già
pre-approvata nell'elenco della sezione 4.1 ma mai assegnata finora.

## Fase 2 — Design plan

**Palette** (definita in `css/tokens.css`):

| Nome | Hex | Uso |
|---|---|---|
| Grigio Portico | `#23211d` | testo, inchiostro |
| Pietra chiara | `#efeee9` | sfondo — grigio pietra desaturato, non crema |
| Ocra Sabauda | `#c8862e` | accento primario, CTA — dalle facciate barocche |
| Verde Tram | `#2f6b4f` | conferme, "Ci vado" — dal verde dei tram/chioschi GTT |
| Rosso Mattone | `#a23b2e` | errori, azioni distruttive — dai mattoni di Barriera di Milano |
| Blu Sera | `#33465c` | link, info, base del tema scuro |

Deliberatamente *non* ho abbinato l'ocra a uno sfondo crema con serif — è
esattamente il cliché citato nel brief. Lo sfondo è un grigio pietra freddo,
i titoli sono in un grottesco bold, e l'ocra resta un accento puntuale (CTA,
numeri), mai un wash di sfondo.

**Tipografia:** Archivo (800/900, condensato nei titoli grandi) per i
titoli — richiama i cartelli da fermata tram/le scritte urbane torinesi più
di un serif editoriale; Work Sans (400-700) per il corpo del testo, molto
leggibile su schermo piccolo. Nessuna delle due è la scelta di default più
comune (Inter+qualcosa), e la combinazione grottesco-espanso + umanista dà
un tono da segnaletica urbana, non da SaaS.

**L'elemento memorabile:** il "roundel" — un cerchio pieno color ocra/verde,
ispirato alle fermate del tram torinese, usato con parsimonia (badge nella
hero, marker sulla mappa in Fase 3). Non è usato come numerazione
sequenziale (niente 01/02/03): la sezione "Il problema", "Cosa trovi
dentro" ecc. non sono passaggi di un processo, quindi non li numero.

**Auto-critica (sezione 9, punto 2):** rileggendo, il rischio cliché più
concreto era proprio ocra+sfondo caldo+titoli larghi = "landing page da
generatore". L'ho mitigato con: sfondo freddo (non crema), niente ombre
identiche su ogni card (le card hero/stat usano un'ombra soffice unica,
niente drop-shadow ripetuta ovunque), niente label maiuscolo-spaziate sopra
i titoli, niente frecce "→" nei bottoni (i CTA dicono "Invia il codice",
non "Continua →"), niente numerazione 01/02/03. Il risultato non è
rivoluzionario ma è ancorato a Torino in modo specifico (ocra sabauda,
verde tram, mattone Barriera di Milano) invece che generico.

**Wireframe ASCII — Landing (index.html):**

```
[ header: logo -------------------- Entra con la tua email ]
[ hero: due roundel + H1 grande + lede + 2 CTA affiancati   ]
[ Il problema — testo a colonna singola, largo ~60ch        ]
[ Cosa trovi dentro — 3 stat card + lista 3 spazi campione   ]
[                    + griglia 4 feature card                ]
[ Come leggerla — 3 righe badge+spiegazione fonte            ]
[ La community — 3 feature card + CTA WhatsApp               ]
[ #accedi — card centrata: email → codice → onboarding       ]
[ footer: credito Cambio Vita — privacy — contatto — OSM     ]
```

**Wireframe ASCII — App, desktop (app.html, Fase 3):**

```
+----------------------------------------------------------------+
| barra filtri sticky (ricerca, tipo, zona, costo, wifi, ...)     |
+------------------+-----------------------------------------------+
| lista (420px,     |  mappa Leaflet (resto dello spazio)          |
| scroll indipend.) |  cluster, popup, centro Torino                |
| [card] [card] ... |                                               |
+------------------+-----------------------------------------------+
```

**Wireframe ASCII — App, mobile:**

```
+----------------------------+
| filtri (pannello a tendina)|
+----------------------------+
|                            |
|     mappa a tutto schermo  |
|                            |
+----------------------------+
| toggle: Mappa | Lista       |
| bottom sheet trascinabile   |
| (chiuso / metà / pieno)     |
+----------------------------+
```

**Wireframe ASCII — Admin:**

```
Desktop:
+--------+---------------------------------------------+
| side-  |  tabella Spazi: ricerca, filtri, righe        |
| bar    |  editabili inline, indicatore completezza     |
| Spazi  |                                                |
| Opzioni|  [pannello laterale editor completo su riga]   |
| Segnal.|                                                |
| ...    |                                                |
+--------+---------------------------------------------+

Mobile: sidebar -> tab bar in basso, tabella -> lista di card.
```

## Fase 3 — App utente

**`space.html` è una pagina separata, non un drawer dentro `app.html`.** Il
prompt lasciava scegliere. Una pagina propria rende banale il link diretto
(`space.html?s=slug`) e la history del browser, senza dover sincronizzare
`history.pushState` con lo stato del drawer. "Ci vado", recensioni e
segnalazioni (Fase 4) si aggiungeranno a questa stessa pagina.

**Filtri Tipo/Zona/Costo/Wifi minimo/Prese come `<select>` singoli, non
multi-select.** Solo "Mood" è esplicitamente multi nel brief; ho tenuto
gli altri a scelta singola per un pannello più leggibile su mobile. Il
`<select>` legge le opzioni da `field_options`, quindi un valore aggiunto
dall'admin compare qui senza toccare il codice.

**Il pannello filtri non si ridisegna a ogni digitazione.** Prima bozza:
ogni modifica richiamava un render completo del pannello, compreso il
campo di ricerca — che quindi perdeva il focus a ogni carattere digitato
(l'ho trovato testando, non solo leggendo il codice). Ora `onChange`
aggiorna solo stato e risultati; solo "Azzera filtri" e la navigazione
avanti/indietro (`popstate`) ricostruiscono il pannello da zero.

**`js/lib/completeness.js` è condiviso** fra l'ordinamento "Consigliati"
(Fase 3) e l'indicatore N/14 campi della dashboard admin (Fase 5): stessa
definizione di "campo compilato" nei due posti, per coerenza.

**Marker mappa: cerchi pieni colorati per Tipo** (stesso linguaggio visivo
del "roundel" della landing), non le classiche icone a goccia di Leaflet —
via `L.divIcon` con `background: var(--type-*)`, niente immagini esterne.

**Leaflet e Leaflet.markercluster sono `<script>` globali, non moduli
ESM.** Il plugin markercluster si aspetta un unico `window.L` condiviso;
importarli come due moduli ESM separati (`+esm` da jsdelivr) creerebbe due
istanze distinte di Leaflet, e `L.markerClusterGroup` finirebbe attaccato a
quella sbagliata. L'unico modulo ESM pinnato resta Supabase JS, come
richiesto dal brief.

**Bottom sheet mobile: tre stati raggiungibili sia trascinando sia da
tastiera.** L'maniglia è trascinabile (pointer events, snap al più vicino
fra chiuso/metà/pieno al rilascio) ma è anche un elemento con `role="button"
tabindex="0"` che con Invio/Spazio cicla i tre stati — nessuna delle due
modalità è indispensabile per l'altra, come richiesto dal requisito di
accessibilità sul bottom sheet.

**Ordinamento "Aggiornati di recente" usa `updated_at`, non
`last_verified_at`.** `updated_at` è sempre presente (ha un default), mentre
`last_verified_at` è spesso vuoto — ordinare su un campo quasi sempre nullo
avrebbe reso il criterio poco utile.

## Fase 4 — Community

**Migration 005 invece di modificare `004_views.sql`.** Avevi già eseguito
le prime 4 migration sul tuo Supabase reale, quindi editare un file già
applicato non avrebbe avuto nessun effetto sul database vero senza che tu
lo rilanciassi manualmente capendo cosa è cambiato. Ho aggiunto
`005_checkins_upcoming_view.sql`, che sostituisce `checkins_today_public`
(oggi/domani) con `checkins_upcoming_public` (prossimi 7 giorni, come
richiesto dalla scheda spazio) e aggiunge una colonna `is_mine` — così il
client sa quale check-in è il proprio senza dover leggere `user_id` di
altri utenti (bloccato dalla RLS su `profiles` comunque). **Devi eseguire
anche questa nel tuo progetto Supabase.**

**Le recensioni non mostrano il nome di chi le ha scritte.** Il brief non
lo richiedeva esplicitamente, e non c'è un meccanismo di opt-in dedicato
alle recensioni (solo `show_in_checkins` per i check-in) — mostrare il nome
avrebbe richiesto una nuova vista e una nuova policy solo per questo. La
recensione dell'autore stesso viene comunque riconosciuta e mostrata come
"La tua recensione" con i pulsanti Modifica/Elimina, confrontando
`review.user_id` con l'id di sessione lato client (nessuna lettura di
profili altrui necessaria).

**Il form "Segnala una modifica" copre un sottoinsieme di campi**
(zona, costo, prezzo, wifi, prese, spazio call, orari, note) e non
letteralmente tutte le colonne di `spaces` — sono i campi che più
probabilmente cambiano nel tempo. Nome, tipo, coordinate e fonte restano
modificabili solo dall'admin (Fase 5), per evitare correzioni communitarie
su dati che richiedono giudizio editoriale.

**`supabase/functions/delete-account` fa RPC + cancellazione utente in
un'unica chiamata**, non due passaggi separati dal client: il client
chiama solo `supabase.functions.invoke('delete-account')`, la funzione usa
il JWT dell'utente per la RPC (rispetta la RLS) e poi la service_role key
solo per l'ultimo passaggio (cancellare la riga in `auth.users`), mai
esposta al browser.

## Fase 5 — Dashboard admin

**`auth.js` usava redirect relativi (`'index.html'`, `'app.html'`) — bug
reale che ho trovato scrivendo `admin/index.html`.** Quella pagina vive
in una sottocartella: un redirect relativo a "non sei loggato" sarebbe
tornato su se stessa invece che alla vera home, e "non sei admin" sarebbe
andato a una `admin/app.html` inesistente. Ho corretto `guard()` e
`requireAdmin()` per usare percorsi assoluti dalla root (`/index.html`,
`/app.html`) — innocuo per le pagine già in root, ma necessario per
qualunque pagina annidata. Ho anche fatto sì che `requireAdmin()` chiami
`guard()` al suo interno, così basta chiamarne una sola in `admin.js`.

**"Approva con modifiche" carica lo spazio intero, non solo il payload
della segnalazione.** Una `suggestion` di tipo `correction` contiene solo
i campi cambiati (per design, sezione 6.3); ho trovato — testando, non
solo scrivendo — che passare quel payload da solo all'editor lo apriva
quasi vuoto invece che con i dati reali dello spazio. Ora recupero prima
lo spazio completo e ci fondo sopra il payload proposto.

**Import CSV: anteprima come lista compatta di differenze, non un diff
visivo elaborato.** Mostra nuovi/modificati/invariati come conteggio, poi
i campi cambiati per ognuno dei primi 20 spazi modificati — sufficiente
per capire cosa sta per succedere prima di premere "Applica", senza
costruire un componente diff complesso per un'operazione che userai di
tanto in tanto.

**Modifica inline in tabella solo per prezzo, rating personale e
pubblicato** (non per ogni singola colonna): sono i campi che più
probabilmente aggiorni al volo scorrendo la lista; tutto il resto passa
dall'editor completo, che ha comunque la validazione piena.

**Trigger `prevent_last_admin_revoke`** (in `006_admin_extras.sql`)
impedisce lato database la revoca dell'ultimo admin, non solo lato UI —
coerente con la regola generale del progetto che la RLS/i trigger sono la
vera protezione, mai solo il JavaScript del client.

## Fase 6 — Rifinitura

**Bug reale trovato testando, non scrivendo: mancava `<!DOCTYPE html>` e
`<html lang="it">` su tutte e sei le pagine.** Senza DOCTYPE i browser
renderizzano in "quirks mode" (modello di scatola non standard, possibili
differenze di layout tra browser); senza `lang` uno screen reader non sa
in che lingua leggere la pagina. Corretto ovunque.

**`auth.js` usava redirect relativi — corretto in Fase 5** quando ho scritto
`admin/index.html` e mi sono accorto che si rompevano da una sottocartella;
lo riporto qui perché è un bug di "rifinitura" scoperto solo testando
davvero il flusso admin, non dalla sola lettura del codice.

**Contrasto colore: l'ocra chiaro (`#c8862e`) con testo bianco sopra dà
3.04:1, sotto la soglia WCAG AA (4.5:1) per testo normale.** L'ho scoperto
calcolando la luminanza relativa dei token, non a occhio. Scurito a
`#9c6a1f` (4.67:1) solo in modalità chiara — la modalità scura usa già
testo scuro su ocra chiaro ed era a posto (6.70:1). Verde tram, rosso
mattone e blu sera erano già tutti conformi.

**Bug reale in `space.html`: la mini-mappa chiamava `L.markerClusterGroup()`
tramite la funzione condivisa `initMap()`, ma la pagina non caricava mai lo
script `leaflet.markercluster`** (a differenza di `app.html`) — quindi la
mappa si inizializzava ma il marker non appariva mai, in ogni browser reale,
da quando è stata costruita in Fase 3. L'ho trovato controllando la console
per violazioni CSP e notando un errore che non c'entrava con la CSP.
Corretto aggiungendo lo script mancante, invece di riscrivere `initMap()`
per rendere il clustering opzionale — più semplice, e coerente con come già
funziona `app.html`.

**CSP: sia `<meta http-equiv>` in ogni pagina sia header in
`netlify.toml`.** La scelta dell'hosting finale (Netlify vs Cloudflare
Pages vs altro) non era ancora decisa quando ho scritto questa parte; il
tag meta funziona ovunque, l'header Netlify aggiunge protezioni che un meta
tag non può esprimere (`X-Frame-Options`, `frame-ancestors`). Ho dovuto
aggiungere `cdn.jsdelivr.net` anche a `img-src`, non solo a `script-src`:
il pin trascinabile nell'editor admin usa l'icona marker di default di
Leaflet (un'immagine), non un `divIcon` come gli altri marker del sito —
senza quella riga la CSP l'avrebbe bloccata silenziosamente, rendendo il
pin invisibile in produzione pur funzionando in locale senza CSP.

**Skeleton di caricamento aggiunti solo su `app.html` (lista spazi) e
`space.html` (scheda), non nella dashboard admin.** Sono i due punti dove
un utente reale aspetta un caricamento con la rete del telefono; la
dashboard admin la usa solo tu, da una connessione presumibilmente più
stabile, e i suoi dati arrivano quasi sempre in meno di mezzo secondo nei
test — non ho ritenuto valesse lo sforzo di replicare skeleton dedicati per
tabelle con colonne e forme molto variabili tra le sei tab.

**Non ho potuto eseguire un audit Lighthouse reale**: questo ambiente non
ha accesso a Lighthouse né a un browser con rete esterna piena verso una
URL pubblica. Ho fatto una revisione manuale mirata (niente script
render-blocking, `font-display: swap` via il parametro `&display=swap` di
Google Fonts, `preconnect` sui domini dei font, nessuna libreria oltre a
Supabase/Leaflet/markercluster, immagini minime). **Prima di considerare il
sito "finito" per davvero, lancia un audit Lighthouse mobile reale sul
sito online** (Chrome DevTools → Lighthouse, o [PageSpeed
Insights](https://pagespeed.web.dev)) e dimmi cosa trovi: se emerge
qualcosa di concreto lo sistemiamo.

## Fase 6 (aggiunta, dopo il primo deploy reale) — `js/config.js` va committato

Bug reale, trovato solo testando il deploy vero su Netlify: in Fase 1 avevo
messo `js/config.js` nel `.gitignore` per prudenza. Ma questo sito non ha
nessun passaggio di build (per scelta, deve girare da cartella statica
pura) — quindi su Netlify quel file semplicemente non esisteva, e ogni
pagina che ne ha bisogno (login, mappa, link WhatsApp) falliva in silenzio
con un 404. L'ho scoperto guardando gli errori di rete sul sito online, non
in locale, dove il file c'era per forza di cose.

La chiave `anon` di Supabase è pubblica per design — non è un segreto da
proteggere, è pensata per stare nel codice del client — quindi includere
`js/config.js` nel repository non è un problema di sicurezza. Rimosso dal
`.gitignore` e committato con i valori reali.

## Da decidere più avanti (segnaposto)

- Palette colori e font (Fase 2, va in questo stesso file prima di scrivere CSS).
- Layout esatto bottom-sheet mobile (Fase 3).
- OTP via SMS/WhatsApp (Twilio): non implementato ora. Servirebbe
  Supabase Phone Auth + un provider SMS/WhatsApp (Twilio Verify o simile).
  Costo indicativo Twilio: verifica SMS ~0,05-0,08 USD/messaggio in Italia
  (variabile, da riverificare sul pricing Twilio aggiornato), più un canone
  WhatsApp Business API separato. Da validare con l'account Twilio reale
  prima di stimare un budget preciso.
