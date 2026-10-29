# Prossimi passi

## Prossima release

### Onboarding: prova reale su Meta
La guida in 4 passaggi e la scelta del nome della pagina sono pronte (vedi README). Prima di distribuirle:
- provare **"Trova il nome in Meta"** e **"Verifica"** con un account vero, nell'app desktop e su Android (la parte Kotlin non è stata compilata qui);
- salvare uno screenshot vero della pagina delle storie come `onboarding/dove-pubblichiamo.png` (il pannello lo usa al posto dell'illustrazione);
- ricontrollare i nomi dei menu citati nella guida per chi non ha Meta Business Suite ("Impostazioni", "Pagine", "Account Instagram"): Meta li cambia spesso.

### Pulsante "Resetta tutto e ricomincia"
Dopo un errore: azzera coda, stato della pubblicazione e registro, riporta l'app al pannello e permette di riprovare da zero senza chiudere e riaprire.

### Schermata di pubblicazione: prova reale
Durante la coda il pannello mostra la storia in lavorazione con una scansione animata, senza modo di chiuderla, e lo schermo resta acceso; "Ferma la coda dopo questa storia" lascia in coda solo le storie non ancora lavorate. Prima di distribuirla:
- **Android** (la parte Kotlin non è stata compilata qui): compilare e provare su un telefono vero schermo acceso, tasto Indietro bloccato durante la coda, stop dopo la storia attuale e chiusura automatica dopo 4 minuti senza avanzamenti.
- **App desktop**: ora la vista Meta resta nascosta durante la coda (`showMetaWhilePublishing: false` in `desktop/config.json`). Coperta dal pannello, Chromium smetteva di disegnarla e i clic automatici non arrivavano ("Popup adesivo Link non aperto"): l'opzione `disable-backgrounding-occluded-windows` in `desktop/src/main.js` la tiene attiva. Riprovare con un account vero, Test e pubblicazione; se qualcosa non va, `showMetaWhilePublishing: true` riporta Meta in primo piano.

### Lingue: prova reale e revisione
Pannello, app ed estensione sono tradotti in inglese, spagnolo, portoghese (Brasile) e francese. Prima di vendere all'estero:
- **Etichette di Meta:** per ogni lingua, impostare Facebook in quella lingua e raccogliere i testi dei pulsanti con `tools/cattura-etichette-meta.js`, poi aggiornare `UI_LABELS` in `engine/composer.js`. L'inglese è fatto (29/10/2026); restano spagnolo, portoghese e francese. Va controllata anche la parola che Meta usa per unire Pagina e profilo Instagram (in italiano «e»): le guide tradotte non la nominano e l'illustrazione usa quella più probabile.
- **Revisione madrelingua** dei testi in `i18n/`, soprattutto spagnolo (oggi neutro, con qualche forma europea come «ratón» e «añadir») e portoghese del Brasile.
- **Android:** compilare e provare `setLanguage` e i testi in `values-*` (la parte Kotlin non è stata compilata qui).
- **Firma:** il motore è passato alla 4.1.1 (messaggi tradotti, etichette inglesi verificate): va firmato e caricato sul server.

## Da ricordare
- **Android – piano B**: pulsante "Condividi su Instagram" che passa la grafica creata all'app Instagram con l'intent ufficiale per le storie, per quando l'automazione non è disponibile. L'adesivo link andrà aggiunto a mano dall'utente.

## Prima della distribuzione
### Dominio definitivo al posto di giuseppe.rocks
Quando il sito definitivo è pronto, sostituire `https://giuseppe.rocks/storyflow/` con il nuovo indirizzo in tutti questi punti:
- `desktop/config.json`: `studioUrl` ed `engineManifestUrl`.
- `storyflow-extension/manifest.json`: `host_permissions` e `content_scripts.matches` (l'estensione funziona solo sul dominio indicato qui).
- `storyflow-extension/engine-config.js`: `ENGINE_MANIFEST_URL`.
- App Android (repository `StoryFlow`): `app/src/main/res/values/config.xml`, `studio_url` ed `engine_manifest_url`.
- `README.md`: la nota sui domini dell'estensione.
- `tests/extension.test.mjs`: l'indirizzo del finto server del motore, per mantenere i test allineati.

Dopo il cambio: alzare la versione dell'estensione e delle app, rifare i pacchetti e lanciare tutti i test.

### Firma del motore
- Generare le chiavi **una sola volta**: `node tools/engine-keygen.mjs --android ../StoryFlow`. Conservare `keys/engine-private.pem` con cura, con una copia di sicurezza fuori dal PC.
- Firmare il motore (oggi alla 4.1.1): `node tools/engine-sign.mjs`, poi caricare sul server `engine/composer.js` e `engine/manifest.json`.
- Finché le chiavi mancano, le app rifiutano gli aggiornamenti dal server e usano solo il motore incluso nel pacchetto.

### Android
- Compilare e provare su un telefono vero il nuovo trascinamento dell'adesivo link (movimenti distanziati di 16 ms), in modalità Test.
- Prima di pubblicare su Play Store, verificare che `compileSdk`/`targetSdk` 37 e AGP 9.4.1 rispettino i requisiti del momento.
- Lasciare `usesCleartextTraffic="true"`: serve per leggere gli articoli dei siti ancora senza HTTPS. Si potrà valutare di toglierlo solo se si decide di accettare esclusivamente siti HTTPS.

## Per l'abbonamento
- Account e login nel pannello e nelle app; il server consegna pannello e aggiornamenti del motore solo agli abbonati attivi.
- Pagamenti ricorrenti (es. Stripe Billing) collegati agli account.
- Chiave AI lato server (inclusa nell'abbonamento) al posto della chiave Gemini di ogni utente.

## App desktop
- Aggiornamento automatico dell'app stessa (es. electron-updater), oltre a quello del motore che c'è già.
- Icona e nome definitivi, firma del codice Windows e notarizzazione Apple.

## Motore
- Prima prova reale di pubblicazione (in modalità Test) con Meta Business Suite in inglese, spagnolo, portoghese e francese per confermare i testi dei pulsanti in `UI_LABELS` (vedi «Lingue: prova reale e revisione»).
- Invio automatico dei rapporti d'errore al server, per accorgersi dei cambi di Meta prima che li segnalino i clienti.

## Titoli AI
- Rifinire le istruzioni con titoli veri del sito: a volte scappano ancora giudizi ("una leggenda") e alcuni titoli "forte" sono vaghi.
