"""
Rutas para sistema de backup y restore
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.backup import Backup, ConfiguracionBackup
from app.schemas.backup_schema import (
    BackupResponse,
    BackupCreate,
    RestoreRequest,
    ConfiguracionBackupCreate,
    ConfiguracionBackupUpdate,
    ConfiguracionBackupResponse
)
from app.services.backup_service import BackupService

router = APIRouter()


@router.get("/backups", response_model=List[BackupResponse])
async def listar_backups(
    tipo: str = None,
    estado: str = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Lista todos los backups de la empresa"""
    query = db.query(Backup).filter(
        Backup.empresa_id == current_user.empresa_id
    )
    if tipo:
        query = query.filter(Backup.tipo == tipo)
    if estado:
        query = query.filter(Backup.estado == estado)
    return query.order_by(Backup.creado_en.desc()).all()


@router.post("/backups", response_model=BackupResponse, status_code=201)
async def crear_backup(
    backup_data: BackupCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Crea un nuevo backup manual"""
    success, backup, error = BackupService.crear_backup(
        db=db,
        empresa_id=str(current_user.empresa_id),
        tipo=backup_data.tipo,
        creado_por=str(current_user.id),
        programado=False
    )

    if not success:
        raise HTTPException(status_code=500, detail=error or "Error al crear backup")

    return backup


@router.get("/backups/{backup_id}", response_model=BackupResponse)
async def obtener_backup(
    backup_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Obtiene información de un backup específico"""
    backup = db.query(Backup).filter(
        Backup.id == backup_id,
        Backup.empresa_id == current_user.empresa_id
    ).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    return backup


@router.delete("/backups/{backup_id}", status_code=204)
async def eliminar_backup(
    backup_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Elimina un backup"""
    backup = db.query(Backup).filter(
        Backup.id == backup_id,
        Backup.empresa_id == current_user.empresa_id
    ).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup no encontrado")

    import os
    try:
        if os.path.exists(backup.ruta_archivo):
            os.remove(backup.ruta_archivo)
    except Exception as e:
        pass  # Continuar aunque falle la eliminación del archivo

    db.delete(backup)
    db.commit()


@router.post("/backups/{backup_id}/restore")
async def restaurar_backup(
    backup_id: UUID,
    request: RestoreRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Restaura un backup (requiere confirmación)"""
    if not request.confirmar:
        raise HTTPException(status_code=400, detail="Debe confirmar la restauración")

    backup = db.query(Backup).filter(
        Backup.id == backup_id,
        Backup.empresa_id == current_user.empresa_id
    ).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup no encontrado")

    success, error = BackupService.restaurar_backup(db=db, backup_id=str(backup_id))

    if not success:
        raise HTTPException(status_code=500, detail=error or "Error al restaurar backup")

    return {"success": True, "message": "Backup restaurado exitosamente"}


@router.get("/configuracion-backup", response_model=ConfiguracionBackupResponse)
async def obtener_configuracion_backup(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Obtiene la configuración de backups automáticos"""
    config = db.query(ConfiguracionBackup).filter(
        ConfiguracionBackup.empresa_id == current_user.empresa_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración de backup no encontrada")
    return config


@router.post("/configuracion-backup", response_model=ConfiguracionBackupResponse, status_code=201)
async def crear_configuracion_backup(
    config: ConfiguracionBackupCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Crea una configuración de backups automáticos"""
    # Verificar si ya existe una configuración
    existente = db.query(ConfiguracionBackup).filter(
        ConfiguracionBackup.empresa_id == current_user.empresa_id
    ).first()

    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una configuración de backup para esta empresa")

    nueva_config = ConfiguracionBackup(
        empresa_id=current_user.empresa_id,
        **config.model_dump()
    )
    db.add(nueva_config)
    db.commit()
    db.refresh(nueva_config)
    return nueva_config


@router.put("/configuracion-backup", response_model=ConfiguracionBackupResponse)
async def actualizar_configuracion_backup(
    config_update: ConfiguracionBackupUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Actualiza la configuración de backups automáticos"""
    config = db.query(ConfiguracionBackup).filter(
        ConfiguracionBackup.empresa_id == current_user.empresa_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración de backup no encontrada")

    update_data = config_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)
    return config


@router.post("/limpiar-backups-antiguos")
async def limpiar_backups_antiguos(
    dias_retener: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Elimina backups más antiguos que el número de días especificado"""
    eliminados = BackupService.limpiar_backups_antiguos(
        db=db,
        empresa_id=str(current_user.empresa_id),
        dias_retener=dias_retener
    )
    return {"eliminados": eliminados, "message": f"Se eliminaron {eliminados} backups antiguos"}




