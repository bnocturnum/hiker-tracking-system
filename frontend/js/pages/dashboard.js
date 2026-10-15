import { initializeMap } from "../map.js";

const defaultLocation = {
    latitude: 19.511,
    longitude: -99.126
};

initializeMap(
    "map",
    defaultLocation.latitude,
    defaultLocation.longitude
);