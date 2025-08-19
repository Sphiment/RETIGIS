## RETIGIS - Configurable GIS Web App

### Configuration
Edit `config.js` to configure your environment and GeoServer connection.

### Quick Setup

1. **For Local Development**:
   - Set `PRODUCTION_MODE: 0`
   - Update `GEOSERVER_BASE` to your local GeoServer URL
   - Set your GeoServer credentials in `LOCAL_AUTH`

2. **For Production**:
   - Set `PRODUCTION_MODE: 1`
   - Update `GEOSERVER_BASE` to your production GeoServer URL
   - Configure Apache/Nginx to add authentication headers
   - Deploy the app (credentials are handled server-side)

### Security Notes
- **Don't** deploy with `PRODUCTION_MODE: 0` in production environments
- Local development credentials are visible in browser - use only for development
- Production mode ensures credentials remain secure on the server side

### TODO
- sorting for attribute table
- modern ui and animations