"""
Rutas de Administración - Panel de Configuración
Gestión de usuarios, modelos de AA, motores de IA y configuración
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from functools import wraps

# Importar modelos
from database.models import db, User, ACModel, InferenceEngine, AuditLog, Settings
from config import DevelopmentConfig

admin_bp = Blueprint('admin', __name__)

# ============================================================
# DECORADORES
# ============================================================

def admin_required(f):
    """Decorador para verificar que el usuario es admin"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = int(get_jwt_identity())
            user = User.query.get(current_user_id)
            
            if not user or user.role != 'admin':
                return jsonify({
                    'success': False,
                    'error': 'Forbidden',
                    'message': 'Solo administradores pueden acceder'
                }), 403
        except Exception as e:
            return jsonify({
                'success': False,
                'error': 'Error validando token',
                'message': str(e)
            }), 401
        
        return f(*args, **kwargs)
    return decorated_function


def registrar_auditoria(usuario_id, accion, tabla, registro_id=None, detalles_anteriores='', detalles_nuevos=''):
    """Registra una acción en la auditoría"""
    try:
        log = AuditLog(
            usuario_id=int(usuario_id),
            accion=accion,
            tabla_afectada=tabla,
            registro_id=registro_id,
            detalles_anteriores=detalles_anteriores,
            detalles_nuevos=detalles_nuevos,
            ip_address=request.remote_addr
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"Error en auditoría: {e}")
        pass


# ============================================================
# RUTAS: GESTIÓN DE USUARIOS
# ============================================================

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    """Obtener lista de todos los usuarios"""
    try:
        users = User.query.all()
        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'team': user.team,
                'is_active': user.is_active
            })
        
        return jsonify({
            'success': True,
            'data': users_data,
            'total': len(users_data)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/users', methods=['POST'])
@admin_required
def create_user():
    """Crear nuevo usuario"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data.get('username') or not data.get('email') or not data.get('password'):
            return jsonify({
                'success': False,
                'error': 'Faltan datos requeridos (username, email, password)'
            }), 400
        
        # Verificar si usuario ya existe
        if User.query.filter_by(username=data['username']).first():
            return jsonify({
                'success': False,
                'error': 'El usuario ya existe'
            }), 409
        
        # Crear usuario
        new_user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            team=data.get('team', 'Default Team'),
            role=data.get('role', 'operario'),
            is_active=True,
            creado_por_id=int(get_jwt_identity())
        )
        
        db.session.add(new_user)
        db.session.flush()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'CREAR',
            'users',
            new_user.id,
            detalles_nuevos=f"Usuario: {new_user.username}, Email: {new_user.email}"
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Usuario creado exitosamente',
            'data': {
                'id': new_user.id,
                'username': new_user.username,
                'email': new_user.email,
                'role': new_user.role,
                'team': new_user.team,
                'is_active': new_user.is_active
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Modificar usuario"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': 'Usuario no encontrado'
            }), 404
        
        data = request.get_json()
        detalles_anteriores = f"Usuario: {user.username}, Email: {user.email}, Rol: {user.role}"
        
        # Actualizar campos
        if 'email' in data:
            user.email = data['email']
        if 'team' in data:
            user.team = data['team']
        if 'role' in data:
            user.role = data['role']
        if 'password' in data and data['password']:
            user.password_hash = generate_password_hash(data['password'])
        
        user.updated_at = datetime.utcnow()
        
        detalles_nuevos = f"Usuario: {user.username}, Email: {user.email}, Rol: {user.role}"
        
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'ACTUALIZAR',
            'users',
            user_id,
            detalles_anteriores=detalles_anteriores,
            detalles_nuevos=detalles_nuevos
        )
        
        return jsonify({
            'success': True,
            'message': 'Usuario actualizado exitosamente',
            'data': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'team': user.team,
                'is_active': user.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/users/<int:user_id>/deactivate', methods=['POST'])
@admin_required
def deactivate_user(user_id):
    """Dar de baja un usuario (soft delete)"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': 'Usuario no encontrado'
            }), 404
        
        detalles_anteriores = f"Usuario: {user.username}, Estado: Activo"
        user.is_active = False
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'DAR_DE_BAJA',
            'users',
            user_id,
            detalles_anteriores=detalles_anteriores,
            detalles_nuevos=f"Usuario: {user.username}, Estado: Inactivo"
        )
        
        return jsonify({
            'success': True,
            'message': 'Usuario dado de baja exitosamente'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# RUTAS: GESTIÓN DE MODELOS DE AA
# ============================================================

@admin_bp.route('/ac-models', methods=['GET'])
@admin_required
def get_ac_models():
    """Obtener lista de modelos de AA"""
    try:
        models = ACModel.query.filter_by(activo=True).all()
        models_data = []
        for model in models:
            models_data.append({
                'id': model.id,
                'nombre': model.nombre,
                'descripcion': model.descripcion,
                'target_tornillos': model.target_tornillos,
                'confidence_threshold': model.confidence_threshold,
                'motor_inferencia_id': model.motor_inferencia_id,
                'activo': model.activo
            })
        
        return jsonify({
            'success': True,
            'data': models_data,
            'total': len(models_data)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/ac-models', methods=['POST'])
@admin_required
def create_ac_model():
    """Crear nuevo modelo de AA"""
    try:
        data = request.get_json()
        
        # Validar datos
        if not data.get('nombre') or not data.get('motor_inferencia_id'):
            return jsonify({
                'success': False,
                'error': 'Faltan datos requeridos'
            }), 400
        
        # Crear modelo
        new_model = ACModel(
            nombre=data['nombre'],
            descripcion=data.get('descripcion', ''),
            target_tornillos=data.get('target_tornillos', 24),
            confidence_threshold=data.get('confidence_threshold', 0.5),
            motor_inferencia_id=data['motor_inferencia_id'],
            creado_por_id=int(get_jwt_identity()),
            activo=True
        )
        
        db.session.add(new_model)
        db.session.flush()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'CREAR',
            'ac_models',
            new_model.id,
            detalles_nuevos=f"Modelo: {new_model.nombre}"
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Modelo de AA creado exitosamente',
            'data': {
                'id': new_model.id,
                'nombre': new_model.nombre,
                'target_tornillos': new_model.target_tornillos,
                'confidence_threshold': new_model.confidence_threshold
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/ac-models/<int:model_id>', methods=['PUT'])
@admin_required
def update_ac_model(model_id):
    """Actualizar modelo de AA"""
    try:
        model = ACModel.query.get(model_id)
        if not model:
            return jsonify({
                'success': False,
                'error': 'Modelo no encontrado'
            }), 404
        
        data = request.get_json()
        
        # Actualizar campos
        if 'nombre' in data:
            model.nombre = data['nombre']
        if 'descripcion' in data:
            model.descripcion = data['descripcion']
        if 'target_tornillos' in data:
            model.target_tornillos = data['target_tornillos']
        if 'confidence_threshold' in data:
            model.confidence_threshold = data['confidence_threshold']
        
        model.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'ACTUALIZAR',
            'ac_models',
            model_id,
            detalles_nuevos=f"Modelo: {model.nombre}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Modelo actualizado exitosamente'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/ac-models/<int:model_id>', methods=['DELETE'])
@admin_required
def delete_ac_model(model_id):
    """Eliminar modelo de AA (soft delete)"""
    try:
        model = ACModel.query.get(model_id)
        if not model:
            return jsonify({
                'success': False,
                'error': 'Modelo no encontrado'
            }), 404
        
        model.activo = False
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'ELIMINAR',
            'ac_models',
            model_id,
            detalles_nuevos=f"Modelo: {model.nombre} eliminado"
        )
        
        return jsonify({
            'success': True,
            'message': 'Modelo eliminado exitosamente'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# RUTAS: GESTIÓN DE MOTORES DE IA
# ============================================================

@admin_bp.route('/inference-engines', methods=['GET'])
@admin_required
def get_inference_engines():
    """Obtener lista de motores de IA"""
    try:
        engines = InferenceEngine.query.all()
        engines_data = []
        for engine in engines:
            engines_data.append({
                'id': engine.id,
                'tipo': engine.tipo,
                'version': engine.version,
                'tamaño_archivo': engine.tamaño_archivo,
                'activo': engine.activo,
                'descripcion': engine.descripcion
            })
        
        return jsonify({
            'success': True,
            'data': engines_data,
            'total': len(engines_data)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/inference-engines', methods=['POST'])
@admin_required
def create_inference_engine():
    """Crear nuevo motor de IA"""
    try:
        # Obtener archivo
        if 'archivo' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No se proporcionó archivo'
            }), 400
        
        file = request.files['archivo']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'Archivo vacío'
            }), 400
        
        # Validar extensión
        if not file.filename.endswith('.pt'):
            return jsonify({
                'success': False,
                'error': 'Solo archivos .pt son permitidos'
            }), 400
        
        # Validar tamaño (500MB máximo)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        if file_size > 500 * 1024 * 1024:
            return jsonify({
                'success': False,
                'error': 'Archivo muy grande (máximo 500MB)'
            }), 400
        
        file.seek(0)
        
        # Guardar archivo
        filename = secure_filename(file.filename)
        upload_path = os.path.join(DevelopmentConfig.UPLOAD_FOLDER, filename)
        os.makedirs(DevelopmentConfig.UPLOAD_FOLDER, exist_ok=True)
        file.save(upload_path)
        
        # Crear registro
        data = request.form
        new_engine = InferenceEngine(
            tipo=data.get('tipo'),
            version=data.get('version'),
            ruta_archivo=upload_path,
            tamaño_archivo=file_size,
            creado_por_id=int(get_jwt_identity()),
            activo=data.get('activo', False) == 'true',
            descripcion=data.get('descripcion', '')
        )
        
        db.session.add(new_engine)
        db.session.flush()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'CARGAR',
            'inference_engines',
            new_engine.id,
            detalles_nuevos=f"Tipo: {new_engine.tipo}, Versión: {new_engine.version}"
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Motor de IA cargado exitosamente',
            'data': {
                'id': new_engine.id,
                'tipo': new_engine.tipo,
                'version': new_engine.version
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/inference-engines/<int:engine_id>/activate', methods=['POST'])
@admin_required
def activate_inference_engine(engine_id):
    """Activar un motor de IA"""
    try:
        # Desactivar todos los demás
        InferenceEngine.query.update({'activo': False})
        
        # Activar el seleccionado
        engine = InferenceEngine.query.get(engine_id)
        if not engine:
            return jsonify({
                'success': False,
                'error': 'Motor no encontrado'
            }), 404
        
        engine.activo = True
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'ACTIVAR',
            'inference_engines',
            engine_id,
            detalles_nuevos=f"Motor {engine.tipo} v{engine.version} activado"
        )
        
        return jsonify({
            'success': True,
            'message': 'Motor activado exitosamente'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# RUTAS: CONFIGURACIÓN GLOBAL
# ============================================================

@admin_bp.route('/settings', methods=['GET'])
@admin_required
def get_settings():
    """Obtener configuración global"""
    try:
        settings = Settings.query.first()
        if not settings:
            settings = Settings()
            db.session.add(settings)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'id': settings.id,
                'ac_model_activo_id': settings.ac_model_activo_id,
                'permitir_registro_publico': settings.permitir_registro_publico
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_bp.route('/settings', methods=['PUT'])
@admin_required
def update_settings():
    """Actualizar configuración global"""
    try:
        settings = Settings.query.first()
        if not settings:
            settings = Settings()
        
        data = request.get_json()
        
        # Actualizar campos
        if 'ac_model_activo_id' in data:
            settings.ac_model_activo_id = data['ac_model_activo_id']
        if 'permitir_registro_publico' in data:
            settings.permitir_registro_publico = data['permitir_registro_publico']
        
        settings.updated_at = datetime.utcnow()
        db.session.add(settings)
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            int(get_jwt_identity()),
            'ACTUALIZAR',
            'settings',
            settings.id,
            detalles_nuevos='Configuración actualizada'
        )
        
        return jsonify({
            'success': True,
            'message': 'Configuración actualizada exitosamente',
            'data': {
                'id': settings.id,
                'ac_model_activo_id': settings.ac_model_activo_id,
                'permitir_registro_publico': settings.permitir_registro_publico
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500