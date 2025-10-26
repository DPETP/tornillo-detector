// =================================================================
//          API.JS - VERSIÓN FINAL Y 100% CORREGIDA
// Corregido el error de sintaxis de las comillas (template literals)
// =================================================================

const API_URL = '/api'; // Usar una ruta relativa es más robusto

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

    // Método de utilidad para manejar las respuestas de fetch
    async _handleResponse(response) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            console.error(`Error de API (${response.status}):`, errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        // --- ¡AQUÍ ESTABA EL ERROR PRINCIPAL! ---
        // Se usaban comillas simples en lugar de comillas invertidas.
        const response = await fetch(`${API_URL}/detection/process-frame`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ frame: frameData })
        });
        return this._handleResponse(response);
    }
    
    // DASHBOARD ENDPOINTS
    async getDashboardOverview() {
        const response = await fetch(`${API_URL}/dashboard/overview`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this._handleResponse(response);
    }

    // --- MÉTODOS RESTANTES (Corregidos por si acaso, aunque no se usen aún) ---
    
    async getProfile() {
        const response = await fetch(`${API_URL}/auth/me`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this._handleResponse(response);
    }

    async getDetectionHistory(limit = 50) {
        const response = await fetch(`${API_URL}/detection/history/${limit}`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return this._handleResponse(response);
    }

    async getTeamStats() {
        const response = await fetch(`${API_URL}/dashboard/team-stats`, {
            method: 'GET',
            headers: this.getHeaders()
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