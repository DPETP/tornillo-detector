"""Script para activar un motor de IA en la base de datos"""
import sys
sys.path.insert(0, 'backend')

from backend.app import create_app
from backend.database.models import db, InferenceEngine

app = create_app()

with app.app_context():
    print("=" * 60)
    print("MOTORES DE IA DISPONIBLES:")
    print("=" * 60)
    
    engines = InferenceEngine.query.all()
    
    if not engines:
        print("⚠️  NO HAY MOTORES REGISTRADOS EN LA BASE DE DATOS")
        print("\nPor favor, sube un modelo desde el panel de Configuración")
        sys.exit(1)
    
    for i, engine in enumerate(engines, 1):
        status = "✅ ACTIVO" if engine.activo else "⭕ Inactivo"
        print(f"\n{i}. {status}")
        print(f"   Tipo: {engine.tipo}")
        print(f"   Versión: {engine.version}")
        print(f"   Archivo: {engine.ruta_archivo}")
        print(f"   Descripción: {engine.descripcion or 'Sin descripción'}")
    
    print("\n" + "=" * 60)
    print("¿Qué motor deseas activar?")
    print("=" * 60)
    
    try:
        choice = input(f"\nIngresa el número (1-{len(engines)}) o 'q' para salir: ").strip()
        
        if choice.lower() == 'q':
            print("Cancelado.")
            sys.exit(0)
        
        index = int(choice) - 1
        
        if index < 0 or index >= len(engines):
            print("❌ Número inválido")
            sys.exit(1)
        
        # Desactivar todos
        InferenceEngine.query.update({'activo': False})
        db.session.commit()
        
        # Activar el seleccionado
        selected = engines[index]
        selected.activo = True
        db.session.commit()
        
        print(f"\n✅ Motor activado exitosamente:")
        print(f"   {selected.tipo} v{selected.version}")
        print(f"   Archivo: {selected.ruta_archivo}")
        print("\n⚠️  REINICIA EL SERVIDOR FLASK para que cargue el modelo")
        
    except ValueError:
        print("❌ Entrada inválida")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nCancelado.")
        sys.exit(0)
