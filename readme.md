## RETIGIS - Configurable GIS Web App

### Configuration
Edit `config.js` to set your GeoServer location:

### Setup Options

**Option 1: Direct (for development)**
- Set `GEOSERVER_BASE` to your actual GeoServer URL
- GeoServer must allow CORS or be on same domain
- Credentials may be exposed to users

**Option 2: Secure (for production)**
- Set `GEOSERVER_BASE` to your domain + path
- Configure Apache/Nginx reverse proxy
- Hide credentials server-side

### TODO
- sorting for attribute table
- modern ui and animations