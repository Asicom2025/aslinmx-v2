"""
Servicio de Empresas
Lógica de negocio para gestión de empresas
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.user import Empresa
from app.schemas.empresa_schema import EmpresaCreate, EmpresaUpdate


class EmpresaService:
    """Servicio para operaciones CRUD de empresas"""
    
    @staticmethod
    def get_empresa_by_id(db: Session, empresa_id: str) -> Optional[Empresa]:
        """Obtiene una empresa por ID"""
        return db.query(Empresa).filter(
            and_(Empresa.id == empresa_id, Empresa.eliminado_en.is_(None))
        ).first()
    
    @staticmethod
    def get_empresas(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        activo: Optional[bool] = None
    ) -> List[Empresa]:
        """
        Obtiene lista de empresas
        
        Args:
            db: Sesión de base de datos
            skip: Número de registros a saltar
            limit: Número máximo de registros a retornar
            activo: Filtrar por estado activo (None = todos)
        
        Returns:
            Lista de empresas
        """
        # Debug: verificar todas las empresas en la BD (sin filtros)
        total_empresas = db.query(Empresa).count()
        print(f"DEBUG EmpresaService: Total empresas en BD (sin filtros): {total_empresas}")
        
        todas_empresas = db.query(Empresa).all()
        for emp in todas_empresas:
            print(f"  - {emp.nombre} (id={emp.id}, activo={emp.activo}, eliminado_en={emp.eliminado_en})")
        
        # Aplicar filtros
        query = db.query(Empresa).filter(Empresa.eliminado_en.is_(None))
        
        if activo is not None:
            query = query.filter(Empresa.activo == activo)
        
        result = query.order_by(Empresa.nombre).offset(skip).limit(limit).all()
        
        # Debug: verificar qué se está devolviendo después de filtros
        print(f"DEBUG EmpresaService: Empresas encontradas después de filtros: {len(result)}")
        for emp in result:
            print(f"  - {emp.nombre} (id={emp.id}, activo={emp.activo}, eliminado_en={emp.eliminado_en})")
        
        return result
    
    @staticmethod
    def create_empresa(db: Session, empresa: EmpresaCreate) -> Empresa:
        """
        Crea una nueva empresa
        
        Args:
            db: Sesión de base de datos
            empresa: Datos de la empresa a crear
        
        Returns:
            Empresa creada
        """
        db_empresa = Empresa(**empresa.model_dump())
        db.add(db_empresa)
        db.commit()
        db.refresh(db_empresa)
        return db_empresa
    
    @staticmethod
    def update_empresa(db: Session, empresa_id: str, empresa_update: EmpresaUpdate) -> Optional[Empresa]:
        """
        Actualiza una empresa existente
        
        Args:
            db: Sesión de base de datos
            empresa_id: ID de la empresa a actualizar
            empresa_update: Datos a actualizar
        
        Returns:
            Empresa actualizada o None si no existe
        """
        db_empresa = EmpresaService.get_empresa_by_id(db, empresa_id)
        
        if not db_empresa:
            return None
        
        update_data = empresa_update.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_empresa, field, value)
        
        db.commit()
        db.refresh(db_empresa)
        
        return db_empresa
    
    @staticmethod
    def delete_empresa(db: Session, empresa_id: str) -> bool:
        """
        Elimina una empresa (soft delete)
        
        Args:
            db: Sesión de base de datos
            empresa_id: ID de la empresa a eliminar
        
        Returns:
            True si se eliminó, False si no existe
        """
        from datetime import datetime
        
        db_empresa = EmpresaService.get_empresa_by_id(db, empresa_id)
        
        if not db_empresa:
            return False
        
        db_empresa.eliminado_en = datetime.utcnow()
        db.commit()
        
        return True

