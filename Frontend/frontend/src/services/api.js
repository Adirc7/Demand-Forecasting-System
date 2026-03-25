import { auth } from '../firebase';

const BASE = 'http://localhost:8000';

const getAuthToken = () => {
    return new Promise((resolve, reject) => {
        // If a user is already loaded, get the token immediately (force refresh if needed)
        if (auth.currentUser) {
            auth.currentUser.getIdToken().then(resolve).catch(reject);
            return;
        }

        // Otherwise, wait for the auth state to settle
        const unsubscribe = auth.onIdTokenChanged(user => {
            unsubscribe();
            if (user) {
                user.getIdToken().then(resolve).catch(reject);
            } else {
                resolve(null);
            }
        });
    });
};

async function apiFetch(path, options = {}) {
    const token = await getAuthToken();
    if (!token) throw new Error("Not authenticated");

    const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    // If body is plain JSON, set Content-Type. If FormData, let browser set it with boundary.
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// M1 - Products
export const getProducts = (query = '') => apiFetch(`/api/v1/products/${query}`);
export const createProduct = (d) => apiFetch('/api/v1/products/', { method: 'POST', body: JSON.stringify(d) });
export const getStockAdvice = (c, lt) => apiFetch(`/api/v1/products/stock-advice?category=${c}&lead_time_days=${lt}`);

// M2 - Sales
export const getSales = (q = '') => apiFetch(`/api/v1/sales/${q}`);
export const recordSale = (d) => apiFetch('/api/v1/sales/', { method: 'POST', body: JSON.stringify(d) });
export const uploadSalesCSV = (formData) => apiFetch('/api/v1/sales/upload', { method: 'POST', body: formData });
export const triggerAdminEmail = (payload) => apiFetch('/api/v1/sales/trigger-admin-email', { method: 'POST', body: JSON.stringify(payload) });

// M3 - Inventory
export const getAlerts = () => apiFetch(`/api/v1/inventory/alerts?t=${Date.now()}`);
export const getInventory = () => apiFetch('/api/v1/inventory/');
export const updateInventory = (id, data) => apiFetch(`/api/v1/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const acknowledge_alert = (id) => apiFetch(`/api/v1/inventory/alerts/${id}/acknowledge`, { method: 'POST' });
export const setOverrideThreshold = (id, reorder_point) => apiFetch(`/api/v1/inventory/alerts/${id}/override`, { method: 'POST', body: { reorder_point } });

// M4 - Forecasts
export const getForecasts = () => apiFetch('/api/v1/forecast/categories/');
export const triggerRetrain = () => apiFetch('/api/v1/forecast/retrain', { method: 'POST' });

// M5 - Reports
export const getReports = () => apiFetch('/api/v1/reports/');
export const generateReport = (p) => apiFetch('/api/v1/reports/generate', { method: 'POST', body: JSON.stringify(p) });
export const getAccuracy = () => apiFetch('/api/v1/reports/accuracy/metrics');
export const getBusinessMetrics = () => apiFetch('/api/v1/reports/business-metrics');
export const getHistoricalMetrics = () => apiFetch('/api/v1/reports/historical');

// Admin - Users
export const getUsers = () => apiFetch('/api/v1/admin/users');
export const createUser = (d) => apiFetch('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(d) });
export const updateUser = (uid, d) => apiFetch(`/api/v1/admin/users/${uid}`, { method: 'PUT', body: JSON.stringify(d) });
export const deactivateUser = (uid) => apiFetch(`/api/v1/admin/users/${uid}`, { method: 'DELETE' });

// Special Data Dumps
export const downloadCSVFile = async () => {
    const token = await getAuthToken();
    const url = `${BASE}/api/v1/reports/export-csv`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Extract logical filename
    const disposition = response.headers.get('content-disposition');
    let filename = "smart_inventory.csv";
    if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
    }
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    a.remove();
};
