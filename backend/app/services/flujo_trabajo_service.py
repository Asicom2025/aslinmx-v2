"""
Servicio para gestión de flujos de trabajo configurables
"""

from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, text
from fastapi import HTTPException, status
from uuid import UUID

from app.models.flujo_trabajo import FlujoTrabajo, EtapaFlujo, SiniestroEtapa
from app.models.legal import TipoDocumento
from app.schemas.flujo_trabajo_schema import (
    FlujoTrabajoCreate,
    FlujoTrabajoUpdate,
    EtapaFlujoCreate,
    EtapaFlujoUpdate,
    CompletarEtapaRequest,
)


class FlujoTrabajoService:
    """Servicio para operaciones CRUD de flujos de trabajo"""

    @staticmethod
    def get_flujos_by_empresa(
        db: Session,
        empresa_id: UUID,
        area_id: Optional[UUID] = None,
        solo_generales: bool = False,
        activo: Optional[bool] = True
    ) -> List[FlujoTrabajo]:
        """Obtiene flujos de trabajo por empresa y opcionalmente por área"""
        from sqlalchemy.orm import joinedload
        
        query = db.query(FlujoTrabajo).options(
            joinedload(FlujoTrabajo.etapas)
        ).filter(
            FlujoTrabajo.empresa_id == empresa_id,
            FlujoTrabajo.eliminado_en.is_(None)
        )

        if solo_generales:
            # Filtrar solo flujos generales (area_id IS NULL)
            query = query.filter(FlujoTrabajo.area_id.is_(None))
        elif area_id is not None:
            # Filtrar por área específica
            query = query.filter(FlujoTrabajo.area_id == area_id)
        # Si area_id es None y solo_generales es False, traer todos los flujos
        
        if activo is not None:
            query = query.filter(FlujoTrabajo.activo == activo)

        return query.order_by(FlujoTrabajo.nombre).all()

    @staticmethod
    def get_flujo_by_id(db: Session, flujo_id: UUID, include_etapas: bool = True) -> Optional[FlujoTrabajo]:
        """Obtiene un flujo por ID con eager loading de etapas"""
        query = db.query(FlujoTrabajo).filter(
            FlujoTrabajo.id == flujo_id,
            FlujoTrabajo.eliminado_en.is_(None)
        )
        
        if include_etapas:
            query = query.options(joinedload(FlujoTrabajo.etapas))
        
        return query.first()

    @staticmethod
    def get_flujo_predeterminado(
        db: Session,
        empresa_id: UUID,
        area_id: Optional[UUID] = None
    ) -> Optional[FlujoTrabajo]:
        """Obtiene el flujo predeterminado con eager loading"""
        # Primero intentar área específica
        if area_id:
            flujo = db.query(FlujoTrabajo).options(
                joinedload(FlujoTrabajo.etapas)
            ).filter(
                FlujoTrabajo.empresa_id == empresa_id,
                FlujoTrabajo.area_id == area_id,
                FlujoTrabajo.es_predeterminado == True,
                FlujoTrabajo.activo == True,
                FlujoTrabajo.eliminado_en.is_(None)
            ).first()

            if flujo:
                return flujo

        # Fallback a flujo general
        return db.query(FlujoTrabajo).options(
            joinedload(FlujoTrabajo.etapas)
        ).filter(
            FlujoTrabajo.empresa_id == empresa_id,
            FlujoTrabajo.area_id.is_(None),
            FlujoTrabajo.es_predeterminado == True,
            FlujoTrabajo.activo == True,
            FlujoTrabajo.eliminado_en.is_(None)
        ).first()

    @staticmethod
    def create_flujo(
        db: Session,
        empresa_id: UUID,
        flujo: FlujoTrabajoCreate
    ) -> FlujoTrabajo:
        """Crea un nuevo flujo de trabajo"""
        # Si es predeterminado, desactivar otros predeterminados de la misma empresa/área
        if flujo.es_predeterminado:
            db.query(FlujoTrabajo).filter(
                FlujoTrabajo.empresa_id == empresa_id,
                FlujoTrabajo.area_id == flujo.area_id,
                FlujoTrabajo.es_predeterminado == True,
                FlujoTrabajo.eliminado_en.is_(None)
            ).update({"es_predeterminado": False})

        db_flujo = FlujoTrabajo(
            empresa_id=empresa_id,
            area_id=flujo.area_id,
            nombre=flujo.nombre,
            descripcion=flujo.descripcion,
            activo=flujo.activo,
            es_predeterminado=flujo.es_predeterminado
        )

        db.add(db_flujo)
        db.commit()
        db.refresh(db_flujo)

        return db_flujo

    @staticmethod
    def update_flujo(
        db: Session,
        flujo_id: UUID,
        empresa_id: UUID,
        flujo_update: FlujoTrabajoUpdate
    ) -> Optional[FlujoTrabajo]:
        """Actualiza un flujo de trabajo"""
        db_flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id)

        if not db_flujo or db_flujo.empresa_id != empresa_id:
            return None

        # Si se marca como predeterminado, desactivar otros
        if flujo_update.es_predeterminado == True:
            db.query(FlujoTrabajo).filter(
                FlujoTrabajo.empresa_id == empresa_id,
                FlujoTrabajo.area_id == (flujo_update.area_id or db_flujo.area_id),
                FlujoTrabajo.id != flujo_id,
                FlujoTrabajo.es_predeterminado == True,
                FlujoTrabajo.eliminado_en.is_(None)
            ).update({"es_predeterminado": False})

        update_data = flujo_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_flujo, field, value)

        db.commit()
        db.refresh(db_flujo)

        return db_flujo

    @staticmethod
    def delete_flujo(
        db: Session,
        flujo_id: UUID,
        empresa_id: UUID
    ) -> bool:
        """Elimina (soft delete) un flujo de trabajo"""
        db_flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id)

        if not db_flujo or db_flujo.empresa_id != empresa_id:
            return False

        db_flujo.eliminado_en = func.now()
        db.commit()

        return True


class EtapaFlujoService:
    """Servicio para operaciones CRUD de etapas"""

    @staticmethod
    def get_etapas_by_flujo(
        db: Session,
        flujo_id: UUID,
        activo: Optional[bool] = True
    ) -> List[EtapaFlujo]:
        """Obtiene etapas de un flujo ordenadas por orden con eager loading"""
        query = db.query(EtapaFlujo).filter(
            EtapaFlujo.flujo_trabajo_id == flujo_id,
            EtapaFlujo.eliminado_en.is_(None)
        )

        if activo is not None:
            query = query.filter(EtapaFlujo.activo == activo)

        return query.order_by(EtapaFlujo.orden).all()

    @staticmethod
    def get_etapa_by_id(db: Session, etapa_id: UUID) -> Optional[EtapaFlujo]:
        """Obtiene una etapa por ID"""
        return db.query(EtapaFlujo).filter(
            EtapaFlujo.id == etapa_id,
            EtapaFlujo.eliminado_en.is_(None)
        ).first()

    @staticmethod
    def create_etapa(
        db: Session,
        etapa: EtapaFlujoCreate
    ) -> EtapaFlujo:
        """Crea una nueva etapa"""
        # Verificar que el flujo existe
        flujo = FlujoTrabajoService.get_flujo_by_id(db, etapa.flujo_trabajo_id)
        if not flujo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El flujo de trabajo no existe"
            )

        # Validar que el tipo de documento existe si se proporciona (tipos_documento no tiene empresa_id)
        if etapa.tipo_documento_principal_id:
            tipo_doc = db.query(TipoDocumento).filter(
                TipoDocumento.id == etapa.tipo_documento_principal_id,
                TipoDocumento.eliminado_en.is_(None),
            ).first()
            if not tipo_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El tipo de documento con ID {etapa.tipo_documento_principal_id} no existe o está eliminado"
                )

        db_etapa = EtapaFlujo(
            flujo_trabajo_id=etapa.flujo_trabajo_id,
            nombre=etapa.nombre,
            descripcion=etapa.descripcion,
            orden=etapa.orden,
            es_obligatoria=etapa.es_obligatoria,
            permite_omision=etapa.permite_omision,
            tipo_documento_principal_id=etapa.tipo_documento_principal_id,
            inhabilita_siguiente=etapa.inhabilita_siguiente,
            activo=etapa.activo
        )

        db.add(db_etapa)
        db.commit()
        db.refresh(db_etapa)

        return db_etapa

    @staticmethod
    def update_etapa(
        db: Session,
        etapa_id: UUID,
        etapa_update: EtapaFlujoUpdate
    ) -> Optional[EtapaFlujo]:
        """Actualiza una etapa"""
        db_etapa = EtapaFlujoService.get_etapa_by_id(db, etapa_id)

        if not db_etapa:
            return None

        update_data = etapa_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_etapa, field, value)

        db.commit()
        db.refresh(db_etapa)

        return db_etapa

    @staticmethod
    def delete_etapa(db: Session, etapa_id: UUID) -> bool:
        """Elimina (soft delete) una etapa"""
        # Buscar la etapa sin filtrar por eliminado para poder eliminarla
        db_etapa = db.query(EtapaFlujo).filter(
            EtapaFlujo.id == etapa_id
        ).first()

        if not db_etapa:
            return False
        
        # Si ya está eliminada, retornar True (ya está eliminada)
        if db_etapa.eliminado_en is not None:
            return True

        db_etapa.eliminado_en = func.now()
        db.commit()

        return True

    @staticmethod
    def reordenar_etapas(
        db: Session,
        flujo_id: UUID,
        ordenes: List[dict]
    ) -> None:
        """Reordena las etapas de un flujo"""
        for item in ordenes:
            # Manejar tanto dict como objetos con atributos
            if isinstance(item, dict):
                etapa_id_str = item.get("etapa_id") or item.get("etapaId")
                nuevo_orden = item.get("orden")
            else:
                etapa_id_str = getattr(item, "etapa_id", None) or getattr(item, "etapaId", None)
                nuevo_orden = getattr(item, "orden", None)
            
            if not etapa_id_str or nuevo_orden is None:
                continue
                
            etapa_id = UUID(str(etapa_id_str)) if not isinstance(etapa_id_str, UUID) else etapa_id_str
            
            etapa = EtapaFlujoService.get_etapa_by_id(db, etapa_id)
            if etapa and etapa.flujo_trabajo_id == flujo_id:
                etapa.orden = nuevo_orden
        
        db.commit()


class SiniestroEtapaService:
    """Servicio para gestión de etapas de siniestros"""

    @staticmethod
    def inicializar_etapas_siniestro(
        db: Session,
        siniestro_id: UUID,
        flujo_trabajo_id: Optional[UUID] = None
    ) -> bool:
        """Inicializa las etapas de un siniestro usando función PostgreSQL"""
        try:
            # Usar función PostgreSQL directamente con text()
            if flujo_trabajo_id:
                db.execute(
                    text("SELECT inicializar_etapas_siniestro(:siniestro_id, :flujo_id)"),
                    {"siniestro_id": str(siniestro_id), "flujo_id": str(flujo_trabajo_id)}
                )
            else:
                db.execute(
                    text("SELECT inicializar_etapas_siniestro(:siniestro_id, NULL)"),
                    {"siniestro_id": str(siniestro_id)}
                )
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al inicializar etapas: {str(e)}"
            )

    @staticmethod
    def get_etapas_by_siniestro(
        db: Session,
        siniestro_id: UUID
    ) -> List[SiniestroEtapa]:
        """Obtiene todas las etapas de un siniestro con eager loading"""
        # Usar atributos de clase directamente (SQLAlchemy 2.0+)
        return db.query(SiniestroEtapa).options(
            joinedload(SiniestroEtapa.etapa_flujo).joinedload(EtapaFlujo.tipo_documento_principal),
            joinedload(SiniestroEtapa.documento_principal)
        ).filter(
            SiniestroEtapa.siniestro_id == siniestro_id
        ).order_by(SiniestroEtapa.fecha_inicio).all()

    @staticmethod
    def completar_etapa(
        db: Session,
        siniestro_id: UUID,
        etapa_flujo_id: UUID,
        usuario_id: UUID,
        request: CompletarEtapaRequest
    ) -> SiniestroEtapa:
        """Completa una etapa del siniestro"""
        # Obtener la etapa del siniestro
        siniestro_etapa = db.query(SiniestroEtapa).filter(
            SiniestroEtapa.siniestro_id == siniestro_id,
            SiniestroEtapa.etapa_flujo_id == etapa_flujo_id
        ).first()

        if not siniestro_etapa:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La etapa no está asignada a este siniestro"
            )

        if siniestro_etapa.estado == "completada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La etapa ya está completada"
            )

        # Actualizar etapa
        siniestro_etapa.estado = "completada"
        siniestro_etapa.fecha_completada = func.now()
        siniestro_etapa.completado_por = usuario_id
        siniestro_etapa.documento_principal_id = request.documento_principal_id
        siniestro_etapa.observaciones = request.observaciones

        db.commit()
        db.refresh(siniestro_etapa)

        return siniestro_etapa

    @staticmethod
    def avanzar_etapa(
        db: Session,
        siniestro_id: UUID,
        usuario_id: UUID
    ) -> Optional[SiniestroEtapa]:
        """Avanza a la siguiente etapa del siniestro"""
        try:
            # Usar función PostgreSQL con text()
            db.execute(
                text("SELECT avanzar_etapa_siniestro(:siniestro_id, :usuario_id)"),
                {"siniestro_id": str(siniestro_id), "usuario_id": str(usuario_id)}
            )
            db.commit()

            # La función retorna el ID de la siguiente etapa activada
            # Por ahora retornamos éxito
            return None
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al avanzar etapa: {str(e)}"
            )

