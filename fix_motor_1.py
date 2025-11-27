"""Corregir ruta del modelo ID 1"""
import sys
sys.path.insert(0, 'backend')

from backend.app import create_app
from backend.database.models import InferenceEngine, db

app = create_app()

with app.app_context():
    engine = InferenceEngine.query.get(1)
    
    print(f"Motor ID 1:")
    print(f"  ruta_archivo actual: '{engine.ruta_archivo}'")
    
    # Corregir: remover 'uploads\' del principio
    engine.ruta_archivo = 'best.pt'
    db.session.commit()
    
    print(f"  ruta_archivo corregida: '{engine.ruta_archivo}'")
    print(f"\n✅ Corregido exitosamente")
    print(f"\n⚠️  AHORA REINICIA EL SERVIDOR FLASK")
