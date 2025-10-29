// =================================================================
//          API.JS - VERSIÓN FINAL CON TODAS LAS FUNCIONES
// =================================================================

const API_URL = '/api';

class API {
    constructor() {
        this.token = localStorage.getItem('accessToken');
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('accessToken', token);
    }

    async _handleResponse(response) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            console.error(`Error de API (${response.status}):`, errorData);
            throw new Error(errorData.error || errorData.message);
        }
        return response.json();
    }

    // AUTH ENDPOINTS
    async login(username, password) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await this._handleResponse(response);
        if (data.access_token) {
            this.setToken(data.access_token);
        }
        return data;
    }

    // DETECTION ENDPOINTS
    async processFrame(frameData) {
        const response = await fetch(`${API_URL}/detection/process-frame`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ frame: frameData })
        });
        return this._handleResponse(response);
    }

    async getDetectionConfig() {
        const response = await fetch(`${API_URL}/detection/config`, { headers: this.getHeaders() });
        return this._handleResponse(response);
    }

    async saveInspectionResult(data) {
        const response = await fetch(`${API_URL}/detection/save-inspection`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this._handleResponse(response);
    }
    
    // --- FUNCIÓN RESTAURADA Y NECESARIA ---
    // DASHBOARD ENDPOINTS
    async getDashboardOverview() {
        const response = await fetch(`${API_URL}/dashboard/overview`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this._handleResponse(response);
    }


    // --- ¡NUEVAS FUNCIONES! ---
    async getDetectionConfig() {
        const response = await fetch(`${API_URL}/detection/config`, { headers: this.getHeaders() });
        return this._handleResponse(response);
    }

    async saveInspectionResult(data) {
        const response = await fetch(`${API_URL}/detection/save-inspection`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this._handleResponse(response);
    }
    
    // (Añadí el resto de los métodos por completitud, todos usando el _handleResponse)
    async getUserPerformance() {
        const response = await fetch(`${API_URL}/dashboard/user-performance`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this._handleResponse(response);
    }
    
    async getUserHistory(page = 1, perPage = 20, status = null) {
        let url = `${API_URL}/history/user?page=${page}&per_page=${perPage}`;
        if (status) url += `&status=${status}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this._handleResponse(response);
    }
}

// Instancia global de API
const api = new API();