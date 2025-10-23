import os
from datetime import timedelta

class Config:
    """Configuración base"""
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # Base de datos - usar ruta relativa
    db_path = os.path.join(os.path.dirname(__file__), 'tornillo_detector.db')
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{db_path}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # YOLO
    YOLO_MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'models/yolo_model.pt')
    YOLO_CONFIDENCE = float(os.getenv('YOLO_CONFIDENCE', 0.5))
    
    # Cámara
    CAMERA_INDEX = int(os.getenv('CAMERA_INDEX', 0))
    FRAME_RATE = int(os.getenv('FRAME_RATE', 30))
    
    # Rutas
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024


class DevelopmentConfig(Config):
    """Configuración para desarrollo"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Configuración para producción"""
    DEBUG = False
    TESTING = False


class TestingConfig(Config):
    """Configuración para testing"""
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}