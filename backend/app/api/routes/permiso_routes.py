"""
Rutas de API para Permisos
Endpoints para gestión de permisos por módulos y acciones
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.permiso_service import (
    ModuloService, AccionService, RolPermisoService
)
from app.schemas.permiso_schema import (
    ModuloResponse, AccionResponse,
    RolPermisoResponse, RolPermisoCreate, RolPermisoUpdate,
    RolPermisosConfigResponse, RolPermisosBulkUpdate
)

router = APIRouter()


# =========================
# MÓDULOS
# =========================

@router.get("/modulos", response_model=List[ModuloResponse])
def get_modulos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener lista de módulos"""
    modulos = ModuloService.get_modulos(db, skip=skip, limit=limit, activo=activo)
    return modulos


@router.get("/modulos/{modulo_id}", response_model=ModuloResponse)
def get_modulo(
    modulo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener un módulo por ID"""
    modulo = ModuloService.get_modulo_by_id(db, modulo_id)
    if not modulo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Módulo no encontrado"
        )
    return modulo


# =========================
# ACCIONES
# =========================

@router.get("/acciones", response_model=List[AccionResponse])
def get_acciones(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener lista de acciones"""
    acciones = AccionService.get_acciones(db, activo=activo)
    return acciones


@router.get("/acciones/{accion_id}", response_model=AccionResponse)
def get_accion(
    accion_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener una acción por ID"""
    accion = AccionService.get_accion_by_id(db, accion_id)
    if not accion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acción no encontrada"
        )
    return accion


# =========================
# PERMISOS DE ROL
# =========================

@router.get("/roles/{rol_id}/permisos", response_model=List[RolPermisoResponse])
def get_permisos_rol(
    rol_id: str,
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener todos los permisos de un rol"""
    permisos = RolPermisoService.get_permisos_por_rol(db, rol_id, activo=activo)
    return permisos


@router.get("/roles/{rol_id}/permisos/config", response_model=RolPermisosConfigResponse)
def get_configuracion_permisos(
    rol_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener la configuración completa de permisos de un rol
    Retorna todos los módulos y acciones con indicador de si el rol tiene el permiso
    """
    try:
        config = RolPermisoService.get_configuracion_permisos(db, rol_id)
        return config
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/roles/{rol_id}/permisos", response_model=RolPermisoResponse)
def create_permiso(
    rol_id: str,
    permiso: RolPermisoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crear un nuevo permiso para un rol"""
    # Verificar que el rol_id coincida
    if str(permiso.rol_id) != rol_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol_id del permiso no coincide con el de la URL"
        )
    
    # Verificar si ya existe
    permiso_existente = RolPermisoService.get_permiso_especifico(
        db, rol_id, str(permiso.modulo_id), str(permiso.accion_id)
    )
    
    if permiso_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este permiso ya existe para el rol"
        )
    
    nuevo_permiso = RolPermisoService.create_permiso(
        db, permiso, creado_por=str(current_user.id)
    )
    return nuevo_permiso


@router.put("/roles/{rol_id}/permisos/bulk", response_model=dict)
def actualizar_permisos_bulk(
    rol_id: str,
    bulk_update: RolPermisosBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Actualizar múltiples permisos de un rol a la vez
    Permite asignar/revocar permisos en masa
    """
    # Verificar que todos los permisos sean para el mismo rol
    for permiso in bulk_update.permisos:
        if str(permiso.rol_id) != rol_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Todos los permisos deben ser para el mismo rol"
            )
    
    resultado = RolPermisoService.actualizar_permisos_bulk(
        db,
        rol_id,
        bulk_update.permisos,
        eliminar_otros=bulk_update.eliminar_otros,
        creado_por=str(current_user.id)
    )
    
    return resultado


@router.put("/permisos/{permiso_id}", response_model=RolPermisoResponse)
def update_permiso(
    permiso_id: str,
    permiso_update: RolPermisoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualizar un permiso existente"""
    permiso = RolPermisoService.update_permiso(db, permiso_id, permiso_update)
    if not permiso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permiso no encontrado"
        )
    return permiso


@router.delete("/permisos/{permiso_id}")
def delete_permiso(
    permiso_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Eliminar un permiso"""
    eliminado = RolPermisoService.delete_permiso(db, permiso_id)
    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permiso no encontrado"
        )
    return {"message": "Permiso eliminado correctamente"}


@router.get("/permisos/{permiso_id}", response_model=RolPermisoResponse)
def get_permiso(
    permiso_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener un permiso por ID"""
    permiso = RolPermisoService.get_permiso_by_id(db, permiso_id)
    if not permiso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permiso no encontrado"
        )
    return permiso

