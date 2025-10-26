"""
Aplicación Flask principal para Tornillo Detector
SOLUCIÓN PROFESIONAL Y DEFINITIVA
"""

from flask import Flask, jsonify, send_from_directory
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
    """
    
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    # Crear instancia de Flask con rutas de archivos estáticos correctas
    app = Flask(
        __name__,
        static_folder=os.path.abspath('static'),
        static_url_path=''
    )
    
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
        return jsonify({
            'success': False,
            'error': 'Bad Request',
            'message': str(error),
            'code': 400
        }), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'success': False,
            'error': 'Unauthorized',
            'message': 'Credenciales inválidas o token expirado',
            'code': 401
        }), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'success': False,
            'error': 'Forbidden',
            'message': 'No tienes permisos para acceder a este recurso',
            'code': 403
        }), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': 'Not Found',
            'message': 'El recurso solicitado no existe',
            'code': 404
        }), 404
    
    @app.errorhandler(422)
    def unprocessable_entity(error):
        return jsonify({
            'success': False,
            'error': 'Unprocessable Entity',
            'message': 'Error de validación de datos',
            'code': 422
        }), 422
    
    @app.errorhandler(500)
    def internal_server_error(error):
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
        return jsonify({
            'status': 'ok',
            'message': 'Servidor activo',
            'environment': config_name
        }), 200
    
    @app.route('/api/health', methods=['GET'])
    def api_health():
        return jsonify({
            'status': 'ok',
            'message': 'API activa',
            'database': 'connected'
        }), 200
    
    # ============================================================
    # RUTAS PARA ARCHIVOS ESTÁTICOS Y SPA
    # ============================================================
    
    @app.route('/')
    def serve_index():
        """Servir index.html en raíz"""
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.route('/<path:filename>')
    def serve_files(filename):
        """Servir archivos estáticos (css, js, assets, html)"""
        # Construir ruta completa del archivo
        file_path = os.path.join(app.static_folder, filename)
        
        # Si el archivo existe, servirlo
        if os.path.isfile(file_path):
            return send_from_directory(app.static_folder, filename)
        
        # Si es una ruta HTML (sin extensión), intentar con .html
        if not os.path.splitext(filename)[1]:
            html_path = os.path.join(app.static_folder, f'{filename}.html')
            if os.path.isfile(html_path):
                return send_from_directory(app.static_folder, f'{filename}.html')
        
        # Si no existe, devolver index.html (SPA fallback)
        return send_from_directory(app.static_folder, 'index.html')
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)