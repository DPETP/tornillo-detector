"""Script para diagnosticar por qué no carga el modelo"""
import sys
import os
sys.path.insert(0, 'backend')

from backend.app import create_app
from backend.database.models import InferenceEngine
from pathlib import Path

app = create_app()

with app.app_context():
    print("=" * 70)
    print("DIAGNÓSTICO DE CARGA DE MODELO")
    print("=" * 70)
    
    # 1. Verificar motor activo en BD
    engine = InferenceEngine.query.filter_by(activo=True).first()
    
    if not engine:
        print("\n❌ NO HAY MOTOR ACTIVO EN LA BASE DE DATOS")
        print("   Ve a Configuración → Motores de IA y activa uno")
        sys.exit(1)
    
    print(f"\n✅ Motor activo encontrado en BD:")
    print(f"   ID: {engine.id}")
    print(f"   Tipo: {engine.tipo}")
    print(f"   Versión: {engine.version}")
    print(f"   Archivo: {engine.ruta_archivo}")
    
    # 2. Verificar si el archivo existe
    backend_dir = Path(__file__).parent / 'backend'
    uploads_dir = backend_dir / 'uploads'
    model_path = uploads_dir / engine.ruta_archivo
    
    print(f"\n📂 Rutas:")
    print(f"   Backend: {backend_dir}")
    print(f"   Uploads: {uploads_dir}")
    print(f"   Modelo: {model_path}")
    
    if model_path.exists():
        print(f"\n✅ Archivo del modelo EXISTE")
        print(f"   Tamaño: {model_path.stat().st_size / (1024*1024):.2f} MB")
    else:
        print(f"\n❌ ARCHIVO DEL MODELO NO EXISTE EN:")
        print(f"   {model_path}")
        print(f"\n   Archivos disponibles en uploads:")
        if uploads_dir.exists():
            for f in uploads_dir.iterdir():
                if f.is_file():
                    print(f"   - {f.name}")
        sys.exit(1)
    
    # 3. Intentar cargar el modelo con YOLO
    print(f"\n🔄 Intentando cargar modelo con YOLODetector...")
    try:
        from backend.vision.detector import YOLODetector
        detector = YOLODetector(model_filename=engine.ruta_archivo)
        print(f"✅ MODELO CARGADO EXITOSAMENTE")
        print(f"   Clase del modelo: {type(detector.model)}")
    except FileNotFoundError as e:
        print(f"❌ ERROR: Archivo no encontrado")
        print(f"   {str(e)}")
    except Exception as e:
        print(f"❌ ERROR al cargar el modelo:")
        print(f"   {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
