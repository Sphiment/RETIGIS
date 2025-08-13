// Centralized configuration for RETIGIS
// Edit values here once; the whole app will use them.
// You can create variants like config.dev.js / config.prod.js and swap in index.html.

window.CONFIG = {
  // Base host (protocol + host + optional port) where GeoServer lives
  HOST: 'http://localhost:8080',

  // GeoServer context path (usually 'geoserver')
  GEOSERVER_CONTEXT: 'geoserver',

  // Credentials (NOTE: Exposed in browser; for production use a proxy instead of putting admin creds here)
  GEOSERVER_USERNAME: 'admin',
  GEOSERVER_PASSWORD: 'geoserver',

  // App tunables
  MAX_FEATURES: 1000
};

// Derived URLs
window.CONFIG.GEOSERVER_BASE_URL = `${window.CONFIG.HOST}/${window.CONFIG.GEOSERVER_CONTEXT}`;
window.CONFIG.REST_URL = `${window.CONFIG.GEOSERVER_BASE_URL}/rest`;
window.CONFIG.WMS_URL = `${window.CONFIG.GEOSERVER_BASE_URL}/wms`;
window.CONFIG.WFS_URL = `${window.CONFIG.GEOSERVER_BASE_URL}/wfs`;

// Helper to build auth header
window.buildAuthHeader = function(extraHeaders = {}) {
  return {
    'Authorization': 'Basic ' + btoa(`${window.CONFIG.GEOSERVER_USERNAME}:${window.CONFIG.GEOSERVER_PASSWORD}`),
    ...extraHeaders
  };
};

// Helper for REST (GeoServer REST) fetches. Accepts either relative REST path ("/layers.json") or full URL (resource.href)
window.restFetch = async function(path, options = {}) {
  const url = /^https?:/i.test(path) ? path : `${window.CONFIG.REST_URL}${path}`;
  const merged = {
    ...options,
    headers: buildAuthHeader(options.headers || {})
  };
  return fetch(url, merged);
};
