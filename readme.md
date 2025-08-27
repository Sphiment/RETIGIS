# RETIGIS - Real-Time Geographic Information System

A modern, configurable web-based GIS application.

## Features

- **Real-Time Data Visualization**: Display live geospatial data from GeoServer with WMS and WFS support
- **Interactive Mapping**: Click on features to view detailed attribute information in customizable popups
- **Layer Management**: Organize and toggle layers grouped by GeoServer workspaces
- **Advanced Search & Filtering**: Search through layers and feature attributes with real-time filtering
- **Attribute Tables**: View and search feature attributes in an interactive tabular format
- **Popup Configuration**: Customize which attributes appear in feature popups for each layer
- **Responsive Design**: Optimized interface that works seamlessly on desktop and mobile devices
- **Secure Authentication**: Production-ready deployment with server-side authentication headers
- **Workspace Organization**: Layers are automatically grouped by GeoServer workspaces for better organization


## Quick Setup

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

## Roadmap / TODO

- [ ] Add sorting functionality for attribute tables
- [ ] Implement modern UI animations and transitions
- [ ] Add support for additional coordinate reference systems
- [ ] Implement real-time data updates via WebSocket
- [ ] Add export functionality for attribute tables
- [ ] Implement layer styling and symbology controls
- [ ] Add support for vector tile layers
- [ ] Create mobile-optimized interface improvements
