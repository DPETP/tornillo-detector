# =================================================================
#      CÓDIGO COMPLETO Y CORREGIDO PARA backend/routes/auth.py
# =================================================================

from flask import Blueprint, request, jsonify
# Asegúrate de tener get_jwt en tus imports de flask_jwt_extended
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from ..database.models import db, User

auth_bp = Blueprint('auth', __name__)

# ============================================================
#         REEMPLAZA LA FUNCIÓN login EN auth.py
# ============================================================
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Usuario o contraseña incompletos'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'success': False, 'message': 'Usuario o contraseña inválidos'}), 401
    
    if not user.is_active:
        return jsonify({'success': False, 'message': 'La cuenta de usuario está inactiva'}), 403
    
    # --- AÑADIMOS EL 'team' A LOS CLAIMS DEL TOKEN ---
    additional_claims = {
        "role": user.role,
        "team": user.team  # <-- ¡AÑADIDO!
    }

    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    
    return jsonify({
        'success': True,
        'message': 'Sesión iniciada correctamente',
        'access_token': access_token,
        'user': user.to_dict() # Suponiendo que tu modelo User tiene to_dict()
    }), 200


@auth_bp.route('/register', methods=['POST'])
def register():
    """Registrar nuevo usuario"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'success': False, 'message': 'Datos incompletos'}), 400
    
    if User.query.filter_by(username=data['username']).first() or User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'El nombre de usuario o el email ya existen'}), 409
    
    try:
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            team=data.get('team', 'Default'),
            role=data.get('role', 'operario') # Asegúrate que el rol por defecto sea 'operario'
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Usuario registrado exitosamente',
            'user_id': user.id
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_profile():
    """Obtener perfil del usuario actual a partir del token."""
    # get_jwt_identity() nos da el 'identity' que guardamos al crear el token (el user.id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
    
    # Adicionalmente, podemos verificar la información del token
    claims = get_jwt()
    
    return jsonify({
        'success': True,
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'team': user.team,
        'role': claims.get('role', user.role) # Tomar el rol del token es más rápido
    }), 200