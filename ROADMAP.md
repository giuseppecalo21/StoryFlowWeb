# Prossimi passi

## Prossima release

### Onboarding: prova reale su Meta
La guida in 4 passaggi e la scelta del nome della pagina sono pronte (vedi README). Prima di distribuirle:
- provare **"Trova il nome in Meta"** e **"Verifica"** con un account vero, nell'app desktop e su Android (la parte Kotlin non è stata compilata qui);
- salvare uno screenshot vero della pagina delle storie come `onboarding/dove-pubblichiamo.png` (il pannello lo usa al posto dell'illustrazione);
- ricontrollare i nomi dei menu citati nella guida per chi non ha Meta Business Suite ("Impostazioni", "Pagine", "Account Instagram"): Meta li cambia spesso.

### Pulsante "Resetta tutto e ricomincia"
Dopo un errore: azzera coda, stato della pubblicazione e registro, riporta l'app al pannello e permette di riprovare da zero senza chiudere e riaprire.

### Android – schermo acceso durante la coda
Durante la pubblicazione tenere lo schermo acceso, come quando si guarda un video (`FLAG_KEEP_SCREEN_ON`), e toglierlo a fine coda o in caso di errore.

### Ritocco grafico
La freccia del pulsante "Personalizza grafica" non è allineata bene con la scritta "Apri/Chiudi": sistemarla.

## Da ricordare
- **Android – piano B**: pulsante "Condividi su Instagram" che passa la grafica creata all'app Instagram con l'intent ufficiale per le storie, per quando l'automazione non è disponibile. L'adesivo link andrà aggiunto a mano dall'utente.

## Per l'abbonamento
- Account e login nel pannello e nelle app; il server consegna pannello e aggiornamenti del motore solo agli abbonati attivi.
- Pagamenti ricorrenti (es. Stripe Billing) collegati agli account.
- Chiave AI lato server (inclusa nell'abbonamento) al posto della chiave Gemini di ogni utente.
- Dominio del prodotto al posto di quello attuale: va cambiato in `desktop/config.json`, `storyflow-extension/engine-config.js` e `app/src/main/res/values/config.xml` (Android).

## App desktop
- Aggiornamento automatico dell'app stessa (es. electron-updater), oltre a quello del motore che c'è già.
- Icona e nome definitivi, firma del codice Windows e notarizzazione Apple.

## Motore
- Prima prova reale con Meta Business Suite in inglese per confermare i testi dei pulsanti in `UI_LABELS`.
- Invio automatico dei rapporti d'errore al server, per accorgersi dei cambi di Meta prima che li segnalino i clienti.

## Titoli AI
- Rifinire le istruzioni con titoli veri del sito: a volte scappano ancora giudizi ("una leggenda") e alcuni titoli "forte" sono vaghi.
