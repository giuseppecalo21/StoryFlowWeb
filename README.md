# StoryFlow

Pannello web per creare storie da articoli (WordPress REST / RSS) e pubblicarle in automatico su Meta Business Suite con l'adesivo link.

## Struttura

| Cartella / file | Cosa contiene | Va sul server? |
|---|---|---|
| `index.html`, `studio.js`, `ui.css`, `proxy.php` | Pannello storie | Sì |
| `i18n/` | Testi del pannello nelle varie lingue | Sì |
| `engine/` | **Motore di pubblicazione** unico (`composer.js`) + `manifest.json` firmato, `meta-setup.js` per la guida iniziale | Sì |
| `onboarding/` | Immagini della guida iniziale (una per lingua) | Sì |
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

Guida passo passo per Windows e Mac, anche senza esperienza col terminale: [FIRMA-MOTORE.md](FIRMA-MOTORE.md).

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

## Lingue

Pannello, app desktop, app Android, guida nella pagina di Meta ed estensione sono in **italiano, inglese, spagnolo, portoghese (Brasile) e francese**. La lingua si sceglie da sola (browser o telefono; inglese per le lingue non previste) e si cambia dal menu in alto o nella guida iniziale. Le app seguono la lingua scelta nel pannello e la ricordano.

- **Pannello:** i testi stanno in `i18n/<lingua>.js`; l'italiano (`i18n/it.js`) è il riferimento. Nell'HTML gli elementi hanno `data-i18n` (testo), `data-i18n-html` (testo con `<strong>`, `<a>`…) o `data-i18n-attr` (`placeholder`, `title`…); nel codice si usa `t('chiave')` e `tn('chiave', n)` per i plurali (`chiave_one`, `chiave_other`, facoltativa `chiave_zero`). Si può forzare una lingua con `?lang=en` nell'indirizzo.
- **Nuova lingua:** copia `i18n/en.js` in `i18n/<codice>.js`, traduci, aggiungi lo `<script>` in `index.html` e il codice in `LANGS` di `i18n/i18n.js`. Poi le stesse voci in `desktop/src/i18n.js`, `MESSAGES` di `engine/composer.js`, `TEXTS` di `engine/meta-setup.js`, `values-<codice>/strings.xml` nell'app Android, `storyflow-extension/_locales/` e l'illustrazione `onboarding/dove-pubblichiamo-<codice>.svg`. `node tests/i18n.test.mjs` segnala chiavi mancanti, segnaposto `{…}` diversi e testi italiani rimasti.
- **Motore:** i messaggi di avanzamento seguono la lingua del pannello (`uiLang` delle storie in coda, `msgLang` nei messaggi). I messaggi d'errore tecnici restano in italiano: finiscono nel rapporto per l'assistenza, mentre il pannello spiega il problema nella lingua dell'utente.
- **Titoli AI:** le istruzioni a Gemini restano in italiano e chiedono titoli nella stessa lingua del titolo originale, quindi funzionano anche con siti in altre lingue.

### Lingue di Meta Business Suite

Il motore riconosce i pulsanti in **italiano** e **inglese** e prova sempre prima la lingua della pagina. Se un pulsante non viene trovato, il rapporto d'errore elenca i pulsanti visibili (es. `Pulsanti visibili: Foto/Video hinzufügen | …`). Basta copiarli nella voce giusta di `UI_LABELS` per aggiungere una lingua.

Per raccogliere in un colpo solo tutte le etichette di una nuova lingua: imposta Facebook in quella lingua, apri il composer storie in Chrome, incolla `tools/cattura-etichette-meta.js` nella Console e fai a mano il percorso di una storia con adesivo link. Il pulsante viola in alto al centro della pagina di Meta copia l'elenco completo (testi dei pulsanti, `aria-label`, titoli delle finestre, avvisi).

> Inglese, spagnolo, francese e portoghese sono verificati su Meta reale (29/10/2026, con `tools/cattura-etichette-meta.js`), tranne la conferma «Discard changes», che il motore usa solo se compare. Lo stesso vale per spagnolo (variante latinoamericana di Meta: «Agregar foto/video»…), francese e portoghese del Brasile. L'`aria-label` dell'adesivo link resta in inglese («Create link sticker») in tutte le lingue provate.

## App desktop (sostituisce l'estensione)

Una finestra con due viste: il pannello StoryFlow e Meta Business Suite. Il login a Meta si fa normalmente nella vista Meta e resta salvato. Il motore viene iniettato nella pagina delle storie e i clic necessari all'adesivo link vengono simulati come clic reali, con lo stesso metodo dell'estensione (Chrome DevTools Protocol).

```bash
cd desktop
npm install
npm start            # prova in locale
npm run dist:win     # installer Windows (.exe) in desktop/dist
npm run dist:mac     # app Mac (.dmg): va compilata su un Mac
```

- Indirizzi del pannello e del motore: `desktop/config.json`. Con `showMetaWhilePublishing: false` (predefinito) durante la coda si vede solo la schermata di pubblicazione del pannello e la vista Meta non si può aprire; con `true` l'app mostra Meta mentre lavora. Per provare un pannello locale: `STORYFLOW_STUDIO_URL=http://localhost:8000/index.html npm start`.
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
node tests/i18n.test.mjs                 # traduzioni: dizionari completi, nessun testo italiano nelle altre lingue
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
