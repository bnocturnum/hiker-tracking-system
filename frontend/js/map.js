let map;
let marker;

export function initializeMap(elementId, latitude, longitude) {

    map = L.map(elementId).setView(
        [latitude, longitude],
        15
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);

    marker = L.marker(
        [latitude, longitude]
    ).addTo(map);
}


export function updateMarker(latitude, longitude) {

    if (!marker) {
        return;
    }

    marker.setLatLng(
        [latitude, longitude]
    );

    map.setView(
        [latitude, longitude]
    );
}