from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..database.models import db, User, Detection
from datetime import datetime, timedelta

history_bp = Blueprint('history', __name__)

@history_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user_history():
    """Obtener histórico de detecciones del usuario"""
    user_id = get_jwt_identity()
    
    # Parámetros de paginación
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', None)
    
    query = Detection.query.filter_by(user_id=user_id)
    
    if status:
        query = query.filter_by(status=status.upper())
    
    detections = query.order_by(Detection.timestamp.desc()).paginate(
        page=page,
        per_page=per_page
    )
    
    return jsonify({
        'page': page,
        'per_page': per_page,
        'total': detections.total,
        'pages': detections.pages,
        'detections': [{
            'id': d.id,
            'status': d.status,
            'confidence': round(d.confidence, 4),
            'detection_count': d.detection_count,
            'timestamp': d.timestamp.isoformat()
        } for d in detections.items]
    }), 200


@history_bp.route('/team', methods=['GET'])
@jwt_required()
def get_team_history():
    """Obtener histórico del equipo"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', None)
    days = request.args.get('days', 7, type=int)
    
    # Filtrar por fecha
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = Detection.query.filter(
        Detection.team == user.team,
        Detection.timestamp >= start_date
    )
    
    if status:
        query = query.filter_by(status=status.upper())
    
    detections = query.order_by(Detection.timestamp.desc()).paginate(
        page=page,
        per_page=per_page
    )
    
    return jsonify({
        'team': user.team,
        'page': page,
        'per_page': per_page,
        'total': detections.total,
        'pages': detections.pages,
        'period_days': days,
        'detections': [{
            'id': d.id,
            'user': d.user.username,
            'status': d.status,
            'confidence': round(d.confidence, 4),
            'detection_count': d.detection_count,
            'timestamp': d.timestamp.isoformat()
        } for d in detections.items]
    }), 200


@history_bp.route('/export', methods=['GET'])
@jwt_required()
def export_history():
    """Exportar histórico en formato JSON"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    days = request.args.get('days', 7, type=int)
    start_date = datetime.utcnow() - timedelta(days=days)
    
    detections = Detection.query.filter(
        Detection.team == user.team,
        Detection.timestamp >= start_date
    ).order_by(Detection.timestamp.desc()).all()
    
    return jsonify({
        'export': {
            'team': user.team,
            'exported_at': datetime.utcnow().isoformat(),
            'period_days': days,
            'total_records': len(detections),
            'detections': [{
                'id': d.id,
                'user': d.user.username,
                'status': d.status,
                'confidence': d.confidence,
                'detection_count': d.detection_count,
                'timestamp': d.timestamp.isoformat()
            } for d in detections]
        }
    }), 200