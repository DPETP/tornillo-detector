# =================================================================
#    CÓDIGO FINAL, RÁPIDO Y ROBUSTO para backend/routes/detection.py
# =================================================================
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import cv2
import base64
import numpy as np

from vision.detector import YOLODetector
from database.models import db, Detection # Ya no necesitamos User aquí

detection_bp = Blueprint('detection', __name__)

try:
    yolo_detector = YOLODetector()
except FileNotFoundError as e:
    print(f"ERROR CRÍTICO: {e}")
    yolo_detector = None

@detection_bp.route('/process-frame', methods=['POST'])
@jwt_required()
def process_frame():
    if yolo_detector is None:
        return jsonify(success=False, error="El modelo de detección no está cargado."), 500

    data = request.get_json()
    if not data or 'frame' not in data:
        return jsonify(success=False, error='Frame no proporcionado'), 400

    try:
        frame_data = data['frame'].split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        detections = yolo_detector.detect(frame)
        
        status = 'PASS' if len(detections) > 0 else 'FAIL'

        # --- LÓGICA CORREGIDA Y EFICIENTE ---
        # 1. Obtenemos el ID del usuario directamente
        user_id = get_jwt_identity()
        # 2. Obtenemos el 'team' directamente del token, ¡sin consultar la BD!
        claims = get_jwt()
        user_team = claims.get('team', 'Unknown')

        # La lógica para guardar en la BD ahora es mucho más rápida
        # (La comentamos por ahora para asegurar que la detección funcione,
        # puedes descomentarla después)
        """
        detection_record = Detection(
            user_id=user_id,
            team=user_team,
            status=status,
            confidence=max([d['confidence'] for d in detections]) if detections else 0,
            detection_count=len(detections),
            camera_source='webcam'
            # ... otros campos como ac_model_id, expected_count irían aquí
        )
        db.session.add(detection_record)
        db.session.commit()
        """

        return jsonify({
            'success': True,
            'status': status,
            'detections': detections
        }), 200

    except Exception as e:
        return jsonify(success=False, error=f"Error en el servidor: {str(e)}"), 500