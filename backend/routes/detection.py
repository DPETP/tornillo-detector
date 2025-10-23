from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import cv2
import base64
import numpy as np
from datetime import datetime
from database.models import db, Detection, EquipmentMetrics, User
from models.yolo_model import YOLODetector

detection_bp = Blueprint('detection', __name__)

# Inicializar detector YOLO
yolo = YOLODetector()

@detection_bp.route('/process-frame', methods=['POST'])
@jwt_required()
def process_frame():
    """Procesar un frame y realizar detección"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    data = request.get_json()
    
    if not data or 'frame' not in data:
        return jsonify({'message': 'Frame no proporcionado'}), 400
    
    try:
        # Decodificar imagen en base64
        frame_data = data['frame'].split(',')[1] if ',' in data['frame'] else data['frame']
        frame_bytes = base64.b64decode(frame_data)
        nparr = cv2.imdecode(np.frombuffer(frame_bytes, np.uint8), cv2.IMREAD_COLOR)
        
        # Realizar detección
        detection_result = yolo.detect(nparr)
        
        if not detection_result['success']:
            return jsonify(detection_result), 400
        
        # Determinar resultado PASS/FAIL
        detections = detection_result['detections']
        status = 'PASS' if len(detections) > 0 else 'FAIL'
        
        # Guardar detección en BD
        detection_record = Detection(
            user_id=user_id,
            team=user.team,
            status=status,
            confidence=max([d['confidence'] for d in detections]) if detections else 0,
            detection_count=len(detections),
            camera_source='webcam'
        )
        
        db.session.add(detection_record)
        db.session.commit()
        
        # Actualizar métricas del equipo
        update_team_metrics(user.team)
        
        return jsonify({
            'success': True,
            'detection_id': detection_record.id,
            'status': status,
            'detections': detections,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@detection_bp.route('/history/<int:limit>', methods=['GET'])
@jwt_required()
def get_detection_history(limit=50):
    """Obtener histórico de detecciones del usuario"""
    user_id = get_jwt_identity()
    
    detections = Detection.query.filter_by(user_id=user_id)\
        .order_by(Detection.timestamp.desc())\
        .limit(limit)\
        .all()
    
    return jsonify({
        'detections': [{
            'id': d.id,
            'status': d.status,
            'confidence': d.confidence,
            'detection_count': d.detection_count,
            'timestamp': d.timestamp.isoformat()
        } for d in detections]
    }), 200


def update_team_metrics(team_name):
    """Actualizar métricas del equipo"""
    try:
        metrics = EquipmentMetrics.query.filter_by(team=team_name).first()
        
        if not metrics:
            metrics = EquipmentMetrics(team=team_name)
            db.session.add(metrics)
        
        # Contar detecciones totales
        all_detections = Detection.query.filter_by(team=team_name).all()
        metrics.total_inspections = len(all_detections)
        metrics.passed = len([d for d in all_detections if d.status == 'PASS'])
        metrics.failed = len([d for d in all_detections if d.status == 'FAIL'])
        
        if metrics.total_inspections > 0:
            metrics.pass_rate = (metrics.passed / metrics.total_inspections) * 100
            metrics.average_confidence = sum([d.confidence for d in all_detections]) / len(all_detections)
        
        metrics.last_updated = datetime.utcnow()
        db.session.commit()
    
    except Exception as e:
        print(f"Error actualizando métricas: {e}")