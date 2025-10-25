const API_URL = 'http://localhost:5000/api/admin';
let currentUserId = null;
let currentModelId = null;
let authToken = localStorage.getItem('token');

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadModels();
    loadEngines();
    loadSettings();
    
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchSection(e.target.closest('.menu-item').dataset.section);
        });
    });
});

// ============================================================
// UTILIDADES
// ============================================================

function switchSection(sectionId) {
    document.querySelectorAll('.config-section').forEach(s => {
        s.classList.remove('active-section');
    });
    
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active-section');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alerts-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
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
            showAlert(result.message || result.error, 'danger');
            return null;
        }
        
        return result;
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
        return null;
    }
}

// ============================================================
// GESTIÓN DE USUARIOS
// ============================================================

async function loadUsers() {
    const result = await makeRequest('/users');
    if (!result) return;
    
    const tbody = document.getElementById('usuarios-tbody');
    tbody.innerHTML = '';
    
    result.data.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-info">${user.role}</span></td>
            <td>${user.team}</td>
            <td>
                ${user.is_active ? 
                    '<span class="badge badge-success">Activo</span>' : 
                    '<span class="badge badge-danger">Inactivo</span>'
                }
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deactivateUser(${user.id})">Dar de Baja</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openUserModal() {
    currentUserId = null;
    document.getElementById('userForm').reset();
    document.getElementById('userModalTitle').textContent = 'Crear Usuario';
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function saveUser(e) {
    e.preventDefault();
    
    const data = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        role: document.getElementById('role').value,
        team: document.getElementById('team').value
    };
    
    let endpoint = '/users';
    let method = 'POST';
    
    if (currentUserId) {
        endpoint = `/users/${currentUserId}`;
        method = 'PUT';
        if (!data.password) delete data.password;
    }
    
    const result = await makeRequest(endpoint, method, data);
    if (result) {
        showAlert(result.message, 'success');
        closeUserModal();
        loadUsers();
    }
}

async function editUser(userId) {
    const result = await makeRequest('/users');
    if (!result) return;
    
    const user = result.data.find(u => u.id === userId);
    
    if (user) {
        currentUserId = userId;
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email;
        document.getElementById('role').value = user.role;
        document.getElementById('team').value = user.team;
        document.getElementById('password').value = '';
        document.getElementById('userModalTitle').textContent = 'Editar Usuario';
        document.getElementById('userModal').classList.add('active');
    }
}

async function deactivateUser(userId) {
    if (!confirm('¿Estás seguro de dar de baja este usuario?')) return;
    
    const result = await makeRequest(`/users/${userId}/deactivate`, 'POST');
    if (result) {
        showAlert(result.message, 'success');
        loadUsers();
    }
}

// ============================================================
// GESTIÓN DE MODELOS AA
// ============================================================

async function loadModels() {
    const result = await makeRequest('/ac-models');
    if (!result) return;
    
    const tbody = document.getElementById('modelos-tbody');
    tbody.innerHTML = '';
    
    result.data.forEach(model => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${model.nombre}</td>
            <td>${model.target_tornillos}</td>
            <td>${(model.confidence_threshold * 100).toFixed(0)}%</td>
            <td>${model.motor_inferencia_id}</td>
            <td>
                ${model.activo ? 
                    '<span class="badge badge-success">Activo</span>' : 
                    '<span class="badge badge-danger">Inactivo</span>'
                }
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editModel(${model.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteModel(${model.id})">Eliminar</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const select = document.getElementById('modelo-activo');
    select.innerHTML = '<option value="">-- Seleccionar Modelo --</option>';
    result.data.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.nombre;
        select.appendChild(option);
    });
}

function openModelModal() {
    currentModelId = null;
    document.getElementById('modelForm').reset();
    document.getElementById('modelModal').classList.add('active');
}

function closeModelModal() {
    document.getElementById('modelModal').classList.remove('active');
}

async function saveModel(e) {
    e.preventDefault();
    
    const data = {
        nombre: document.getElementById('nombre-modelo').value,
        descripcion: document.getElementById('descripcion-modelo').value,
        target_tornillos: parseInt(document.getElementById('target-tornillos').value),
        confidence_threshold: parseFloat(document.getElementById('confidence-threshold').value),
        motor_inferencia_id: parseInt(document.getElementById('motor-select').value)
    };
    
    let endpoint = '/ac-models';
    let method = 'POST';
    
    if (currentModelId) {
        endpoint = `/ac-models/${currentModelId}`;
        method = 'PUT';
    }
    
    const result = await makeRequest(endpoint, method, data);
    if (result) {
        showAlert(result.message, 'success');
        closeModelModal();
        loadModels();
    }
}

async function editModel(modelId) {
    const result = await makeRequest('/ac-models');
    if (!result) return;
    
    const model = result.data.find(m => m.id === modelId);
    if (model) {
        currentModelId = modelId;
        document.getElementById('nombre-modelo').value = model.nombre;
        document.getElementById('descripcion-modelo').value = model.descripcion;
        document.getElementById('target-tornillos').value = model.target_tornillos;
        document.getElementById('confidence-threshold').value = model.confidence_threshold;
        document.getElementById('motor-select').value = model.motor_inferencia_id;
        openModelModal();
    }
}

async function deleteModel(modelId) {
    if (!confirm('¿Estás seguro de eliminar este modelo?')) return;
    
    const result = await makeRequest(`/ac-models/${modelId}`, 'DELETE');
    if (result) {
        showAlert(result.message, 'success');
        loadModels();
    }
}

// ============================================================
// GESTIÓN DE MOTORES IA
// ============================================================

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
            <td>
                ${engine.activo ? 
                    '<span class="badge badge-success">Activo</span>' : 
                    '<span class="badge badge-warning">Inactivo</span>'
                }
            </td>
            <td>
                <div class="action-buttons">
                    ${!engine.activo ? 
                        `<button class="btn btn-sm btn-success" onclick="activateEngine(${engine.id})">Activar</button>` : 
                        '<span style="color: green; font-weight: bold;">✓ Activo</span>'
                    }
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const select = document.getElementById('motor-select');
    select.innerHTML = '<option value="">-- Seleccionar Motor --</option>';
    result.data.forEach(engine => {
        const option = document.createElement('option');
        option.value = engine.id;
        option.textContent = `${engine.tipo} v${engine.version}`;
        select.appendChild(option);
    });
}

function openEngineModal() {
    document.getElementById('engineForm').reset();
    document.getElementById('engineModal').classList.add('active');
}

function closeEngineModal() {
    document.getElementById('engineModal').classList.remove('active');
}

async function saveEngine(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('tipo', document.getElementById('engine-type').value);
    formData.append('version', document.getElementById('engine-version').value);
    formData.append('descripcion', document.getElementById('engine-desc').value);
    formData.append('archivo', document.getElementById('engine-file').files[0]);
    formData.append('activo', 'false');
    
    try {
        const response = await fetch(`${API_URL}/inference-engines`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message, 'success');
            closeEngineModal();
            loadEngines();
        } else {
            showAlert(result.error || 'Error al cargar motor', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    }
}

async function activateEngine(engineId) {
    const result = await makeRequest(`/inference-engines/${engineId}/activate`, 'POST');
    if (result) {
        showAlert(result.message, 'success');
        loadEngines();
    }
}

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

async function loadSettings() {
    const result = await makeRequest('/settings');
    if (!result) return;
    
    if (result.data.ac_model_activo_id) {
        document.getElementById('modelo-activo').value = result.data.ac_model_activo_id;
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
        showAlert('Configuración actualizada', 'success');
    }
}

// ============================================================
// LOGOUT
// ============================================================

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}