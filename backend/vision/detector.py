# =================================================================
#    CÓDIGO CORREGIDO Y PROFESIONAL para backend/vision/detector.py
# =================================================================
from ultralytics import YOLO
import os
# Importamos la librería pathlib para manejo de rutas robusto
from pathlib import Path

class YOLODetector:
    def __init__(self, model_filename='best.pt'):
        """
        Inicializa el detector YOLO. Carga el modelo una sola vez.
        Soporta YOLOv5, YOLOv8, YOLOv11 y RT-DETR.
        """
        # 1. Obtener la ruta del archivo actual (__file__) -> C:\...\backend\vision\detector.py
        current_file_path = Path(__file__)
        
        # 2. Obtener el directorio padre de este archivo -> C:\...\backend\vision
        vision_dir = current_file_path.parent
        
        # 3. Obtener el directorio backend (subiendo un nivel: de 'vision' a 'backend')
        backend_dir = vision_dir.parent
        
        # 4. Construir la ruta final al modelo en backend/uploads/
        absolute_model_path = backend_dir / 'uploads' / model_filename

        if not absolute_model_path.is_file():
            raise FileNotFoundError(f"El modelo no se encontró en la ruta: {absolute_model_path}")
            
        print(f"Cargando modelo desde: {absolute_model_path}")
        self.model = YOLO(absolute_model_path)
        self.model_filename = model_filename
        print(f"Modelo YOLO cargado exitosamente: {model_filename}")

    def detect(self, frame):
        """
        Realiza la detección en un frame de imagen.
        Parámetros optimizados para mejorar detección de tornillos pequeños.
        """
        try:
            # Configuración optimizada para detección de objetos pequeños
            results = self.model(
                frame, 
                verbose=False,           # Salida limpia
                conf=0.10,               # Umbral de confianza muy bajo - filtrado se hace en frontend
                iou=0.45,                # Non-Maximum Suppression - evitar superposiciones
                max_det=300,             # Máximo de detecciones permitidas
                imgsz=640                # Tamaño de imagen para inferencia
            )
            detections = []
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    confidence = box.conf[0]
                    cls = box.cls[0]
                    
                    detections.append({
                        "box": [int(x1), int(y1), int(x2), int(y2)],
                        "confidence": float(confidence),
                        "class_name": self.model.names[int(cls)]
                    })
            
            return detections
        except Exception as e:
            print(f"❌ Error en detección YOLO: {str(e)}")
            import traceback
            traceback.print_exc()
            return []