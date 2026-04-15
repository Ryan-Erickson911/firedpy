const map = L.map('map', {
    center: [35.49034105709725, -48.231773657570756],
    zoom: 3,
    zoomControl: false
});

fetch("assets/map/readme_links.csv")
    .then(res => res.text())
    .then(text => {
        const rows = text.trim().split("\n").map(r => r.split(","));
        const header = rows[0].map(h => h.trim());
        const data = rows.slice(1);

        const regionCol = header.indexOf("Region");
        const countryCol = header.indexOf("Country");

        const groups = {};

        data.forEach(row => {
            const region = row[regionCol]?.trim();
            const country = row[countryCol]?.trim();

            if (!region || !country) return;

            if (!groups[region]) groups[region] = [];
            groups[region].push(country);
        });

        const accordion = document.getElementById("accordion");

        Object.keys(groups).forEach(regionName => {
            const headerDiv = document.createElement("div");
            headerDiv.className = "group-header";
            headerDiv.textContent = regionName;

            const contentDiv = document.createElement("div");
            contentDiv.className = "group-content";

            groups[regionName].forEach(country => {
                const p = document.createElement("p");
                p.textContent = country;
                contentDiv.appendChild(p);
            });

            headerDiv.addEventListener("click", () => {
                contentDiv.style.display =
                    contentDiv.style.display === "block" ? "none" : "block";
            });

            accordion.appendChild(headerDiv);
            accordion.appendChild(contentDiv);
        });
    });

function countryStyle(feature) {
    const p = feature.properties;

    // Count how many fields are populated (not null, not empty)
    let count = 0;
    if (p.V2022) count++;
    if (p.V2024S1T5) count++;
    if (p.f_file_name) count++;

    // Choose color based on count
    let fillColor = "#464646"; // default white
    if (count === 3) fillColor = "#ff0000";      // red
    else if (count === 2) fillColor = "#ffff00"; // yellow
    else if (count === 1) fillColor = "#ffffff"; // white

    return {
        color: "#333",
        weight: 1,
        fillColor: fillColor,
        fillOpacity: 0.7
    };
}
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
// LAYERS
// --------------------------------------------------
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

const processedCountriesLayer = new L.GeoJSON.AJAX(
    "assets/map/processed_countries_with_params.geojson",
    {
        style: countryStyle, 

        onEachFeature: function (feature, layer) {
            // Build popup content
            const p = feature.properties;
            const popupHtml = `
                <div id="popup">
                    <p>
                        <center>${p.NAME}</center> <br>
                        Version 1.0: ${makeLink(p.V2022)}<br>
                        Version 2.0: ${makeLink(p.V2024S1T5)}<br>
                        Version 2.1: ${makeLink(p.f_file_name)} coming soon!
                    </p>
                </div>
            `;

            layer.bindPopup(popupHtml);

            // Zoom to polygon on click
            layer.on("click", function () {
                map.fitBounds(layer.getBounds());
                layer.openPopup();
            });
        }
    }
);
processedCountriesLayer.addTo(map);

const sidebar = document.getElementById("sidebar");

// Disable map scroll-zoom when hovering over sidebar
sidebar.addEventListener("mouseenter", () => {
    map.scrollWheelZoom.disable();
});

// Re-enable map scroll-zoom when leaving sidebar
sidebar.addEventListener("mouseleave", () => {
    map.scrollWheelZoom.enable();
});
// --------------------------------------------------
// LAYER CONTROL
// --------------------------------------------------
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

L.control.layers(null, {
    "Processed Countries": processedCountriesLayer
}).addTo(map);