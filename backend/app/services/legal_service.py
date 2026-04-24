"""
Servicios CRUD para catálogos legales
"""
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, extract, cast, or_, and_, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.types import Integer, String
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.services.auditoria_service import AuditoriaService
from app.services.email_service import EmailService
from app.services.storage_metadata_service import StorageObjectService
from app.services.storage_service import format_siniestro_id_legible, normalize_siniestro_consecutivo
from app.utils.estado_normalization import normalizar_nombre_estado
from app.core.nivel_acceso import usuario_bypass_areas
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
    SiniestroPoliza,
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

# Variantes de nombre de catálogo que se consideran "cancelado" (listados/reportes / activo).
_CANCELLATION_STATE_NAMES = frozenset(
    {
        "cancelado",
        "cancelados",
        "cancleado",  # typo común
        "cancleados",
    }
)


def es_estado_cancelacion_por_nombre(nombre: Optional[str]) -> bool:
    """
    Indica si el nombre del catálogo `estados_siniestro` corresponde a un estado
    de cancelación (excluye inactivos del listado salvo al filtrar por este estado).
    """
    if not nombre or not str(nombre).strip():
        return False
    key = str(nombre).strip().lower()
    if key in _CANCELLATION_STATE_NAMES:
        return True
    # Cualquier variante "cancelad..." (p. ej. "Cancelado (archivado)")
    if key.startswith("cancelad"):
        return True
    if key.startswith("cancleado") or key.startswith("cancleada"):
        return True
    return False


class AreaService:
    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: AreaCreate) -> Area:
        area = Area(empresa_id=empresa_id, **payload.model_dump())
        db.add(area)
        db.commit()
        db.refresh(area)
        return area

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

    @staticmethod
    def update(db: Session, area_id: UUID, empresa_id: UUID, payload: AreaUpdate) -> Optional[Area]:
        area = (
            db.query(Area)
            .filter(
                Area.id == area_id,
                Area.empresa_id == empresa_id,
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
    def delete(db: Session, area_id: UUID, empresa_id: UUID) -> bool:
        area = db.query(Area).filter(
            Area.id == area_id,
            Area.empresa_id == empresa_id,
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
    def update(db: Session, estado_id: UUID, empresa_id: UUID, payload: EstadoSiniestroUpdate) -> Optional[EstadoSiniestro]:
        es = db.query(EstadoSiniestro).filter(
            EstadoSiniestro.id == estado_id,
            EstadoSiniestro.empresa_id == empresa_id,
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
    def delete(db: Session, estado_id: UUID, empresa_id: UUID) -> bool:
        es = db.query(EstadoSiniestro).filter(
            EstadoSiniestro.id == estado_id,
            EstadoSiniestro.empresa_id == empresa_id,
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
        empresa_id: UUID,
        payload: CalificacionSiniestroUpdate,
    ) -> Optional[CalificacionSiniestro]:
        calificacion = db.query(CalificacionSiniestro).filter(
            CalificacionSiniestro.id == calificacion_id,
            CalificacionSiniestro.empresa_id == empresa_id,
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
    def delete(db: Session, calificacion_id: UUID, empresa_id: UUID) -> bool:
        calificacion = db.query(CalificacionSiniestro).filter(
            CalificacionSiniestro.id == calificacion_id,
            CalificacionSiniestro.empresa_id == empresa_id,
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
    def update(db: Session, entidad_id: UUID, empresa_id: UUID, payload: EntidadUpdate) -> Optional[Entidad]:
        entidad = db.query(Entidad).filter(
            Entidad.id == entidad_id,
            Entidad.empresa_id == empresa_id,
            Entidad.eliminado_en.is_(None),
        ).first()
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
    def delete(db: Session, entidad_id: UUID, empresa_id: UUID) -> bool:
        entidad = db.query(Entidad).filter(
            Entidad.id == entidad_id,
            Entidad.empresa_id == empresa_id,
            Entidad.eliminado_en.is_(None),
        ).first()
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
    def update(db: Session, institucion_id: UUID, empresa_id: UUID, payload: InstitucionUpdate) -> Optional[Institucion]:
        inst = db.query(Institucion).filter(
            Institucion.id == institucion_id,
            Institucion.empresa_id == empresa_id,
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
    def delete(db: Session, institucion_id: UUID, empresa_id: UUID) -> bool:
        inst = db.query(Institucion).filter(
            Institucion.id == institucion_id,
            Institucion.empresa_id == empresa_id,
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
    def update(db: Session, autoridad_id: UUID, empresa_id: UUID, payload: AutoridadUpdate) -> Optional[Autoridad]:
        autoridad = db.query(Autoridad).filter(
            Autoridad.id == autoridad_id,
            Autoridad.empresa_id == empresa_id,
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
    def delete(db: Session, autoridad_id: UUID, empresa_id: UUID) -> bool:
        autoridad = db.query(Autoridad).filter(
            Autoridad.id == autoridad_id,
            Autoridad.empresa_id == empresa_id,
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
        data = payload.model_dump()
        c = data.get("correo")
        if c is not None:
            cs = str(c).strip()
            data["correo"] = cs if cs else None
        tl = (data.get("timerst_list") or "").strip()
        if not tl:
            data["timerst_list"] = f"tl-{uuid4()}"
        else:
            data["timerst_list"] = tl
            dup = (
                db.query(Asegurado)
                .filter(
                    Asegurado.timerst_list == data["timerst_list"],
                    Asegurado.eliminado_en.is_(None),
                )
                .first()
            )
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe un asegurado activo con el mismo timerst_list. Deje el campo vacío para generar uno automático o use otro valor.",
                )
        asegurado = Asegurado(**data)
        db.add(asegurado)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se pudo crear el asegurado: conflicto en timerst_list (identificador externo). Si aplica, ejecute la migración en db/postgresql_asegurados_correo_y_timerst_list.sql.",
            )
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
        data = payload.model_dump(exclude_unset=True)
        if "correo" in data and data["correo"] is not None:
            cs = str(data["correo"]).strip()
            data["correo"] = cs if cs else None
        new_tl = data.get("timerst_list")
        if new_tl is not None:
            ntl = new_tl.strip() if isinstance(new_tl, str) else new_tl
            conflict = (
                db.query(Asegurado)
                .filter(
                    Asegurado.timerst_list == ntl,
                    Asegurado.id != asegurado_id,
                    Asegurado.eliminado_en.is_(None),
                )
                .first()
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otro asegurado activo con el mismo timerst_list.",
                )
        for k, v in data.items():
            setattr(asegurado, k, v)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Conflicto al actualizar timerst_list (identificador externo).",
            )
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
    def update(db: Session, proveniente_id: UUID, empresa_id: UUID, payload: ProvenienteUpdate) -> Optional[Proveniente]:
        proveniente = db.query(Proveniente).filter(
            Proveniente.id == proveniente_id,
            Proveniente.empresa_id == empresa_id,
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
    def delete(db: Session, proveniente_id: UUID, empresa_id: UUID) -> bool:
        proveniente = db.query(Proveniente).filter(
            Proveniente.id == proveniente_id,
            Proveniente.empresa_id == empresa_id,
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
    def get_or_none(
        db: Session,
        plantilla_id: UUID,
        siniestro_id: UUID,
        area_id: Optional[UUID] = None,
    ) -> Optional[RespuestaFormularioPlantilla]:
        q = db.query(RespuestaFormularioPlantilla).filter(
            RespuestaFormularioPlantilla.plantilla_id == plantilla_id,
            RespuestaFormularioPlantilla.siniestro_id == siniestro_id,
        )
        if area_id is None:
            q = q.filter(RespuestaFormularioPlantilla.area_id.is_(None))
        else:
            q = q.filter(RespuestaFormularioPlantilla.area_id == area_id)
        return q.first()

    @staticmethod
    def upsert(
        db: Session,
        plantilla_id: UUID,
        siniestro_id: UUID,
        area_id: Optional[UUID],
        valores: dict,
        usuario_id: Optional[UUID] = None,
    ) -> RespuestaFormularioPlantilla:
        """Crea o actualiza la respuesta de formulario para una plantilla+siniestro+área."""
        respuesta = RespuestaFormularioService.get_or_none(
            db,
            plantilla_id,
            siniestro_id,
            area_id,
        )
        if respuesta:
            respuesta.valores = {**respuesta.valores, **valores}
            if usuario_id:
                respuesta.usuario_id = usuario_id
        else:
            respuesta = RespuestaFormularioPlantilla(
                plantilla_id=plantilla_id,
                siniestro_id=siniestro_id,
                area_id=area_id,
                usuario_id=usuario_id,
                valores=valores,
            )
            db.add(respuesta)
        db.commit()
        db.refresh(respuesta)
        return respuesta

    @staticmethod
    def list_by_siniestro(
        db: Session,
        siniestro_id: UUID,
        area_id: Optional[UUID] = None,
    ) -> List[RespuestaFormularioPlantilla]:
        q = db.query(RespuestaFormularioPlantilla).filter(
            RespuestaFormularioPlantilla.siniestro_id == siniestro_id,
        )
        if area_id is not None:
            q = q.filter(RespuestaFormularioPlantilla.area_id == area_id)
        return q.all()

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

    POLIZA_DECIMAL_FIELDS = ("deducible", "reserva", "coaseguro", "suma_asegurada")

    @staticmethod
    def _decimal_or_zero(value: Any) -> Decimal:
        if value is None or value == "":
            return Decimal("0.00")
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))

    @staticmethod
    def _poliza_snapshot_from_values(values: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": str(values["id"]) if values.get("id") else None,
            "numero_poliza": values.get("numero_poliza"),
            "deducible": str(SiniestroService._decimal_or_zero(values.get("deducible"))),
            "reserva": str(SiniestroService._decimal_or_zero(values.get("reserva"))),
            "coaseguro": str(SiniestroService._decimal_or_zero(values.get("coaseguro"))),
            "suma_asegurada": str(SiniestroService._decimal_or_zero(values.get("suma_asegurada"))),
            "es_principal": bool(values.get("es_principal", False)),
            "orden": int(values.get("orden", 0) or 0),
        }

    @staticmethod
    def _poliza_snapshot(poliza: SiniestroPoliza) -> Dict[str, Any]:
        return SiniestroService._poliza_snapshot_from_values(
            {
                "id": poliza.id,
                "numero_poliza": poliza.numero_poliza,
                "deducible": poliza.deducible,
                "reserva": poliza.reserva,
                "coaseguro": poliza.coaseguro,
                "suma_asegurada": poliza.suma_asegurada,
                "es_principal": poliza.es_principal,
                "orden": poliza.orden,
            }
        )

    @staticmethod
    def _poliza_is_empty(values: Dict[str, Any]) -> bool:
        numero = (values.get("numero_poliza") or "").strip()
        if numero:
            return False
        return all(
            SiniestroService._decimal_or_zero(values.get(field)) == Decimal("0.00")
            for field in SiniestroService.POLIZA_DECIMAL_FIELDS
        )

    @staticmethod
    def _normalize_polizas_payload(
        polizas: Optional[List[Any]],
        legacy_source: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        raw_items: List[Any] = list(polizas or [])
        if not raw_items and legacy_source is not None:
            raw_items = [
                {
                    "numero_poliza": (
                        legacy_source.get("numero_poliza")
                        if isinstance(legacy_source, dict)
                        else getattr(legacy_source, "numero_poliza", None)
                    ),
                    "deducible": (
                        legacy_source.get("deducible")
                        if isinstance(legacy_source, dict)
                        else getattr(legacy_source, "deducible", None)
                    ),
                    "reserva": (
                        legacy_source.get("reserva")
                        if isinstance(legacy_source, dict)
                        else getattr(legacy_source, "reserva", None)
                    ),
                    "coaseguro": (
                        legacy_source.get("coaseguro")
                        if isinstance(legacy_source, dict)
                        else getattr(legacy_source, "coaseguro", None)
                    ),
                    "suma_asegurada": (
                        legacy_source.get("suma_asegurada")
                        if isinstance(legacy_source, dict)
                        else getattr(legacy_source, "suma_asegurada", None)
                    ),
                }
            ]

        normalized: List[Dict[str, Any]] = []
        for idx, item in enumerate(raw_items):
            if hasattr(item, "model_dump"):
                data = item.model_dump(exclude_none=False)
            elif isinstance(item, dict):
                data = dict(item)
            else:
                data = {}

            numero_poliza = (data.get("numero_poliza") or "").strip() or None
            values = {
                "id": data.get("id"),
                "numero_poliza": numero_poliza,
                "deducible": SiniestroService._decimal_or_zero(data.get("deducible")),
                "reserva": SiniestroService._decimal_or_zero(data.get("reserva")),
                "coaseguro": SiniestroService._decimal_or_zero(data.get("coaseguro")),
                "suma_asegurada": SiniestroService._decimal_or_zero(data.get("suma_asegurada")),
                "es_principal": idx == 0,
                "orden": idx,
            }
            if SiniestroService._poliza_is_empty(values):
                continue
            normalized.append(values)

        if normalized:
            normalized[0]["es_principal"] = True
            for idx in range(1, len(normalized)):
                normalized[idx]["es_principal"] = False
                normalized[idx]["orden"] = idx
        return normalized

    @staticmethod
    def _ordered_polizas(polizas: Optional[List[SiniestroPoliza]]) -> List[SiniestroPoliza]:
        return sorted(
            list(polizas or []),
            key=lambda poliza: (
                0 if getattr(poliza, "es_principal", False) else 1,
                getattr(poliza, "orden", 0) or 0,
                getattr(poliza, "creado_en", None) or datetime.min,
            ),
        )

    @staticmethod
    def _ensure_polizas_ordered(siniestro: Siniestro) -> Siniestro:
        ordered = SiniestroService._ordered_polizas(getattr(siniestro, "polizas", []))
        setattr(siniestro, "polizas", ordered)
        return siniestro

    @staticmethod
    def _attach_id_formato(
        db: Session,
        siniestro: Siniestro,
        provenientes_map: Optional[Dict[Any, Any]] = None,
    ) -> None:
        """ID legible: proveniente-consecutivo-anualidad (misma regla en listado y detalle)."""
        codigo_prov = ""
        if siniestro.proveniente_id:
            if provenientes_map is not None and siniestro.proveniente_id in provenientes_map:
                codigo_prov = (provenientes_map[siniestro.proveniente_id].codigo or "").strip()
            else:
                prov = (
                    db.query(Proveniente)
                    .filter(Proveniente.id == siniestro.proveniente_id)
                    .first()
                )
                if prov:
                    codigo_prov = (prov.codigo or "").strip()
        fid = format_siniestro_id_legible(
            codigo_prov,
            (siniestro.codigo or "").strip(),
            anualidad_column=getattr(siniestro, "anualidad", None),
            fecha_registro=siniestro.fecha_registro,
            fecha_siniestro=siniestro.fecha_siniestro,
        )
        setattr(siniestro, "id_formato", fid)

    @staticmethod
    def _nombre_asegurado_display(aseg: Optional[Asegurado]) -> Optional[str]:
        if not aseg:
            return None
        nombre = (getattr(aseg, "nombre", None) or "").strip()
        ap_pat = (getattr(aseg, "apellido_paterno", None) or "").strip()
        ap_mat = (getattr(aseg, "apellido_materno", None) or "").strip()
        full = " ".join(part for part in (nombre, ap_pat, ap_mat) if part)
        return full or None

    @staticmethod
    def _attach_asegurado_nombres(db: Session, siniestros: List[Siniestro]) -> None:
        """Adjunta `asegurado_nombre` en memoria para serializar en `SiniestroResponse`."""
        if not siniestros:
            return
        ids = list({s.asegurado_id for s in siniestros if getattr(s, "asegurado_id", None)})
        if not ids:
            for s in siniestros:
                setattr(s, "asegurado_nombre", None)
            return
        rows = db.query(Asegurado).filter(Asegurado.id.in_(ids)).all()
        by_id = {a.id: SiniestroService._nombre_asegurado_display(a) for a in rows}
        for s in siniestros:
            aid = getattr(s, "asegurado_id", None)
            setattr(s, "asegurado_nombre", by_id.get(aid) if aid else None)

    @staticmethod
    def _sync_polizas(
        db: Session,
        siniestro: Siniestro,
        polizas_payload: List[Dict[str, Any]],
    ) -> Dict[str, List[Dict[str, Any]]]:
        existing_polizas = SiniestroService._ordered_polizas(getattr(siniestro, "polizas", []))
        existing_by_id = {str(poliza.id): poliza for poliza in existing_polizas if poliza.id}
        seen_ids = set()
        created_logs: List[Dict[str, Any]] = []
        created_refs: List[SiniestroPoliza] = []
        updated_logs: List[Dict[str, Any]] = []
        deleted_logs: List[Dict[str, Any]] = []

        for payload in polizas_payload:
            poliza_id = str(payload["id"]) if payload.get("id") else None
            if poliza_id and poliza_id in existing_by_id:
                poliza = existing_by_id[poliza_id]
                before = SiniestroService._poliza_snapshot(poliza)
                poliza.numero_poliza = payload.get("numero_poliza")
                poliza.deducible = payload["deducible"]
                poliza.reserva = payload["reserva"]
                poliza.coaseguro = payload["coaseguro"]
                poliza.suma_asegurada = payload["suma_asegurada"]
                poliza.es_principal = payload["es_principal"]
                poliza.orden = payload["orden"]
                seen_ids.add(poliza_id)
                after = SiniestroService._poliza_snapshot_from_values(payload)
                after["id"] = before["id"]
                if before != after:
                    updated_logs.append({"before": before, "after": after})
            else:
                poliza = SiniestroPoliza(
                    siniestro_id=siniestro.id,
                    numero_poliza=payload.get("numero_poliza"),
                    deducible=payload["deducible"],
                    reserva=payload["reserva"],
                    coaseguro=payload["coaseguro"],
                    suma_asegurada=payload["suma_asegurada"],
                    es_principal=payload["es_principal"],
                    orden=payload["orden"],
                )
                db.add(poliza)
                created_refs.append(poliza)
                created_logs.append({"after": SiniestroService._poliza_snapshot_from_values(payload)})

        for poliza in existing_polizas:
            poliza_id = str(poliza.id) if poliza.id else None
            if poliza_id and poliza_id not in seen_ids:
                deleted_logs.append({"before": SiniestroService._poliza_snapshot(poliza)})
                db.delete(poliza)

        db.flush()

        for created, poliza in zip(created_logs, created_refs):
            created["after"] = SiniestroService._poliza_snapshot(poliza)

        return {
            "created": created_logs,
            "updated": updated_logs,
            "deleted": deleted_logs,
        }
    
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
        calificacion_id: Optional[UUID] = None,
        asegurado_estado: Optional[str] = None,
        fecha_registro_mes: Optional[str] = None,
        busqueda_id: Optional[str] = None,
        numero_siniestro_q: Optional[str] = None,
        asegurado_nombre: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        current_user=None,
    ) -> List[Siniestro]:
        """
        Lista siniestros con filtros opcionales.
        busqueda_id: búsqueda por numero_reporte (formato 102-001-25 o sin guiones).
        numero_siniestro_q: búsqueda por texto en numero_siniestro (ilike).
        asegurado_nombre: búsqueda por nombre del asegurado (ilike en nombre + apellidos).
        """
        q = db.query(Siniestro).options(selectinload(Siniestro.polizas)).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        )

        if current_user is not None:
            from app.services.siniestro_acceso_service import subquery_siniestros_visibles

            sub = subquery_siniestros_visibles(db, current_user, empresa_id)
            if sub is not None:
                q = q.filter(Siniestro.id.in_(sub))

        if activo is not None:
            q = q.filter(Siniestro.activo == activo)
        else:
            incluir_inactivos_por_cancelacion = False
            if estado_id is not None:
                row_est = (
                    db.query(EstadoSiniestro)
                    .filter(
                        EstadoSiniestro.id == estado_id,
                        EstadoSiniestro.empresa_id == empresa_id,
                    )
                    .first()
                )
                nom = getattr(row_est, "nombre", None) if row_est else None
                if es_estado_cancelacion_por_nombre(nom):
                    incluir_inactivos_por_cancelacion = True
            if not incluir_inactivos_por_cancelacion:
                q = q.filter(Siniestro.activo == True)
        if estado_id is not None:
            q = q.filter(Siniestro.estado_id == estado_id)
        if proveniente_id is not None:
            q = q.filter(Siniestro.proveniente_id == proveniente_id)
        if area_id is not None:
            q = q.join(SiniestroArea).filter(
                SiniestroArea.area_id == area_id,
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            ).distinct()
        if usuario_asignado is not None:
            q = q.join(SiniestroUsuario).filter(
                SiniestroUsuario.usuario_id == usuario_asignado,
                SiniestroUsuario.activo == True,
                SiniestroUsuario.eliminado == False,
            ).distinct()
        if prioridad is not None:
            q = q.filter(Siniestro.prioridad == prioridad)
        if calificacion_id is not None:
            q = q.filter(Siniestro.calificacion_id == calificacion_id)
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
                    consecutivo = normalize_siniestro_consecutivo(parts[1])
                if len(parts) >= 3:
                    anualidad = parts[2].replace(" ", "").zfill(2)[-2:]
            else:
                digits = "".join(c for c in raw if c.isdigit())
                if len(digits) >= 6:
                    anualidad = digits[-2:]
                elif len(digits) >= 1:
                    codigo_prov = digits
            if codigo_prov is not None or consecutivo is not None or anualidad is not None:
                q = q.outerjoin(Proveniente, Siniestro.proveniente_id == Proveniente.id)
                prov_cod_norm = func.replace(func.replace(func.coalesce(Proveniente.codigo, ""), "-", ""), " ", "")
                codigo_clean = func.replace(func.coalesce(Siniestro.codigo, ""), " ", "")
                codigo_norm_expr = case(
                    (func.length(codigo_clean) < 3, func.lpad(codigo_clean, 3, "0")),
                    else_=codigo_clean,
                )
                if codigo_prov:
                    codigo_prov_norm = codigo_prov.replace("-", "").replace(" ", "")
                    q = q.filter(
                        or_(
                            prov_cod_norm == codigo_prov_norm,
                            prov_cod_norm.like(f"%{codigo_prov_norm}%"),
                        )
                    )
                elif anualidad and raw.isdigit():
                    body = digits[:-2]
                    split_filters = []
                    for split_index in range(1, len(body) - 1):
                        candidate_prov = body[:split_index]
                        candidate_consecutivo = normalize_siniestro_consecutivo(body[split_index:])
                        if not candidate_prov or not candidate_consecutivo or len(candidate_consecutivo) < 3:
                            continue
                        split_filters.append(
                            and_(
                                prov_cod_norm == candidate_prov,
                                codigo_norm_expr == candidate_consecutivo,
                            )
                        )
                    if split_filters:
                        q = q.filter(or_(*split_filters))
                if consecutivo:
                    q = q.filter(codigo_norm_expr == consecutivo)
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
        
        siniestros = q.order_by(Siniestro.creado_en.desc()).offset(skip).limit(limit).all()
        
        # Cargar versión actual de descripción y id_formato (proveniente-consecutivo-año) para cada siniestro
        proveniente_ids = list({s.proveniente_id for s in siniestros if s.proveniente_id})
        provenientes_map = {}
        if proveniente_ids:
            for p in db.query(Proveniente).filter(Proveniente.id.in_(proveniente_ids)).all():
                provenientes_map[p.id] = p
        versiones_actuales_por_siniestro: dict[UUID, str] = {}
        if siniestros:
            siniestro_ids = [s.id for s in siniestros]
            versiones_actuales = (
                db.query(
                    VersionesDescripcionHechos.siniestro_id,
                    VersionesDescripcionHechos.descripcion_html,
                )
                .filter(
                    VersionesDescripcionHechos.siniestro_id.in_(siniestro_ids),
                    VersionesDescripcionHechos.es_actual == True,
                    VersionesDescripcionHechos.eliminado_en.is_(None),
                )
                .all()
            )
            versiones_actuales_por_siniestro = {
                siniestro_id: descripcion_html
                for siniestro_id, descripcion_html in versiones_actuales
            }

        for siniestro in siniestros:
            setattr(
                siniestro,
                "descripcion_hechos",
                versiones_actuales_por_siniestro.get(siniestro.id),
            )
            SiniestroService._ensure_polizas_ordered(siniestro)
            SiniestroService._attach_id_formato(db, siniestro, provenientes_map)

        SiniestroService._attach_asegurado_nombres(db, siniestros)

        return siniestros
    
    @staticmethod
    def get_by_id(db: Session, siniestro_id: UUID, empresa_id: UUID) -> Optional[Siniestro]:
        """Obtiene un siniestro por ID validando empresa"""
        siniestro = db.query(Siniestro).options(selectinload(Siniestro.polizas)).filter(
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
            SiniestroService._ensure_polizas_ordered(siniestro)
            SiniestroService._attach_id_formato(db, siniestro, None)
            SiniestroService._attach_asegurado_nombres(db, [siniestro])

        return siniestro
    
    @staticmethod
    def _anio_calendario_referencia(fecha: Optional[datetime]) -> int:
        """Año calendario para agrupar consecutivos (misma regla que el sufijo del id_formato)."""
        if fecha is not None:
            try:
                y = getattr(fecha, "year", None)
                if y is not None:
                    return int(y)
            except (TypeError, ValueError):
                pass
        return datetime.now(timezone.utc).year

    @staticmethod
    def _sql_anio_siniestro_columna():
        """
        Año calendario para filtros de consecutivo: columna `anualidad` si existe, si no fechas (filas legadas).
        """
        extract_part = extract(
            "year",
            func.coalesce(Siniestro.fecha_registro, Siniestro.fecha_siniestro, Siniestro.creado_en),
        )
        return func.coalesce(Siniestro.anualidad, extract_part)

    @staticmethod
    def _entero_desde_codigo_atributo(codigo: Optional[str]) -> Optional[int]:
        """Interpreta el consecutivo numérico guardado en siniestros.codigo (001, 102-099-26, 1123124.01)."""
        if codigo is None:
            return None
        s = str(codigo).strip()
        if not s:
            return None
        if s.count("-") >= 2:
            parts = [p.strip() for p in s.split("-") if p.strip() != ""]
            if len(parts) >= 3 and parts[1].isdigit():
                return int(parts[1])
        if "." in s:
            tail = s.rsplit(".", 1)[-1]
            digits = "".join(c for c in tail if c.isdigit())
            if digits:
                return int(digits)
        digits = "".join(c for c in s if c.isdigit())
        if not digits:
            return None
        try:
            return int(digits)
        except ValueError:
            return None

    @staticmethod
    def _normalizar_codigo_consecutivo_manual(raw: Optional[str]) -> Optional[str]:
        """Normaliza entrada del usuario (622, 102-622-26) al formato de consecutivo persistido (mín. 3 dígitos visibles vía normalize_siniestro_consecutivo)."""
        if raw is None:
            return None
        s = str(raw).strip()
        if not s:
            return None
        if s.count("-") >= 2:
            parts = [p.strip() for p in s.split("-") if p.strip() != ""]
            if len(parts) >= 3 and parts[1].isdigit():
                return normalize_siniestro_consecutivo(parts[1])
        if "." in s:
            tail = s.rsplit(".", 1)[-1].strip()
            digits = "".join(c for c in tail if c.isdigit())
            if digits:
                return normalize_siniestro_consecutivo(digits)
        digits = "".join(c for c in s if c.isdigit())
        if digits:
            return normalize_siniestro_consecutivo(digits)
        return None

    @staticmethod
    def _generar_codigo(db: Session, proveniente_id: UUID, fecha_referencia: Optional[datetime] = None) -> str:
        """
        Genera consecutivo (codigo) ej. 001, 002, por proveniente y año calendario de referencia
        (fecha_registro / fecha_siniestro / creado_en en filas existentes). Otro año u otro
        proveniente reinicia la serie (p. ej. 102-099-25 y 102-099-26).
        """
        if not proveniente_id:
            return None

        year_ref = SiniestroService._anio_calendario_referencia(fecha_referencia)

        rows = (
            db.query(Siniestro.codigo)
            .filter(
                Siniestro.eliminado == False,
                Siniestro.proveniente_id == proveniente_id,
                Siniestro.codigo.isnot(None),
                Siniestro.codigo != "",
                SiniestroService._sql_anio_siniestro_columna() == year_ref,
            )
            .all()
        )
        max_n = 0
        for (c,) in rows:
            n = SiniestroService._entero_desde_codigo_atributo(c)
            if n is not None and n > max_n:
                max_n = n
        consecutivo = max_n + 1 if max_n else 1
        codigo = str(consecutivo).zfill(3)

        max_intentos = 1000
        intentos = 0
        while (
            db.query(Siniestro)
            .filter(
                Siniestro.codigo == codigo,
                Siniestro.proveniente_id == proveniente_id,
                Siniestro.eliminado == False,
                SiniestroService._sql_anio_siniestro_columna() == year_ref,
            )
            .first()
            and intentos < max_intentos
        ):
            consecutivo += 1
            codigo = str(consecutivo).zfill(3)
            intentos += 1

        if intentos >= max_intentos:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo generar un código único para el siniestro en este proveniente y año",
            )
        return codigo
    
    @staticmethod
    def create(db: Session, empresa_id: UUID, payload: SiniestroCreate, creado_por: UUID) -> Siniestro:
        """
        Crea un nuevo siniestro.
        numero_siniestro y numero_reporte no son únicos (pueden repetirse, p. ej. S/N o N/A).
        Genera código automáticamente si hay proveniente_id.
        """
        # Extraer descripcion_hechos del payload para crear versión
        descripcion_hechos = payload.descripcion_hechos
        polizas_payload = SiniestroService._normalize_polizas_payload(
            getattr(payload, "polizas", None),
            payload,
        )
        payload_dict = payload.model_dump()
        # Remover descripcion_hechos del payload del siniestro (se manejará en versiones)
        # La columna descripcion_hechos ya no existe en la tabla siniestros
        payload_dict.pop('descripcion_hechos', None)

        payload_dict.pop("polizas", None)
        payload_dict.pop("anualidad", None)

        fr = payload_dict.get("fecha_registro")
        if payload_dict.get("fecha_reporte") is None and fr is not None:
            payload_dict["fecha_reporte"] = fr

        codigo_manual = payload_dict.pop("codigo", None)
        texto_codigo_manual = None if codigo_manual is None else str(codigo_manual).strip()
        ref_fecha_codigo = payload_dict.get("fecha_registro") or getattr(
            payload, "fecha_registro", None
        )
        year_consecutivo = SiniestroService._anio_calendario_referencia(ref_fecha_codigo)
        
        # Consecutivo del ID (codigo): manual opcional o autogenerado por proveniente + año
        if payload.proveniente_id:
            norm_manual = SiniestroService._normalizar_codigo_consecutivo_manual(texto_codigo_manual)
            if texto_codigo_manual and not norm_manual:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El consecutivo del ID debe ser numérico (ej. 622 o formato 102-622-26).",
                )
            if norm_manual:
                dup = (
                    db.query(Siniestro)
                    .filter(
                        Siniestro.eliminado == False,
                        Siniestro.proveniente_id == payload.proveniente_id,
                        Siniestro.codigo == norm_manual,
                        SiniestroService._sql_anio_siniestro_columna() == year_consecutivo,
                    )
                    .first()
                )
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Ya existe un siniestro con el consecutivo {norm_manual} para este proveniente "
                            f"en el año {year_consecutivo}."
                        ),
                    )
                payload_dict["codigo"] = norm_manual
            else:
                try:
                    codigo = SiniestroService._generar_codigo(db, payload.proveniente_id, ref_fecha_codigo)
                    if codigo:
                        payload_dict["codigo"] = codigo
                except Exception as e:
                    import logging

                    logging.warning("Error al generar código para siniestro: %s", str(e))

        payload_dict["anualidad"] = year_consecutivo

        siniestro = Siniestro(empresa_id=empresa_id, creado_por=creado_por, **payload_dict)
        db.add(siniestro)
        db.flush()
        if polizas_payload:
            SiniestroService._sync_polizas(db, siniestro, polizas_payload)
        db.commit()
        siniestro = (
            db.query(Siniestro)
            .options(selectinload(Siniestro.polizas))
            .filter(Siniestro.id == siniestro.id)
            .first()
        )
        SiniestroService._ensure_polizas_ordered(siniestro)
        
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
        setattr(siniestro, "descripcion_hechos", descripcion_hechos if descripcion_hechos else None)

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
        Valida empresa. numero_siniestro y numero_reporte pueden repetirse entre siniestros.
        Genera código automáticamente si falta y hay proveniente_id.
        """
        siniestro = db.query(Siniestro).options(selectinload(Siniestro.polizas)).filter(
            Siniestro.id == siniestro_id,
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).first()
        
        if not siniestro:
            return None

        estado_id_antes = siniestro.estado_id
        calificacion_id_antes = siniestro.calificacion_id

        # Extraer descripcion_hechos del payload si viene
        payload_dict = payload.model_dump(exclude_unset=True)
        descripcion_hechos = payload_dict.pop('descripcion_hechos', None)
        poliza_sync_requested = "polizas" in payload_dict
        polizas_payload = (
            SiniestroService._normalize_polizas_payload(
                payload_dict.get("polizas"),
                payload_dict,
            )
            if poliza_sync_requested
            else None
        )

        payload_dict.pop("polizas", None)
        payload_dict.pop("anualidad", None)

        if "fecha_registro" in payload_dict:
            fr_nueva = payload_dict["fecha_registro"]
            ref_anualidad = fr_nueva if fr_nueva is not None else siniestro.fecha_registro
            ref_anualidad = ref_anualidad or siniestro.fecha_siniestro or siniestro.creado_en
            payload_dict["anualidad"] = SiniestroService._anio_calendario_referencia(ref_anualidad)
            if "fecha_reporte" not in payload_dict:
                if fr_nueva is not None:
                    payload_dict["fecha_reporte"] = fr_nueva

        proveniente_id_actualizado = payload_dict.get("proveniente_id", siniestro.proveniente_id)

        codigo_explicito = "codigo" in payload_dict
        if codigo_explicito:
            raw_c = payload_dict["codigo"]
            if raw_c is None or (isinstance(raw_c, str) and not str(raw_c).strip()):
                payload_dict["codigo"] = None
            else:
                norm = SiniestroService._normalizar_codigo_consecutivo_manual(str(raw_c))
                if not norm:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El consecutivo del ID debe ser numérico (ej. 622 o 102-622-26).",
                    )
                if not proveniente_id_actualizado:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Asigne un proveniente antes de definir el consecutivo del ID.",
                    )
                ref_dup = (
                    payload_dict.get("fecha_registro")
                    if "fecha_registro" in payload_dict
                    else None
                ) or siniestro.fecha_registro or siniestro.fecha_siniestro
                year_dup = SiniestroService._anio_calendario_referencia(ref_dup)
                dup = (
                    db.query(Siniestro)
                    .filter(
                        Siniestro.id != siniestro_id,
                        Siniestro.eliminado == False,
                        Siniestro.proveniente_id == proveniente_id_actualizado,
                        Siniestro.codigo == norm,
                        SiniestroService._sql_anio_siniestro_columna() == year_dup,
                    )
                    .first()
                )
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Ya existe un siniestro con el consecutivo {norm} para este proveniente "
                            f"en el año {year_dup}."
                        ),
                    )
                payload_dict["codigo"] = norm

        if (
            not codigo_explicito
            and not siniestro.codigo
            and proveniente_id_actualizado
        ):
            ref_fecha = (
                payload_dict.get("fecha_registro")
                if "fecha_registro" in payload_dict
                else None
            ) or siniestro.fecha_registro or siniestro.fecha_siniestro
            codigo = SiniestroService._generar_codigo(
                db, proveniente_id_actualizado, ref_fecha
            )
            if codigo:
                payload_dict["codigo"] = codigo
        
        # Actualizar campos (sin descripcion_hechos)
        for k, v in payload_dict.items():
            setattr(siniestro, k, v)

        # Casar `activo` con estado de cancelación en catálogo (y reactivar al salir de cancelado).
        if not siniestro.eliminado:
            if siniestro.estado_id:
                st_row = (
                    db.query(EstadoSiniestro)
                    .filter(
                        EstadoSiniestro.id == siniestro.estado_id,
                        EstadoSiniestro.empresa_id == empresa_id,
                    )
                    .first()
                )
                if st_row and es_estado_cancelacion_por_nombre(
                    getattr(st_row, "nombre", None)
                ):
                    siniestro.activo = False
                else:
                    siniestro.activo = True
            else:
                siniestro.activo = True

        poliza_logs = {"created": [], "updated": [], "deleted": []}
        if polizas_payload is not None:
            poliza_logs = SiniestroService._sync_polizas(db, siniestro, polizas_payload)
        
        db.commit()
        siniestro = (
            db.query(Siniestro)
            .options(selectinload(Siniestro.polizas))
            .filter(Siniestro.id == siniestro_id)
            .first()
        )
        SiniestroService._ensure_polizas_ordered(siniestro)
        
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
            setattr(siniestro, "descripcion_hechos", descripcion_hechos)
        else:
            version_actual = VersionesDescripcionHechosService.get_actual(db, siniestro_id)
            setattr(
                siniestro,
                "descripcion_hechos",
                version_actual.descripcion_html if version_actual else None,
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

        for created in poliza_logs["created"]:
            after = created["after"]
            descripcion_numero = after.get("numero_poliza") or f"Póliza {int(after.get('orden', 0)) + 1}"
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion="poliza_creada",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_nuevos=after,
                descripcion=f"Póliza agregada: {descripcion_numero}",
            )

        for updated in poliza_logs["updated"]:
            before = updated["before"]
            after = updated["after"]
            descripcion_numero = after.get("numero_poliza") or before.get("numero_poliza") or f"Póliza {int(after.get('orden', 0)) + 1}"
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion="poliza_actualizada",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_anteriores=before,
                datos_nuevos=after,
                descripcion=f"Póliza actualizada: {descripcion_numero}",
            )

        for deleted in poliza_logs["deleted"]:
            before = deleted["before"]
            descripcion_numero = before.get("numero_poliza") or f"Póliza {int(before.get('orden', 0)) + 1}"
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=usuario_audit,
                empresa_id=empresa_id,
                accion="poliza_eliminada",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                datos_anteriores=before,
                descripcion=f"Póliza eliminada: {descripcion_numero}",
            )

        # Log genérico de actualización si hubo otros cambios (excluyendo estado, calificación y póliza ya logueados)
        exclude_log = ("estado_id", "calificacion_id", "polizas")
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
        siniestro.eliminado_en = datetime.now(timezone.utc)
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
        q = q.options(joinedload(Documento.storage_object))
        
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
        ).options(joinedload(Documento.storage_object)).first()
    
    @staticmethod
    def create(db: Session, payload: DocumentoCreate) -> Documento:
        """Crea un nuevo documento. Excluye campos solo usados para bitácora."""
        data = payload.model_dump(exclude={"horas_trabajadas_bitacora", "comentarios_bitacora"})
        documento = Documento(**data)
        db.add(documento)
        db.flush()
        StorageObjectService.sync_document_link_state(db, documento.storage_object_id)
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
        previous_storage_object_id = documento.storage_object_id

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
            storage_object_id=updates.get("storage_object_id", documento.storage_object_id),
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
        db.flush()
        StorageObjectService.sync_document_link_state(db, previous_storage_object_id)
        if nuevo.storage_object_id != previous_storage_object_id:
            StorageObjectService.sync_document_link_state(db, nuevo.storage_object_id)
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
        documento.eliminado_en = datetime.now(timezone.utc)
        StorageObjectService.sync_document_link_state(db, documento.storage_object_id)
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
    def _get_siniestro_area_ids(db: Session, siniestro_id: UUID) -> set[str]:
        """Obtiene las áreas activas asignadas al siniestro."""
        return {
            str(area_id)
            for (area_id,) in db.query(SiniestroArea.area_id).filter(
                SiniestroArea.siniestro_id == siniestro_id,
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            ).all()
            if area_id
        }

    @staticmethod
    def _get_usuario_area_ids(db: Session, usuario_id: UUID) -> set[str]:
        """Obtiene las áreas asignadas al usuario."""
        from app.models.user import UsuarioArea

        return {
            str(area_id)
            for (area_id,) in db.query(UsuarioArea.area_id).filter(
                UsuarioArea.usuario_id == usuario_id,
            ).all()
            if area_id
        }

    @staticmethod
    def _validar_abogado_en_areas_del_siniestro(
        db: Session,
        siniestro_id: UUID,
        usuario_id: UUID,
    ) -> None:
        """
        Valida que el abogado tenga al menos un área coincidente con el siniestro.
        """
        from app.models.user import Usuario

        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if usuario and usuario_bypass_areas(db, usuario):
            return

        siniestro_area_ids = SiniestroUsuarioService._get_siniestro_area_ids(
            db, siniestro_id
        )
        if not siniestro_area_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No se puede asignar un abogado porque el siniestro no "
                    "tiene áreas asignadas"
                ),
            )

        usuario_area_ids = SiniestroUsuarioService._get_usuario_area_ids(
            db, usuario_id
        )
        if not usuario_area_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No se puede asignar este abogado porque no tiene áreas "
                    "asignadas"
                ),
            )

        if usuario_area_ids.isdisjoint(siniestro_area_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No se puede asignar este abogado porque no comparte "
                    "ninguna de las áreas del siniestro"
                ),
            )

    @staticmethod
    def _clear_otros_principales(
        db: Session, siniestro_id: UUID, keep_relacion_id: UUID
    ) -> None:
        """Un solo involucrado principal por siniestro (legado informes/PDF)."""
        for otra in (
            db.query(SiniestroUsuario)
            .filter(
                SiniestroUsuario.siniestro_id == siniestro_id,
                SiniestroUsuario.id != keep_relacion_id,
                SiniestroUsuario.eliminado == False,
            )
            .all()
        ):
            otra.es_principal = False
    
    @staticmethod
    def list(db: Session, siniestro_id: UUID, activo: Optional[bool] = None) -> List[SiniestroUsuario]:
        """Lista involucrados de un siniestro"""
        q = db.query(SiniestroUsuario).filter(
            SiniestroUsuario.siniestro_id == siniestro_id,
            SiniestroUsuario.eliminado == False,
        )
        if activo is not None:
            q = q.filter(SiniestroUsuario.activo == activo)
        return q.order_by(SiniestroUsuario.es_principal.desc(), SiniestroUsuario.creado_en).all()

    @staticmethod
    def get_by_id(db: Session, relacion_id: UUID) -> Optional[SiniestroUsuario]:
        return db.query(SiniestroUsuario).filter(
            SiniestroUsuario.id == relacion_id,
            SiniestroUsuario.eliminado == False,
        ).first()
    
    @staticmethod
    def create(db: Session, payload: SiniestroUsuarioCreate, usuario_audit_id: Optional[UUID] = None) -> SiniestroUsuario:
        """Agrega un abogado involucrado a un siniestro"""
        SiniestroUsuarioService._validar_abogado_en_areas_del_siniestro(
            db,
            payload.siniestro_id,
            payload.usuario_id,
        )

        # Verificar que no exista ya la misma relación
        existing = db.query(SiniestroUsuario).filter(
            SiniestroUsuario.siniestro_id == payload.siniestro_id,
            SiniestroUsuario.usuario_id == payload.usuario_id,
            SiniestroUsuario.eliminado == False,
        ).first()
        
        if existing:
            if existing.activo:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ya existe esta relación con el usuario",
                )
            existing.activo = True
            existing.eliminado = False
            existing.eliminado_en = None
            existing.es_principal = payload.es_principal
            if payload.observaciones is not None:
                existing.observaciones = payload.observaciones
            db.commit()
            db.refresh(existing)
            if existing.es_principal:
                SiniestroUsuarioService._clear_otros_principales(
                    db, payload.siniestro_id, existing.id
                )
                db.commit()
            return existing

        existing_deleted = db.query(SiniestroUsuario).filter(
            SiniestroUsuario.siniestro_id == payload.siniestro_id,
            SiniestroUsuario.usuario_id == payload.usuario_id,
            SiniestroUsuario.eliminado == True,
        ).order_by(SiniestroUsuario.actualizado_en.desc()).first()
        if existing_deleted:
            existing_deleted.activo = True
            existing_deleted.eliminado = False
            existing_deleted.eliminado_en = None
            existing_deleted.es_principal = payload.es_principal
            existing_deleted.observaciones = payload.observaciones
            db.commit()
            db.refresh(existing_deleted)
            if existing_deleted.es_principal:
                SiniestroUsuarioService._clear_otros_principales(
                    db, payload.siniestro_id, existing_deleted.id
                )
                db.commit()
            return existing_deleted
        
        relacion = SiniestroUsuario(**payload.model_dump())
        db.add(relacion)
        db.commit()
        db.refresh(relacion)
        if relacion.es_principal:
            SiniestroUsuarioService._clear_otros_principales(
                db, relacion.siniestro_id, relacion.id
            )
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
            datos_nuevos={"usuario_id": str(payload.usuario_id)},
            descripcion=f"Abogado asignado: {usu_nombre}",
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

        if payload.model_dump(exclude_unset=True).get("activo") is True:
            relacion.eliminado = False
            relacion.eliminado_en = None

        if relacion.es_principal:
            SiniestroUsuarioService._clear_otros_principales(
                db, relacion.siniestro_id, relacion.id
            )
        
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

        relacion.activo = False
        relacion.eliminado = True
        relacion.eliminado_en = func.now()
        db.commit()

        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=usuario_audit_id,
            empresa_id=empresa_id,
            accion="usuario_eliminado",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=siniestro_id,
            datos_anteriores={"usuario_id": str(relacion.usuario_id)},
            descripcion=f"Abogado eliminado: {usu_nombre}",
        )

        return True


# ===== RELACIONES SINIESTRO-ÁREA =====
class SiniestroAreaService:
    """Servicio para gestión de áreas adicionales en siniestros"""
    
    @staticmethod
    def list(db: Session, siniestro_id: UUID, activo: Optional[bool] = None) -> List[SiniestroArea]:
        """Lista áreas adicionales de un siniestro"""
        q = db.query(SiniestroArea).filter(
            SiniestroArea.siniestro_id == siniestro_id,
            SiniestroArea.eliminado == False,
        )
        if activo is not None:
            q = q.filter(SiniestroArea.activo == activo)
        return q.order_by(SiniestroArea.fecha_asignacion.desc()).all()

    @staticmethod
    def get_by_id(db: Session, relacion_id: UUID) -> Optional[SiniestroArea]:
        return db.query(SiniestroArea).filter(
            SiniestroArea.id == relacion_id,
            SiniestroArea.eliminado == False,
        ).first()
    
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
            SiniestroArea.eliminado == False,
        ).first()
        
        if existing:
            if not existing.activo:
                existing.activo = True
                existing.eliminado = False
                existing.eliminado_en = None
                db.commit()
                db.refresh(existing)
            return existing

        existing_deleted = db.query(SiniestroArea).filter(
            SiniestroArea.siniestro_id == payload.siniestro_id,
            SiniestroArea.area_id == payload.area_id,
            SiniestroArea.eliminado == True,
        ).order_by(SiniestroArea.actualizado_en.desc()).first()
        if existing_deleted:
            existing_deleted.activo = True
            existing_deleted.eliminado = False
            existing_deleted.eliminado_en = None
            if payload.fecha_asignacion is not None:
                existing_deleted.fecha_asignacion = payload.fecha_asignacion
            if payload.observaciones is not None:
                existing_deleted.observaciones = payload.observaciones
            db.commit()
            db.refresh(existing_deleted)
            return existing_deleted
        
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
    def _validate_abogado_principal_informe(
        db: Session,
        siniestro_id: UUID,
        area_id: UUID,
        abogado_id: Optional[UUID],
    ) -> None:
        if abogado_id is None:
            return
        from app.models.user import UsuarioArea

        su = (
            db.query(SiniestroUsuario)
            .filter(
                SiniestroUsuario.siniestro_id == siniestro_id,
                SiniestroUsuario.usuario_id == abogado_id,
                SiniestroUsuario.activo == True,  # noqa: E712
                SiniestroUsuario.eliminado == False,  # noqa: E712
            )
            .first()
        )
        if not su:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El abogado principal de informes debe estar asignado al siniestro y activo",
            )
        in_area = (
            db.query(UsuarioArea)
            .filter(
                UsuarioArea.usuario_id == abogado_id,
                UsuarioArea.area_id == area_id,
            )
            .first()
        )
        if not in_area:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El abogado debe pertenecer al área de esta asignación",
            )

    @staticmethod
    def update(db: Session, relacion_id: UUID, payload: SiniestroAreaUpdate, usuario_id: Optional[UUID] = None) -> Optional[SiniestroArea]:
        """Actualiza una relación siniestro-área"""
        relacion = db.query(SiniestroArea).filter(SiniestroArea.id == relacion_id).first()
        if not relacion:
            return None

        activo_antes = relacion.activo

        dump = payload.model_dump(exclude_unset=True)
        if "abogado_principal_informe_id" in dump:
            SiniestroAreaService._validate_abogado_principal_informe(
                db,
                relacion.siniestro_id,
                relacion.area_id,
                dump.get("abogado_principal_informe_id"),
            )
        for k, v in dump.items():
            setattr(relacion, k, v)
        if dump.get("activo") is True:
            relacion.eliminado = False
            relacion.eliminado_en = None

        db.commit()
        db.refresh(relacion)

        # Log si cambió el estado activo
        if "activo" in dump:
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

        relacion.activo = False
        relacion.eliminado = True
        relacion.eliminado_en = func.now()
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
            VersionesDescripcionHechos.siniestro_id == siniestro_id,
            VersionesDescripcionHechos.eliminado_en.is_(None),
        ).order_by(VersionesDescripcionHechos.version.desc()).all()
    
    @staticmethod
    def get_actual(db: Session, siniestro_id: UUID) -> Optional[VersionesDescripcionHechos]:
        """Obtiene la versión actual de la descripción de hechos"""
        return db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.siniestro_id == siniestro_id,
            VersionesDescripcionHechos.es_actual == True,
            VersionesDescripcionHechos.eliminado_en.is_(None),
        ).first()
    
    @staticmethod
    def get_by_id(db: Session, version_id: UUID) -> Optional[VersionesDescripcionHechos]:
        """Obtiene una versión específica por ID"""
        return db.query(VersionesDescripcionHechos).filter(
            VersionesDescripcionHechos.id == version_id,
            VersionesDescripcionHechos.eliminado_en.is_(None),
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
            VersionesDescripcionHechos.es_actual == True,
            VersionesDescripcionHechos.eliminado_en.is_(None),
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
            VersionesDescripcionHechos.id == version_id,
            VersionesDescripcionHechos.eliminado_en.is_(None),
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
            VersionesDescripcionHechos.id == version_id,
            VersionesDescripcionHechos.eliminado_en.is_(None),
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
            VersionesDescripcionHechos.id == version_id,
            VersionesDescripcionHechos.eliminado_en.is_(None),
        ).first()
        
        if not version:
            return False
        
        if version.es_actual:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar la versión actual de la descripción"
            )
        
        version.eliminado_en = func.now()
        db.commit()
        return True

