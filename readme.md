## RETIGIS

### Centralized Configuration
Credentials and host settings are now managed in `config.js`.

Edit values once there (host, port, GeoServer username/password) and the whole app updates automatically.

Key entries:
```
HOST: 'http://localhost:8080'
GEOSERVER_CONTEXT: 'geoserver'
GEOSERVER_USERNAME: 'admin'
GEOSERVER_PASSWORD: 'geoserver'
MAX_FEATURES: 1000
```

Derived URLs (`REST_URL`, `WMS_URL`, `WFS_URL`) are generated automatically; no need to touch them.

To change environments (e.g., production):
1. Copy `config.js` to `config.prod.js` and adjust values.
2. In `index.html` swap the script tag `<script src="config.js"></script>` to point to the desired config file.

For better security in production, avoid exposing admin credentials publicly. Instead place a lightweight proxy between the browser and GeoServer to inject credentials server-side.

### TODO
- ubuntu transformation thing
- raster support
- sorting for attribute table
- modern ui and animations

### Previously Planned (Implemented)
- make a config file and connect all the credentials and config there (DONE)
