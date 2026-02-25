"""
Servicio de Permisos
Lógica de negocio para gestión de permisos por módulos y acciones
"""

from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.permiso import Modulo, Accion, RolPermiso
from app.models.user import Rol
from app.schemas.permiso_schema import (
    ModuloCreate, ModuloUpdate,
    AccionCreate,
    RolPermisoCreate, RolPermisoUpdate,
    PermisoConfig, RolPermisosConfigResponse
)


class ModuloService:
    """Servicio para operaciones CRUD de módulos"""
    
    @staticmethod
    def get_modulos(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        activo: Optional[bool] = None
    ) -> List[Modulo]:
        """Obtiene lista de módulos"""
        query = db.query(Modulo).filter(Modulo.eliminado_en.is_(None))
        
        if activo is not None:
            query = query.filter(Modulo.activo == activo)
        
        return query.order_by(Modulo.orden, Modulo.nombre).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_modulo_by_id(db: Session, modulo_id: str) -> Optional[Modulo]:
        """Obtiene un módulo por ID"""
        return db.query(Modulo).filter(
            and_(Modulo.id == modulo_id, Modulo.eliminado_en.is_(None))
        ).first()
    
    @staticmethod
    def get_modulo_by_nombre_tecnico(db: Session, nombre_tecnico: str) -> Optional[Modulo]:
        """Obtiene un módulo por nombre técnico"""
        return db.query(Modulo).filter(
            and_(Modulo.nombre_tecnico == nombre_tecnico, Modulo.eliminado_en.is_(None))
        ).first()


class AccionService:
    """Servicio para operaciones CRUD de acciones"""
    
    @staticmethod
    def get_acciones(
        db: Session,
        activo: Optional[bool] = None
    ) -> List[Accion]:
        """Obtiene lista de acciones"""
        query = db.query(Accion)
        
        if activo is not None:
            query = query.filter(Accion.activo == activo)
        
        return query.order_by(Accion.nombre).all()
    
    @staticmethod
    def get_accion_by_id(db: Session, accion_id: str) -> Optional[Accion]:
        """Obtiene una acción por ID"""
        return db.query(Accion).filter(Accion.id == accion_id).first()
    
    @staticmethod
    def get_accion_by_nombre_tecnico(db: Session, nombre_tecnico: str) -> Optional[Accion]:
        """Obtiene una acción por nombre técnico"""
        return db.query(Accion).filter(
            and_(Accion.nombre_tecnico == nombre_tecnico, Accion.activo == True)
        ).first()


class RolPermisoService:
    """Servicio para operaciones CRUD de permisos de roles"""
    
    @staticmethod
    def get_permisos_por_rol(
        db: Session,
        rol_id: str,
        activo: Optional[bool] = None
    ) -> List[RolPermiso]:
        """Obtiene todos los permisos de un rol"""
        query = db.query(RolPermiso).filter(RolPermiso.rol_id == rol_id)
        
        if activo is not None:
            query = query.filter(RolPermiso.activo == activo)
        
        return query.all()
    
    @staticmethod
    def get_permiso_by_id(db: Session, permiso_id: str) -> Optional[RolPermiso]:
        """Obtiene un permiso por ID"""
        return db.query(RolPermiso).filter(RolPermiso.id == permiso_id).first()
    
    @staticmethod
    def get_permiso_especifico(
        db: Session,
        rol_id: str,
        modulo_id: str,
        accion_id: str
    ) -> Optional[RolPermiso]:
        """Obtiene un permiso específico"""
        return db.query(RolPermiso).filter(
            and_(
                RolPermiso.rol_id == rol_id,
                RolPermiso.modulo_id == modulo_id,
                RolPermiso.accion_id == accion_id
            )
        ).first()
    
    @staticmethod
    def create_permiso(db: Session, permiso: RolPermisoCreate, creado_por: Optional[str] = None) -> RolPermiso:
        """Crea un nuevo permiso"""
        db_permiso = RolPermiso(
            rol_id=permiso.rol_id,
            modulo_id=permiso.modulo_id,
            accion_id=permiso.accion_id,
            activo=permiso.activo if permiso.activo is not None else True,
            creado_por=creado_por
        )
        db.add(db_permiso)
        db.commit()
        db.refresh(db_permiso)
        return db_permiso
    
    @staticmethod
    def update_permiso(
        db: Session,
        permiso_id: str,
        permiso_update: RolPermisoUpdate
    ) -> Optional[RolPermiso]:
        """Actualiza un permiso existente"""
        db_permiso = RolPermisoService.get_permiso_by_id(db, permiso_id)
        
        if not db_permiso:
            return None
        
        update_data = permiso_update.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_permiso, field, value)
        
        db.commit()
        db.refresh(db_permiso)
        
        return db_permiso
    
    @staticmethod
    def delete_permiso(db: Session, permiso_id: str) -> bool:
        """Elimina un permiso"""
        db_permiso = RolPermisoService.get_permiso_by_id(db, permiso_id)
        
        if not db_permiso:
            return False
        
        db.delete(db_permiso)
        db.commit()
        
        return True
    
    @staticmethod
    def get_configuracion_permisos(
        db: Session,
        rol_id: str
    ) -> RolPermisosConfigResponse:
        """
        Obtiene la configuración completa de permisos de un rol
        Retorna una estructura con todos los módulos y acciones, marcando cuáles tiene el rol
        """
        # Obtener el rol
        rol = db.query(Rol).filter(Rol.id == rol_id).first()
        if not rol:
            raise ValueError("Rol no encontrado")
        
        # Obtener todos los módulos activos
        modulos = ModuloService.get_modulos(db, activo=True, limit=1000)
        
        # Obtener todas las acciones activas
        acciones = AccionService.get_acciones(db, activo=True)
        
        # Obtener permisos del rol
        permisos_rol = RolPermisoService.get_permisos_por_rol(db, rol_id, activo=True)
        
        # Crear un set de permisos para búsqueda rápida
        permisos_set = {
            (str(p.modulo_id), str(p.accion_id)) for p in permisos_rol
        }
        
        # Construir la lista de configuración
        permisos_config = []
        for modulo in modulos:
            for accion in acciones:
                tiene_permiso = (str(modulo.id), str(accion.id)) in permisos_set
                permisos_config.append(PermisoConfig(
                    modulo_id=modulo.id,
                    modulo_nombre=modulo.nombre,
                    accion_id=accion.id,
                    accion_nombre=accion.nombre,
                    accion_tecnica=accion.nombre_tecnico,
                    tiene_permiso=tiene_permiso
                ))
        
        return RolPermisosConfigResponse(
            rol_id=rol.id,
            rol_nombre=rol.nombre,
            permisos=permisos_config
        )
    
    @staticmethod
    def actualizar_permisos_bulk(
        db: Session,
        rol_id: str,
        permisos: List[RolPermisoCreate],
        eliminar_otros: bool = False,
        creado_por: Optional[str] = None
    ) -> Dict:
        """
        Actualiza múltiples permisos de un rol a la vez
        """
        # Si eliminar_otros es True, eliminar todos los permisos existentes
        if eliminar_otros:
            db.query(RolPermiso).filter(RolPermiso.rol_id == rol_id).delete()
        
        # Crear o actualizar los permisos especificados
        creados = 0
        actualizados = 0
        
        for permiso_data in permisos:
            # Verificar si el permiso ya existe
            permiso_existente = RolPermisoService.get_permiso_especifico(
                db, rol_id, str(permiso_data.modulo_id), str(permiso_data.accion_id)
            )
            
            if permiso_existente:
                # Actualizar
                permiso_existente.activo = permiso_data.activo if permiso_data.activo is not None else True
                actualizados += 1
            else:
                # Crear
                RolPermisoService.create_permiso(db, permiso_data, creado_por)
                creados += 1
        
        db.commit()
        
        return {
            "creados": creados,
            "actualizados": actualizados,
            "total": len(permisos)
        }

