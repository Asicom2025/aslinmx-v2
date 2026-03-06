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
    PermisoConfig, AccionConfigItem, ModuloConfigItem, RolPermisosConfigResponse
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

    @staticmethod
    def create_modulo(db: Session, modulo: ModuloCreate) -> Modulo:
        """Crea un nuevo módulo"""
        db_modulo = Modulo(
            nombre=modulo.nombre,
            descripcion=modulo.descripcion,
            nombre_tecnico=modulo.nombre_tecnico,
            icono=modulo.icono,
            ruta=modulo.ruta,
            orden=modulo.orden if modulo.orden is not None else 0,
            activo=modulo.activo if modulo.activo is not None else True,
        )
        db.add(db_modulo)
        db.commit()
        db.refresh(db_modulo)
        return db_modulo

    @staticmethod
    def update_modulo(db: Session, modulo_id: str, modulo_update: ModuloUpdate) -> Optional[Modulo]:
        """Actualiza un módulo existente"""
        db_modulo = ModuloService.get_modulo_by_id(db, modulo_id)
        if not db_modulo:
            return None
        update_data = modulo_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_modulo, field, value)
        db.commit()
        db.refresh(db_modulo)
        return db_modulo


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

    @staticmethod
    def get_acciones_por_modulo(db: Session, modulo_id: str, activo: Optional[bool] = True) -> List[Accion]:
        """Obtiene las acciones asignadas a un módulo (desde rol_permisos)"""
        accion_ids = (
            db.query(RolPermiso.accion_id)
            .filter(
                RolPermiso.modulo_id == modulo_id,
                RolPermiso.activo == True,
            )
            .distinct()
            .all()
        )
        ids = [a[0] for a in accion_ids]
        if not ids:
            return []
        query = db.query(Accion).filter(Accion.id.in_(ids))
        if activo is not None:
            query = query.filter(Accion.activo == activo)
        return query.order_by(Accion.nombre).all()

    @staticmethod
    def create_accion(db: Session, accion: AccionCreate) -> Accion:
        """Crea una nueva acción"""
        db_accion = Accion(
            nombre=accion.nombre,
            descripcion=accion.descripcion,
            nombre_tecnico=accion.nombre_tecnico,
            activo=accion.activo if accion.activo is not None else True,
        )
        db.add(db_accion)
        db.commit()
        db.refresh(db_accion)
        return db_accion


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
        Obtiene la configuración completa de permisos de un rol.
        Retorna TODOS los módulos. Las acciones de cada módulo vienen de rol_permisos
        para este rol (rol_id). Sin dependencia de ningún rol de referencia.
        Agregar acción = insert en rol_permisos. Quitar = delete.
        """
        rol = db.query(Rol).filter(Rol.id == rol_id).first()
        if not rol:
            raise ValueError("Rol no encontrado")

        # Todos los módulos activos (ordenados)
        modulos = ModuloService.get_modulos(db, limit=500, activo=True)

        # Permisos de ESTE rol: mapa (modulo_id, accion) -> permiso
        permisos_rol = (
            db.query(RolPermiso)
            .join(Accion, RolPermiso.accion_id == Accion.id)
            .filter(
                RolPermiso.rol_id == rol_id,
                RolPermiso.activo == True,
                Accion.activo == True,
            )
            .all()
        )
        # Mapa modulo_id -> [accion, ...]
        por_modulo: Dict[str, List] = {}
        for p in permisos_rol:
            mid = str(p.modulo_id)
            if mid not in por_modulo:
                por_modulo[mid] = []
            por_modulo[mid].append(p.accion)

        modulos_config = []
        for modulo in modulos:
            mid = str(modulo.id)
            acciones_rol = por_modulo.get(mid, [])
            acciones_config = [
                AccionConfigItem(
                    accion_id=a.id,
                    accion_nombre=a.nombre,
                    accion_tecnica=a.nombre_tecnico,
                    tiene_permiso=True,  # Si está en la lista, tiene permiso
                )
                for a in sorted(acciones_rol, key=lambda x: x.nombre)
            ]
            modulos_config.append(ModuloConfigItem(
                modulo_id=modulo.id,
                modulo_nombre=modulo.nombre,
                orden=modulo.orden or 0,
                acciones=acciones_config,
            ))

        return RolPermisosConfigResponse(
            rol_id=rol.id,
            rol_nombre=rol.nombre,
            modulos=modulos_config,
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

    @staticmethod
    def asignar_accion_modulo(
        db: Session, rol_id: str, modulo_id: str, accion_id: str
    ) -> bool:
        """
        Asigna una acción a un módulo para un rol. Inserta en rol_permisos.
        """
        existente = RolPermisoService.get_permiso_especifico(
            db, rol_id, modulo_id, accion_id
        )
        if existente:
            return True
        RolPermisoService.create_permiso(
            db,
            RolPermisoCreate(
                rol_id=rol_id,
                modulo_id=modulo_id,
                accion_id=accion_id,
                activo=True,
            ),
        )
        return True

    @staticmethod
    def desasignar_accion_modulo(
        db: Session, rol_id: str, modulo_id: str, accion_id: str
    ) -> bool:
        """Quita una acción de un módulo para un rol (elimina de rol_permisos)."""
        permiso = RolPermisoService.get_permiso_especifico(
            db, rol_id, modulo_id, accion_id
        )
        if not permiso:
            return False
        return RolPermisoService.delete_permiso(db, str(permiso.id))

    @staticmethod
    def get_permisos_por_rol_nombres(
        db: Session, rol_id: str, activo: Optional[bool] = True
    ) -> List[Dict[str, str]]:
        """
        Obtiene los permisos de un rol como lista de { modulo, accion } (nombres técnicos).
        Útil para el frontend y para validar permisos.
        """
        if not rol_id:
            return []
        query = (
            db.query(Modulo.nombre_tecnico, Accion.nombre_tecnico)
            .join(RolPermiso, RolPermiso.modulo_id == Modulo.id)
            .join(Accion, RolPermiso.accion_id == Accion.id)
            .filter(
                RolPermiso.rol_id == rol_id,
                RolPermiso.activo == True,
                Modulo.activo == True,
                Modulo.eliminado_en.is_(None),
                Accion.activo == True,
            )
        )
        rows = query.all()
        return [{"modulo": r[0], "accion": r[1]} for r in rows]

