"""
Servicio para backup y restore de base de datos
"""

import subprocess
import os
from datetime import datetime, timedelta
from typing import Optional, Tuple
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.backup import Backup, ConfiguracionBackup
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class BackupService:
    """Servicio para realizar backups y restores de la base de datos"""

    BACKUP_DIR = Path("/app/backups")  # Directorio para backups en Docker

    @staticmethod
    def crear_backup(
        db: Session,
        empresa_id: str,
        tipo: str = "completo",
        creado_por: Optional[str] = None,
        programado: bool = False
    ) -> Tuple[bool, Optional[Backup], Optional[str]]:
        """
        Crea un backup de la base de datos
        
        Returns:
            (success, backup_object, error_message)
        """
        try:
            # Crear directorio si no existe
            BackupService.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

            # Generar nombre de archivo
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            nombre_archivo = f"backup_{tipo}_{timestamp}.sql"
            ruta_archivo = BackupService.BACKUP_DIR / nombre_archivo

            # Extraer información de conexión de DATABASE_URL
            # Formato: postgresql://user:password@host:port/database
            db_url = settings.DATABASE_URL.replace("postgresql://", "").replace("postgresql+psycopg2://", "")
            parts = db_url.split("@")
            if len(parts) != 2:
                raise ValueError("Formato de DATABASE_URL inválido")

            user_pass = parts[0].split(":")
            host_db = parts[1].split("/")
            if len(host_db) != 2:
                raise ValueError("Formato de DATABASE_URL inválido")

            user = user_pass[0]
            password = ":".join(user_pass[1:]) if len(user_pass) > 1 else ""
            host_port = host_db[0].split(":")
            host = host_port[0]
            port = host_port[1] if len(host_port) > 1 else "5432"
            database = host_db[1]

            # Configurar variable de entorno para password
            env = os.environ.copy()
            env["PGPASSWORD"] = password

            # Comando pg_dump
            cmd = [
                "pg_dump",
                "-h", host,
                "-p", port,
                "-U", user,
                "-d", database,
                "-F", "c",  # Formato custom
                "-f", str(ruta_archivo)
            ]

            # Ejecutar backup
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hora máximo
            )

            if result.returncode != 0:
                error_msg = result.stderr or "Error desconocido al crear backup"
                logger.error(f"Error al crear backup: {error_msg}")
                return False, None, error_msg

            # Obtener tamaño del archivo
            tamano_bytes = ruta_archivo.stat().st_size if ruta_archivo.exists() else 0

            # Crear registro en BD
            backup = Backup(
                empresa_id=empresa_id,
                nombre_archivo=nombre_archivo,
                ruta_archivo=str(ruta_archivo),
                tamano_bytes=tamano_bytes,
                tipo=tipo,
                estado="completado",
                creado_por=creado_por,
                programado=programado
            )
            db.add(backup)
            db.commit()
            db.refresh(backup)

            logger.info(f"Backup creado exitosamente: {nombre_archivo}")
            return True, backup, None

        except subprocess.TimeoutExpired:
            error_msg = "El backup excedió el tiempo máximo permitido"
            logger.error(error_msg)
            return False, None, error_msg
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error al crear backup: {error_msg}")
            return False, None, error_msg

    @staticmethod
    def restaurar_backup(
        db: Session,
        backup_id: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Restaura un backup de la base de datos
        
        Returns:
            (success, error_message)
        """
        try:
            backup = db.query(Backup).filter(Backup.id == backup_id).first()
            if not backup:
                return False, "Backup no encontrado"

            if not os.path.exists(backup.ruta_archivo):
                return False, f"Archivo de backup no encontrado: {backup.ruta_archivo}"

            # Extraer información de conexión
            db_url = settings.DATABASE_URL.replace("postgresql://", "").replace("postgresql+psycopg2://", "")
            parts = db_url.split("@")
            if len(parts) != 2:
                return False, "Formato de DATABASE_URL inválido"

            user_pass = parts[0].split(":")
            host_db = parts[1].split("/")
            if len(host_db) != 2:
                return False, "Formato de DATABASE_URL inválido"

            user = user_pass[0]
            password = ":".join(user_pass[1:]) if len(user_pass) > 1 else ""
            host_port = host_db[0].split(":")
            host = host_port[0]
            port = host_port[1] if len(host_port) > 1 else "5432"
            database = host_db[1]

            env = os.environ.copy()
            env["PGPASSWORD"] = password

            # Comando pg_restore
            cmd = [
                "pg_restore",
                "-h", host,
                "-p", port,
                "-U", user,
                "-d", database,
                "-c",  # Limpiar objetos antes de crear
                "-v",  # Modo verbose
                backup.ruta_archivo
            ]

            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600
            )

            if result.returncode != 0:
                error_msg = result.stderr or "Error desconocido al restaurar backup"
                logger.error(f"Error al restaurar backup: {error_msg}")
                return False, error_msg

            logger.info(f"Backup restaurado exitosamente: {backup.nombre_archivo}")
            return True, None

        except subprocess.TimeoutExpired:
            error_msg = "La restauración excedió el tiempo máximo permitido"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error al restaurar backup: {error_msg}")
            return False, error_msg

    @staticmethod
    def limpiar_backups_antiguos(
        db: Session,
        empresa_id: str,
        dias_retener: int = 30
    ) -> int:
        """
        Elimina backups más antiguos que el número de días especificado
        
        Returns:
            Número de backups eliminados
        """
        fecha_limite = datetime.now() - timedelta(days=dias_retener)
        backups_antiguos = db.query(Backup).filter(
            Backup.empresa_id == empresa_id,
            Backup.creado_en < fecha_limite
        ).all()

        eliminados = 0
        for backup in backups_antiguos:
            try:
                # Eliminar archivo físico
                if os.path.exists(backup.ruta_archivo):
                    os.remove(backup.ruta_archivo)
                # Eliminar registro
                db.delete(backup)
                eliminados += 1
            except Exception as e:
                logger.error(f"Error al eliminar backup {backup.id}: {str(e)}")

        db.commit()
        return eliminados




