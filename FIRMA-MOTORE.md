# Firmare il motore: guida passo passo

Questa guida serve a creare le chiavi (una volta sola) e a firmare il motore ogni volta che lo aggiorni. Va bene per Windows e per Mac.

## Cosa ti serve

- **I due progetti scaricati sul computer, uno accanto all'altro**, nella stessa cartella:
  ```
  StoryFlow/
  StoryFlowWeb/
  ```
  Se li scarichi come zip da GitHub, rinomina le cartelle togliendo `-main` alla fine (es. `StoryFlowWeb-main` → `StoryFlowWeb`).
- **Node.js** (versione 20 o più recente). Per controllare se c'è già, apri il terminale (vedi sotto) e scrivi `node -v`: se compare un numero tipo `v22.11.0` sei a posto. Altrimenti scaricalo da [nodejs.org](https://nodejs.org) (versione "LTS") e installalo lasciando le opzioni predefinite.

## Aprire il terminale nella cartella giusta

**Windows**
1. Apri la cartella `StoryFlowWeb` in Esplora file.
2. Clicca sulla barra dell'indirizzo in alto, scrivi `cmd` e premi Invio.
   Si apre una finestra nera già posizionata nella cartella.

**Mac**
1. Apri l'app **Terminale** (Launchpad → Altro → Terminale, oppure cerca "Terminale" con Spotlight).
2. Scrivi `cd ` (con uno spazio dopo), trascina dentro la finestra la cartella `StoryFlowWeb` dal Finder e premi Invio.

Per controllare di essere nel posto giusto scrivi `dir` (Windows) o `ls` (Mac): devi vedere, tra gli altri, `index.html`, `engine` e `tools`.

## Passo 1 — Creare le chiavi (una volta sola nella vita del progetto)

Nel terminale scrivi:

```
node tools/engine-keygen.mjs --android ../StoryFlow
```

Se va tutto bene vedrai qualcosa come:

```
Chiave privata: …/StoryFlowWeb/keys/engine-private.pem
Chiave pubblica (SPKI base64): MFkwEwYH…
  aggiornato …/desktop/config.json
  aggiornato …/storyflow-extension/engine-config.js
  aggiornato …/StoryFlow/app/src/main/res/values/config.xml

Ora firma il motore con: node tools/engine-sign.mjs
```

Cosa è successo:
- **`keys/engine-private.pem`** è la chiave privata, il "sigillo". **Fanne subito una copia** su una chiavetta, un disco esterno o un archivio protetto da password. Non mandarla per email o in chat, non caricarla sul server né su GitHub (git la esclude già da solo).
- La chiave pubblica è stata scritta dentro app desktop, estensione e app Android: da ora accetteranno solo motori firmati con la tua chiave privata.

**Importante:**
- Se il comando risponde `Esiste già … engine-private.pem`, le chiavi le hai già create: **non** usare `--force`, altrimenti le app già distribuite smetterebbero di accettare i motori nuovi.
- Le tre configurazioni appena aggiornate vanno salvate su GitHub (vedi "Salvare su GitHub" in fondo) e le app vanno **ricompilate una volta**, così contengono la chiave pubblica.

## Passo 2 — Firmare il motore (ogni volta che cambia)

1. Se hai modificato `engine/composer.js`, alza il numero in cima al file: `ENGINE_VERSION = '4.1.1'` → `'4.1.2'`. Le app scaricano solo versioni **più nuove** di quella che hanno.
2. Nel terminale scrivi:
   ```
   node tools/engine-sign.mjs
   ```
   Risposta attesa:
   ```
   Motore 4.1.2 firmato (sha256 1a2b3c4d5e6f…). Carica engine/composer.js e engine/manifest.json sul server.
   ```
3. Carica sul server, nella cartella `engine/`, **entrambi** i file: `composer.js` e `manifest.json`. Se ne carichi uno solo, la firma non torna e le app ignorano l'aggiornamento (continuano a funzionare con il motore che hanno).
4. Ogni tanto lancia anche `node tools/sync-engine.mjs --android ../StoryFlow`: copia il motore nuovo dentro estensione e app Android, così anche il motore incluso nei pacchetti resta aggiornato.

## Salvare su GitHub

Dopo il passo 1 (e dopo ogni firma) le modifiche ai file vanno salvate su GitHub, altrimenti al prossimo download le perdi. Se non usi git dal terminale, il modo più semplice è chiedermelo: dimmi "ho creato le chiavi" e incollami la **chiave pubblica** (la riga `MFkw…`; quella si può condividere, è fatta apposta). Inserisco io la chiave pubblica nei progetti e la salvo su GitHub.

**Non incollare mai il contenuto di `engine-private.pem`**: quella resta solo sul tuo computer e sulla tua copia di sicurezza.

## Se qualcosa va storto

| Messaggio | Cosa significa | Cosa fare |
|---|---|---|
| `'node' non è riconosciuto…` / `command not found: node` | Node.js non è installato | Installalo da nodejs.org, chiudi e riapri il terminale |
| `Cannot find module …tools/engine-keygen.mjs` | Il terminale non è nella cartella `StoryFlowWeb` | Rifai "Aprire il terminale nella cartella giusta" |
| `(saltato, non trovato) …StoryFlow…config.xml` | La cartella `StoryFlow` non è accanto a `StoryFlowWeb` o ha un altro nome | Sistema i nomi delle cartelle e rilancia con `--force` **solo** se non hai ancora distribuito app con la chiave |
| `Chiave privata assente` | Firma lanciata prima di creare le chiavi, o su un altro computer | Fai il passo 1, oppure rimetti `engine-private.pem` nella cartella `keys/` dalla tua copia |
