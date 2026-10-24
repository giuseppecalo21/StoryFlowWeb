// Gestione del motore di pubblicazione: versione integrata nell'app + aggiornamenti firmati dal server.
// Un motore remoto viene usato solo se la firma ECDSA del manifest e lo sha256 del file corrispondono.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CLIENT_API = 1;

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const versionOf = code => /ENGINE_VERSION\s*=\s*'([^']+)'/.exec(code)?.[1] || '0.0.0';

function verifyManifest(manifest, publicKeyB64) {
  if (!publicKeyB64) return 'chiave pubblica non configurata';
  if (!manifest || typeof manifest !== 'object') return 'manifest non valido';
  if (!manifest.signature) return 'manifest non firmato';
  if (!/^[0-9a-f]{64}$/.test(String(manifest.sha256))) return 'sha256 non valido';
  if ((Number(manifest.minClientApi) || 1) > CLIENT_API) return 'motore troppo recente per questa versione dell\'app';
  const message = `storyflow-engine\n${manifest.version}\n${manifest.sha256}\n${Number(manifest.minClientApi) || 1}`;
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' });
    const ok = crypto.verify('sha256', Buffer.from(message), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(manifest.signature, 'base64'));
    return ok ? '' : 'firma non valida';
  } catch (e) {
    return 'verifica firma: ' + e.message;
  }
}

class EngineManager {
  /**
   * @param {{manifestUrl:string, publicKey:string, bundledDir:string, cacheDir:string, fetch:(url:string)=>Promise<Response>}} opts
   */
  constructor(opts) {
    this.opts = opts;
    this.lastCheck = { at: 0, error: '' };
    this.active = this.loadBest();
  }

  loadBundled() {
    const code = fs.readFileSync(path.join(this.opts.bundledDir, 'composer.js'), 'utf8');
    return { code, version: versionOf(code), source: 'integrato' };
  }

  loadCached() {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(this.opts.cacheDir, 'manifest.json'), 'utf8'));
      const buf = fs.readFileSync(path.join(this.opts.cacheDir, 'composer.js'));
      if (verifyManifest(manifest, this.opts.publicKey)) return null;
      if (sha256(buf) !== manifest.sha256) return null;
      return { code: buf.toString('utf8'), version: manifest.version, source: 'remoto' };
    } catch (_) {
      return null;
    }
  }

  loadBest() {
    const bundled = this.loadBundled();
    const cached = this.loadCached();
    return cached && compareVersions(cached.version, bundled.version) > 0 ? cached : bundled;
  }

  info() {
    return { version: this.active.version, source: this.active.source, lastCheckAt: this.lastCheck.at, lastError: this.lastCheck.error };
  }

  code() {
    return this.active.code;
  }

  /** Scarica una versione più recente se disponibile. Non lancia mai: l'errore finisce in info().lastError. */
  async checkForUpdate() {
    this.lastCheck = { at: Date.now(), error: '' };
    try {
      const res = await this.opts.fetch(this.opts.manifestUrl + (this.opts.manifestUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
      if (!res.ok) throw new Error('manifest HTTP ' + res.status);
      const manifest = await res.json();
      const problem = verifyManifest(manifest, this.opts.publicKey);
      if (problem) throw new Error(problem);
      if (compareVersions(manifest.version, this.active.version) <= 0) return { updated: false, ...this.info() };

      const fileUrl = new URL(manifest.file || 'composer.js', this.opts.manifestUrl).toString();
      const fileRes = await this.opts.fetch(fileUrl + '?v=' + encodeURIComponent(manifest.version));
      if (!fileRes.ok) throw new Error('motore HTTP ' + fileRes.status);
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (sha256(buf) !== manifest.sha256) throw new Error('sha256 del motore non corrisponde al manifest');

      fs.mkdirSync(this.opts.cacheDir, { recursive: true });
      fs.writeFileSync(path.join(this.opts.cacheDir, 'composer.js'), buf);
      fs.writeFileSync(path.join(this.opts.cacheDir, 'manifest.json'), JSON.stringify(manifest));
      this.active = { code: buf.toString('utf8'), version: manifest.version, source: 'remoto' };
      return { updated: true, ...this.info() };
    } catch (e) {
      this.lastCheck.error = String(e && e.message || e);
      return { updated: false, ...this.info() };
    }
  }
}

module.exports = { EngineManager, compareVersions, verifyManifest, CLIENT_API };
