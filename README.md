# StoryFlow

Pannello web per creare storie da articoli (WordPress REST / RSS) e pubblicarle in automatico su Meta Business Suite con l'adesivo link.

## Struttura

| Cartella / file | Cosa contiene | Va sul server? |
|---|---|---|
| `index.html`, `studio.js`, `ui.css`, `proxy.php` | Pannello storie | Sì |
| `engine/` | **Motore di pubblicazione** unico (`composer.js`) + `manifest.json` firmato | Sì |
| `storyflow-extension/` | Estensione Chrome (alternativa all'app desktop) | Solo lo zip da scaricare |
| `desktop/` | App per Windows/Mac (Electron) | No |
| `tools/` | Script per chiavi, firma e copia del motore | No |
| `tests/` | Prove automatiche (Playwright) | No |
| `keys/` | Chiave privata di firma (esclusa da git) | **Mai** |

Il file `.htaccess` blocca comunque `desktop/`, `tools/`, `tests/` e `keys/` se vengono caricati per errore.

L'app Android si trova nel repository `StoryFlow`.

## Il motore e gli aggiornamenti "a caldo"

App desktop, app Android ed estensione usano lo **stesso** `engine/composer.js`. All'avvio e prima di ogni pubblicazione controllano `engine/manifest.json` sul server: se trovano una versione più recente **firmata**, la scaricano e la usano subito, senza reinstallare nulla. Se il server non risponde o la firma non torna, usano il motore incluso nel pacchetto.

La firma serve a una cosa sola, ma importante: il motore lavora dentro gli account Meta dei clienti. Senza firma, chi violasse il server potrebbe inviare codice a tutti.

### Prima volta (una sola volta)

```bash
node tools/engine-keygen.mjs --android ../StoryFlow
```

- Crea `keys/engine-private.pem`: **conservala con cura e fanne una copia di sicurezza fuori dal PC**. Se la perdi servirà una nuova versione di tutte le app.
- Scrive la chiave pubblica in `desktop/config.json`, `storyflow-extension/engine-config.js` e, nell'app Android, in `app/src/main/res/values/config.xml`.

### Quando Meta cambia qualcosa

1. Correggi `engine/composer.js`. Se cambiano solo i testi dei pulsanti, basta aggiornare `UI_LABELS` in cima al file.
2. Alza `ENGINE_VERSION` (es. `4.0.0` → `4.0.1`).
3. `node tools/engine-sign.mjs`
4. Carica sul server `engine/composer.js` e `engine/manifest.json`.

Entro pochi minuti tutte le app usano la nuova versione: al successivo avvio, a ogni pubblicazione, oppure subito con **Aggiorna motore** nell'app desktop.

Ogni tanto esegui `node tools/sync-engine.mjs --android ../StoryFlow`: copia il motore aggiornato dentro estensione e app Android, così anche il motore incluso nel pacchetto resta recente.

### Lingue di Meta Business Suite

Il motore riconosce i pulsanti in **italiano** e **inglese** e prova sempre prima la lingua della pagina. Se un pulsante non viene trovato, il rapporto d'errore elenca i pulsanti visibili (es. `Pulsanti visibili: Foto/Video hinzufügen | …`). Basta copiarli nella voce giusta di `UI_LABELS` per aggiungere una lingua.

> I testi inglesi sono ricostruiti, non ancora verificati su un account Meta reale in inglese: va fatta una prova in modalità Test con Meta impostato in inglese.

## App desktop (sostituisce l'estensione)

Una finestra con due viste: il pannello StoryFlow e Meta Business Suite. Il login a Meta si fa normalmente nella vista Meta e resta salvato. Il motore viene iniettato nella pagina delle storie e i clic necessari all'adesivo link vengono simulati come clic reali, con lo stesso metodo dell'estensione (Chrome DevTools Protocol).

```bash
cd desktop
npm install
npm start            # prova in locale
npm run dist:win     # installer Windows (.exe) in desktop/dist
npm run dist:mac     # app Mac (.dmg): va compilata su un Mac
```

- Indirizzi del pannello e del motore: `desktop/config.json`. Per provare un pannello locale: `STORYFLOW_STUDIO_URL=http://localhost:8000/index.html npm start`.
- **Firma del codice**: senza un certificato di firma Windows mostra l'avviso SmartScreen e macOS blocca l'app non notarizzata. Per la vendita servono un certificato di firma del codice per Windows e un account Apple Developer.
- `npm run check` controlla il codice con le definizioni ufficiali di Electron.

## Estensione Chrome

Vedi `storyflow-extension/INSTALLA.txt`. Con l'interruttore **Consenti script utente** attivo, anche l'estensione riceve il motore aggiornato dal server; senza, usa quello incluso.

## Prove automatiche

Richiedono Node 20+ e Playwright con Chromium.

```bash
node tests/engine-mock.test.mjs          # motore su un finto composer Meta (it, en, lingua sconosciuta)
node tests/studio.test.mjs               # pannello: grafica chiusa, coda rapida, titoli AI, app desktop
xvfb-run -a node tests/extension.test.mjs  # estensione completa, anche con motore remoto firmato (su Linux serve xvfb)
```

Il finto composer (`tests/mock-composer.html`) riproduce la sequenza di Meta: carica foto → link → modifica foto → adesivi → adesivo link → condividi. Non sostituisce una prova reale su Meta, ma intercetta subito le regressioni del motore.

## Titoli alternativi con AI

Nel pannello, **✨ 3 titoli alternativi** propone tre titoli più accattivanti, sempre fedeli alla notizia, accanto a quello del sito. Si sceglie con un clic. La chiave Gemini si inserisce in **Impostazioni sito** e resta salvata sul dispositivo. Se il modello predefinito non è disponibile, il pannello prova automaticamente quello successivo; si può anche indicarne uno a mano.

Vedi `ROADMAP.md` per i prossimi passi.
