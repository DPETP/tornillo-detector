// =================================================================
// CÓDIGO COMPLETO PARA backend/static/js/dashboard.js
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('accessToken')) {
        return; // Detenido por authGuard, pero es una doble seguridad.
    }
    initializeDashboard();
});

/**
 * Función principal que orquesta la inicialización del dashboard.
 */
function initializeDashboard() {
    console.log("Inicializando el dashboard...");
    displayUserInfo();
    fetchDashboardData();
    setupChartPlaceholders();
}

/**
 * Muestra el nombre de usuario y el equipo en la barra lateral.
 */
function displayUserInfo() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            // IDs tomados de tu HTML
            const userNameEl = document.getElementById('user-info-name');
            const userTeamEl = document.getElementById('user-info-team');
            if (userNameEl) userNameEl.textContent = user.username;
            if (userTeamEl) userTeamEl.textContent = user.team;
        }
    } catch (e) {
        console.error("Error al leer datos del usuario desde localStorage:", e);
    }
}

/**
 * Llama a la API para obtener las estadísticas y actualiza la UI.
 */
async function fetchDashboardData() {
    try {
        const overviewData = await api.getDashboardOverview();

        if (overviewData && overviewData.success) {
            updateKpiCards(overviewData.data);
        } else {
            console.error("La respuesta de la API para el overview no fue exitosa:", overviewData);
        }
    } catch (error) {
        console.error("Error fatal al obtener datos del dashboard:", error);
    }
}

/**
 * Actualiza las tarjetas de KPIs con los datos recibidos de la API.
 */
function updateKpiCards(data) {
    // IDs tomados de tu HTML
    document.getElementById('kpi-inspeccionados').textContent = data.total_inspections || 0;
    document.getElementById('kpi-pass').textContent = data.passed || 0;
    document.getElementById('kpi-fail').textContent = data.failed || 0;
    document.getElementById('kpi-latencia').textContent = `${(data.average_inference_time || 0).toFixed(2)} s`;
}

/**
 * Prepara los contenedores de los gráficos para el futuro.
 */
function setupChartPlaceholders() {
    // IDs de los canvas tomados de tu HTML
    renderPlaceholder(document.getElementById('quarterChart'), 'Detecciones por Quarter');
    renderPlaceholder(document.getElementById('distributionChart'), 'Distribución');
    renderPlaceholder(document.getElementById('trendChart'), 'Tendencia Mensual');
}

/**
 * Función de utilidad para renderizar un mensaje en un canvas.
 */
function renderPlaceholder(canvas, text) {
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.textAlign = 'center';
        ctx.fillStyle = '#AAA';
        ctx.font = '16px Arial';
        ctx.fillText(`${text} (Próximamente)`, canvas.width / 2, canvas.height / 2);
    }
}