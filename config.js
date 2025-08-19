// RETIGIS Configuration
// Edit the GEOSERVER_BASE to match your GeoServer location

window.CONFIG = {
  // Base URL where your GeoServer is accessible (including protocol and path up to 'geoserver')
  // Examples:
  // 'https://tomcat.retigis.zains.studio/geoserver'  (different subdomain)
  // 'https://retigis.zains.studio/geoserver'         (same domain)
  // 'https://example.com:8080/geoserver'             (different port)
  GEOSERVER_BASE: 'https://tomcat.retigis.zains.studio/geoserver'
};

// Derived endpoints (don't edit these)
window.CONFIG.REST_URL = `${CONFIG.GEOSERVER_BASE}/rest`;
window.CONFIG.WMS_URL = `${CONFIG.GEOSERVER_BASE}/wms`;
window.CONFIG.WFS_URL = `${CONFIG.GEOSERVER_BASE}/wfs`;
