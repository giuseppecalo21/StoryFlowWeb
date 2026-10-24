// Copia il motore del repository (../engine) dentro l'app: è la versione "integrata"
// usata finché il server non offre una versione firmata più recente.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(desktop, '..', 'engine');
const target = join(desktop, 'engine');
mkdirSync(target, { recursive: true });
for (const file of ['composer.js', 'manifest.json']) {
  const from = join(source, file);
  if (!existsSync(from)) throw new Error(`Manca ${from}`);
  copyFileSync(from, join(target, file));
}
console.log('Motore integrato aggiornato da ../engine');
