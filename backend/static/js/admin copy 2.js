backend/static/js/admin.js


// --- UTILIDADES ---
function switchSection(sectionId) {
    document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active-section');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alerts-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

async function makeRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();
        if (!response.ok) {
            showAlert(result.message || result.error || 'Error desconocido', 'danger');
            return null;
        }
        return result;
    } catch (error) {
        showAlert('Error de conexión: ' + error.message, 'danger');
        return null;
    }
}

// --- GESTIÓN DE USUARIOS (Funciones de Lógica) ---
async function loadUsers() { /* ... Tu código de loadUsers está bien ... */ }
function openUserModal() { /* ... Tu código de openUserModal está bien ... */ }
function closeUserModal() { /* ... Tu código de closeUserModal está bien ... */ }
async function saveUser(e) { /* ... Tu código de saveUser está bien ... */ }
window.editUser = async function(userId) { /* ... Tu código de editUser es funcional, aunque ineficiente. Lo mantenemos por ahora ... */ }
window.deactivateUser = async function(userId) { /* ... Tu código de deactivateUser está bien ... */ }


// --- GESTIÓN DE MODELOS AA ---
async function loadModels() {
    const result = await makeRequest('/ac-models');
    if (!result) return;
    
    const tbody = document.getElementById('modelos-tbody');
    tbody.innerHTML = ''; // Limpiar la tabla
    result.data.forEach(model => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${model.nombre}</td>
            <td>${model.target_tornillos}</td>
            <td>${(model.confidence_threshold * 100).toFixed(0)}%</td>
            <td>Motor ID: ${model.motor_inferencia_id}</td>
            <td>${model.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editModel(${model.id})">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteModel(${model.id})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Poblar el dropdown de Configuración Global
    const select = document.getElementById('modelo-activo');
    select.innerHTML = '<option value="">-- Seleccionar Modelo --</option>';
    result.data.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.nombre;
        select.appendChild(option);
    });

    // Recargar la configuración actual por si el modelo activo cambió
    loadSettings();
}
function openModelModal() { /* ... Tu código de openModelModal está bien ... */ }
function closeModelModal() { /* ... Tu código de closeModelModal está bien ... */ }
async function saveModel(e) { /* ... Tu código de saveModel está bien ... */ }
window.editModel = async function(modelId) { /* ... Tu código de editModel es funcional, aunque ineficiente. Lo mantenemos por ahora ... */ }
window.deleteModel = async function(modelId) { /* ... Tu código de deleteModel está bien ... */ }


// --- GESTIÓN DE MOTORES IA ---
async function loadEngines() {
    const result = await makeRequest('/inference-engines');
    if (!result) return;

    const tbody = document.getElementById('motores-tbody');
    tbody.innerHTML = '';
    result.data.forEach(engine => {
        const row = document.createElement('tr');
        const sizeInMB = (engine.tamaño_archivo / (1024 * 1024)).toFixed(2);
        row.innerHTML = `
            <td>${engine.tipo}</td>
            <td>${engine.version}</td>
            <td>${sizeInMB} MB</td>
            <td>${engine.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-warning">Inactivo</span>'}</td>
            <td>
                ${!engine.activo ? `<button class="btn btn-sm btn-success" onclick="activateEngine(${engine.id})">Activar</button>` : '<span>✓ Activo</span>'}
            </td>
        `;
        tbody.appendChild(row);
    });

    // Poblar el dropdown en el modal de "Crear Modelo AA"
    const select = document.getElementById('motor-select');
    select.innerHTML = '<option value="">-- Seleccionar Motor --</option>';
    result.data.forEach(engine => {
        const option = document.createElement('option');
        option.value = engine.id;
        option.textContent = `${engine.tipo} v${engine.version}`;
        select.appendChild(option);
    });
}
function openEngineModal() { /* ... Tu código de openEngineModal está bien ... */ }
function closeEngineModal() { /* ... Tu código de closeEngineModal está bien ... */ }
async function saveEngine(e) { /* ... Tu código de saveEngine está bien ... */ }
window.activateEngine = async function(engineId) { /* ... Tu código de activateEngine está bien ... */ }


// --- CONFIGURACIÓN GLOBAL ---
async function loadSettings() {
    const result = await makeRequest('/settings');
    if (!result || !result.data) return;
    
    // Seleccionar el valor correcto en el dropdown
    const modelSelect = document.getElementById('modelo-activo');
    if (result.data.ac_model_activo_id) {
        modelSelect.value = result.data.ac_model_activo_id;
    } else {
        modelSelect.value = "";
    }
    
    document.getElementById('registro-publico').checked = result.data.permitir_registro_publico || false;
}

async function updateConfiguration() {
    const modelId = document.getElementById('modelo-activo').value;
    const data = {
        ac_model_activo_id: modelId ? parseInt(modelId) : null,
        permitir_registro_publico: document.getElementById('registro-publico').checked
    };
    
    const result = await makeRequest('/settings', 'PUT', data);
    if (result) {
        showAlert('Configuración actualizada exitosamente', 'success');
    }
}

// --- LOGOUT (CORREGIDO) ---
function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = '/'; // Redirigir a la página de login
}
// Hacemos algunas funciones globales para que los onclick que puedan quedar funcionen.
// Es mejor eliminarlos, pero esto da retrocompatibilidad.
window.editUser = async function(userId) { /* ... */ };
window.deactivateUser = async function(userId) { /* ... */ };
window.editModel = async function(modelId) { /* ... */ };
window.deleteModel = async function(modelId) { /* ... */ };
window.activateEngine = async function(engineId) { /* ... */ };
// Hacemos algunas funciones globales para que los onclick restantes funcionen
// Esta es una solución temporal mientras se refactoriza por completo a event listeners
window.loadUsers = loadUsers;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.deactivateUser = deactivateUser;

window.loadModels = loadModels;
window.openModelModal = openModelModal;
window.closeModelModal = closeModelModal;
window.saveModel = saveModel;
window.deleteModel = deleteModel;

window.loadEngines = loadEngines;
window.openEngineModal = openEngineModal;
window.closeEngineModal = closeEngineModal;
window.saveEngine = saveEngine;

window.updateConfiguration = updateConfiguration;
window.logout = logout;