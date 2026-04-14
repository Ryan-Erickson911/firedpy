const map = L.map('map', {
    center: [36.99914216255409, -109.04537518899879],
    zoom: 2
});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);
// --------------------------------------------------
// LAYERS
// --------------------------------------------------


// --------------------------------------------------
// LAYER CONTROL
// --------------------------------------------------
L.control.layers(null, {
    "US States": statesLayer,
    "Major Cities": citiesLayer,
    "EPA Monitors": epaLayer,
    "Nighttime Lights": nightLightsLayer
}).addTo(map);