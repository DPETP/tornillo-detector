// =================================================================
//          ADMIN.JS - VERSIÓN FINAL, COMPLETA Y FUNCIONAL
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM listo. Inicializando panel de administración...");

    // -----------------------------------------------------------------
    // 1. ESTADO DE LA APLICACIÓN
    // -----------------------------------------------------------------
    const state = {
        currentUserId: null,
        currentModelId: null,
        allUsers: [],
        allModels: [],
        allEngines: [],
        settings: {} // Para guardar la configuración global
    };
    
    const API_URL = '/api/admin';
    const authToken = localStorage.getItem('accessToken');

    // -----------------------------------------------------------------
    // 2. REFERENCIAS AL DOM
    // -----------------------------------------------------------------
    const ui = {
        usuariosTbody: document.getElementById('usuarios-tbody'),
        modelosTbody: document.getElementById('modelos-tbody'),
        motoresTbody: document.getElementById('motores-tbody'),
        userModal: document.getElementById('userModal'),
        modelModal: document.getElementById('modelModal'),
        engineModal: document.getElementById('engineModal'),
        userForm: document.getElementById('userForm'),
        modelForm: document.getElementById('modelForm'),
        engineForm: document.getElementById('engineForm'),
        modeloActivoSelect: document.getElementById('modelo-activo'),
        registroPublicoCheckbox: document.getElementById('registro-publico'),
        btnGuardarSettings: document.getElementById('btn-guardar-settings')
    };

    // -----------------------------------------------------------------
    // 3. ASIGNACIÓN DE EVENTOS
    // -----------------------------------------------------------------
    function setupEventListeners() {
        document.querySelector('.menu').addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) switchSection(menuItem.dataset.section);
        });

        document.querySelector('.logout-btn').addEventListener('click', () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            window.location.href = '/';
        });

        document.querySelector('[data-action="open-user-modal"]').addEventListener('click', () => openModal('userModal'));
        document.querySelector('[data-action="open-model-modal"]').addEventListener('click', () => openModal('modelModal'));
        document.querySelector('[data-action="open-engine-modal"]').addEventListener('click', () => openModal('engineModal'));

        document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.modal').classList.remove('active'));
        });

        ui.userForm.addEventListener('submit', handleUserSubmit);
        ui.modelForm.addEventListener('submit', handleModelSubmit);
        ui.engineForm.addEventListener('submit', handleEngineSubmit);

        ui.btnGuardarSettings.addEventListener('click', updateConfiguration);

        document.querySelector('main').addEventListener('click', handleTableActions);
        
        console.log("Todos los event listeners han sido asignados.");
    }

    // -----------------------------------------------------------------
    // 4. MANEJADORES DE ACCIONES
    // -----------------------------------------------------------------
    function handleTableActions(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = parseInt(button.dataset.id);

        const actions = {
            'edit-user': () => openModal('userModal', state.allUsers.find(u => u.id === id)),
            'toggle-user-status': () => {
                const user = state.allUsers.find(u => u.id === id);
                const actionText = user.is_active ? 'desactivar' : 'activar';
                if (confirm(`¿Estás seguro de ${actionText} a ${user.username}?`)) {
                    api.toggleUserStatus(id);
                }
            },
            'delete-user': () => {
                if (confirm(`¡ADVERTENCIA! ¿Estás seguro de ELIMINAR permanentemente a este usuario? Esta acción no se puede deshacer.`)) {
                    api.deleteUser(id);
                }
            },
            'edit-model': () => openModal('modelModal', state.allModels.find(m => m.id === id)),
            'delete-model': () => { if (confirm('¿Eliminar modelo (marcar como inactivo)?')) api.deleteModel(id); },
            'activate-engine': () => api.activateEngine(id),
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    async function handleUserSubmit(e) {
        e.preventDefault();
        const data = {
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            role: document.getElementById('role').value,
            team: document.getElementById('team').value,
        };
        await api.saveUser(state.currentUserId, data);
    }

    async function handleModelSubmit(e) {
        e.preventDefault();
        const data = {
            nombre: document.getElementById('nombre-modelo').value,
            descripcion: document.getElementById('descripcion-modelo').value,
            target_tornillos: parseInt(document.getElementById('target-tornillos').value),
            confidence_threshold: parseFloat(document.getElementById('confidence-threshold').value),
            inspection_cycle_time: parseInt(document.getElementById('inspection-cycle-time').value),
            motor_inferencia_id: parseInt(document.getElementById('motor-select').value),
        };
        await api.saveModel(state.currentModelId, data);
    }

    async function handleEngineSubmit(e) {
        e.preventDefault();
        const form = document.getElementById('engineForm');
        if (form.querySelector('#engine-file').files.length === 0) {
            showAlert('Por favor, selecciona un archivo .pt', 'danger');
            return;
        }
        const formData = new FormData(form);
        await api.saveEngine(formData);
    }

    // -----------------------------------------------------------------
    // 5. LÓGICA DE LA APLICACIÓN
    // -----------------------------------------------------------------
    function switchSection(sectionId) {
        document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active-section'));
        document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active-section');
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    }

    function openModal(modalId, entity = null) {
        const modal = document.getElementById(modalId);
        const form = modal.querySelector('form');
        const title = modal.querySelector('h2');
        form.reset();
        
        const openActions = {
            'userModal': () => {
                title.textContent = entity ? 'Editar Usuario' : 'Crear Usuario';
                state.currentUserId = entity ? entity.id : null;
                if (entity) {
                    form.querySelector('#username').value = entity.username;
                    form.querySelector('#email').value = entity.email;
                    form.querySelector('#role').value = entity.role;
                    form.querySelector('#team').value = entity.team;
                }
            },
            'modelModal': () => {
                title.textContent = entity ? 'Editar Modelo AA' : 'Crear Modelo AA';
                state.currentModelId = entity ? entity.id : null;
                if (entity) {
                    form.querySelector('#nombre-modelo').value = entity.nombre;
                    form.querySelector('#descripcion-modelo').value = entity.descripcion;
                    form.querySelector('#target-tornillos').value = entity.target_tornillos;
                    form.querySelector('#confidence-threshold').value = entity.confidence_threshold;
                    form.querySelector('#inspection-cycle-time').value = entity.inspection_cycle_time;
                    form.querySelector('#motor-select').value = entity.motor_inferencia_id;
                }
            },
            'engineModal': () => {
                title.textContent = 'Cargar Motor IA';
            }
        };

        if (openActions[modalId]) {
            openActions[modalId]();
            modal.classList.add('active');
        }
    }

    function showAlert(message, type = 'success') {
        const container = document.getElementById('alerts-container');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        container.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 4000);
    }

    function renderAll() {
        // Render Users
        ui.usuariosTbody.innerHTML = state.allUsers.map(user => {
            const isActive = user.is_active;
            const toggleButtonClass = isActive ? 'warning' : 'success';
            const toggleButtonText = isActive ? 'Desactivar' : 'Activar';
            return `<tr><td>${user.username}</td><td>${user.email}</td><td>${user.role}</td><td>${user.team}</td><td><span class="badge ${isActive ? 'success' : 'danger'}">${isActive ? 'Activo' : 'Inactivo'}</span></td><td><button class="btn btn-sm" data-action="edit-user" data-id="${user.id}">Editar</button><button class="btn btn-sm ${toggleButtonClass}" data-action="toggle-user-status" data-id="${user.id}">${toggleButtonText}</button><button class="btn btn-sm danger" data-action="delete-user" data-id="${user.id}">Eliminar</button></td></tr>`;
        }).join('');

        // Render Engines
        ui.motoresTbody.innerHTML = state.allEngines.map(engine => `<tr><td>${engine.tipo}</td><td>${engine.version}</td><td>${(engine.tamaño_archivo / 1024 / 1024).toFixed(2)}</td><td><span class="badge ${engine.activo ? 'success' : 'warning'}">${engine.activo ? 'Activo' : 'Inactivo'}</span></td><td>${!engine.activo ? `<button class="btn btn-sm success" data-action="activate-engine" data-id="${engine.id}">Activar</button>` : '<span>✓ Activo</span>'}</td></tr>`).join('');

        // Render Models
        const activeModelId = state.settings.ac_model_activo_id;
        ui.modelosTbody.innerHTML = state.allModels.map(model => {
            const isCurrentlyActive = model.id === activeModelId;
            const activeIndicator = isCurrentlyActive ? '<span class="active-indicator">★ En Uso</span>' : '';
            return `<tr><td>${model.nombre} ${activeIndicator}</td><td>${model.target_tornillos}</td><td>${model.confidence_threshold}</td><td>${state.allEngines.find(e => e.id === model.motor_inferencia_id)?.tipo || 'N/A'}</td><td><span class="badge ${model.activo ? 'success' : 'danger'}">${model.activo ? 'Activo' : 'Inactivo'}</span></td><td><button class="btn btn-sm" data-action="edit-model" data-id="${model.id}">Editar</button><button class="btn btn-sm danger" data-action="delete-model" data-id="${model.id}">Eliminar</button></td></tr>`;
        }).join('');

        // Populate dropdowns
        document.getElementById('motor-select').innerHTML = `<option value="">-- Seleccionar --</option>` + state.allEngines.map(e => `<option value="${e.id}">${e.tipo} v${e.version}</option>`).join('');
        ui.modeloActivoSelect.innerHTML = `<option value="">-- Seleccionar --</option>` + state.allModels.filter(m => m.activo).map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
        if (activeModelId) {
            ui.modeloActivoSelect.value = activeModelId;
        }
    }

    async function updateConfiguration() {
        const data = {
            ac_model_activo_id: ui.modeloActivoSelect.value ? parseInt(ui.modeloActivoSelect.value) : null,
            permitir_registro_publico: ui.registroPublicoCheckbox.checked
        };
        const result = await api.makeRequest('/settings', 'PUT', data);
        if (result) {
            showAlert('Configuración guardada con éxito.');
            state.settings = result.data;
            renderAll();
        }
    }

    // -----------------------------------------------------------------
    // 6. LÓGICA DE LA API
    // -----------------------------------------------------------------
    const api = {
        makeRequest: async (endpoint, method = 'GET', data = null, isFormData = false) => {
            const options = { method, headers: { 'Authorization': `Bearer ${authToken}` } };
            if (!isFormData) {
                options.headers['Content-Type'] = 'application/json';
                if (data) options.body = JSON.stringify(data);
            } else {
                if (data) options.body = data;
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
                showAlert('Error de red: ' + error.message, 'danger');
                return null;
            }
        },
        reloadData: async () => {
            const settingsResult = await api.makeRequest('/settings');
            if (settingsResult) state.settings = settingsResult.data;

            await Promise.all([
                api.makeRequest('/users').then(r => state.allUsers = r?.data || []),
                api.makeRequest('/inference-engines').then(r => state.allEngines = r?.data || [])
            ]);
            await api.makeRequest('/ac-models').then(r => state.allModels = r?.data || []);
            
            renderAll();
        },
        saveUser: async (id, data) => {
            const endpoint = id ? `/users/${id}` : '/users';
            const method = id ? 'PUT' : 'POST';
            if (id && !data.password) delete data.password;
            const result = await api.makeRequest(endpoint, method, data);
            if (result) {
                document.getElementById('userModal').classList.remove('active');
                showAlert(result.message || 'Usuario guardado.');
                await api.reloadData();
            }
        },
        saveModel: async (id, data) => {
            const endpoint = id ? `/ac-models/${id}` : '/ac-models';
            const method = id ? 'PUT' : 'POST';
            const result = await api.makeRequest(endpoint, method, data);
            if (result) {
                document.getElementById('modelModal').classList.remove('active');
                showAlert(result.message || 'Modelo guardado.');
                await api.reloadData();
            }
        },
        saveEngine: async (formData) => {
            const result = await api.makeRequest('/inference-engines', 'POST', formData, true);
            if (result) {
                document.getElementById('engineModal').classList.remove('active');
                showAlert(result.message || 'Motor cargado.');
                await api.reloadData();
            }
        },
        toggleUserStatus: async (id) => {
            const result = await api.makeRequest(`/users/${id}/toggle-status`, 'POST');
            if (result) { showAlert(result.message); await api.reloadData(); }
        },
        deleteUser: async (id) => {
            const result = await api.makeRequest(`/users/${id}`, 'DELETE');
            if (result) { showAlert(result.message); await api.reloadData(); }
        },
        deleteModel: async (id) => {
            const result = await api.makeRequest(`/ac-models/${id}`, 'DELETE');
            if (result) { showAlert('Modelo eliminado (desactivado).'); await api.reloadData(); }
        },
        activateEngine: async (id) => {
            const result = await api.makeRequest(`/inference-engines/${id}/activate`, 'POST');
            if (result) { showAlert(result.message); await api.reloadData(); }
        },
    };

    // -----------------------------------------------------------------
    // 7. PUNTO DE ENTRADA
    // -----------------------------------------------------------------
    async function initializeApp() {
        setupEventListeners();
        await api.reloadData();
    }

    initializeApp();
});