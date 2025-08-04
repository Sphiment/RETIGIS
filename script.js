// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

const activeLayers = new Map();
let allLayers = [];
let currentSort = 'name-asc';

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
    const sortedLayers = sortLayers([...layers], currentSort);
    
    sortedLayers.forEach(layer => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'layer-checkbox';
        checkbox.checked = activeLayers.has(layer.name);
        checkbox.onchange = () => toggleLayer(layer.name, item, checkbox);
        
        const layerName = document.createElement('span');
        layerName.textContent = layer.name;
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
        list.appendChild(item);
    });
}

function sortLayers(layers, sortType) {
    switch (sortType) {
        case 'name-asc':
            return layers.sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc':
            return layers.sort((a, b) => b.name.localeCompare(a.name));
        case 'workspace':
            return layers.sort((a, b) => {
                const aWorkspace = a.name.includes(':') ? a.name.split(':')[0] : 'default';
                const bWorkspace = b.name.includes(':') ? b.name.split(':')[0] : 'default';
                if (aWorkspace === bWorkspace) {
                    return a.name.localeCompare(b.name);
                }
                return aWorkspace.localeCompare(bWorkspace);
            });
        case 'active':
            return layers.sort((a, b) => {
                const aActive = activeLayers.has(a.name);
                const bActive = activeLayers.has(b.name);
                if (aActive === bActive) {
                    return a.name.localeCompare(b.name);
                }
                return bActive - aActive; // Active layers first
            });
        case 'recent':
            return [...layers].reverse(); // Reverse order (assuming last added is recent)
        default:
            return layers;
    }
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
    
    // Refresh display if "Active First" sorting is selected
    if (currentSort === 'active') {
        const searchTerm = document.getElementById('search-bar').value.toLowerCase();
        const filtered = allLayers.filter(layer => 
            layer.name.toLowerCase().includes(searchTerm)
        );
        displayLayers(filtered);
    }
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

loadLayers();
