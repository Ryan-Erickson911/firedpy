// STYLES
// WWF
const BIOME_COLORS = {
    1:"#1B9E77", 2:"#66A61E", 3:"#4E7F18", 4:"#A6D854",
    5:"#4DAF4A", 6:"#2C6E49", 7:"#E6AB02", 8:"#FFD92F",
    9:"#E5C100", 10:"#B3A000", 11:"#A6A6A6", 12:"#E7298A",
    13:"#E6CBA8", 14:"#8C510A", 98:"#4F81BD", 99:"#FFFFFF"
};

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

// Firedpy Colors
const COUNTRY_COLORS = ["#464646", "#F4E6FF", "#CA8AFF", "#7300D1", "#410075"];

// Style functions
function countryStyle({ properties: p }) {
    const count = Object.keys(p.DATA).length;
    return {
        color: "#333",
        weight: 1,
        fillColor: COUNTRY_COLORS[Math.min(count, 4)],
        fillOpacity: 0.85
    };
}

function na_eco_style({ properties: p }) {
    return {
        color: "#333",
        weight: 1,
        fillColor: NA_ECO_COLORS[p.NA_L1NAME] || "#464646",
        fillOpacity: 0.7
    };
}

function wwf_eco_style({ properties: p }) {
    return {
        color: "#333",
        weight: 1,
        fillColor: BIOME_COLORS[p.BIOME] || "#464646",
        fillOpacity: 0.7
    };
}

const regionSelect    = document.getElementById("regionSelect");
const subregionSelect = document.getElementById("subregionSelect");
const countrySelect   = document.getElementById("countrySelect");
const datasetSelect   = document.getElementById("datasetSelect");

// Accordion
let allRows = [];
let regionCol, subregionCol, countryCol, data_col;
function buildDropdowns(filterText = "") {
    const filter = filterText.toLowerCase();
    const tree = {};
    allRows.forEach(row => {
        const region    = row[regionCol]?.trim();
        const subregion = row[subregionCol]?.trim();
        const country   = row[countryCol]?.trim();
        const datasets  = row[data_col]?.trim();

        if (!region || !subregion || !country) return;

        const searchable = `${region} ${subregion} ${country} ${datasets}`.toLowerCase();
        if (!searchable.includes(filter)) return;

        if (!tree[region]) tree[region] = {};
        if (!tree[region][subregion]) tree[region][subregion] = {};
        tree[region][subregion][country] = datasets;
    });
    populateRegion(tree);
}

function populateRegion(tree) {
    regionSelect.innerHTML = `<option value="Select Region">Select Region</option>`;

    Object.keys(tree).sort().forEach(region => {regionSelect.innerHTML += `<option value="${region}">${region}</option>`;});
    regionSelect.onchange = () => populateSubregion(tree, regionSelect.value);
}

function populateSubregion(tree, region) {
    subregionSelect.innerHTML = `<option value="Select Subregion">Select Subregion</option>`;

    if (!region) return;
    Object.keys(tree[region]).sort().forEach(sr => {subregionSelect.innerHTML += `<option value="${sr}">${sr}</option>`;});

    subregionSelect.onchange = () => populateCountry(tree, region, subregionSelect.value);
}

function populateCountry(tree, region, subregion) {
    countrySelect.innerHTML = `<option value="">Select Country</option>`;

    if (!subregion) return;

    Object.keys(tree[region][subregion]).sort().forEach(c => {
        countrySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });

    countrySelect.onchange = () =>
        populateDatasets(tree, region, subregion, countrySelect.value);
}

function populateDatasets(tree, region, subregion, country) {
    datasetSelect.innerHTML = "";

    if (!country) return;

    const layer = countryLayerIndex[country];
    const list = layer.feature.properties.DATA;

    list.forEach(item => {
        const firstColon = item.indexOf(": ");
        if (firstColon === -1) return;

        const left = item.slice(0, firstColon).trim();
        const md   = item.slice(firstColon + 1).trim();

        const html = `
            <div class="dataset-entry">
                <strong style="color: black;">${left}</strong>: ${makeLink(md)}
            </div>
        `;

        datasetSelect.insertAdjacentHTML("beforeend", html);
    });

    if (layer) {
        map.fitBounds(layer.getBounds());
        layer.openPopup();
    }
}

function buildPopup(p) {
    const title = p.NAME || "Unknown";
    const data  = p.DATA;

    // Case 1: no DATA or empty object
    if (!data || Object.keys(data).length === 0) {
        return `<div style="color:#000;"><strong>${title}</strong></div>`;
    }

    const versions = {
        "V2022":     "Version 1.0",
        "V2024S1T5": "Version 2.0",
    };

    const groups  = {};
    let spatialCount   = null;
    let temporalCount  = null;

    // Case 2: upto 4 entries
    if (Object.keys(data).length < 5) {
        Object.entries(data).forEach(([col, val]) => {
            // Case 2 & 3: spatial/temporal are counts, not links — store separately
            if (col === "spatial")  { spatialCount  = val; return; }
            if (col === "temporal") { temporalCount = val; return; }

            // Case 3 & 4: versioned download links
            const dash = col.indexOf("-");
            const groupName   = dash !== -1 ? col.slice(0, dash).trim() : title;
            const versionKey  = dash !== -1 ? col.slice(dash + 1).trim() : col;
            const datasetName = versions[versionKey] || versionKey;

            (groups[groupName] ||= []).push({ datasetName, value: makeLink(val) });
        });

        // Build metadata line for spatial/temporal counts
        const metaParts = [];
        if (spatialCount  !== null) metaParts.push(`Spatial Param (-sp): ${spatialCount}`);
        if (temporalCount !== null) metaParts.push(`Temporal Param (-tp): ${temporalCount}`);
        const metaLine = metaParts.length
            ? `<div style="margin-bottom:6px;margin-left:15px;color:#555;">${metaParts.join(" <br> ")}</div>`
            : "";

        // Build download links section
        const linksSection = Object.entries(groups)
            .map(([group, entries]) => {
                const items = entries
                    .map(e => `<div style="margin-left:15px;">${e.datasetName}: ${e.value}</div>`)
                    .join("");
                return `<br> <strong>Avaliable Data:</strong> ${items}<br></div>`;
            }).join("");
    return `
        <div style="color:#000;">
            <strong>${title}</strong><br>
            ${metaLine}
            ${linksSection || "<div style='color:#555;'>No downloads available</div>"}
        </div>
    `;
    }

}

// Convert markdown → HTML link
function makeLink(md) {
    if (!md) return "None";

    const match = md.match(/\[(.*?)\]\((.*?)\)/);
    if (!match) return md;

    const label = match[1];
    const url   = match[2];
    return `<a href="${url}" target="_blank">${label}</a>`;
}

// HOVER HIGHLIGHT
function highlightFeature(e) {
    e.target.setStyle({
        weight: 2,
        color: "#00ffff",
        fillOpacity: 0.9
    });
}

function resetHighlight(e) {
    firedpyLayer.resetStyle(e.target);
}

function attachHover(layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });
}

// MAP LAYERS
const countryLayerIndex = {};

const modis_tiles_layer = new L.GeoJSON.AJAX("assets/map/modis_tiles.geojson", {
    style: {
        color: "#333",
        weight: 1,
        fillOpacity: 0
    },
});

const wwf_ecoLayer = new L.GeoJSON.AJAX("assets/map/wwf_ecos.geojson", {
    style: wwf_eco_style,
});

const na3_ecoLayer = new L.GeoJSON.AJAX("assets/map/na_eco_lvl_3.geojson", {
    style: na_eco_style,
});

const firedpyLayer = new L.GeoJSON.AJAX("assets/map/countries_with_params.geojson", {
    style: countryStyle,
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        countryLayerIndex[p.NAME] = layer;
        attachHover(layer);
        layer.on("click", () => {
            map.fitBounds(layer.getBounds());
            layer.openPopup();
        });

        console.log(Object.entries(p.DATA))
        layer.bindPopup(buildPopup(p), {
            maxWidth: 400,
            autoPan: true,
            className: "dataset-popup"
        });
    }
});

// MAP INIT
const base_osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
});

const map = L.map('map', {
    center: [35.49, -48.23],
    zoom: 3,
    zoomControl: false,
    layers: [base_osm, modis_tiles_layer]
});

map.options.minZoom = 3;
map.options.maxZoom = 14;

modis_tiles_layer.setZIndex(2).addTo(map);
wwf_ecoLayer.setZIndex(3)
na3_ecoLayer.setZIndex(4)
firedpyLayer.setZIndex(10).addTo(map);

// SIDEBAR BEHAVIOR
const sidebar = document.getElementById("sidebar");

// FIX: Debounced search input — rebuilds dropdown tree 200ms after user stops typing
function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

document.getElementById("searchBox").addEventListener("input",
    debounce(e => buildDropdowns(e.target.value), 200)
);

sidebar.onmouseenter = () => map.scrollWheelZoom.disable();
sidebar.onmouseleave = () => map.scrollWheelZoom.enable();

L.control.zoom({ position: 'bottomright' }).addTo(map);

const baseMaps = {
    "OpenStreetMap": base_osm,
};

const overlayMaps = {
    "Modis Tiles":        modis_tiles_layer,
    "NA LVL 3 Eco Regions": na3_ecoLayer,
    "WWF Eco Regions":    wwf_ecoLayer,
};

const layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);
layerControl.addOverlay(firedpyLayer, "Firedpy");

// Define the canonical z-index order
const LAYER_ORDER = {
    [modis_tiles_layer._leaflet_id]: 2,
    [wwf_ecoLayer._leaflet_id]:      3,
    [na3_ecoLayer._leaflet_id]:      4,
    [firedpyLayer._leaflet_id]:      10,
};

// Re-apply z-indexes on toggle AND on initial load
function enforceLayerOrder() {
    map.eachLayer(layer => {
        const z = LAYER_ORDER[layer._leaflet_id];
        if (z !== undefined) layer.setZIndex(z);
    });
}

map.on("overlayadd", enforceLayerOrder);
map.whenReady(enforceLayerOrder);