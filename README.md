# StoryFlow

Pannello web per creare storie da articoli (WordPress REST / RSS) e pubblicarle in automatico su Meta Business Suite con l'adesivo link.

## Struttura

| Cartella / file | Cosa contiene | Va sul server? |
|---|---|---|
| `index.html`, `studio.js`, `ui.css`, `proxy.php` | Pannello storie | Sì |
| `engine/` | **Motore di pubblicazione** unico (`composer.js`) + `manifest.json` firmato, `meta-setup.js` per la guida iniziale | Sì |
| `onboarding/` | Immagini della guida iniziale | Sì |
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

Per sicurezza l'estensione comunica solo con il pannello su `https://giuseppe.rocks/storyflow/` e su `http://localhost` (prove in locale). Se sposti il pannello su un altro dominio, aggiorna `host_permissions` e `content_scripts.matches` in `storyflow-extension/manifest.json`, insieme a `ENGINE_MANIFEST_URL` in `storyflow-extension/engine-config.js`.

## Prove automatiche

Richiedono Node 20+ e Playwright con Chromium.

```bash
node tests/engine-mock.test.mjs          # motore su un finto composer Meta (it, en, lingua sconosciuta)
node tests/studio.test.mjs               # pannello: guida iniziale, grafica chiusa, coda rapida, titoli AI, app desktop
node tests/meta-setup.test.mjs           # scelta e verifica del nome della pagina su una finta pagina Meta
(cd desktop && xvfb-run -a npx electron ../tests/desktop-setup.test.cjs)  # app desktop vera: "Trova il nome in Meta" e "Verifica"
xvfb-run -a node tests/extension.test.mjs  # estensione completa, anche con motore remoto firmato (su Linux serve xvfb)
```

Il finto composer (`tests/mock-composer.html`) riproduce la sequenza di Meta: carica foto → link → modifica foto → adesivi → adesivo link → condividi. Non sostituisce una prova reale su Meta, ma intercetta subito le regressioni del motore.

## Guida iniziale e nome della pagina Meta

Al primo avvio il pannello apre una guida in 4 passaggi (si riapre da **❔ Guida**): sito, colori, accesso a Meta Business Suite e **dove pubblichiamo**.

L'ultimo passaggio è il più importante: prima di pubblicare, il motore controlla che la pagina delle storie di Meta contenga il nome della pagina scritto **esattamente** come lo mostra Meta. Per evitare errori di battitura:

- **App desktop e Android:** "Trova il nome in Meta" apre la pagina delle storie e l'utente clicca sul nome della sua pagina; il testo viene copiato così com'è. "Verifica" ripete lo stesso controllo del motore e, se cambia solo qualche maiuscola, propone il nome esatto. Lo script è `engine/meta-setup.js` e non dipende dai nomi dei menu di Meta.
- **Estensione / browser:** guida passo passo con un'illustrazione. Per mostrare uno screenshot vero basta caricare `onboarding/dove-pubblichiamo.png`: il pannello lo usa al posto di `onboarding/dove-pubblichiamo.svg`.

Se durante la pubblicazione il nome non viene trovato, il pannello lo spiega in parole semplici e offre il pulsante per correggerlo.

`meta-setup.js` viene copiato nell'app desktop a ogni build e nell'app Android da `node tools/sync-engine.mjs --android ../StoryFlow`.

## Titoli alternativi con AI

Quando selezioni una notizia, sotto il titolo compaiono da soli tre titoli alternativi, accanto a quello del sito. Sono in scala di "curiosity gap": **leggero** (fatto chiaro più un aggancio), **medio** (trattiene l'elemento chiave), **forte** (costruito attorno all'informazione mancante). Ognuno usa una tecnica diversa. Le istruzioni all'AI vietano fatti non presenti nel titolo originale, titoli fuorvianti e le formule acchiappaclic logore.

- **Senza chiave:** la sezione è sfocata, con l'invito a sbloccarla. La chiave Gemini gratuita si crea su https://aistudio.google.com/apikey e si incolla lì stesso; resta salvata sul dispositivo.
- **Limite d'uso o Gemini sovraccarico:** il pannello passa da solo al modello successivo (prima i predefiniti, poi i modelli "flash" che Google abilita per la chiave, preferendo i "lite"). I limiti gratuiti valgono per singolo modello.
- **Nessuna attesa infinita:** ogni richiesta ha un tempo massimo; se non arriva risposta compare un messaggio con "Riprova".
- **Nessuna richiesta sprecata:** i titoli già generati vengono ricordati, e l'aggiunta rapida in coda non li chiede.

Vedi `ROADMAP.md` per i prossimi passi.
