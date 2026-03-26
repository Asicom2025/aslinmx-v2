"""
Servicios CRUD para catálogos legales
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, nullslast, cast, or_
from sqlalchemy.types import Integer
from datetime import datetime
from fastapi import HTTPException, status

from app.services.auditoria_service import AuditoriaService
from app.services.email_service import EmailService
from app.utils.estado_normalization import normalizar_nombre_estado
from app.models.legal import (
    Area,
    EstadoSiniestro,
    CalificacionSiniestro,
    Entidad,
    Institucion,
    Autoridad,
    Asegurado,
    Proveniente,
    ProvenienteContacto,
    TipoDocumento,
    RespuestaFormularioPlantilla,
    CategoriaDocumento,
    PlantillaDocumento,
    Siniestro,
    BitacoraActividad,
    Documento,
    Notificacion,
    EvidenciaFotografica,
    SiniestroUsuario,
    SiniestroArea,
    VersionesDescripcionHechos,
)
from app.schemas.legal_schema import (
    AreaCreate,
    AreaUpdate,
    EstadoSiniestroCreate,
    EstadoSiniestroUpdate,
    CalificacionSiniestroCreate,
    CalificacionSiniestroUpdate,
    EntidadCreate,
    EntidadUpdate,
    InstitucionCreate,
    InstitucionUpdate,
    AutoridadCreate,
    AutoridadUpdate,
    AseguradoCreate,
    AseguradoUpdate,
    ProvenienteCreate,
    ProvenienteUpdate,
    ProvenienteContactoCreate,
    TiposDocumentoCreate,
    TiposDocumentoUpdate,
    CategoriaDocumentoCreate,
    CategoriaDocumentoUpdate,
    PlantillaDocumentoCreate,
    PlantillaDocumentoUpdate,
    SiniestroCreate,
    SiniestroUpdate,
    BitacoraActividadCreate,
    BitacoraActividadUpdate,
    DocumentoCreate,
    DocumentoUpdate,
    NotificacionCreate,
    NotificacionUpdate,
    EvidenciaFotograficaCreate,
    EvidenciaFotograficaUpdate,
    SiniestroUsuarioCreate,
    SiniestroUsuarioUpdate,
    SiniestroAreaCreate,
    SiniestroAreaUpdate,
    VersionesDescripcionHechosCreate,
    VersionesDescripcionHechosUpdate,
)


class AreaService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[Area]:
        q = (
            db.query(Area)
            .options(joinedload(Area.jefe))
            .filter(
                Area.empresa_id == empresa_id,
                Area.eliminado_en.is_(None),
            )
        )
        if activo is not None:
            q = q.filter(Area.activo == activo)
        return q.order_by(Area.nombre).all()
        db.add(area)
        db.commit()
        db.refresh(area)
        return area

    @staticmethod
    def update(db: Session, area_id: UUID, payload: AreaUpdate) -> Optional[Area]:
        area = (
            db.query(Area)
            .filter(
                Area.id == area_id,
                Area.eliminado_en.is_(None),
            )
            .first()
        )
        if not area:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(area, k, v)
        db.commit()
        db.refresh(area)
        return area

    @staticmethod
    def delete(db: Session, area_id: UUID) -> bool:
        area = db.query(Area).filter(
            Area.id == area_id,
            Area.eliminado_en.is_(None),
        ).first()
        if not area:
            return False
        area.eliminado_en = func.now()
        db.commit()
        return True


class EstadoSiniestroService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[EstadoSiniestro]:
        q = db.query(EstadoSiniestro).filter(
            EstadoSiniestro.empresa_id == empresa_id,
            EstadoSiniestro.eliminado_en.is_(None),
        )
        if activo is not None:
            q = q.filter(EstadoSiniestro.activo == activo)
        return q.order_by(EstadoSiniestro.orden, EstadoSiniestro.nombre).all()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: EstadoSiniestroCreate) -> EstadoSiniestro:
        es = EstadoSiniestro(empresa_id=empresa_id, **payload.model_dump())
        db.add(es)
        db.commit()
        db.refresh(es)
        return es

    @staticmethod
    def update(db: Session, estado_id: UUID, payload: EstadoSiniestroUpdate) -> Optional[EstadoSiniestro]:
        es = db.query(EstadoSiniestro).filter(
            EstadoSiniestro.id == estado_id,
            EstadoSiniestro.eliminado_en.is_(None),
        ).first()
        if not es:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(es, k, v)
        db.commit()
        db.refresh(es)
        return es

    @staticmethod
    def delete(db: Session, estado_id: UUID) -> bool:
        es = db.query(EstadoSiniestro).filter(
            EstadoSiniestro.id == estado_id,
            EstadoSiniestro.eliminado_en.is_(None),
        ).first()
        if not es:
            return False
        es.eliminado_en = func.now()
        db.commit()
        return True


class CalificacionSiniestroService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[CalificacionSiniestro]:
        q = db.query(CalificacionSiniestro).filter(
            CalificacionSiniestro.empresa_id == empresa_id,
            CalificacionSiniestro.eliminado_en.is_(None),
        )
        if activo is not None:
            q = q.filter(CalificacionSiniestro.activo == activo)
        return q.order_by(CalificacionSiniestro.orden, CalificacionSiniestro.nombre).all()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: CalificacionSiniestroCreate) -> CalificacionSiniestro:
        calificacion = CalificacionSiniestro(empresa_id=empresa_id, **payload.model_dump())
        db.add(calificacion)
        db.commit()
        db.refresh(calificacion)
        return calificacion

    @staticmethod
    def update(
        db: Session,
        calificacion_id: UUID,
        payload: CalificacionSiniestroUpdate,
    ) -> Optional[CalificacionSiniestro]:
        calificacion = db.query(CalificacionSiniestro).filter(
            CalificacionSiniestro.id == calificacion_id,
            CalificacionSiniestro.eliminado_en.is_(None),
        ).first()
        if not calificacion:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(calificacion, k, v)
        db.commit()
        db.refresh(calificacion)
        return calificacion

    @staticmethod
    def delete(db: Session, calificacion_id: UUID) -> bool:
        calificacion = db.query(CalificacionSiniestro).filter(
            CalificacionSiniestro.id == calificacion_id,
            CalificacionSiniestro.eliminado_en.is_(None),
        ).first()
        if not calificacion:
            return False
        calificacion.eliminado_en = func.now()
        db.commit()
        return True


class EntidadService:
    @staticmethod
    def list(
        db: Session,
        empresa_id: UUID,
        activo: Optional[bool] = None,
        es_institucion: Optional[bool] = None,
        es_autoridad: Optional[bool] = None,
        es_organo: Optional[bool] = None,
    ) -> List[Entidad]:
        q = db.query(Entidad).filter(Entidad.empresa_id == empresa_id)
        if activo is not None:
            q = q.filter(Entidad.activo == activo)
        if es_institucion is not None:
            q = q.filter(Entidad.es_institucion == es_institucion)
        if es_autoridad is not None:
            q = q.filter(Entidad.es_autoridad == es_autoridad)
        if es_organo is not None:
            q = q.filter(Entidad.es_organo == es_organo)
        q = q.filter(Entidad.eliminado_en.is_(None))
        return q.order_by(Entidad.nombre).all()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: EntidadCreate) -> Entidad:
        # Validar que al menos un rol esté activo
        if not (payload.es_institucion or payload.es_autoridad or payload.es_organo):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La entidad debe tener al menos un rol (institución, autoridad u órgano)"
            )
        entidad = Entidad(empresa_id=empresa_id, **payload.model_dump())
        db.add(entidad)
        db.commit()
        db.refresh(entidad)
        return entidad

    @staticmethod
    def update(db: Session, entidad_id: UUID, payload: EntidadUpdate) -> Optional[Entidad]:
        entidad = db.query(Entidad).filter(Entidad.id == entidad_id).first()
        if not entidad:
            return None
        
        update_data = payload.model_dump(exclude_unset=True)
        
        # Validar que al menos un rol esté activo después de la actualización
        es_institucion = update_data.get("es_institucion", entidad.es_institucion)
        es_autoridad = update_data.get("es_autoridad", entidad.es_autoridad)
        es_organo = update_data.get("es_organo", entidad.es_organo)
        
        if not (es_institucion or es_autoridad or es_organo):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La entidad debe tener al menos un rol (institución, autoridad u órgano)"
            )
        
        for k, v in update_data.items():
            setattr(entidad, k, v)
        db.commit()
        db.refresh(entidad)
        return entidad

    @staticmethod
    def get_by_id(db: Session, entidad_id: UUID) -> Optional[Entidad]:
        return db.query(Entidad).filter(
            Entidad.id == entidad_id,
            Entidad.eliminado_en.is_(None)
        ).first()

    @staticmethod
    def delete(db: Session, entidad_id: UUID) -> bool:
        entidad = db.query(Entidad).filter(Entidad.id == entidad_id).first()
        if not entidad:
            return False
        entidad.eliminado_en = func.now()
        db.commit()
        return True


class InstitucionService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[Institucion]:
        q = db.query(Institucion).filter(
            Institucion.empresa_id == empresa_id,
            Institucion.eliminado_en.is_(None),
        )
        if activo is not None:
            q = q.filter(Institucion.activo == activo)
        return q.order_by(Institucion.nombre).all()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: InstitucionCreate) -> Institucion:
        inst = Institucion(empresa_id=empresa_id, **payload.model_dump())
        db.add(inst)
        db.commit()
        db.refresh(inst)
        return inst

    @staticmethod
    def update(db: Session, institucion_id: UUID, payload: InstitucionUpdate) -> Optional[Institucion]:
        inst = db.query(Institucion).filter(
            Institucion.id == institucion_id,
            Institucion.eliminado_en.is_(None),
        ).first()
        if not inst:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(inst, k, v)
        db.commit()
        db.refresh(inst)
        return inst

    @staticmethod
    def delete(db: Session, institucion_id: UUID) -> bool:
        inst = db.query(Institucion).filter(
            Institucion.id == institucion_id,
            Institucion.eliminado_en.is_(None),
        ).first()
        if not inst:
            return False
        inst.eliminado_en = func.now()
        db.commit()
        return True


class AutoridadService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[Autoridad]:
        q = db.query(Autoridad).filter(
            Autoridad.empresa_id == empresa_id,
            Autoridad.eliminado_en.is_(None),
        )
        if activo is not None:
            q = q.filter(Autoridad.activo == activo)
        return q.order_by(Autoridad.nombre).all()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: AutoridadCreate) -> Autoridad:
        autoridad = Autoridad(empresa_id=empresa_id, **payload.model_dump())
        db.add(autoridad)
        db.commit()
        db.refresh(autoridad)
        return autoridad

    @staticmethod
    def update(db: Session, autoridad_id: UUID, payload: AutoridadUpdate) -> Optional[Autoridad]:
        autoridad = db.query(Autoridad).filter(
            Autoridad.id == autoridad_id,
            Autoridad.eliminado_en.is_(None),
        ).first()
        if not autoridad:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(autoridad, k, v)
        db.commit()
        db.refresh(autoridad)
        return autoridad

    @staticmethod
    def delete(db: Session, autoridad_id: UUID) -> bool:
        autoridad = db.query(Autoridad).filter(
            Autoridad.id == autoridad_id,
            Autoridad.eliminado_en.is_(None),
        ).first()
        if not autoridad:
            return False
        autoridad.eliminado_en = func.now()
        db.commit()
        return True


class AseguradoService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[Asegurado]:
        """Lista asegurados.

        Nota: la tabla asegurados no tiene empresa_id, por lo que el parámetro
        empresa_id se ignora y se listan todos los registros (opcionalmente filtrando por activo).
        """
        q = db.query(Asegurado).filter(Asegurado.eliminado_en.is_(None))
        if activo is not None:
            q = q.filter(Asegurado.activo == activo)
        return q.order_by(Asegurado.nombre).all()

    @staticmethod
    def get_by_id(db: Session, asegurado_id: UUID, empresa_id: UUID) -> Optional[Asegurado]:
        """Obtiene un asegurado por ID.

        Nota: la tabla asegurados no tiene empresa_id, por lo que solo se filtra por id.
        """
        return db.query(Asegurado).filter(
            Asegurado.id == asegurado_id,
            Asegurado.eliminado_en.is_(None),
        ).first()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: AseguradoCreate) -> Asegurado:
        """Crea un asegurado.

        Nota: empresa_id se ignora porque la tabla no tiene esa columna.
        """
        asegurado = Asegurado(**payload.model_dump())
        db.add(asegurado)
        db.commit()
        db.refresh(asegurado)
        return asegurado

    @staticmethod
    def update(db: Session, asegurado_id: UUID, payload: AseguradoUpdate) -> Optional[Asegurado]:
        asegurado = db.query(Asegurado).filter(
            Asegurado.id == asegurado_id,
            Asegurado.eliminado_en.is_(None),
        ).first()
        if not asegurado:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(asegurado, k, v)
        db.commit()
        db.refresh(asegurado)
        return asegurado

    @staticmethod
    def delete(db: Session, asegurado_id: UUID) -> bool:
        asegurado = db.query(Asegurado).filter(
            Asegurado.id == asegurado_id,
            Asegurado.eliminado_en.is_(None),
        ).first()
        if not asegurado:
            return False
        asegurado.eliminado_en = func.now()
        db.commit()
        return True


class ProvenienteService:
    @staticmethod
    def list(db: Session, empresa_id: UUID, activo: Optional[bool] = None) -> List[Proveniente]:
        q = db.query(Proveniente).filter(
            Proveniente.empresa_id == empresa_id,
            Proveniente.eliminado_en.is_(None),
        )
        if activo is not None:
            q = q.filter(Proveniente.activo == activo)
        return q.order_by(Proveniente.nombre).all()

    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: ProvenienteCreate) -> Proveniente:
        proveniente = Proveniente(empresa_id=empresa_id, **payload.model_dump())
        db.add(proveniente)
        db.commit()
        db.refresh(proveniente)
        return proveniente

    @staticmethod
    def update(db: Session, proveniente_id: UUID, payload: ProvenienteUpdate) -> Optional[Proveniente]:
        proveniente = db.query(Proveniente).filter(
            Proveniente.id == proveniente_id,
            Proveniente.eliminado_en.is_(None),
        ).first()
        if not proveniente:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(proveniente, k, v)
        db.commit()
        db.refresh(proveniente)
        return proveniente

    @staticmethod
    def delete(db: Session, proveniente_id: UUID) -> bool:
        proveniente = db.query(Proveniente).filter(
            Proveniente.id == proveniente_id,
            Proveniente.eliminado_en.is_(None),
        ).first()
        if not proveniente:
            return False
        proveniente.eliminado_en = func.now()
        db.commit()
        return True


class ProvenienteContactoService:
    @staticmethod
    def list(db: Session, proveniente_id: UUID) -> List[ProvenienteContacto]:
        return db.query(ProvenienteContacto).filter(
            ProvenienteContacto.proveniente_id == proveniente_id,
            ProvenienteContacto.eliminado_en.is_(None),
        ).order_by(ProvenienteContacto.nombre, ProvenienteContacto.correo).all()

    @staticmethod
    def create(db: Session, proveniente_id: UUID, payload: ProvenienteContactoCreate) -> ProvenienteContacto:
        correo_normalizado = payload.correo.strip().lower()
        existente = db.query(ProvenienteContacto).filter(
            ProvenienteContacto.proveniente_id == proveniente_id,
            func.lower(ProvenienteContacto.correo) == correo_normalizado,
            ProvenienteContacto.eliminado_en.is_(None),
        ).first()
        if existente:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un contacto con ese correo para este proveniente",
            )

        contacto = ProvenienteContacto(
            proveniente_id=proveniente_id,
            nombre=payload.nombre.strip(),
            correo=payload.correo.strip(),
            activo=payload.activo,
        )
        db.add(contacto)
        db.commit()
        db.refresh(contacto)
        return contacto

    @staticmethod
    def delete(db: Session, contacto_id: UUID) -> bool:
        contacto = db.query(ProvenienteContacto).filter(
            ProvenienteContacto.id == contacto_id,
            ProvenienteContacto.eliminado_en.is_(None),
        ).first()
        if not contacto:
            return False
        contacto.eliminado_en = func.now()
        db.commit()
        return True


class TiposDocumentoService:
    @staticmethod
    def list(db: Session, activo: Optional[bool] = None, area_id: Optional[UUID] = None) -> List[TipoDocumento]:
        q = db.query(TipoDocumento).filter(TipoDocumento.eliminado_en.is_(None))
        if activo is not None:
            q = q.filter(TipoDocumento.activo == activo)
        # area_id no existe en la tabla, se ignora
        return q.order_by(TipoDocumento.nombre).all()

    @staticmethod
    def create(db: Session, payload: TiposDocumentoCreate) -> TipoDocumento:
        td = TipoDocumento(**payload.model_dump())
        db.add(td)
        db.commit()
        db.refresh(td)
        return td

    @staticmethod
    def update(db: Session, tipo_documento_id: UUID, payload: TiposDocumentoUpdate) -> Optional[TipoDocumento]:
        td = db.query(TipoDocumento).filter(TipoDocumento.id == tipo_documento_id).first()
        if not td:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(td, k, v)
        db.commit()
        db.refresh(td)
        return td

    @staticmethod
    def get_by_id(db: Session, tipo_documento_id: UUID) -> Optional[TipoDocumento]:
        return db.query(TipoDocumento).filter(
            TipoDocumento.id == tipo_documento_id,
        ).first()

    @staticmethod
    def delete(db: Session, tipo_documento_id: UUID) -> bool:
        td = db.query(TipoDocumento).filter(TipoDocumento.id == tipo_documento_id).first()
        if not td:
            return False
        td.eliminado_en = func.now()
        db.commit()
        return True


class CategoriaDocumentoService:
    @staticmethod
    def list(db: Session, tipo_documento_id: Optional[UUID] = None, activo: Optional[bool] = None) -> List[CategoriaDocumento]:
        q = db.query(CategoriaDocumento)
        if tipo_documento_id:
            q = q.filter(CategoriaDocumento.tipo_documento_id == tipo_documento_id)
        if activo is not None:
            q = q.filter(CategoriaDocumento.activo == activo)
        q = q.filter(CategoriaDocumento.eliminado_en.is_(None))
        return q.order_by(CategoriaDocumento.nombre).all()

    @staticmethod
    def create(db: Session, payload: CategoriaDocumentoCreate) -> CategoriaDocumento:
        # Verificar que el tipo de documento existe
        tipo_doc = db.query(TipoDocumento).filter(TipoDocumento.id == payload.tipo_documento_id).first()
        if not tipo_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de documento no encontrado")
        
        categoria = CategoriaDocumento(**payload.model_dump())
        db.add(categoria)
        db.commit()
        db.refresh(categoria)
        return categoria

    @staticmethod
    def update(db: Session, categoria_id: UUID, payload: CategoriaDocumentoUpdate) -> Optional[CategoriaDocumento]:
        categoria = db.query(CategoriaDocumento).filter(CategoriaDocumento.id == categoria_id).first()
        if not categoria:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(categoria, k, v)
        db.commit()
        db.refresh(categoria)
        return categoria

    @staticmethod
    def get_by_id(db: Session, categoria_id: UUID) -> Optional[CategoriaDocumento]:
        return db.query(CategoriaDocumento).filter(
            CategoriaDocumento.id == categoria_id,
            CategoriaDocumento.eliminado_en.is_(None)
        ).first()

    @staticmethod
    def delete(db: Session, categoria_id: UUID) -> bool:
        categoria = db.query(CategoriaDocumento).filter(CategoriaDocumento.id == categoria_id).first()
        if not categoria:
            return False
        categoria.eliminado_en = func.now()
        db.commit()
        return True


class PlantillaDocumentoService:
    @staticmethod
    def list(
        db: Session, 
        tipo_documento_id: Optional[UUID] = None,
        categoria_id: Optional[UUID] = None,
        activo: Optional[bool] = None
    ) -> List[PlantillaDocumento]:
        q = db.query(PlantillaDocumento)
        if tipo_documento_id:
            q = q.filter(PlantillaDocumento.tipo_documento_id == tipo_documento_id)
        if categoria_id:
            q = q.filter(PlantillaDocumento.categoria_id == categoria_id)
        if activo is not None:
            q = q.filter(PlantillaDocumento.activo == activo)
        q = q.filter(PlantillaDocumento.eliminado_en.is_(None))
        return q.order_by(PlantillaDocumento.nombre).all()

    @staticmethod
    def create(db: Session, payload: PlantillaDocumentoCreate) -> PlantillaDocumento:
        # Verificar que el tipo de documento existe
        tipo_doc = db.query(TipoDocumento).filter(TipoDocumento.id == payload.tipo_documento_id).first()
        if not tipo_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de documento no encontrado")
        
        # Si hay categoría, verificar que existe
        if payload.categoria_id:
            categoria = db.query(CategoriaDocumento).filter(CategoriaDocumento.id == payload.categoria_id).first()
            if not categoria:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
            # Verificar que la categoría pertenece al tipo de documento
            if categoria.tipo_documento_id != payload.tipo_documento_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría no pertenece al tipo de documento")
        
        plantilla = PlantillaDocumento(**payload.model_dump())
        db.add(plantilla)
        db.commit()
        db.refresh(plantilla)
        return plantilla

    @staticmethod
    def update(db: Session, plantilla_id: UUID, payload: PlantillaDocumentoUpdate) -> Optional[PlantillaDocumento]:
        plantilla = db.query(PlantillaDocumento).filter(PlantillaDocumento.id == plantilla_id).first()
        if not plantilla:
            return None
        
        # Si se actualiza la categoría, validar
        if payload.categoria_id is not None:
            if payload.categoria_id:
                categoria = db.query(CategoriaDocumento).filter(CategoriaDocumento.id == payload.categoria_id).first()
                if not categoria:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
                if categoria.tipo_documento_id != plantilla.tipo_documento_id:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría no pertenece al tipo de documento")
        
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(plantilla, k, v)
        db.commit()
        db.refresh(plantilla)
        return plantilla

    @staticmethod
    def get_by_id(db: Session, plantilla_id: UUID) -> Optional[PlantillaDocumento]:
        return db.query(PlantillaDocumento).filter(
            PlantillaDocumento.id == plantilla_id,
            PlantillaDocumento.eliminado_en.is_(None)
        ).first()

    @staticmethod
    def delete(db: Session, plantilla_id: UUID) -> bool:
        plantilla = db.query(PlantillaDocumento).filter(PlantillaDocumento.id == plantilla_id).first()
        if not plantilla:
            return False
        plantilla.eliminado_en = func.now()
        db.commit()
        return True


class RespuestaFormularioService:
    """CRUD para respuestas del formulario personalizado de plantillas"""

    @staticmethod
    def get_or_none(db: Session, plantilla_id: UUID, siniestro_id: UUID) -> Optional[RespuestaFormularioPlantilla]:
        return db.query(RespuestaFormularioPlantilla).filter(
            RespuestaFormularioPlantilla.plantilla_id == plantilla_id,
            RespuestaFormularioPlantilla.siniestro_id == siniestro_id,
        ).first()

    @staticmethod
    def upsert(
        db: Session,
        plantilla_id: UUID,
        siniestro_id: UUID,
        valores: dict,
        usuario_id: Optional[UUID] = None,
    ) -> RespuestaFormularioPlantilla:
        """Crea o actualiza la respuesta de formulario para una plantilla+siniestro."""
        respuesta = RespuestaFormularioService.get_or_none(db, plantilla_id, siniestro_id)
        if respuesta:
            respuesta.valores = {**respuesta.valores, **valores}
            if usuario_id:
                respuesta.usuario_id = usuario_id
        else:
            respuesta = RespuestaFormularioPlantilla(
                plantilla_id=plantilla_id,
                siniestro_id=siniestro_id,
                usuario_id=usuario_id,
                valores=valores,
            )
            db.add(respuesta)
        db.commit()
        db.refresh(respuesta)
        return respuesta

    @staticmethod
    def list_by_siniestro(db: Session, siniestro_id: UUID) -> List[RespuestaFormularioPlantilla]:
        return db.query(RespuestaFormularioPlantilla).filter(
            RespuestaFormularioPlantilla.siniestro_id == siniestro_id,
        ).all()

    @staticmethod
    def delete(db: Session, respuesta_id: UUID) -> bool:
        respuesta = db.query(RespuestaFormularioPlantilla).filter(
            RespuestaFormularioPlantilla.id == respuesta_id
        ).first()
        if not respuesta:
            return False
        db.delete(respuesta)
        db.commit()
        return True


class SiniestroService:
    """Servicio para gestión de siniestros"""
    
    @staticmethod
    def list(
        db: Session,
        empresa_id: UUID,
        activo: Optional[bool] = None,
        estado_id: Optional[UUID] = None,
        proveniente_id: Optional[UUID] = None,
        area_id: Optional[UUID] = None,
        usuario_asignado: Optional[UUID] = None,
        prioridad: Optional[str] = None,
        asegurado_estado: Optional[str] = None,
        fecha_registro_mes: Optional[str] = None,
        busqueda_id: Optional[str] = None,
        numero_siniestro_q: Optional[str] = None,
        asegurado_nombre: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Siniestro]:
        """
        Lista siniestros con filtros opcionales.
        busqueda_id: búsqueda por numero_reporte (formato 102-001-25 o sin guiones).
        numero_siniestro_q: búsqueda por texto en numero_siniestro (ilike).
        asegurado_nombre: búsqueda por nombre del asegurado (ilike en nombre + apellidos).
        """
        q = db.query(Siniestro).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        )
        
        if activo is not None:
            q = q.filter(Siniestro.activo == activo)
        if estado_id is not None:
            q = q.filter(Siniestro.estado_id == estado_id)
        if proveniente_id is not None:
            q = q.filter(Siniestro.proveniente_id == proveniente_id)
        if area_id is not None:
            q = q.join(SiniestroArea).filter(
                SiniestroArea.area_id == area_id,
                SiniestroArea.activo == True
            ).distinct()
        if usuario_asignado is not None:
            q = q.join(SiniestroUsuario).filter(
                SiniestroUsuario.usuario_id == usuario_asignado,
                SiniestroUsuario.activo == True
            ).distinct()
        if prioridad is not None:
            q = q.filter(Siniestro.prioridad == prioridad)
        if fecha_registro_mes and fecha_registro_mes.strip():
            try:
                fecha_inicio = datetime.strptime(fecha_registro_mes.strip(), "%Y-%m")
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El filtro fecha_registro_mes debe usar el formato YYYY-MM",
                ) from exc

            if fecha_inicio.month == 12:
                fecha_fin = fecha_inicio.replace(year=fecha_inicio.year + 1, month=1)
            else:
                fecha_fin = fecha_inicio.replace(month=fecha_inicio.month + 1)

            q = q.filter(
                Siniestro.fecha_registro.isnot(None),
                Siniestro.fecha_registro >= fecha_inicio,
                Siniestro.fecha_registro < fecha_fin,
            )
        if busqueda_id and busqueda_id.strip():
            # ID = clave_proveniente + consecutivo + anualidad (ej. 102-001-25)
            raw = busqueda_id.strip().replace(" ", "")
            codigo_prov: Optional[str] = None
            consecutivo: Optional[str] = None
            anualidad: Optional[str] = None
            if "-" in raw:
                parts = [p.strip() for p in raw.split("-") if p.strip()]
                if len(parts) >= 1:
                    codigo_prov = parts[0]
                if len(parts) >= 2:
                    consecutivo = parts[1].replace(" ", "").zfill(3)[:3]
                if len(parts) >= 3:
                    anualidad = parts[2].replace(" ", "").zfill(2)[-2:]
            else:
                digits = "".join(c for c in raw if c.isdigit())
                if len(digits) >= 5:
                    anualidad = digits[-2:]
                    consecutivo = digits[-5:-2].zfill(3)
                    codigo_prov = digits[:-5] or None
                elif len(digits) >= 1:
                    codigo_prov = digits
            if codigo_prov is not None or consecutivo is not None or anualidad is not None:
                q = q.outerjoin(Proveniente, Siniestro.proveniente_id == Proveniente.id)
                if codigo_prov:
                    codigo_prov_norm = codigo_prov.replace("-", "").replace(" ", "")
                    prov_cod_norm = func.replace(func.replace(func.coalesce(Proveniente.codigo, ""), "-", ""), " ", "")
                    q = q.filter(
                        or_(
                            prov_cod_norm == codigo_prov_norm,
                            prov_cod_norm.like(f"%{codigo_prov_norm}%"),
                        )
                    )
                if consecutivo:
                    consec_norm = consecutivo.zfill(3)[:3]
                    codigo_padded = func.lpad(func.replace(func.coalesce(Siniestro.codigo, ""), " ", ""), 3, "0")
                    q = q.filter(codigo_padded == consec_norm)
                if anualidad and anualidad.isdigit():
                    # Anualidad = 2 dígitos del año (igual que en listado: fecha_registro)
                    fecha_ref = func.coalesce(Siniestro.fecha_registro, Siniestro.fecha_siniestro)
                    year_expr = cast(extract("year", fecha_ref), Integer)
                    q = q.filter(func.mod(year_expr, 100) == int(anualidad))
                q = q.distinct()
        if numero_siniestro_q and numero_siniestro_q.strip():
            q = q.filter(Siniestro.numero_siniestro.ilike(f"%{numero_siniestro_q.strip()}%"))
        if asegurado_nombre and asegurado_nombre.strip():
            q = q.outerjoin(Asegurado, Siniestro.asegurado_id == Asegurado.id).filter(
                func.concat(
                    func.coalesce(Asegurado.nombre, ""),
                    " ",
                    func.coalesce(Asegurado.apellido_paterno, ""),
                    " ",
                    func.coalesce(Asegurado.apellido_materno, ""),
                ).ilike(f"%{asegurado_nombre.strip()}%")
            ).distinct()
        if asegurado_estado and asegurado_estado.strip():
            estado_objetivo = normalizar_nombre_estado(asegurado_estado.strip())
            candidate_ids = [
                siniestro_id for (siniestro_id,) in q.with_entities(Siniestro.id).distinct().all()
            ]
            if not candidate_ids:
                return []

            estados_por_siniestro = db.query(
                Siniestro.id,
                Asegurado.estado,
            ).outerjoin(
                Asegurado,
                Siniestro.asegurado_id == Asegurado.id,
            ).filter(
                Siniestro.id.in_(candidate_ids)
            ).all()

            siniestro_ids_filtrados = [
                siniestro_id
                for siniestro_id, estado_raw in estados_por_siniestro
                if normalizar_nombre_estado(estado_raw) == estado_objetivo
            ]
            if not siniestro_ids_filtrados:
                return []

            q = q.filter(Siniestro.id.in_(siniestro_ids_filtrados))
        
        siniestros = q.order_by(nullslast(Siniestro.fecha_registro.desc())).offset(skip).limit(limit).all()
        
        # Cargar versión actual de descripción y id_formato (proveniente-consecutivo-año) para cada siniestro
        proveniente_ids = list({s.proveniente_id for s in siniestros if s.proveniente_id})
        provenientes_map = {}
        if proveniente_ids:
            for p in db.query(Proveniente).filter(Proveniente.id.in_(proveniente_ids)).all():
                provenientes_map[p.id] = p
        for siniestro in siniestros:
            version_actual = VersionesDescripcionHechosService.get_actual(db, siniestro.id)
            if version_actual:
                setattr(siniestro, "descripcion_hechos", version_actual.descripcion_html)
            else:
                setattr(siniestro, "descripcion_hechos", None)
            # ID formateado: clave proveniente - consecutivo - anualidad (ej. 102-001-26)
            codigo_prov = ""
            if siniestro.proveniente_id and siniestro.proveniente_id in provenientes_map:
                codigo_prov = (provenientes_map[siniestro.proveniente_id].codigo or "").strip()
            consecutivo = ((siniestro.codigo or "").strip()).zfill(3)[:3] if (siniestro.codigo or "").strip() else ""
            fecha_ref = siniestro.fecha_registro or siniestro.fecha_siniestro
            anualidad = ""
            if fecha_ref:
                try:
                    year = fecha_ref.year if hasattr(fecha_ref, "year") else (fecha_ref if isinstance(fecha_ref, int) else None)
                    if year is not None:
                        anualidad = str(int(year) % 100).zfill(2)
                except (TypeError, ValueError):
                    pass
            if codigo_prov and consecutivo and anualidad:
                setattr(siniestro, "id_formato", f"{codigo_prov}-{consecutivo}-{anualidad}")
            else:
                setattr(siniestro, "id_formato", None)
        
        return siniestros
    
    @staticmethod
    def get_by_id(db: Session, siniestro_id: UUID, empresa_id: UUID) -> Optional[Siniestro]:
        """Obtiene un siniestro por ID validando empresa"""
        siniestro = db.query(Siniestro).filter(
            Siniestro.id == siniestro_id,
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).first()
        
        # Cargar la versión actual de la descripción y agregarla como atributo dinámico
        # para que el schema pueda serializarlo (aunque la columna ya no existe en la tabla)
        if siniestro:
            version_actual = VersionesDescripcionHechosService.get_actual(db, siniestro_id)
            if version_actual:
                # Agregar como atributo dinámico para compatibilidad con el schema
                setattr(siniestro, 'descripcion_hechos', version_actual.descripcion_html)
            else:
                setattr(siniestro, 'descripcion_hechos', None)
        
        return siniestro
    
    @staticmethod
    def _generar_codigo(db: Session, proveniente_id: UUID, fecha_siniestro: Optional[datetime] = None) -> str:
        """
        Genera código único para siniestro con formato: {consecutivo}
        Ejemplo: 001, 002, 003, etc.
        El código es único globalmente en la tabla siniestros.
        """
        if not proveniente_id:
            return None
        
        # Buscar el último código usado globalmente (no eliminados)
        ultimo_siniestro = db.query(Siniestro).filter(
            Siniestro.eliminado == False,
            Siniestro.codigo.isnot(None),
            Siniestro.codigo != ''
        ).order_by(
            # Ordenar numéricamente si es posible, sino alfabéticamente
            Siniestro.codigo.desc()
        ).first()
        
        # Si existe un código previo, extraer el consecutivo y sumar 1
        if ultimo_siniestro and ultimo_siniestro.codigo:
            try:
                # Intentar convertir el código a número
                consecutivo = int(ultimo_siniestro.codigo) + 1
            except (ValueError, TypeError):
                # Si no es numérico, buscar el máximo numérico
                todos_codigos = db.query(Siniestro.codigo).filter(
                    Siniestro.eliminado == False,
                    Siniestro.codigo.isnot(None),
                    Siniestro.codigo != ''
                ).all()
                
                numeros = []
                for cod in todos_codigos:
                    try:
                        numeros.append(int(cod[0]))
                    except (ValueError, TypeError):
                        continue
                
                consecutivo = max(numeros) + 1 if numeros else 1
        else:
            consecutivo = 1
        
        # Formatear código con 3 dígitos: {consecutivo}
        codigo = f"{str(consecutivo).zfill(3)}"
        
        # Verificar que no exista y si existe, incrementar hasta encontrar uno disponible
        max_intentos = 1000  # Límite de seguridad
        intentos = 0
        while db.query(Siniestro).filter(
            Siniestro.codigo == codigo,
            Siniestro.eliminado == False
        ).first() and intentos < max_intentos:
            consecutivo += 1
            codigo = f"{str(consecutivo).zfill(3)}"
            intentos += 1
        
        if intentos >= max_intentos:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo generar un código único para el siniestro"
            )
        
        return codigo
    
    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: SiniestroCreate, creado_por: UUID) -> Siniestro:
        """
        Crea un nuevo siniestro.
        Valida que el número de siniestro sea único por empresa (solo si se proporciona).
        Genera código automáticamente si hay proveniente_id.
        """
        # Verificar unicidad del número de siniestro solo si se proporciona
        if payload.numero_siniestro:
            existing = db.query(Siniestro).filter(
                Siniestro.empresa_id == empresa_id,
                Siniestro.numero_siniestro == payload.numero_siniestro,
                Siniestro.eliminado == False
            ).first()
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un siniestro con el número {payload.numero_siniestro}"
                )
        
        # Extraer descripcion_hechos del payload para crear versión
        descripcion_hechos = payload.descripcion_hechos
        payload_dict = payload.model_dump()
        # Remover descripcion_hechos del payload del siniestro (se manejará en versiones)
        # La columna descripcion_hechos ya no existe en la tabla siniestros
        payload_dict.pop('descripcion_hechos', None)

        # Fecha de reporte: solo `fecha_registro`. No persistir `fecha_siniestro` desde el alta (campo legado).
        payload_dict.pop("fecha_siniestro", None)
        
        # Generar código automáticamente si hay proveniente_id
        if payload.proveniente_id:
            try:
                ref_fecha = payload_dict.get("fecha_registro") or getattr(
                    payload, "fecha_registro", None
                )
                codigo = SiniestroService._generar_codigo(db, payload.proveniente_id, ref_fecha)
                if codigo:
                    payload_dict['codigo'] = codigo
            except Exception as e:
                # Si hay error generando el código, continuar sin código
                # El código se puede generar después al actualizar el siniestro
                import logging
                logging.warning(f"Error al generar código para siniestro: {str(e)}")
                pass
        
        siniestro = Siniestro(empresa_id=empresa_id, creado_por=creado_por, **payload_dict)
        db.add(siniestro)
        db.commit()
        db.refresh(siniestro)
        
        # Crear primera versión de la descripción de hechos si se proporcionó
        if descripcion_hechos:
            VersionesDescripcionHechosService.create(
                db,
                VersionesDescripcionHechosCreate(
                    siniestro_id=siniestro.id,
                    descripcion_html=descripcion_hechos,
                    observaciones="Versión inicial"
                ),
                creado_por
            )

        # Log de auditoría
        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=creado_por,
            empresa_id=empresa_id,
            accion="crear",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=siniestro.id,
            datos_nuevos={"numero_siniestro": siniestro.numero_siniestro, "codigo": siniestro.codigo},
            descripcion="Siniestro creado",
        )

        return siniestro
    
    @staticmethod
    def update(db: Session, siniestro_id: UUID, empresa_id: UUID, payload: SiniestroUpdate, actualizado_por: UUID = None) -> Optional[Siniestro]:
        """
        Actualiza un siniestro existente.
        Valida empresa y unicidad del número si se cambia.
        Genera código automáticamente si falta y hay proveniente_id.
        """
        siniestro = db.query(Siniestro).filter(
            Siniestro.id == siniestro_id,
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).first()
        
        if not siniestro:
            return None

        estado_id_antes = siniestro.estado_id
        calificacion_id_antes = siniestro.calificacion_id
        poliza_antes = {
            "numero_poliza": siniestro.numero_poliza,
            "deducible": str(siniestro.deducible) if siniestro.deducible is not None else None,
            "reserva": str(siniestro.reserva) if siniestro.reserva is not None else None,
            "coaseguro": str(siniestro.coaseguro) if siniestro.coaseguro is not None else None,
            "suma_asegurada": str(siniestro.suma_asegurada) if siniestro.suma_asegurada is not None else None,
        }

        # Validar unicidad del número si se cambia y se proporciona un valor
        if payload.numero_siniestro is not None:
            # Si se está estableciendo un número (cambiando de null a valor o cambiando el valor)
            if payload.numero_siniestro != siniestro.numero_siniestro:
                existing = db.query(Siniestro).filter(
                    Siniestro.empresa_id == empresa_id,
                    Siniestro.numero_siniestro == payload.numero_siniestro,
                    Siniestro.id != siniestro_id,
                    Siniestro.eliminado == False
                ).first()
                
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ya existe un siniestro con el número {payload.numero_siniestro}"
                    )
        
        # Extraer descripcion_hechos del payload si viene
        payload_dict = payload.model_dump(exclude_unset=True)
        descripcion_hechos = payload_dict.pop('descripcion_hechos', None)

        # Fecha de reporte: solo `fecha_registro`. Ignorar `fecha_siniestro` en actualizaciones.
        payload_dict.pop("fecha_siniestro", None)
        
        # Generar código automáticamente si falta y hay proveniente_id
        proveniente_id_actualizado = payload_dict.get('proveniente_id', siniestro.proveniente_id)
        if not siniestro.codigo and proveniente_id_actualizado:
            ref_fecha = (
                payload_dict.get("fecha_registro")
                if "fecha_registro" in payload_dict
                else None
            ) or siniestro.fecha_registro or siniestro.fecha_siniestro
            codigo = SiniestroService._generar_codigo(
                db, proveniente_id_actualizado, ref_fecha
            )
            if codigo:
                payload_dict['codigo'] = codigo
        
        # Actualizar campos (sin descripcion_hechos)
        for k, v in payload_dict.items():
            setattr(siniestro, k, v)
        
        db.commit()
        db.refresh(siniestro)
        
        # Si se actualizó la descripción, crear nueva versión
        if descripcion_hechos:
            # Obtener versión actual para comparar
            version_actual = VersionesDescripcionHechosService.get_actual(db, siniestro_id)
            if not version_actual or version_actual.descripcion_html != descripcion_hechos:
                # Usar actualizado_por si está disponible, sino usar creado_por del siniestro
                VersionesDescripcionHechosService.create(
                    db,
                    VersionesDescripcionHechosCreate(
                        siniestro_id=siniestro_id,
                        descripcion_html=descripcion_hechos,
                        observaciones="Actualización desde edición de siniestro"
                    ),
                    actualizado_por or siniestro.creado_por
                )

        # Log de auditoría: cambios específicos
        usuario_audit = actualizado_por or siniestro.creado_por
        if estado_id_antes != siniestro.estado_id:
            estado_anterior_nombre = "Sin estado"
            estado_nuevo_nombre = "Sin estado"
            if estado_id_antes:
                estado_anterior = db.query(EstadoSiniestro).filter(
                    EstadoSiniestro.id == estado_id_antes
                ).first()
                if estado_anterior and getattr(estado_anterior, "nombre", None):
                    estado_anterior_nombre = str(estado_anterior.nombre)
            if siniestro.estado_id:
                estado_nuevo = db.query(EstadoSiniestro).filter(
                    EstadoSiniestro.id == siniestro.estado_id
                ).first()
                if estado_nuevo and getattr(estado_nuevo, "nombre", None):
                    estado_nuevo_nombre = str(estado_nuevo.nombre)

            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion="estado_cambiado",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_anteriores={"estado_id": str(estado_id_antes) if estado_id_antes else None},
                datos_nuevos={"estado_id": str(siniestro.estado_id) if siniestro.estado_id else None},
                descripcion=f"Estado del siniestro cambiado: {estado_anterior_nombre} -> {estado_nuevo_nombre}",
            )
        if calificacion_id_antes != siniestro.calificacion_id:
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion="calificacion_cambiada",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_anteriores={"calificacion_id": str(calificacion_id_antes) if calificacion_id_antes else None},
                datos_nuevos={"calificacion_id": str(siniestro.calificacion_id) if siniestro.calificacion_id else None},
                descripcion="Calificación del siniestro cambiada",
            )

        # Log de póliza si cambian campos relacionados
        poliza_campos = ("numero_poliza", "deducible", "reserva", "coaseguro", "suma_asegurada")
        poliza_cambios = {k: v for k, v in payload_dict.items() if k in poliza_campos}
        if poliza_cambios:
            poliza_nuevos = {
                "numero_poliza": siniestro.numero_poliza,
                "deducible": str(siniestro.deducible) if siniestro.deducible is not None else None,
                "reserva": str(siniestro.reserva) if siniestro.reserva is not None else None,
                "coaseguro": str(siniestro.coaseguro) if siniestro.coaseguro is not None else None,
                "suma_asegurada": str(siniestro.suma_asegurada) if siniestro.suma_asegurada is not None else None,
            }
            tiene_antes = any(poliza_antes.get(k) for k in poliza_campos)
            tiene_nuevos = any(poliza_nuevos.get(k) for k in poliza_campos)
            accion_poliza = "poliza_creada" if not tiene_antes and tiene_nuevos else "poliza_actualizada"
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion=accion_poliza,
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_anteriores=poliza_antes,
                datos_nuevos=poliza_nuevos,
                descripcion="Póliza agregada" if accion_poliza == "poliza_creada" else "Póliza actualizada",
            )

        # Log genérico de actualización si hubo otros cambios (excluyendo estado, calificación y póliza ya logueados)
        exclude_log = ("estado_id", "calificacion_id") + poliza_campos
        otros_cambios = {k: v for k, v in payload_dict.items() if k not in exclude_log}
        # Serializar UUIDs y otros tipos para JSON
        otros_cambios_ser = {}
        for k, v in otros_cambios.items():
            if v is not None and hasattr(v, "__str__"):
                try:
                    otros_cambios_ser[k] = str(v) if hasattr(v, "hex") else v
                except Exception:
                    otros_cambios_ser[k] = str(v)
            else:
                otros_cambios_ser[k] = v
        if otros_cambios_ser:
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion="actualizar",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_nuevos=otros_cambios_ser,
                descripcion="Siniestro actualizado",
            )

        return siniestro
    
    @staticmethod
    def delete(db: Session, siniestro_id: UUID, empresa_id: UUID, usuario_id: Optional[UUID] = None) -> bool:
        """
        Elimina lógicamente un siniestro (soft delete).
        No elimina físicamente para mantener historial.
        """
        siniestro = db.query(Siniestro).filter(
            Siniestro.id == siniestro_id,
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).first()
        
        if not siniestro:
            return False
        
        siniestro.eliminado = True
        siniestro.activo = False
        siniestro.eliminado_en = func.now()
        db.commit()

        # Log de auditoría
        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=usuario_id,
            empresa_id=empresa_id,
            accion="eliminar",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=siniestro_id,
            descripcion="Siniestro eliminado (soft delete)",
        )

        return True


# ===== BITÁCORA DE ACTIVIDADES =====
class BitacoraActividadService:
    """Servicio para gestión de bitácora de actividades"""
    
    @staticmethod
    def list(
        db: Session,
        siniestro_id: UUID,
        usuario_id: Optional[UUID] = None,
        tipo_actividad: Optional[str] = None,
        area_id: Optional[UUID] = None,
        flujo_trabajo_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[BitacoraActividad]:
        """Lista actividades de bitácora con filtros opcionales"""
        q = db.query(BitacoraActividad).filter(BitacoraActividad.siniestro_id == siniestro_id)
        
        if usuario_id is not None:
            q = q.filter(BitacoraActividad.usuario_id == usuario_id)
        if tipo_actividad is not None:
            q = q.filter(BitacoraActividad.tipo_actividad == tipo_actividad)
        if area_id is not None:
            q = q.filter(BitacoraActividad.area_id == area_id)
        if flujo_trabajo_id is not None:
            q = q.filter(BitacoraActividad.flujo_trabajo_id == flujo_trabajo_id)
        
        return q.order_by(BitacoraActividad.fecha_actividad.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_by_id(db: Session, actividad_id: UUID) -> Optional[BitacoraActividad]:
        """Obtiene una actividad por ID"""
        return db.query(BitacoraActividad).filter(BitacoraActividad.id == actividad_id).first()
    
    @staticmethod
    def create(db: Session, payload: BitacoraActividadCreate) -> BitacoraActividad:
        """Crea una nueva actividad en bitácora"""
        actividad = BitacoraActividad(**payload.model_dump())
        db.add(actividad)
        db.commit()
        db.refresh(actividad)
        return actividad
    
    @staticmethod
    def update(db: Session, actividad_id: UUID, payload: BitacoraActividadUpdate) -> Optional[BitacoraActividad]:
        """Actualiza una actividad existente"""
        actividad = db.query(BitacoraActividad).filter(BitacoraActividad.id == actividad_id).first()
        if not actividad:
            return None
        
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(actividad, k, v)
        
        db.commit()
        db.refresh(actividad)
        return actividad
    
    @staticmethod
    def delete(db: Session, actividad_id: UUID) -> bool:
        """Elimina una actividad de bitácora"""
        actividad = db.query(BitacoraActividad).filter(BitacoraActividad.id == actividad_id).first()
        if not actividad:
            return False
        
        db.delete(actividad)
        db.commit()
        return True


# ===== DOCUMENTOS =====
class DocumentoService:
    """Servicio para gestión de documentos"""
    
    @staticmethod
    def list(
        db: Session,
        siniestro_id: UUID,
        tipo_documento_id: Optional[UUID] = None,
        activo: Optional[bool] = None,
        area_id: Optional[UUID] = None,
        flujo_trabajo_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Documento]:
        """Lista documentos con filtros opcionales"""
        q = db.query(Documento).filter(
            Documento.siniestro_id == siniestro_id,
            Documento.eliminado == False
        )
        
        if tipo_documento_id is not None:
            q = q.filter(Documento.tipo_documento_id == tipo_documento_id)
        if activo is not None:
            q = q.filter(Documento.activo == activo)
        if area_id is not None:
            q = q.filter(Documento.area_id == area_id)
        if flujo_trabajo_id is not None:
            q = q.filter(Documento.flujo_trabajo_id == flujo_trabajo_id)
        
        return q.order_by(Documento.creado_en.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_by_id(db: Session, documento_id: UUID) -> Optional[Documento]:
        """Obtiene un documento por ID"""
        return db.query(Documento).filter(
            Documento.id == documento_id,
            Documento.eliminado == False
        ).first()
    
    @staticmethod
    def create(db: Session, payload: DocumentoCreate) -> Documento:
        """Crea un nuevo documento. Excluye campos solo usados para bitácora."""
        data = payload.model_dump(exclude={"horas_trabajadas_bitacora", "comentarios_bitacora"})
        documento = Documento(**data)
        db.add(documento)
        db.commit()
        db.refresh(documento)
        return documento

    @staticmethod
    def _get_next_version(
        db: Session,
        siniestro_id: UUID,
        etapa_flujo_id: Optional[UUID],
        flujo_trabajo_id: Optional[UUID],
        plantilla_documento_id: Optional[UUID],
    ) -> int:
        """
        Obtiene la siguiente versión para un informe dado su contexto lógico.
        Se basa en la versión máxima existente para ese siniestro/etapa/flujo/plantilla.
        """
        q = db.query(Documento).filter(
            Documento.siniestro_id == siniestro_id,
            Documento.eliminado == False,
        )
        if etapa_flujo_id is not None:
            q = q.filter(Documento.etapa_flujo_id == etapa_flujo_id)
        if flujo_trabajo_id is not None:
            q = q.filter(Documento.flujo_trabajo_id == flujo_trabajo_id)
        if plantilla_documento_id is not None:
            q = q.filter(Documento.plantilla_documento_id == plantilla_documento_id)

        ultimo = q.order_by(Documento.version.desc()).first()
        if not ultimo or not getattr(ultimo, "version", None):
            return 1
        return int(ultimo.version) + 1

    @staticmethod
    def update(db: Session, documento_id: UUID, payload: DocumentoUpdate) -> Optional[Documento]:
        """
        Actualiza un documento existente creando una nueva versión (nuevo registro).
        El documento anterior permanece como histórico y se marca como inactivo.
        """
        documento = db.query(Documento).filter(
            Documento.id == documento_id,
            Documento.eliminado == False
        ).first()
        if not documento:
            return None

        exclude = {"horas_trabajadas_bitacora", "comentarios_bitacora"}
        updates = payload.model_dump(exclude_unset=True, exclude=exclude)

        # Calcular siguiente versión para este informe (por contexto lógico)
        next_version = DocumentoService._get_next_version(
            db=db,
            siniestro_id=documento.siniestro_id,
            etapa_flujo_id=documento.etapa_flujo_id,
            flujo_trabajo_id=documento.flujo_trabajo_id,
            plantilla_documento_id=documento.plantilla_documento_id,
        )

        # Marcar la versión anterior como no activa (sigue sin eliminarse)
        documento.activo = False

        # Construir nuevo documento copiando el anterior y aplicando cambios
        nuevo = Documento(
            siniestro_id=documento.siniestro_id,
            tipo_documento_id=updates.get("tipo_documento_id", documento.tipo_documento_id),
            etapa_flujo_id=updates.get("etapa_flujo_id", documento.etapa_flujo_id),
            plantilla_documento_id=updates.get("plantilla_documento_id", documento.plantilla_documento_id),
            area_id=updates.get("area_id", documento.area_id),
            flujo_trabajo_id=updates.get("flujo_trabajo_id", documento.flujo_trabajo_id),
            nombre_archivo=updates.get("nombre_archivo", documento.nombre_archivo),
            ruta_archivo=updates.get("ruta_archivo", documento.ruta_archivo),
            contenido=updates.get("contenido", documento.contenido),
            tamaño_archivo=documento.tamaño_archivo,
            tipo_mime=documento.tipo_mime,
            usuario_subio=documento.usuario_subio,
            version=next_version,
            descripcion=updates.get("descripcion", documento.descripcion),
            fecha_documento=updates.get("fecha_documento", documento.fecha_documento),
            es_principal=updates.get("es_principal", documento.es_principal),
            es_adicional=updates.get("es_adicional", documento.es_adicional),
            activo=True,
            eliminado=False,
        )

        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return nuevo

    @staticmethod
    def delete(db: Session, documento_id: UUID) -> bool:
        """Elimina lógicamente un documento (soft delete)"""
        documento = db.query(Documento).filter(
            Documento.id == documento_id,
            Documento.eliminado == False
        ).first()
        if not documento:
            return False
        
        documento.eliminado = True
        documento.activo = False
        documento.eliminado_en = func.now()
        db.commit()
        return True


# ===== NOTIFICACIONES =====
class NotificacionService:
    """Servicio para gestión de notificaciones"""
    
    @staticmethod
    def list(
        db: Session,
        usuario_id: UUID,
        leida: Optional[bool] = None,
        tipo: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Notificacion]:
        """Lista notificaciones de un usuario con filtros opcionales"""
        q = db.query(Notificacion).filter(Notificacion.usuario_id == usuario_id)
        
        if leida is not None:
            q = q.filter(Notificacion.leida == leida)
        if tipo is not None:
            q = q.filter(Notificacion.tipo == tipo)
        
        return q.order_by(Notificacion.creado_en.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_by_id(db: Session, notificacion_id: UUID, usuario_id: UUID) -> Optional[Notificacion]:
        """Obtiene una notificación por ID validando usuario"""
        return db.query(Notificacion).filter(
            Notificacion.id == notificacion_id,
            Notificacion.usuario_id == usuario_id
        ).first()
    
    @staticmethod
    def create(db: Session, payload: NotificacionCreate) -> Notificacion:
        """Crea una nueva notificación"""
        notificacion = Notificacion(**payload.model_dump())
        db.add(notificacion)
        db.commit()
        db.refresh(notificacion)
        return notificacion
    
    @staticmethod
    def update(db: Session, notificacion_id: UUID, usuario_id: UUID, payload: NotificacionUpdate) -> Optional[Notificacion]:
        """Actualiza una notificación existente"""
        notificacion = db.query(Notificacion).filter(
            Notificacion.id == notificacion_id,
            Notificacion.usuario_id == usuario_id
        ).first()
        if not notificacion:
            return None
        
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(notificacion, k, v)
        
        db.commit()
        db.refresh(notificacion)
        return notificacion
    
    @staticmethod
    def marcar_leida(db: Session, notificacion_id: UUID, usuario_id: UUID) -> bool:
        """Marca una notificación como leída"""
        notificacion = db.query(Notificacion).filter(
            Notificacion.id == notificacion_id,
            Notificacion.usuario_id == usuario_id
        ).first()
        if not notificacion:
            return False
        
        notificacion.leida = True
        db.commit()
        return True
    
    @staticmethod
    def marcar_todas_leidas(db: Session, usuario_id: UUID) -> int:
        """Marca todas las notificaciones de un usuario como leídas"""
        count = db.query(Notificacion).filter(
            Notificacion.usuario_id == usuario_id,
            Notificacion.leida == False
        ).update({Notificacion.leida: True})
        db.commit()
        return count
    
    @staticmethod
    def delete(db: Session, notificacion_id: UUID, usuario_id: UUID) -> bool:
        """Elimina una notificación"""
        notificacion = db.query(Notificacion).filter(
            Notificacion.id == notificacion_id,
            Notificacion.usuario_id == usuario_id
        ).first()
        if not notificacion:
            return False
        
        db.delete(notificacion)
        db.commit()
        return True


# ===== EVIDENCIAS FOTOGRÁFICAS =====
class EvidenciaFotograficaService:
    """Servicio para gestión de evidencias fotográficas"""
    
    @staticmethod
    def list(
        db: Session,
        siniestro_id: UUID,
        activo: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[EvidenciaFotografica]:
        """Lista evidencias fotográficas con filtros opcionales"""
        q = db.query(EvidenciaFotografica).filter(
            EvidenciaFotografica.siniestro_id == siniestro_id,
            EvidenciaFotografica.eliminado == False
        )
        
        if activo is not None:
            q = q.filter(EvidenciaFotografica.activo == activo)
        
        return q.order_by(EvidenciaFotografica.creado_en.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_by_id(db: Session, evidencia_id: UUID) -> Optional[EvidenciaFotografica]:
        """Obtiene una evidencia por ID"""
        return db.query(EvidenciaFotografica).filter(
            EvidenciaFotografica.id == evidencia_id,
            EvidenciaFotografica.eliminado == False
        ).first()
    
    @staticmethod
    def create(db: Session, payload: EvidenciaFotograficaCreate) -> EvidenciaFotografica:
        """Crea una nueva evidencia fotográfica"""
        evidencia = EvidenciaFotografica(**payload.model_dump())
        db.add(evidencia)
        db.commit()
        db.refresh(evidencia)
        return evidencia
    
    @staticmethod
    def update(db: Session, evidencia_id: UUID, payload: EvidenciaFotograficaUpdate) -> Optional[EvidenciaFotografica]:
        """Actualiza una evidencia existente"""
        evidencia = db.query(EvidenciaFotografica).filter(
            EvidenciaFotografica.id == evidencia_id,
            EvidenciaFotografica.eliminado == False
        ).first()
        if not evidencia:
            return None
        
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(evidencia, k, v)
        
        db.commit()
        db.refresh(evidencia)
        return evidencia
    
    @staticmethod
    def delete(db: Session, evidencia_id: UUID) -> bool:
        """Elimina lógicamente una evidencia (soft delete)"""
        evidencia = db.query(EvidenciaFotografica).filter(
            EvidenciaFotografica.id == evidencia_id,
            EvidenciaFotografica.eliminado == False
        ).first()
        if not evidencia:
            return False
        
        evidencia.eliminado = True
        evidencia.activo = False
        evidencia.eliminado_en = func.now()
        db.commit()
        return True


# ===== RELACIONES SINIESTRO-USUARIO (INVOLUCRADOS) =====
class SiniestroUsuarioService:
    """Servicio para gestión de involucrados en siniestros"""
    
    @staticmethod
    def list(db: Session, siniestro_id: UUID, activo: Optional[bool] = None) -> List[SiniestroUsuario]:
        """Lista involucrados de un siniestro"""
        q = db.query(SiniestroUsuario).filter(SiniestroUsuario.siniestro_id == siniestro_id)
        if activo is not None:
            q = q.filter(SiniestroUsuario.activo == activo)
        return q.order_by(SiniestroUsuario.es_principal.desc(), SiniestroUsuario.creado_en).all()
    
    @staticmethod
    def create(db: Session, payload: SiniestroUsuarioCreate, usuario_audit_id: Optional[UUID] = None) -> SiniestroUsuario:
        """Agrega un involucrado a un siniestro"""
        # Verificar que no exista ya la misma relación
        existing = db.query(SiniestroUsuario).filter(
            SiniestroUsuario.siniestro_id == payload.siniestro_id,
            SiniestroUsuario.usuario_id == payload.usuario_id,
            SiniestroUsuario.tipo_relacion == payload.tipo_relacion,
            SiniestroUsuario.activo == True
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe esta relación con el usuario"
            )
        
        relacion = SiniestroUsuario(**payload.model_dump())
        db.add(relacion)
        db.commit()
        db.refresh(relacion)

        # Log de auditoría
        from app.models.user import Usuario
        usu = db.query(Usuario).filter(Usuario.id == payload.usuario_id).first()
        usu_nombre = getattr(usu, "full_name", None) or getattr(usu, "correo", None) or str(payload.usuario_id)
        siniestro = db.query(Siniestro).filter(Siniestro.id == payload.siniestro_id).first()
        empresa_id = siniestro.empresa_id if siniestro else None
        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=usuario_audit_id,
            empresa_id=empresa_id,
            accion="usuario_asignado",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=payload.siniestro_id,
            datos_nuevos={"usuario_id": str(payload.usuario_id), "tipo_relacion": payload.tipo_relacion},
            descripcion=f"Involucrado asignado ({payload.tipo_relacion}): {usu_nombre}",
        )

        return relacion
    
    @staticmethod
    def update(db: Session, relacion_id: UUID, payload: SiniestroUsuarioUpdate) -> Optional[SiniestroUsuario]:
        """Actualiza una relación siniestro-usuario"""
        relacion = db.query(SiniestroUsuario).filter(SiniestroUsuario.id == relacion_id).first()
        if not relacion:
            return None
        
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(relacion, k, v)
        
        db.commit()
        db.refresh(relacion)
        return relacion
    
    @staticmethod
    def delete(db: Session, relacion_id: UUID, usuario_audit_id: Optional[UUID] = None) -> bool:
        """Elimina una relación siniestro-usuario"""
        relacion = db.query(SiniestroUsuario).filter(SiniestroUsuario.id == relacion_id).first()
        if not relacion:
            return False

        siniestro_id = relacion.siniestro_id
        from app.models.user import Usuario
        usu = db.query(Usuario).filter(Usuario.id == relacion.usuario_id).first()
        usu_nombre = getattr(usu, "full_name", None) or getattr(usu, "correo", None) or str(relacion.usuario_id)
        siniestro = db.query(Siniestro).filter(Siniestro.id == siniestro_id).first()
        empresa_id = siniestro.empresa_id if siniestro else None

        db.delete(relacion)
        db.commit()

        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=usuario_audit_id,
            empresa_id=empresa_id,
            accion="usuario_eliminado",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=siniestro_id,
            datos_anteriores={"usuario_id": str(relacion.usuario_id), "tipo_relacion": relacion.tipo_relacion},
            descripcion=f"Involucrado eliminado ({relacion.tipo_relacion}): {usu_nombre}",
        )

        return True


# ===== RELACIONES SINIESTRO-ÁREA =====
class SiniestroAreaService:
    """Servicio para gestión de áreas adicionales en siniestros"""
    
    @staticmethod
    def list(db: Session, siniestro_id: UUID, activo: Optional[bool] = None) -> List[SiniestroArea]:
        """Lista áreas adicionales de un siniestro"""
        q = db.query(SiniestroArea).filter(SiniestroArea.siniestro_id == siniestro_id)
        if activo is not None:
            q = q.filter(SiniestroArea.activo == activo)
        return q.order_by(SiniestroArea.fecha_asignacion.desc()).all()
    
    @staticmethod
    def create(db: Session, payload: SiniestroAreaCreate, usuario_id: Optional[UUID] = None) -> SiniestroArea:
        """Agrega un área a un siniestro"""
        # Validar que el siniestro existe
        from app.models.legal import Siniestro
        siniestro = db.query(Siniestro).filter(
            Siniestro.id == payload.siniestro_id,
            Siniestro.eliminado == False
        ).first()
        if not siniestro:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El siniestro no existe o ha sido eliminado"
            )
        
        # Validar que el área existe
        area = db.query(Area).filter(
            Area.id == payload.area_id,
            Area.eliminado_en.is_(None)
        ).first()
        if not area:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El área no existe o ha sido eliminada"
            )
        
        # Verificar que no exista ya la misma área activa
        existing = db.query(SiniestroArea).filter(
            SiniestroArea.siniestro_id == payload.siniestro_id,
            SiniestroArea.area_id == payload.area_id,
            SiniestroArea.activo == True
        ).first()
        
        if existing:
            # Si ya existe y está activa, retornar la existente en lugar de lanzar error
            # Esto evita errores si se intenta agregar la misma área dos veces
            return existing
        
        # Crear nueva relación
        try:
            # exclude_none para mantener server_default en campos no enviados
            relacion = SiniestroArea(**payload.model_dump(exclude_none=True))
            db.add(relacion)
            db.commit()
            db.refresh(relacion)

            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_id,
                empresa_id=siniestro.empresa_id,
                accion="area_asignada",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=payload.siniestro_id,
                datos_nuevos={"area_id": str(payload.area_id), "area_nombre": area.nombre},
                descripcion=f"Área asignada: {area.nombre}",
            )

            # Notificar por correo al jefe del área usando plantilla de correo.
            try:
                from app.models.user import Usuario

                jefe_id = getattr(area, "usuario_id", None)
                if jefe_id:
                    jefe = db.query(Usuario).filter(Usuario.id == jefe_id).first()
                    if jefe:
                        usuario_asignador = (
                            db.query(Usuario).filter(Usuario.id == usuario_id).first()
                            if usuario_id
                            else None
                        )
                        current_user_ref = usuario_asignador
                        if not current_user_ref:
                            class _SystemUser:
                                pass
                            current_user_ref = _SystemUser()
                            current_user_ref.id = usuario_id
                            current_user_ref.empresa_id = siniestro.empresa_id

                        EmailService.enviar_notificacion_asignacion_area(
                            db=db,
                            siniestro=siniestro,
                            area=area,
                            jefe_area=jefe,
                            current_user=current_user_ref,
                            usuario_asignador=usuario_asignador,
                        )
            except Exception:
                # El fallo de notificación no debe afectar la asignación del área.
                pass

            return relacion
        except Exception as e:
            db.rollback()
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error al crear relación siniestro-área: {str(e)}")
            logger.error(f"Payload: {payload.model_dump()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear la relación: {str(e)}"
            )
    
    @staticmethod
    def update(db: Session, relacion_id: UUID, payload: SiniestroAreaUpdate, usuario_id: Optional[UUID] = None) -> Optional[SiniestroArea]:
        """Actualiza una relación siniestro-área"""
        relacion = db.query(SiniestroArea).filter(SiniestroArea.id == relacion_id).first()
        if not relacion:
            return None

        activo_antes = relacion.activo

        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(relacion, k, v)

        db.commit()
        db.refresh(relacion)

        # Log si cambió el estado activo
        if "activo" in payload.model_dump(exclude_unset=True):
            if activo_antes and not relacion.activo:
                accion_desc = "area_desactivada"
                desc = "Área desactivada"
            elif not activo_antes and relacion.activo:
                accion_desc = "area_activada"
                desc = "Área reactivada"
            else:
                accion_desc = "actualizar"
                desc = "Área adicional actualizada"
            area = db.query(Area).filter(Area.id == relacion.area_id).first()
            area_nombre = area.nombre if area else str(relacion.area_id)
            siniestro = db.query(Siniestro).filter(Siniestro.id == relacion.siniestro_id).first()
            empresa_id = siniestro.empresa_id if siniestro else None
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_id,
                empresa_id=empresa_id,
                accion=accion_desc,
                modulo="siniestros",
                tabla="siniestros",
                registro_id=relacion.siniestro_id,
                datos_anteriores={"activo": activo_antes, "area_nombre": area_nombre},
                datos_nuevos={"activo": relacion.activo, "area_nombre": area_nombre},
                descripcion=desc,
            )

        return relacion
    
    @staticmethod
    def delete(db: Session, relacion_id: UUID, usuario_id: Optional[UUID] = None) -> bool:
        """Elimina una relación siniestro-área"""
        relacion = db.query(SiniestroArea).filter(SiniestroArea.id == relacion_id).first()
        if not relacion:
            return False

        siniestro_id = relacion.siniestro_id
        area = db.query(Area).filter(Area.id == relacion.area_id).first()
        area_nombre = area.nombre if area else str(relacion.area_id)
        siniestro = db.query(Siniestro).filter(Siniestro.id == siniestro_id).first()
        empresa_id = siniestro.empresa_id if siniestro else None

        db.delete(relacion)
        db.commit()

        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=usuario_id,
            empresa_id=empresa_id,
            accion="area_eliminada",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=siniestro_id,
            datos_anteriores={"area_id": str(relacion.area_id), "area_nombre": area_nombre},
            descripcion=f"Área eliminada: {area_nombre}",
        )

        return True


# ===== VERSIONES DE DESCRIPCIÓN DE HECHOS =====
class VersionesDescripcionHechosService:
    """Servicio para gestión de versiones de descripción de hechos"""
    
    @staticmethod
    def list(db: Session, siniestro_id: UUID) -> List[VersionesDescripcionHechos]:
        """Lista todas las versiones de descripción de hechos de un siniestro"""
        return db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.siniestro_id == siniestro_id
        ).order_by(VersionesDescripcionHechos.version.desc()).all()
    
    @staticmethod
    def get_actual(db: Session, siniestro_id: UUID) -> Optional[VersionesDescripcionHechos]:
        """Obtiene la versión actual de la descripción de hechos"""
        return db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.siniestro_id == siniestro_id,
            VersionesDescripcionHechos.es_actual == True
        ).first()
    
    @staticmethod
    def get_by_id(db: Session, version_id: UUID) -> Optional[VersionesDescripcionHechos]:
        """Obtiene una versión específica por ID"""
        return db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.id == version_id
        ).first()
    
    @staticmethod
    def create(db: Session, payload: VersionesDescripcionHechosCreate, creado_por: UUID) -> VersionesDescripcionHechos:
        """
        Crea una nueva versión de descripción de hechos.
        Marca todas las versiones anteriores como no actuales y crea la nueva como actual.
        """
        # Obtener el número de versión siguiente
        ultima_version = db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.siniestro_id == payload.siniestro_id
        ).order_by(VersionesDescripcionHechos.version.desc()).first()
        
        nueva_version = ultima_version.version + 1 if ultima_version else 1
        
        # Marcar todas las versiones anteriores como no actuales
        db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.siniestro_id == payload.siniestro_id,
            VersionesDescripcionHechos.es_actual == True
        ).update({VersionesDescripcionHechos.es_actual: False})
        
        # Crear nueva versión
        nueva_descripcion = VersionesDescripcionHechos(
            siniestro_id=payload.siniestro_id,
            descripcion_html=payload.descripcion_html,
            version=nueva_version,
            es_actual=True,
            creado_por=creado_por,
            observaciones=payload.observaciones
        )
        db.add(nueva_descripcion)
        db.commit()
        db.refresh(nueva_descripcion)
        return nueva_descripcion
    
    @staticmethod
    def update(db: Session, version_id: UUID, payload: VersionesDescripcionHechosUpdate) -> Optional[VersionesDescripcionHechos]:
        """Actualiza una versión existente (solo observaciones)"""
        version = db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.id == version_id
        ).first()
        if not version:
            return None
        
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(version, k, v)
        
        db.commit()
        db.refresh(version)
        return version
    
    @staticmethod
    def restaurar_version(db: Session, version_id: UUID, creado_por: UUID) -> Optional[VersionesDescripcionHechos]:
        """
        Restaura una versión anterior creando una nueva versión con el contenido de la versión especificada.
        """
        version_anterior = db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.id == version_id
        ).first()
        
        if not version_anterior:
            return None
        
        # Crear nueva versión con el contenido de la versión anterior
        return VersionesDescripcionHechosService.create(
            db,
            VersionesDescripcionHechosCreate(
                siniestro_id=version_anterior.siniestro_id,
                descripcion_html=version_anterior.descripcion_html,
                observaciones=f"Restaurada desde versión {version_anterior.version}"
            ),
            creado_por
        )
    
    @staticmethod
    def delete(db: Session, version_id: UUID) -> bool:
        """
        Elimina una versión de descripción de hechos.
        No permite eliminar la versión actual.
        """
        version = db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.id == version_id
        ).first()
        
        if not version:
            return False
        
        if version.es_actual:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar la versión actual de la descripción"
            )
        
        db.delete(version)
        db.commit()
        return True

