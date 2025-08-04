// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

const activeLayers = new Map();
let allLayers = [];

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
    
    layers.forEach(layer => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        
        const layerName = document.createElement('span');
        layerName.textContent = layer.name;
        layerName.onclick = () => toggleLayer(layer.name, item);
        
        const zoomBtn = document.createElement('button');
        zoomBtn.className = 'zoom-btn';
        zoomBtn.innerHTML = '⌖';
        zoomBtn.title = 'Zoom to layer';
        zoomBtn.onclick = (e) => {
            e.stopPropagation();
            zoomToLayer(layer.name);
        };
        
        item.appendChild(layerName);
        item.appendChild(zoomBtn);
        list.appendChild(item);
    });
}

function toggleLayer(name, element) {
    if (activeLayers.has(name)) {
        map.removeLayer(activeLayers.get(name));
        activeLayers.delete(name);
        element.classList.remove('active');
    } else {
        const layer = L.tileLayer.wms('http://localhost:8080/geoserver/wms', {
            layers: name,
            format: 'image/png',
            transparent: true
        }).addTo(map);
        activeLayers.set(name, layer);
        element.classList.add('active');
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
                        map.fitBounds(bounds, { padding: [20, 20], animate: true, duration: 1 });
                        return;
                    }
                }
            }
        }
        
        map.setView([51.505, -0.09], 10, { animate: true, duration: 1 });
    } catch (e) {
        map.setView([51.505, -0.09], 10, { animate: true, duration: 1 });
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

loadLayers();
