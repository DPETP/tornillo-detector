from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from database.models import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Iniciar sesión"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Usuario o contraseña incompletos'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Usuario o contraseña inválidos'}), 401
    
    if not user.is_active:
        return jsonify({'message': 'Usuario inactivo'}), 401
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': 'Sesión iniciada',
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'team': user.team,
            'role': user.role
        }
    }), 200


@auth_bp.route('/register', methods=['POST'])
def register():
    """Registrar nuevo usuario"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'message': 'Datos incompletos'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Usuario ya existe'}), 409
    
    try:
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            team=data.get('team', 'Default'),
            role=data.get('role', 'operator')
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Usuario registrado exitosamente',
            'user_id': user.id
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_profile():
    """Obtener perfil del usuario actual"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'Usuario no encontrado'}), 404
    
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'team': user.team,
        'role': user.role
    }), 200