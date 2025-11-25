"""Ver qué está guardado exactamente en la BD"""
import sys
sys.path.insert(0, 'backend')

from backend.app import create_app
from backend.database.models import InferenceEngine, db

app = create_app()

with app.app_context():
    engines = InferenceEngine.query.all()
    
    print("=" * 70)
    print("MOTORES EN LA BASE DE DATOS:")
    print("=" * 70)
    
    for e in engines:
        print(f"\nID: {e.id}")
        print(f"Tipo: {e.tipo}")
        print(f"Versión: {e.version}")
        print(f"Activo: {e.activo}")
        print(f"ruta_archivo: '{e.ruta_archivo}'")  # ← Ver exactamente qué tiene
        print(f"Longitud: {len(e.ruta_archivo)}")
        
        # Si tiene uploads/ al principio, arreglarlo
        if e.ruta_archivo.startswith('uploads/'):
            print(f"⚠️  PROBLEMA: Tiene 'uploads/' al principio")
            nuevo_nombre = e.ruta_archivo.replace('uploads/', '', 1)
            print(f"   Debería ser: '{nuevo_nombre}'")
            
            respuesta = input(f"   ¿Corregir? (s/n): ")
            if respuesta.lower() == 's':
                e.ruta_archivo = nuevo_nombre
                db.session.commit()
                print(f"   ✅ Corregido a: '{e.ruta_archivo}'")
    
    print("\n" + "=" * 70)
