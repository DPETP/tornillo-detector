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
        """
        # 1. Obtener la ruta del archivo actual (__file__) -> C:\...\backend\vision\detector.py
        current_file_path = Path(__file__)
        
        # 2. Obtener el directorio padre de este archivo -> C:\...\backend\vision
        vision_dir = current_file_path.parent
        
        # 3. Obtener el directorio raíz del proyecto (subiendo dos niveles: de 'vision' a 'backend', y de 'backend' a la raíz)
        project_root = vision_dir.parent.parent
        
        # 4. Construir la ruta final al modelo de forma segura
        absolute_model_path = project_root / 'weights' / model_filename

        if not absolute_model_path.is_file():
            raise FileNotFoundError(f"El modelo no se encontró en la ruta: {absolute_model_path}")
            
        print(f"Cargando modelo desde: {absolute_model_path}")
        self.model = YOLO(absolute_model_path)
        print("Modelo YOLO cargado exitosamente.")

    def detect(self, frame):
        """
        Realiza la detección en un frame de imagen.
        """
        results = self.model(frame, verbose=False) # Añadimos verbose=False para una salida más limpia
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