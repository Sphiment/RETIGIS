window.CONFIG = {
  // Change to 0 for local development, 1 for production
  PRODUCTION_MODE: 1,

  // Base URL where your GeoServer is accessible (including protocol and path up to 'geoserver')
  // Examples: 
  // - For local development: 'http://localhost:8080/geoserver'
  // - For production: 'https://yourdomain.com/geoserver'
  GEOSERVER_BASE: 'http://localhost:8080/geoserver',
  
  // For local development only - used when PRODUCTION_MODE = 0
  LOCAL_AUTH: {
    USERNAME: 'admin',      // Your local GeoServer username
    PASSWORD: 'geoserver'   // Your local GeoServer password
  }
};

window.CONFIG.REST_URL = `${CONFIG.GEOSERVER_BASE}/rest`;
window.CONFIG.WMS_URL = `${CONFIG.GEOSERVER_BASE}/wms`;
window.CONFIG.WFS_URL = `${CONFIG.GEOSERVER_BASE}/wfs`;

// Helper function to add auth headers for local development
window.authFetch = function(url, options = {}) {
  if (CONFIG.PRODUCTION_MODE === 0) {
    const credentials = btoa(`${CONFIG.LOCAL_AUTH.USERNAME}:${CONFIG.LOCAL_AUTH.PASSWORD}`);
    options.headers = {
      ...options.headers,
      'Authorization': `Basic ${credentials}`
    };
  }
  return fetch(url, options);
};
