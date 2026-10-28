// Testi dell'app desktop (barra in alto, menu, messaggi di stato) nelle lingue del pannello.
// La lingua è quella scelta nel pannello (setLanguage); prima di saperla vale quella del sistema.
'use strict';

const TEXTS = {
  it: {
    viewsAria: 'Viste', tabStudio: '🎨 Pannello storie', tabMeta: '🔑 Meta Business Suite', metaDot: 'Accesso a Meta',
    metaLoggedIn: 'Accesso a Meta effettuato', metaLoggedOut: 'Accesso a Meta non rilevato',
    metaHome: 'Accedi a Meta', metaHomeTitle: 'Apri la pagina iniziale di Meta Business Suite',
    engine: 'Motore {version} · {source}', sourceBundled: 'integrato', sourceRemote: 'remoto',
    engineOk: 'Motore di pubblicazione aggiornato', engineLastError: 'Ultimo controllo aggiornamenti: {error}',
    engineBtn: 'Aggiorna motore', engineBtnTitle: 'Cerca subito una nuova versione del motore', checking: 'Controllo…',
    updatedTo: 'Aggiornato a {version}', noUpdate: 'Nessun aggiornamento', upToDate: 'Già aggiornato', error: 'Errore',
    publishing: 'Pubblicazione in corso…', starting: 'Avvio pubblicazione…',
    studioUnreachable: 'Pannello non raggiungibile ({error}). Controlla la connessione e premi Ctrl+R.',
    metaCrashed: 'La pagina Meta si è chiusa inaspettatamente ({reason}).',
    stalled: 'Nessun avanzamento da 4 minuti: la pagina Meta potrebbe essere bloccata.',
    stopped: 'Coda fermata su richiesta',
    pickPrompt: 'Clicca sul nome della tua pagina in Meta Business Suite', verifying: 'Verifica del nome della pagina…',
    menuView: 'Visualizza', menuStudio: 'Pannello StoryFlow', menuMeta: 'Meta Business Suite', menuReload: 'Ricarica pannello',
    menuDevStudio: 'Strumenti sviluppatore (pannello)', menuDevMeta: 'Strumenti sviluppatore (Meta)'
  },
  en: {
    viewsAria: 'Views', tabStudio: '🎨 Story panel', tabMeta: '🔑 Meta Business Suite', metaDot: 'Meta login',
    metaLoggedIn: 'Logged in to Meta', metaLoggedOut: 'Meta login not detected',
    metaHome: 'Log in to Meta', metaHomeTitle: 'Open the Meta Business Suite home page',
    engine: 'Engine {version} · {source}', sourceBundled: 'built-in', sourceRemote: 'downloaded',
    engineOk: 'Publishing engine up to date', engineLastError: 'Last update check: {error}',
    engineBtn: 'Update engine', engineBtnTitle: 'Check for a new engine version now', checking: 'Checking…',
    updatedTo: 'Updated to {version}', noUpdate: 'No update', upToDate: 'Already up to date', error: 'Error',
    publishing: 'Publishing…', starting: 'Starting to publish…',
    studioUnreachable: 'Can’t reach the panel ({error}). Check your connection and press Ctrl+R.',
    metaCrashed: 'The Meta page closed unexpectedly ({reason}).',
    stalled: 'No progress for 4 minutes: the Meta page may be stuck.',
    stopped: 'Queue stopped on request',
    pickPrompt: 'Click your Page’s name in Meta Business Suite', verifying: 'Checking the Page name…',
    menuView: 'View', menuStudio: 'StoryFlow panel', menuMeta: 'Meta Business Suite', menuReload: 'Reload panel',
    menuDevStudio: 'Developer tools (panel)', menuDevMeta: 'Developer tools (Meta)'
  },
  es: {
    viewsAria: 'Vistas', tabStudio: '🎨 Panel de historias', tabMeta: '🔑 Meta Business Suite', metaDot: 'Acceso a Meta',
    metaLoggedIn: 'Sesión de Meta iniciada', metaLoggedOut: 'No se detecta la sesión de Meta',
    metaHome: 'Iniciar sesión en Meta', metaHomeTitle: 'Abrir la página de inicio de Meta Business Suite',
    engine: 'Motor {version} · {source}', sourceBundled: 'integrado', sourceRemote: 'descargado',
    engineOk: 'Motor de publicación actualizado', engineLastError: 'Última comprobación de actualizaciones: {error}',
    engineBtn: 'Actualizar motor', engineBtnTitle: 'Buscar ahora una nueva versión del motor', checking: 'Comprobando…',
    updatedTo: 'Actualizado a {version}', noUpdate: 'Sin actualizaciones', upToDate: 'Ya está actualizado', error: 'Error',
    publishing: 'Publicando…', starting: 'Iniciando la publicación…',
    studioUnreachable: 'No se puede acceder al panel ({error}). Revisa la conexión y pulsa Ctrl+R.',
    metaCrashed: 'La página de Meta se cerró de forma inesperada ({reason}).',
    stalled: 'Sin avances desde hace 4 minutos: puede que la página de Meta se haya bloqueado.',
    stopped: 'Cola detenida a petición',
    pickPrompt: 'Haz clic en el nombre de tu página en Meta Business Suite', verifying: 'Comprobando el nombre de la página…',
    menuView: 'Ver', menuStudio: 'Panel de StoryFlow', menuMeta: 'Meta Business Suite', menuReload: 'Recargar panel',
    menuDevStudio: 'Herramientas para desarrolladores (panel)', menuDevMeta: 'Herramientas para desarrolladores (Meta)'
  },
  pt: {
    viewsAria: 'Visualizações', tabStudio: '🎨 Painel de stories', tabMeta: '🔑 Meta Business Suite', metaDot: 'Acesso à Meta',
    metaLoggedIn: 'Login na Meta feito', metaLoggedOut: 'Login na Meta não detectado',
    metaHome: 'Entrar na Meta', metaHomeTitle: 'Abrir a página inicial do Meta Business Suite',
    engine: 'Motor {version} · {source}', sourceBundled: 'integrado', sourceRemote: 'baixado',
    engineOk: 'Motor de publicação atualizado', engineLastError: 'Última verificação de atualizações: {error}',
    engineBtn: 'Atualizar motor', engineBtnTitle: 'Procurar agora uma nova versão do motor', checking: 'Verificando…',
    updatedTo: 'Atualizado para {version}', noUpdate: 'Nenhuma atualização', upToDate: 'Já está atualizado', error: 'Erro',
    publishing: 'Publicando…', starting: 'Iniciando a publicação…',
    studioUnreachable: 'Não foi possível acessar o painel ({error}). Confira a conexão e aperte Ctrl+R.',
    metaCrashed: 'A página da Meta fechou inesperadamente ({reason}).',
    stalled: 'Nenhum avanço há 4 minutos: a página da Meta pode ter travado.',
    stopped: 'Fila parada a pedido',
    pickPrompt: 'Clique no nome da sua página no Meta Business Suite', verifying: 'Verificando o nome da página…',
    menuView: 'Exibir', menuStudio: 'Painel do StoryFlow', menuMeta: 'Meta Business Suite', menuReload: 'Recarregar painel',
    menuDevStudio: 'Ferramentas de desenvolvedor (painel)', menuDevMeta: 'Ferramentas de desenvolvedor (Meta)'
  },
  fr: {
    viewsAria: 'Vues', tabStudio: '🎨 Panneau des stories', tabMeta: '🔑 Meta Business Suite', metaDot: 'Connexion à Meta',
    metaLoggedIn: 'Connecté à Meta', metaLoggedOut: 'Connexion à Meta non détectée',
    metaHome: 'Se connecter à Meta', metaHomeTitle: 'Ouvrir la page d’accueil de Meta Business Suite',
    engine: 'Moteur {version} · {source}', sourceBundled: 'intégré', sourceRemote: 'téléchargé',
    engineOk: 'Moteur de publication à jour', engineLastError: 'Dernière recherche de mise à jour : {error}',
    engineBtn: 'Mettre à jour le moteur', engineBtnTitle: 'Rechercher maintenant une nouvelle version du moteur', checking: 'Vérification…',
    updatedTo: 'Mis à jour en {version}', noUpdate: 'Aucune mise à jour', upToDate: 'Déjà à jour', error: 'Erreur',
    publishing: 'Publication en cours…', starting: 'Lancement de la publication…',
    studioUnreachable: 'Panneau inaccessible ({error}). Vérifiez la connexion et appuyez sur Ctrl+R.',
    metaCrashed: 'La page Meta s’est fermée de façon inattendue ({reason}).',
    stalled: 'Aucune progression depuis 4 minutes : la page Meta est peut-être bloquée.',
    stopped: 'File arrêtée à la demande',
    pickPrompt: 'Cliquez sur le nom de votre Page dans Meta Business Suite', verifying: 'Vérification du nom de la Page…',
    menuView: 'Affichage', menuStudio: 'Panneau StoryFlow', menuMeta: 'Meta Business Suite', menuReload: 'Recharger le panneau',
    menuDevStudio: 'Outils de développement (panneau)', menuDevMeta: 'Outils de développement (Meta)'
  }
};

/** @param {string} code @returns {string} codice supportato oppure '' */
function supported(code) {
  const c = String(code || '').slice(0, 2).toLowerCase();
  return Object.prototype.hasOwnProperty.call(TEXTS, c) ? c : '';
}

/**
 * @param {string} lang
 * @param {keyof typeof TEXTS.it} key
 * @param {Record<string, string|number>} [params]
 */
function t(lang, key, params = {}) {
  const text = (TEXTS[supported(lang) || 'en'] || TEXTS.en)[key] || TEXTS.it[key] || String(key);
  return text.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

/** Tutti i testi della barra in alto, già tradotti. @param {string} lang */
function shellTexts(lang) {
  return { ...(TEXTS[supported(lang) || 'en'] || TEXTS.en) };
}

module.exports = { t, shellTexts, supported, LANGS: Object.keys(TEXTS) };
