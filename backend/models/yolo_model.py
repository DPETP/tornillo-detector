from ultralytics import YOLO
import cv2
import numpy as np
from config import Config

class YOLODetector:
    """Clase para manejar el modelo YOLO"""
    
    def __init__(self, model_path=None, confidence=None):
        """
        Inicializar el detector YOLO
        
        Args:
            model_path: Ruta al modelo YOLO
            confidence: Umbral de confianza para detecciones
        """
        self.model_path = model_path or Config.YOLO_MODEL_PATH
        self.confidence = confidence or Config.YOLO_CONFIDENCE
        
        # Cargar modelo
        try:
            self.model = YOLO(self.model_path)
            print(f"✓ Modelo YOLO cargado: {self.model_path}")
        except Exception as e:
            print(f"✗ Error cargando modelo YOLO: {e}")
            self.model = None
    
    def detect(self, frame):
        """
        Realizar detección en un frame
        
        Args:
            frame: Imagen capturada de la cámara
            
        Returns:
            dict: Resultados de la detección
        """
        if self.model is None:
            return {
                'success': False,
                'detections': [],
                'confidence_threshold': self.confidence,
                'error': 'Modelo no cargado'
            }
        
        try:
            # Ejecutar detección
            results = self.model(frame, conf=self.confidence)
            
            detections = []
            for result in results:
                boxes = result.boxes
                
                for box in boxes:
                    detection = {
                        'class': int(box.cls[0]),
                        'confidence': float(box.conf[0]),
                        'bbox': [
                            float(box.xyxy[0][0]),
                            float(box.xyxy[0][1]),
                            float(box.xyxy[0][2]),
                            float(box.xyxy[0][3])
                        ]
                    }
                    detections.append(detection)
            
            return {
                'success': True,
                'detections': detections,
                'confidence_threshold': self.confidence,
                'frame_shape': frame.shape
            }
        
        except Exception as e:
            return {
                'success': False,
                'detections': [],
                'error': str(e)
            }
    
    def draw_detections(self, frame, detections):
        """
        Dibujar detecciones en el frame
        
        Args:
            frame: Imagen original
            detections: Lista de detecciones
            
        Returns:
            np.ndarray: Frame con anotaciones
        """
        frame_copy = frame.copy()
        
        for det in detections:
            x1, y1, x2, y2 = det['bbox']
            confidence = det['confidence']
            
            # Dibujar rectángulo
            cv2.rectangle(
                frame_copy,
                (int(x1), int(y1)),
                (int(x2), int(y2)),
                (0, 255, 0),
                2
            )
            
            # Dibujar label
            label = f"Tornillo: {confidence:.2f}"
            cv2.putText(
                frame_copy,
                label,
                (int(x1), int(y1) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2
            )
        
        return frame_copy