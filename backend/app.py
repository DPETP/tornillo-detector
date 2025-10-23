from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Inicializar extensiones
jwt = JWTManager()

def create_app(config_name=None):
    """Factory para crear la aplicación Flask"""
    
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    
    # Cargar configuración
    app.config.from_object(config[config_name])
    
    # Importar db DESPUÉS de crear app
    from database.models import db
    
    # Inicializar extensiones
    db.init_app(app)
    jwt.init_app(app)
    CORS(app)
    
    # Registrar blueprints (rutas)
    from routes.auth import auth_bp
    from routes.detection import detection_bp
    from routes.dashboard import dashboard_bp
    from routes.history import history_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(detection_bp, url_prefix='/api/detection')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(history_bp, url_prefix='/api/history')
    
    # Crear tablas
    with app.app_context():
        db.create_all()
    
    @app.route('/health', methods=['GET'])
    def health():
        return {'status': 'ok'}, 200
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)