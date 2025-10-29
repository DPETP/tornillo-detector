# =================================================================
#      DASHBOARD.PY - VERSIÓN FINAL, COMPLETA Y ROBUSTA
# =================================================================

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..database.models import db, User, Detection  # Importamos los modelos necesarios
from sqlalchemy import func
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_overview():
    """
    Calcula y devuelve una vista general de las estadísticas del equipo del usuario,
    directamente desde la tabla de detecciones para máxima precisión.
    """
    # Obtenemos el equipo del usuario directamente desde el token JWT
    claims = get_jwt()
    user_team = claims.get('team')

    if not user_team:
        return jsonify(success=False, error="No se encontró el equipo del usuario en el token."), 400
    
    try:
        # Usamos SQLAlchemy para hacer los cálculos de forma eficiente en la base de datos
        
        # 1. Conteo total de inspecciones para el equipo
        total_inspections = db.session.query(func.count(Detection.id)).filter_by(team=user_team).scalar() or 0

        # 2. Conteo de inspecciones PASS para el equipo
        passed_inspections = db.session.query(func.count(Detection.id)).filter_by(team=user_team, status='PASS').scalar() or 0

        # 3. Conteo de inspecciones FAIL para el equipo
        failed_inspections = total_inspections - passed_inspections

        # 4. Cálculo del Pass Rate (evitando división por cero)
        pass_rate = (passed_inspections / total_inspections * 100) if total_inspections > 0 else 0
        
        # Devolvemos un JSON limpio con los datos que el frontend necesita
        return jsonify({
            'success': True,
            'data': {
                'team': user_team,
                'total_inspections': total_inspections,
                'passed': passed_inspections,
                'failed': failed_inspections,
                'pass_rate': round(pass_rate, 2)
            }
        }), 200
    except Exception as e:
        return jsonify(success=False, error=f"Error en la base de datos: {str(e)}"), 500


@dashboard_bp.route('/team-stats', methods=['GET'])
@jwt_required()
def get_team_stats():
    """
    Obtener estadísticas del equipo para gráficos (por ejemplo, últimos 7 días).
    Mantenemos esta ruta para uso futuro.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id) # Esta ruta aún necesita el objeto User
    
    if not user:
        return jsonify(success=False, message='Usuario no encontrado'), 404
        
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
    """
    Obtener desempeño del usuario actual.
    Mantenemos esta ruta para uso futuro.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify(success=False, message='Usuario no encontrado'), 404

    detections = Detection.query.filter_by(user_id=user_id).all()
    
    if not detections:
        return jsonify({ 'user': user.username, 'total_inspections': 0, 'pass_rate': 0 }), 200
    
    passed = len([d for d in detections if d.status == 'PASS'])
    pass_rate = (passed / len(detections)) * 100 if detections else 0
    
    return jsonify({
        'user': user.username,
        'total_inspections': len(detections),
        'passed': passed,
        'failed': len(detections) - passed,
        'pass_rate': round(pass_rate, 2)
    }), 200