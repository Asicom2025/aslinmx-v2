"""
Base de datos - Configuración base
Define la clase base para todos los modelos SQLAlchemy
"""

from sqlalchemy.ext.declarative import declarative_base

# Base para todos los modelos
Base = declarative_base()

# Nota: Evitar importar modelos aquí para no crear importaciones circulares.
# Alembic debe cargar los modelos desde su configuración (alembic/env.py).

