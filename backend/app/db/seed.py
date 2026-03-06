"""
Ejecuta el seed inicial (db/init.sql) si la base de datos está vacía.
Se invoca automáticamente al iniciar el backend.
Asegura que el rol Administrador exista (requerido para asignar acciones a módulos).
"""

import os
import logging
from sqlalchemy import text
from app.db.session import engine

logger = logging.getLogger(__name__)

INIT_SQL_PATH = "/app/db/init.sql"
ROL_ADMIN_ID = "b0000000-0000-0000-0000-000000000001"


def ensure_admin_role() -> None:
    """
    Garantiza que el rol Administrador exista.
    Necesario para asignar acciones a módulos (rol_permisos).
    """
    try:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO roles (id, nombre, descripcion, nivel, activo)
                    VALUES (CAST(:id AS uuid), 'Administrador', 'Acceso total al sistema', 1, true)
                    ON CONFLICT (id) DO NOTHING
                """),
                {"id": ROL_ADMIN_ID},
            )
            conn.commit()
            logger.info("Rol Administrador verificado")
    except Exception as e:
        logger.warning("No se pudo asegurar rol Administrador: %s", e)


def run_seed_if_empty() -> bool:
    """
    Ejecuta init.sql si no existe ninguna empresa.
    Retorna True si se ejecutó el seed, False si no era necesario.
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM empresas"))
            count = result.scalar()
            if count and count > 0:
                logger.info("Base de datos ya tiene datos, omitiendo seed")
                return False

            # Buscar init.sql: en /app/db (Docker) o en db/ relativo al proyecto
            sql_path = INIT_SQL_PATH
            if not os.path.exists(sql_path):
                # Desarrollo local: db/ está en la raíz del proyecto
                base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                sql_path = os.path.join(base, "db", "init.sql")
            if not os.path.exists(sql_path):
                logger.warning("No se encontró db/init.sql, omitiendo seed automático")
                return False

            with open(sql_path, "r", encoding="utf-8") as f:
                sql_content = f.read()

            # Filtrar solo sentencias SQL (omitir comentarios de bloque)
            statements = []
            for stmt in sql_content.split(";"):
                stmt = stmt.strip()
                # Quitar líneas de comentario
                lines = [l for l in stmt.split("\n") if l.strip() and not l.strip().startswith("--")]
                stmt = "\n".join(lines)
                if stmt and (
                    stmt.upper().startswith("INSERT")
                    or stmt.upper().startswith("CREATE EXTENSION")
                ):
                    statements.append(stmt + ";")

            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    logger.debug("Sentencia omitida: %s", str(e)[:80])
            conn.commit()
            logger.info("Seed inicial ejecutado correctamente")
            return True

    except Exception as e:
        logger.error("Error al ejecutar seed: %s", e)
        return False
    finally:
        ensure_admin_role()
