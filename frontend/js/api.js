import CONFIG from "./config.js";

export async function apiGet(endpoint) {

    const response = await fetch(
        `${CONFIG.API_BASE_URL}${endpoint}`
    );

    if (!response.ok) {
        throw new Error(
            `Error en la solicitud: ${response.status}`
        );
    }

    return response.json();
}