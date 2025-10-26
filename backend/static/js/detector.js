// =================================================================
// CÓDIGO FINAL Y FUNCIONAL para backend/static/js/detector.js
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO Y REFERENCIAS AL DOM ---
    let stream;
    let isStreamingActive = false;
    let animationFrameId;

    const ui = {
        video: document.getElementById('videoElement'),
        canvas: document.getElementById('canvasOverlay'),
        ctx: document.getElementById('canvasOverlay').getContext('2d'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        statusBadge: document.getElementById('statusBadge'),
        detectionCount: document.getElementById('detectionCount'),
        videoSourceSelect: document.getElementById('videoSourceSelect'),
        spinner: document.getElementById('loading-spinner')
    };

    // --- LÓGICA DE INICIALIZACIÓN ---
    function setupEventListeners() {
        ui.startBtn.addEventListener('click', startDetection);
        ui.stopBtn.addEventListener('click', stopDetection);
        ui.videoSourceSelect.addEventListener('change', startDetection);
    }
    
    // --- LÓGICA DE LA CÁMARA Y DETECCIÓN ---
    async function getCameraDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            ui.videoSourceSelect.innerHTML = '';
            if (videoDevices.length === 0) {
                alert('No se encontraron cámaras.');
                return;
            }

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Cámara ${index + 1}`;
                ui.videoSourceSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error al enumerar dispositivos:", error);
        }
    }

// =================================================================
// REEMPLAZA ESTA FUNCIÓN COMPLETA en backend/static/js/detector.js
// =================================================================
async function startDetection() {
    if (isStreamingActive) {
        stopDetection(); 
    }
    
    isStreamingActive = true;
    ui.startBtn.disabled = true;
    ui.stopBtn.disabled = false;
    ui.spinner.style.display = 'block';
    ui.statusBadge.className = 'status-badge-large processing';
    ui.statusBadge.textContent = 'INICIANDO...';

    const deviceId = ui.videoSourceSelect.value;
    const constraints = { 
        video: { 
            deviceId: deviceId ? { exact: deviceId } : undefined,
            // Pedimos una resolución común para mejorar la compatibilidad
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    };

    console.log("Intentando iniciar la cámara con 'constraints':", JSON.stringify(constraints));

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        ui.video.srcObject = stream;
        
        // --- CAMBIO CLAVE AQUÍ ---
        // 1. Añadimos un event listener que espera a que el video REALMENTE empiece a reproducirse.
        ui.video.addEventListener('playing', () => {
            console.log("¡El video ha comenzado a reproducirse!");

            // 2. Solo cuando el video se está reproduciendo, ajustamos el canvas e iniciamos el bucle.
            // Esto garantiza que no intentamos dibujar un frame negro.
            ui.canvas.width = ui.video.videoWidth;
            ui.canvas.height = ui.video.videoHeight;
            ui.spinner.style.display = 'none';
            
            // Cancelar cualquier bucle anterior por si acaso
            cancelAnimationFrame(animationFrameId); 
            
            // Iniciar el bucle de detección
            detectionLoop(); 
        }, { once: true }); // { once: true } hace que este listener se ejecute solo una vez.

        // 3. Le damos la orden de reproducir al elemento de video.
        // El listener 'playing' de arriba se disparará cuando esto tenga éxito.
        await ui.video.play();

    } catch (error) {
        console.error("Error al acceder a la cámara:", error);
        alert("No se pudo acceder a la cámara. Revise los permisos o si está en uso por otra aplicación.");
        stopDetection();
    }


}

    function stopDetection() {
        isStreamingActive = false;
        cancelAnimationFrame(animationFrameId);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        ui.startBtn.disabled = false;
        ui.stopBtn.disabled = true;
        ui.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
        ui.statusBadge.className = 'status-badge-large waiting';
        ui.statusBadge.textContent = 'ESPERANDO';
        ui.detectionCount.textContent = '0';
    }

    // --- BUCLE DE DETECCIÓN Y DIBUJO ---
    // =================================================================
// REEMPLAZA ESTA FUNCIÓN COMPLETA en backend/static/js/detector.js
// =================================================================
async function detectionLoop() {
    // Si el streaming se detuvo, salimos del bucle.
    if (!isStreamingActive) {
        return;
    }

    try {
        // --- Paso 1: Dibuja el frame actual en el canvas principal ---
        // Esto asegura que el usuario siempre vea el video en vivo,
        // incluso si la detección falla.
        ui.ctx.drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
        
        // --- Paso 2: Prepara una imagen más pequeña para enviar a la API ---
        const canvasForProcessing = document.createElement('canvas');
        canvasForProcessing.width = 640;
        canvasForProcessing.height = 480;
        const ctxProcessing = canvasForProcessing.getContext('2d');
        ctxProcessing.drawImage(ui.video, 0, 0, 640, 480);
        const imageData = canvasForProcessing.toDataURL('image/jpeg', 0.7);

        // --- Paso 3: Llama a la API y maneja los resultados ---
        const result = await api.processFrame(imageData);
        
        if (result && result.success) {
            // Si la API responde correctamente, dibuja las detecciones
            drawDetections(result.detections);
            updateStatus(result);
        }

    } catch (error) {
        // Si hay un error (ej. la red falla), lo mostramos en la consola
        // pero NO detenemos el bucle.
        console.error("Error en un ciclo de detección:", error);
    }

    // --- Paso 4: Vuelve a llamar a la función para el siguiente frame ---
    // Esta es la clave. La llamada recursiva está FUERA del try...catch,
    // asegurando que el bucle continúe incluso si hay un error puntual.
    animationFrameId = requestAnimationFrame(detectionLoop);
}

    function drawDetections(detections) {
        // Redibujar el frame de video para limpiar los rectángulos anteriores
        ui.ctx.drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
        
        detections.forEach(det => {
            const [x1, y1, x2, y2] = det.box;
            
            // Re-escalar las coordenadas si el tamaño de procesamiento es diferente al de visualización
            const scaleX = ui.canvas.width / 640;
            const scaleY = ui.canvas.height / 480;

            ui.ctx.strokeStyle = 'lime'; // Verde para las detecciones
            ui.ctx.lineWidth = 4;
            ui.ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
            
            // Dibujar etiqueta con confianza
            ui.ctx.fillStyle = 'lime';
            ui.ctx.font = '24px Arial';
            const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
            ui.ctx.fillText(label, (x1 * scaleX), (y1 * scaleY) - 10);
        });
    }

    function updateStatus(result) {
        ui.detectionCount.textContent = result.detections.length;
        ui.statusBadge.textContent = result.status;
        ui.statusBadge.className = `status-badge-large ${result.status.toLowerCase()}`;
    }

    // --- INICIAR LA PÁGINA ---
    setupEventListeners();
    getCameraDevices();
});