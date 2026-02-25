"""
Rutas de Empresas
Endpoints para operaciones CRUD de empresas
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.empresa_schema import EmpresaCreate, EmpresaUpdate, EmpresaResponse
from app.services.empresa_service import EmpresaService
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[EmpresaResponse])
def get_empresas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener lista de empresas (requiere autenticación)
    """
    try:
        print(f"DEBUG get_empresas: Parámetros - skip={skip}, limit={limit}, activo={activo}")
        empresas = EmpresaService.get_empresas(db, skip=skip, limit=limit, activo=activo)
        print(f"DEBUG get_empresas: Empresas encontradas: {len(empresas)}")
        return empresas
    except Exception as e:
        # Log del error para depuración
        import traceback
        print(f"Error al obtener empresas: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener empresas: {str(e)}"
        )


@router.get("/{empresa_id}", response_model=EmpresaResponse)
def get_empresa(
    empresa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener empresa por ID (requiere autenticación)
    """
    empresa = EmpresaService.get_empresa_by_id(db, empresa_id)
    
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    return empresa


@router.post("/", response_model=EmpresaResponse, status_code=status.HTTP_201_CREATED)
def create_empresa(
    empresa: EmpresaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Crear nueva empresa (requiere autenticación)
    """
    return EmpresaService.create_empresa(db, empresa)


@router.put("/{empresa_id}", response_model=EmpresaResponse)
def update_empresa(
    empresa_id: str,
    empresa_update: EmpresaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Actualizar empresa (requiere autenticación)
    """
    empresa = EmpresaService.update_empresa(db, empresa_id, empresa_update)
    
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    return empresa


@router.delete("/{empresa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_empresa(
    empresa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Eliminar empresa (requiere autenticación)
    """
    if not EmpresaService.delete_empresa(db, empresa_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    return None

