// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);



const activeLayers = new Map();
let allLayers = [];
let currentSort = 'name-asc';
let activeFirst = false;
let collapsedWorkspaces = new Set();
let layerAttributesVisible = false;
let selectedFirstEnabled = false;
let currentLayerData = null;
let currentLayerName = null;
let currentSearchTerm = '';
let selectedFeatureIndex = -1;

// Load and display layers
async function loadLayers() {
    try {
        const response = await fetch('http://localhost:8080/geoserver/rest/layers.json', {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        const data = await response.json();
        
        allLayers = data.layers.layer;
        displayLayers(allLayers);
    } catch (e) {
        document.getElementById('layers-list').innerHTML = '<div>Error loading layers</div>';
    }
}

function displayLayers(layers) {
    const list = document.getElementById('layers-list');
    list.innerHTML = '';
    
    // Sort layers based on current sort option
    let sortedLayers = sortLayers([...layers], currentSort);
    
    // Apply "Active First" modifier if enabled
    if (activeFirst) {
        sortedLayers = applyActiveFirst(sortedLayers);
    }
    
    // Group layers by workspace
    const workspaceGroups = groupByWorkspace(sortedLayers);
    
    // Display each workspace group
    Object.keys(workspaceGroups).forEach(workspace => {
        const workspaceLayers = workspaceGroups[workspace];
        
        // Create workspace header
        const workspaceHeader = document.createElement('div');
        workspaceHeader.className = 'workspace-header';
        workspaceHeader.innerHTML = `
            <span class="workspace-toggle">▼</span>
            <span class="workspace-name">${workspace} (${workspaceLayers.length})</span>
        `;
        
        // Create workspace content container
        const workspaceContent = document.createElement('div');
        workspaceContent.className = 'workspace-content';
        
        // Set initial visibility based on collapsed state
        const isCollapsed = collapsedWorkspaces.has(workspace);
        if (isCollapsed) {
            workspaceContent.style.display = 'none';
            workspaceHeader.querySelector('.workspace-toggle').textContent = '▶';
        }
        
        // Add layers to workspace content
        workspaceLayers.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'layer-checkbox';
            checkbox.checked = activeLayers.has(layer.name);
            checkbox.onchange = () => toggleLayer(layer.name, item, checkbox);
            
            const layerName = document.createElement('span');
            // Extract just the layer name without workspace prefix
            const displayName = layer.name.includes(':') ? layer.name.split(':')[1] : layer.name;
            layerName.textContent = displayName;
            layerName.className = 'layer-name';
            
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '⌖';
            zoomBtn.title = 'Zoom to layer';
            zoomBtn.onclick = (e) => {
                e.stopPropagation();
                zoomToLayer(layer.name);
            };
            
            const tableBtn = document.createElement('button');
            tableBtn.className = 'table-btn';
            tableBtn.innerHTML = '⊞';
            tableBtn.title = 'View layer attributes';
            tableBtn.onclick = (e) => {
                e.stopPropagation();
                showLayerAttributes(layer.name);
            };
            
            const configBtn = document.createElement('button');
            configBtn.className = 'config-btn';
            configBtn.innerHTML = '⚙';
            configBtn.title = 'Configure popup attributes';
            configBtn.onclick = (e) => {
                e.stopPropagation();
                showPopupConfigPanel(layer.name);
            };
            
            // Set active state if layer is currently active
            if (activeLayers.has(layer.name)) {
                item.classList.add('active');
            }
            
            item.appendChild(checkbox);
            item.appendChild(layerName);
            item.appendChild(zoomBtn);
            item.appendChild(tableBtn);
            item.appendChild(configBtn);
            workspaceContent.appendChild(item);
        });
        
        // Add toggle functionality
        workspaceHeader.onclick = () => {
            const toggle = workspaceHeader.querySelector('.workspace-toggle');
            if (workspaceContent.style.display === 'none') {
                workspaceContent.style.display = 'block';
                toggle.textContent = '▼';
                collapsedWorkspaces.delete(workspace);
            } else {
                workspaceContent.style.display = 'none';
                toggle.textContent = '▶';
                collapsedWorkspaces.add(workspace);
            }
        };
        
        list.appendChild(workspaceHeader);
        list.appendChild(workspaceContent);
    });
}

function groupByWorkspace(layers) {
    const groups = {};
    
    layers.forEach(layer => {
        const workspace = layer.name.includes(':') ? layer.name.split(':')[0] : 'Default';
        
        if (!groups[workspace]) {
            groups[workspace] = [];
        }
        groups[workspace].push(layer);
    });
    
    return groups;
}

function sortLayers(layers, sortType) {
    switch (sortType) {
        case 'name-asc':
            return layers.sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc':
            return layers.sort((a, b) => b.name.localeCompare(a.name));
        case 'recent':
            return [...layers].reverse(); // Reverse order (assuming last added is recent)
        default:
            return layers;
    }
}

function applyActiveFirst(layers) {
    return layers.sort((a, b) => {
        const aActive = activeLayers.has(a.name);
        const bActive = activeLayers.has(b.name);
        if (aActive === bActive) {
            return 0; // Keep original order within active/inactive groups
        }
        return bActive - aActive; // Active layers first
    });
}

function toggleLayer(name, element, checkbox) {
    if (activeLayers.has(name)) {
        map.removeLayer(activeLayers.get(name));
        activeLayers.delete(name);
        element.classList.remove('active');
        checkbox.checked = false;
    } else {
        const layer = L.tileLayer.wms('http://localhost:8080/geoserver/wms', {
            layers: name,
            format: 'image/png',
            transparent: true
        }).addTo(map);
        activeLayers.set(name, layer);
        element.classList.add('active');
        checkbox.checked = true;
    }
    
    // Refresh display if "Active First" toggle is enabled
    if (activeFirst) {
        const searchTerm = document.getElementById('search-bar').value.toLowerCase();
        const filtered = allLayers.filter(layer => 
            layer.name.toLowerCase().includes(searchTerm)
        );
        displayLayers(filtered);
    }
}

// Popup Configuration Management
async function getPopupConfig(layerName) {
    try {
        const response = await fetch(`http://localhost:8080/geoserver/rest/layers/${layerName}.json`, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (!response.ok) return null;
        
        const layerData = await response.json();
        const resourceResponse = await fetch(layerData.layer.resource.href, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (!resourceResponse.ok) return null;
        
        const featureTypeData = await resourceResponse.json();
        const dataLinks = featureTypeData.featureType.dataLinks;
        
        if (!dataLinks) return null;
        
        // Handle both single object and array formats
        const dataLinksArray = getDataLinksArray(dataLinks);
        
        // Look for retigis.popup entry
        for (const dataLink of dataLinksArray) {
            if (dataLink && dataLink.content === 'retigis.popup') {
                const type = dataLink.type || '';
                if (type.startsWith('config:')) {
                    const attributes = type.substring(7).split(',').filter(attr => attr.trim());
                    return attributes;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error getting popup config:', error);
        return null;
    }
}

// Helper function to handle both single and array data link formats
function getDataLinksArray(dataLinks) {
    if (!dataLinks) return [];
    
    const impl = dataLinks['org.geoserver.catalog.impl.DataLinkInfoImpl'];
    if (!impl) return [];
    
    // If it's already an array, return it
    if (Array.isArray(impl)) {
        return impl;
    }
    
    // If it's a single object, wrap it in an array
    return [impl];
}

// Helper function to reconstruct dataLinks structure preserving existing entries
function reconstructDataLinks(existingDataLinks, popupConfig) {
    if (!existingDataLinks) {
        // No existing data links, create new structure with just popup config
        return {
            'org.geoserver.catalog.impl.DataLinkInfoImpl': popupConfig
        };
    }
    
    const existingArray = getDataLinksArray(existingDataLinks);
    
    // Filter out any existing retigis.popup entries
    const nonPopupEntries = existingArray.filter(dataLink => 
        !dataLink || dataLink.content !== 'retigis.popup'
    );
    
    // Add the new popup config
    const allEntries = [...nonPopupEntries, popupConfig];
    
    // Return appropriate structure based on final count
    if (allEntries.length === 1) {
        return {
            'org.geoserver.catalog.impl.DataLinkInfoImpl': allEntries[0]
        };
    } else {
        return {
            'org.geoserver.catalog.impl.DataLinkInfoImpl': allEntries
        };
    }
}

async function savePopupConfig(layerName, selectedAttributes) {
    try {
        const response = await fetch(`http://localhost:8080/geoserver/rest/layers/${layerName}.json`, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (!response.ok) return false;
        
        const layerData = await response.json();
        const resourceResponse = await fetch(layerData.layer.resource.href, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (!resourceResponse.ok) return false;
        
        const featureTypeData = await resourceResponse.json();
        
        // Create config string
        const configString = `config:${selectedAttributes.join(',')}`;
        
        // Create popup config entry
        const popupConfig = {
            type: configString,
            content: 'retigis.popup'
        };
        
        // Reconstruct data links preserving existing entries
        const newDataLinks = reconstructDataLinks(
            featureTypeData.featureType.dataLinks, 
            popupConfig
        );
        
        // Create minimal update payload
        const updatePayload = {
            featureType: {
                name: featureTypeData.featureType.name,
                nativeName: featureTypeData.featureType.nativeName,
                title: featureTypeData.featureType.title,
                enabled: featureTypeData.featureType.enabled,
                dataLinks: newDataLinks
            }
        };
        
        console.log('Saving popup config with preserved data links:', JSON.stringify(newDataLinks, null, 2));
        
        const updateResponse = await fetch(layerData.layer.resource.href, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${btoa('admin:geoserver')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
        });
        
        return updateResponse.ok;
    } catch (error) {
        console.error('Error saving popup config:', error);
        return false;
    }
}

async function getLayerAttributes(layerName) {
    try {
        const response = await fetch(`http://localhost:8080/geoserver/rest/layers/${layerName}.json`, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (!response.ok) return [];
        
        const layerData = await response.json();
        const resourceResponse = await fetch(layerData.layer.resource.href, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (!resourceResponse.ok) return [];
        
        const featureTypeData = await resourceResponse.json();
        const attributes = featureTypeData.featureType.attributes?.attribute || [];
        
        return attributes
            .filter(attr => attr.name !== 'geom') // Exclude geometry
            .map(attr => attr.name);
    } catch (error) {
        console.error('Error getting layer attributes:', error);
        return [];
    }
}

// Feature click functionality for popups
map.on('click', async function(e) {
    // Handle popup display for active layers
    const clickedLayers = [];
    
    // Check all active layers for features at click point
    for (const [layerName, layer] of activeLayers.entries()) {
        try {
            const latlng = e.latlng;
            const point = map.latLngToContainerPoint(latlng);
            const size = map.getSize();
            const bbox = map.getBounds().toBBoxString();
            
            const url = `http://localhost:8080/geoserver/wms?` +
                `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&` +
                `LAYERS=${layerName}&QUERY_LAYERS=${layerName}&` +
                `STYLES=&BBOX=${bbox}&FEATURE_COUNT=1&` +
                `HEIGHT=${size.y}&WIDTH=${size.x}&FORMAT=image/png&` +
                `INFO_FORMAT=application/json&SRS=EPSG:4326&` +
                `X=${Math.round(point.x)}&Y=${Math.round(point.y)}`;
            
            const response = await fetch(url, {
                headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    clickedLayers.push({
                        layerName: layerName,
                        feature: data.features[0]
                    });
                }
            }
        } catch (error) {
            console.error(`Error getting feature info for ${layerName}:`, error);
        }
    }
    
    // Show popup if we found features
    if (clickedLayers.length > 0) {
        await showFeaturePopup(e.latlng, clickedLayers);
    }
    
    // Handle table highlighting if attributes panel is open
    if (layerAttributesVisible && selectedFirstEnabled && currentLayerData && currentLayerName) {
        const matchingLayer = clickedLayers.find(cl => cl.layerName === currentLayerName);
        if (matchingLayer) {
            highlightFeatureInTable(matchingLayer.feature);
        }
    }
});

async function showFeaturePopup(latlng, clickedLayers) {
    let popupContent = '';
    
    for (const layerInfo of clickedLayers) {
        const { layerName, feature } = layerInfo;
        const displayName = layerName.includes(':') ? layerName.split(':')[1] : layerName;
        
        // Get popup configuration for this layer
        const configuredAttributes = await getPopupConfig(layerName);
        
        popupContent += `<div style="margin-bottom: 15px;">`;
        popupContent += `<h4 style="margin: 0 0 8px 0; color: #2c3e50; border-bottom: 1px solid #ecf0f1; padding-bottom: 4px;">${displayName}</h4>`;
        
        if (!feature.properties) {
            popupContent += `<p style="margin: 0; font-style: italic; color: #7f8c8d;">No attributes available</p>`;
        } else if (!configuredAttributes || configuredAttributes.length === 0) {
            popupContent += `<p style="margin: 0; font-style: italic; color: #7f8c8d;">No attributes configured for popup</p>`;
            popupContent += `<button onclick="openPopupConfig('${layerName}')" style="margin-top: 5px; padding: 3px 8px; font-size: 11px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">Configure</button>`;
        } else {
            // Show only configured attributes
            let hasValidAttributes = false;
            configuredAttributes.forEach(attrName => {
                if (attrName in feature.properties) {
                    const value = feature.properties[attrName];
                    const displayValue = value !== null && value !== undefined ? value : 'N/A';
                    popupContent += `<p style="margin: 3px 0;"><strong>${attrName}:</strong> ${displayValue}</p>`;
                    hasValidAttributes = true;
                }
            });
            
            if (!hasValidAttributes) {
                popupContent += `<p style="margin: 0; font-style: italic; color: #7f8c8d;">Configured attributes not found</p>`;
            }
            
            popupContent += `<button onclick="openPopupConfig('${layerName}')" style="margin-top: 5px; padding: 3px 8px; font-size: 11px; background: #95a5a6; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit Config</button>`;
        }
        
        popupContent += `</div>`;
    }
    
    // Create and show popup
    const popup = L.popup({
        maxWidth: 300,
        className: 'feature-popup'
    })
    .setLatLng(latlng)
    .setContent(popupContent)
    .openOn(map);
}

// Global function to open popup configuration
window.openPopupConfig = async function(layerName) {
    map.closePopup(); // Close the feature popup
    await showPopupConfigPanel(layerName);
};

async function showPopupConfigPanel(layerName) {
    const displayName = layerName.includes(':') ? layerName.split(':')[1] : layerName;
    
    // Get available attributes
    const allAttributes = await getLayerAttributes(layerName);
    if (allAttributes.length === 0) {
        alert('No attributes available for this layer');
        return;
    }
    
    // Get current configuration
    const currentConfig = await getPopupConfig(layerName) || [];
    
    // Create configuration panel
    const panel = document.createElement('div');
    panel.id = 'popup-config-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #34495e;
        border-radius: 8px;
        padding: 20px;
        min-width: 350px;
        max-height: 70vh;
        overflow-y: auto;
        z-index: 2000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    
    let html = `
        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Configure Popup for ${displayName}</h3>
        <p style="margin: 0 0 15px 0; color: #7f8c8d; font-size: 14px;">Select which attributes to show when clicking on features:</p>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ecf0f1; border-radius: 4px; padding: 10px;">
    `;
    
    allAttributes.forEach(attr => {
        const isChecked = currentConfig.includes(attr);
        html += `
            <label style="display: block; margin: 5px 0; cursor: pointer;">
                <input type="checkbox" value="${attr}" ${isChecked ? 'checked' : ''} style="margin-right: 8px;">
                ${attr}
            </label>
        `;
    });
    
    html += `
        </div>
        <div style="margin-top: 15px; text-align: right;">
            <button id="cancel-config-btn" style="margin-right: 10px; padding: 8px 15px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="save-config-btn" style="padding: 8px 15px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Configuration</button>
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.id = 'popup-config-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1999;
    `;
    document.body.appendChild(overlay);
    
    // Event handlers
    document.getElementById('cancel-config-btn').onclick = closePopupConfigPanel;
    overlay.onclick = closePopupConfigPanel;
    
    document.getElementById('save-config-btn').onclick = async () => {
        const checkboxes = panel.querySelectorAll('input[type="checkbox"]:checked');
        const selectedAttributes = Array.from(checkboxes).map(cb => cb.value);
        
        const saveBtn = document.getElementById('save-config-btn');
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        
        const success = await savePopupConfig(layerName, selectedAttributes);
        
        if (success) {
            alert('Popup configuration saved successfully!');
            closePopupConfigPanel();
        } else {
            alert('Error saving configuration. Please try again.');
            saveBtn.textContent = 'Save Configuration';
            saveBtn.disabled = false;
        }
    };
}

function closePopupConfigPanel() {
    const panel = document.getElementById('popup-config-panel');
    const overlay = document.getElementById('popup-config-overlay');
    
    if (panel) panel.remove();
    if (overlay) overlay.remove();
}

function highlightFeatureInTable(feature) {
    if (!currentLayerData || !feature.properties) {
        return;
    }
    
    // Find the matching feature in the current layer data
    const matchingFeatureIndex = currentLayerData.features.findIndex(f => {
        if (!f.properties) return false;
        
        // Compare all properties to find exact match
        const clickedProps = feature.properties;
        const tableProps = f.properties;
        
        // Try to find exact property matches
        let matchingProps = 0;
        let totalProps = 0;
        
        for (const key in clickedProps) {
            totalProps++;
            if (key in tableProps && clickedProps[key] === tableProps[key]) {
                matchingProps++;
            }
        }
        
        // Consider it a match if at least 70% of properties match and we have at least 2 matches
        const matchRatio = totalProps > 0 ? matchingProps / totalProps : 0;
        return matchingProps >= 2 && matchRatio >= 0.7;
    });
    
    if (matchingFeatureIndex !== -1) {
        // Re-render the table with the selected feature at the top
        displayLayerAttributesTable(currentLayerData, currentLayerName, matchingFeatureIndex);
    }
}

// Show layer attributes table
async function showLayerAttributes(layerName) {
    const panel = document.getElementById('layer-attributes-panel');
    const content = document.getElementById('layer-attributes-content');
    const searchInput = document.getElementById('attribute-search');
    
    // Show the panel and search input
    panel.style.display = 'flex';
    searchInput.style.display = 'block';
    layerAttributesVisible = true;
    currentLayerName = layerName;
    
    // Clear previous search
    currentSearchTerm = '';
    searchInput.value = '';
    selectedFeatureIndex = -1;
    
    // Show loading message
    content.innerHTML = '<div style="text-align: center; padding: 20px;">Loading layer attributes...</div>';
    
    try {
        // Get all features from the layer using WFS
        const url = `http://localhost:8080/geoserver/wfs?` +
            `service=WFS&version=1.0.0&request=GetFeature&` +
            `typeName=${layerName}&outputFormat=application/json&` +
            `maxFeatures=1000`; // Limit to 1000 features for performance
        
        const response = await fetch(url, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (response.ok) {
            const data = await response.json();
            currentLayerData = data;
            displayLayerAttributesTable(data, layerName);
        } else {
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Error loading layer attributes</div>';
        }
    } catch (error) {
        console.error('Error fetching layer attributes:', error);
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Error loading layer attributes</div>';
    }
}

function displayLayerAttributesTable(data, layerName, selectedFeatureIdx = -1) {
    const content = document.getElementById('layer-attributes-content');
    const layerDisplayName = layerName.includes(':') ? layerName.split(':')[1] : layerName;
    
    if (!data.features || data.features.length === 0) {
        content.innerHTML = `
            <div class="feature-info">
                <h4>Layer: ${layerDisplayName}</h4>
                <p>No features found in this layer</p>
            </div>
        `;
        return;
    }
    
    // Store the selected feature index
    selectedFeatureIndex = selectedFeatureIdx;
    
    // Get all unique attribute names from all features
    const allAttributes = new Set();
    data.features.forEach(feature => {
        if (feature.properties) {
            Object.keys(feature.properties).forEach(key => allAttributes.add(key));
        }
    });
    
    const attributeNames = Array.from(allAttributes);
    
    if (attributeNames.length === 0) {
        content.innerHTML = `
            <div class="feature-info">
                <h4>Layer: ${layerDisplayName}</h4>
                <p>No attributes found in this layer</p>
            </div>
        `;
        return;
    }
    
    // Filter features based on search term
    let filteredFeatures = data.features;
    if (currentSearchTerm) {
        const searchLower = currentSearchTerm.toLowerCase();
        filteredFeatures = data.features.filter(feature => {
            if (!feature.properties) return false;
            
            // Search in all property values
            return Object.values(feature.properties).some(value => {
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchLower);
            });
        });
    }
    
    // Reorder features if a selected feature is specified and it exists in filtered results
    let featuresInOrder = [...filteredFeatures];
    let actualSelectedIndex = -1;
    
    if (selectedFeatureIndex >= 0 && selectedFeatureIndex < data.features.length) {
        const selectedFeature = data.features[selectedFeatureIndex];
        const indexInFiltered = filteredFeatures.findIndex(f => f === selectedFeature);
        
        if (indexInFiltered >= 0) {
            actualSelectedIndex = 0; // Will be first after reordering
            featuresInOrder.splice(indexInFiltered, 1);
            featuresInOrder.unshift(selectedFeature);
        }
    }
    
    // Calculate column width based on number of attributes
    const numColumns = attributeNames.length + 1; // +1 for row number column
    const maxTableWidth = 1200; // Maximum table width
    const minColumnWidth = 100;
    const rowColumnWidth = 60;
    const availableWidth = maxTableWidth - rowColumnWidth;
    const columnWidth = Math.max(minColumnWidth, availableWidth / attributeNames.length);
    
    // Create the table
    const totalFeatures = data.features.length;
    const filteredCount = filteredFeatures.length;
    const searchInfo = currentSearchTerm ? ` (${filteredCount} of ${totalFeatures} features shown)` : ` (${totalFeatures} features)`;
    
    let html = `
        <div class="feature-info">
            <h4>Layer: ${layerDisplayName}${searchInfo}</h4>
        </div>
        <div class="layer-attributes-table-container">
            <table class="layer-attributes-table" style="min-width: ${Math.min(maxTableWidth, (columnWidth * attributeNames.length) + rowColumnWidth)}px;">
                <thead>
                    <tr>
                        <th style="width: ${rowColumnWidth}px; min-width: ${rowColumnWidth}px; max-width: ${rowColumnWidth}px;">Row</th>
    `;
    
    // Add column headers with fixed width
    attributeNames.forEach(attr => {
        html += `<th style="width: ${columnWidth}px;" title="${attr}">${attr}</th>`;
    });
    
    html += `
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add data rows
    featuresInOrder.forEach((feature, displayIndex) => {
        const isSelected = actualSelectedIndex === displayIndex;
        const originalIndex = data.features.indexOf(feature) + 1;
        
        html += `<tr${isSelected ? ' class="selected"' : ''}>`;
        html += `<td style="font-weight: bold; background: ${isSelected ? 'rgba(255,255,255,0.2)' : '#f8f9fa'};">${originalIndex}</td>`;
        
        attributeNames.forEach(attr => {
            const value = feature.properties && feature.properties[attr];
            const displayValue = value !== null && value !== undefined ? value : 'N/A';
            html += `<td title="${displayValue}">${displayValue}</td>`;
        });
        
        html += `</tr>`;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = html;
}

function hideLayerAttributes() {
    const panel = document.getElementById('layer-attributes-panel');
    const searchInput = document.getElementById('attribute-search');
    
    panel.style.display = 'none';
    searchInput.style.display = 'none';
    
    layerAttributesVisible = false;
    currentLayerData = null;
    currentLayerName = null;
    currentSearchTerm = '';
    selectedFeatureIndex = -1;
    searchInput.value = '';
}

// Zoom to layer function
async function zoomToLayer(layerName) {
    try {
        const response = await fetch(`http://localhost:8080/geoserver/rest/layers/${layerName}.json`, {
            headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
        });
        
        if (response.ok) {
            const data = await response.json();
            const resourceHref = data.layer?.resource?.href;
            
            if (resourceHref) {
                const resourceResponse = await fetch(resourceHref, {
                    headers: {'Authorization': `Basic ${btoa('admin:geoserver')}`}
                });
                
                if (resourceResponse.ok) {
                    const resourceData = await resourceResponse.json();
                    const featureType = resourceData.featureType || resourceData.coverage;
                    const bbox = featureType?.latLonBoundingBox || featureType?.nativeBoundingBox;
                    
                    if (bbox?.minx !== undefined) {
                        const bounds = [[bbox.miny, bbox.minx], [bbox.maxy, bbox.maxx]];
                        map.fitBounds(bounds, { padding: [20, 20], animate: true, duration: 2 });
                        return;
                    }
                }
            }
        }
        
        map.setView([51.505, -0.09], 10, { animate: true, duration: 2 });
    } catch (e) {
        map.setView([51.505, -0.09], 10, { animate: true, duration: 2 });
    }
}

// Search functionality
document.getElementById('search-bar').oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allLayers.filter(layer => 
        layer.name.toLowerCase().includes(searchTerm)
    );
    displayLayers(filtered);
};

// Sort functionality
document.getElementById('sort-select').onchange = (e) => {
    currentSort = e.target.value;
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const filtered = allLayers.filter(layer => 
        layer.name.toLowerCase().includes(searchTerm)
    );
    displayLayers(filtered);
};

// Active First toggle functionality
document.getElementById('active-first-toggle').onchange = (e) => {
    activeFirst = e.target.checked;
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const filtered = allLayers.filter(layer => 
        layer.name.toLowerCase().includes(searchTerm)
    );
    displayLayers(filtered);
};

// Selected First toggle functionality
document.getElementById('selected-first-toggle').onchange = (e) => {
    selectedFirstEnabled = e.target.checked;
    
    // If toggling off and we have current layer data, restore original order
    if (!selectedFirstEnabled && currentLayerData && currentLayerName) {
        displayLayerAttributesTable(currentLayerData, currentLayerName);
    }
};

// Attribute search functionality
document.getElementById('attribute-search').oninput = (e) => {
    currentSearchTerm = e.target.value.trim();
    
    if (currentLayerData && currentLayerName) {
        // Preserve selected feature if "Selected First" is enabled and we have one
        const preserveSelection = selectedFirstEnabled && selectedFeatureIndex >= 0;
        displayLayerAttributesTable(
            currentLayerData, 
            currentLayerName, 
            preserveSelection ? selectedFeatureIndex : -1
        );
    }
};

// Close layer attributes panel
document.getElementById('close-layer-attributes').onclick = () => {
    hideLayerAttributes();
};

loadLayers();
