/* StoryFlow — traduzioni del pannello.
 * I testi stanno in i18n/<lingua>.js (window.SF_LANGS.<lingua>); l'italiano è la lingua di riferimento.
 * Lingua: ?lang= nell'indirizzo, poi la scelta salvata, poi quella del browser o del telefono; inglese
 * per le lingue non previste. Nell'HTML:
 *   data-i18n="chiave"            → testo dell'elemento
 *   data-i18n-html="chiave"       → HTML dell'elemento (solo testi nostri, con <strong>, <b>, <a>)
 *   data-i18n-attr="placeholder:chiave;title:chiave2"
 * Nel codice: SF_I18N.t('chiave', {n: 3}) e SF_I18N.tn('chiave', n) per i plurali (chiave_one, chiave_other).
 */
(() => {
  'use strict';
  const LANGS = { it: 'Italiano', en: 'English', es: 'Español', pt: 'Português (Brasil)', fr: 'Français' };
  const LOCALES = { it: 'it-IT', en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR' };
  const STORE_KEY = 'storyflow.lang';
  const dicts = window.SF_LANGS || {};
  const listeners = [];

  const supported = code => {
    const c = String(code || '').slice(0, 2).toLowerCase();
    return LANGS[c] ? c : '';
  };
  function detect() {
    let saved = '';
    try { saved = localStorage.getItem(STORE_KEY) || ''; } catch (_) {}
    const asked = new URLSearchParams(location.search).get('lang');
    for (const c of [asked, saved, ...(navigator.languages || []), navigator.language]) {
      if (supported(c)) return supported(c);
    }
    return 'en';
  }
  let lang = detect();

  function raw(key) {
    for (const l of [lang, 'en', 'it']) {
      const v = dicts[l] && dicts[l][key];
      if (typeof v === 'string') return v;
    }
    return key;
  }
  const fill = (text, params) => params
    ? text.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m))
    : text;
  const t = (key, params) => fill(raw(key), params);
  // Plurali con le regole della lingua (in francese 0 è singolare); chiave_zero se esiste.
  function tn(key, n, params = {}) {
    const all = { n, ...params };
    if (n === 0 && dicts[lang] && typeof dicts[lang][key + '_zero'] === 'string') return t(key + '_zero', all);
    let form = 'other';
    try { form = new Intl.PluralRules(LOCALES[lang]).select(n); } catch (_) { form = n === 1 ? 'one' : 'other'; }
    const exact = dicts[lang] && typeof dicts[lang][`${key}_${form}`] === 'string';
    return t(exact ? `${key}_${form}` : `${key}_${n === 1 ? 'one' : 'other'}`, all);
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    if (root === document) document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  }

  function setLang(code) {
    const next = supported(code);
    if (!next || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORE_KEY, lang); } catch (_) {}
    apply();
    listeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
  }

  // Selettori di lingua: <select data-lang-select>, sincronizzati tra loro.
  function bindSelects() {
    document.querySelectorAll('select[data-lang-select]').forEach(sel => {
      if (!sel.options.length) {
        Object.entries(LANGS).forEach(([code, name]) => sel.add(new Option(name, code)));
        sel.addEventListener('change', () => setLang(sel.value));
      }
      sel.value = lang;
    });
  }

  window.SF_I18N = {
    t, tn, apply, setLang,
    lang: () => lang,
    locale: () => LOCALES[lang],
    languages: () => ({ ...LANGS }),
    onChange: fn => listeners.push(fn)
  };
  listeners.push(bindSelects);
  apply();
  bindSelects();
})();
