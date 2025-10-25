"""
Rutas de Administración - Panel de Configuración
Gestión de usuarios, modelos de AA, motores de IA y configuración
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
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
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'admin':
            return jsonify({
                'success': False,
                'error': 'Forbidden',
                'message': 'Solo administradores pueden acceder'
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function


def registrar_auditoria(usuario_id, accion, tabla, registro_id=None, detalles_anteriores='', detalles_nuevos=''):
    """Registra una acción en la auditoría"""
    log = AuditLog(
        usuario_id=usuario_id,
        accion=accion,
        tabla_afectada=tabla,
        registro_id=registro_id,
        detalles_anteriores=detalles_anteriores,
        detalles_nuevos=detalles_nuevos,
        ip_address=request.remote_addr
    )
    db.session.add(log)
    db.session.commit()


# ============================================================
# RUTAS: GESTIÓN DE USUARIOS
# ============================================================

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    """Obtener lista de todos los usuarios"""
    try:
        users = User.query.all()
        return jsonify({
            'success': True,
            'data': [user.to_dict() for user in users],
            'total': len(users)
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
                'error': 'Faltan datos requeridos'
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
            creado_por_id=get_jwt_identity()
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'CREAR',
            'users',
            new_user.id,
            detalles_nuevos=str(new_user.to_dict())
        )
        
        return jsonify({
            'success': True,
            'message': 'Usuario creado exitosamente',
            'data': new_user.to_dict()
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
        detalles_anteriores = str(user.to_dict())
        
        # Actualizar campos
        if 'email' in data:
            user.email = data['email']
        if 'team' in data:
            user.team = data['team']
        if 'role' in data:
            user.role = data['role']
        if 'password' in data:
            user.password_hash = generate_password_hash(data['password'])
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'ACTUALIZAR',
            'users',
            user_id,
            detalles_anteriores=detalles_anteriores,
            detalles_nuevos=str(user.to_dict())
        )
        
        return jsonify({
            'success': True,
            'message': 'Usuario actualizado exitosamente',
            'data': user.to_dict()
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
        
        detalles_anteriores = str(user.to_dict())
        user.is_active = False
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'DAR_DE_BAJA',
            'users',
            user_id,
            detalles_anteriores=detalles_anteriores,
            detalles_nuevos=str(user.to_dict())
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
        return jsonify({
            'success': True,
            'data': [model.to_dict() for model in models],
            'total': len(models)
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
        
        # Verificar que el motor existe
        motor = InferenceEngine.query.get(data['motor_inferencia_id'])
        if not motor:
            return jsonify({
                'success': False,
                'error': 'Motor de inferencia no encontrado'
            }), 404
        
        # Crear modelo
        new_model = ACModel(
            nombre=data['nombre'],
            descripcion=data.get('descripcion', ''),
            target_tornillos=data.get('target_tornillos', 24),
            confidence_threshold=data.get('confidence_threshold', 0.5),
            motor_inferencia_id=data['motor_inferencia_id'],
            creado_por_id=get_jwt_identity(),
            activo=True
        )
        
        db.session.add(new_model)
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'CREAR',
            'ac_models',
            new_model.id,
            detalles_nuevos=str(new_model.to_dict())
        )
        
        return jsonify({
            'success': True,
            'message': 'Modelo de AA creado exitosamente',
            'data': new_model.to_dict()
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
        detalles_anteriores = str(model.to_dict())
        
        # Actualizar campos
        if 'nombre' in data:
            model.nombre = data['nombre']
        if 'descripcion' in data:
            model.descripcion = data['descripcion']
        if 'target_tornillos' in data:
            model.target_tornillos = data['target_tornillos']
        if 'confidence_threshold' in data:
            model.confidence_threshold = data['confidence_threshold']
        if 'motor_inferencia_id' in data:
            model.motor_inferencia_id = data['motor_inferencia_id']
        
        model.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'ACTUALIZAR',
            'ac_models',
            model_id,
            detalles_anteriores=detalles_anteriores,
            detalles_nuevos=str(model.to_dict())
        )
        
        return jsonify({
            'success': True,
            'message': 'Modelo actualizado exitosamente',
            'data': model.to_dict()
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
        
        detalles_anteriores = str(model.to_dict())
        model.activo = False
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'ELIMINAR',
            'ac_models',
            model_id,
            detalles_anteriores=detalles_anteriores
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
        return jsonify({
            'success': True,
            'data': [engine.to_dict() for engine in engines],
            'total': len(engines)
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
            creado_por_id=get_jwt_identity(),
            activo=data.get('activo', False) == 'true',
            descripcion=data.get('descripcion', '')
        )
        
        db.session.add(new_engine)
        db.session.commit()
        
        # Registrar en auditoría
        registrar_auditoria(
            get_jwt_identity(),
            'CARGAR',
            'inference_engines',
            new_engine.id,
            detalles_nuevos=f"Tipo: {new_engine.tipo}, Versión: {new_engine.version}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Motor de IA cargado exitosamente',
            'data': new_engine.to_dict()
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
            get_jwt_identity(),
            'ACTIVAR',
            'inference_engines',
            engine_id,
            detalles_nuevos=f"Motor {engine.tipo} v{engine.version} activado"
        )
        
        return jsonify({
            'success': True,
            'message': 'Motor activado exitosamente',
            'data': engine.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500