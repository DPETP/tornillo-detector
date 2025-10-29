// =================================================================
//          DETECTOR.JS - VERSIÓN FINAL, CORREGIDA Y COMPLETA
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO Y REFERENCIAS AL DOM ---
    let stream, animationFrameId, inspectionInterval;
    let isInspecting = false;
    let maxDetectionsInCycle = 0;
    let config = { target_tornillos: 0, confidence_threshold: 0.5, inspection_cycle_time: 20, model_name: "N/A" };
    let stats = { totalInspected: 0, totalPass: 0, totalFail: 0 };
    let currentConfidence = 0.5;

    const ui = {
        video: document.getElementById('videoElement'),
        canvas: document.getElementById('canvasOverlay'),
        ctx: document.getElementById('canvasOverlay').getContext('2d'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        statusBadge: document.getElementById('statusBadge'),
        detectionCount: document.getElementById('detectionCount'),
        modelName: document.getElementById('modelName'),
        cycleTimeSlider: document.getElementById('cycleTimeSlider'),
        cycleTimeLabel: document.getElementById('cycleTimeLabel'),
        confidenceSlider: document.getElementById('confidenceSlider'),
        confidenceLabel: document.getElementById('confidenceLabel'),
        totalInspected: document.getElementById('total-inspected'),
        totalPass: document.getElementById('total-pass'),
        totalFail: document.getElementById('total-fail'),
        videoSourceSelect: document.getElementById('videoSourceSelect')
    };

    // --- INICIALIZACIÓN ---
    async function initializeApp() {
        setupEventListeners();
        await populateCameraList();
        try {
            const result = await api.getDetectionConfig();
            config = result.data;
            ui.modelName.textContent = config.model_name;
            ui.cycleTimeSlider.value = config.inspection_cycle_time;
            ui.cycleTimeLabel.textContent = config.inspection_cycle_time;
            ui.confidenceSlider.value = config.confidence_threshold * 100;
            ui.confidenceLabel.textContent = Math.round(config.confidence_threshold * 100);
            currentConfidence = config.confidence_threshold;
            updateDetectionCountUI();
        } catch (error) {
            alert(`Error al cargar la configuración: ${error.message}.`);
            ui.startBtn.disabled = true;
        }
    }

    function setupEventListeners() {
        ui.startBtn.addEventListener('click', startInspectionCycle);
        ui.stopBtn.addEventListener('click', stopDetection);
        ui.cycleTimeSlider.addEventListener('input', e => ui.cycleTimeLabel.textContent = e.target.value);
        ui.confidenceSlider.addEventListener('input', e => {
            currentConfidence = e.target.value / 100;
            ui.confidenceLabel.textContent = e.target.value;
        });
        ui.videoSourceSelect.addEventListener('change', () => {
            if (isInspecting || (stream && stream.active)) {
                stopDetection();
                startInspectionCycle();
            }
        });
    }

    // --- LÓGICA DE CÁMARA E INSPECCIÓN ---
    async function populateCameraList() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            ui.videoSourceSelect.innerHTML = '';
            if (videoDevices.length === 0) {
                ui.videoSourceSelect.innerHTML = '<option>No se encontraron cámaras</option>';
                ui.startBtn.disabled = true;
                return;
            }
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Cámara ${index + 1}`;
                ui.videoSourceSelect.appendChild(option);
            });
        } catch (error) { console.error("Error al enumerar dispositivos:", error); }
    }

    async function startCamera() {
        const deviceId = ui.videoSourceSelect.value;
        if (!deviceId) throw new Error("No hay una cámara seleccionada.");
        const constraints = { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        ui.video.srcObject = stream;
        return new Promise((resolve, reject) => {
            ui.video.onplaying = () => {
                ui.canvas.width = ui.video.videoWidth;
                ui.canvas.height = ui.video.videoHeight;
                resolve();
            };
            ui.video.play().catch(reject);
        });
    }

    function stopDetection() {
        isInspecting = false;
        cancelAnimationFrame(animationFrameId);
        clearInterval(inspectionInterval);
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
        ui.startBtn.disabled = false;
        ui.stopBtn.disabled = true;
        [ui.cycleTimeSlider, ui.confidenceSlider, ui.videoSourceSelect].forEach(el => el.disabled = false);
        setStatus('DETENIDO', 'waiting');
    }

    async function startInspectionCycle() {
        try {
            [ui.startBtn, ui.stopBtn, ui.cycleTimeSlider, ui.confidenceSlider, ui.videoSourceSelect].forEach(el => el.disabled = true);
            ui.stopBtn.disabled = false;
            setStatus('INICIANDO...', 'processing');
            await startCamera();
            
            isInspecting = true;
            maxDetectionsInCycle = 0;
            updateDetectionCountUI();
            let timeLeft = ui.cycleTimeSlider.value;
            setStatus(`EN CURSO... ${timeLeft}s`, 'processing');

            inspectionInterval = setInterval(() => {
                timeLeft--;
                if (isInspecting) setStatus(`EN CURSO... ${timeLeft}s`, 'processing');
                if (timeLeft <= 0) {
                    clearInterval(inspectionInterval);
                    if (isInspecting) finishInspectionCycle();
                }
            }, 1000);
            detectionLoop();
        } catch(error) {
            console.error("Fallo al iniciar el ciclo de inspección:", error);
            alert(`No se pudo iniciar la cámara: ${error.message}`);
            stopDetection();
        }
    }
    
    async function finishInspectionCycle() {
        isInspecting = false;
        cancelAnimationFrame(animationFrameId);
        stats.totalInspected++;
        const finalStatus = maxDetectionsInCycle === config.target_tornillos ? 'PASS' : 'FAIL';
        finalStatus === 'PASS' ? stats.totalPass++ : stats.totalFail++;
        setStatus(finalStatus, finalStatus.toLowerCase());
        updateStatsUI();
        await api.saveInspectionResult({
            status: finalStatus,
            detection_count: maxDetectionsInCycle,
            expected_count: config.target_tornillos,
            confidence: currentConfidence,
            model_name: config.model_name
        });
        setTimeout(() => {
            if (stream && stream.active) { // Solo reinicia si no se ha detenido manualmente
                startInspectionCycle();
            }
        }, 3000);
    }
    
    async function detectionLoop() {
        if (!isInspecting) return;
        try {
            ui.ctx.drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
            const canvasForProcessing = document.createElement('canvas');
            canvasForProcessing.width = 640; canvasForProcessing.height = 480;
            canvasForProcessing.getContext('2d').drawImage(ui.video, 0, 0, 640, 480);
            const imageData = canvasForProcessing.toDataURL('image/jpeg', 0.7);
            const result = await api.processFrame(imageData);
            if (isInspecting && result && result.success) {
                const filteredDetections = result.detections.filter(d => d.confidence >= currentConfidence);
                if (filteredDetections.length > maxDetectionsInCycle) {
                    maxDetectionsInCycle = filteredDetections.length;
                    updateDetectionCountUI();
                }
                drawDetections(filteredDetections);
            }
        } catch (error) { console.error("Error en ciclo de detección:", error); }
        animationFrameId = requestAnimationFrame(detectionLoop);
    }
    
    // --- FUNCIONES DE UTILIDAD ---
    function setStatus(text, className) {
        ui.statusBadge.textContent = text;
        ui.statusBadge.className = `status-badge-large ${className}`;
    }
    function updateDetectionCountUI() { ui.detectionCount.textContent = `${maxDetectionsInCycle} / ${config.target_tornillos}`; }
    function updateStatsUI() { ui.totalInspected.textContent = stats.totalInspected; ui.totalPass.textContent = stats.totalPass; ui.totalFail.textContent = stats.totalFail; }
    
    function drawDetections(detections) {
        detections.forEach(det => {
            const [x1, y1, x2, y2] = det.box;
            const scaleX = ui.canvas.width / 640;
            const scaleY = ui.canvas.height / 480;
            ui.ctx.strokeStyle = '#00FF00';
            ui.ctx.lineWidth = 3;
            ui.ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
            ui.ctx.fillStyle = '#00FF00';
            ui.ctx.font = 'bold 18px Arial';
            const label = `${(det.confidence * 100).toFixed(0)}%`;
            ui.ctx.fillText(label, (x1 * scaleX), (y1 * scaleY) > 20 ? (y1 * scaleY) - 5 : (y2 * scaleY) + 20);
        });
    }

    // --- PUNTO DE ENTRADA ---
    initializeApp();
});