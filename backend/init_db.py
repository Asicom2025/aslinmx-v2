"""
Inicializa la base de datos antes de iniciar uvicorn.
Se ejecuta una sola vez (evita race condition con múltiples workers).
"""
import sys
from app.db.session import engine
from app.db.base import Base
from app.models import *  # noqa: F401, F403
from app.db.seed import run_seed_if_empty

if __name__ == "__main__":
    try:
        Base.metadata.create_all(bind=engine)
        run_seed_if_empty()
        print("✅ Base de datos inicializada")
    except Exception as e:
        print(f"❌ Error al inicializar BD: {e}", file=sys.stderr)
        sys.exit(1)
