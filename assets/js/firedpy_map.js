// --------------------------------------------------
// STYLE: Color polygons by dataset count
// --------------------------------------------------
function countryStyle({ properties: p }) {
    const count = Array.isArray(p.datasets) ? p.datasets.length : 0;

    const fillColor =
        count > 4 ? "#00ff0d" :
        count == 3 ? "#ff0000" :
        count === 2 ? "#ffff00" :
        count === 1 ? "#ffffff" :
        "#464646";

    return {
        color: "#333",
        weight: 1,
        fillColor,
        fillOpacity: 0.7
    };
}
// --------------------------------------------------
// Accordion 
// --------------------------------------------------
function buildDropdowns(filterText = "") {
    const filter = filterText.toLowerCase();
    const tree = {};
    allRows.forEach(row => {
        const region = row[regionCol]?.trim();
        const subregion = row[subregionCol]?.trim();
        const country = row[countryCol]?.trim();
        const datasets = row[data_col]?.trim();

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
    const regionSelect = document.getElementById("regionSelect");
    regionSelect.innerHTML = `<option value="Select Region">Select Region</option>`;

    Object.keys(tree).sort().forEach(region => {
        regionSelect.innerHTML += `<option value="${region}">${region}</option>`;
    });

    regionSelect.onchange = () => populateSubregion(tree, regionSelect.value);
}
function populateSubregion(tree, region) {
    const subregionSelect = document.getElementById("subregionSelect");
    subregionSelect.innerHTML = `<option value="Select Subregion">Select Subregion</option>`;

    if (!region) return;

    Object.keys(tree[region]).sort().forEach(sr => {
        subregionSelect.innerHTML += `<option value="${sr}">${sr}</option>`;
    });

    subregionSelect.onchange = () =>
        populateCountry(tree, region, subregionSelect.value);
}
function populateCountry(tree, region, subregion) {
    const countrySelect = document.getElementById("countrySelect");
    countrySelect.innerHTML = `<option value="">Select Country</option>`;

    if (!subregion) return;

    Object.keys(tree[region][subregion]).sort().forEach(c => {
        countrySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });

    countrySelect.onchange = () =>
        populateDatasets(tree, region, subregion, countrySelect.value);
}
function populateDatasets(tree, region, subregion, country) {
    const container = document.getElementById("datasetSelect");
    container.innerHTML = "";   // clear previous list

    if (!country) return;

    const layer = countryLayerIndex[country];
    const raw = tree[region][subregion][country];
    const list = layer.feature.properties.datasets;

    list.forEach(item => {
        const firstColon = item.indexOf(": ");
        if (firstColon === -1) return;

        const left = item.slice(0, firstColon).trim();   // dataset code or name
        const md   = item.slice(firstColon + 1).trim();  // markdown link

        const html = `
            <div class="dataset-entry">
                <strong style="color: black;">${left}</strong>: ${makeLink(md)}
            </div>
        `;

        container.insertAdjacentHTML("beforeend", html);
    });

    // Zoom to polygon when country selected
    if (layer) {
        map.fitBounds(layer.getBounds());
        layer.openPopup();
    }
}
// --------------------------------------------------
// POPUP: Group datasets and render clean HTML
// --------------------------------------------------
function buildPopup(p) {
    if (!Array.isArray(p.datasets)) {
        const title = p.country_name || p.NAME || "Unknown";
        return `<div style="color:#000;"><strong>${title}</strong></div>`;
    }
    const versions = {"V2022":"Version 1.0", "V2024S1T5":"Version 2.0", "f_file_name":"Version 2.1 -sp -tp params"};
    const groups = {};

    p.datasets.forEach(item => {
        const firstColon = item.indexOf(":");
        if (firstColon === -1) return;

        const left = item.slice(0, firstColon).trim();      // e.g. "New South Wales_V2022" or "V2022"
        const md   = item.slice(firstColon + 1).trim();     // e.g. "[2001-2021](https://...)"

        let groupName, datasetName;

        const dash = left.indexOf("-");
        if (dash !== -1) {
            groupName   = left.slice(0, dash).trim();     // "New South Wales"
            datasetName = versions[left.slice(dash + 1).trim()] || left.slice(dash + 1).trim();    // "V2022"
        } else {
            groupName   = p.country_name || p.NAME || "Unknown";
            datasetName = versions[left] || left;      // "V2022"
        }

        (groups[groupName] ||= []).push({
            datasetName,
            value: makeLink(md)
        });
    });

    return Object.entries(groups)
        .map(([group, entries]) => {
            const items = entries
                .map(e => `<div style="margin-left:15px;">${e.datasetName}: ${e.value}</div>`)
                .join("");
            return `<div><strong>${group}</strong><br>${items}<br></div>`;
        })
        .join("");
}

// --------------------------------------------------
// Convert markdown link → HTML link
// --------------------------------------------------
function makeLink(md) {
    if (!md) return "None";

    // Extract [label](url)
    const match = md.match(/\[(.*?)\]\((.*?)\)/);
    if (!match) return md; // fallback if not markdown format

    const label = match[1];
    const url = match[2];

    return `<a href="${url}" target="_blank">${label}</a>`;
}

// --------------------------------------------------
// HOVER HIGHLIGHT
// --------------------------------------------------
function highlightFeature(e) {
    e.target.setStyle({
        weight: 2,
        color: "#00ffff",
        fillOpacity: 0.9
    });
}

function resetHighlight(e) {
    geoLayer.resetStyle(e.target);
}

function attachHover(layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });
}

// --------------------------------------------------
// MAP + GEOJSON LAYER
// --------------------------------------------------
const map = L.map('map', {
    center: [35.49, -48.23],
    zoom: 3,
    zoomControl: false
});

const countryLayerIndex = {};

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

const geoLayer = new L.GeoJSON.AJAX("assets/map/countries_with_params.geojson", {
    style: countryStyle,
    onEachFeature: function (feature, layer) {
        layer.bindPopup(buildPopup(feature.properties), {
            maxWidth: 400,
            autoPan: true,
            className: "dataset-popup"
        });
        attachHover(layer);

        layer.on("click", () => {
            map.fitBounds(layer.getBounds());
            layer.openPopup();
        });

        countryLayerIndex[feature.properties.NAME] = layer;
    }
});

geoLayer.addTo(map);

// --------------------------------------------------
// LOAD CSV FOR DROPDOWNS
// --------------------------------------------------
let allRows = [];
let regionCol, subregionCol, countryCol, data_col;

fetch("assets/map/map_table.csv")
    .then(res => res.text())
    .then(text => {
        const rows = text.trim().split("\n").map(r => r.split(","));
        const header = rows[0].map(h => h.trim());

        regionCol = header.indexOf("REGION");
        subregionCol = header.indexOf("SUBREGION");
        countryCol = header.indexOf("NAME");
        data_col = header.indexOf("datasets");

        allRows = rows.slice(1);
        buildDropdowns("");
    });

// --------------------------------------------------
// SIDEBAR BEHAVIOR
// --------------------------------------------------
const sidebar = document.getElementById("sidebar");

document.getElementById("searchBox").addEventListener("input", e => {
    buildDropdowns(e.target.value);
});

sidebar.onmouseenter = () => map.scrollWheelZoom.disable();
sidebar.onmouseleave = () => map.scrollWheelZoom.enable();

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.control.layers(null, { "Processed Countries": geoLayer }).addTo(map);