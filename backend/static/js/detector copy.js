// =================================================================
// REEMPLAZA EL CONTENIDO COMPLETO DE backend/static/js/detector.js
// =================================================================
let camera = null;
let isStreamingActive = false;
let recentFrames = [];

document.addEventListener('DOMContentLoaded', () => {
    // --- GUARDIÁN DE RUTA CORREGIDO ---
    // Si no hay token, no debería estar aquí. Redirigir al login.
    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/'; // USAR RUTA RAÍZ ABSOLUTA
        return; // Detener ejecución del resto del script
    }

    // Si el código llega aquí, el usuario está autenticado.
    setupEventListeners();
    displayUserInfo();
});

function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', startCamera);
    document.getElementById('stopBtn').addEventListener('click', stopCamera);
    
    // Asumo que tienes un botón de logout en la página de detección también
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

function displayUserInfo() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            const userNameEl = document.getElementById('userName');
            const userTeamEl = document.getElementById('userTeam');
            if (userNameEl) userNameEl.textContent = user.username;
            if (userTeamEl) userTeamEl.textContent = user.team;
        }
    } catch (e) {
        console.error("Error parsing user data from localStorage", e);
        // Si los datos del usuario están corruptos, es mejor desloguear
        logout();
    }
}

// ... (El resto de tus funciones: startCamera, streamFrames, processFrame, etc. están bien, no necesitan cambios)
async function startCamera() {
    try {
        const canvas = document.getElementById('captureCanvas');
        const ctx = canvas.getContext('2d');
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });

        canvas.width = 640;
        canvas.height = 480;

        isStreamingActive = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;

        streamFrames(video, canvas, ctx);
    } catch (error) {
        console.error('Error accediendo a la cámara:', error);
        alert('No se pudo acceder a la cámara. Verifica los permisos.');
    }
}

function streamFrames(video, canvas, ctx) {
    if (!isStreamingActive) return;

    try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.log('Frame no listo aún');
    }
    
    setTimeout(() => {
        processFrame(canvas);
        streamFrames(video, canvas, ctx);
    }, 500);
}

async function processFrame(canvas) {
    try {
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        const response = await api.processFrame(imageData);

        if (response.success) {
            updateDetectionUI(response);
            addToRecentFrames(response);
        }
    } catch (error) {
        console.error('Error procesando frame:', error);
    }
}

function updateDetectionUI(response) {
    const statusBadge = document.getElementById('statusBadge');
    
    statusBadge.textContent = response.status;
    statusBadge.className = `status-badge-large ${response.status.toLowerCase()}`;
}

function addToRecentFrames(detection) {
    recentFrames.unshift({
        id: detection.detection_id,
        status: detection.status,
        confidence: detection.detections.length > 0 
            ? Math.max(...detection.detections.map(d => d.confidence)) 
            : 0,
        count: detection.detections.length,
        timestamp: new Date()
    });

    if (recentFrames.length > 12) {
        recentFrames.pop();
    }

    updateFramesDisplay();
}

function updateFramesDisplay() {
    const container = document.getElementById('framesContainer');
    container.innerHTML = '';

    if (recentFrames.length === 0) {
        container.innerHTML = '<div class="frame-placeholder"><p>No hay capturas</p></div>';
        return;
    }

    recentFrames.forEach((frame, index) => {
        const frameDiv = document.createElement('div');
        frameDiv.className = `frame-item ${frame.status.toLowerCase()}`;
        frameDiv.innerHTML = `
            <div class="frame-label ${frame.status.toLowerCase()}">
                ${frame.status} ${(frame.confidence * 100).toFixed(0)}%
            </div>
        `;
        container.appendChild(frameDiv);
    });
}

function stopCamera() {
    isStreamingActive = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;

    const canvas = document.getElementById('captureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const video = document.querySelector('video');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}


// --- FUNCIÓN DE LOGOUT CENTRALIZADA ---
function logout() {
    if (isStreamingActive) {
        stopCamera();
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = '/'; // Redirigir a la raíz (login)
}