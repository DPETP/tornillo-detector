// =================================================================
//          ADMIN.JS - VERSIÓN FINAL Y A PRUEBA DE FALLOS
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM listo. Inicializando panel de administración...");

    // Estado de la aplicación
    const state = { currentUserId: null, currentModelId: null, allUsers: [], allModels: [], allEngines: [], settings: {} };
    const API_URL = '/api/admin';
    const authToken = localStorage.getItem('accessToken');

    // Función para aplicar permisos según el rol - DEFINITIVO
    function applyRolePermissions() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.role) return;

            console.log(`Aplicando permisos para rol: ${user.role}`);

            // OPERARIO: No tiene acceso a configuración, redirigir inmediatamente
            if (user.role === 'operario') {
                console.warn('Operario sin permisos, redirigiendo a detección...');
                window.location.href = '/detection';
                return;
            }

            // SOPORTE TÉCNICO: Ocultar sección de Motores IA
            if (user.role === 'soporte_tecnico') {
                const motoresMenuItem = document.querySelector('[data-section="motores"]');
                const motoresSection = document.getElementById('motores');
                
                if (motoresMenuItem) motoresMenuItem.style.display = 'none';
                if (motoresSection) motoresSection.style.display = 'none';

                console.log('Sección de Motores IA ocultada para Soporte Técnico');
            }

            // ADMIN: Tiene acceso completo (no se oculta nada)
        } catch (error) {
            console.error('Error aplicando permisos de rol:', error);
        }
    }

    // Función principal para iniciar todo
    async function initializeApp() {
        // Asignamos los listeners PRIMERO. Si falla aquí, sabremos por qué.
        try {
            setupEventListeners();
            console.log("Todos los event listeners han sido asignados correctamente.");
        } catch (error) {
            console.error("FALLO CRÍTICO al asignar event listeners:", error);
            showAlert("Error grave en la interfaz. Contacte a soporte.", "danger");
            return; // Detener la ejecución si la UI básica no funciona
        }
        
        // Aplicar permisos de rol antes de cargar datos
        applyRolePermissions();
        
        // LUEGO cargamos todos los datos y renderizamos
        await api.reloadData();
    }

    // Función robusta para asignar eventos
    function setupEventListeners() {
        // Función de utilidad para añadir listeners de forma segura
        const addSafeListener = (selector, event, handler) => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.error(`Elemento no encontrado para el selector: ${selector}`);
            }
        };

        // Asignación segura de todos los eventos
        addSafeListener('.menu', 'click', e => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) switchSection(menuItem.dataset.section);
        });
        addSafeListener('.logout-btn', 'click', () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            window.location.href = '/';
        });
        addSafeListener('[data-action="open-user-modal"]', 'click', () => openModal('userModal'));
        addSafeListener('[data-action="open-model-modal"]', 'click', () => openModal('modelModal'));
        addSafeListener('[data-action="open-engine-modal"]', 'click', () => openModal('engineModal'));
        
        document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
            btn.addEventListener('click', e => e.target.closest('.modal').classList.remove('active'));
        });

        addSafeListener('#userForm', 'submit', handleUserSubmit);
        addSafeListener('#modelForm', 'submit', handleModelSubmit);
        addSafeListener('#engineForm', 'submit', handleEngineSubmit);
        addSafeListener('#btn-guardar-settings', 'click', updateConfiguration);

        // Delegación de eventos para las tablas (ya es seguro por diseño)
        addSafeListener('main', 'click', handleTableActions);
    }
    
    // (A partir de aquí, el resto del código que ya teníamos y funcionaba)
    function handleTableActions(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        const id = parseInt(button.dataset.id);
        const actions = {
            'edit-user': () => openModal('userModal', state.allUsers.find(u => u.id === id)),
            'toggle-user-status': () => {
                const user = state.allUsers.find(u => u.id === id);
                if (confirm(`¿${user.is_active ? 'Desactivar' : 'Activar'} usuario ${user.username}?`)) api.toggleUserStatus(id);
            },
            'delete-user': () => { if (confirm('¡ADVERTENCIA! ¿ELIMINAR usuario permanentemente?')) api.deleteUser(id); },
            'edit-model': () => openModal('modelModal', state.allModels.find(m => m.id === id)),
            'delete-model': () => { if (confirm('¿Eliminar (desactivar) modelo?')) api.deleteModel(id); },
            'activate-engine': () => api.activateEngine(id),
            'delete-engine': () => {
                const engine = state.allEngines.find(e => e.id === id);
                if (confirm(`¿Eliminar motor ${engine.tipo} v${engine.version}?\n\nEsto eliminará el registro y el archivo de entrenamiento (.pt/.pth/.weights) permanentemente.`)) {
                    api.deleteEngine(id);
                }
            },
        };
        if (actions[action]) actions[action]();
    }

    async function handleUserSubmit(e) { e.preventDefault(); const data = { username: document.getElementById('username').value, email: document.getElementById('email').value, password: document.getElementById('password').value, role: document.getElementById('role').value, team: document.getElementById('team').value }; await api.saveUser(state.currentUserId, data); }
    async function handleModelSubmit(e) { e.preventDefault(); const data = { nombre: document.getElementById('nombre-modelo').value, descripcion: document.getElementById('descripcion-modelo').value, target_tornillos: parseInt(document.getElementById('target-tornillos').value), confidence_threshold: parseFloat(document.getElementById('confidence-threshold').value), inspection_cycle_time: parseInt(document.getElementById('inspection-cycle-time').value), motor_inferencia_id: parseInt(document.getElementById('motor-select').value) }; await api.saveModel(state.currentModelId, data); }
    async function handleEngineSubmit(e) { e.preventDefault(); const form = document.getElementById('engineForm'); if (form.querySelector('#engine-file').files.length === 0) { showAlert('Por favor, selecciona un archivo .pt', 'danger'); return; } const formData = new FormData(form); await api.saveEngine(formData); }

    function switchSection(sectionId) { document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active-section')); document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active')); document.getElementById(sectionId).classList.add('active-section'); document.querySelector(`[data-section="${sectionId}"]`).classList.add('active'); }
    function openModal(modalId, entity = null) {
        const modal = document.getElementById(modalId);
        const form = modal.querySelector('form');
        const title = modal.querySelector('h2');
        form.reset();
        const openActions = {
            'userModal': () => { title.textContent = entity ? 'Editar Usuario' : 'Crear Usuario'; state.currentUserId = entity ? entity.id : null; if (entity) { form.querySelector('#username').value = entity.username; form.querySelector('#email').value = entity.email; form.querySelector('#role').value = entity.role; form.querySelector('#team').value = entity.team; } },
            'modelModal': () => { title.textContent = entity ? 'Editar Modelo AA' : 'Crear Modelo AA'; state.currentModelId = entity ? entity.id : null; if (entity) { form.querySelector('#nombre-modelo').value = entity.nombre; form.querySelector('#descripcion-modelo').value = entity.descripcion; form.querySelector('#target-tornillos').value = entity.target_tornillos; form.querySelector('#confidence-threshold').value = entity.confidence_threshold; form.querySelector('#inspection-cycle-time').value = entity.inspection_cycle_time; form.querySelector('#motor-select').value = entity.motor_inferencia_id; } },
            'engineModal': () => { title.textContent = 'Cargar Motor IA'; }
        };
        if (openActions[modalId]) { openActions[modalId](); modal.classList.add('active'); }
    }
    function showAlert(message, type = 'success') { const container = document.getElementById('alerts-container'); const alertDiv = document.createElement('div'); alertDiv.className = `alert alert-${type}`; alertDiv.textContent = message; container.appendChild(alertDiv); setTimeout(() => alertDiv.remove(), 4000); }
    function renderAll() {
        const usuariosTbody = document.getElementById('usuarios-tbody'); if (usuariosTbody) usuariosTbody.innerHTML = state.allUsers.map(user => { const isActive = user.is_active; const toggleButtonClass = isActive ? 'warning' : 'success'; const toggleButtonText = isActive ? 'Desactivar' : 'Activar'; return `<tr><td>${user.username}</td><td>${user.email}</td><td>${user.role}</td><td>${user.team}</td><td><span class="badge ${isActive ? 'success' : 'danger'}">${isActive ? 'Activo' : 'Inactivo'}</span></td><td><button class="btn btn-sm" data-action="edit-user" data-id="${user.id}">Editar</button><button class="btn btn-sm ${toggleButtonClass}" data-action="toggle-user-status" data-id="${user.id}">${toggleButtonText}</button><button class="btn btn-sm danger" data-action="delete-user" data-id="${user.id}">Eliminar</button></td></tr>`; }).join('');
        const motoresTbody = document.getElementById('motores-tbody'); if (motoresTbody) motoresTbody.innerHTML = state.allEngines.map(engine => `<tr><td>${engine.tipo}</td><td>${engine.version}</td><td>${(engine.tamaño_archivo / 1024 / 1024).toFixed(2)}</td><td><span class="badge ${engine.activo ? 'success' : 'warning'}">${engine.activo ? 'Activo' : 'Inactivo'}</span></td><td>${!engine.activo ? `<button class="btn btn-sm success" data-action="activate-engine" data-id="${engine.id}">Activar</button> <button class="btn btn-sm danger" data-action="delete-engine" data-id="${engine.id}">Eliminar</button>` : '<span>✓ Activo</span>'}</td></tr>`).join('');
        const modelosTbody = document.getElementById('modelos-tbody'); if (modelosTbody) { const activeModelId = state.settings.ac_model_activo_id; modelosTbody.innerHTML = state.allModels.map(model => { const isCurrentlyActive = model.id === activeModelId; const activeIndicator = isCurrentlyActive ? '<span class="active-indicator">★ En Uso</span>' : ''; return `<tr><td>${model.nombre} ${activeIndicator}</td><td>${model.target_tornillos}</td><td>${model.confidence_threshold}</td><td>${model.inspection_cycle_time}s</td><td>${state.allEngines.find(e => e.id === model.motor_inferencia_id)?.tipo || 'N/A'}</td><td><span class="badge ${model.activo ? 'success' : 'danger'}">${model.activo ? 'Activo' : 'Inactivo'}</span></td><td><button class="btn btn-sm" data-action="edit-model" data-id="${model.id}">Editar</button><button class="btn btn-sm danger" data-action="delete-model" data-id="${model.id}">Eliminar</button></td></tr>`; }).join('');}
        const motorSelect = document.getElementById('motor-select'); if (motorSelect) motorSelect.innerHTML = `<option value="">-- Seleccionar --</option>` + state.allEngines.map(e => `<option value="${e.id}">${e.tipo} v${e.version}</option>`).join('');
        const modeloActivoSelect = document.getElementById('modelo-activo'); if (modeloActivoSelect) { modeloActivoSelect.innerHTML = `<option value="">-- Seleccionar --</option>` + state.allModels.filter(m => m.activo).map(m => `<option value="${m.id}">${m.nombre}</option>`).join(''); if (state.settings.ac_model_activo_id) modeloActivoSelect.value = state.settings.ac_model_activo_id; }
    }
    async function updateConfiguration() { const data = { ac_model_activo_id: document.getElementById('modelo-activo').value ? parseInt(document.getElementById('modelo-activo').value) : null, permitir_registro_publico: document.getElementById('registro-publico').checked }; const result = await api.makeRequest('/settings', 'PUT', data); if (result) { showAlert('Configuración guardada.'); state.settings = result.data; renderAll(); } }
    const api = {
        makeRequest: async (endpoint, method = 'GET', data = null, isFormData = false) => { const options = { method, headers: { 'Authorization': `Bearer ${authToken}` } }; if (!isFormData) { options.headers['Content-Type'] = 'application/json'; if (data) options.body = JSON.stringify(data); } else { if (data) options.body = data; } try { const response = await fetch(`${API_URL}${endpoint}`, options); const result = await response.json(); if (!response.ok) { showAlert(result.message || result.error || 'Error', 'danger'); return null; } return result; } catch (error) { showAlert('Error de red: ' + error.message, 'danger'); return null; } },
        reloadData: async () => { const settingsResult = await api.makeRequest('/settings'); if (settingsResult) state.settings = settingsResult.data; await Promise.all([ api.makeRequest('/users').then(r => state.allUsers = r?.data || []), api.makeRequest('/inference-engines').then(r => state.allEngines = r?.data || []) ]); await api.makeRequest('/ac-models').then(r => state.allModels = r?.data || []); renderAll(); },
        saveUser: async (id, data) => { const result = await api.makeRequest(id ? `/users/${id}` : '/users', id ? 'PUT' : 'POST', data); if (result) { document.getElementById('userModal').classList.remove('active'); showAlert(result.message || 'Usuario guardado.'); await api.reloadData(); } },
        saveModel: async (id, data) => { const result = await api.makeRequest(id ? `/ac-models/${id}` : '/ac-models', id ? 'PUT' : 'POST', data); if (result) { document.getElementById('modelModal').classList.remove('active'); showAlert(result.message || 'Modelo guardado.'); await api.reloadData(); } },
        saveEngine: async (formData) => { const result = await api.makeRequest('/inference-engines', 'POST', formData, true); if (result) { document.getElementById('engineModal').classList.remove('active'); showAlert(result.message || 'Motor cargado.'); await api.reloadData(); } },
        toggleUserStatus: async (id) => { const result = await api.makeRequest(`/users/${id}/toggle-status`, 'POST'); if (result) { showAlert(result.message); await api.reloadData(); } },
        deleteUser: async (id) => { const result = await api.makeRequest(`/users/${id}`, 'DELETE'); if (result) { showAlert(result.message); await api.reloadData(); } },
        deleteModel: async (id) => { const result = await api.makeRequest(`/ac-models/${id}`, 'DELETE'); if (result) { showAlert('Modelo eliminado (desactivado).'); await api.reloadData(); } },
        activateEngine: async (id) => { const result = await api.makeRequest(`/inference-engines/${id}/activate`, 'POST'); if (result) { showAlert(result.message); await api.reloadData(); } },
        deleteEngine: async (id) => { const result = await api.makeRequest(`/inference-engines/${id}`, 'DELETE'); if (result) { showAlert(result.message); await api.reloadData(); } },
    };
    
    initializeApp();
});