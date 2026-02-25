"""
Servicio de Roles
Lógica de negocio para gestión de roles
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.user import Rol
from app.schemas.rol_schema import RolCreate, RolUpdate


class RolService:
    """Servicio para operaciones CRUD de roles"""
    
    @staticmethod
    def get_rol_by_id(db: Session, rol_id: str) -> Optional[Rol]:
        """Obtiene un rol por ID"""
        return db.query(Rol).filter(
            and_(Rol.id == rol_id, Rol.eliminado_en.is_(None))
        ).first()
    
    @staticmethod
    def get_roles(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        activo: Optional[bool] = None
    ) -> List[Rol]:
        """
        Obtiene lista de roles
        
        Args:
            db: Sesión de base de datos
            skip: Número de registros a saltar
            limit: Número máximo de registros a retornar
            activo: Filtrar por estado activo (None = todos)
        
        Returns:
            Lista de roles
        """
        query = db.query(Rol).filter(Rol.eliminado_en.is_(None))
        
        if activo is not None:
            query = query.filter(Rol.activo == activo)
        
        return query.order_by(Rol.nombre).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_rol(db: Session, rol: RolCreate) -> Rol:
        """
        Crea un nuevo rol
        
        Args:
            db: Sesión de base de datos
            rol: Datos del rol a crear
        
        Returns:
            Rol creado
        """
        db_rol = Rol(**rol.model_dump())
        db.add(db_rol)
        db.commit()
        db.refresh(db_rol)
        return db_rol
    
    @staticmethod
    def update_rol(db: Session, rol_id: str, rol_update: RolUpdate) -> Optional[Rol]:
        """
        Actualiza un rol existente
        
        Args:
            db: Sesión de base de datos
            rol_id: ID del rol a actualizar
            rol_update: Datos a actualizar
        
        Returns:
            Rol actualizado o None si no existe
        """
        db_rol = RolService.get_rol_by_id(db, rol_id)
        
        if not db_rol:
            return None
        
        update_data = rol_update.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_rol, field, value)
        
        db.commit()
        db.refresh(db_rol)
        
        return db_rol
    
    @staticmethod
    def delete_rol(db: Session, rol_id: str) -> bool:
        """
        Elimina un rol (soft delete)
        
        Args:
            db: Sesión de base de datos
            rol_id: ID del rol a eliminar
        
        Returns:
            True si se eliminó, False si no existe
        """
        from datetime import datetime
        
        db_rol = RolService.get_rol_by_id(db, rol_id)
        
        if not db_rol:
            return False
        
        db_rol.eliminado_en = datetime.utcnow()
        db.commit()
        
        return True

