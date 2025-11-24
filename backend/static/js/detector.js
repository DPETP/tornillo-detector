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
    // Por defecto TRUE para que siempre muestre los bounding boxes
    let showBoundingBoxes = localStorage.getItem('showBoundingBoxes') === 'false' ? false : true;
    let lastDetections = []; // Guardar últimas detecciones para redibujar en cada frame

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
        videoSourceSelect: document.getElementById('videoSourceSelect'),
        engineSelect: document.getElementById('engineSelect'),
        toggleBoundingBoxes: document.getElementById('toggleBoundingBoxes')
    };

    // --- INICIALIZACIÓN ---
    async function initializeApp() {
        setupEventListeners();
        await populateCameraList();
        await loadAvailableEngines();
        
        // Restaurar preferencia de bounding boxes
        ui.toggleBoundingBoxes.checked = showBoundingBoxes;
        
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

    async function loadAvailableEngines() {
        try {
            // Cargar todos los motores disponibles
            const enginesResult = await api.getAvailableEngines();
            
            // Cargar el motor activo
            const activeResult = await api.getActiveEngine();
            const activeId = activeResult?.data?.id || null;
            
            console.log('Motores disponibles:', enginesResult?.data);
            console.log('Motor activo ID:', activeId);
            
            if (enginesResult && enginesResult.success && enginesResult.data.length > 0) {
                ui.engineSelect.innerHTML = enginesResult.data.map(engine => {
                    const selected = engine.id === activeId ? 'selected' : '';
                    const activeLabel = engine.id === activeId ? ' ✓' : '';
                    return `<option value="${engine.id}" ${selected}>${engine.tipo} v${engine.version}${activeLabel}</option>`;
                }).join('');
            } else {
                ui.engineSelect.innerHTML = '<option value="">No hay motores disponibles</option>';
            }
        } catch (error) {
            console.error('Error cargando motores:', error);
            ui.engineSelect.innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    function setupEventListeners() {
        ui.startBtn.addEventListener('click', startInspectionCycle);
        ui.stopBtn.addEventListener('click', stopDetection);
        ui.cycleTimeSlider.addEventListener('input', e => ui.cycleTimeLabel.textContent = e.target.value);
        ui.confidenceSlider.addEventListener('input', e => {
            currentConfidence = e.target.value / 100;
            ui.confidenceLabel.textContent = e.target.value;
            console.log(`🎚️ Confianza actualizada a: ${(currentConfidence * 100).toFixed(0)}% (${currentConfidence})`);
        });
        ui.videoSourceSelect.addEventListener('change', () => {
            if (isInspecting || (stream && stream.active)) {
                stopDetection();
                startInspectionCycle();
            }
        });
        
        // Toggle de bounding boxes
        ui.toggleBoundingBoxes.addEventListener('change', e => {
            showBoundingBoxes = e.target.checked;
            localStorage.setItem('showBoundingBoxes', showBoundingBoxes);
        });
        
        // Cambiar motor IA
        ui.engineSelect.addEventListener('change', async (e) => {
            const engineId = e.target.value;
            if (!engineId) return;
            
            // Guardar el ID seleccionado para evitar loops
            const selectedEngine = engineId;
            
            try {
                const result = await api.changeEngine(selectedEngine);
                console.log('Motor cambiado:', result);
                
                // Detener la detección actual si está corriendo
                if (isInspecting) {
                    stopDetection();
                }
                
                // Dar tiempo al backend para actualizar la BD
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Recargar información del motor activo
                await loadAvailableEngines();
                
                alert('Motor IA cambiado exitosamente. Presione "Iniciar" para comenzar.');
            } catch (error) {
                console.error('Error al cambiar motor:', error);
                alert('Error al cambiar el motor: ' + error.message);
                // Recargar para mostrar el estado correcto
                await loadAvailableEngines();
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
        
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            ui.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                ui.video.onloadedmetadata = () => {
                    ui.video.play()
                        .then(() => {
                            ui.canvas.width = ui.video.videoWidth;
                            ui.canvas.height = ui.video.videoHeight;
                            console.log(`Cámara activada: ${ui.video.videoWidth}x${ui.video.videoHeight}`);
                            resolve();
                        })
                        .catch(reject);
                };
                ui.video.onerror = () => reject(new Error('Error al cargar el video'));
            });
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            throw new Error(`No se pudo acceder a la cámara: ${error.message}`);
        }
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
            // 1. Dibujar el frame del video (esto borra el canvas)
            ui.ctx.drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
            
            // 2. Redibujar las últimas detecciones conocidas INMEDIATAMENTE
            if (lastDetections.length > 0) {
                drawDetections(lastDetections);
            }
            
            // 3. Procesar el frame en segundo plano (async)
            // USAR EL MISMO TAMAÑO QUE EL CANVAS DISPLAY para evitar distorsión
            const canvasForProcessing = document.createElement('canvas');
            canvasForProcessing.width = ui.canvas.width;
            canvasForProcessing.height = ui.canvas.height;
            canvasForProcessing.getContext('2d').drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
            const imageData = canvasForProcessing.toDataURL('image/jpeg', 0.7);
            const result = await api.processFrame(imageData);
            
            console.log('Respuesta del backend:', result);
            
            if (isInspecting && result && result.success) {
                console.log(`\n--- Frame procesado ---`);
                console.log(`Total detecciones recibidas: ${result.detections.length}`);
                console.log(`Umbral de confianza actual: ${(currentConfidence * 100).toFixed(0)}%`);
                
                // Log detallado de cada detección
                result.detections.forEach((det, idx) => {
                    const passed = det.confidence >= currentConfidence;
                    const symbol = passed ? '✓ PASS' : '✗ RECHAZADO';
                    const confPercent = (det.confidence * 100).toFixed(1);
                    console.log(`  ${symbol} Det ${idx}: ${det.class_name} ${confPercent}% ${passed ? '' : '(< ' + (currentConfidence * 100).toFixed(0) + '%)'}`);
                });
                
                const filteredDetections = result.detections.filter(d => d.confidence >= currentConfidence);
                console.log(`✅ Detecciones que PASAN el filtro: ${filteredDetections.length} de ${result.detections.length}`);
                
                // 4. Actualizar las detecciones guardadas
                lastDetections = filteredDetections;
                
                if (filteredDetections.length > maxDetectionsInCycle) {
                    console.log(`📊 ACTUALIZANDO máximo: ${maxDetectionsInCycle} -> ${filteredDetections.length}`);
                    maxDetectionsInCycle = filteredDetections.length;
                    updateDetectionCountUI();
                } else {
                    console.log(`📊 Máximo sigue siendo: ${maxDetectionsInCycle} (actual: ${filteredDetections.length})`);
                }
            } else {
                console.warn('No hay detecciones o el resultado no fue exitoso');
            }
        } catch (error) { console.error("Error en ciclo de detección:", error); }
        
        animationFrameId = requestAnimationFrame(detectionLoop);
    }
    
    // --- FUNCIONES DE UTILIDAD ---
    function setStatus(text, className) {
        ui.statusBadge.textContent = text;
        ui.statusBadge.className = `status-badge-large ${className}`;
        // Aplicar también la clase al contenedor padre para el efecto de fondo completo
        const statusBox = ui.statusBadge.closest('.status-box.status-main');
        if (statusBox) {
            statusBox.className = `status-box status-main ${className}`;
        }
    }
    function updateDetectionCountUI() { ui.detectionCount.textContent = `${maxDetectionsInCycle} / ${config.target_tornillos}`; }
    function updateStatsUI() { ui.totalInspected.textContent = stats.totalInspected; ui.totalPass.textContent = stats.totalPass; ui.totalFail.textContent = stats.totalFail; }
    
    function drawDetections(detections) {
        // Solo dibujar si el toggle está activado
        if (!showBoundingBoxes) {
            console.log('Bounding boxes desactivados. Marque el checkbox para verlos.');
            return;
        }
        
        if (detections.length === 0) {
            console.log('No hay detecciones para dibujar.');
            return;
        }
        
        console.log(`Dibujando ${detections.length} bounding boxes`, {
            canvasWidth: ui.canvas.width,
            canvasHeight: ui.canvas.height,
            primeraDeteccion: detections[0]
        });
        
        detections.forEach((det, idx) => {
            const [x1, y1, x2, y2] = det.box;
            
            // Ya NO necesitamos escalar porque el backend procesa la misma resolución que mostramos
            const scaledX1 = x1;
            const scaledY1 = y1;
            const scaledWidth = (x2 - x1);
            const scaledHeight = (y2 - y1);
            
            console.log(`Box ${idx}: [${x1},${y1},${x2},${y2}]`);
            
            ui.ctx.strokeStyle = '#FF0000'; // ROJO para que sea MUY visible
            ui.ctx.lineWidth = 5;
            ui.ctx.strokeRect(scaledX1, scaledY1, scaledWidth, scaledHeight);
            ui.ctx.fillStyle = '#FF0000';
            ui.ctx.font = 'bold 24px Arial';
            const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
            ui.ctx.fillText(label, scaledX1, scaledY1 > 20 ? scaledY1 - 5 : scaledY1 + scaledHeight + 20);
        });
    }

    // --- PUNTO DE ENTRADA ---
    initializeApp();
});