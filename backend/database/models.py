"""
Database Models - Tornillo Detector
Sistema de detección de tornillos con soporte para múltiples modelos de AA
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from .env_config import metadata
import json

db = SQLAlchemy(
    metadata=metadata,
    session_options={
        'expire_on_commit': False
    }
)

# ============================================================
# MODELO: User (Usuario del Sistema)
# ============================================================

class User(db.Model):
    """
    Modelo de Usuario con soporte para roles, auditoría y gestión de acceso.
    
    Roles:
    - admin: Acceso total
    - soporte_tecnico: Lectura y tareas de mantenimiento
    - operario: Solo detección y visualización
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    team = db.Column(db.String(80), nullable=False, default='Default Team')
    role = db.Column(db.String(20), nullable=False, default='operario')
    is_active = db.Column(db.Boolean, default=True, index=True)
    creado_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    detections = db.relationship('Detection', back_populates='usuario', cascade='all, delete-orphan')
    modelos_cargados = db.relationship('InferenceEngine', back_populates='creado_por')
    ac_models_creados = db.relationship('ACModel', back_populates='creado_por')
    
    def __repr__(self):
        return f'<User {self.username} ({self.role})>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'team': self.team,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


# ============================================================
# MODELO: InferenceEngine (Motores de IA)
# ============================================================

class InferenceEngine(db.Model):
    """
    Modelos de motores de IA disponibles (YOLO, Mask R-CNN, RT-DETR)
    Permite cambiar entre diferentes motores sin perder datos
    """
    __tablename__ = 'inference_engines'
    
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(50), nullable=False, index=True)  # yolo, mask_rcnn, rtdetr
    version = db.Column(db.String(20), nullable=False)  # ej: "8.0", "1.0"
    ruta_archivo = db.Column(db.String(255), nullable=False)
    tamaño_archivo = db.Column(db.Integer, default=0)  # en bytes
    fecha_carga = db.Column(db.DateTime, default=datetime.utcnow)
    creado_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    activo = db.Column(db.Boolean, default=False, index=True)
    descripcion = db.Column(db.Text, default='')
    hash_archivo = db.Column(db.String(64), nullable=True)  # SHA256 para validación
    
    # Relaciones
    creado_por = db.relationship('User', back_populates='modelos_cargados')
    ac_models = db.relationship('ACModel', back_populates='motor_inferencia')
    detections = db.relationship('Detection', back_populates='motor_inferencia')
    
    def __repr__(self):
        return f'<InferenceEngine {self.tipo} v{self.version}>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'tipo': self.tipo,
            'version': self.version,
            'activo': self.activo,
            'tamaño_archivo': self.tamaño_archivo,
            'descripcion': self.descripcion,
            'fecha_carga': self.fecha_carga.isoformat()
        }


# ============================================================
# MODELO: ACModel (Modelo de Aire Acondicionado)
# ============================================================

class ACModel(db.Model):
    """
    Configuración por modelo de Aire Acondicionado
    Permite guardar configuraciones y reutilizarlas
    """
    __tablename__ = 'ac_models'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False, unique=True, index=True)
    descripcion = db.Column(db.Text, default='')
    target_tornillos = db.Column(db.Integer, nullable=False, default=24)
    confidence_threshold = db.Column(db.Float, nullable=False, default=0.5)
    inspection_cycle_time = db.Column(db.Integer, default=20) # Tiempo en segundos por defecto
    motor_inferencia_id = db.Column(db.Integer, db.ForeignKey('inference_engines.id'), nullable=False)
    creado_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    activo = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    motor_inferencia = db.relationship('InferenceEngine', back_populates='ac_models')
    creado_por = db.relationship('User', back_populates='ac_models_creados')
    detections = db.relationship('Detection', back_populates='ac_model')
    
    def __repr__(self):
        return f'<ACModel {self.nombre}>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'target_tornillos': self.target_tornillos,
            'confidence_threshold': self.confidence_threshold,
            'inspection_cycle_time': self.inspection_cycle_time,
            'motor_inferencia_id': self.motor_inferencia_id,
            'activo': self.activo,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


# ============================================================
# MODELO: Detection (Registro de Detecciones)
# ============================================================

class Detection(db.Model):
    """
    Registro detallado de cada detección realizada
    Incluye métricas para análisis y auditoría
    """
    __tablename__ = 'detections'
    
    id = db.Column(db.Integer, primary_key=True)
    ac_model_id = db.Column(db.Integer, db.ForeignKey('ac_models.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    motor_inferencia_id = db.Column(db.Integer, db.ForeignKey('inference_engines.id'), nullable=False)
    team = db.Column(db.String(80), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default='PENDING', index=True)  # PASS, FAIL
    confidence = db.Column(db.Float, nullable=False, default=0.0)
    detection_count = db.Column(db.Integer, default=0)  # Tornillos detectados
    expected_count = db.Column(db.Integer, default=0)  # Tornillos esperados
    diferencia = db.Column(db.Integer, default=0)  # expected - detection
    image_path = db.Column(db.String(255), nullable=True)  # Path a screenshot
    duracion_inferencia = db.Column(db.Float, default=0.0)  # ms
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relaciones
    ac_model = db.relationship('ACModel', back_populates='detections')
    usuario = db.relationship('User', back_populates='detections')
    motor_inferencia = db.relationship('InferenceEngine', back_populates='detections')
    
    def __repr__(self):
        return f'<Detection {self.id} - {self.status}>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'ac_model_id': self.ac_model_id,
            'user_id': self.user_id,
            'status': self.status,
            'confidence': round(self.confidence, 4),
            'detection_count': self.detection_count,
            'expected_count': self.expected_count,
            'diferencia': self.diferencia,
            'duracion_inferencia': self.duracion_inferencia,
            'timestamp': self.timestamp.isoformat()
        }


# ============================================================
# MODELO: EquipmentMetrics (Métricas por Equipo)
# ============================================================

class EquipmentMetrics(db.Model):
    """Métricas agregadas por equipo de trabajo"""
    __tablename__ = 'equipment_metrics'
    
    id = db.Column(db.Integer, primary_key=True)
    team = db.Column(db.String(80), nullable=False, unique=True, index=True)
    total_inspections = db.Column(db.Integer, default=0)
    passed = db.Column(db.Integer, default=0)
    failed = db.Column(db.Integer, default=0)
    pass_rate = db.Column(db.Float, default=0.0)
    average_confidence = db.Column(db.Float, default=0.0)
    average_inference_time = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<EquipmentMetrics {self.team}>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'team': self.team,
            'total_inspections': self.total_inspections,
            'passed': self.passed,
            'failed': self.failed,
            'pass_rate': round(self.pass_rate, 2),
            'average_confidence': round(self.average_confidence, 4),
            'average_inference_time': round(self.average_inference_time, 3)
        }


# ============================================================
# MODELO: SystemLog (Logs del Sistema)
# ============================================================

class SystemLog(db.Model):
    """Logs de eventos del sistema"""
    __tablename__ = 'system_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    level = db.Column(db.String(20), nullable=False, default='INFO', index=True)
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f'<SystemLog [{self.level}]>'


# ============================================================
# MODELO: Settings (Configuración Global)
# ============================================================

class Settings(db.Model):
    """Configuración global de la aplicación"""
    __tablename__ = 'settings'
    
    id = db.Column(db.Integer, primary_key=True)
    ac_model_activo_id = db.Column(db.Integer, db.ForeignKey('ac_models.id'), nullable=True)
    permitir_registro_publico = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    ac_model_activo = db.relationship('ACModel')
    
    def __repr__(self):
        return f'<Settings>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'ac_model_activo_id': self.ac_model_activo_id,
            'permitir_registro_publico': self.permitir_registro_publico
        }


# ============================================================
# MODELO: AuditLog (Auditoría)
# ============================================================

class AuditLog(db.Model):
    """Registro de auditoría de todas las acciones sensibles"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    accion = db.Column(db.String(120), nullable=False, index=True)
    descripcion = db.Column(db.Text, default='')
    tabla_afectada = db.Column(db.String(50), nullable=False, index=True)
    registro_id = db.Column(db.Integer, nullable=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    ip_address = db.Column(db.String(45), nullable=True)
    detalles_anteriores = db.Column(db.Text, default='')  # JSON
    detalles_nuevos = db.Column(db.Text, default='')  # JSON
    
    def __repr__(self):
        return f'<AuditLog {self.accion}>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'usuario_id': self.usuario_id,
            'accion': self.accion,
            'descripcion': self.descripcion,
            'tabla_afectada': self.tabla_afectada,
            'fecha': self.fecha.isoformat(),
            'ip_address': self.ip_address
        }