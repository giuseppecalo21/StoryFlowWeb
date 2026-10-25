#!/usr/bin/env node
// Copia engine/composer.js come motore "integrato" nell'estensione e nell'app Android (più engine/meta-setup.js per l'onboarding).
//   node tools/sync-engine.mjs [--android ../StoryFlow]
// L'app desktop lo copia da sola a ogni build (desktop/scripts/sync-engine.mjs).
// Il motore integrato serve solo come riserva: i client usano la versione firmata più recente sul server.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const androidIdx = args.indexOf('--android');
const androidRepo = androidIdx >= 0 ? resolve(args[androidIdx + 1] || '') : resolve(root, '..', 'StoryFlow');
const engineFile = name => join(root, 'engine', name);
const androidAssets = join(androidRepo, 'app', 'src', 'main', 'assets');

// meta-setup.js serve all'onboarding (scelta del nome della pagina): lo usano solo le app.
const copies = [
  [engineFile('composer.js'), join(root, 'storyflow-extension', 'engine', 'composer.js')],
  [engineFile('composer.js'), join(androidAssets, 'composer.js')],
  [engineFile('meta-setup.js'), join(androidAssets, 'meta-setup.js')]
];
for (const [source, target] of copies) {
  if (!existsSync(dirname(target))) { console.log(`(saltato, cartella assente) ${target}`); continue; }
  copyFileSync(source, target);
  console.log(`aggiornato ${target}`);
}
