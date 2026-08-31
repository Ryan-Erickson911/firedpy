// Document Interactions
const regionSelect    = document.getElementById("regionSelect");
const subregionSelect = document.getElementById("subregionSelect");
const countrySelect   = document.getElementById("countrySelect");
const datasetSelect   = document.getElementById("datasetSelect");
const searchBox = document.getElementById("searchBox");
const sidebar = document.getElementById("sidebar");
const resetButton = document.getElementById("resetButton");

// STYLES
// NA Eco
const NA_ECO_COLORS = {
    "ARCTIC CORDILLERA": "#7BAFD4",
    "EASTERN TEMPERATE FORESTS": "#5DAF5A",
    "GREAT PLAINS": "#E8C547",
    "HUDSON PLAIN": "#A0B8C4",
    "MARINE WEST COAST FOREST": "#3F7F5F",
    "MEDITERRANEAN CALIFORNIA": "#D96C3F",
    "NORTH AMERICAN DESERTS": "#E3C29D",
    "NORTHERN FORESTS": "#4C8F4A",
    "NORTHWESTERN FORESTED MOUNTAINS": "#6A8E7F",
    "SOUTHERN SEMIARID HIGHLANDS": "#C49A6C",
    "TAIGA": "#2F5E4E",
    "TEMPERATE SIERRAS": "#8C7F6B",
    "TROPICAL DRY FORESTS": "#C8A641",
    "TROPICAL WET FORESTS": "#1E8E5A",
    "TUNDRA": "#B5B5B5",
    "WATER": "#4F81BD"
};

// WWF
const BIOME_COLORS = {
    1:"#1B9E77", 2:"#66A61E", 3:"#4E7F18", 4:"#A6D854",
    5:"#4DAF4A", 6:"#2C6E49", 7:"#E6AB02", 8:"#FFD92F",
    9:"#E5C100", 10:"#B3A000", 11:"#A6A6A6", 12:"#E7298A",
    13:"#E6CBA8", 14:"#8C510A", 98:"#4F81BD", 99:"#FFFFFF"
};


// Firedpy Colors
const COUNTRY_COLORS = ["#464646", "#F4E6FF", "#CA8AFF", "#7300D1", "#410075"];

// Base Layers
const base_osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    minZoom: 2,
    maxZoom: 7,
    opacity: 0.6
});

const base_hillshade = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
});

const wwf_ecoLayer = L.geoPackageFeatureLayer([], {
    geoPackageUrl: "../firedpy/data/world_eco_regions/wwf_terr_ecos.gpkg",
    layerName: 'wwf_terr_ecos',
    style: function(feature) {
        return {
            color: "#333",
            weight: 1,
            fillColor: BIOME_COLORS[feature.properties.BIOME] || "#464646",
            fillOpacity: 0.7
        };
    },
});

const na3_ecoLayer = L.geoPackageFeatureLayer([], {
    geoPackageUrl: "../firedpy/data/na_eco/NA_CEC_Eco_Level3.gpkg",
    layerName: 'NA_CEC_Eco_Level3',
    style: function(feature) {
        return {
            color: "#333",
            weight: 1,
            fillColor: NA_ECO_COLORS[feature.properties.NA_L1NAME] || "#464646",
            fillOpacity: 0.7
        };
    },
});

const southWest = L.latLng(90, -180);
const northEast = L.latLng(-90, 180);
const bounds = L.latLngBounds(southWest, northEast);

const map = L.map('map', {
    center: [35.49, -48.23],
    maxBounds: bounds,
    zoom: 3,
    zoomControl: false,
    layers: [base_hillshade, base_osm],
});

const legendControl = L.control({ position: 'bottomright' });
legendControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend-panel');
    div.id = 'map-legend';
    div.innerHTML = '<div class="legend-header">Eco Layer Legend</div>';
    return div;
};
legendControl.addTo(map);

function buildLegendRow(label, color) {
    return `
        <div class="legend-row">
            <span class="legend-swatch" style="background:${color};"></span>
            <span>${label}</span>
        </div>
    `;
}

function lockLegendScroll() {
    const legend = document.getElementById('map-legend');
    if (!legend) return;

    ['wheel', 'mousewheel', 'touchmove'].forEach(eventName => {
        legend.addEventListener(eventName, (event) => event.stopPropagation(), { passive: true });
    });
}

function renderLegend() {
    const legend = document.getElementById('map-legend');
    if (!legend) return;

    const colorEntries = [];

    if (map.hasLayer(na3_ecoLayer)) {
        colorEntries.push(...Object.entries(NA_ECO_COLORS).map(([label, color]) => buildLegendRow(label, color)));
    }

    if (map.hasLayer(wwf_ecoLayer)) {
        colorEntries.push(...Object.entries(BIOME_COLORS).map(([key, color]) => buildLegendRow(`Biome ${key}`, color)));
    }

    const header = '<div class="legend-header">Eco Layer Legend</div>';

    if (!colorEntries.length) {
        legend.innerHTML = `${header}<div class="legend-empty">No eco layer selected</div>`;
        return;
    }

    legend.innerHTML = `${header}${colorEntries.join('')}`;
    lockLegendScroll();
}

const modis_tiles_layer = new L.GeoJSON.AJAX("map/modis_tiles.geojson", {
    style: {
        color: "#333",
        weight: 1,
        fillOpacity: 0
    },
    onEachFeature: function (feature, layer) {
        if (feature.properties && feature.properties.name) {
            layer.bindTooltip(feature.properties.name, {
                permanent: true,
                direction: "center",
                className: "modis-tile-label"
            });
        }
    }
}).addTo(map);

// Function to reorder overlays
function reorderOverlays() {
    overlayOrder.forEach(layer => {
        if (map.hasLayer(layer)) {
            layer.bringToFront();
        }
    });
}

function buildDropdowns(allRows, allHeaders, filterText = "", unCode = null) {
    const filter = filterText.trim().toLowerCase();
    const unFilter = unCode === null || unCode === undefined ? "" : String(unCode).trim();
    const tree = {};
    let firstMatch;
    const rows = allRows.slice(1).map(row => row.split(',').map(value => value.trim()));

    const regionCol = allHeaders.indexOf('REGION');
    const subregionCol = allHeaders.indexOf('SUBREGION');
    const countryCol = allHeaders.indexOf('Country');
    const namesCol = allHeaders.indexOf('country_name');
    const temporalCol = allHeaders.indexOf('temporal');
    const spatialCol = allHeaders.indexOf('spatial');
    const version1Col = allHeaders.indexOf('V2022');
    const version2Col = allHeaders.indexOf('V2024S1T5');
    const unIndex = allHeaders.indexOf('UN');

    rows.forEach(row => {
        const region = row[regionCol];
        const subregion = row[subregionCol];
        const country = row[countryCol];
        const name = row[namesCol];
        const sparam = row[spatialCol];
        const tparam = row[temporalCol];
        const dataset1 = row[version1Col];
        const dataset2 = row[version2Col];
        const rowUnCode = row[unIndex];
        const datasets = [
            { label: "V2022", value: dataset1 ?? "NA" },
            { label: "V2024S1T5", value: dataset2 ?? "NA" }
        ];

        if (!region || !subregion || !country) return;
        if (unFilter && rowUnCode !== unFilter) return;

        const searchable = `${region} ${subregion} ${country} ${name}`.toLowerCase();
        if (!searchable.includes(filter)) return;

        if (!firstMatch) firstMatch = { region, subregion, country, name };

        if (!tree[region]) tree[region] = {};
        if (!tree[region][subregion]) tree[region][subregion] = {};
        if (!tree[region][subregion][country]) tree[region][subregion][country] = [];

        tree[region][subregion][country].push({ name, sparam, tparam, datasets });
    });

    populateRegion(tree, filter || unFilter ? firstMatch : null);
}

function populateRegion(tree, selected = null) {
    regionSelect.innerHTML = `<option value="Select Region">Select Region</option>`;
    subregionSelect.innerHTML = `<option value="Select Subregion">Select Subregion</option>`;
    countrySelect.innerHTML = `<option value="">Select Country</option>`;
    datasetSelect.innerHTML = "";

    Object.keys(tree).sort().forEach(region => {
        regionSelect.innerHTML += `<option value="${region}">${region}</option>`;
    });

    regionSelect.onchange = () => populateSubregion(tree, regionSelect.value, selected);

    if (selected) {
        regionSelect.value = selected.region;
        populateSubregion(tree, selected.region, selected);
    }
}

function populateSubregion(tree, region, selected = null) {
    subregionSelect.innerHTML = `<option value="Select Subregion">Select Subregion</option>`;

    if (!region || !tree[region]) return;

    Object.keys(tree[region]).sort().forEach(sr => {
        subregionSelect.innerHTML += `<option value="${sr}">${sr}</option>`;
    });

    subregionSelect.onchange = () => populateCountry(tree, region, subregionSelect.value, selected);

    if (selected && selected.region === region) {
        subregionSelect.value = selected.subregion;
        populateCountry(tree, region, selected.subregion, selected);
    }
}

function zoomToCountry(countryName) {
    const layer = countryLayerIndex[countryName];
    if (!layer) return;

    if (layer.getBounds) {
        const bounds = layer.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, {maxZoom: 5});
            return;
        }
    }

    const p = layer.feature?.properties;
    if (p && p.LAT !== undefined && p.LON !== undefined) {
        map.setView([p.LAT, p.LON], 5);
    }
}

function populateCountry(tree, region, subregion, selected = null) {
    countrySelect.innerHTML = `<option value="">Select Country</option>`;

    if (!subregion || !tree[region]?.[subregion]) return;

    Object.keys(tree[region][subregion]).sort().forEach(country => {
        countrySelect.innerHTML += `<option value="${country}">${country}</option>`;
    });

    countrySelect.onchange = () => {
        const selectedCountry = countrySelect.value;
        populateDatasets(tree, region, subregion, selectedCountry);
        zoomToCountry(selectedCountry);
    };

    if (selected && selected.region === region && selected.subregion === subregion) {
        countrySelect.value = selected.country;
        populateDatasets(tree, region, subregion, selected.country);
        zoomToCountry(selected.country);
    }
}

function populateDatasets(tree, region, subregion, country) {
    datasetSelect.innerHTML = "";

    if (!country) return;

    tree[region][subregion][country].forEach(({ name, sparam, tparam, datasets }) => {
        const entries = datasets.map(({ label, value }) => {
            if (!value) return "";

            return `
                <div class="dataset-version">
                    ${label}: ${makeLink(value)}
                </div>
            `;
        }).join("");

        datasetSelect.insertAdjacentHTML("beforeend", `
            <div class="dataset-entry">
                <h3 style="margin: 0 0 0 0"><strong style="color: black">${name}:</strong></h3>
                ${entries}
                <div style="text-align: left">V2025: -sp ${sparam || "NA"} -tp ${tparam || "NA"}</div>
            </div>
        `);
    });
}
// finish color hover by Region (Popup region background by subregion?)
function countryStyle({ properties: p }) {
    const count = unCounts[p.UN] || 0;
    return {
        color: "#535353",
        weight: 1,
        fillColor: COUNTRY_COLORS[Math.min(count, 5)],
        fillOpacity: 0.85
    };
}

let countryLayerIndex = {};
let unCounts = {};
let firedpyLayer;

function hasDatasetValue(value) {
    return value !== undefined && value !== null && value.trim() !== "" && value.trim().toLowerCase() !== "na";
}

fetch('map/un_readme_params.csv')
    .then(response => response.text())
    .then(csvText => {
        const rows = csvText.trim().split(/\r?\n/);
        const headers = rows[0].split(',');
        const unIndex = headers.indexOf('UN');
        const spatialIndex = headers.indexOf('spatial');
        const temporalIndex = headers.indexOf('temporal');
        const version1Index = headers.indexOf('V2022');
        const version2Index = headers.indexOf('V2024S1T5');
        const unRowCounts = {};

        rows.slice(1).forEach(row => {
            const values = row.split(',').map(value => value.trim());
            const value = values[unIndex];

            if (value && value.toLowerCase() !== 'null') {
                unRowCounts[value] = (unRowCounts[value] || 0) + 1;
                unCounts[value] = (unCounts[value] || 0)
                    + (hasDatasetValue(values[spatialIndex]) && hasDatasetValue(values[temporalIndex]) ? 1 : 0)
                    + (hasDatasetValue(values[version1Index]) ? 1 : 0)
                    + (hasDatasetValue(values[version2Index]) ? 1 : 0);
            }
        });

        Object.keys(unRowCounts).forEach(value => {
            if (unRowCounts[value] > 1) unCounts[value] = 4;
        });

        buildDropdowns(rows, headers);
        searchBox.addEventListener("input", e => {
            buildDropdowns(rows, headers, e.target.value);
        });
        resetButton.addEventListener("click", () => {
            searchBox.value = "";
            buildDropdowns(rows, headers);
        });
        firedpyLayer = new L.GeoJSON.AJAX("map/countries_with_params.geojson", {
            style: countryStyle,
            onEachFeature: function (feature, layer) {
                const p = feature.properties;
                countryLayerIndex[p.NAME] = layer;
                attachHover(layer);
                const popupHtml = `
                    <div id="popup">
                        <p>
                            <center>${p.NAME}</center>
                        </p>
                    </div>
                `;
                layer.bindPopup(popupHtml);
                layer.on("click", (event) => {
                    const clickLatLng = event.latlng || [p.LAT, p.LON];
                    layer.bindPopup(popupHtml).openPopup(clickLatLng);
                    buildDropdowns(rows, headers, "", p.UN);
                })}  
        }).addTo(map);
        
        firedpyLayer.addTo(map);
        layerControl.addOverlay(firedpyLayer, "Firedpy Data");
        overlayOrder.push(firedpyLayer);
        reorderOverlays();
    });


function highlightFeature(e) {
    e.target.setStyle({
        weight: 2,
        color: "#00ffff",
        fillOpacity: 0.9
    });
};

function resetHighlight(e) {
    firedpyLayer.resetStyle(e.target);
};

function attachHover(layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });
};

function makeLink(md) {
    if (!md) return "None";

    const match = md.match(/\[(.*?)\]\((.*?)\)/);
    if (!match) return md;

    const label = match[1];
    const url   = match[2];
    return `<a href="${url}" target="_blank">${label}</a>`;
};

// Final map settings and layer prio
const baseMaps = {};

const overlayMaps = {
    "Modis Tiles": modis_tiles_layer,
    "WWF Eco Regions": wwf_ecoLayer,
    "NA LVL 3 Eco Regions": na3_ecoLayer
};

function syncLayerControlState() {
    if (layerControl && typeof layerControl._update === 'function') {
        layerControl._update();
    }
}

function refreshEcoLegend() {
    renderLegend();
    syncLayerControlState();
}

function enforceSingleEcoLayer(activeLayer) {
    if (!activeLayer) return;

    if (activeLayer === wwf_ecoLayer && map.hasLayer(na3_ecoLayer)) {
        map.removeLayer(na3_ecoLayer);
    }

    if (activeLayer === na3_ecoLayer && map.hasLayer(wwf_ecoLayer)) {
        map.removeLayer(wwf_ecoLayer);
    }

    refreshEcoLegend();
}

// Layer Control
const overlayOrder = [
    modis_tiles_layer,
    wwf_ecoLayer,
    na3_ecoLayer
];

const layerControl = L.control.layers(baseMaps,overlayMaps).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

function handleOverlayChange(event) {
    if (event && event.type === 'overlayadd' && (event.layer === wwf_ecoLayer || event.layer === na3_ecoLayer)) {
        enforceSingleEcoLayer(event.layer);
        return;
    }

    reorderOverlays();
    refreshEcoLegend();
}

map.on('overlayadd', handleOverlayChange);
map.on('overlayremove', handleOverlayChange);
reorderOverlays();
renderLegend();

const hideWwfAtZoom = 2;

function updateWwfVisibility() {
    if (map.getZoom() <= hideWwfAtZoom) {
        map.removeLayer(modis_tiles_layer);
    } else if (!map.hasLayer(modis_tiles_layer)) {
        map.addLayer(modis_tiles_layer);
    }
}

map.on("zoomend", updateWwfVisibility);
updateWwfVisibility();

sidebar.onmouseenter = () => {
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
};

sidebar.onmouseleave = () => {
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
};