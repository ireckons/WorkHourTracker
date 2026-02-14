import axios from 'axios';

/**
 * Pre-configured Axios instance.
 *
 * - In development: Vite proxies /api to the backend (see vite.config.js),
 *   so we use '' as the base URL (relative paths).
 * - In production: VITE_API_URL should be set to the full API URL.
 * - withCredentials: true ensures the HttpOnly auth cookie is sent.
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
