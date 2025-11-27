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
    let lastProcessedFrame = null; // Guardar el último frame procesado para sincronización
    let trackedScrews = []; // Tracking de tornillos únicos detectados en el ciclo
    // DISTANCE_THRESHOLD dinámico: 15% del ancho del canvas (se ajusta automáticamente)
    let DISTANCE_THRESHOLD = 150; // Se calculará dinámicamente basado en resolución
    const MIN_DETECTIONS_TO_CONFIRM = 2; // Número mínimo de veces que debe verse para confirmarse (reducido para ser más sensible)

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
            // Primero solicitar permiso de cámara para obtener las etiquetas
            try {
                const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
                testStream.getTracks().forEach(track => track.stop());
            } catch (permError) {
                console.warn("Permiso de cámara no concedido aún:", permError);
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log('Dispositivos encontrados:', devices);
            
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('Dispositivos de video:', videoDevices);
            
            ui.videoSourceSelect.innerHTML = '';
            if (videoDevices.length === 0) {
                ui.videoSourceSelect.innerHTML = '<option>No se encontraron cámaras</option>';
                ui.startBtn.disabled = true;
                alert('No se detectaron cámaras web. Verifica que tu dispositivo de video esté conectado y que el navegador tenga permisos.');
                return;
            }
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Cámara ${index + 1}`;
                ui.videoSourceSelect.appendChild(option);
            });
            console.log(`✓ ${videoDevices.length} cámara(s) disponible(s)`);
        } catch (error) { 
            console.error("Error al enumerar dispositivos:", error);
            alert('Error al acceder a los dispositivos de video: ' + error.message);
        }
    }

    async function startCamera() {
        const deviceId = ui.videoSourceSelect.value;
        console.log('Intentando iniciar cámara con deviceId:', deviceId);
        
        if (!deviceId || deviceId === '') {
            throw new Error("No hay una cámara seleccionada. Por favor selecciona un dispositivo de video.");
        }
        
        // Primero intentar con deviceId exacto, si falla intentar sin restricción específica
        let constraints = { 
            video: { 
                deviceId: { exact: deviceId }, 
                width: { ideal: 1280 }, 
                height: { ideal: 720 } 
            } 
        };
        
        try {
            console.log('Solicitando acceso a la cámara con constraints:', constraints);
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            ui.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                ui.video.onloadedmetadata = () => {
                    console.log('Metadata del video cargada');
                    ui.video.play()
                        .then(() => {
                            ui.canvas.width = ui.video.videoWidth;
                            ui.canvas.height = ui.video.videoHeight;
                            console.log(`✓ Cámara activada: ${ui.video.videoWidth}x${ui.video.videoHeight}`);
                            resolve();
                        })
                        .catch(err => {
                            console.error('Error al reproducir video:', err);
                            reject(err);
                        });
                };
                ui.video.onerror = (err) => {
                    console.error('Error en elemento video:', err);
                    reject(new Error('Error al cargar el video'));
                };
                
                // Timeout de seguridad
                setTimeout(() => reject(new Error('Timeout: El video no se cargó en 10 segundos')), 10000);
            });
        } catch (error) {
            console.error('Error detallado al acceder a la cámara:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            
            // Intentar sin restricción de deviceId específico
            if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
                console.log('Reintentando sin restricción de deviceId específico...');
                try {
                    constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    ui.video.srcObject = stream;
                    
                    return new Promise((resolve, reject) => {
                        ui.video.onloadedmetadata = () => {
                            ui.video.play()
                                .then(() => {
                                    ui.canvas.width = ui.video.videoWidth;
                                    ui.canvas.height = ui.video.videoHeight;
                                    console.log(`✓ Cámara activada (modo genérico): ${ui.video.videoWidth}x${ui.video.videoHeight}`);
                                    resolve();
                                })
                                .catch(reject);
                        };
                        ui.video.onerror = () => reject(new Error('Error al cargar el video'));
                    });
                } catch (retryError) {
                    console.error('Error en reintento:', retryError);
                    throw new Error(`No se pudo acceder a la cámara: ${retryError.message}`);
                }
            }
            
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
            trackedScrews = []; // Resetear tracking de tornillos únicos
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
            // 1. CAPTURAR el frame actual del video ANTES de procesarlo
            const canvasForProcessing = document.createElement('canvas');
            canvasForProcessing.width = ui.canvas.width;
            canvasForProcessing.height = ui.canvas.height;
            const ctxProcessing = canvasForProcessing.getContext('2d');
            ctxProcessing.drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
            
            // 2. GUARDAR este frame como el último procesado
            lastProcessedFrame = canvasForProcessing;
            
            // 3. Dibujar el frame capturado en el canvas principal
            ui.ctx.drawImage(lastProcessedFrame, 0, 0);
            
            // 4. Redibujar las detecciones ANTERIORES sobre este frame (si existen)
            if (lastDetections.length > 0) {
                drawDetections(lastDetections);
            }
            
            // 5. Enviar el frame al backend para procesamiento (async)
            const imageData = lastProcessedFrame.toDataURL('image/jpeg', 0.95);
            const result = await api.processFrame(imageData);
            
            console.log('Respuesta del backend:', result);
            
            if (isInspecting && result && result.success) {
                // 6. Cuando llegan las detecciones, redibujar sobre el MISMO frame guardado
                ui.ctx.drawImage(lastProcessedFrame, 0, 0);
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
                
                // Todas las detecciones filtradas son trackables (usar el mismo umbral del slider)
                const trackableDetections = filteredDetections;
                
                // 5. Actualizar las detecciones guardadas para dibujar
                lastDetections = filteredDetections;
                
                // 6. TRACKING: Registrar tornillos únicos (solo los trackables)
                // RESTRICCIÓN ESTRICTA: Solo trackear hasta alcanzar el target
                trackableDetections.forEach(det => {
                    const newCenter = getCenter(det.box);
                    
                    // Buscar si ya existe este tornillo
                    const existingScrew = trackedScrews.find(tracked => {
                        const distance = calculateDistance(newCenter, tracked.center);
                        const iou = calculateIoU(det.box, tracked.box);
                        return distance < DISTANCE_THRESHOLD || iou > 0.3;
                    });
                    
                    if (existingScrew) {
                        // Actualizar tornillo existente (siempre)
                        existingScrew.center = newCenter;
                        existingScrew.box = det.box;
                        existingScrew.confidence = Math.max(existingScrew.confidence, det.confidence);
                        existingScrew.lastSeen = Date.now();
                        existingScrew.detectionCount++;
                    } else {
                        // Es un tornillo nuevo, verificar si podemos agregarlo
                        const currentConfirmedCount = getConfirmedScrewsCount();
                        
                        if (currentConfirmedCount < config.target_tornillos) {
                            // Aún no alcanzamos el límite, agregarlo
                            console.log(`🆕 Nuevo tornillo agregado (${currentConfirmedCount + 1}/${config.target_tornillos}) en pos [${newCenter.x.toFixed(0)}, ${newCenter.y.toFixed(0)}]`);
                            trackedScrews.push({
                                center: newCenter,
                                box: det.box,
                                confidence: det.confidence,
                                class_name: det.class_name,
                                firstSeen: Date.now(),
                                lastSeen: Date.now(),
                                detectionCount: 1
                            });
                        } else {
                            // Ya alcanzamos el límite, ignorar este tornillo
                            console.log(`🚫 Tornillo ignorado (límite ${config.target_tornillos} alcanzado)`);
                        }
                    }
                });
                
                // 7. Actualizar el contador con tornillos ÚNICOS CONFIRMADOS (con límite estricto)
                const confirmedCount = getConfirmedScrewsCount();
                const totalTracked = trackedScrews.length;
                
                // LIMITAR al target para evitar excesos
                const finalCount = Math.min(confirmedCount, config.target_tornillos);
                
                console.log(`🔍 Tracking: ${totalTracked} detectados, ${confirmedCount} confirmados → MOSTRANDO: ${finalCount}/${config.target_tornillos}`);
                
                
                // Mostrar detalles de cada tornillo trackeado
                trackedScrews.forEach((screw, idx) => {
                    const status = screw.detectionCount >= MIN_DETECTIONS_TO_CONFIRM ? '✅ CONFIRMADO' : '⏳ PENDIENTE';
                    const pos = `[${Math.round(screw.center.x)}, ${Math.round(screw.center.y)}]`;
                    console.log(`  ${status} #${idx + 1}: visto ${screw.detectionCount}x, conf ${(screw.confidence * 100).toFixed(0)}%, pos ${pos}`);
                });
                
                if (finalCount > maxDetectionsInCycle) {
                    console.log(`📊 ACTUALIZANDO máximo: ${maxDetectionsInCycle} -> ${finalCount}`);
                    maxDetectionsInCycle = finalCount;
                    updateDetectionCountUI();
                } else {
                    console.log(`📊 Tornillos confirmados: ${finalCount} de ${config.target_tornillos} esperados`);
                }
                
                // IMPORTANTE: Solicitar el siguiente frame SOLO después de procesar completamente este
                animationFrameId = requestAnimationFrame(detectionLoop);
            } else {
                console.warn('No hay detecciones o el resultado no fue exitoso');
                animationFrameId = requestAnimationFrame(detectionLoop);
            }
        } catch (error) { 
            console.error("Error en ciclo de detección:", error);
            animationFrameId = requestAnimationFrame(detectionLoop);
        }
    }
    
    // --- FUNCIONES DE TRACKING ---
    function getCenter(box) {
        const [x1, y1, x2, y2] = box;
        return {
            x: (x1 + x2) / 2,
            y: (y1 + y2) / 2
        };
    }
    
    function calculateDistance(center1, center2) {
        const dx = center1.x - center2.x;
        const dy = center1.y - center2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    function calculateIoU(box1, box2) {
        // Calcular Intersection over Union para determinar si son el mismo objeto
        const [x1_1, y1_1, x2_1, y2_1] = box1;
        const [x1_2, y1_2, x2_2, y2_2] = box2;
        
        // Calcular área de intersección
        const xLeft = Math.max(x1_1, x1_2);
        const yTop = Math.max(y1_1, y1_2);
        const xRight = Math.min(x2_1, x2_2);
        const yBottom = Math.min(y2_1, y2_2);
        
        if (xRight < xLeft || yBottom < yTop) return 0.0;
        
        const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
        
        // Calcular áreas de cada box
        const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
        const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);
        
        // IoU = intersección / unión
        const iou = intersectionArea / (box1Area + box2Area - intersectionArea);
        return iou;
    }
    
    function trackUniqueScrew(detection) {
        const newCenter = getCenter(detection.box);
        
        // Verificar si este tornillo ya está trackeado usando DISTANCIA + IoU
        const existingScrew = trackedScrews.find(tracked => {
            const distance = calculateDistance(newCenter, tracked.center);
            const iou = calculateIoU(detection.box, tracked.box);
            
            // Considerar el mismo tornillo si:
            // - Está cerca (distancia < threshold) O
            // - Tiene alta superposición (IoU > 0.3)
            const isSame = distance < DISTANCE_THRESHOLD || iou > 0.3;
            
            if (isSame) {
                console.log(`🔗 Mismo tornillo detectado - Distancia: ${distance.toFixed(0)}px, IoU: ${(iou * 100).toFixed(1)}%`);
            }
            
            return isSame;
        });
        
        if (existingScrew) {
            // Actualizar la posición y confianza del tornillo existente
            existingScrew.center = newCenter;
            existingScrew.box = detection.box;
            existingScrew.confidence = Math.max(existingScrew.confidence, detection.confidence);
            existingScrew.lastSeen = Date.now();
            existingScrew.detectionCount++; // Incrementar contador de veces visto
            return false; // No es nuevo
        } else {
            // Agregar nuevo tornillo único
            console.log(`🆕 Nuevo tornillo único detectado en pos [${newCenter.x.toFixed(0)}, ${newCenter.y.toFixed(0)}]`);
            trackedScrews.push({
                center: newCenter,
                box: detection.box,
                confidence: detection.confidence,
                class_name: detection.class_name,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                detectionCount: 1 // Primera vez que se ve
            });
            return true; // Es nuevo
        }
    }
    
    function getConfirmedScrewsCount() {
        // Solo contar tornillos que se hayan visto al menos MIN_DETECTIONS_TO_CONFIRM veces
        return trackedScrews.filter(screw => screw.detectionCount >= MIN_DETECTIONS_TO_CONFIRM).length;
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