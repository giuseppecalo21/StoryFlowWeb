#!/usr/bin/env node
// Firma engine/composer.js e rigenera engine/manifest.json.
//   node tools/engine-sign.mjs
// Da eseguire dopo ogni modifica del motore, prima di caricare la cartella engine/ sul server.
// Ricordati di alzare ENGINE_VERSION in engine/composer.js: i client scaricano solo versioni più nuove.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const enginePath = join(root, 'engine', 'composer.js');
const privatePath = join(root, 'keys', 'engine-private.pem');
const CLIENT_API = 1;

if (!existsSync(privatePath)) {
  console.error('Chiave privata assente: esegui prima node tools/engine-keygen.mjs');
  process.exit(1);
}
const code = readFileSync(enginePath);
const version = /ENGINE_VERSION\s*=\s*'([^']+)'/.exec(code.toString('utf8'))?.[1];
if (!version) {
  console.error('ENGINE_VERSION non trovato in engine/composer.js');
  process.exit(1);
}
const sha256 = createHash('sha256').update(code).digest('hex');
// Stesso testo verificato da app desktop, app Android ed estensione.
const message = `storyflow-engine\n${version}\n${sha256}\n${CLIENT_API}`;
const signature = sign('sha256', Buffer.from(message), {
  key: createPrivateKey(readFileSync(privatePath)),
  dsaEncoding: 'ieee-p1363'
}).toString('base64');

const manifest = { version, file: 'composer.js', sha256, minClientApi: CLIENT_API, publishedAt: new Date().toISOString(), signature };
writeFileSync(join(root, 'engine', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Motore ${version} firmato (sha256 ${sha256.slice(0, 12)}…). Carica engine/composer.js e engine/manifest.json sul server.`);
