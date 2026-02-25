"""
Rutas de Roles
Endpoints para operaciones CRUD de roles
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rol_schema import RolCreate, RolUpdate, RolResponse
from app.services.rol_service import RolService
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[RolResponse])
def get_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener lista de roles (requiere autenticación)
    """
    roles = RolService.get_roles(db, skip=skip, limit=limit, activo=activo)
    return roles


@router.get("/{rol_id}", response_model=RolResponse)
def get_rol(
    rol_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener rol por ID (requiere autenticación)
    """
    rol = RolService.get_rol_by_id(db, rol_id)
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    return rol


@router.post("/", response_model=RolResponse, status_code=status.HTTP_201_CREATED)
def create_rol(
    rol: RolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Crear nuevo rol (requiere autenticación)
    """
    return RolService.create_rol(db, rol)


@router.put("/{rol_id}", response_model=RolResponse)
def update_rol(
    rol_id: str,
    rol_update: RolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Actualizar rol (requiere autenticación)
    """
    rol = RolService.update_rol(db, rol_id, rol_update)
    
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    return rol


@router.delete("/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rol(
    rol_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Eliminar rol (requiere autenticación)
    """
    if not RolService.delete_rol(db, rol_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    
    return None

