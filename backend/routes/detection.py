# =================================================================
#    DETECTION.PY - VERSIÓN FINAL CON CICLO DE INSPECCIÓN
# =================================================================
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import cv2
import base64
import numpy as np

# Importaciones actualizadas
from ..database.models import db, Detection, ACModel, Settings, InferenceEngine
from ..vision.detector import YOLODetector

detection_bp = Blueprint('detection', __name__)

# Variable global para almacenar el detector activo
yolo_detector = None
active_engine = None
model_loaded = False

def load_active_model():
    """Carga el modelo activo desde la base de datos"""
    global yolo_detector, active_engine, model_loaded
    try:
        engine = InferenceEngine.query.filter_by(activo=True).first()
        if engine and engine.ruta_archivo:
            yolo_detector = YOLODetector(model_filename=engine.ruta_archivo)
            active_engine = engine
            model_loaded = True
            print(f"✓ Modelo activo cargado: {engine.tipo} v{engine.version}")
        else:
            print("⚠ No hay motor de IA activo configurado")
            model_loaded = True
    except Exception as e:
        print(f"ERROR: No se pudo cargar el modelo. {e}")
        yolo_detector = None
        model_loaded = True

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
    global model_loaded
    
    # Cargar el modelo en el primer request si no está cargado
    if not model_loaded:
        load_active_model()
    
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

# --- RUTA NUEVA: OBTENER MOTORES ACTIVOS ---
@detection_bp.route('/available-engines', methods=['GET'])
@jwt_required()
def get_available_engines():
    """Devuelve la lista de motores de IA disponibles para selección"""
    engines = InferenceEngine.query.filter_by(activo=True).all()
    return jsonify(success=True, data=[{
        'id': e.id,
        'tipo': e.tipo,
        'version': e.version,
        'descripcion': e.descripcion,
        'activo': e.activo
    } for e in engines])

# --- RUTA NUEVA: CAMBIAR MOTOR ACTIVO ---
@detection_bp.route('/change-engine/<int:engine_id>', methods=['POST'])
@jwt_required()
def change_active_engine(engine_id):
    """Cambia el motor de IA activo y recarga el detector"""
    global yolo_detector, active_engine, model_loaded
    
    # Desactivar todos los motores
    InferenceEngine.query.update({'activo': False})
    db.session.commit()
    
    # Activar el motor seleccionado
    engine = InferenceEngine.query.get_or_404(engine_id)
    engine.activo = True
    db.session.commit()
    
    # FORZAR recarga del detector (resetear flag)
    model_loaded = False
    yolo_detector = None
    active_engine = None
    
    # Recargar el detector
    load_active_model()
    
    if yolo_detector:
        return jsonify(success=True, message=f'Motor {engine.tipo} v{engine.version} activado y cargado')
    else:
        return jsonify(success=False, error='Error al cargar el nuevo motor'), 500

# --- RUTA NUEVA: INFO DEL MOTOR ACTIVO ---
@detection_bp.route('/active-engine', methods=['GET'])
@jwt_required()
def get_active_engine_info():
    """Devuelve información del motor actualmente activo"""
    global model_loaded
    
    # Cargar modelo si aún no se ha intentado
    if not model_loaded:
        load_active_model()
    
    if active_engine:
        return jsonify(success=True, data={
            'id': active_engine.id,
            'tipo': active_engine.tipo,
            'version': active_engine.version,
            'descripcion': active_engine.descripcion,
            'ruta_archivo': active_engine.ruta_archivo
        })
    else:
        # Retornar 200 con success=False en lugar de 404
        return jsonify(success=False, message='No hay motor activo. Por favor, active uno desde Configuración.'), 200