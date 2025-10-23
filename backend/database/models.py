from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    """Modelo de usuario"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    team = db.Column(db.String(80), nullable=False)
    role = db.Column(db.String(20), default='operator')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    detections = db.relationship('Detection', backref='user', lazy=True)
    
    def __repr__(self):
        return f'<User {self.username}>'


class Detection(db.Model):
    """Modelo para registrar detecciones"""
    __tablename__ = 'detections'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    detection_count = db.Column(db.Integer, default=0)
    image_path = db.Column(db.String(255))
    camera_source = db.Column(db.String(80), default='webcam')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Detection {self.id} - {self.status}>'


class EquipmentMetrics(db.Model):
    """Modelo para métricas por equipo"""
    __tablename__ = 'equipment_metrics'
    
    id = db.Column(db.Integer, primary_key=True)
    team = db.Column(db.String(80), nullable=False, unique=True)
    total_inspections = db.Column(db.Integer, default=0)
    passed = db.Column(db.Integer, default=0)
    failed = db.Column(db.Integer, default=0)
    pass_rate = db.Column(db.Float, default=0.0)
    average_confidence = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<EquipmentMetrics {self.team}>'


class SystemLog(db.Model):
    """Modelo para logs del sistema"""
    __tablename__ = 'system_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    level = db.Column(db.String(20))
    message = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SystemLog {self.level}>'