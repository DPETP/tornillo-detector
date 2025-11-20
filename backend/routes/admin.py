"""
Rutas de Administración - Panel de Configuración
VERSIÓN FINAL, REESTRUCTURADA Y PROFESIONAL
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from functools import wraps

from ..database.models import db, User, ACModel, InferenceEngine, AuditLog, Settings
from ..config import DevelopmentConfig

admin_bp = Blueprint('admin', __name__)

# ============================================================
# DECORADORES DE PERMISOS
# ============================================================
def admin_required(f):
    """Solo administradores pueden acceder"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role') != 'admin':
            return jsonify(success=False, message="Se requieren permisos de administrador."), 403
        kwargs['current_admin_id'] = get_jwt_identity()
        return f(*args, **kwargs)
    return decorated_function

def config_access_required(f):
    """Solo admin y soporte_tecnico pueden acceder a configuración"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        claims = get_jwt()
        user_role = claims.get('role')
        
        # Solo admin y soporte_tecnico tienen acceso a configuración
        if user_role not in ['admin', 'soporte_tecnico']:
            return jsonify(success=False, message="No tienes permisos para acceder a esta sección."), 403
        
        kwargs['current_user_id'] = get_jwt_identity()
        kwargs['current_user_role'] = user_role
        return f(*args, **kwargs)
    return decorated_function

# ============================================================
# RUTAS: GESTIÓN DE USUARIOS (REESTRUCTURADO)
# ============================================================

@admin_bp.route('/users', methods=['GET', 'POST'])
@config_access_required
def handle_users(current_user_id, current_user_role):
    if request.method == 'GET':
        users = User.query.order_by(User.username).all()
        return jsonify(success=True, data=[user.to_dict() for user in users])

    if request.method == 'POST':
        data = request.get_json()
        if not all(k in data for k in ['username', 'email', 'password']):
            return jsonify(success=False, message='Faltan datos requeridos'), 400
        
        if User.query.filter_by(username=data['username']).first():
            return jsonify(success=False, message='El nombre de usuario ya existe'), 409
            
        new_user = User(
            username=data['username'], email=data['email'],
            password_hash=generate_password_hash(data['password']),
            team=data.get('team', 'Default Team'), role=data.get('role', 'operario'),
            creado_por_id=current_user_id
        )
        db.session.add(new_user)
        db.session.commit()
        return jsonify(success=True, message='Usuario creado exitosamente', data=new_user.to_dict()), 201

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@config_access_required
def update_user(current_user_id, current_user_role, user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    user.email = data.get('email', user.email)
    user.team = data.get('team', user.team)
    user.role = data.get('role', user.role)
    if data.get('password'):
        user.password_hash = generate_password_hash(data['password'])
    db.session.commit()
    return jsonify(success=True, message='Usuario actualizado', data=user.to_dict())

@admin_bp.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@config_access_required
def toggle_user_status(current_user_id, current_user_role, user_id):
    """Activa o desactiva un usuario (soft delete)."""
    user = User.query.get_or_404(user_id)
    
    # Evitar que un usuario se desactive a sí mismo
    if user.id == current_user_id:
        return jsonify(success=False, message="No puedes cambiar tu propio estado."), 403

    user.is_active = not user.is_active
    db.session.commit()
    
    status = "activado" if user.is_active else "desactivado"
    return jsonify(success=True, message=f'Usuario {user.username} {status} exitosamente.')

# Añade esta nueva función para la eliminación permanente
@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@config_access_required
def delete_user(current_user_id, current_user_role, user_id):
    """Elimina un usuario permanentemente de la base de datos."""
    user = User.query.get_or_404(user_id)

    # Medida de seguridad: no permitir que un usuario se elimine a sí mismo
    if user.id == current_user_id:
        return jsonify(success=False, message="No puedes eliminar tu propia cuenta."), 403
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify(success=True, message=f'Usuario {user.username} eliminado permanentemente.')

# ============================================================
# RUTAS: GESTIÓN DE MODELOS DE AA (REESTRUCTURADO)
# ============================================================

@admin_bp.route('/ac-models', methods=['GET', 'POST'])
@config_access_required
def handle_ac_models(current_user_id, current_user_role):
    if request.method == 'GET':
        models = ACModel.query.order_by(ACModel.nombre).all()
        return jsonify(success=True, data=[model.to_dict() for model in models])

    if request.method == 'POST':
        data = request.get_json()
        if not all(k in data for k in ['nombre', 'motor_inferencia_id', 'target_tornillos']):
            return jsonify(success=False, message='Faltan datos requeridos'), 400
        
        new_model = ACModel(
            nombre=data['nombre'], descripcion=data.get('descripcion', ''),
            target_tornillos=data['target_tornillos'],
            confidence_threshold=data.get('confidence_threshold', 0.5),
            inspection_cycle_time=data.get('inspection_cycle_time', 20),
            motor_inferencia_id=data['motor_inferencia_id'],
            creado_por_id=current_user_id
        )
        db.session.add(new_model)
        db.session.commit()
        return jsonify(success=True, message='Modelo de AA creado', data=new_model.to_dict()), 201

@admin_bp.route('/ac-models/<int:model_id>', methods=['PUT', 'DELETE'])
@config_access_required
def handle_single_ac_model(current_user_id, current_user_role, model_id):
    model = ACModel.query.get_or_404(model_id)

    if request.method == 'PUT':
        data = request.get_json()
        model.nombre = data.get('nombre', model.nombre)
        model.descripcion = data.get('descripcion', model.descripcion)
        model.target_tornillos = data.get('target_tornillos', model.target_tornillos)
        model.confidence_threshold = data.get('confidence_threshold', model.confidence_threshold)
        model.inspection_cycle_time = data.get('inspection_cycle_time', model.inspection_cycle_time)
        model.motor_inferencia_id = data.get('motor_inferencia_id', model.motor_inferencia_id)
        db.session.commit()
        return jsonify(success=True, message='Modelo AA actualizado', data=model.to_dict())

    if request.method == 'DELETE':
        model.activo = False  # Soft delete
        db.session.commit()
        return jsonify(success=True, message='Modelo AA eliminado (desactivado)')

# ============================================================
# RUTAS: GESTIÓN DE MOTORES DE IA (REESTRUCTURADO)
# ============================================================

@admin_bp.route('/inference-engines', methods=['GET'])
@config_access_required
def get_inference_engines(current_user_id, current_user_role):
    engines = InferenceEngine.query.order_by(InferenceEngine.tipo).all()
    return jsonify(success=True, data=[engine.to_dict() for engine in engines])

@admin_bp.route('/inference-engines', methods=['POST'])
@admin_required
def create_inference_engine(current_admin_id):
    if 'archivo' not in request.files:
        return jsonify(success=False, error='No se proporcionó archivo'), 400
    
    file = request.files['archivo']
    if not file or not file.filename.endswith('.pt'):
        return jsonify(success=False, error='Solo archivos .pt son permitidos'), 400
    
    filename = secure_filename(file.filename)
    upload_path = os.path.join(DevelopmentConfig.UPLOAD_FOLDER, filename)
    os.makedirs(DevelopmentConfig.UPLOAD_FOLDER, exist_ok=True)
    file.save(upload_path)
    
    data = request.form
    new_engine = InferenceEngine(
        tipo=data.get('tipo'), version=data.get('version'),
        ruta_archivo=upload_path, tamaño_archivo=os.path.getsize(upload_path),
        creado_por_id=current_admin_id, descripcion=data.get('descripcion', '')
    )
    db.session.add(new_engine)
    db.session.commit()
    return jsonify(success=True, message='Motor de IA cargado', data=new_engine.to_dict()), 201

@admin_bp.route('/inference-engines/<int:engine_id>/activate', methods=['POST'])
@admin_required
def activate_inference_engine(current_admin_id, engine_id):
    InferenceEngine.query.update({'activo': False})
    db.session.commit()
    engine = InferenceEngine.query.get_or_404(engine_id)
    engine.activo = True
    db.session.commit()
    return jsonify(success=True, message=f'Motor {engine.tipo} v{engine.version} activado')

# ============================================================
# RUTAS: CONFIGURACIÓN GLOBAL (REESTRUCTURADO)
# ============================================================

@admin_bp.route('/settings', methods=['GET', 'PUT'])
@config_access_required
def handle_settings(current_user_id, current_user_role):
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
        db.session.commit()

    if request.method == 'GET':
        return jsonify(success=True, data=settings.to_dict())
    
    if request.method == 'PUT':
        data = request.get_json()
        settings.ac_model_activo_id = data.get('ac_model_activo_id')
        settings.permitir_registro_publico = data.get('permitir_registro_publico', False)
        db.session.commit()
        return jsonify(success=True, message='Configuración actualizada', data=settings.to_dict())