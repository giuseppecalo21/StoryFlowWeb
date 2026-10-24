#!/usr/bin/env node
// Genera la coppia di chiavi per firmare il motore StoryFlow (da eseguire UNA sola volta).
//   node tools/engine-keygen.mjs [--android ../StoryFlow]
// - keys/engine-private.pem  → chiave privata: resta solo sul tuo PC, mai su GitHub o sul server.
// - engine/public-key.txt    → chiave pubblica, copiata anche nelle configurazioni dei client.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privatePath = join(root, 'keys', 'engine-private.pem');
const args = process.argv.slice(2);
const androidIdx = args.indexOf('--android');
const androidRepo = androidIdx >= 0 ? resolve(args[androidIdx + 1] || '') : resolve(root, '..', 'StoryFlow');

if (existsSync(privatePath) && !args.includes('--force')) {
  console.error(`Esiste già ${privatePath}. Usa --force solo se vuoi sostituirla: i client già distribuiti non accetteranno più i nuovi motori.`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
mkdirSync(dirname(privatePath), { recursive: true });
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(join(root, 'engine', 'public-key.txt'), spki + '\n');

function patch(file, pattern, replacement) {
  if (!existsSync(file)) return console.log(`  (saltato, non trovato) ${file}`);
  const before = readFileSync(file, 'utf8');
  const after = before.replace(pattern, replacement);
  if (after === before) return console.log(`  (nessun segnaposto trovato) ${file}`);
  writeFileSync(file, after);
  console.log(`  aggiornato ${file}`);
}

console.log('Chiave privata:', privatePath);
console.log('Chiave pubblica (SPKI base64):', spki);
patch(join(root, 'desktop', 'config.json'), /"enginePublicKey"\s*:\s*"[^"]*"/, `"enginePublicKey": "${spki}"`);
patch(join(root, 'storyflow-extension', 'engine-config.js'), /ENGINE_PUBLIC_KEY\s*=\s*'[^']*'/, `ENGINE_PUBLIC_KEY = '${spki}'`);
patch(join(androidRepo, 'app', 'src', 'main', 'res', 'values', 'config.xml'),
  /<string name="engine_public_key"[^>]*>[^<]*<\/string>/,
  `<string name="engine_public_key" translatable="false">${spki}</string>`);
console.log('\nOra firma il motore con: node tools/engine-sign.mjs');
