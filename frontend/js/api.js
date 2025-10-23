const API_URL = 'http://localhost:5000/api';

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

    // AUTH ENDPOINTS
    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.setToken(data.access_token);
            return data;
        } catch (error) {
            console.error('Error en login:', error);
            throw error;
        }
    }

    async register(username, email, password, phone, team) {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, phone, team })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error en registro:', error);
            throw error;
        }
    }

    async getProfile() {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            throw error;
        }
    }

    // DETECTION ENDPOINTS
    async processFrame(frameData) {
        try {
            const response = await fetch(`${API_URL}/detection/process-frame`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ frame: frameData })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error procesando frame:', error);
            throw error;
        }
    }

    async getDetectionHistory(limit = 50) {
        try {
            const response = await fetch(`${API_URL}/detection/history/${limit}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo histórico:', error);
            throw error;
        }
    }

    // DASHBOARD ENDPOINTS
    async getDashboardOverview() {
        try {
            const response = await fetch(`${API_URL}/dashboard/overview`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo overview:', error);
            throw error;
        }
    }

    async getTeamStats() {
        try {
            const response = await fetch(`${API_URL}/dashboard/team-stats`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo stats:', error);
            throw error;
        }
    }

    async getUserPerformance() {
        try {
            const response = await fetch(`${API_URL}/dashboard/user-performance`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo performance:', error);
            throw error;
        }
    }

    // HISTORY ENDPOINTS
    async getUserHistory(page = 1, perPage = 20, status = null) {
        try {
            let url = `${API_URL}/history/user?page=${page}&per_page=${perPage}`;
            if (status) url += `&status=${status}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo histórico:', error);
            throw error;
        }
    }

    async getTeamHistory(page = 1, perPage = 20, status = null, days = 7) {
        try {
            let url = `${API_URL}/history/team?page=${page}&per_page=${perPage}&days=${days}`;
            if (status) url += `&status=${status}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo histórico del equipo:', error);
            throw error;
        }
    }

    async exportHistory(days = 7) {
        try {
            const response = await fetch(`${API_URL}/history/export?days=${days}`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error exportando:', error);
            throw error;
        }
    }
}

// Instancia global de API
const api = new API();