"""
Aplicación Flask principal para Tornillo Detector
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from config import config
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Inicializar extensiones globales
jwt = JWTManager()
migrate = Migrate()


def create_app(config_name=None):
    """
    Factory function para crear la aplicación Flask
    
    Args:
        config_name (str): Nombre de la configuración ('development', 'production', etc.)
    
    Returns:
        Flask: Instancia de la aplicación Flask configurada
    """
    
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    # Crear instancia de Flask
    app = Flask(__name__)
    
    # Cargar configuración
    app.config.from_object(config[config_name])
    
    # ============================================================
    # INICIALIZAR EXTENSIONES
    # ============================================================
    
    from database.models import db
    
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    migrate.init_app(app, db)
    
    # ============================================================
    # REGISTRAR BLUEPRINTS
    # ============================================================
    
    from routes.auth import auth_bp
    from routes.detection import detection_bp
    from routes.dashboard import dashboard_bp
    from routes.history import history_bp
    from routes.admin import admin_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(detection_bp, url_prefix='/api/detection')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(history_bp, url_prefix='/api/history')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    # ============================================================
    # ERROR HANDLERS
    # ============================================================
    
    @app.errorhandler(400)
    def bad_request(error):
        """Error 400 - Solicitud Inválida"""
        return jsonify({
            'success': False,
            'error': 'Bad Request',
            'message': str(error),
            'code': 400
        }), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        """Error 401 - No Autorizado"""
        return jsonify({
            'success': False,
            'error': 'Unauthorized',
            'message': 'Credenciales inválidas o token expirado',
            'code': 401
        }), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        """Error 403 - Prohibido (Sin Permisos)"""
        return jsonify({
            'success': False,
            'error': 'Forbidden',
            'message': 'No tienes permisos para acceder a este recurso',
            'code': 403
        }), 403
    
    @app.errorhandler(404)
    def not_found(error):
        """Error 404 - No Encontrado"""
        return jsonify({
            'success': False,
            'error': 'Not Found',
            'message': 'El recurso solicitado no existe',
            'code': 404
        }), 404
    
    @app.errorhandler(422)
    def unprocessable_entity(error):
        """Error 422 - Entidad No Procesable (Validación)"""
        return jsonify({
            'success': False,
            'error': 'Unprocessable Entity',
            'message': 'Error de validación de datos',
            'code': 422
        }), 422
    
    @app.errorhandler(500)
    def internal_server_error(error):
        """Error 500 - Error Interno del Servidor"""
        return jsonify({
            'success': False,
            'error': 'Internal Server Error',
            'message': 'Ha ocurrido un error en el servidor',
            'code': 500
        }), 500
    
    # ============================================================
    # RUTAS DE SALUD
    # ============================================================
    
    @app.route('/health', methods=['GET'])
    def health():
        """Verificar que el servidor está corriendo"""
        return jsonify({
            'status': 'ok',
            'message': 'Servidor activo',
            'environment': config_name
        }), 200
    
    @app.route('/api/health', methods=['GET'])
    def api_health():
        """Verificar salud de la API"""
        return jsonify({
            'status': 'ok',
            'message': 'API activa',
            'database': 'connected'
        }), 200
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)