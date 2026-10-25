# Prossimi passi

## Prossima release

### Onboarding a schede (2-3 passaggi + verifica del canale)
Al primo avvio, un carosello con testi semplici e simpatici che accompagna l'utente passo per passo:
1. **Il tuo sito**: inserisci l'indirizzo del sito o del blog da cui prendere le notizie.
2. **I tuoi colori**: scegli colori e stile della grafica (con anteprima).
3. **Accesso a Meta**: login a Meta Business Suite nella finestra dell'app. Rassicurare: l'accesso resta sul suo dispositivo, StoryFlow non vede né salva nome utente e password.
4. **Dove pubblichiamo** (il passaggio fondamentale): l'utente deve copiare **esattamente** il testo che Meta Business Suite mostra per indicare le sue pagine/profili (lo stesso che il motore cerca nella pagina prima di pubblicare). Spiegare dove trovarlo, passo per passo e con immagini. Senza questo testo non sappiamo su quale pagina stiamo pubblicando.
   - Chi non ha un account Meta Business: spiegare che è gratuito, come crearlo e che deve **aggiungerci le sue pagine Facebook e i profili Instagram**, altrimenti non funziona nulla.
   - Prima di scrivere la guida, ricontrollare su Meta i passaggi e i nomi attuali dei menu (Meta li cambia spesso).

### Messaggi d'errore sul canale
Quando il motore non trova le pagine in Meta Business Suite ("Canale … non trovato"), spiegare chiaramente cosa significa e cosa fare: il testo inserito deve corrispondere esattamente a quello mostrato da Meta, e la pagina deve essere collegata all'account Meta Business. Con un pulsante che riapre il passaggio "Dove pubblichiamo" dell'onboarding.

### Pulsante "Resetta tutto e ricomincia"
Dopo un errore: azzera coda, stato della pubblicazione e registro, riporta l'app al pannello e permette di riprovare da zero senza chiudere e riaprire.

### Android – schermo acceso durante la coda
Durante la pubblicazione tenere lo schermo acceso, come quando si guarda un video (`FLAG_KEEP_SCREEN_ON`), e toglierlo a fine coda o in caso di errore.

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
- Firmare il motore (oggi alla 4.0.1): `node tools/engine-sign.mjs`, poi caricare sul server `engine/composer.js` e `engine/manifest.json`.
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
- Prima prova reale con Meta Business Suite in inglese per confermare i testi dei pulsanti in `UI_LABELS`.
- Invio automatico dei rapporti d'errore al server, per accorgersi dei cambi di Meta prima che li segnalino i clienti.

## Titoli AI
- Rifinire le istruzioni con titoli veri del sito: a volte scappano ancora giudizi ("una leggenda") e alcuni titoli "forte" sono vaghi.
