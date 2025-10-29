# =================================================================
#    DETECTION.PY - VERSIÓN FINAL CON CICLO DE INSPECCIÓN
# =================================================================
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import cv2
import base64
import numpy as np

# Importaciones actualizadas
from ..database.models import db, Detection, ACModel, Settings
from ..vision.detector import YOLODetector

detection_bp = Blueprint('detection', __name__)

try:
    yolo_detector = YOLODetector()
except FileNotFoundError as e:
    print(f"ERROR CRÍTICO: El archivo del modelo YOLO no se encontró. {e}")
    yolo_detector = None

# --- RUTA NUEVA: OBTENER CONFIGURACIÓN ---
@detection_bp.route('/config', methods=['GET'])
@jwt_required()
def get_detection_config():
    """Devuelve la configuración activa para que el frontend sepa las reglas."""
    settings = Settings.query.first()
    if not settings or not settings.ac_model_activo_id:
        return jsonify(success=False, error="No hay un Modelo de AA activo configurado en el panel de administración."), 404
    
    active_model = ACModel.query.get(settings.ac_model_activo_id)
    if not active_model:
        return jsonify(success=False, error="El Modelo de AA activo configurado no fue encontrado en la base de datos."), 404
        
    return jsonify(success=True, data={
        "target_tornillos": active_model.target_tornillos,
        "confidence_threshold": active_model.confidence_threshold,
        "inspection_cycle_time": active_model.inspection_cycle_time,
        "model_name": active_model.nombre
    })

# --- RUTA MODIFICADA: SOLO PROCESA EL FRAME ---
@detection_bp.route('/process-frame', methods=['POST'])
@jwt_required()
def process_frame():
    """Recibe un frame, lo procesa con YOLO y devuelve las detecciones crudas."""
    if yolo_detector is None:
        return jsonify(success=False, error="El modelo de detección no está cargado en el servidor."), 500

    data = request.get_json()
    if 'frame' not in data:
        return jsonify(success=False, error='El frame no fue proporcionado en la petición'), 400

    try:
        frame_data = data['frame'].split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        detections = yolo_detector.detect(frame)
        
        # Ya no calcula PASS/FAIL ni guarda en la BD. Solo devuelve lo que ve.
        return jsonify(success=True, detections=detections), 200
        
    except Exception as e:
        return jsonify(success=False, error=f"Error procesando el frame: {str(e)}"), 500

# --- RUTA NUEVA: GUARDAR EL RESULTADO FINAL DEL CICLO ---
@detection_bp.route('/save-inspection', methods=['POST'])
@jwt_required()
def save_inspection_result():
    """Guarda el resultado consolidado de UN ciclo de inspección."""
    data = request.get_json()
    required_keys = ['status', 'detection_count', 'expected_count', 'model_name']
    if not all(k in data for k in required_keys):
        return jsonify(success=False, error="Faltan datos para guardar la inspección"), 400

    # Obtener el modelo de AA basado en el nombre para obtener su ID
    ac_model = ACModel.query.filter_by(nombre=data['model_name']).first()
    if not ac_model:
        return jsonify(success=False, error=f"No se encontró el modelo de AA con el nombre {data['model_name']}"), 404

    new_inspection = Detection(
        user_id=get_jwt_identity(),
        team=get_jwt().get('team', 'Unknown'),
        status=data['status'],
        detection_count=data['detection_count'],
        expected_count=data['expected_count'],
        confidence=data.get('confidence', 0.0),
        ac_model_id=ac_model.id,
        motor_inferencia_id=ac_model.motor_inferencia_id
    )
    db.session.add(new_inspection)
    db.session.commit()
    return jsonify(success=True, message="Inspección guardada correctamente.", id=new_inspection.id), 201