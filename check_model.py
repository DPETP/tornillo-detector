from backend.app import create_app
from backend.database.models import InferenceEngine

app = create_app()

with app.app_context():
    engine = InferenceEngine.query.filter_by(activo=True).first()
    if engine:
        print(f"✓ Motor activo: {engine.tipo} v{engine.version}")
        print(f"  Archivo: {engine.ruta_archivo}")
        print(f"  ID: {engine.id}")
    else:
        print("⚠ NO HAY MOTOR ACTIVO CONFIGURADO")
        
    all_engines = InferenceEngine.query.all()
    print(f"\nTotal motores: {len(all_engines)}")
    for e in all_engines:
        print(f"  - {e.tipo} v{e.version} | Activo: {e.activo} | Archivo: {e.ruta_archivo}")
