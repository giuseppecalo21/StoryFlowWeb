# Prossimi passi

## Da ricordare (richiesti)
- **Android – piano B**: pulsante "Condividi su Instagram" che passa la grafica creata all'app Instagram con l'intent ufficiale per le storie, per quando l'automazione non è disponibile. L'adesivo link andrà aggiunto a mano dall'utente.
- **Android – schermo acceso**: durante la pubblicazione tenere lo schermo acceso, come quando si guarda un video (`FLAG_KEEP_SCREEN_ON`), e toglierlo a fine coda.

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
