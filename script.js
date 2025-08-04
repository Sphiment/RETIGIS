// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);



const activeLayers = new Map();
let allLayers = [];
let currentSort = 'name-asc';
let activeFirst = false;
let collapsedWorkspaces = new Set();
let attributesVisible = false;

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
            
            // Set active state if layer is currently active
            if (activeLayers.has(layer.name)) {
                item.classList.add('active');
            }
            
            item.appendChild(checkbox);
            item.appendChild(layerName);
            item.appendChild(zoomBtn);
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

// Feature info functionality
map.on('click', async function(e) {
    const latlng = e.latlng;
    const point = map.latLngToContainerPoint(latlng);
    const size = map.getSize();
    const bbox = map.getBounds().toBBoxString();
    
    // Get features from all active layers
    for (const [layerName, layer] of activeLayers) {
        try {
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
                    showAttributes(data.features[0], layerName);
                    return; // Show first found feature
                }
            }
        } catch (error) {
            console.error('Error getting feature info:', error);
        }
    }
});

function showAttributes(feature, layerName) {
    const panel = document.getElementById('attributes-panel');
    const content = document.getElementById('attributes-content');
    
    // Show the panel
    panel.style.display = 'flex';
    attributesVisible = true;
    
    // Create feature info
    const properties = feature.properties || {};
    const layerDisplayName = layerName.includes(':') ? layerName.split(':')[1] : layerName;
    
    let html = `
        <div class="feature-info">
            <h4>Layer: ${layerDisplayName}</h4>
        </div>
    `;
    
    if (Object.keys(properties).length > 0) {
        html += `
            <table class="attributes-table">
                <thead>
                    <tr>
                        <th>Attribute</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const [key, value] of Object.entries(properties)) {
            html += `
                <tr>
                    <td>${key}</td>
                    <td>${value !== null && value !== undefined ? value : 'N/A'}</td>
                </tr>
            `;
        }
        
        html += `
                </tbody>
            </table>
        `;
    } else {
        html += '<div id="no-selection">No attributes available for this feature</div>';
    }
    
    content.innerHTML = html;
}

function hideAttributes() {
    const panel = document.getElementById('attributes-panel');
    panel.style.display = 'none';
    attributesVisible = false;
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

// Close attributes panel
document.getElementById('close-attributes').onclick = () => {
    hideAttributes();
};

loadLayers();
