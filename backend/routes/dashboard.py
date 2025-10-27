from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..database.models import db, User, Detection, EquipmentMetrics
from sqlalchemy import func
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_overview():
    """Obtener vista general del dashboard"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'Usuario no encontrado'}), 404
    
    # Métricas del equipo
    metrics = EquipmentMetrics.query.filter_by(team=user.team).first()
    
    if not metrics:
        metrics = EquipmentMetrics(team=user.team)
        db.session.add(metrics)
        db.session.commit()
    
    # Detecciones de hoy
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_detections = Detection.query.filter(
        Detection.team == user.team,
        Detection.timestamp >= today_start
    ).all()
    
    today_pass = len([d for d in today_detections if d.status == 'PASS'])
    today_fail = len([d for d in today_detections if d.status == 'FAIL'])
    
    return jsonify({
        'team': user.team,
        'total_inspections': metrics.total_inspections,
        'passed': metrics.passed,
        'failed': metrics.failed,
        'pass_rate': round(metrics.pass_rate, 2),
        'average_confidence': round(metrics.average_confidence, 4),
        'today': {
            'total': len(today_detections),
            'passed': today_pass,
            'failed': today_fail
        },
        'last_updated': metrics.last_updated.isoformat() if metrics.last_updated else None
    }), 200


@dashboard_bp.route('/team-stats', methods=['GET'])
@jwt_required()
def get_team_stats():
    """Obtener estadísticas del equipo"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Estadísticas últimos 7 días
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    daily_stats = db.session.query(
        func.date(Detection.timestamp).label('date'),
        Detection.status,
        func.count(Detection.id).label('count')
    ).filter(
        Detection.team == user.team,
        Detection.timestamp >= seven_days_ago
    ).group_by(
        func.date(Detection.timestamp),
        Detection.status
    ).all()
    
    stats_by_day = {}
    for date, status, count in daily_stats:
        date_str = str(date)
        if date_str not in stats_by_day:
            stats_by_day[date_str] = {'pass': 0, 'fail': 0}
        stats_by_day[date_str][status.lower()] = count
    
    return jsonify({
        'team': user.team,
        'period': '7_days',
        'stats': stats_by_day
    }), 200


@dashboard_bp.route('/user-performance', methods=['GET'])
@jwt_required()
def get_user_performance():
    """Obtener desempeño del usuario actual"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    detections = Detection.query.filter_by(user_id=user_id).all()
    
    if not detections:
        return jsonify({
            'user': user.username,
            'total_inspections': 0,
            'pass_rate': 0,
            'average_confidence': 0
        }), 200
    
    passed = len([d for d in detections if d.status == 'PASS'])
    pass_rate = (passed / len(detections)) * 100 if detections else 0
    avg_confidence = sum([d.confidence for d in detections]) / len(detections)
    
    return jsonify({
        'user': user.username,
        'total_inspections': len(detections),
        'passed': passed,
        'failed': len(detections) - passed,
        'pass_rate': round(pass_rate, 2),
        'average_confidence': round(avg_confidence, 4)
    }), 200